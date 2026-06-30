from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from database import Base


class InspectionTask(Base):
    __tablename__ = "inspection_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trigger_type = Column(String(20), nullable=False, comment="触发类型: manual/cron")
    status = Column(String(20), default="running", comment="状态: running/completed/failed")
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime)
    total_resources = Column(Integer, default=0)
    normal_count = Column(Integer, default=0)
    abnormal_count = Column(Integer, default=0)
    error_message = Column(Text)
