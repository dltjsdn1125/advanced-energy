from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from .deps import get_admin_user, get_supabase

router = APIRouter()


class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str


class ResetPasswordRequest(BaseModel):
    password: str


@router.get("/users")
async def list_users(
    _admin=Depends(get_admin_user),
    sb=Depends(get_supabase),
):
    res = sb.auth.admin.list_users()
    users = [
        {
            "id": u.id,
            "email": u.email,
            "created_at": u.created_at,
            "last_sign_in_at": u.last_sign_in_at,
            "is_admin": bool((u.user_metadata or {}).get("is_admin", False)),
        }
        for u in res
    ]
    return users


@router.post("/users", status_code=201)
async def create_user(
    body: CreateUserRequest,
    _admin=Depends(get_admin_user),
    sb=Depends(get_supabase),
):
    try:
        res = sb.auth.admin.create_user(
            {"email": body.email, "password": body.password, "email_confirm": True}
        )
        u = res.user
        return {"id": u.id, "email": u.email}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    admin=Depends(get_admin_user),
    sb=Depends(get_supabase),
):
    if user_id == admin["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    try:
        sb.auth.admin.delete_user(user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/users/{user_id}/password")
async def reset_password(
    user_id: str,
    body: ResetPasswordRequest,
    _admin=Depends(get_admin_user),
    sb=Depends(get_supabase),
):
    try:
        sb.auth.admin.update_user_by_id(user_id, {"password": body.password})
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/users/{user_id}/admin")
async def toggle_admin(
    user_id: str,
    admin=Depends(get_admin_user),
    sb=Depends(get_supabase),
):
    if user_id == admin["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot modify own admin status")
    res = sb.auth.admin.get_user_by_id(user_id)
    current = bool((res.user.user_metadata or {}).get("is_admin", False))
    sb.auth.admin.update_user_by_id(user_id, {"user_metadata": {"is_admin": not current}})
    return {"is_admin": not current}
