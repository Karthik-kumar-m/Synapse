import secrets
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/synapse"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    DEBUG: bool = True
    ALLOWED_ORIGINS: List[str] = ["*"]

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL_PRIMARY: str = "qwen2.5:7b"
    OLLAMA_MODEL_FALLBACK: str = "qwen2.5:3b"
    OLLAMA_TIMEOUT_SECONDS: float = 30.0
    OLLAMA_RETRY_COUNT: int = 1
    OLLAMA_ENABLE_EXTRACTION: bool = True
    OLLAMA_STRICT_JSON: bool = True
    OLLAMA_BATCH_SIZE: int = 3

    DEDUPE_SIMILARITY_THRESHOLD: float = 0.92
    DEDUPE_CANDIDATE_LIMIT: int = 200

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
