from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    app_name: str = "阿里云巡检平台"
    app_version: str = "1.0.0"
    debug: bool = False
    database_url: str = "sqlite:///./inspection.db"
    encryption_key: str = ""
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

@lru_cache()
def get_settings() -> Settings:
    return Settings()
