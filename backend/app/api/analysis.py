from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.core.database import get_db, AsyncSessionLocal
from app.core.security import get_current_user
from app.models.user import User
from app.models.repo import Repo
from app.models.analysis import Analysis
from app.services.runner import run_analysis

router = APIRouter()

class ManualAnalysisRequest(BaseModel):
    repo_id: int
    branch: str = "main"
    commit_sha: str = "HEAD"

@router.post("/trigger")
async def trigger_analysis(
    req: ManualAnalysisRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger an analysis on a registered repo."""
    result = await db.execute(
        select(Repo).where(Repo.id == req.repo_id, Repo.user_id == user.id)
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(404, "Repo not found")

    # Resolve HEAD to actual SHA via GitHub API
    import httpx
    actual_sha = req.commit_sha
    if req.commit_sha == "HEAD":
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"https://api.github.com/repos/{repo.full_name}/commits/{req.branch}",
                headers={"Authorization": f"Bearer {user.access_token}"},
            )
            if r.status_code == 200:
                actual_sha = r.json()["sha"]

    analysis = Analysis(
        repo_id=repo.id,
        user_id=user.id,
        commit_sha=actual_sha,
        commit_message="Manual analysis",
        branch=req.branch,
        author_login=user.login,
        trigger="manual",
        status="pending",
        quality_score=0.0,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    background_tasks.add_task(_run_in_new_session, analysis.id)
    return {"analysis_id": analysis.id, "status": "queued"}


@router.get("/{analysis_id}")
async def get_analysis(
    analysis_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == user.id)
    )
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Analysis not found")

    return {
        "id": a.id,
        "repo_id": a.repo_id,
        "commit_sha": a.commit_sha,
        "commit_message": a.commit_message,
        "branch": a.branch,
        "author_login": a.author_login,
        "pr_number": a.pr_number,
        "quality_score": a.quality_score,
        "passed_gate": a.passed_gate,
        "trigger": a.trigger,
        "status": a.status,
        "error_message": a.error_message,
        "file_results": a.file_results,
        "issue_counts": a.issue_counts,
        "summary": a.summary,
        "created_at": a.created_at,
        "completed_at": a.completed_at,
    }


async def _run_in_new_session(analysis_id: int):
    async with AsyncSessionLocal() as session:
        await run_analysis(analysis_id, session)
