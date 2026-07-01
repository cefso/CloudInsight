import logging
from alibabacloud_rds20140815.client import Client as RdsClient
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_rds20140815 import models as rds_models

logger = logging.getLogger(__name__)


class RdsClientWrapper:
    def __init__(self, config: open_api_models.Config, region_id: str):
        self._client = RdsClient(config)
        self.region_id = region_id

    def fill_names(self, resources: list):
        """填充 RDS 实例名称"""
        try:
            request = rds_models.DescribeDBInstancesRequest(
                region_id=self.region_id
            )
            response = self._client.describe_dbinstances(request)
            if response.status_code == 200 and response.body:
                items = response.body.items
                if items and items.dbinstance:
                    name_map = {inst.dbinstance_id: inst.dbinstance_description for inst in items.dbinstance}
                    for r in resources:
                        r["instanceName"] = name_map.get(r["instanceId"], r["instanceId"])
        except Exception as e:
            logger.error(f"获取 RDS 实例名称失败: {e}")
