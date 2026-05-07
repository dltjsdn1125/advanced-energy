from fastapi import APIRouter, Query
from functools import lru_cache
from config import get_settings
import json, os

router = APIRouter()


@lru_cache(maxsize=1)
def _load_catalog() -> list[dict]:
    data_dir = get_settings().data_dir
    path = os.path.join(data_dir, "catalog.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else data.get("models", [])


@lru_cache(maxsize=1)
def _load_specs() -> dict:
    data_dir = get_settings().data_dir
    path = os.path.join(data_dir, "specs.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _load_ordering() -> dict:
    data_dir = get_settings().data_dir
    path = os.path.join(data_dir, "ordering.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@router.get("/products")
async def list_products(
    q: str = Query("", description="Full-text search"),
    category: str = Query("", description="AC-DC | DC-DC"),
    lineage: str = Query("", description="Product lineage"),
    subcategory: str = Query("", description="Product family"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    items = _load_catalog()
    if category:
        items = [m for m in items if m.get("category", "").lower() == category.lower()]
    if lineage:
        items = [m for m in items if m.get("lineage", "").lower() == lineage.lower()]
    if subcategory:
        items = [m for m in items if m.get("subcategory", "").lower() == subcategory.lower()]
    if q:
        q_lower = q.lower()
        terms = q_lower.split()
        def match(m: dict) -> bool:
            haystack = (m.get("searchText") or " ".join([
                m.get("model", ""), m.get("lineage", ""),
                m.get("subcategory", ""), m.get("section", ""),
            ])).lower()
            return all(t in haystack for t in terms)
        items = [m for m in items if match(m)]

    total = len(items)
    offset = (page - 1) * limit
    return {"total": total, "page": page, "limit": limit, "items": items[offset: offset + limit]}


@router.get("/products/{model_key}")
async def get_product(model_key: str):
    items = _load_catalog()
    for m in items:
        if m.get("modelKey") == model_key or m.get("model") == model_key:
            return m
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Product not found")


@router.get("/specs")
async def get_specs():
    return _load_specs()


@router.get("/ordering")
async def get_ordering():
    return _load_ordering()
