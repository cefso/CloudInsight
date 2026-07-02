import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)
from database import get_db
from models import CronConfig, CloudAccount
from schemas.inspection import CronConfigCreate, CronConfigUpdate
from utils.response import success_response
from services.scheduler import task_scheduler

router = APIRouter(prefix="/api/cron", tags=["定时任务"])


def _serialize_cron(c: CronConfig, db: Session = None) -> dict:
    account_names = []
    if c.account_ids and db:
        try:
            ids = json.loads(c.account_ids)
            accounts = db.query(CloudAccount.name).filter(CloudAccount.id.in_(ids)).all()
            account_names = [a[0] for a in accounts]
        except Exception as e:
            logger.warning(f"获取账号名称失败: {e}")
    return {
        "id": c.id,
        "name": c.name,
        "cron_expression": c.cron_expression,
        "account_ids": json.loads(c.account_ids) if c.account_ids else [],
        "account_names": account_names,
        "is_enabled": c.is_enabled,
        "last_run_at": c.last_run_at,
        "next_run_at": c.next_run_at,
        "created_at": c.created_at,
    }


@router.get("")
def list_cron_configs(db: Session = Depends(get_db)):
    configs = db.query(CronConfig).order_by(CronConfig.created_at.desc()).all()
    return success_response(data=[_serialize_cron(c, db) for c in configs])


@router.post("")
def create_cron_config(request: CronConfigCreate, db: Session = Depends(get_db)):
    parts = request.cron_expression.split()
    if len(parts) != 5:
        raise HTTPException(status_code=400, detail="Cron 格式: 分 时 日 月 周")
    try:
        CronTrigger(minute=parts[0], hour=parts[1], day=parts[2], month=parts[3], day_of_week=parts[4])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Cron 表达式无效: {e}")
    config = CronConfig(
        name=request.name,
        cron_expression=request.cron_expression,
        account_ids=json.dumps(request.account_ids) if request.account_ids else None,
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
        parts = request.cron_expression.split()
        if len(parts) != 5:
            raise HTTPException(status_code=400, detail="Cron 格式: 分 时 日 月 周")
        try:
            CronTrigger(minute=parts[0], hour=parts[1], day=parts[2], month=parts[3], day_of_week=parts[4])
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Cron 表达式无效: {e}")
        config.cron_expression = request.cron_expression
    if request.account_ids is not None:
        config.account_ids = json.dumps(request.account_ids) if request.account_ids else None
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
