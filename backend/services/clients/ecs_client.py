import logging
from alibabacloud_ecs20140526.client import Client as EcsClient
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_ecs20140526 import models as ecs_models

logger = logging.getLogger(__name__)

# 全局缓存，存储 instance_id -> (instance_name, region_id)
_instance_cache: dict[str, tuple[str, str]] = {}


class EcsClientWrapper:
    def __init__(self, config: open_api_models.Config, region_id: str):
        self._client = EcsClient(config)
        self._config = config
        self.region_id = region_id

    def fill_names(self, resources: list):
        """填充 ECS 实例名称，支持跨区域查询"""
        try:
            # 先从缓存中查找
            for r in resources:
                instance_id = r["instanceId"]
                if instance_id in _instance_cache:
                    r["instanceName"] = _instance_cache[instance_id][0]

            # 找出还没有名称的资源
            unfilled = [r for r in resources if r["instanceName"] == r["instanceId"]]
            if not unfilled:
                return

            # 获取所有可用区域
            try:
                regions_request = ecs_models.DescribeRegionsRequest()
                regions_response = self._client.describe_regions(regions_request)
                regions = [r.region_id for r in regions_response.body.regions.region] if regions_response.body.regions else []
            except Exception:
                regions = [self.region_id]

            # 遍历所有区域查询实例名称
            for region_id in regions:
                try:
                    config = open_api_models.Config(
                        access_key_id=self._config.access_key_id,
                        access_key_secret=self._config.access_key_secret,
                        region_id=region_id
                    )
                    client = EcsClient(config)

                    next_token = None
                    while True:
                        request = ecs_models.DescribeInstancesRequest(
                            region_id=region_id,
                            max_results=100
                        )
                        if next_token:
                            request.next_token = next_token

                        response = client.describe_instances(request)
                        if response.status_code == 200 and response.body:
                            instances = response.body.instances
                            if instances and instances.instance:
                                for inst in instances.instance:
                                    _instance_cache[inst.instance_id] = (inst.instance_name, region_id)

                            next_token = response.body.next_token
                            if not next_token:
                                break
                        else:
                            break
                except Exception as e:
                    logger.debug(f"查询区域 {region_id} 实例失败: {e}")
                    continue

            # 再次填充名称
            for r in resources:
                instance_id = r["instanceId"]
                if instance_id in _instance_cache:
                    r["instanceName"] = _instance_cache[instance_id][0]

        except Exception as e:
            logger.error(f"获取 ECS 实例名称失败: {e}")
