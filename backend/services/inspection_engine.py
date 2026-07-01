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
from services.inspectors.event_inspector import inspect_system_events

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

            # 获取阈值配置（按资源类型）
            thresholds = {t.resource_type: t for t in self.db.query(AlertThreshold).all()}
            global_threshold = thresholds.get("global")
            
            def get_thresholds(resource_type: str):
                """获取指定资源类型的阈值，如果没有则使用全局默认"""
                rt = thresholds.get(resource_type, global_threshold)
                return {
                    "cpu": rt.cpu_threshold if rt and rt.cpu_threshold else 90.0,
                    "memory": rt.memory_threshold if rt and rt.memory_threshold else 90.0,
                    "disk": rt.disk_threshold if rt and rt.disk_threshold else 90.0,
                }

            total, normal, warning, abnormal = 0, 0, 0, 0
            for account in accounts:
                # 巡检 ECS
                ecs_th = get_thresholds("ECS")
                result = self._inspect_account(
                    task.id, account, "acs_ecs_dashboard", "ECS",
                    ecs_th["cpu"], ecs_th["memory"], ecs_th["disk"],
                    ecs_th["cpu"] - 10, ecs_th["memory"] - 10, ecs_th["disk"] - 10
                )
                total += result["total"]
                normal += result["normal"]
                warning += result["warning"]
                abnormal += result["abnormal"]

                # 巡检 RDS
                rds_th = get_thresholds("RDS")
                result = self._inspect_account(
                    task.id, account, "acs_rds_dashboard", "RDS",
                    rds_th["cpu"], rds_th["memory"], rds_th["disk"],
                    rds_th["cpu"] - 10, rds_th["memory"] - 10, rds_th["disk"] - 10
                )
                total += result["total"]
                normal += result["normal"]
                warning += result["warning"]
                abnormal += result["abnormal"]

                # 巡检 Redis
                redis_th = get_thresholds("Redis")
                result = self._inspect_account(
                    task.id, account, "acs_kvstore", "Redis",
                    redis_th["cpu"], redis_th["memory"], redis_th["disk"],
                    redis_th["cpu"] - 10, redis_th["memory"] - 10, redis_th["disk"] - 10
                )
                total += result["total"]
                normal += result["normal"]
                warning += result["warning"]
                abnormal += result["abnormal"]

                # 巡检 SLB
                slb_result = self._inspect_account(
                    task.id, account, "slb", "SLB",
                    90.0, 90.0, 90.0, 80.0, 80.0, 80.0
                )
                total += slb_result["total"]
                normal += slb_result["normal"]
                warning += slb_result["warning"]
                abnormal += slb_result["abnormal"]

                exp_result = inspect_expiration(self.db, task.id, account, AliyunClient(account.access_key_id, crypto_service.decrypt(account.access_key_secret), "cn-hangzhou"))
                total += exp_result["total"]
                normal += exp_result["normal"]
                warning += exp_result["warning"]
                abnormal += exp_result["abnormal"]

                # 巡检系统事件
                event_result = inspect_system_events(self.db, task.id, account, AliyunClient(account.access_key_id, crypto_service.decrypt(account.access_key_secret), "cn-hangzhou"))
                total += event_result["total"]
                normal += event_result["normal"]
                warning += event_result["warning"]
                abnormal += event_result["abnormal"]

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

    def _inspect_account(
        self, task_id: int, account: CloudAccount, namespace: str, resource_type: str,
        cpu_threshold: float, memory_threshold: float, disk_threshold: float,
        cpu_warning: float, memory_warning: float, disk_warning: float
    ) -> dict:
        ak = account.access_key_id
        sk = crypto_service.decrypt(account.access_key_secret)
        regions = json.loads(account.regions) if account.regions else ["cn-hangzhou"]

        total, normal, warning, abnormal = 0, 0, 0, 0

        for region in regions:
            client = AliyunClient(ak, sk, region)
            
            # SLB 巡检
            if namespace == "slb":
                result = inspect_slb(self.db, task_id, account.id, client, region)
                total += result["total"]
                normal += result["normal"]
                warning += result.get("warning", 0)
                abnormal += result["abnormal"]
                continue

            # 指标巡检（ECS/RDS/Redis）
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

        return {"total": total, "normal": normal, "warning": warning, "abnormal": abnormal}
