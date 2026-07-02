from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class AiReport(Base):
    __tablename__ = "ai_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("inspection_tasks.id"), nullable=False)
    content = Column(Text, nullable=False)
    model = Column(String(100))
    tokens_used = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())
