from sqlalchemy import Integer, String, Float, DateTime, ForeignKey, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from datetime import datetime

class Repo(Base):
    __tablename__ = "repos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    github_repo_id: Mapped[int] = mapped_column(Integer, unique=True)
    full_name: Mapped[str] = mapped_column(String)   # e.g. "alice/myproject"
    name: Mapped[str] = mapped_column(String)
    webhook_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    webhook_active: Mapped[bool] = mapped_column(Boolean, default=False)
    quality_threshold: Mapped[float] = mapped_column(Float, default=7.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
