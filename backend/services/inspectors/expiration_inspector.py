import json
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models import CloudAccount, InspectionResult
from services.aliyun_client import AliyunClient

logger = logging.getLogger(__name__)


def inspect_expiration(
    db: Session,
    task_id: int,
    account: CloudAccount,
    client: AliyunClient,
) -> dict:
    """巡检实例到期时间，返回 {total, normal, warning, abnormal}"""
    total, normal, warning, abnormal = 0, 0, 0, 0

    expiring = client.get_expiring_instances(days_threshold=15)

    for inst in expiring:
        total += 1
        status = inst["status"]

        if status == "abnormal":
            abnormal += 1
        elif status == "warning":
            warning += 1
        else:
            normal += 1

        result = InspectionResult(
            task_id=task_id,
            account_id=account.id,
            resource_type="Expiration",
            resource_id=inst["instance_id"],
            resource_name=f"{inst['product_code']} ({inst['instance_id']})",
            region=inst["region"],
            cpu_usage=None,
            memory_usage=None,
            disk_usage=None,
            expiration_details=json.dumps({
                "product_code": inst["product_code"],
                "end_time": inst["end_time"],
                "days_remaining": inst["days_remaining"],
            }),
            status=status,
            abnormal_metrics=json.dumps([f"剩余 {inst['days_remaining']} 天到期"]),
            inspected_at=datetime.now(timezone.utc)
        )
        db.add(result)

    db.commit()
    return {"total": total, "normal": normal, "warning": warning, "abnormal": abnormal}
