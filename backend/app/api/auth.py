from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, get_current_user
from app.models.user import User

router = APIRouter()

GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"

@router.get("/login")
async def github_login():
    """Redirect user to GitHub OAuth."""
    params = (
        f"client_id={settings.GITHUB_CLIENT_ID}"
        f"&scope=repo,read:user"
        f"&redirect_uri={settings.FRONTEND_URL}/auth/callback"
    )
    return RedirectResponse(f"{GITHUB_AUTH_URL}?{params}")

@router.get("/callback")
async def github_callback(code: str, db: AsyncSession = Depends(get_db)):
    """Exchange GitHub code for access token, upsert user, return JWT."""
    async with httpx.AsyncClient() as client:
        # Exchange code for GitHub token
        token_resp = await client.post(
            GITHUB_TOKEN_URL,
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
            },
        )
        token_data = token_resp.json()
        gh_token = token_data.get("access_token")
        if not gh_token:
            raise HTTPException(400, "GitHub OAuth failed")

        # Fetch GitHub user profile
        user_resp = await client.get(
            GITHUB_USER_URL,
            headers={"Authorization": f"Bearer {gh_token}"},
        )
        gh_user = user_resp.json()

    # Upsert user in DB
    result = await db.execute(select(User).where(User.github_id == gh_user["id"]))
    user = result.scalar_one_or_none()

    if user:
        user.access_token = gh_token
        user.avatar_url = gh_user.get("avatar_url")
        user.name = gh_user.get("name")
    else:
        user = User(
            github_id=gh_user["id"],
            login=gh_user["login"],
            name=gh_user.get("name"),
            avatar_url=gh_user.get("avatar_url"),
            access_token=gh_token,
        )
        db.add(user)

    await db.commit()
    await db.refresh(user)

    jwt_token = create_access_token(user.id, user.login)
    return {"token": jwt_token, "user": {
        "id": user.id,
        "login": user.login,
        "name": user.name,
        "avatar_url": user.avatar_url,
    }}

@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "login": user.login,
        "name": user.name,
        "avatar_url": user.avatar_url,
        "quality_threshold": user.quality_threshold,
    }
