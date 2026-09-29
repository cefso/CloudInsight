import json
import io
import logging
import threading
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from database import get_db, SessionLocal
from models import InspectionTask, InspectionResult, CloudAccount, Customer
from schemas.inspection import TriggerInspectionRequest
from utils.response import success_response
from services.inspection_engine import InspectionEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/inspections", tags=["巡检任务"])


def _run_inspection_background(account_ids, trigger_type, task_id):
    """后台执行巡检任务"""
    db = SessionLocal()
    try:
        engine = InspectionEngine(db)
        engine.run_inspection(account_ids=account_ids, trigger_type=trigger_type, task_id=task_id)
    except Exception as e:
        logger.error(f"巡检任务执行失败: {e}", exc_info=True)
        # 确保失败任务不会永远停留在 running 状态
        try:
            task = db.query(InspectionTask).filter(InspectionTask.id == task_id).first()
            if task and task.status == "running":
                task.status = "failed"
                task.completed_at = datetime.now(timezone.utc)
                task.error_message = str(e)
                db.commit()
        except Exception:
            logger.error(f"更新失败任务状态时出错: task_id={task_id}")
    finally:
        db.close()


def _resolve_account_ids(db: Session, account_ids, customer_ids) -> Optional[list[int]]:
    """按请求解析实际巡检账号 ID 列表；None 表示全部启用账号"""
    if account_ids:
        return account_ids
    if customer_ids:
        rows = (
            db.query(CloudAccount.id)
            .filter(
                CloudAccount.customer_id.in_(customer_ids),
                CloudAccount.is_enabled.is_(True),
            )
            .all()
        )
        return [row[0] for row in rows]
    return None


@router.post("/trigger")
def trigger_inspection(request: TriggerInspectionRequest, db: Session = Depends(get_db)):
    account_ids = _resolve_account_ids(db, request.account_ids, request.customer_ids)
    if account_ids is not None and len(account_ids) == 0:
        raise HTTPException(status_code=400, detail="无可用云账号，请先选择账号或客户")

    task = InspectionTask(
        trigger_type="manual",
        status="running",
        started_at=datetime.now(timezone.utc),
        customer_ids=json.dumps(request.customer_ids) if request.customer_ids else None,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    thread = threading.Thread(
        target=_run_inspection_background,
        args=(account_ids, "manual", task.id),
        daemon=True
    )
    thread.start()

    return success_response(data={"task_id": task.id}, message="巡检任务已启动")


def _customer_names(db: Session, customer_ids: Optional[list[int]]) -> list[str]:
    if not customer_ids:
        return []
    rows = db.query(Customer.name).filter(Customer.id.in_(customer_ids)).all()
    return [name for (name,) in rows]


def _serialize_task(
    task: InspectionTask,
    account_names: list[str] = None,
    customer_ids: list[int] = None,
    customer_names: list[str] = None,
) -> dict:
    """序列化巡检任务"""
    return {
        "id": task.id,
        "trigger_type": task.trigger_type,
        "status": task.status,
        "started_at": task.started_at,
        "completed_at": task.completed_at,
        "total_resources": task.total_resources,
        "normal_count": task.normal_count,
        "warning_count": task.warning_count,
        "abnormal_count": task.abnormal_count,
        "error_message": task.error_message,
        "account_names": account_names or [],
        "customer_ids": customer_ids or [],
        "customer_names": customer_names or [],
    }


@router.get("/tasks")
def list_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    trigger_type: Optional[str] = None,
    account_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(InspectionTask)
    if trigger_type:
        query = query.filter(InspectionTask.trigger_type == trigger_type)
    if account_id:
        task_ids = db.query(InspectionResult.task_id).filter(
            InspectionResult.account_id == account_id
        ).distinct().subquery()
        query = query.filter(InspectionTask.id.in_(task_ids))
    if customer_id:
        # 优先匹配任务上的客户快照；无快照的旧任务回退为账号归属
        customer_account_ids = [
            row[0] for row in
            db.query(CloudAccount.id).filter(CloudAccount.customer_id == customer_id).all()
        ]
        snapshot_task_ids = []
        for row in db.query(InspectionTask.id, InspectionTask.customer_ids).filter(
            InspectionTask.customer_ids.isnot(None)
        ).all():
            try:
                ids = json.loads(row.customer_ids) if row.customer_ids else []
            except (TypeError, json.JSONDecodeError):
                ids = []
            if customer_id in ids:
                snapshot_task_ids.append(row.id)
        fallback_task_ids = []
        if customer_account_ids:
            fallback_task_ids = [
                row[0] for row in
                db.query(InspectionResult.task_id).filter(
                    InspectionResult.account_id.in_(customer_account_ids)
                ).distinct().all()
            ]
        matched_ids = set(snapshot_task_ids) | set(fallback_task_ids)
        query = query.filter(InspectionTask.id.in_(matched_ids) if matched_ids else False)
    total = query.count()
    tasks = query.order_by(desc(InspectionTask.started_at)).offset((page - 1) * page_size).limit(page_size).all()
    pages = (total + page_size - 1) // page_size

    # 批量获取所有任务关联的账号名称，避免 N+1 查询
    task_ids = [t.id for t in tasks]
    task_account_map: dict[int, list[str]] = {}
    if task_ids:
        account_rows = (
            db.query(InspectionResult.task_id, CloudAccount.name)
            .join(CloudAccount, InspectionResult.account_id == CloudAccount.id)
            .filter(InspectionResult.task_id.in_(task_ids))
            .distinct()
            .all()
        )
        for task_id, name in account_rows:
            task_account_map.setdefault(task_id, []).append(name)

    items = []
    for task in tasks:
        try:
            cids = json.loads(task.customer_ids) if task.customer_ids else []
        except (TypeError, json.JSONDecodeError):
            cids = []
        items.append(_serialize_task(
            task,
            task_account_map.get(task.id, []),
            cids,
            _customer_names(db, cids),
        ))

    return success_response(data={
        "items": items,
        "total": total, "page": page, "page_size": page_size, "pages": pages
    })


@router.get("/tasks/{task_id}")
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(InspectionTask).filter(InspectionTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    account_rows = (
        db.query(CloudAccount.name)
        .join(InspectionResult, InspectionResult.account_id == CloudAccount.id)
        .filter(InspectionResult.task_id == task_id)
        .distinct()
        .all()
    )
    account_names = [name for (name,) in account_rows]
    try:
        cids = json.loads(task.customer_ids) if task.customer_ids else []
    except (TypeError, json.JSONDecodeError):
        cids = []
    return success_response(data=_serialize_task(
        task, account_names, cids, _customer_names(db, cids)
    ))


@router.get("/results")
def list_results(
    task_id: Optional[int] = None,
    account_id: Optional[int] = None,
    resource_type: Optional[str] = None,
    is_abnormal: Optional[bool] = None,
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(InspectionResult)
    if task_id is not None:
        query = query.filter(InspectionResult.task_id == task_id)
    if account_id is not None:
        query = query.filter(InspectionResult.account_id == account_id)
    if customer_id is not None:
        customer_account_ids = [
            row[0] for row in
            db.query(CloudAccount.id).filter(CloudAccount.customer_id == customer_id).all()
        ]
        query = query.filter(
            InspectionResult.account_id.in_(customer_account_ids)
            if customer_account_ids
            else False
        )
    if resource_type is not None:
        query = query.filter(InspectionResult.resource_type == resource_type)
    if is_abnormal is not None:
        if is_abnormal:
            query = query.filter(InspectionResult.status.in_(["abnormal", "warning"]))
        else:
            query = query.filter(InspectionResult.status == "normal")
    if status is not None:
        query = query.filter(InspectionResult.status == status)

    total = query.count()
    results = query.order_by(desc(InspectionResult.inspected_at)).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for r in results:
        item = {
            "id": r.id,
            "task_id": r.task_id,
            "account_id": r.account_id,
            "resource_type": r.resource_type,
            "resource_id": r.resource_id,
            "resource_name": r.resource_name,
            "region": r.region,
            "cpu_usage": r.cpu_usage,
            "memory_usage": r.memory_usage,
            "disk_usage": r.disk_usage,
            "disk_details": json.loads(r.disk_details) if r.disk_details else None,
            "slb_details": json.loads(r.slb_details) if r.slb_details else None,
            "expiration_details": json.loads(r.expiration_details) if r.expiration_details else None,
            "event_details": json.loads(r.event_details) if hasattr(r, 'event_details') and r.event_details else None,
            "status": r.status,
            "abnormal_metrics": json.loads(r.abnormal_metrics) if r.abnormal_metrics else None,
            "inspected_at": r.inspected_at,
        }
        items.append(item)

    pages = (total + page_size - 1) // page_size
    return success_response(data={"items": items, "total": total, "page": page, "page_size": page_size, "pages": pages})


@router.get("/results/export")
def export_results(task_id: Optional[int] = None, output_format: str = Query("excel", alias="format"), db: Session = Depends(get_db)):
    if not task_id:
        raise HTTPException(status_code=400, detail="请指定 task_id")
    if output_format != "excel":
        raise HTTPException(status_code=400, detail=f"不支持的导出格式: {output_format}")

    query = db.query(InspectionResult).filter(InspectionResult.task_id == task_id)
    total = query.count()
    if total > 10000:
        raise HTTPException(status_code=400, detail=f"导出数据量过大（{total} 条），请缩小范围")
    results = query.order_by(desc(InspectionResult.inspected_at)).all()

    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "巡检结果"
    ws.append(["资源类型", "资源ID", "资源名称", "地域", "CPU使用率", "内存使用率", "磁盘使用率", "是否异常", "异常指标", "巡检时间"])
    for r in results:
        try:
            am = json.loads(r.abnormal_metrics) if r.abnormal_metrics else []
        except (json.JSONDecodeError, TypeError):
            am = []
        ws.append([
            r.resource_type, r.resource_id, r.resource_name, r.region,
            f"{r.cpu_usage:.1f}%" if r.cpu_usage else "-",
            f"{r.memory_usage:.1f}%" if r.memory_usage else "-",
            f"{r.disk_usage:.1f}%" if r.disk_usage else "-",
            "是" if r.status in ["abnormal", "warning"] else "否",
            ", ".join(am) if am else "-",
            r.inspected_at.strftime("%Y-%m-%d %H:%M:%S") if r.inspected_at else "-"
        ])
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=inspection_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.xlsx"})
