import logging
from sqlalchemy.orm import Session
from models.ai_config import AiConfig
from services.crypto import crypto_service

logger = logging.getLogger(__name__)

DEFAULT_CONFIGS = {
    "dashscope": {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-plus",
    },
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-4o",
    },
    "ollama": {
        "base_url": "http://localhost:11434/v1",
        "model": "llama3",
    },
}


class AiConfigService:
    def __init__(self, db: Session):
        self.db = db
        self.crypto = crypto_service

    def get_config(self) -> dict | None:
        config = self.db.query(AiConfig).first()
        if not config:
            return None
        return {
            "id": config.id,
            "provider": config.provider,
            "base_url": config.base_url,
            "api_key": "***" if config.api_key else None,
            "model": config.model,
            "max_tokens": config.max_tokens,
            "enabled": config.enabled,
        }

    def get_decrypted_config(self) -> dict | None:
        config = self.db.query(AiConfig).first()
        if not config:
            return None
        return {
            "id": config.id,
            "provider": config.provider,
            "base_url": config.base_url,
            "api_key": self.crypto.decrypt(config.api_key) if config.api_key else None,
            "model": config.model,
            "max_tokens": config.max_tokens,
            "enabled": config.enabled,
        }

    def update_config(self, data: dict) -> dict:
        config = self.db.query(AiConfig).first()
        if not config:
            config = AiConfig()
            self.db.add(config)

        if "provider" in data:
            config.provider = data["provider"]
        if "base_url" in data:
            config.base_url = data["base_url"]
        if "api_key" in data and data["api_key"] and data["api_key"] != "***":
            config.api_key = self.crypto.encrypt(data["api_key"])
        if "model" in data:
            config.model = data["model"]
        if "max_tokens" in data:
            config.max_tokens = data["max_tokens"]
        if "enabled" in data:
            config.enabled = data["enabled"]

        self.db.commit()
        self.db.refresh(config)
        return self.get_config()

    async def test_connection(self) -> dict:
        config = self.get_decrypted_config()
        if not config or not config.get("api_key"):
            return {"success": False, "message": "请先配置 API Key"}

        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(
                api_key=config["api_key"],
                base_url=config["base_url"],
            )
            response = await client.chat.completions.create(
                model=config["model"],
                messages=[{"role": "user", "content": "Hello"}],
                max_tokens=10,
            )
            return {"success": True, "message": f"连接成功，模型: {config['model']}"}
        except Exception as e:
            logger.error(f"AI 连接测试失败: {e}")
            return {"success": False, "message": f"连接失败: {str(e)}"}
