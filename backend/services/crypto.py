import logging
import os
from cryptography.fernet import Fernet
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class CryptoService:
    def __init__(self):
        if not settings.encryption_key:
            self._key = Fernet.generate_key()
            logger.warning(
                "未配置 ENCRYPTION_KEY，已自动生成临时密钥（重启后失效）。"
                "请在 .env 文件中设置 ENCRYPTION_KEY 以确保持久化。"
            )
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
