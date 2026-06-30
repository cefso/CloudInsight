import json
import io
import threading
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from database import get_db, SessionLocal
from models import InspectionTask, InspectionResult
from schemas.inspection import TriggerInspectionRequest
from utils.response import success_response
from services.inspection_engine import InspectionEngine

router = APIRouter(prefix="/api/inspections", tags=["巡检任务"])


def _run_inspection_background(account_ids, trigger_type, task_id):
    """后台执行巡检任务"""
    db = SessionLocal()
    try:
        engine = InspectionEngine(db)
        engine.run_inspection(account_ids=account_ids, trigger_type=trigger_type, task_id=task_id)
    except Exception as e:
        print(f"巡检任务执行失败: {e}")
    finally:
        db.close()


@router.post("/trigger")
def trigger_inspection(request: TriggerInspectionRequest, db: Session = Depends(get_db)):
    # 先创建任务记录
    task = InspectionTask(
        trigger_type="manual",
        status="running",
        started_at=datetime.now()
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    
    # 在后台线程中执行巡检
    thread = threading.Thread(
        target=_run_inspection_background,
        args=(request.account_ids, "manual", task.id),
        daemon=True
    )
    thread.start()
    
    return success_response(data={"task_id": task.id}, message="巡检任务已启动")

@router.get("/tasks")
def list_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    total = db.query(InspectionTask).count()
    tasks = db.query(InspectionTask).order_by(desc(InspectionTask.started_at)).offset((page - 1) * page_size).limit(page_size).all()
    pages = (total + page_size - 1) // page_size
    return success_response(data={
        "items": [t.__dict__ for t in tasks],
        "total": total, "page": page, "page_size": page_size, "pages": pages
    })

@router.get("/results")
def list_results(
    task_id: Optional[int] = None,
    account_id: Optional[int] = None,
    resource_type: Optional[str] = None,
    is_abnormal: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(InspectionResult)
    if task_id is not None:
        query = query.filter(InspectionResult.task_id == task_id)
    if account_id is not None:
        query = query.filter(InspectionResult.account_id == account_id)
    if resource_type is not None:
        query = query.filter(InspectionResult.resource_type == resource_type)
    if is_abnormal is not None:
        query = query.filter(InspectionResult.is_abnormal == is_abnormal)

    total = query.count()
    results = query.order_by(desc(InspectionResult.inspected_at)).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for r in results:
        item = r.__dict__.copy()
        if item.get("abnormal_metrics"):
            item["abnormal_metrics"] = json.loads(item["abnormal_metrics"])
        items.append(item)

    pages = (total + page_size - 1) // page_size
    return success_response(data={"items": items, "total": total, "page": page, "page_size": page_size, "pages": pages})

@router.get("/results/export")
def export_results(task_id: Optional[int] = None, format: str = Query("excel"), db: Session = Depends(get_db)):
    query = db.query(InspectionResult)
    if task_id is not None:
        query = query.filter(InspectionResult.task_id == task_id)
    results = query.order_by(desc(InspectionResult.inspected_at)).all()

    if format == "excel":
        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "巡检结果"
        ws.append(["资源类型", "资源ID", "资源名称", "地域", "CPU使用率", "内存使用率", "磁盘使用率", "是否异常", "异常指标", "巡检时间"])
        for r in results:
            am = json.loads(r.abnormal_metrics) if r.abnormal_metrics else []
            ws.append([
                r.resource_type, r.resource_id, r.resource_name, r.region,
                f"{r.cpu_usage:.1f}%" if r.cpu_usage else "-",
                f"{r.memory_usage:.1f}%" if r.memory_usage else "-",
                f"{r.disk_usage:.1f}%" if r.disk_usage else "-",
                "是" if r.is_abnormal else "否",
                ", ".join(am) if am else "-",
                r.inspected_at.strftime("%Y-%m-%d %H:%M:%S")
            ])
        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return StreamingResponse(buffer, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=inspection_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"})
