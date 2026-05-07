from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from routers.deps import get_current_user, get_supabase
from supabase._async.client import AsyncClient
import secrets

router = APIRouter()


class ReportCreate(BaseModel):
    period: str          # daily | weekly | monthly | pattern | tasks
    title: Optional[str] = None
    content: str
    email_count: int = 0
    is_shared: bool = False


class ReportOut(BaseModel):
    id: str
    period: str
    title: Optional[str]
    content: str
    email_count: int
    is_shared: bool
    share_token: Optional[str]
    created_at: str
    user_email: Optional[str] = None


@router.get("", response_model=list[ReportOut])
async def list_reports(
    user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase),
):
    res = await db.table("reports").select("*").eq("user_id", user["user_id"]).order("created_at", desc=True).limit(50).execute()
    return [ReportOut(**r) for r in (res.data or [])]


@router.post("", response_model=ReportOut, status_code=201)
async def create_report(
    payload: ReportCreate,
    user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase),
):
    data = payload.model_dump()
    data["user_id"] = user["user_id"]
    if payload.is_shared:
        data["share_token"] = secrets.token_urlsafe(16)
    try:
        res = await db.table("reports").insert(data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to save report")
        return ReportOut(**res.data[0])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{report_id}/share", response_model=ReportOut)
async def toggle_share(
    report_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase),
):
    res = await db.table("reports").select("*").eq("id", report_id).eq("user_id", user["user_id"]).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Report not found")
    report = res.data[0]
    is_shared = not report["is_shared"]
    update: dict = {"is_shared": is_shared}
    if is_shared and not report.get("share_token"):
        update["share_token"] = secrets.token_urlsafe(16)
    res2 = await db.table("reports").update(update).eq("id", report_id).execute()
    return ReportOut(**res2.data[0])


@router.get("/shared/{share_token}", response_model=ReportOut)
async def get_shared_report(
    share_token: str,
    db: AsyncClient = Depends(get_supabase),
):
    res = await db.table("reports").select("*").eq("share_token", share_token).eq("is_shared", True).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Report not found or not shared")
    return ReportOut(**res.data[0])


@router.delete("/{report_id}", status_code=204)
async def delete_report(
    report_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase),
):
    res = await db.table("reports").delete().eq("id", report_id).eq("user_id", user["user_id"]).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Report not found")
