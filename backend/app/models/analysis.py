from sqlalchemy import Integer, String, Float, DateTime, ForeignKey, Text, JSON, func
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from datetime import datetime
from typing import Any

class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repo_id: Mapped[int] = mapped_column(Integer, ForeignKey("repos.id"))
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))

    # Git context
    commit_sha: Mapped[str] = mapped_column(String)
    commit_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    branch: Mapped[str] = mapped_column(String, default="main")
    author_login: Mapped[str | None] = mapped_column(String, nullable=True)
    pr_number: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Results
    quality_score: Mapped[float] = mapped_column(Float)        # 0-10
    passed_gate: Mapped[bool] = mapped_column(default=False)
    trigger: Mapped[str] = mapped_column(String, default="manual")  # manual | push | pr

    # Detailed breakdown (JSON)
    file_results: Mapped[Any] = mapped_column(JSON, default=list)
    issue_counts: Mapped[Any] = mapped_column(JSON, default=dict)
    summary: Mapped[Any] = mapped_column(JSON, default=dict)

    status: Mapped[str] = mapped_column(String, default="pending")  # pending|running|done|error
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
