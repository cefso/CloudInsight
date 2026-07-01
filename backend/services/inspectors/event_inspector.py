import json
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from models import CloudAccount, InspectionResult
from services.aliyun_client import AliyunClient

logger = logging.getLogger(__name__)


def inspect_system_events(
    db: Session,
    task_id: int,
    account: CloudAccount,
    client: AliyunClient,
) -> dict:
    """系统事件巡检，返回 {total, normal, warning, abnormal}"""
    total, normal, warning, abnormal = 0, 0, 0, 0

    # 获取 CRITICAL 和 WARN 级别的事件
    critical_events = client.get_system_events(hours=24, level="CRITICAL")
    warn_events = client.get_system_events(hours=24, level="WARN")

    # 去重（按 event_id）
    seen = set()
    all_events = []
    for event in critical_events + warn_events:
        eid = event.get("event_id")
        if eid and eid not in seen:
            seen.add(eid)
            all_events.append(event)

    for event in all_events:
        total += 1
        level = event.get("level", "INFO")
        name = event.get("name", "")
        product = event.get("product", "")
        resource_id = event.get("resource_id", "")
        instance_name = event.get("instance_name", "")
        region_id = event.get("region_id", "")

        # 确定状态
        if level == "CRITICAL":
            status = "abnormal"
            abnormal += 1
        elif level == "WARN":
            status = "warning"
            warning += 1
        else:
            status = "normal"
            normal += 1

        event_details = {
            "event_id": event.get("event_id"),
            "name": name,
            "product": product,
            "level": level,
            "status": event.get("status"),
            "content": event.get("content", "")[:200],  # 截断内容
            "time": event.get("time"),
        }

        result = InspectionResult(
            task_id=task_id,
            account_id=account.id,
            resource_type="SystemEvent",
            resource_id=resource_id,
            resource_name=instance_name or resource_id,
            region=region_id or "global",
            cpu_usage=None,
            memory_usage=None,
            disk_usage=None,
            disk_details=None,
            slb_details=None,
            expiration_details=json.dumps(event_details),
            status=status,
            abnormal_metrics=json.dumps([f"[{level}] {product}: {name}"]),
            inspected_at=datetime.now()
        )
        db.add(result)

    db.commit()
    return {"total": total, "normal": normal, "warning": warning, "abnormal": abnormal}
