from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase._async.client import AsyncClient, create_client as async_create_client
from config import get_settings

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
    db: AsyncClient = Depends(get_supabase),
) -> dict:
    try:
        # Supabase validates the JWT on their end — no local secret needed
        resp = await db.auth.get_user(credentials.credentials)
        user = resp.user
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        is_admin = bool((user.user_metadata or {}).get("is_admin", False))
        return {"user_id": user.id, "email": user.email, "is_admin": is_admin}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


async def get_admin_user(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
