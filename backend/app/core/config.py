from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # GitHub OAuth
    GITHUB_CLIENT_ID: str
    GITHUB_CLIENT_SECRET: str
    GITHUB_WEBHOOK_SECRET: str

    # App
    SECRET_KEY: str = "change-me-in-production"
    FRONTEND_URL: str = "http://localhost:3000"
    DATABASE_URL: str = "sqlite+aiosqlite:///./codeguard.db"

    # Quality Gate defaults
    DEFAULT_QUALITY_THRESHOLD: float = 7.0  # out of 10

    class Config:
        env_file = ".env"

settings = Settings()
