"""Extract every product image from the AE 2026 catalogue PDF.

No mockups, no synthesised artwork: each image is the actual raster pulled
from the PDF. For each image we record its page and bounding box so that
parse_catalog.py can later match it to the model(s) that sit nearest on
the same page.

Output:
    app/public/images/pNNN_iK.png    - raw PNG dumps per page/image index
    data/raw/images.json             - structured manifest [
        {"page": 10, "index": 0, "path": "images/p010_i0.png",
         "x0": ..., "y0": ..., "x1": ..., "y1": ..., "width": ..., "height": ...,
         "pageWidth": ..., "pageHeight": ...}
    ]

Heuristics (fact-based only):
  - Dedupe by raw bytes hash so repeated logos/frames are written once but
    still referenced from every page they appeared on.
  - Drop pixel-small (< 48x48) and page-wide decorative bars so generic
    headers/footers don't leak into the matcher.
  - Keep vector-style images untouched; we only store what is on the page.
"""

from __future__ import annotations

import hashlib
import io
import json
import sys
from pathlib import Path

import fitz  # PyMuPDF

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "docs" / "AE Catalogue2026.pdf"
OUT_IMAGES = ROOT / "app" / "public" / "images"
OUT_MANIFEST = ROOT / "data" / "raw" / "images.json"

MIN_W = 48
MIN_H = 48
# Anything taller/wider than 95% of the page is a banner/background — skip.
MAX_COVER = 0.95
# Pages 1–9 are cover / ToC / selector guide / intros.
SKIP_PAGES = set(range(1, 10))


def main() -> None:
    if not PDF.exists():
        raise SystemExit(f"PDF not found: {PDF}")

    OUT_IMAGES.mkdir(parents=True, exist_ok=True)
    OUT_MANIFEST.parent.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(PDF)
    manifest: list[dict] = []
    written_hashes: dict[str, str] = {}  # hash -> relative path

    kept = 0
    dropped_small = 0
    dropped_banner = 0

    for page_idx in range(doc.page_count):
        page_no = page_idx + 1
        if page_no in SKIP_PAGES:
            continue
        page = doc[page_idx]
        page_w, page_h = page.rect.width, page.rect.height

        # get_images(xref=True) gives structural refs; page.get_image_info()
        # additionally returns the bbox of each occurrence on the page.
        infos = page.get_image_info(xrefs=True)
        for local_idx, info in enumerate(infos):
            xref = info.get("xref", 0)
            if not xref:
                continue
            bbox = info.get("bbox")
            if not bbox:
                continue
            x0, y0, x1, y1 = bbox
            w_px, h_px = x1 - x0, y1 - y0

            if w_px < MIN_W or h_px < MIN_H:
                dropped_small += 1
                continue
            if w_px >= page_w * MAX_COVER and h_px >= page_h * MAX_COVER:
                dropped_banner += 1
                continue

            # Always render from the PAGE region, not the raw embedded
            # image. Raw PNGs from the PDF often carry transparency or a
            # baked black background (flattened from the PDF's composite);
            # rendering the clipped page region composites the image onto
            # the catalogue page's white paper, matching what the reader
            # sees in Acrobat.
            try:
                clip = fitz.Rect(x0, y0, x1, y1)
                rendered = page.get_pixmap(
                    clip=clip,
                    dpi=220,
                    colorspace=fitz.csRGB,
                    alpha=False,
                )
                data = rendered.tobytes("png")
                rendered = None
            except Exception:
                continue

            digest = hashlib.sha1(data).hexdigest()[:12]
            rel_path = written_hashes.get(digest)
            if rel_path is None:
                fname = f"p{page_no:03d}_i{local_idx}_{digest}.png"
                (OUT_IMAGES / fname).write_bytes(data)
                rel_path = f"images/{fname}"
                written_hashes[digest] = rel_path

            manifest.append({
                "page": page_no,
                "index": local_idx,
                "path": rel_path,
                "hash": digest,
                "x0": round(x0, 2),
                "y0": round(y0, 2),
                "x1": round(x1, 2),
                "y1": round(y1, 2),
                "width": round(w_px, 2),
                "height": round(h_px, 2),
                "pageWidth": round(page_w, 2),
                "pageHeight": round(page_h, 2),
            })
            kept += 1

    OUT_MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )

    print(f"pages processed       : {doc.page_count - len(SKIP_PAGES)}")
    print(f"image instances kept  : {kept}")
    print(f"unique image files    : {len(written_hashes)}")
    print(f"dropped (too small)   : {dropped_small}")
    print(f"dropped (banner/bg)   : {dropped_banner}")
    print(f"manifest              : {OUT_MANIFEST}")
    print(f"images dir            : {OUT_IMAGES}")


if __name__ == "__main__":
    main()
