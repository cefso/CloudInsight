import json
import time
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from models import CloudAccount, InspectionResult
from services.aliyun_client import AliyunClient, RESOURCE_TYPE_NAMES

logger = logging.getLogger(__name__)


def inspect_metrics(
    db: Session,
    task_id: int,
    account: CloudAccount,
    client: AliyunClient,
    region: str,
    namespace: str,
    cpu_threshold: float,
    memory_threshold: float,
    disk_threshold: float,
    cpu_warning: float,
    memory_warning: float,
    disk_warning: float,
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
            time.sleep(0.2)
            result_data = client.get_metric_data(
                namespace=namespace,
                metric_name=metric_name,
                dimensions=[{"instanceId": resource.get("instanceId", "")}]
            )
            value = result_data.get("value")
            if value is not None:
                if "cpu" in metric_name.lower():
                    cpu_usage = value
                    if value >= cpu_threshold:
                        abnormal_metrics.append("CPU 使用率")
                    elif value >= cpu_warning:
                        warning_metrics.append("CPU 使用率")
                elif "memory" in metric_name.lower():
                    memory_usage = value
                    if value >= memory_threshold:
                        abnormal_metrics.append("内存使用率")
                    elif value >= memory_warning:
                        warning_metrics.append("内存使用率")
                elif "disk" in metric_name.lower():
                    disk_usage = value
                    disk_details = result_data.get("disks", [])
                    if value >= disk_threshold:
                        abnormal_metrics.append("磁盘使用率")
                    elif value >= disk_warning:
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
            inspected_at=datetime.now()
        )
        db.add(result)

    db.commit()
    return {"total": total, "normal": normal, "warning": warning, "abnormal": abnormal}
