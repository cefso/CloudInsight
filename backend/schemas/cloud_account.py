from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CloudAccountCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    access_key_id: str = Field(..., min_length=1, max_length=50)
    access_key_secret: str = Field(..., min_length=1)
    regions: Optional[list[str]] = None
    resource_types: Optional[list[str]] = None


class CloudAccountUpdate(BaseModel):
    name: Optional[str] = None
    access_key_id: Optional[str] = None
    access_key_secret: Optional[str] = None
    regions: Optional[list[str]] = None
    resource_types: Optional[list[str]] = None
    is_enabled: Optional[bool] = None


class CloudAccountResponse(BaseModel):
    id: int
    name: str
    access_key_id: str
    regions: Optional[list[str]] = None
    resource_types: Optional[list[str]] = None
    is_enabled: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TestConnectionRequest(BaseModel):
    access_key_id: str
    access_key_secret: str
    region: str = "cn-hangzhou"
