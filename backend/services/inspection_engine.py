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
