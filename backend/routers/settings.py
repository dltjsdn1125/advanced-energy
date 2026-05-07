from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from routers.deps import get_current_user, get_supabase
from supabase._async.client import AsyncClient

router = APIRouter()

CORE_FIELDS = {
    "openai_key", "telegram_token", "telegram_chat_id",
    "daily_start_time", "daily_end_time",
    "imap_host", "imap_port", "imap_ssl", "imap_user", "imap_pass",
    "smtp_host", "smtp_port", "smtp_ssl",
}

POP3_FIELDS = {"pop_host", "pop_port", "pop_ssl", "pop_user", "pop_pass", "pop_leave_on_server"}


class UserSettings(BaseModel):
    openai_key: str = ""
    telegram_token: str = ""
    telegram_chat_id: str = ""
    daily_start_time: str = "09:00"
    daily_end_time: str = "18:00"
    imap_host: str = ""
    imap_port: str = "993"
    imap_ssl: bool = True
    imap_user: str = ""
    imap_pass: str = ""
    smtp_host: str = ""
    smtp_port: str = "587"
    smtp_ssl: bool = True
    pop_host: str = ""
    pop_port: str = "995"
    pop_ssl: bool = True
    pop_user: str = ""
    pop_pass: str = ""
    pop_leave_on_server: bool = True


@router.get("", response_model=UserSettings)
async def get_settings(
    user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase),
):
    res = await db.table("user_settings").select("*").eq("user_id", user["user_id"]).execute()
    if not res.data:
        return UserSettings()
    row = res.data[0]
    return UserSettings(**{k: v for k, v in row.items() if k in UserSettings.model_fields})


@router.put("", response_model=UserSettings)
async def upsert_settings(
    payload: UserSettings,
    user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase),
):
    data = payload.model_dump()
    data["user_id"] = user["user_id"]
    try:
        res = await db.table("user_settings").upsert(data, on_conflict="user_id").execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to save settings")
        row = res.data[0]
        return UserSettings(**{k: v for k, v in row.items() if k in UserSettings.model_fields})
    except HTTPException:
        raise
    except Exception:
        # POP3 columns might not exist yet — retry with only core fields
        core_data = {k: v for k, v in data.items() if k not in POP3_FIELDS}
        try:
            res = await db.table("user_settings").upsert(core_data, on_conflict="user_id").execute()
            if not res.data:
                raise HTTPException(status_code=500, detail="Failed to save settings")
            row = res.data[0]
            return UserSettings(**{k: v for k, v in row.items() if k in UserSettings.model_fields})
        except Exception as e2:
            raise HTTPException(status_code=500, detail=str(e2))
