import logging
from datetime import datetime, timezone
from alibabacloud_bssopenapi20171214.client import Client as BssClient
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_bssopenapi20171214 import models as bss_models

logger = logging.getLogger(__name__)


class BssClientWrapper:
    def __init__(self, config: open_api_models.Config):
        # BssOpenApi 使用固定 endpoint
        bss_config = open_api_models.Config(
            access_key_id=config.access_key_id,
            access_key_secret=config.access_key_secret,
            region_id='cn-hangzhou'
        )
        self._client = BssClient(bss_config)

    # 排除不需要关注到期的产品码
    EXCLUDED_PRODUCT_CODES = {'mpsofeware-mt9-dt41'}

    def get_expiring_instances(self, days_threshold: int = 15) -> list:
        """获取即将到期的实例列表"""
        try:
            now = datetime.now(timezone.utc)

            request = bss_models.QueryAvailableInstancesRequest(
                page_num=1,
                page_size=100
            )
            response = self._client.query_available_instances(request)

            if response.status_code != 200 or not response.body:
                return []

            data = response.body.data
            if not data or not data.instance_list:
                return []

            expiring = []
            for inst in data.instance_list:
                if not inst.end_time:
                    continue
                if inst.renew_status == 'NotRenewal':
                    continue
                # 排除指定产品码
                product_code = (inst.product_code or '').lower()
                if product_code in self.EXCLUDED_PRODUCT_CODES:
                    continue
                try:
                    end_time_str = inst.end_time.replace('Z', '+00:00')
                    end_time = datetime.fromisoformat(end_time_str)
                    days_remaining = (end_time - now).days

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
