from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from database import Base


class CronConfig(Base):
    __tablename__ = "cron_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    cron_expression = Column(String(50), nullable=False)
    is_enabled = Column(Boolean, default=True)
    last_run_at = Column(DateTime)
    next_run_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
