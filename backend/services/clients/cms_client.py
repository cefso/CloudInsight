import json
import logging
from datetime import datetime, timedelta
from alibabacloud_cms20190101.client import Client as CmsClient
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_cms20190101 import models as cms_models
from services.clients.ecs_client import EcsClientWrapper
from services.clients.rds_client import RdsClientWrapper

logger = logging.getLogger(__name__)


class CmsClientWrapper:
    RESOURCE_METRICS = {
        "acs_ecs_dashboard": {
            "name": "ECS",
            "metrics": ["CPUUtilization", "memory_usedutilization", "diskusage_utilization"],
        },
        "acs_rds_dashboard": {
            "name": "RDS",
            "metrics": ["CpuUsage", "MemoryUsage", "DiskUsage"],
        },
    }

    def __init__(self, config: open_api_models.Config, region_id: str):
        self._client = CmsClient(config)
        self.region_id = region_id
        self._ecs_helper = EcsClientWrapper(config, region_id)
        self._rds_helper = RdsClientWrapper(config, region_id)

    def test_connection(self) -> dict:
        try:
            request = cms_models.DescribeMonitorResourceQuotaAttributeRequest()
            response = self._client.describe_monitor_resource_quota_attribute(request)
            if response.status_code == 200:
                return {"success": True, "message": "连接成功"}
            return {"success": False, "message": f"HTTP {response.status_code}"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def get_metric_data(
        self,
        namespace: str,
        metric_name: str,
        dimensions: list[dict],
        period: int = 60
    ) -> dict:
        """获取指标最新数据，返回 {value, disks} 结构"""
        try:
            request = cms_models.DescribeMetricLastRequest(
                namespace=namespace,
                metric_name=metric_name,
                dimensions=json.dumps(dimensions),
                period=str(period)
            )
            response = self._client.describe_metric_last(request)
            if response.status_code == 200 and response.body:
                datapoints = response.body.datapoints
                if datapoints:
                    points = json.loads(datapoints)
                    if points:
                        # 对于磁盘指标，按 diskname 分组，过滤容器挂载点
                        if "disk" in metric_name.lower():
                            filter_prefixes = ["/var/lib/container", "/var/lib/kubelet", "/var/lib/docker", "/run/container"]
                            device_values = {}
                            has_diskname = False
                            
                            for point in points:
                                val = point.get("Average", point.get("Value"))
                                diskname = point.get("diskname")
                                
                                if diskname:
                                    has_diskname = True
                                    disknames = [d.strip() for d in diskname.split(",")]
                                    for dn in disknames:
                                        if any(dn.startswith(prefix) for prefix in filter_prefixes):
                                            continue
                                        if dn and dn.startswith("/"):
                                            device_values[dn] = float(val)
                                elif val is not None:
                                    return {"value": float(val), "disks": []}
                            
                            if has_diskname and not device_values:
                                return {"value": None, "disks": []}
                            
                            if device_values:
                                disks = [{"device": d, "usage": v} for d, v in device_values.items()]
                                max_value = max(device_values.values())
                                return {"value": max_value, "disks": disks}
                            
                            return {"value": None, "disks": []}
                        
                        val = points[-1].get("Average", points[-1].get("Value"))
                        return {"value": float(val) if val is not None else None, "disks": []}
            return {"value": None, "disks": []}
        except Exception as e:
            logger.error(f"获取指标失败: {e}")
            return {"value": None, "disks": []}

    def list_resources(self, namespace: str, metric_name: str = None) -> list:
        """通过指标数据获取资源列表，支持分页"""
        try:
            if not metric_name:
                metrics = self.RESOURCE_METRICS.get(namespace, {}).get("metrics", [])
                if not metrics:
                    return []
                metric_name = metrics[0]

            now = datetime.utcnow()
            start_time = (now - timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%SZ")
            end_time = now.strftime("%Y-%m-%dT%H:%M:%SZ")

            resources = []
            seen = set()
            next_token = None

            while True:
                request = cms_models.DescribeMetricListRequest(
                    namespace=namespace,
                    metric_name=metric_name,
                    period="60",
                    start_time=start_time,
                    end_time=end_time,
                    length=1000
                )
                if next_token:
                    request.next_token = next_token

                response = self._client.describe_metric_list(request)

                if response.status_code == 200 and response.body:
                    datapoints = response.body.datapoints
                    if datapoints:
                        points = json.loads(datapoints)
                        for point in points:
                            instance_id = point.get("instanceId", "")
                            if instance_id and instance_id not in seen:
                                seen.add(instance_id)
                                resources.append({
                                    "instanceId": instance_id,
                                    "instanceName": instance_id,
                                })

                    next_token = response.body.next_token
                    if not next_token or not datapoints:
                        break
                else:
                    break

            if resources:
                if namespace == "acs_ecs_dashboard":
                    self._ecs_helper.fill_names(resources)
                elif namespace == "acs_rds_dashboard":
                    self._rds_helper.fill_names(resources)

            return resources
        except Exception as e:
            logger.error(f"列出资源失败: {e}")
            return []
