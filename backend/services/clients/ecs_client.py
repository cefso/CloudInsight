import logging
from alibabacloud_ecs20140526.client import Client as EcsClient
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_ecs20140526 import models as ecs_models

logger = logging.getLogger(__name__)


class EcsClientWrapper:
    def __init__(self, config: open_api_models.Config, region_id: str):
        self._client = EcsClient(config)
        self.region_id = region_id

    def fill_names(self, resources: list):
        """填充 ECS 实例名称"""
        try:
            name_map = {}
            next_token = None
            
            while True:
                request = ecs_models.DescribeInstancesRequest(
                    region_id=self.region_id,
                    max_results=100
                )
                if next_token:
                    request.next_token = next_token
                
                response = self._client.describe_instances(request)
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
            
            for r in resources:
                r["instanceName"] = name_map.get(r["instanceId"], r["instanceId"])
        except Exception as e:
            logger.error(f"获取 ECS 实例名称失败: {e}")
