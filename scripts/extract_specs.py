"""Extract every table spec header + value from the catalogue.

Two table shapes show up in the AE 2026 catalogue:

1. Vertical spec tables (2 columns, "Label | Value")
     Electrical Specifications
       Input Range        | 90 to 264 VAC
       Frequency          | 47 to 63 Hz
       ...

2. Horizontal summary tables (headers on row 0 or 1, multiple data rows)
     | Output Power | Output V1 | V2 | ... | Model |
     | 12 W         | 5 V@2 A   | —  | ... | GB10S05K01 |

Both are treated uniformly as (spec_label, value, page, group) records,
where `group` is the nearest section header (e.g. "Electrical / Input").

Output:
  data/specs.json
    {
      "specs": [
        {
          "key": "input-range",
          "label": "Input Range",
          "group": "Electrical Specifications / Input",
          "valueCount": 37,
          "occurrenceCount": 51,
          "values": [
            {"value": "90 to 264 VAC", "count": 12, "pages": [18, 22, ...]}
          ]
        }, ...
      ],
      "groups": ["Electrical Specifications", "Environmental Specifications",
                 "Output", "Input", "Physical", "Summary"]
    }

Rules (fact-based only):
  - Values that are empty / dividers / page numbers are discarded.
  - A (label, value, page) triplet is deduped so one table row never
    inflates counts.
  - Labels are kept in their original capitalisation (first occurrence).
  - Numeric cell values are not coerced — the catalogue's exact string
    is preserved ("90 to 264 VAC" stays "90 to 264 VAC").
"""

from __future__ import annotations

import io
import json
import re
import sys
from collections import defaultdict, OrderedDict
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
PAGES = ROOT / "data" / "raw" / "pages.json"
OUT = ROOT / "data" / "specs.json"
SKIP_PAGES = set(range(1, 10))

# --- Label hygiene ---------------------------------------------------------

LABEL_BLOCKLIST = {
    "",
    "—",
    "-",
    "Model",
    "Models",
    "Notes",
    "Note",
    "Page",
    "Pages",
    "Figure",
}

VALUE_BLOCKLIST = {"", "—", "-", "•", "■"}

# A good spec label is short-ish prose. Hard cutoff to avoid sentences.
MAX_LABEL_LEN = 64

# Accepted section header cues (case-insensitive startswith / contains).
GROUP_HEADERS = [
    ("Electrical Specifications", "Electrical Specifications"),
    ("Environmental Specifications", "Environmental Specifications"),
    ("Mechanical Specifications", "Mechanical Specifications"),
    ("Physical Specifications", "Physical Specifications"),
    ("Safety and Compliance", "Safety & Compliance"),
    ("Safety & Compliance", "Safety & Compliance"),
    ("Safety", "Safety & Compliance"),
    ("Output Ratings", "Output"),
    ("Output", "Output"),
    ("Input", "Input"),
    ("General", "General"),
    ("Protection", "Protection"),
    ("Cooling", "Cooling"),
    ("Signals", "Signals"),
    ("Control & Status", "Control & Status"),
    ("Summary", "Summary"),
]


def norm_key(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")


def is_value_row(row: list[str]) -> bool:
    """Row with actual spec data (not a header banner)."""
    non_empty = [c for c in row if c.strip()]
    if len(non_empty) < 2:
        return False
    return True


def clean(cell) -> str:
    if cell is None:
        return ""
    s = str(cell).replace("\n", " ").strip()
    s = re.sub(r"\s{2,}", " ", s)
    return s


def looks_like_label(text: str) -> bool:
    """Left-column token is a spec label if it's short, starts with a letter,
    contains at least one letter, and isn't a value-looking token."""
    if not text:
        return False
    if text in LABEL_BLOCKLIST:
        return False
    if len(text) > MAX_LABEL_LEN:
        return False
    if not re.search(r"[A-Za-z]", text):
        return False
    # Pure numbers / measurements are values, not labels.
    if re.fullmatch(r"[\d.,\-\s/%+°µμΩΩA-Za-z]*\d[\d.,\-\s/%+°µμΩΩA-Za-z]*", text) and (
        text.count(" ") <= 1 and re.search(r"\d", text)
    ):
        # still allow if it starts with a letter and has a hyphen-word
        if not re.match(r"^[A-Za-z]", text):
            return False
    # Reject rows that are actually sentences.
    if text.endswith(".") and " " in text and len(text) > 40:
        return False
    return True


def detect_group(row_texts: list[str], running: str) -> str:
    for cell in row_texts:
        for cue, norm in GROUP_HEADERS:
            if cue.lower() in cell.lower() and len(cell) < 80:
                return norm
    return running


def parse_table(table: list[list[str]], page: int, recs: list):
    if not table:
        return
    rows = [[clean(c) for c in r] for r in table]
    # Find running group: scan for section-banner rows ("Electrical Specifications")
    running_group = "General"

    # Shape 1: vertical 2-col (many rows, most have just 2 non-empty cells
    # and col0 looks like a label)
    def is_two_col_vertical() -> bool:
        hits = 0
        for r in rows:
            non_empty = [c for c in r if c]
            if len(non_empty) == 2 and looks_like_label(r[0]) and r[-1]:
                hits += 1
        return hits >= max(3, len(rows) // 3)

    if is_two_col_vertical():
        for r in rows:
            non_empty = [c for c in r if c]
            if not non_empty:
                continue
            # Banner row (only 1 non-empty) may set the group
            if len(non_empty) == 1:
                running_group = detect_group([non_empty[0]], running_group)
                continue
            if len(non_empty) >= 2 and looks_like_label(r[0]):
                label = r[0]
                value = " ".join(c for c in r[1:] if c).strip()
                if value in VALUE_BLOCKLIST or not value:
                    continue
                recs.append({
                    "label": label,
                    "value": value,
                    "page": page,
                    "group": running_group,
                })
        return

    # Shape 2: horizontal summary table — headers on the first non-empty row
    # (or the first row that has more than one non-empty cell)
    header_idx = None
    for i, r in enumerate(rows):
        non_empty = [c for c in r if c]
        if len(non_empty) >= 2:
            header_idx = i
            break
    if header_idx is None:
        return
    headers = [clean(c) for c in rows[header_idx]]
    # Sometimes headers span two rows (e.g. "Output" / "V1 | V2 ...").
    if header_idx + 1 < len(rows):
        next_row = [clean(c) for c in rows[header_idx + 1]]
        # Merge where bottom cells are short tokens (V1, V2 …) and top is grouping.
        merged = []
        for a, b in zip(headers, next_row):
            if b and len(b) <= 6 and a:
                merged.append(f"{a} {b}".strip())
            else:
                merged.append(a or b)
        headers = merged
        data_start = header_idx + 2
    else:
        data_start = header_idx + 1

    # Drop empty header slots.
    headers = [h if h else f"col{i}" for i, h in enumerate(headers)]

    running_group = "Summary"
    for r in rows[data_start:]:
        non_empty = [c for c in r if c]
        if len(non_empty) <= 1:
            # Banner / subheader row — try to promote to a group.
            if non_empty:
                running_group = detect_group([non_empty[0]], running_group)
            continue
        for h, val in zip(headers, r):
            if not looks_like_label(h):
                continue
            if not val or val in VALUE_BLOCKLIST:
                continue
            if looks_like_label(val) and len(val) > 40:
                # Likely a label in a wrong column — skip.
                continue
            recs.append({
                "label": h,
                "value": val,
                "page": page,
                "group": running_group,
            })


def main() -> None:
    pages = json.loads(PAGES.read_text(encoding="utf-8"))

    records: list[dict] = []
    for p in pages:
        if p["page"] in SKIP_PAGES:
            continue
        for t in p.get("tables", []) or []:
            parse_table(t, p["page"], records)

    # Also scrape the free text for "Label : value" lines. This catches spec
    # callouts that pdfplumber couldn't box into a table.
    KV_RE = re.compile(r"^([A-Z][A-Za-z0-9 &/\-()]{3,40})\s*[:\uFF1A]\s*(.+)$")
    for p in pages:
        if p["page"] in SKIP_PAGES:
            continue
        for raw_line in (p.get("text") or "").split("\n"):
            line = raw_line.strip()
            if not line or len(line) > 180:
                continue
            m = KV_RE.match(line)
            if not m:
                continue
            label, value = m.group(1).strip(), m.group(2).strip()
            if not looks_like_label(label):
                continue
            if value in VALUE_BLOCKLIST:
                continue
            records.append({
                "label": label,
                "value": value,
                "page": p["page"],
                "group": "General",
            })

    # ----- dedupe + aggregate --------------------------------------------
    # Key by normalised label. Keep the *first* capitalisation we saw so the
    # UI shows the catalogue's original wording.
    label_meta: dict[str, dict] = {}
    # spec_key -> value_norm -> {"value", "pages": set(), "count": int}
    by_spec: dict[str, dict[str, dict]] = defaultdict(lambda: defaultdict(lambda: {"pages": set(), "count": 0, "value": ""}))
    # spec_key -> set of groups observed
    groups_of: dict[str, "OrderedDict[str, None]"] = defaultdict(OrderedDict)

    for r in records:
        label = r["label"].strip()
        value = r["value"].strip()
        if not label or not value:
            continue
        if len(value) > 240:
            continue
        key = norm_key(label)
        if not key or len(key) < 2:
            continue
        meta = label_meta.setdefault(key, {"label": label, "keyCount": 0})
        meta["keyCount"] += 1

        # dedupe a (spec, value, page) triple
        value_norm = value.lower()
        bucket = by_spec[key][value_norm]
        if not bucket["value"]:
            bucket["value"] = value
        bucket["pages"].add(r["page"])
        bucket["count"] += 1
        groups_of[key][r["group"]] = None

    # Keep only specs with at least 2 distinct values or 3 total occurrences —
    # avoids one-off labels that appear once with one value.
    specs_out = []
    for key, meta in label_meta.items():
        values = by_spec[key]
        distinct = len(values)
        total = sum(v["count"] for v in values.values())
        if distinct < 2 and total < 3:
            continue
        vals_sorted = sorted(
            values.values(), key=lambda v: (-v["count"], v["value"].lower())
        )
        specs_out.append({
            "key": key,
            "label": meta["label"],
            "groups": list(groups_of[key].keys()),
            "valueCount": distinct,
            "occurrenceCount": total,
            "values": [
                {
                    "value": v["value"],
                    "count": v["count"],
                    "pages": sorted(v["pages"]),
                }
                for v in vals_sorted[:400]
            ],
        })

    specs_out.sort(key=lambda s: (-s["occurrenceCount"], s["label"].lower()))

    # All distinct groups across the catalogue
    all_groups = []
    seen_g = set()
    for s in specs_out:
        for g in s["groups"]:
            if g not in seen_g:
                seen_g.add(g)
                all_groups.append(g)

    payload = {
        "meta": {
            "specCount": len(specs_out),
            "totalOccurrences": sum(s["occurrenceCount"] for s in specs_out),
            "source": "AE Catalogue2026.pdf",
        },
        "groups": all_groups,
        "specs": specs_out,
    }
    OUT.write_text(
        json.dumps(payload, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )

    print(f"unique spec labels  : {len(specs_out)}")
    print(f"total occurrences   : {payload['meta']['totalOccurrences']}")
    print(f"groups discovered   : {len(all_groups)}")
    print(f"wrote               : {OUT}")
    print()
    print("top 12 specs by occurrence:")
    for s in specs_out[:12]:
        print(f"  {s['occurrenceCount']:4d}  {s['label'][:40]:40s}  [{','.join(s['groups'][:2])[:24]}]  values={s['valueCount']}")


if __name__ == "__main__":
    main()
