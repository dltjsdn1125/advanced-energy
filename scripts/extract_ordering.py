"""Extract all tables that constitute 'Ordering Information' from pages.json
into ordering.json.

A table qualifies if ANY of these hold:
  • It begins with an "Ordering Information" banner row.
  • The section page's text mentions "Ordering Information" AND the table has a
    Model-Number-style first-column header (Model Number, Part Number, P/N,
    Model #, Order Code, Model No., Type).
  • The table's first column header is a recognizable Model-Number variant
    (covers unnumbered tables where the "Ordering Information" label sits in
    prose above the table).

Output (data/ordering.json):
  {
    "meta": { tableCount, totalRows },
    "tables": [ { page, section, sectionCategory, sectionLineage,
                  title, headers[], rows[][], partNumbers[] } ],
    "index":  { partNumber: [pages...] }   # for quick per-model lookup
  }
"""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
APP_DATA = ROOT / "app" / "public" / "data"

MODEL_HDR_TOKENS = (
    "model number",
    "model no",
    "model #",
    "part number",
    "p/n",
    "order code",
    "ordering code",
    "type",
)

PART_NUMBER_RE = re.compile(r"^[A-Z][A-Z0-9]+(?:[-/][A-Z0-9]+)+$")


def _clean(v) -> str:
    if v is None:
        return ""
    return " ".join(str(v).split())


def _first_cell(row) -> str:
    if not row:
        return ""
    for c in row:
        c = _clean(c)
        if c:
            return c
    return ""


def _has_ordering_banner(tbl) -> bool:
    if not tbl:
        return False
    first = tbl[0]
    return any("Ordering Information" in (_clean(c)) for c in (first or []))


def _header_is_model_number(header_row) -> bool:
    if not header_row:
        return False
    for cell in header_row:
        t = _clean(cell).lower()
        if any(tok == t or tok in t for tok in MODEL_HDR_TOKENS):
            return True
    return False


def _looks_like_partnums(col_values) -> bool:
    """True if most values in this column look like SKU-style part numbers."""
    samples = [v for v in col_values[:10] if v]
    if not samples:
        return False
    hits = sum(1 for v in samples if PART_NUMBER_RE.match(v))
    return hits / len(samples) >= 0.6


def _pad(row, n):
    r = list(row) + [""] * (n - len(row))
    return [_clean(c) for c in r]


def _looks_like_subheader(row):
    cells = [_clean(c) for c in row]
    nonblank = [c for c in cells if c]
    if not nonblank:
        return True
    short = sum(1 for c in nonblank if len(c) <= 8)
    return short / max(1, len(nonblank)) > 0.6


def _split_table(tbl, has_banner: bool):
    """Return (title, headers, rows)."""
    ncols = max(len(r) for r in tbl)
    idx = 0
    title = None
    if has_banner:
        title = _first_cell(tbl[0])
        idx = 1

    remaining = [row for row in tbl[idx:] if any(_clean(c) for c in row)]
    if not remaining:
        return title, [], []

    # Header = first row
    hdr = _pad(remaining[0], ncols)
    data_start = 1
    # Optional sub-header (Min/Max)
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

    rows = []
    for r in remaining[data_start:]:
        r = _pad(r, ncols)
        # drop footnote rows (starts with digit or dagger and has no part number)
        fc = r[0]
        if fc and fc[:2].strip().isdigit() and not any("-" in c for c in r):
            continue
        if any(r):
            rows.append(r)

    return title, hdr, rows


def main() -> None:
    pages_path = DATA / "raw" / "pages.json"
    sections_path = DATA / "sections.json"
    out_path = DATA / "ordering.json"

    with pages_path.open("r", encoding="utf-8") as f:
        pages = json.load(f)
    with sections_path.open("r", encoding="utf-8") as f:
        sections = json.load(f)

    def lookup_section(pg_num):
        for s in sections:
            if s["startPage"] <= pg_num <= s["endPage"]:
                return s
        return None

    entries = []
    for pg in pages:
        page_num = pg["page"]
        text = pg.get("text", "") or ""
        ordering_text_on_page = "Ordering Information" in text
        for tbl in pg.get("tables") or []:
            if not tbl or not isinstance(tbl, list):
                continue
            has_banner = _has_ordering_banner(tbl)

            # Qualify
            title, hdr, rows = _split_table(tbl, has_banner)
            if not rows:
                continue

            # Reject tables with only 1 column
            if max(len(r) for r in rows) <= 1:
                continue

            hdr_is_model = _header_is_model_number(hdr)
            first_col = [r[0] for r in rows]
            col_is_parts = _looks_like_partnums(first_col)

            if not has_banner and not hdr_is_model and not col_is_parts:
                continue
            # If no banner, require one of: page mentions ordering, or first col
            # clearly contains SKUs, or header says Model Number. Otherwise skip.
            if not has_banner and not ordering_text_on_page and not col_is_parts:
                continue

            # Collect part numbers from first col — be permissive: any non-empty
            # cell that isn't a footnote marker (pure digit) counts.
            part_numbers = []
            for pn in first_col:
                if not pn:
                    continue
                head = pn.split()[0]
                if head.isdigit():
                    continue
                part_numbers.append(pn)

            section = lookup_section(page_num)
            entries.append({
                "page": page_num,
                "section": section["section"] if section else None,
                "sectionCategory": section["category"] if section else None,
                "sectionLineage": section["lineage"] if section else None,
                "title": title or "Ordering Information",
                "headers": hdr,
                "rows": rows,
                "partNumbers": part_numbers,
            })

    # Dedupe: if two tables have identical rows on same page, keep one
    seen = set()
    deduped = []
    for e in entries:
        key = (e["page"], tuple(tuple(r) for r in e["rows"]))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(e)
    entries = deduped

    # Index
    idx = {}
    for e in entries:
        for pn in e["partNumbers"]:
            if pn:
                idx.setdefault(pn, []).append(e["page"])

    payload = {
        "meta": {
            "tableCount": len(entries),
            "totalRows": sum(len(e["rows"]) for e in entries),
        },
        "tables": entries,
        "index": idx,
    }

    with out_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    APP_DATA.mkdir(parents=True, exist_ok=True)
    shutil.copy2(out_path, APP_DATA / out_path.name)

    print(
        f"ordering.json: {len(entries)} tables, {payload['meta']['totalRows']} rows, "
        f"{len(idx)} part numbers indexed"
    )


if __name__ == "__main__":
    main()
