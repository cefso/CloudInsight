import logging
from alibabacloud_slb20140515.client import Client as SlbClient
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_slb20140515 import models as slb_models

logger = logging.getLogger(__name__)


class SlbClientWrapper:
    def __init__(self, config: open_api_models.Config, region_id: str):
        self._client = SlbClient(config)
        self.region_id = region_id

    def list_instances(self) -> list:
        """获取所有 SLB 实例"""
        try:
            request = slb_models.DescribeLoadBalancersRequest(
                region_id=self.region_id,
                page_size=100
            )
            response = self._client.describe_load_balancers(request)
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

    def get_listeners(self, load_balancer_id: str) -> list:
        """获取 SLB 实例的所有监听器"""
        try:
            request = slb_models.DescribeLoadBalancerListenersRequest(
                load_balancer_id=load_balancer_id,
                region_id=self.region_id,
                max_results=100
            )
            response = self._client.describe_load_balancer_listeners(request)
            if response.status_code == 200 and response.body:
                listeners = response.body.listeners
                if listeners:
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

    def get_health_status(self, load_balancer_id: str) -> list:
        """获取 SLB 后端服务器健康状态"""
        try:
            request = slb_models.DescribeHealthStatusRequest(
                load_balancer_id=load_balancer_id,
                region_id=self.region_id
            )
            response = self._client.describe_health_status(request)
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
