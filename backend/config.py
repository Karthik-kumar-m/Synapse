import secrets
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/synapse"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    DEBUG: bool = True
    ALLOWED_ORIGINS: List[str] = ["*"]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
