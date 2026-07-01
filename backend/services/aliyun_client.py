from typing import Optional
import logging
from alibabacloud_cms20190101.client import Client as CmsClient
from alibabacloud_slb20140515.client import Client as SlbClient
from alibabacloud_ecs20140526.client import Client as EcsClient
from alibabacloud_rds20140815.client import Client as RdsClient
from alibabacloud_bssopenapi20171214.client import Client as BssClient
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_cms20190101 import models as cms_models
from alibabacloud_slb20140515 import models as slb_models
from alibabacloud_ecs20140526 import models as ecs_models
from alibabacloud_rds20140815 import models as rds_models
from alibabacloud_bssopenapi20171214 import models as bss_models
import json
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)


class AliyunClient:
    # 阿里云云监控标准指标名称
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

    def __init__(self, access_key_id: str, access_key_secret: str, region_id: str = "cn-hangzhou"):
        self.region_id = region_id
        self.access_key_id = access_key_id
        self.access_key_secret = access_key_secret
        config = open_api_models.Config(
            access_key_id=access_key_id,
            access_key_secret=access_key_secret,
            region_id=region_id
        )
        self._client = CmsClient(config)
        self._slb_client = SlbClient(config)
        self._ecs_client = EcsClient(config)
        self._rds_client = RdsClient(config)
        # BssOpenApi 使用固定 endpoint
        bss_config = open_api_models.Config(
            access_key_id=access_key_id,
            access_key_secret=access_key_secret,
            region_id='cn-hangzhou'
        )
        self._bss_client = BssClient(bss_config)

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
                                    # diskname 可能是逗号分隔的多个路径
                                    disknames = [d.strip() for d in diskname.split(",")]
                                    for dn in disknames:
                                        if any(dn.startswith(prefix) for prefix in filter_prefixes):
                                            continue
                                        if dn and dn.startswith("/"):
                                            device_values[dn] = float(val)
                                elif val is not None:
                                    # 没有 diskname 字段（如 RDS），直接返回值
                                    return {"value": float(val), "disks": []}
                            
                            if has_diskname and not device_values:
                                return {"value": None, "disks": []}
                            
                            if device_values:
                                disks = [{"device": d, "usage": v} for d, v in device_values.items()]
                                max_value = max(device_values.values())
                                return {"value": max_value, "disks": disks}
                            
                            return {"value": None, "disks": []}
                        
                        # 其他指标返回最新值
                        val = points[-1].get("Average", points[-1].get("Value"))
                        return {"value": float(val) if val is not None else None, "disks": []}
            return {"value": None, "disks": []}
        except Exception as e:
            logger.error(f"获取指标失败: {e}")
            return {"value": None, "disks": []}

    def list_resources(self, namespace: str, metric_name: str = None) -> list:
        """通过指标数据获取资源列表，支持分页"""
        try:
            # 使用第一个指标来获取资源列表
            if not metric_name:
                metrics = self.RESOURCE_METRICS.get(namespace, {}).get("metrics", [])
                if not metrics:
                    return []
                metric_name = metrics[0]

            # 获取最近 5 分钟的指标数据
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
                                    "instanceName": instance_id,  # 先用 ID，后面会获取真实名称
                                })

                    # 检查是否有下一页
                    next_token = response.body.next_token
                    if not next_token or not datapoints:
                        break
                else:
                    break

            # 如果是 ECS 或 RDS，获取真实实例名称
            if resources:
                if namespace == "acs_ecs_dashboard":
                    self._fill_ecs_names(resources)
                elif namespace == "acs_rds_dashboard":
                    self._fill_rds_names(resources)

            return resources
        except Exception as e:
            logger.error(f"列出资源失败: {e}")
            return []

    def _fill_ecs_names(self, resources: list):
        """填充 ECS 实例名称"""
        try:
            name_map = {}
            next_token = None
            
            # 分页获取所有实例
            while True:
                request = ecs_models.DescribeInstancesRequest(
                    region_id=self.region_id,
                    max_results=100
                )
                if next_token:
                    request.next_token = next_token
                
                response = self._ecs_client.describe_instances(request)
                if response.status_code == 200 and response.body:
                    instances = response.body.instances
                    if instances and instances.instance:
                        for inst in instances.instance:
                            name_map[inst.instance_id] = inst.instance_name
                    
                    next_token = response.body.next_token
                    if not next_token:
                        break
                else:
                    break
            
            # 填充名称
            for r in resources:
                r["instanceName"] = name_map.get(r["instanceId"], r["instanceId"])
        except Exception as e:
            logger.error(f"获取 ECS 实例名称失败: {e}")

    def _fill_rds_names(self, resources: list):
        """填充 RDS 实例名称"""
        try:
            request = rds_models.DescribeDBInstancesRequest(
                region_id=self.region_id
            )
            response = self._rds_client.describe_dbinstances(request)
            if response.status_code == 200 and response.body:
                items = response.body.items
                if items and items.dbinstance:
                    name_map = {inst.dbinstance_id: inst.dbinstance_description for inst in items.dbinstance}
                    for r in resources:
                        r["instanceName"] = name_map.get(r["instanceId"], r["instanceId"])
        except Exception as e:
            logger.error(f"获取 RDS 实例名称失败: {e}")

    def list_slb_instances(self) -> list:
        """获取所有 SLB 实例"""
        try:
            request = slb_models.DescribeLoadBalancersRequest(
                region_id=self.region_id,
                page_size=100
            )
            response = self._slb_client.describe_load_balancers(request)
            if response.status_code == 200 and response.body:
                load_balancers = response.body.load_balancers
                if load_balancers and load_balancers.load_balancer:
                    return [
                        {
                            "loadBalancerId": lb.load_balancer_id,
                            "loadBalancerName": lb.load_balancer_name or lb.load_balancer_id,
                            "status": lb.load_balancer_status,
                            "address": lb.address,
                            "addressType": lb.address_type,
                        }
                        for lb in load_balancers.load_balancer
                    ]
            return []
        except Exception as e:
            logger.error(f"获取 SLB 实例失败: {e}")
            return []

    def get_slb_listeners(self, load_balancer_id: str) -> list:
        """获取 SLB 实例的所有监听器"""
        try:
            request = slb_models.DescribeLoadBalancerListenersRequest(
                load_balancer_id=load_balancer_id,
                region_id=self.region_id,
                max_results=100
            )
            response = self._slb_client.describe_load_balancer_listeners(request)
            if response.status_code == 200 and response.body:
                listeners = response.body.listeners
                if listeners:
                    # API 可能返回所有 SLB 的监听器，需要按 load_balancer_id 过滤
                    return [
                        {
                            "listenerPort": l.listener_port,
                            "listenerProtocol": l.listener_protocol,
                            "status": l.status,
                            "description": l.description or "",
                        }
                        for l in listeners
                        if l.load_balancer_id == load_balancer_id
                    ]
            return []
        except Exception as e:
            logger.error(f"获取 SLB 监听器失败: {e}")
            return []

    def get_slb_health_status(self, load_balancer_id: str) -> list:
        """获取 SLB 后端服务器健康状态"""
        try:
            request = slb_models.DescribeHealthStatusRequest(
                load_balancer_id=load_balancer_id,
                region_id=self.region_id
            )
            response = self._slb_client.describe_health_status(request)
            if response.status_code == 200 and response.body:
                backend_servers = response.body.backend_servers
                if backend_servers and backend_servers.backend_server:
                    return [
                        {
                            "serverId": s.server_id,
                            "serverIp": s.server_ip,
                            "port": s.port,
                            "protocol": s.protocol,
                            "status": s.server_health_status,
                        }
                        for s in backend_servers.backend_server
                    ]
            return []
        except Exception as e:
            logger.error(f"获取 SLB 健康状态失败: {e}")
            return []

    def get_expiring_instances(self, days_threshold: int = 15) -> list:
        """获取即将到期的实例列表"""
        try:
            now = datetime.now(timezone.utc)
            threshold_time = now + timedelta(days=days_threshold)

            request = bss_models.QueryAvailableInstancesRequest(
                page_num=1,
                page_size=100
            )
            response = self._bss_client.query_available_instances(request)

            if response.status_code != 200 or not response.body:
                return []

            data = response.body.data
            if not data or not data.instance_list:
                return []

            expiring = []
            for inst in data.instance_list:
                if not inst.end_time:
                    continue
                # 排除已标记不续费的实例
                if inst.renew_status == 'NotRenewal':
                    continue
                try:
                    # 解析到期时间
                    end_time_str = inst.end_time.replace('Z', '+00:00')
                    end_time = datetime.fromisoformat(end_time_str)
                    days_remaining = (end_time - now).days

                    # 只返回小于阈值的实例
                    if 0 <= days_remaining <= days_threshold:
                        expiring.append({
                            "instance_id": inst.instance_id,
                            "product_code": inst.product_code,
                            "region": inst.region or "global",
                            "end_time": inst.end_time,
                            "days_remaining": days_remaining,
                            "status": "abnormal" if days_remaining < 7 else "warning",
                        })
                except Exception:
                    continue

            return expiring
        except Exception as e:
            logger.error(f"获取实例到期信息失败: {e}")
            return []


RESOURCE_TYPE_NAMES = {
    "acs_ecs_dashboard": "ECS",
    "acs_rds_dashboard": "RDS",
    "slb": "SLB",
}
