"""Extract every page of the catalogue to raw JSON (text + tables).

This is the source-of-truth extraction. The downstream parser works off this
JSON rather than re-opening the PDF, so the parse step can be iterated on
quickly.
"""
import io
import json
import sys
from pathlib import Path

import pdfplumber

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "docs" / "AE Catalogue2026.pdf"
OUT_DIR = ROOT / "data" / "raw"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def extract():
    pages_out = []
    with pdfplumber.open(PDF) as pdf:
        total = len(pdf.pages)
        for idx, page in enumerate(pdf.pages, start=1):
            text = page.extract_text(x_tolerance=2, y_tolerance=2) or ""
            # Try a finer extraction that preserves layout in multi-column pages.
            words = page.extract_words(
                x_tolerance=2, y_tolerance=2, keep_blank_chars=False
            )
            tables = []
            try:
                raw_tables = page.extract_tables() or []
                for t in raw_tables:
                    cleaned = [
                        [(c or "").strip() for c in row]
                        for row in t
                        if any((c or "").strip() for c in row)
                    ]
                    if cleaned:
                        tables.append(cleaned)
            except Exception as exc:  # noqa: BLE001
                tables = [[["__extract_error__", str(exc)]]]

            pages_out.append({
                "page": idx,
                "width": page.width,
                "height": page.height,
                "text": text,
                "words": [
                    {
                        "text": w["text"],
                        "x0": round(w["x0"], 1),
                        "x1": round(w["x1"], 1),
                        "top": round(w["top"], 1),
                        "bottom": round(w["bottom"], 1),
                    }
                    for w in words
                ],
                "tables": tables,
            })
            if idx % 10 == 0 or idx == total:
                print(f"extracted {idx}/{total}")

    out_file = OUT_DIR / "pages.json"
    out_file.write_text(
        json.dumps(pages_out, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print(f"wrote {out_file} ({out_file.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    extract()
