from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase._async.client import AsyncClient, create_client as async_create_client
from config import get_settings
import httpx

security = HTTPBearer()

_supabase: AsyncClient | None = None


async def get_supabase() -> AsyncClient:
    global _supabase
    if _supabase is None:
        cfg = get_settings()
        _supabase = await async_create_client(cfg.supabase_url, cfg.supabase_service_role_key)
    return _supabase


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    cfg = get_settings()
    try:
        # Call Supabase Auth REST API directly — Supabase validates the JWT itself
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{cfg.supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {credentials.credentials}",
                    "apikey": cfg.supabase_anon_key,
                },
            )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
        user_data = resp.json()
        user_id: str | None = user_data.get("id")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        is_admin = bool((user_data.get("user_metadata") or {}).get("is_admin", False))
        return {"user_id": user_id, "email": user_data.get("email"), "is_admin": is_admin}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


async def get_admin_user(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
