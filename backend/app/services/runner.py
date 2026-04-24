import shutil
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.analysis import Analysis
from app.models.repo import Repo
from app.models.user import User
from app.services.analyser import run_pylint_on_dir
from app.services.github import clone_repo, post_commit_status


async def run_analysis(
    analysis_id: int,
    db: AsyncSession,
):
    """
    Background task: clone repo, run pylint, persist results, post GitHub status.
    """
    # Load analysis record
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        return

    # Load repo and user
    repo_result = await db.execute(select(Repo).where(Repo.id == analysis.repo_id))
    repo = repo_result.scalar_one_or_none()
    user_result = await db.execute(select(User).where(User.id == analysis.user_id))
    user = user_result.scalar_one_or_none()

    if not repo or not user:
        analysis.status = "error"
        analysis.error_message = "Repo or user not found"
        await db.commit()
        return

    analysis.status = "running"
    await db.commit()

    # Post pending status to GitHub
    await post_commit_status(
        repo.full_name, analysis.commit_sha,
        "pending", "CodeGuard analysis running…",
        user.access_token,
    )

    tmp_dir = None
    try:
        # Clone the repo
        tmp_dir = await clone_repo(repo.full_name, analysis.commit_sha, user.access_token)

        # Run pylint
        pylint_result = run_pylint_on_dir(tmp_dir)

        score = pylint_result["quality_score"]
        passed = score >= repo.quality_threshold

        analysis.quality_score = score
        analysis.passed_gate = passed
        analysis.file_results = pylint_result["file_results"]
        analysis.issue_counts = pylint_result["issue_counts"]
        analysis.summary = pylint_result["summary"]
        analysis.status = "done"
        analysis.completed_at = datetime.utcnow()

        # Post GitHub commit status
        gh_state = "success" if passed else "failure"
        gh_desc = f"Score {score}/10 — {'✓ Gate passed' if passed else f'✗ Below threshold ({repo.quality_threshold})'}"
        await post_commit_status(repo.full_name, analysis.commit_sha, gh_state, gh_desc, user.access_token)

    except Exception as e:
        analysis.status = "error"
        analysis.error_message = str(e)
        analysis.quality_score = 0.0
        await post_commit_status(
            repo.full_name, analysis.commit_sha, "error",
            f"CodeGuard error: {str(e)[:100]}", user.access_token,
        )
    finally:
        if tmp_dir:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        await db.commit()
