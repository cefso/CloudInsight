from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Index
from sqlalchemy.sql import func
from database import Base


class InspectionResult(Base):
    __tablename__ = "inspection_results"
    __table_args__ = (
        Index("ix_result_task_id", "task_id"),
        Index("ix_result_status", "status"),
        Index("ix_result_account_id", "account_id"),
    )

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
    disk_details = Column(Text)  # JSON 格式存储多个磁盘信息
    slb_details = Column(Text)  # JSON: {listeners, backend_servers}
    expiration_details = Column(Text)  # JSON: {product_code, end_time, days_remaining}
    event_details = Column(Text)  # JSON: {event_id, name, product, level, status, content, time}
    status = Column(String(20), default="normal")  # normal / warning / abnormal
    abnormal_metrics = Column(Text)
    inspected_at = Column(DateTime, nullable=False)
