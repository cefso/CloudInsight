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
            key_str = self._key.decode()
            # 将生成的密钥写入 .env 文件以确保持久化
            env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
            try:
                lines = []
                if os.path.exists(env_path):
                    with open(env_path, "r") as f:
                        lines = f.readlines()
                # 检查是否已有 ENCRYPTION_KEY 配置
                has_key = any(line.startswith("ENCRYPTION_KEY=") for line in lines)
                if not has_key:
                    with open(env_path, "a") as f:
                        if lines and not lines[-1].endswith("\n"):
                            f.write("\n")
                        f.write(f"ENCRYPTION_KEY={key_str}\n")
                    logger.warning("未配置 ENCRYPTION_KEY，已自动生成并写入 .env 文件")
                else:
                    logger.warning("未配置 ENCRYPTION_KEY，已自动生成（临时密钥，重启后失效）")
            except Exception as e:
                logger.warning(f"未配置 ENCRYPTION_KEY，已自动生成（写入 .env 失败: {e}，重启后密钥将丢失）")
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
