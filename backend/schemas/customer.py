from typing import Optional

from pydantic import BaseModel, Field


class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    contact: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    remark: Optional[str] = None
    account_ids: Optional[list[int]] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    contact: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    remark: Optional[str] = None
    account_ids: Optional[list[int]] = None
