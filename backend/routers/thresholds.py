from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import AlertThreshold
from schemas.inspection import ThresholdUpdate
from utils.response import success_response

router = APIRouter(prefix="/api/thresholds", tags=["阈值配置"])

# 资源类型配置
RESOURCE_TYPES = [
    {"key": "ECS", "name": "ECS 云服务器", "has_cpu": True, "has_memory": True, "has_disk": True},
    {"key": "RDS", "name": "RDS 数据库", "has_cpu": True, "has_memory": True, "has_disk": True},
    {"key": "Redis", "name": "Redis 缓存", "has_cpu": False, "has_memory": True, "has_disk": False},
]


def _serialize_threshold(t: AlertThreshold) -> dict:
    """序列化阈值配置"""
    return {
        "id": t.id,
        "resource_type": t.resource_type or "global",
        "name": t.name,
        "cpu_threshold": t.cpu_threshold,
        "memory_threshold": t.memory_threshold,
        "disk_threshold": t.disk_threshold,
        "is_default": t.is_default,
        "created_at": t.created_at,
    }


def _init_default_thresholds(db: Session):
    """初始化默认阈值配置"""
    existing = db.query(AlertThreshold).count()
    if existing == 0:
        for rt in RESOURCE_TYPES:
            threshold = AlertThreshold(
                resource_type=rt["key"],
                name=rt["name"],
                cpu_threshold=90.0 if rt["has_cpu"] else None,
                memory_threshold=90.0 if rt["has_memory"] else None,
                disk_threshold=90.0 if rt["has_disk"] else None,
                is_default=True,
            )
            db.add(threshold)
        db.commit()
    elif db.query(AlertThreshold).filter(AlertThreshold.resource_type == "global").first():
        db.query(AlertThreshold).filter(AlertThreshold.resource_type == "global").delete()
        db.commit()


@router.get("")
def list_thresholds(db: Session = Depends(get_db)):
    _init_default_thresholds(db)
    thresholds = db.query(AlertThreshold).order_by(AlertThreshold.resource_type).all()
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
