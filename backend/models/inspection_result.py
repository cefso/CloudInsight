from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from database import Base


class InspectionResult(Base):
    __tablename__ = "inspection_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("inspection_tasks.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("cloud_accounts.id"), nullable=False)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String(100), nullable=False)
    resource_name = Column(String(200))
    region = Column(String(50), nullable=False)
    cpu_usage = Column(Float)
    memory_usage = Column(Float)
    disk_usage = Column(Float)
    is_abnormal = Column(Boolean, default=False)
    abnormal_metrics = Column(Text)
    inspected_at = Column(DateTime, nullable=False)
