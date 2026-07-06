import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models import CloudAccount, InspectionResult
from services.aliyun_client import AliyunClient, RESOURCE_TYPE_NAMES

logger = logging.getLogger(__name__)


@dataclass
class Thresholds:
    cpu: float
    memory: float
    disk: float
    cpu_warning: float
    memory_warning: float
    disk_warning: float


def inspect_metrics(
    db: Session,
    task_id: int,
    account: CloudAccount,
    client: AliyunClient,
    region: str,
    namespace: str,
    thresholds: Thresholds,
) -> dict:
    """ECS/RDS 指标巡检，返回 {total, normal, warning, abnormal}"""
    total, normal, warning, abnormal = 0, 0, 0, 0

    metrics = AliyunClient.RESOURCE_METRICS.get(namespace, {})
    metric_names = metrics.get("metrics", [])
    if not metric_names:
        return {"total": 0, "normal": 0, "warning": 0, "abnormal": 0}

    resources = client.list_resources(namespace, metric_names[0])
    for resource in resources:
        total += 1
        cpu_usage, memory_usage, disk_usage = None, None, None
        disk_details = []
        abnormal_metrics = []
        warning_metrics = []

        for metric_name in metric_names:
            result_data = client.get_metric_data(
                namespace=namespace,
                metric_name=metric_name,
                dimensions=[{"instanceId": resource.get("instanceId", "")}]
            )
            value = result_data.get("value")
            if value is not None:
                if "cpu" in metric_name.lower():
                    cpu_usage = value
                    if value >= thresholds.cpu:
                        abnormal_metrics.append("CPU 使用率")
                    elif value >= thresholds.cpu_warning:
                        warning_metrics.append("CPU 使用率")
                elif "memory" in metric_name.lower():
                    # 对于 Redis，多个内存指标取第一个有效值
                    if memory_usage is None:
                        memory_usage = value
                        if value >= thresholds.memory:
                            abnormal_metrics.append("内存使用率")
                        elif value >= thresholds.memory_warning:
                            warning_metrics.append("内存使用率")
                elif "disk" in metric_name.lower():
                    disk_usage = value
                    disk_details = result_data.get("disks", [])
                    if value >= thresholds.disk:
                        abnormal_metrics.append("磁盘使用率")
                    elif value >= thresholds.disk_warning:
                        warning_metrics.append("磁盘使用率")

        if len(abnormal_metrics) > 0:
            status = "abnormal"
            abnormal += 1
        elif len(warning_metrics) > 0:
            status = "warning"
            warning += 1
        else:
            status = "normal"
            normal += 1

        all_metrics = abnormal_metrics + warning_metrics

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
            disk_details=json.dumps(disk_details) if disk_details else None,
            status=status,
            abnormal_metrics=json.dumps(all_metrics) if all_metrics else None,
            inspected_at=datetime.now(timezone.utc)
        )
        db.add(result)

    db.commit()
    return {"total": total, "normal": normal, "warning": warning, "abnormal": abnormal}
