from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from database import Base


class CloudAccount(Base):
    __tablename__ = "cloud_accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, comment="账号名称")
    access_key_id = Column(String(50), nullable=False, comment="Access Key ID")
    access_key_secret = Column(Text, nullable=False, comment="Access Key Secret (加密)")
    regions = Column(Text, comment="监控地域 JSON 数组")
    resource_types = Column(Text, comment="监控资源类型 JSON 数组")
    is_enabled = Column(Boolean, default=True, comment="是否启用")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
