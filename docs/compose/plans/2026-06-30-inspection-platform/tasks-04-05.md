# 后端服务任务 (Task 4-5)

---

## Task 4: 加密服务实现

**Covers:** S8

**Files:**
- Create: `backend/services/__init__.py`
- Create: `backend/services/crypto.py`

### Steps

- [ ] **Step 1: 创建 crypto.py**

```python
from cryptography.fernet import Fernet
from config import get_settings

settings = get_settings()


class CryptoService:
    def __init__(self):
        if not settings.encryption_key:
            self._key = Fernet.generate_key()
            print(f"警告: 未配置 ENCRYPTION_KEY，请在 .env 文件中设置")
            print(f"生成的密钥: {self._key.decode()}")
        else:
            self._key = settings.encryption_key.encode()
        self._fernet = Fernet(self._key)

    def encrypt(self, text: str) -> str:
        return self._fernet.encrypt(text.encode()).decode()

    def decrypt(self, encrypted_text: str) -> str:
        return self._fernet.decrypt(encrypted_text.encode()).decode()

    def mask_ak(self, ak: str) -> str:
        if len(ak) <= 10:
            return ak[:3] + "***"
        return ak[:6] + "***" + ak[-4:]


crypto_service = CryptoService()
```

- [ ] **Step 2: 创建 services/__init__.py**

```python
from services.crypto import crypto_service

__all__ = ["crypto_service"]
```

- [ ] **Step 3: 验证**

```bash
cd backend
python -c "
from services.crypto import crypto_service
encrypted = crypto_service.encrypt('test-secret')
print(f'加密: {encrypted}')
print(f'解密: {crypto_service.decrypt(encrypted)}')
print(f'脱敏: {crypto_service.mask_ak(\"LTAI5tXXXXXXXXXX\")}')
"
```

- [ ] **Step 4: Commit**

```bash
git add backend/services/
git commit -m "feat: 实现加密服务"
```

---

## Task 5: 阿里云客户端封装

**Covers:** S6

**Files:**
- Create: `backend/services/aliyun_client.py`

### Steps

- [ ] **Step 1: 创建 aliyun_client.py**

```python
from typing import Optional
from alibabacloud_cms20190101.client import Client as CmsClient
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_cms20190101 import models as cms_models


class AliyunClient:
    RESOURCE_METRICS = {
        "acs_ecs_dashboard": {
            "name": "ECS",
            "metrics": ["CPUUtilization", "memory_usedutilization", "disk_usage"],
        },
        "acs_rds_dashboard": {
            "name": "RDS",
            "metrics": ["CPUUsage", "MemoryUsage", "DiskUsage"],
        },
        "acs_slb_dashboard": {
            "name": "SLB",
            "metrics": ["InstanceActiveConnection", "InstanceNewConnection"],
        },
        "acs_oss_dashboard": {
            "name": "OSS",
            "metrics": ["InternetSend", "InternetRecv"],
        },
        "acs_kvstore_dashboard": {
            "name": "Redis",
            "metrics": ["StandardCpuUsage", "StandardMemoryUsage"],
        },
        "acs_nat_gateway": {
            "name": "NAT",
            "metrics": ["SessionActiveConnectionCount"],
        },
    }

    def __init__(self, access_key_id: str, access_key_secret: str, region_id: str = "cn-hangzhou"):
        self.region_id = region_id
        config = open_api_models.Config(
            access_key_id=access_key_id,
            access_key_secret=access_key_secret,
            region_id=region_id
        )
        self._client = CmsClient(config)

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
    ) -> Optional[float]:
        try:
            import json
            request = cms_models.DescribeMetricDataRequest(
                namespace=namespace,
                metric_name=metric_name,
                dimensions=json.dumps(dimensions),
                period=str(period)
            )
            response = self._client.describe_metric_data(request)
            if response.status_code == 200 and response.body:
                datapoints = response.body.datapoints
                if datapoints:
                    points = json.loads(datapoints)
                    if points:
                        return points[-1].get("Average", points[-1].get("Value"))
            return None
        except Exception as e:
            print(f"获取指标失败: {e}")
            return None

    def list_resources(self, namespace: str, page_number: int = 1, page_size: int = 50) -> list:
        try:
            request = cms_models.DescribeProjectMetaRequest(
                namespace=namespace,
                page_number=page_number,
                page_size=page_size
            )
            response = self._client.describe_project_meta(request)
            if response.status_code == 200 and response.body:
                resources = response.body.resources
                if resources:
                    import json
                    return json.loads(resources) if isinstance(resources, str) else resources
            return []
        except Exception as e:
            print(f"列出资源失败: {e}")
            return []


RESOURCE_TYPE_NAMES = {
    "acs_ecs_dashboard": "ECS",
    "acs_rds_dashboard": "RDS",
    "acs_slb_dashboard": "SLB",
    "acs_oss_dashboard": "OSS",
    "acs_kvstore_dashboard": "Redis",
    "acs_nat_gateway": "NAT",
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/aliyun_client.py
git commit -m "feat: 实现阿里云客户端封装"
```
