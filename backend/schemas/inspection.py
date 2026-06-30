from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class InspectionTaskResponse(BaseModel):
    id: int
    trigger_type: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    total_resources: int
    normal_count: int
    abnormal_count: int
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class InspectionResultResponse(BaseModel):
    id: int
    task_id: int
    account_id: int
    resource_type: str
    resource_id: str
    resource_name: Optional[str] = None
    region: str
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    disk_usage: Optional[float] = None
    is_abnormal: bool
    abnormal_metrics: Optional[list[str]] = None
    inspected_at: datetime

    class Config:
        from_attributes = True


class TriggerInspectionRequest(BaseModel):
    account_ids: Optional[list[int]] = None


class ThresholdUpdate(BaseModel):
    cpu_threshold: Optional[float] = Field(None, ge=0, le=100)
    memory_threshold: Optional[float] = Field(None, ge=0, le=100)
    disk_threshold: Optional[float] = Field(None, ge=0, le=100)


class CronConfigCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    cron_expression: str


class CronConfigUpdate(BaseModel):
    name: Optional[str] = None
    cron_expression: Optional[str] = None
    is_enabled: Optional[bool] = None


class DashboardStats(BaseModel):
    total_resources: int = 0
    normal_count: int = 0
    abnormal_count: int = 0
    account_count: int = 0
    last_inspection_time: Optional[datetime] = None
    next_inspection_time: Optional[datetime] = None
