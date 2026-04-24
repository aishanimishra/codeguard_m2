from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.repo import Repo
from app.models.analysis import Analysis
from pydantic import BaseModel

router = APIRouter()

class RegisterRepoRequest(BaseModel):
    repo_full_name: str  # "owner/repo"
    quality_threshold: float = 7.0

class UpdateThresholdRequest(BaseModel):
    quality_threshold: float

@router.get("/github")
async def list_github_repos(user: User = Depends(get_current_user)):
    """Return all GitHub repos the user has access to."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.github.com/user/repos",
            headers={"Authorization": f"Bearer {user.access_token}"},
            params={"sort": "updated", "per_page": 50, "type": "all"},
        )
        repos = resp.json()
    return [
        {
            "id": r["id"],
            "full_name": r["full_name"],
            "name": r["name"],
            "private": r["private"],
            "language": r.get("language"),
            "updated_at": r.get("updated_at"),
        }
        for r in repos if isinstance(r, dict)
    ]

@router.get("/registered")
async def list_registered_repos(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Repo).where(Repo.user_id == user.id))
    repos = result.scalars().all()
    return [
        {
            "id": r.id,
            "full_name": r.full_name,
            "name": r.name,
            "webhook_active": r.webhook_active,
            "quality_threshold": r.quality_threshold,
            "created_at": r.created_at,
        }
        for r in repos
    ]

@router.post("/register")
async def register_repo(
    req: RegisterRepoRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a repo and install a GitHub webhook on it."""
    # Fetch repo info from GitHub
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{req.repo_full_name}",
            headers={"Authorization": f"Bearer {user.access_token}"},
        )
        if resp.status_code != 200:
            raise HTTPException(404, "Repo not found on GitHub")
        gh_repo = resp.json()

        # Install webhook
        webhook_url = f"{settings.FRONTEND_URL.replace('3000', '8000')}/api/webhook/github"
        wh_resp = await client.post(
            f"https://api.github.com/repos/{req.repo_full_name}/hooks",
            headers={"Authorization": f"Bearer {user.access_token}"},
            json={
                "name": "web",
                "active": True,
                "events": ["push", "pull_request"],
                "config": {
                    "url": webhook_url,
                    "content_type": "json",
                    "secret": settings.GITHUB_WEBHOOK_SECRET,
                },
            },
        )
        webhook_id = wh_resp.json().get("id") if wh_resp.status_code == 201 else None

    # Upsert repo in DB
    result = await db.execute(select(Repo).where(Repo.github_repo_id == gh_repo["id"]))
    repo = result.scalar_one_or_none()
    if repo:
        repo.webhook_id = webhook_id
        repo.webhook_active = webhook_id is not None
        repo.quality_threshold = req.quality_threshold
    else:
        repo = Repo(
            user_id=user.id,
            github_repo_id=gh_repo["id"],
            full_name=gh_repo["full_name"],
            name=gh_repo["name"],
            webhook_id=webhook_id,
            webhook_active=webhook_id is not None,
            quality_threshold=req.quality_threshold,
        )
        db.add(repo)

    await db.commit()
    await db.refresh(repo)
    return {"message": "Repo registered", "webhook_active": repo.webhook_active, "repo_id": repo.id}

@router.patch("/{repo_id}/threshold")
async def update_threshold(
    repo_id: int,
    req: UpdateThresholdRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Repo).where(Repo.id == repo_id, Repo.user_id == user.id)
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(404, "Repo not found")
    repo.quality_threshold = req.quality_threshold
    await db.commit()
    return {"message": "Threshold updated"}

@router.get("/{repo_id}/analyses")
async def repo_analyses(
    repo_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Analysis)
        .where(Analysis.repo_id == repo_id, Analysis.user_id == user.id)
        .order_by(Analysis.created_at.desc())
        .limit(50)
    )
    analyses = result.scalars().all()
    return [
        {
            "id": a.id,
            "commit_sha": a.commit_sha[:7],
            "commit_message": a.commit_message,
            "branch": a.branch,
            "author_login": a.author_login,
            "quality_score": a.quality_score,
            "passed_gate": a.passed_gate,
            "trigger": a.trigger,
            "status": a.status,
            "pr_number": a.pr_number,
            "issue_counts": a.issue_counts,
            "created_at": a.created_at,
        }
        for a in analyses
    ]
