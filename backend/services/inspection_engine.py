import json
import time
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from models import CloudAccount, InspectionTask, InspectionResult, AlertThreshold
from services.crypto import crypto_service
from services.aliyun_client import AliyunClient, RESOURCE_TYPE_NAMES

logger = logging.getLogger(__name__)


class InspectionEngine:
    def __init__(self, db: Session):
        self.db = db

    def run_inspection(self, account_ids: Optional[list[int]] = None, trigger_type: str = "manual", task_id: Optional[int] = None) -> InspectionTask:
        # 如果传入了 task_id，使用已有任务；否则创建新任务
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
            # 警告阈值 = 异常阈值 - 10%
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
                # SLB 巡检逻辑（使用 SLB API）
                if namespace == "slb":
                    result = self._inspect_slb(task_id, account.id, client, region)
                    total += result["total"]
                    normal += result["normal"]
                    warning += result.get("warning", 0)
                    abnormal += result["abnormal"]
                    continue

                # ECS/RDS 巡检逻辑（使用云监控 API）
                metrics = AliyunClient.RESOURCE_METRICS.get(namespace, {})
                metric_names = metrics.get("metrics", [])
                if not metric_names:
                    continue
                resources = client.list_resources(namespace, metric_names[0])
                for resource in resources:
                    total += 1
                    cpu_usage, memory_usage, disk_usage = None, None, None
                    disk_details = []
                    abnormal_metrics = []
                    warning_metrics = []

                    metrics = AliyunClient.RESOURCE_METRICS.get(namespace, {})
                    for metric_name in metrics.get("metrics", []):
                        # 添加延迟避免触发限流
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

                    # 确定状态
                    if len(abnormal_metrics) > 0:
                        status = "abnormal"
                        abnormal += 1
                    elif len(warning_metrics) > 0:
                        status = "warning"
                        warning += 1
                    else:
                        status = "normal"
                        normal += 1

                    # 合并异常和警告指标
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
                    self.db.add(result)

        self.db.commit()
        return {"total": total, "normal": normal, "warning": warning, "abnormal": abnormal}

    def _inspect_slb(self, task_id: int, account_id: int, client: AliyunClient, region: str) -> dict:
        """SLB 巡检逻辑"""
        total, normal, warning, abnormal = 0, 0, 0, 0
        
        # 获取所有 SLB 实例
        slb_instances = client.list_slb_instances()
        
        for slb in slb_instances:
            total += 1
            lb_id = slb["loadBalancerId"]
            lb_name = slb["loadBalancerName"]
            lb_status = slb["status"]
            
            # 获取监听器
            listeners = client.get_slb_listeners(lb_id)
            
            # 获取后端服务器健康状态
            health_servers = client.get_slb_health_status(lb_id)
            
            # 检查监听器状态
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
                
                # stopped 为警告，其他非 running 状态为异常
                if status == "stopped":
                    warning_listeners.append(f"{protocol}:{port}({status})")
                elif status != "running":
                    abnormal_listeners.append(f"{protocol}:{port}({status})")
            
            # 检查后端服务器健康状态
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
                
                # unavailable 为警告，abnormal 为异常
                if server["status"] == "unavailable":
                    warning_servers.append(f"{server['serverIp']}:{server['port']}({server['status']})")
                elif server["status"] == "abnormal":
                    abnormal_servers.append(f"{server['serverIp']}:{server['port']}({server['status']})")
            
            # 确定状态：异常 > 警告 > 正常
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
            
            # 将监听器和后端服务器信息合并存储
            slb_details = {
                "listeners": listener_details,
                "backend_servers": server_details,
            }
            
            # 合并所有问题指标
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
                disk_details=json.dumps(slb_details),
                status=status,
                abnormal_metrics=json.dumps(all_metrics) if all_metrics else None,
                inspected_at=datetime.now()
            )
            self.db.add(result)
        
        self.db.commit()
        return {"total": total, "normal": normal, "warning": warning, "abnormal": abnormal}
