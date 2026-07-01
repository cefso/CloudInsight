import json
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from models import CloudAccount, InspectionTask, InspectionResult, AlertThreshold
from services.crypto import crypto_service
from services.aliyun_client import AliyunClient, RESOURCE_TYPE_NAMES
from services.inspectors.metric_inspector import inspect_metrics
from services.inspectors.slb_inspector import inspect_slb
from services.inspectors.expiration_inspector import inspect_expiration

logger = logging.getLogger(__name__)


class InspectionEngine:
    def __init__(self, db: Session):
        self.db = db

    def run_inspection(self, account_ids: Optional[list[int]] = None, trigger_type: str = "manual", task_id: Optional[int] = None) -> InspectionTask:
        if task_id:
            task = self.db.query(InspectionTask).filter(InspectionTask.id == task_id).first()
            if not task:
                raise ValueError(f"任务 {task_id} 不存在")
        else:
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
            cpu_warning = cpu_threshold - 10
            memory_warning = memory_threshold - 10
            disk_warning = disk_threshold - 10

            total, normal, warning, abnormal = 0, 0, 0, 0
            for account in accounts:
                result = self._inspect_account(task.id, account, cpu_threshold, memory_threshold, disk_threshold, cpu_warning, memory_warning, disk_warning)
                total += result["total"]
                normal += result["normal"]
                warning += result["warning"]
                abnormal += result["abnormal"]

                exp_result = inspect_expiration(self.db, task.id, account, AliyunClient(account.access_key_id, crypto_service.decrypt(account.access_key_secret), "cn-hangzhou"))
                total += exp_result["total"]
                normal += exp_result["normal"]
                warning += exp_result["warning"]
                abnormal += exp_result["abnormal"]

            task.status = "completed"
            task.completed_at = datetime.now()
            task.total_resources = total
            task.normal_count = normal
            task.warning_count = warning
            task.abnormal_count = abnormal
            self.db.commit()

        except Exception as e:
            task.status = "failed"
            task.completed_at = datetime.now()
            task.error_message = str(e)
            self.db.commit()
            raise

        return task

    def _inspect_account(self, task_id: int, account: CloudAccount, cpu_threshold: float, memory_threshold: float, disk_threshold: float, cpu_warning: float, memory_warning: float, disk_warning: float) -> dict:
        ak = account.access_key_id
        sk = crypto_service.decrypt(account.access_key_secret)
        regions = json.loads(account.regions) if account.regions else ["cn-hangzhou"]
        resource_types = json.loads(account.resource_types) if account.resource_types else list(RESOURCE_TYPE_NAMES.keys())

        total, normal, warning, abnormal = 0, 0, 0, 0

        for region in regions:
            client = AliyunClient(ak, sk, region)
            for namespace in resource_types:
                if namespace == "slb":
                    result = inspect_slb(self.db, task_id, account.id, client, region)
                    total += result["total"]
                    normal += result["normal"]
                    warning += result.get("warning", 0)
                    abnormal += result["abnormal"]
                    continue

                result = inspect_metrics(
                    self.db, task_id, account, client, region, namespace,
                    cpu_threshold, memory_threshold, disk_threshold,
                    cpu_warning, memory_warning, disk_warning,
                )
                total += result["total"]
                normal += result["normal"]
                warning += result["warning"]
                abnormal += result["abnormal"]

        return {"total": total, "normal": normal, "warning": warning, "abnormal": abnormal}
