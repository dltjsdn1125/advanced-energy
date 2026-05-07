# Advanced Energy — Catalogue 2026 Search

Searchable offline UI over the 150-page AE Embedded Power Catalogue 2026.
Built as a static Next.js app so the same build can run in the browser,
a local web server, or inside Electron without code changes.

## Repository layout

```
docs/         AE Catalogue2026.pdf       ← source PDF
scripts/                                 ← Python PDF → JSON pipeline
  inspect_pdf.py       Quick structure probe
  extract_all.py       pdfplumber → data/raw/pages.json (all 150 pages)
  parse_catalog.py     pages.json → data/catalog.json   (1.4k models)
data/
  raw/pages.json       Every page as text + words + tables (~7 MB)
  catalog.json         Flat model index used by the web app
  sections.json        Section → page-range map (from ToC)
app/                                     ← Next.js + Tailwind web app
  src/app/             Routes and global styles
  src/components/      Header / FilterRail / ResultList / DetailDrawer
  src/lib/             Types and data loader
  public/data/         catalog.json + sections.json (copied from /data)
  public/docs/         PDF copy so the app can deep-link into a page
  electron/            Main + preload for the Electron wrapper
```

## Data pipeline (once, or after the PDF changes)

```bash
cd "<repo root>"
python scripts/extract_all.py     # writes data/raw/pages.json
python scripts/parse_catalog.py   # writes data/catalog.json + sections.json
cp data/catalog.json data/sections.json app/public/data/
cp "docs/AE Catalogue2026.pdf"    app/public/docs/
```

Parser coverage today: **1,426 unique models across 53 sections**. Each
model carries category, subcategory, section, page references, wattage /
voltage / current tokens, full input range when present, and the raw
context lines it was mined from — searchable end-to-end.

## Web app (dev)

```bash
cd app
npm install
npm run dev
# http://localhost:3000
```

Key shortcuts: `Ctrl+K` / `Cmd+K` focuses the global search. `Esc`
closes the detail drawer.

## Static export (browser or Electron)

```bash
cd app
npm run build     # produces app/out/
# Any static host (GitHub Pages, S3, IIS, nginx) can serve app/out/
```

Because `next.config.mjs` sets `output: "export"`, `trailingSlash: true`
and `assetPrefix: "./"`, the `out/` folder is self-contained and loads
from `file://` — which is what makes the Electron path painless.

## Electron wrapper

```bash
cd app
npm install            # installs electron + builder from optionalDependencies
npm run electron:dev   # runs Next dev server + Electron in parallel
npm run electron:build # next build + electron-builder → installer in app/dist/
```

The wrapper (`electron/main.js`) loads `out/index.html` via
`win.loadFile(...)` in production. No preload wiring is needed yet —
the app is fully client-side. When you need native integration (e.g.
opening the PDF in the OS viewer, CSV export, direct filesystem scan),
expose it through `preload.js` + `contextBridge`.

### Packaging targets

`electron-builder` is configured ad-hoc in `package.json`. Add a
`"build"` block for NSIS (Windows), DMG (macOS), or AppImage (Linux).
Example minimum Windows config:

```json
"build": {
  "appId": "com.advancedenergy.catalogue",
  "productName": "AE Catalogue 2026",
  "files": ["electron/**", "out/**", "package.json"],
  "directories": { "output": "dist" },
  "win": { "target": "nsis" }
}
```

## What the parser does NOT do (yet)

- Doesn't resolve full multi-column spec tables — rows are reconstructed
  per line, which is search-friendly but not pivot-ready.
- Doesn't split variants at the SKU-suffix level (e.g. `GB30S05K01` vs
  `GB30S05C01`). Variants are listed as separate models but share the
  same section.
- Doesn't extract product images from the PDF. The UI uses a generic
  schematic thumb for every row; swap for real crops if you need them.

All three are solvable by enriching `scripts/parse_catalog.py` without
changing the app shape — the UI consumes only `catalog.json`.
