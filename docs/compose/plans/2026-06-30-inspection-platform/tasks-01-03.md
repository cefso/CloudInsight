# 后端基础任务 (Task 1-3)

---

## Task 1: 后端项目初始化

**Covers:** S2

**Files:**
- Create: `backend/main.py`
- Create: `backend/config.py`
- Create: `backend/database.py`
- Create: `backend/requirements.txt`

### Steps

- [ ] **Step 1: 创建项目目录和 requirements.txt**

```bash
mkdir -p backend/models backend/schemas backend/routers backend/services backend/utils
```

```txt
# backend/requirements.txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
pydantic==2.5.2
pydantic-settings==2.1.0
python-multipart==0.0.6
cryptography==41.0.7
alibabacloud-cms20190101==4.0.10
alibabacloud-tea-openapi==1.0.2
apscheduler==3.10.4
openpyxl==3.1.2
```

- [ ] **Step 2: 创建 config.py**

```python
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "阿里云巡检平台"
    app_version: str = "1.0.0"
    debug: bool = False
    database_url: str = "sqlite:///./inspection.db"
    encryption_key: str = ""
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 3: 创建 database.py**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
```

- [ ] **Step 4: 创建 main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from config import get_settings
from database import init_db

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "code": 200,
        "message": "success",
        "data": {"name": settings.app_name, "version": settings.app_version}
    }


@app.get("/api/health")
async def health_check():
    return {"code": 200, "message": "ok", "data": {"status": "healthy"}}
```

- [ ] **Step 5: 验证**

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Expected: 服务启动成功，访问 http://localhost:8000 返回应用信息

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: 初始化后端项目结构"
```

---

## Task 2: 数据库模型实现

**Covers:** S3

**Files:**
- Create: `backend/models/__init__.py`
- Create: `backend/models/cloud_account.py`
- Create: `backend/models/alert_threshold.py`
- Create: `backend/models/inspection_task.py`
- Create: `backend/models/inspection_result.py`
- Create: `backend/models/cron_config.py`

### Steps

- [ ] **Step 1: 创建 cloud_account.py**

```python
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
```

- [ ] **Step 2: 创建 alert_threshold.py**

```python
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime
from sqlalchemy.sql import func
from database import Base


class AlertThreshold(Base):
    __tablename__ = "alert_thresholds"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, comment="阈值名称")
    cpu_threshold = Column(Float, default=90.0, comment="CPU 阈值 (%)")
    memory_threshold = Column(Float, default=90.0, comment="内存阈值 (%)")
    disk_threshold = Column(Float, default=90.0, comment="磁盘阈值 (%)")
    is_default = Column(Boolean, default=False, comment="是否默认阈值")
    created_at = Column(DateTime, server_default=func.now())
```

- [ ] **Step 3: 创建 inspection_task.py**

```python
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from database import Base


class InspectionTask(Base):
    __tablename__ = "inspection_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trigger_type = Column(String(20), nullable=False, comment="触发类型: manual/cron")
    status = Column(String(20), default="running", comment="状态: running/completed/failed")
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime)
    total_resources = Column(Integer, default=0)
    normal_count = Column(Integer, default=0)
    abnormal_count = Column(Integer, default=0)
    error_message = Column(Text)
```

- [ ] **Step 4: 创建 inspection_result.py**

```python
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
```

- [ ] **Step 5: 创建 cron_config.py**

```python
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
```

- [ ] **Step 6: 创建 models/__init__.py**

```python
from models.cloud_account import CloudAccount
from models.alert_threshold import AlertThreshold
from models.inspection_task import InspectionTask
from models.inspection_result import InspectionResult
from models.cron_config import CronConfig

__all__ = [
    "CloudAccount",
    "AlertThreshold",
    "InspectionTask",
    "InspectionResult",
    "CronConfig",
]
```

- [ ] **Step 7: 更新 main.py 导入模型**

在 main.py 顶部添加:
```python
from models import CloudAccount, AlertThreshold, InspectionTask, InspectionResult, CronConfig
```

- [ ] **Step 8: 验证**

```bash
cd backend
python -c "from database import init_db; init_db()"
ls -la *.db
```

- [ ] **Step 9: Commit**

```bash
git add backend/models/
git commit -m "feat: 实现数据库模型定义"
```

---

## Task 3: 通用工具和 Pydantic 模型

**Covers:** S4

**Files:**
- Create: `backend/utils/response.py`
- Create: `backend/schemas/common.py`
- Create: `backend/schemas/cloud_account.py`
- Create: `backend/schemas/inspection.py`

### Steps

- [ ] **Step 1: 创建 utils/response.py**

```python
from typing import Any, Optional


def success_response(data: Any = None, message: str = "success") -> dict:
    return {"code": 200, "message": message, "data": data}


def error_response(code: int = 400, message: str = "error") -> dict:
    return {"code": code, "message": message, "data": None}
```

- [ ] **Step 2: 创建 schemas/cloud_account.py**

```python
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


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
```

- [ ] **Step 3: 创建 schemas/inspection.py**

```python
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


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
```

- [ ] **Step 4: Commit**

```bash
git add backend/utils/ backend/schemas/
git commit -m "feat: 实现通用工具和 Pydantic 模型"
```
