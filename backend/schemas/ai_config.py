from pydantic import BaseModel, Field
from typing import Optional


class AiConfigUpdate(BaseModel):
    base_url: Optional[str] = Field(None, max_length=500)
    model: Optional[str] = Field(None, max_length=100)
    max_tokens: Optional[int] = Field(None, ge=1, le=128000)
    api_key: Optional[str] = Field(None, max_length=500)
    enabled: Optional[bool] = None
