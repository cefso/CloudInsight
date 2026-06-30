from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import AlertThreshold
from schemas.inspection import ThresholdUpdate
from utils.response import success_response

router = APIRouter(prefix="/api/thresholds", tags=["阈值配置"])


def _serialize_threshold(t: AlertThreshold) -> dict:
    """序列化阈值配置"""
    return {
        "id": t.id,
        "name": t.name,
        "cpu_threshold": t.cpu_threshold,
        "memory_threshold": t.memory_threshold,
        "disk_threshold": t.disk_threshold,
        "is_default": t.is_default,
        "created_at": t.created_at,
    }


@router.get("")
def list_thresholds(db: Session = Depends(get_db)):
    thresholds = db.query(AlertThreshold).order_by(AlertThreshold.created_at.desc()).all()
    if not thresholds:
        default = AlertThreshold(name="默认阈值", cpu_threshold=90.0, memory_threshold=90.0, disk_threshold=90.0, is_default=True)
        db.add(default)
        db.commit()
        db.refresh(default)
        thresholds = [default]
    return success_response(data=[_serialize_threshold(t) for t in thresholds])


@router.put("/{threshold_id}")
def update_threshold(threshold_id: int, request: ThresholdUpdate, db: Session = Depends(get_db)):
    threshold = db.query(AlertThreshold).filter(AlertThreshold.id == threshold_id).first()
    if not threshold:
        raise HTTPException(status_code=404, detail="阈值配置不存在")
    if request.cpu_threshold is not None:
        threshold.cpu_threshold = request.cpu_threshold
    if request.memory_threshold is not None:
        threshold.memory_threshold = request.memory_threshold
    if request.disk_threshold is not None:
        threshold.disk_threshold = request.disk_threshold
    db.commit()
    return success_response(message="阈值配置更新成功")
