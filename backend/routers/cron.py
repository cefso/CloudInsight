from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import CronConfig
from schemas.inspection import CronConfigCreate, CronConfigUpdate
from utils.response import success_response
from services.scheduler import task_scheduler

router = APIRouter(prefix="/api/cron", tags=["定时任务"])


@router.get("")
def list_cron_configs(db: Session = Depends(get_db)):
    configs = db.query(CronConfig).order_by(CronConfig.created_at.desc()).all()
    result = []
    for c in configs:
        result.append({
            "id": c.id,
            "name": c.name,
            "cron_expression": c.cron_expression,
            "is_enabled": c.is_enabled,
            "last_run_at": c.last_run_at,
            "next_run_at": c.next_run_at,
            "created_at": c.created_at,
        })
    return success_response(data=result)


@router.post("")
def create_cron_config(request: CronConfigCreate, db: Session = Depends(get_db)):
    parts = request.cron_expression.split()
    if len(parts) != 5:
        raise HTTPException(status_code=400, detail="Cron 格式: 分 时 日 月 周")
    config = CronConfig(
        name=request.name,
        cron_expression=request.cron_expression,
        is_enabled=True
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    task_scheduler.add_job(config)
    return success_response(data={"id": config.id}, message="定时任务创建成功")


@router.put("/{config_id}")
def update_cron_config(config_id: int, request: CronConfigUpdate, db: Session = Depends(get_db)):
    config = db.query(CronConfig).filter(CronConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="定时任务不存在")
    if request.name is not None:
        config.name = request.name
    if request.cron_expression is not None:
        config.cron_expression = request.cron_expression
    if request.is_enabled is not None:
        config.is_enabled = request.is_enabled
    db.commit()
    task_scheduler.update_job(config)
    return success_response(message="定时任务更新成功")


@router.delete("/{config_id}")
def delete_cron_config(config_id: int, db: Session = Depends(get_db)):
    config = db.query(CronConfig).filter(CronConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="定时任务不存在")
    task_scheduler.remove_job(config_id)
    db.delete(config)
    db.commit()
    return success_response(message="定时任务删除成功")
