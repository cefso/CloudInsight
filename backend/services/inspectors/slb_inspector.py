import json
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from models import InspectionResult
from services.aliyun_client import AliyunClient

logger = logging.getLogger(__name__)


def inspect_slb(
    db: Session,
    task_id: int,
    account_id: int,
    client: AliyunClient,
    region: str,
) -> dict:
    """SLB 巡检，返回 {total, normal, warning, abnormal}"""
    total, normal, warning, abnormal = 0, 0, 0, 0

    slb_instances = client.list_slb_instances()

    for slb in slb_instances:
        total += 1
        lb_id = slb["loadBalancerId"]
        lb_name = slb["loadBalancerName"]
        lb_status = slb["status"]

        listeners = client.get_slb_listeners(lb_id)
        health_servers = client.get_slb_health_status(lb_id)

        warning_listeners = []
        abnormal_listeners = []
        listener_details = []

        for listener in listeners:
            port = listener["listenerPort"]
            protocol = listener["listenerProtocol"]
            status = listener["status"]
            desc = listener["description"]

            listener_info = {
                "port": port,
                "protocol": protocol,
                "status": status,
                "description": desc,
            }
            listener_details.append(listener_info)

            if status == "stopped":
                warning_listeners.append(f"{protocol}:{port}({status})")
            elif status != "running":
                abnormal_listeners.append(f"{protocol}:{port}({status})")

        warning_servers = []
        abnormal_servers = []
        server_details = []

        for server in health_servers:
            server_info = {
                "serverIp": server["serverIp"],
                "port": server["port"],
                "protocol": server["protocol"],
                "status": server["status"],
            }
            server_details.append(server_info)

            if server["status"] == "unavailable":
                warning_servers.append(f"{server['serverIp']}:{server['port']}({server['status']})")
            elif server["status"] == "abnormal":
                abnormal_servers.append(f"{server['serverIp']}:{server['port']}({server['status']})")

        all_issues = abnormal_listeners + abnormal_servers
        all_warnings = warning_listeners + warning_servers

        if lb_status != "active":
            all_issues.append(f"实例状态:{lb_status}")

        if len(all_issues) > 0:
            status = "abnormal"
            abnormal += 1
        elif len(all_warnings) > 0:
            status = "warning"
            warning += 1
        else:
            status = "normal"
            normal += 1

        slb_details = {
            "listeners": listener_details,
            "backend_servers": server_details,
        }

        all_metrics = all_issues + all_warnings

        result = InspectionResult(
            task_id=task_id,
            account_id=account_id,
            resource_type="SLB",
            resource_id=lb_id,
            resource_name=lb_name,
            region=region,
            cpu_usage=None,
            memory_usage=None,
            disk_usage=None,
            slb_details=json.dumps(slb_details),
            status=status,
            abnormal_metrics=json.dumps(all_metrics) if all_metrics else None,
            inspected_at=datetime.now()
        )
        db.add(result)

    db.commit()
    return {"total": total, "normal": normal, "warning": warning, "abnormal": abnormal}
