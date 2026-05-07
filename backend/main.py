from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import get_settings
from routers import settings, reports, catalogue

app = FastAPI(title="Advanced Energy Internal API", version="1.0.0")

cfg = get_settings()
ALLOWED_ORIGINS = [o.strip() for o in cfg.allowed_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(settings.router,  prefix="/settings",  tags=["settings"])
app.include_router(reports.router,   prefix="/reports",   tags=["reports"])
app.include_router(catalogue.router, prefix="/catalogue", tags=["catalogue"])


@app.get("/health")
async def health():
    return {"status": "ok"}
