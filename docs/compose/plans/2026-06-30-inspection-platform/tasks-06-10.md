# 后端 API 任务 (Task 6-10)

---

## Task 6: 账号管理 API

**Covers:** S4, S8

**Files:**
- Create: `backend/routers/__init__.py`
- Create: `backend/routers/accounts.py`
- Modify: `backend/main.py`

### Steps

- [ ] **Step 1: 创建 accounts.py 路由**

```python
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import CloudAccount
from schemas.cloud_account import (
    CloudAccountCreate, CloudAccountUpdate, TestConnectionRequest
)
from utils.response import success_response
from services.crypto import crypto_service
from services.aliyun_client import AliyunClient

router = APIRouter(prefix="/api/accounts", tags=["账号管理"])


@router.get("")
def list_accounts(db: Session = Depends(get_db)):
    accounts = db.query(CloudAccount).order_by(CloudAccount.created_at.desc()).all()
    result = []
    for account in accounts:
        result.append({
            "id": account.id,
            "name": account.name,
            "access_key_id": crypto_service.mask_ak(account.access_key_id),
            "regions": json.loads(account.regions) if account.regions else None,
            "resource_types": json.loads(account.resource_types) if account.resource_types else None,
            "is_enabled": account.is_enabled,
            "created_at": account.created_at,
            "updated_at": account.updated_at,
        })
    return success_response(data=result)


@router.post("")
def create_account(request: CloudAccountCreate, db: Session = Depends(get_db)):
    encrypted_secret = crypto_service.encrypt(request.access_key_secret)
    account = CloudAccount(
        name=request.name,
        access_key_id=request.access_key_id,
        access_key_secret=encrypted_secret,
        regions=json.dumps(request.regions) if request.regions else None,
        resource_types=json.dumps(request.resource_types) if request.resource_types else None,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return success_response(data={"id": account.id}, message="账号创建成功")


@router.get("/{account_id}")
def get_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(CloudAccount).filter(CloudAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="账号不存在")
    return success_response(data={
        "id": account.id,
        "name": account.name,
        "access_key_id": crypto_service.mask_ak(account.access_key_id),
        "regions": json.loads(account.regions) if account.regions else None,
        "resource_types": json.loads(account.resource_types) if account.resource_types else None,
        "is_enabled": account.is_enabled,
        "created_at": account.created_at,
        "updated_at": account.updated_at,
    })


@router.put("/{account_id}")
def update_account(account_id: int, request: CloudAccountUpdate, db: Session = Depends(get_db)):
    account = db.query(CloudAccount).filter(CloudAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="账号不存在")
    if request.name is not None:
        account.name = request.name
    if request.access_key_id is not None:
        account.access_key_id = request.access_key_id
    if request.access_key_secret is not None:
        account.access_key_secret = crypto_service.encrypt(request.access_key_secret)
    if request.regions is not None:
        account.regions = json.dumps(request.regions)
    if request.resource_types is not None:
        account.resource_types = json.dumps(request.resource_types)
    if request.is_enabled is not None:
        account.is_enabled = request.is_enabled
    db.commit()
    return success_response(message="账号更新成功")


@router.delete("/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(CloudAccount).filter(CloudAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="账号不存在")
    db.delete(account)
    db.commit()
    return success_response(message="账号删除成功")


@router.post("/{account_id}/test")
def test_connection(account_id: int, db: Session = Depends(get_db)):
    account = db.query(CloudAccount).filter(CloudAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="账号不存在")
    ak = account.access_key_id
    sk = crypto_service.decrypt(account.access_key_secret)
    regions = json.loads(account.regions) if account.regions else ["cn-hangzhou"]
    client = AliyunClient(ak, sk, regions[0])
    result = client.test_connection()
    return success_response(data=result)


@router.post("/test")
def test_connection_direct(request: TestConnectionRequest):
    client = AliyunClient(request.access_key_id, request.access_key_secret, request.region)
    result = client.test_connection()
    return success_response(data=result)
```

- [ ] **Step 2: 创建 routers/__init__.py**

```python
from routers import accounts
__all__ = ["accounts"]
```

- [ ] **Step 3: 更新 main.py 注册路由**

```python
from routers import accounts
app.include_router(accounts.router)
```

- [ ] **Step 4: 验证**

```bash
curl -X POST http://localhost:8000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{"name": "测试", "access_key_id": "test-ak", "access_key_secret": "test-sk"}'
```

- [ ] **Step 5: Commit**

```bash
git add backend/routers/
git commit -m "feat: 实现账号管理 API"
```

---

## Task 7: 巡检引擎实现

**Covers:** S5, S6

**Files:**
- Create: `backend/services/inspection_engine.py`

### Steps

- [ ] **Step 1: 创建 inspection_engine.py**

```python
import json
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from models import CloudAccount, InspectionTask, InspectionResult, AlertThreshold
from services.crypto import crypto_service
from services.aliyun_client import AliyunClient, RESOURCE_TYPE_NAMES


class InspectionEngine:
    def __init__(self, db: Session):
        self.db = db

    def run_inspection(self, account_ids: Optional[list[int]] = None, trigger_type: str = "manual") -> InspectionTask:
        task = InspectionTask(
            trigger_type=trigger_type,
            status="running",
            started_at=datetime.now()
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        try:
            if account_ids:
                accounts = self.db.query(CloudAccount).filter(
                    CloudAccount.id.in_(account_ids), CloudAccount.is_enabled == True
                ).all()
            else:
                accounts = self.db.query(CloudAccount).filter(CloudAccount.is_enabled == True).all()

            if not accounts:
                task.status = "completed"
                task.completed_at = datetime.now()
                task.error_message = "没有启用的账号"
                self.db.commit()
                return task

            threshold = self.db.query(AlertThreshold).filter(AlertThreshold.is_default == True).first()
            cpu_threshold = threshold.cpu_threshold if threshold else 90.0
            memory_threshold = threshold.memory_threshold if threshold else 90.0
            disk_threshold = threshold.disk_threshold if threshold else 90.0

            total, normal, abnormal = 0, 0, 0
            for account in accounts:
                result = self._inspect_account(task.id, account, cpu_threshold, memory_threshold, disk_threshold)
                total += result["total"]
                normal += result["normal"]
                abnormal += result["abnormal"]

            task.status = "completed"
            task.completed_at = datetime.now()
            task.total_resources = total
            task.normal_count = normal
            task.abnormal_count = abnormal
            self.db.commit()

        except Exception as e:
            task.status = "failed"
            task.completed_at = datetime.now()
            task.error_message = str(e)
            self.db.commit()
            raise

        return task

    def _inspect_account(self, task_id: int, account: CloudAccount, cpu_threshold: float, memory_threshold: float, disk_threshold: float) -> dict:
        ak = account.access_key_id
        sk = crypto_service.decrypt(account.access_key_secret)
        regions = json.loads(account.regions) if account.regions else ["cn-hangzhou"]
        resource_types = json.loads(account.resource_types) if account.resource_types else list(RESOURCE_TYPE_NAMES.keys())

        total, normal, abnormal = 0, 0, 0

        for region in regions:
            client = AliyunClient(ak, sk, region)
            for namespace in resource_types:
                resources = client.list_resources(namespace)
                for resource in resources:
                    total += 1
                    cpu_usage, memory_usage, disk_usage = None, None, None
                    abnormal_metrics = []

                    metrics = AliyunClient.RESOURCE_METRICS.get(namespace, {})
                    for metric_name in metrics.get("metrics", []):
                        value = client.get_metric_data(
                            namespace=namespace,
                            metric_name=metric_name,
                            dimensions=[{"instanceId": resource.get("instanceId", "")}]
                        )
                        if value is not None:
                            if "cpu" in metric_name.lower():
                                cpu_usage = value
                                if value > cpu_threshold:
                                    abnormal_metrics.append("CPU 使用率")
                            elif "memory" in metric_name.lower():
                                memory_usage = value
                                if value > memory_threshold:
                                    abnormal_metrics.append("内存使用率")
                            elif "disk" in metric_name.lower():
                                disk_usage = value
                                if value > disk_threshold:
                                    abnormal_metrics.append("磁盘使用率")

                    is_abnormal = len(abnormal_metrics) > 0
                    if is_abnormal:
                        abnormal += 1
                    else:
                        normal += 1

                    result = InspectionResult(
                        task_id=task_id,
                        account_id=account.id,
                        resource_type=RESOURCE_TYPE_NAMES.get(namespace, namespace),
                        resource_id=resource.get("instanceId", ""),
                        resource_name=resource.get("instanceName", ""),
                        region=region,
                        cpu_usage=cpu_usage,
                        memory_usage=memory_usage,
                        disk_usage=disk_usage,
                        is_abnormal=is_abnormal,
                        abnormal_metrics=json.dumps(abnormal_metrics) if abnormal_metrics else None,
                        inspected_at=datetime.now()
                    )
                    self.db.add(result)

        self.db.commit()
        return {"total": total, "normal": normal, "abnormal": abnormal}
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/inspection_engine.py
git commit -m "feat: 实现巡检引擎"
```

---

## Task 8: 巡检和阈值 API

**Covers:** S4, S5

**Files:**
- Create: `backend/routers/inspections.py`
- Create: `backend/routers/thresholds.py`

### Steps

- [ ] **Step 1: 创建 inspections.py 路由**

```python
import json
import io
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from database import get_db
from models import InspectionTask, InspectionResult
from schemas.inspection import TriggerInspectionRequest
from utils.response import success_response
from services.inspection_engine import InspectionEngine

router = APIRouter(prefix="/api/inspections", tags=["巡检任务"])


@router.post("/trigger")
def trigger_inspection(request: TriggerInspectionRequest, db: Session = Depends(get_db)):
    engine = InspectionEngine(db)
    task = engine.run_inspection(account_ids=request.account_ids, trigger_type="manual")
    return success_response(data={"task_id": task.id}, message="巡检任务已启动")


@router.get("/tasks")
def list_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    total = db.query(InspectionTask).count()
    tasks = db.query(InspectionTask).order_by(desc(InspectionTask.started_at)).offset((page - 1) * page_size).limit(page_size).all()
    pages = (total + page_size - 1) // page_size
    return success_response(data={
        "items": [t.__dict__ for t in tasks],
        "total": total, "page": page, "page_size": page_size, "pages": pages
    })


@router.get("/results")
def list_results(
    task_id: Optional[int] = None,
    resource_type: Optional[str] = None,
    is_abnormal: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(InspectionResult)
    if task_id is not None:
        query = query.filter(InspectionResult.task_id == task_id)
    if resource_type is not None:
        query = query.filter(InspectionResult.resource_type == resource_type)
    if is_abnormal is not None:
        query = query.filter(InspectionResult.is_abnormal == is_abnormal)

    total = query.count()
    results = query.order_by(desc(InspectionResult.inspected_at)).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for r in results:
        item = r.__dict__.copy()
        if item.get("abnormal_metrics"):
            item["abnormal_metrics"] = json.loads(item["abnormal_metrics"])
        items.append(item)

    pages = (total + page_size - 1) // page_size
    return success_response(data={"items": items, "total": total, "page": page, "page_size": page_size, "pages": pages})


@router.get("/results/export")
def export_results(task_id: Optional[int] = None, format: str = Query("excel"), db: Session = Depends(get_db)):
    query = db.query(InspectionResult)
    if task_id is not None:
        query = query.filter(InspectionResult.task_id == task_id)
    results = query.order_by(desc(InspectionResult.inspected_at)).all()

    if format == "excel":
        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "巡检结果"
        ws.append(["资源类型", "资源ID", "资源名称", "地域", "CPU使用率", "内存使用率", "磁盘使用率", "是否异常", "异常指标", "巡检时间"])
        for r in results:
            am = json.loads(r.abnormal_metrics) if r.abnormal_metrics else []
            ws.append([
                r.resource_type, r.resource_id, r.resource_name, r.region,
                f"{r.cpu_usage:.1f}%" if r.cpu_usage else "-",
                f"{r.memory_usage:.1f}%" if r.memory_usage else "-",
                f"{r.disk_usage:.1f}%" if r.disk_usage else "-",
                "是" if r.is_abnormal else "否",
                ", ".join(am) if am else "-",
                r.inspected_at.strftime("%Y-%m-%d %H:%M:%S")
            ])
        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return StreamingResponse(buffer, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=inspection_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"})
```

- [ ] **Step 2: 创建 thresholds.py 路由**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import AlertThreshold
from schemas.inspection import ThresholdUpdate
from utils.response import success_response

router = APIRouter(prefix="/api/thresholds", tags=["阈值配置"])


@router.get("")
def list_thresholds(db: Session = Depends(get_db)):
    thresholds = db.query(AlertThreshold).order_by(AlertThreshold.created_at.desc()).all()
    if not thresholds:
        default = AlertThreshold(name="默认阈值", cpu_threshold=90.0, memory_threshold=90.0, disk_threshold=90.0, is_default=True)
        db.add(default)
        db.commit()
        db.refresh(default)
        thresholds = [default]
    return success_response(data=[t.__dict__ for t in thresholds])


@router.put("/{threshold_id}")
def update_threshold(threshold_id: int, request: ThresholdUpdate, db: Session = Depends(get_db)):
    threshold = db.query(AlertThreshold).filter(AlertThreshold.id == threshold_id).first()
    if not threshold:
        raise HTTPException(status_code=404, detail="阈值配置不存在")
    if request.cpu_threshold is not None:
        threshold.cpu_threshold = request.cpu_threshold
    if request.memory_threshold is not None:
        threshold.memory_threshold = request.memory_threshold
    if request.disk_threshold is not None:
        threshold.disk_threshold = request.disk_threshold
    db.commit()
    return success_response(message="阈值配置更新成功")
```

- [ ] **Step 3: 更新 main.py**

```python
from routers import accounts, inspections, thresholds
app.include_router(inspections.router)
app.include_router(thresholds.router)
```

- [ ] **Step 4: Commit**

```bash
git add backend/routers/
git commit -m "feat: 实现巡检和阈值 API"
```

---

## Task 9: 定时任务实现

**Covers:** S4, S5

**Files:**
- Create: `backend/services/scheduler.py`
- Create: `backend/routers/cron.py`

### Steps

- [ ] **Step 1: 创建 scheduler.py**

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime
from database import SessionLocal
from models import CronConfig
from services.inspection_engine import InspectionEngine


class TaskScheduler:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self._job_ids = {}

    def start(self):
        self.scheduler.start()
        self._load_jobs()

    def stop(self):
        self.scheduler.shutdown()

    def _load_jobs(self):
        db = SessionLocal()
        try:
            configs = db.query(CronConfig).filter(CronConfig.is_enabled == True).all()
            for config in configs:
                self.add_job(config)
        finally:
            db.close()

    def add_job(self, config: CronConfig):
        job_id = f"inspection_{config.id}"
        parts = config.cron_expression.split()
        if len(parts) == 5:
            trigger = CronTrigger(minute=parts[0], hour=parts[1], day=parts[2], month=parts[3], day_of_week=parts[4])
        else:
            trigger = CronTrigger(minute=0)
        self.scheduler.add_job(self._run_inspection, trigger=trigger, id=job_id, args=[config.id], replace_existing=True)
        self._job_ids[config.id] = job_id

    def remove_job(self, config_id: int):
        job_id = self._job_ids.get(config_id)
        if job_id:
            self.scheduler.remove_job(job_id)
            del self._job_ids[config_id]

    def update_job(self, config: CronConfig):
        self.remove_job(config.id)
        if config.is_enabled:
            self.add_job(config)

    def _run_inspection(self, config_id: int):
        db = SessionLocal()
        try:
            config = db.query(CronConfig).filter(CronConfig.id == config_id).first()
            if config:
                config.last_run_at = datetime.now()
                db.commit()
            engine = InspectionEngine(db)
            engine.run_inspection(trigger_type="cron")
        except Exception as e:
            print(f"定时巡检失败: {e}")
        finally:
            db.close()


task_scheduler = TaskScheduler()
```

- [ ] **Step 2: 创建 cron.py 路由**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import CronConfig
from schemas.inspection import CronConfigCreate, CronConfigUpdate
from utils.response import success_response
from services.scheduler import task_scheduler

router = APIRouter(prefix="/api/cron", tags=["定时任务"])


@router.get("")
def list_cron_configs(db: Session = Depends(get_db)):
    configs = db.query(CronConfig).order_by(CronConfig.created_at.desc()).all()
    return success_response(data=[c.__dict__ for c in configs])


@router.post("")
def create_cron_config(request: CronConfigCreate, db: Session = Depends(get_db)):
    parts = request.cron_expression.split()
    if len(parts) != 5:
        raise HTTPException(status_code=400, detail="Cron 格式: 分 时 日 月 周")
    config = CronConfig(name=request.name, cron_expression=request.cron_expression, is_enabled=True)
    db.add(config)
    db.commit()
    db.refresh(config)
    task_scheduler.add_job(config)
    return success_response(data={"id": config.id}, message="定时任务创建成功")


@router.put("/{config_id}")
def update_cron_config(config_id: int, request: CronConfigUpdate, db: Session = Depends(get_db)):
    config = db.query(CronConfig).filter(CronConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="定时任务不存在")
    if request.name is not None:
        config.name = request.name
    if request.cron_expression is not None:
        config.cron_expression = request.cron_expression
    if request.is_enabled is not None:
        config.is_enabled = request.is_enabled
    db.commit()
    task_scheduler.update_job(config)
    return success_response(message="定时任务更新成功")


@router.delete("/{config_id}")
def delete_cron_config(config_id: int, db: Session = Depends(get_db)):
    config = db.query(CronConfig).filter(CronConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="定时任务不存在")
    task_scheduler.remove_job(config_id)
    db.delete(config)
    db.commit()
    return success_response(message="定时任务删除成功")
```

- [ ] **Step 3: 更新 main.py 启动调度器**

```python
from services.scheduler import task_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    task_scheduler.start()
    yield
    task_scheduler.stop()

from routers import cron
app.include_router(cron.router)
```

- [ ] **Step 4: Commit**

```bash
git add backend/services/scheduler.py backend/routers/cron.py
git commit -m "feat: 实现定时任务调度"
```

---

## Task 10: 仪表盘 API

**Covers:** S4

**Files:**
- Create: `backend/routers/dashboard.py`

### Steps

- [ ] **Step 1: 创建 dashboard.py 路由**

```python
import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import CloudAccount, InspectionTask, InspectionResult, CronConfig
from schemas.inspection import DashboardStats
from utils.response import success_response

router = APIRouter(prefix="/api/dashboard", tags=["仪表盘"])


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    account_count = db.query(CloudAccount).filter(CloudAccount.is_enabled == True).count()
    last_task = db.query(InspectionTask).filter(InspectionTask.status == "completed").order_by(desc(InspectionTask.completed_at)).first()

    total_resources, normal_count, abnormal_count = 0, 0, 0
    last_inspection_time = None
    if last_task:
        total_resources = last_task.total_resources
        normal_count = last_task.normal_count
        abnormal_count = last_task.abnormal_count
        last_inspection_time = last_task.completed_at

    next_cron = db.query(CronConfig).filter(CronConfig.is_enabled == True, CronConfig.next_run_at.isnot(None)).order_by(CronConfig.next_run_at).first()

    stats = DashboardStats(
        total_resources=total_resources,
        normal_count=normal_count,
        abnormal_count=abnormal_count,
        account_count=account_count,
        last_inspection_time=last_inspection_time,
        next_inspection_time=next_cron.next_run_at if next_cron else None
    )
    return success_response(data=stats.model_dump())


@router.get("/abnormal-resources")
def get_abnormal_resources(limit: int = 10, db: Session = Depends(get_db)):
    last_task = db.query(InspectionTask).filter(InspectionTask.status == "completed").order_by(desc(InspectionTask.completed_at)).first()
    if not last_task:
        return success_response(data=[])

    results = db.query(InspectionResult).filter(
        InspectionResult.task_id == last_task.id, InspectionResult.is_abnormal == True
    ).limit(limit).all()

    items = []
    for r in results:
        items.append({
            "id": r.id, "resource_type": r.resource_type, "resource_id": r.resource_id,
            "resource_name": r.resource_name, "region": r.region,
            "cpu_usage": r.cpu_usage, "memory_usage": r.memory_usage, "disk_usage": r.disk_usage,
            "abnormal_metrics": json.loads(r.abnormal_metrics) if r.abnormal_metrics else None,
        })
    return success_response(data=items)
```

- [ ] **Step 2: 更新 main.py**

```python
from routers import dashboard
app.include_router(dashboard.router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/routers/dashboard.py
git commit -m "feat: 实现仪表盘 API"
```
