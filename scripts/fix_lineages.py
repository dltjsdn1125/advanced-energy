"""Reclassify mis-tagged sections and propagate to catalog.json.

Changes:
  - "External power adapters" (p30-36): OPEN FRAME -> ADAPTERS
  - "ADN Single & 3-phase" (p116-119): BULK/DISTRIBUTED/ENCLOSED -> SPECIAL

Updates sections.json, catalog.json (sections + models + lineageTree),
and copies both to app/public/data/.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
APP_DATA = ROOT / "app" / "public" / "data"


REMAPS = {
    "External power adapters": "ADAPTERS",
    "ADN Single & 3-phase": "SPECIAL",
}


def main() -> None:
    sections_path = DATA / "sections.json"
    catalog_path = DATA / "catalog.json"

    with sections_path.open("r", encoding="utf-8") as f:
        sections = json.load(f)
    with catalog_path.open("r", encoding="utf-8") as f:
        catalog = json.load(f)

    moved_model_keys: dict[str, str] = {}  # modelKey -> new lineage

    # 1. sections.json
    for s in sections:
        if s["section"] in REMAPS:
            new = REMAPS[s["section"]]
            print(f"  section '{s['section']}' p{s['startPage']}-{s['endPage']}: "
                  f"{s['lineage']} -> {new}")
            s["lineage"] = new
            for mk in s["models"]:
                moved_model_keys[mk] = new

    # 2. catalog.json sections mirror
    for cs in catalog.get("sections", []):
        if cs.get("section") in REMAPS:
            cs["lineage"] = REMAPS[cs["section"]]

    # 3. Propagate to each model
    n_models_updated = 0
    for m in catalog["models"]:
        mk = m.get("modelKey")
        if mk in moved_model_keys:
            m["lineage"] = moved_model_keys[mk]
            # Rebuild searchText to reflect new lineage
            parts = [
                m.get("model") or "",
                m.get("section") or "",
                m.get("lineage") or "",
                m.get("subcategory") or "",
                m.get("category") or "",
                *m.get("contextLines", [])[:3],
            ]
            m["searchText"] = " | ".join(p for p in parts if p)
            n_models_updated += 1
    print(f"  models updated: {n_models_updated}")

    # 4. Rebuild lineageTree
    from collections import defaultdict

    tree: dict[tuple[str, str], set[str]] = defaultdict(set)
    for m in catalog["models"]:
        cat = m.get("category")
        lin = m.get("lineage")
        fam = m.get("subcategory")
        if cat and lin:
            tree[(cat, lin)].add(fam or "")
    catalog["lineageTree"] = [
        {"category": cat, "lineage": lin, "families": sorted(f for f in fams if f)}
        for (cat, lin), fams in sorted(tree.items())
    ]

    # Write back
    with sections_path.open("w", encoding="utf-8") as f:
        json.dump(sections, f, ensure_ascii=False, indent=1)
    with catalog_path.open("w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=1)

    # Mirror into app/public/data
    APP_DATA.mkdir(parents=True, exist_ok=True)
    shutil.copy2(sections_path, APP_DATA / sections_path.name)
    shutil.copy2(catalog_path, APP_DATA / catalog_path.name)

    # Summary
    from collections import Counter
    cat_lin = Counter((m.get("category"), m.get("lineage")) for m in catalog["models"])
    print("\ncategory x lineage (post-fix):")
    for (c, l), n in sorted(cat_lin.items()):
        print(f"  {c:6}  {l:28}  {n}")


if __name__ == "__main__":
    main()
