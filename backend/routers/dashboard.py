import json
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from database import get_db
from models import CloudAccount, InspectionTask, InspectionResult, CronConfig
from schemas.inspection import DashboardStats
from utils.response import success_response

router = APIRouter(prefix="/api/dashboard", tags=["仪表盘"])


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    account_count = db.query(CloudAccount).filter(CloudAccount.is_enabled.is_(True)).count()
    last_task = db.query(InspectionTask).filter(InspectionTask.status == "completed").order_by(desc(InspectionTask.completed_at)).first()

    total_resources, normal_count, warning_count, abnormal_count = 0, 0, 0, 0
    last_inspection_time = None
    if last_task:
        total_resources = last_task.total_resources
        normal_count = last_task.normal_count
        warning_count = last_task.warning_count
        abnormal_count = last_task.abnormal_count
        last_inspection_time = last_task.completed_at

    next_cron = db.query(CronConfig).filter(CronConfig.is_enabled.is_(True), CronConfig.next_run_at.isnot(None)).order_by(CronConfig.next_run_at).first()

    stats = DashboardStats(
        total_resources=total_resources,
        normal_count=normal_count,
        warning_count=warning_count,
        abnormal_count=abnormal_count,
        account_count=account_count,
        last_inspection_time=last_inspection_time,
        next_inspection_time=next_cron.next_run_at if next_cron else None
    )
    return success_response(data=stats.model_dump())


@router.get("/abnormal-resources")
def get_abnormal_resources(limit: int = Query(10, ge=1, le=100), account_id: Optional[int] = None, db: Session = Depends(get_db)):
    last_task = db.query(InspectionTask).filter(InspectionTask.status == "completed").order_by(desc(InspectionTask.completed_at)).first()
    if not last_task:
        return success_response(data=[])

    query = db.query(InspectionResult).filter(
        InspectionResult.task_id == last_task.id, InspectionResult.status.in_(["abnormal", "warning"])
    )
    if account_id is not None:
        query = query.filter(InspectionResult.account_id == account_id)
    results = query.limit(limit).all()

    items = []
    for r in results:
        items.append({
            "id": r.id, "resource_type": r.resource_type, "resource_id": r.resource_id,
            "resource_name": r.resource_name, "region": r.region, "account_id": r.account_id,
            "cpu_usage": r.cpu_usage, "memory_usage": r.memory_usage, "disk_usage": r.disk_usage,
            "abnormal_metrics": json.loads(r.abnormal_metrics) if r.abnormal_metrics else None,
        })
    return success_response(data=items)
