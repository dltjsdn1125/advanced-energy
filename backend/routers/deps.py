from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from supabase._async.client import AsyncClient, create_client as async_create_client
from functools import lru_cache
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
) -> dict:
    cfg = get_settings()
    try:
        payload = jwt.decode(
            credentials.credentials,
            cfg.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        user_id: str | None = payload.get("sub")
        email: str | None = payload.get("email")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user_metadata = payload.get("user_metadata", {}) or {}
        is_admin = bool(user_metadata.get("is_admin", False))
        return {"user_id": user_id, "email": email, "is_admin": is_admin}
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


async def get_admin_user(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
