from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
import httpx

from ..database import get_db
from ..models import AdminUser

router = APIRouter()

async def get_github_user(authorization: str = Header(None)):
    """Validate GitHub token and return user info."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    async with httpx.AsyncClient() as client:
        resp = await client.get("https://api.github.com/user", headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
        })
        if resp.status_code != 200:
            return None
        return resp.json()

async def require_admin(authorization: str = Header(None), db: Session = Depends(get_db)):
    """Dependency that requires the user to be an admin."""
    user = await get_github_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    admin = db.query(AdminUser).filter(AdminUser.github_username == user["login"]).first()
    if not admin:
        raise HTTPException(status_code=403, detail="Not an admin")
    return {"user": user, "admin": admin}

@router.get("/me")
async def get_me(authorization: str = Header(None), db: Session = Depends(get_db)):
    """Get current user info + admin status."""
    user = await get_github_user(authorization)
    if not user:
        return {"authenticated": False, "is_admin": False}
    admin = db.query(AdminUser).filter(AdminUser.github_username == user["login"]).first()
    return {
        "authenticated": True,
        "login": user["login"],
        "name": user.get("name"),
        "avatar_url": user.get("avatar_url"),
        "is_admin": admin is not None,
        "role": admin.role if admin else None,
    }

@router.get("/github/callback")
async def github_callback(code: str):
    """Exchange GitHub OAuth code for access token."""
    async with httpx.AsyncClient() as client:
        resp = await client.post("https://github.com/login/oauth/access_token", json={
            "client_id": settings.github_client_id,
            "client_secret": settings.github_client_secret,
            "code": code,
        }, headers={"Accept": "application/json"})
    data = resp.json()
    token = data.get("access_token")
    if not token:
        return RedirectResponse(f"/?error={data.get('error', 'unknown')}")
    return RedirectResponse(f"/#access_token={token}&token_type=bearer")