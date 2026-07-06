from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TriggerInspectionRequest(BaseModel):
    account_ids: Optional[list[int]] = None


class ThresholdUpdate(BaseModel):
    resource_type: Optional[str] = Field(None, max_length=50)
    name: Optional[str] = Field(None, max_length=100)
    cpu_threshold: Optional[float] = Field(None, gt=0, le=100)
    memory_threshold: Optional[float] = Field(None, gt=0, le=100)
    disk_threshold: Optional[float] = Field(None, gt=0, le=100)


class CronConfigCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    cron_expression: str
    account_ids: Optional[list[int]] = None


class CronConfigUpdate(BaseModel):
    name: Optional[str] = None
    cron_expression: Optional[str] = None
    account_ids: Optional[list[int]] = None
    is_enabled: Optional[bool] = None


class DashboardStats(BaseModel):
    total_resources: int = 0
    normal_count: int = 0
    warning_count: int = 0
    abnormal_count: int = 0
    account_count: int = 0
    last_inspection_time: Optional[datetime] = None
    next_inspection_time: Optional[datetime] = None
