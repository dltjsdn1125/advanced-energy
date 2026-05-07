"""Dump per-page spec tables (Electrical/Environmental/Input/Output/etc.) from
pages.json. Produces page_tables.json:

{
  "tables": [
    { "page": 19,
      "title": "Electrical Specifications",      # banner row, if present
      "headers": [...],                          # first non-banner row
      "rows": [ [...], ... ] },
    ...
  ]
}

Ordering Information tables are skipped — they live in ordering.json.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
APP_DATA = ROOT / "app" / "public" / "data"

SKIP_IF_FIRST_CELL = {
    "Ordering Information",
}


def _clean(v):
    if v is None:
        return ""
    return " ".join(str(v).split())


def _first_cell(row):
    if not row or not isinstance(row, list):
        return ""
    for c in row:
        c = _clean(c)
        if c:
            return c
    return ""


def _is_banner(row, ncols):
    """Row where only the first cell has text — a section banner."""
    if not row:
        return False
    cleaned = [_clean(c) for c in row]
    if not cleaned[0]:
        return False
    return all(not c for c in cleaned[1:])


def _looks_like_subheader(row):
    """Heuristic: all non-blank cells are short tokens (Min/Max/Typ/Nom/etc.)."""
    cells = [_clean(c) for c in row]
    nonblank = [c for c in cells if c]
    if not nonblank:
        return True
    short = sum(1 for c in nonblank if len(c) <= 8)
    return short / max(1, len(nonblank)) > 0.6


def _pad(row, n):
    r = list(row) + [""] * (n - len(row))
    return [_clean(c) for c in r]


def main() -> None:
    pages_path = DATA / "raw" / "pages.json"
    sections_path = DATA / "sections.json"
    out = DATA / "page_tables.json"

    with pages_path.open("r", encoding="utf-8") as f:
        pages = json.load(f)
    with sections_path.open("r", encoding="utf-8") as f:
        sections = json.load(f)

    def lookup_section(pg):
        for s in sections:
            if s["startPage"] <= pg <= s["endPage"]:
                return s
        return None

    entries = []
    for pg in pages:
        page_num = pg["page"]
        for tbl in pg.get("tables") or []:
            if not tbl or not isinstance(tbl, list):
                continue
            ncols = max(len(r) for r in tbl)
            first_row = tbl[0]
            first_cell = _first_cell(first_row)
            if first_cell in SKIP_IF_FIRST_CELL:
                continue

            title = None
            start = 0
            # Banner row: only first cell populated
            if _is_banner(first_row, ncols):
                title = first_cell
                start = 1

            remaining = [row for row in tbl[start:] if any(_clean(c) for c in row)]
            if not remaining:
                continue

            # Primary header row = first remaining
            hdr = _pad(remaining[0], ncols)
            data_start = 1

            # If the second row looks like a sub-header (Min/Max), merge into headers
            if len(remaining) >= 2 and _looks_like_subheader(remaining[1]):
                sub = _pad(remaining[1], ncols)
                merged = []
                for a, b in zip(hdr, sub):
                    if a and b:
                        merged.append(f"{a} ({b})")
                    elif a:
                        merged.append(a)
                    else:
                        merged.append(b)
                hdr = merged
                data_start = 2

            rows = [ _pad(r, ncols) for r in remaining[data_start:] ]
            # Drop empty rows
            rows = [r for r in rows if any(r)]
            if not rows:
                continue

            # Drop single-column "footnote" tables that are just paragraphs
            if ncols <= 1:
                continue

            section = lookup_section(page_num)
            entries.append({
                "page": page_num,
                "title": title,
                "headers": hdr,
                "rows": rows,
                "section": section["section"] if section else None,
            })

    payload = {
        "meta": {
            "tableCount": len(entries),
            "totalRows": sum(len(e["rows"]) for e in entries),
        },
        "tables": entries,
    }

    with out.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    APP_DATA.mkdir(parents=True, exist_ok=True)
    shutil.copy2(out, APP_DATA / out.name)

    print(f"page_tables.json: {len(entries)} tables, {payload['meta']['totalRows']} rows")


if __name__ == "__main__":
    main()
