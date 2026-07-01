from typing import Optional
from alibabacloud_tea_openapi import models as open_api_models
from services.clients.cms_client import CmsClientWrapper
from services.clients.slb_client import SlbClientWrapper
from services.clients.bss_client import BssClientWrapper


RESOURCE_TYPE_NAMES = {
    "acs_ecs_dashboard": "ECS",
    "acs_rds_dashboard": "RDS",
    "acs_kvstore": "Redis",
    "slb": "SLB",
}


class AliyunClient:
    RESOURCE_METRICS = CmsClientWrapper.RESOURCE_METRICS

    def __init__(self, access_key_id: str, access_key_secret: str, region_id: str = "cn-hangzhou"):
        self.region_id = region_id
        config = open_api_models.Config(
            access_key_id=access_key_id,
            access_key_secret=access_key_secret,
            region_id=region_id
        )
        self._cms = CmsClientWrapper(config, region_id)
        self._slb = SlbClientWrapper(config, region_id)
        self._bss = BssClientWrapper(config)

    def test_connection(self) -> dict:
        return self._cms.test_connection()

    def get_metric_data(
        self,
        namespace: str,
        metric_name: str,
        dimensions: list[dict],
        period: int = 60
    ) -> dict:
        return self._cms.get_metric_data(namespace, metric_name, dimensions, period)

    def list_resources(self, namespace: str, metric_name: str = None) -> list:
        return self._cms.list_resources(namespace, metric_name)

    def list_slb_instances(self) -> list:
        return self._slb.list_instances()

    def get_slb_listeners(self, load_balancer_id: str) -> list:
        return self._slb.get_listeners(load_balancer_id)

    def get_slb_health_status(self, load_balancer_id: str) -> list:
        return self._slb.get_health_status(load_balancer_id)

    def get_expiring_instances(self, days_threshold: int = 15) -> list:
        return self._bss.get_expiring_instances(days_threshold)

    def get_system_events(self, hours: int = 24, level: str = None) -> list:
        return self._cms.get_system_events(hours, level)
