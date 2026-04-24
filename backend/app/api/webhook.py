import hashlib
import hmac
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.database import get_db, AsyncSessionLocal
from app.models.repo import Repo
from app.models.analysis import Analysis
from app.services.runner import run_analysis

router = APIRouter()


def verify_signature(payload: bytes, signature: str) -> bool:
    expected = "sha256=" + hmac.new(
        settings.GITHUB_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/github")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    payload_bytes = await request.body()
    sig = request.headers.get("X-Hub-Signature-256", "")

    if not verify_signature(payload_bytes, sig):
        raise HTTPException(403, "Invalid webhook signature")

    event = request.headers.get("X-GitHub-Event", "")
    payload = await request.json()

    if event == "push":
        await _handle_push(payload, background_tasks, db)
    elif event == "pull_request":
        await _handle_pr(payload, background_tasks, db)

    return {"ok": True}


async def _handle_push(payload: dict, background_tasks: BackgroundTasks, db: AsyncSession):
    repo_gh_id = payload["repository"]["id"]
    commit_sha = payload.get("after", "")
    branch = payload.get("ref", "").replace("refs/heads/", "")
    commits = payload.get("commits", [])
    commit_msg = commits[0].get("message", "") if commits else ""
    author = payload.get("pusher", {}).get("name")

    if not commit_sha or commit_sha == "0" * 40:
        return  # deleted branch

    result = await db.execute(select(Repo).where(Repo.github_repo_id == repo_gh_id))
    repo = result.scalar_one_or_none()
    if not repo:
        return

    analysis = Analysis(
        repo_id=repo.id,
        user_id=repo.user_id,
        commit_sha=commit_sha,
        commit_message=commit_msg,
        branch=branch,
        author_login=author,
        trigger="push",
        status="pending",
        quality_score=0.0,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    background_tasks.add_task(_run_in_new_session, analysis.id)


async def _handle_pr(payload: dict, background_tasks: BackgroundTasks, db: AsyncSession):
    action = payload.get("action")
    if action not in ("opened", "synchronize"):
        return

    repo_gh_id = payload["repository"]["id"]
    pr = payload["pull_request"]
    commit_sha = pr["head"]["sha"]
    pr_number = pr["number"]
    branch = pr["head"]["ref"]
    author = pr["user"]["login"]

    result = await db.execute(select(Repo).where(Repo.github_repo_id == repo_gh_id))
    repo = result.scalar_one_or_none()
    if not repo:
        return

    analysis = Analysis(
        repo_id=repo.id,
        user_id=repo.user_id,
        commit_sha=commit_sha,
        commit_message=f"PR #{pr_number}: {pr.get('title','')}",
        branch=branch,
        author_login=author,
        pr_number=pr_number,
        trigger="pr",
        status="pending",
        quality_score=0.0,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    background_tasks.add_task(_run_in_new_session, analysis.id)


async def _run_in_new_session(analysis_id: int):
    """Run analysis in a fresh DB session (background task safe)."""
    async with AsyncSessionLocal() as session:
        await run_analysis(analysis_id, session)
