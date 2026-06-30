from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime
from sqlalchemy.sql import func
from database import Base


class AlertThreshold(Base):
    __tablename__ = "alert_thresholds"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, comment="阈值名称")
    cpu_threshold = Column(Float, default=90.0, comment="CPU 阈值 (%)")
    memory_threshold = Column(Float, default=90.0, comment="内存阈值 (%)")
    disk_threshold = Column(Float, default=90.0, comment="磁盘阈值 (%)")
    is_default = Column(Boolean, default=False, comment="是否默认阈值")
    created_at = Column(DateTime, server_default=func.now())
