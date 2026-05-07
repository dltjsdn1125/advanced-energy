"""Parse the extracted pages.json into structured catalogue data.

Goal: turn 150 pages of catalogue text into a searchable JSON index with
series, models, specifications and category metadata derived from the
table of contents.

Strategy:
1. Use the Table-of-Contents on page 2 to build (section-name, start-page,
   category) records.
2. For every page, classify it into its section by checking which ToC start
   page is the closest <= current page.
3. Collect all model-number-like tokens on each page using regex, keeping
   the full line of context so it is searchable even if column splitting
   is noisy.
4. Emit two JSON files:
     data/catalog.json      — the flat searchable index
     data/sections.json     — ordered section list with page ranges
"""

import io
import json
import re
import sys
from pathlib import Path
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "pages.json"
IMAGES_MANIFEST = ROOT / "data" / "raw" / "images.json"
OUT = ROOT / "data"

# --------------------------------------------------------------------------
# Table of Contents (manually transcribed from page 2 of the catalogue so we
# get an authoritative section->page map that survives any OCR-style noise).
# --------------------------------------------------------------------------
# (category, lineage, subcategory, section-title, start-page)
#
# "lineage" matches the Embedded Power Selector Guide taxonomy on page 4:
#   AC-DC -> MODULAR | BULK/DISTRIBUTED/ENCLOSED | RACKS | OPEN FRAME | FANLESS/CONDUCTION COOLED
#   DC-DC -> LOW VOLTAGE | HIGH VOLTAGE
# Sections in the ToC but not on the selector-guide layout (adapters,
# bench-programmable, DIN rail, healthcare) are mapped into the closest
# lineage so that every product rolls up to one of the five/two bins.
TOC = [
    # ---------- AC-DC OPEN FRAME ---------- (open-frame, enclosed, adapters)
    ("AC-DC", "OPEN FRAME", "Open Frame / Enclosed", "Open frame/enclosed 1 to 4 outputs", 10),
    ("AC-DC", "OPEN FRAME", "External Adapters", "External power adapters", 30),
    # ---------- AC-DC FANLESS / CONDUCTION COOLED ----------
    ("AC-DC", "FANLESS/CONDUCTION COOLED", "LCC", "LCC250 Series", 18),
    ("AC-DC", "FANLESS/CONDUCTION COOLED", "LCC", "LCC600 Series", 20),
    ("AC-DC", "FANLESS/CONDUCTION COOLED", "LCC", "LCC1200 Series", 22),
    ("AC-DC", "FANLESS/CONDUCTION COOLED", "CoolX", "CoolX®600 Series", 24),
    ("AC-DC", "FANLESS/CONDUCTION COOLED", "CoolX", "CoolX®1000 Series", 26),
    ("AC-DC", "FANLESS/CONDUCTION COOLED", "CS", "CS1000 Series", 28),
    # ---------- AC-DC MODULAR ----------
    ("AC-DC", "MODULAR", "Healthcare", "Healthcare 1 to 24 outputs", 37),
    ("AC-DC", "MODULAR", "UltiMod", "UltiMod Series", 46),
    ("AC-DC", "MODULAR", "iMP", "Intelligent Medium Power (iMP)", 48),
    ("AC-DC", "MODULAR", "μMP", "Micro Medium Power (μMP)", 52),
    ("AC-DC", "MODULAR", "CoolX 1800/3000", "CoolX®1800", 54),
    ("AC-DC", "MODULAR", "CoolX 1800/3000", "CoolX®3000", 56),
    ("AC-DC", "MODULAR", "FlexiCharge", "FlexiCharge (FC1500/2500/4000)", 58),
    ("AC-DC", "MODULAR", "NeoPower", "Next Generation NeoPower (NP)", 60),
    ("AC-DC", "MODULAR", "iVS", "Intelligent Medium-High Power (iVS)", 64),
    ("AC-DC", "MODULAR", "iHP", "Precision High Power System (iHP)", 68),
    ("AC-DC", "MODULAR", "iTS", "Intelligent Transfer Switch (iTS)", 72),
    # ---------- AC-DC BULK / DISTRIBUTED / ENCLOSED ----------
    ("AC-DC", "BULK/DISTRIBUTED/ENCLOSED", "LCM", "LCM Series", 74),
    ("AC-DC", "BULK/DISTRIBUTED/ENCLOSED", "TF", "TF Series", 84),
    ("AC-DC", "BULK/DISTRIBUTED/ENCLOSED", "FCM", "FCM10K/30K", 88),
    ("AC-DC", "BULK/DISTRIBUTED/ENCLOSED", "FCM", "FCM33K", 90),
    ("AC-DC", "BULK/DISTRIBUTED/ENCLOSED", "LumaDrive", "LumaDrive", 92),
    ("AC-DC", "BULK/DISTRIBUTED/ENCLOSED", "Xsolo", "Xsolo Series", 94),
    ("AC-DC", "BULK/DISTRIBUTED/ENCLOSED", "Distributed Front End", "Distributed power bulk front end", 96),
    ("AC-DC", "BENCH", "iLS", "iLS600 Series", 98),
    ("AC-DC", "BENCH", "iLS", "iLS1500 Series", 100),
    ("AC-DC", "BULK/DISTRIBUTED/ENCLOSED", "DS", "DS Series", 102),
    ("AC-DC", "BULK/DISTRIBUTED/ENCLOSED", "M-CRPS/CRPS", "M-CRPS/CRPS Series", 107),
    ("AC-DC", "BULK/DISTRIBUTED/ENCLOSED", "DIN Rail", "ADN Single & 3-phase", 116),
    # ---------- AC-DC RACKS ----------
    ("AC-DC", "RACKS", "Open Rack", "50 V, 18 kW, 1OU Open Rack Power Shelf", 110),
    ("AC-DC", "RACKS", "Open Rack", "50 V, 3 kW, Open Rack Rectifier", 111),
    ("AC-DC", "RACKS", "Open Rack HPR", "50 V, 33 kW, 1OU Open Rack HPR Power Shelf", 112),
    ("AC-DC", "RACKS", "Open Rack HPR", "50 V, 5.5 kW, Open Rack HPR Rectifier", 113),
    ("AC-DC", "RACKS", "EIA", "48 V, 30 kW, 2U EIA Power Shelf", 114),
    ("AC-DC", "RACKS", "EIA", "48 V, 3 kW, EIA Rectifier with ATS", 115),
    # ---------- DC-DC LOW VOLTAGE ----------
    ("DC-DC", "LOW VOLTAGE", "Quarter-Brick", "Quarter-Brick", 120),
    ("DC-DC", "LOW VOLTAGE", "Eighth-Brick", "Eighth-Brick", 121),
    ("DC-DC", "LOW VOLTAGE", "Sixteenth-Brick", "Sixteenth-Brick", 123),
    ("DC-DC", "LOW VOLTAGE", "RF Power Modules", "Radio Frequency Power Modules", 125),
    ("DC-DC", "LOW VOLTAGE", "Wide Input", "Wide Input Voltage", 126),
    ("DC-DC", "LOW VOLTAGE", "PSA", "Direct Conversion – PSA Series", 126),
    ("DC-DC", "LOW VOLTAGE", "C-Class", "C-Class", 127),
    ("DC-DC", "LOW VOLTAGE", "LGA", "LGA Series", 128),
    ("DC-DC", "LOW VOLTAGE", "Digital", "Digital DC-DC Converters", 130),
    ("DC-DC", "LOW VOLTAGE", "On-board 300V", "On-board AC-DC Distributed Architecture", 131),
    ("DC-DC", "LOW VOLTAGE", "PFC", "Power Factor Correction (PFC)", 132),
    ("DC-DC", "LOW VOLTAGE", "Full Brick 300V", "Full Brick AC-DC Converter", 133),
    ("DC-DC", "LOW VOLTAGE", "Low Power Isolated", "Low Power Isolated DC-DC", 134),
    ("DC-DC", "LOW VOLTAGE", "Railway", "DC-DC Converter for Railway Application", 141),
    ("DC-DC", "LOW VOLTAGE", "Medical", "DC-DC Converter for Medical Application", 143),
    # ---------- DC-DC HIGH VOLTAGE ----------
    ("DC-DC", "HIGH VOLTAGE", "Mission-Critical HV", "Mission-Critical High Voltage Solutions", 145),
]


def build_section_map(total_pages: int):
    """Return sections with explicit lineage + sub-family + start/end pages."""
    toc_sorted = sorted(TOC, key=lambda r: r[4])
    sections = []
    for idx, (cat, lineage, sub, sec, start) in enumerate(toc_sorted):
        end = (
            toc_sorted[idx + 1][4] - 1
            if idx + 1 < len(toc_sorted)
            else total_pages
        )
        sections.append({
            "category": cat,
            "lineage": lineage,
            "subcategory": sub,
            "section": sec,
            "startPage": start,
            "endPage": end,
        })
    return sections


def section_for_page(page: int, sections):
    for s in sections:
        if s["startPage"] <= page <= s["endPage"]:
            return s
    return None


# --------------------------------------------------------------------------
# Value extractors
# --------------------------------------------------------------------------
# Model-number heuristic: alphanumeric token with at least one digit, length
# >= 4, containing at least one letter, excluding pure page numbers. We also
# require at least one ALPHA-DIGIT transition so plain words/counts do not
# qualify.
MODEL_RE = re.compile(
    r"\b(?=[A-Za-z0-9\-/]*\d)(?=[A-Za-z0-9\-/]*[A-Za-z])[A-Z][A-Za-z0-9\-/]{3,30}\b"
)
# Wattage / voltage / current patterns for spec extraction from any line.
WATT_RE = re.compile(r"(\d{1,5}(?:\.\d+)?)\s?(k?W)\b", re.IGNORECASE)
VOLT_RE = re.compile(r"(\d{1,4}(?:\.\d+)?)\s?V(?:AC|DC)?\b")
AMP_RE = re.compile(r"(\d{1,4}(?:\.\d+)?)\s?A\b")
INPUT_RE = re.compile(r"(\d{1,3})\s?[–-]\s?(\d{1,4})\s?V(?:AC)?")

# Denylist of tokens that match MODEL_RE but are not products.
BLOCKLIST = {
    "advancedenergy.com",
    "MTBF",
    "IEC",
    "EN61000",
    "VAC",
    "VDC",
    "EIA",
    "IOU",
    "W1",
    "U1",
    "CRPS",
    "OU",
    "DC-DC",
    "AC-DC",
    "HPR",
    "PCB",
    "EMI",
    "EMC",
    "PFC",
    "RoHS",
    "USB",
}

SERIES_HINTS = [
    "Series", "Family", "Platform", "Module", "Rectifier", "Shelf",
    "Brick", "Adapter", "Converter", "Power Supply",
]


def extract_models_from_line(line: str):
    candidates = MODEL_RE.findall(line)
    result = []
    for c in candidates:
        if c in BLOCKLIST:
            continue
        if c.lower().endswith(".com"):
            continue
        if c.isdigit():
            continue
        # skip if fewer than 2 digits (reduces acronyms)
        if sum(ch.isdigit() for ch in c) < 2:
            continue
        result.append(c)
    return result


def load_images_by_page():
    """Return {page_no: [image_meta, ...]} sorted by area desc.

    Each image_meta keeps the fields needed for later matching
    (path, hash, bbox, area). Files on disk are the literal PDF rasters,
    so this is strictly fact-based — no synthesised thumbnails.
    """
    if not IMAGES_MANIFEST.exists():
        return {}
    records = json.loads(IMAGES_MANIFEST.read_text(encoding="utf-8"))
    by_page: dict[int, list] = defaultdict(list)
    for r in records:
        area = (r["x1"] - r["x0"]) * (r["y1"] - r["y0"])
        r["area"] = area
        by_page[r["page"]].append(r)
    for p in by_page:
        by_page[p].sort(key=lambda x: -x["area"])
    return by_page


def parse():
    pages = json.loads(RAW.read_text(encoding="utf-8"))
    images_by_page = load_images_by_page()
    total_pages = len(pages)
    sections = build_section_map(total_pages)

    # Enrich sections with an empty model bucket
    section_index = {(s["category"], s["subcategory"], s["section"]): s for s in sections}
    for s in sections:
        s["models"] = []
        s["lines"] = []  # sample lines for search / preview
        s["images"] = []  # {page, path, width, height, area}

    # Flat models across catalogue
    seen_models = {}
    models = []

    SKIP_PAGES = {1, 2, 3, 4, 5, 6, 7, 8, 9}  # cover, ToC, selector guide, introductions
    for p in pages:
        page_no = p["page"]
        if page_no in SKIP_PAGES:
            continue
        sec = section_for_page(page_no, sections)
        text = p.get("text", "") or ""
        for raw_line in text.split("\n"):
            line = raw_line.strip()
            if not line or len(line) < 3:
                continue
            candidates = extract_models_from_line(line)
            if sec:
                sec["lines"].append({"page": page_no, "text": line})
            for mn in candidates:
                key = mn.upper()
                if key in seen_models:
                    entry = seen_models[key]
                    entry["pages"].add(page_no)
                    if line not in entry["contextLines"]:
                        entry["contextLines"].append(line)
                    continue
                watts = [f"{v}{u.upper()}" for v, u in WATT_RE.findall(line)]
                volts = [f"{v}V" for v in VOLT_RE.findall(line)]
                amps = [f"{v}A" for v in AMP_RE.findall(line)]
                input_range = None
                m = INPUT_RE.search(line)
                if m:
                    input_range = f"{m.group(1)}-{m.group(2)} VAC"
                entry = {
                    "model": mn,
                    "modelKey": key,
                    "category": sec["category"] if sec else None,
                    "lineage": sec["lineage"] if sec else None,
                    "subcategory": sec["subcategory"] if sec else None,
                    "section": sec["section"] if sec else None,
                    "pages": {page_no},
                    "watts": watts,
                    "volts": volts,
                    "amps": amps,
                    "input": input_range,
                    "contextLines": [line],
                }
                seen_models[key] = entry
                models.append(entry)
                if sec:
                    sec["models"].append(mn)

    # Deduplicate section lines (keep first 300 per section, limit payload)
    for s in sections:
        dedup = {}
        for item in s["lines"]:
            key = (item["page"], item["text"])
            dedup[key] = item
        s["lines"] = list(dedup.values())[:400]
        s["models"] = sorted(set(s["models"]))

    # Convert sets to sorted lists
    for m in models:
        m["pages"] = sorted(m["pages"])

    # ------------------------------------------------------------------
    # Attach real PDF images to sections and models.
    # Fact-based rules: an image is only attached to a model if the image
    # is on one of the model's own pages. Section images are restricted
    # to pages inside the section's page range. No cross-section fallback,
    # no placeholder urls — UI uses a generic icon when no image exists.
    # ------------------------------------------------------------------
    def _image_summary(rec: dict) -> dict:
        return {
            "page": rec["page"],
            "path": rec["path"],
            "width": rec["width"],
            "height": rec["height"],
        }

    for s in sections:
        seen = set()
        collected = []
        for p in range(s["startPage"], s["endPage"] + 1):
            for rec in images_by_page.get(p, []):
                if rec["hash"] in seen:
                    continue
                seen.add(rec["hash"])
                collected.append(rec)
        # Biggest first — typically the hero product shot.
        collected.sort(key=lambda r: -r["area"])
        s["images"] = [_image_summary(r) for r in collected[:12]]

    # Build a section → hero image map so models whose spec tables spill
    # onto later pages still resolve to the real product shot of their
    # series. The hero is only taken from the same section's page range,
    # so attribution stays accurate.
    section_hero = {s["section"]: (s["images"][0]["path"] if s["images"] else None) for s in sections}

    for m in models:
        seen = set()
        collected = []
        for p in m["pages"]:
            for rec in images_by_page.get(p, []):
                if rec["hash"] in seen:
                    continue
                seen.add(rec["hash"])
                collected.append(rec)
        collected.sort(key=lambda r: -r["area"])
        m["images"] = [_image_summary(r) for r in collected[:6]]
        if m["images"]:
            m["primaryImage"] = m["images"][0]["path"]
            m["imageSource"] = "model-page"
        elif m["section"] and section_hero.get(m["section"]):
            m["primaryImage"] = section_hero[m["section"]]
            m["imageSource"] = "series-hero"
        else:
            m["primaryImage"] = None
            m["imageSource"] = None

    # Compose derived searchable text
    for m in models:
        bits = [
            m["model"],
            m.get("section") or "",
            m.get("lineage") or "",
            m.get("subcategory") or "",
            m.get("category") or "",
        ]
        bits.extend(m["watts"])
        bits.extend(m["volts"])
        if m["input"]:
            bits.append(m["input"])
        bits.extend(m["contextLines"][:3])
        m["searchText"] = " | ".join(b for b in bits if b)

    # Build an ordered lineage tree so the UI knows which lineage belongs
    # to which category and which sub-family names sit inside each lineage.
    lineage_order = {
        "AC-DC": [
            "MODULAR",
            "BULK/DISTRIBUTED/ENCLOSED",
            "RACKS",
            "OPEN FRAME",
            "FANLESS/CONDUCTION COOLED",
            "BENCH",
        ],
        "DC-DC": ["LOW VOLTAGE", "HIGH VOLTAGE"],
    }
    lineage_tree = []
    for cat, lineages in lineage_order.items():
        for lin in lineages:
            families = []
            for s in sections:
                if s["category"] == cat and s["lineage"] == lin:
                    if s["subcategory"] not in families:
                        families.append(s["subcategory"])
            lineage_tree.append({
                "category": cat,
                "lineage": lin,
                "families": families,
            })

    catalog = {
        "meta": {
            "sourcePdf": "AE Catalogue2026.pdf",
            "totalPages": total_pages,
            "sectionCount": len(sections),
            "modelCount": len(models),
        },
        "categories": ["AC-DC", "DC-DC"],
        "lineageTree": lineage_tree,
        "sections": sections,
        "models": models,
    }

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "catalog.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    (OUT / "sections.json").write_text(
        json.dumps(sections, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )

    # ---- Diagnostics
    print(f"sections: {len(sections)}")
    print(f"models unique: {len(models)}")
    counts_by_section = defaultdict(int)
    for m in models:
        counts_by_section[m["section"] or "(unknown)"] += 1
    for sec, n in sorted(counts_by_section.items(), key=lambda x: -x[1])[:15]:
        print(f"  {n:4d}  {sec}")
    print(f"wrote {OUT/'catalog.json'}")


if __name__ == "__main__":
    parse()
