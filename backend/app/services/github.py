import subprocess
import tempfile
import os
import httpx
from pathlib import Path


async def clone_repo(repo_full_name: str, commit_sha: str, github_token: str) -> str:
    """
    Shallow-clone a repo at a specific commit into a temp directory.
    Returns the path to the cloned directory. Caller must clean up.
    """
    tmp = tempfile.mkdtemp(prefix="codeguard_")
    clone_url = f"https://x-access-token:{github_token}@github.com/{repo_full_name}.git"

    subprocess.run(
        ["git", "clone", "--depth=1", clone_url, tmp],
        check=True,
        capture_output=True,
        timeout=120,
    )

    # Checkout exact commit if different from default branch HEAD
    try:
        subprocess.run(
            ["git", "fetch", "--depth=1", "origin", commit_sha],
            cwd=tmp, capture_output=True, timeout=60,
        )
        subprocess.run(
            ["git", "checkout", commit_sha],
            cwd=tmp, capture_output=True, timeout=30,
        )
    except Exception:
        pass  # stay on cloned HEAD if checkout fails

    return tmp


async def post_commit_status(
    repo_full_name: str,
    commit_sha: str,
    state: str,          # "success" | "failure" | "pending" | "error"
    description: str,
    github_token: str,
    context: str = "CodeGuard / quality-gate",
):
    """Post a GitHub commit status check."""
    async with httpx.AsyncClient() as client:
        await client.post(
            f"https://api.github.com/repos/{repo_full_name}/statuses/{commit_sha}",
            headers={
                "Authorization": f"Bearer {github_token}",
                "Accept": "application/vnd.github+json",
            },
            json={
                "state": state,
                "description": description,
                "context": context,
            },
        )
