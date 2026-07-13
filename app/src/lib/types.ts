export type Category = "AC-DC" | "DC-DC";

// ── 제조 브랜드 (raw data/ 의 브랜드 로고 PDF 제목 기준) ────────────────────────
// Advanced Energy 가 인수·통합한 서브 브랜드. 카탈로그의 각 제품은 시리즈명 규칙
// 으로 아래 브랜드 중 하나로 분류된다 (data.ts 의 classifyBrand 참고).
export type Brand =
  | "Artesyn"
  | "SL Power"
  | "Excelsys"
  | "UltraVolt"
  | "HiTek"
  | "Trek"
  | "Tegam"
  | "Impac";

// 사이드바 브랜드 버튼 노출 순서. raw data/ PDF 8종과 1:1 대응.
export const BRANDS: Brand[] = [
  "Artesyn",
  "SL Power",
  "Excelsys",
  "UltraVolt",
  "HiTek",
  "Trek",
  "Tegam",
  "Impac",
];

export type AcDcLineage =
  | "MODULAR"
  | "BULK/DISTRIBUTED/ENCLOSED"
  | "RACKS"
  | "OPEN FRAME"
  | "FANLESS/CONDUCTION COOLED"
  | "BENCH"
  | "ADAPTERS"
  | "SPECIAL";

export type DcDcLineage = "LOW VOLTAGE" | "HIGH VOLTAGE";

export type Lineage = AcDcLineage | DcDcLineage;

export interface CatalogImage {
  page: number;
  path: string; // relative to /public, e.g. "images/p010_i1_hash.png"
  width: number;
  height: number;
}

export interface Section {
  category: Category;
  lineage: Lineage;
  subcategory: string;
  section: string;
  startPage: number;
  endPage: number;
  models: string[];
  lines: { page: number; text: string }[];
  images: CatalogImage[];
}

export interface Model {
  model: string;
  modelKey: string;
  category: Category | null;
  lineage: Lineage | null;
  /** 제조 브랜드 — data.ts 의 classifyBrand 로 부여. 미분류 시 null. */
  brand: Brand | null;
  subcategory: string | null;
  section: string | null;
  pages: number[];
  watts: string[];
  /** Output voltage strings, e.g. "12V", "24V". Same as outputVolts; kept for back-compat. */
  volts: string[];
  outputVolts: string[];
  amps: string[];
  /** Pre-formatted input range string, e.g. "90-264 VAC", or null. */
  input: string | null;
  inputVoltageMin: number | null;
  inputVoltageMax: number | null;
  inputType: "AC" | "DC" | null;
  /** Python parser 가 카탈로그 텍스트에서 미리 뽑은 (한국어 라벨 → 원본 값) */
  specMap?: Record<string, string>;
  contextLines: string[];
  searchText: string;
  images: CatalogImage[];
  primaryImage: string | null;
  imageSource: "model-page" | "series-hero" | null;
}

export interface LineageNode {
  category: Category;
  lineage: Lineage;
  families: string[];
}

export interface Catalog {
  meta: {
    sourcePdf: string;
    totalPages: number;
    sectionCount: number;
    modelCount: number;
  };
  categories: Category[];
  lineageTree: LineageNode[];
  sections: Section[];
  models: Model[];
}

// Ordering used wherever lineages are rendered.
export const LINEAGE_ORDER: Record<Category, Lineage[]> = {
  "AC-DC": [
    "MODULAR",
    "BULK/DISTRIBUTED/ENCLOSED",
    "RACKS",
    "OPEN FRAME",
    "BENCH",
    "FANLESS/CONDUCTION COOLED",
    "ADAPTERS",
    "SPECIAL",
  ],
  "DC-DC": ["LOW VOLTAGE", "HIGH VOLTAGE"],
};

// -------- Spec facets (for /search) ---------------------------------------

export interface SpecValue {
  value: string;
  count: number;
  pages: number[];
}

export interface Spec {
  key: string;
  label: string;
  groups: string[]; // e.g. ["Electrical Specifications", "Input"]
  valueCount: number;
  occurrenceCount: number;
  values: SpecValue[];
}

export interface SpecIndex {
  meta: {
    specCount: number;
    totalOccurrences: number;
    source: string;
  };
  groups: string[];
  specs: Spec[];
}

// -------- Ordering Information (/public/data/ordering.json) ---------------

export interface OrderingTable {
  page: number;
  section: string | null;
  sectionCategory: Category | null;
  sectionLineage: Lineage | null;
  headers: string[];
  rows: string[][];
  partNumbers: string[];
}

export interface OrderingIndex {
  meta: {
    tableCount: number;
    totalRows: number;
  };
  tables: OrderingTable[];
  // model-key -> page numbers where an ordering table contains that part number
  index: Record<string, number[]>;
}

export interface PowerBucket {
  id: string;
  label: string;
  minW: number;
  maxW: number; // exclusive
}

export const POWER_BUCKETS: PowerBucket[] = [
  { id: "lt100", label: "< 100 W", minW: 0, maxW: 100 },
  { id: "100-500", label: "100 – 500 W", minW: 100, maxW: 500 },
  { id: "500-1k", label: "500 – 1000 W", minW: 500, maxW: 1000 },
  { id: "1k-3k", label: "1 – 3 kW", minW: 1000, maxW: 3000 },
  { id: "3k-30k", label: "3 – 30 kW", minW: 3000, maxW: 30_000 },
  { id: "gt30k", label: "> 30 kW", minW: 30_000, maxW: Number.POSITIVE_INFINITY },
];

export function wattageNumber(watts: string[]): number | null {
  if (!watts.length) return null;
  let best = 0;
  for (const w of watts) {
    const m = w.match(/^([\d.]+)(K?W)$/i);
    if (!m) continue;
    const v = parseFloat(m[1]);
    const mul = m[2].toUpperCase() === "KW" ? 1000 : 1;
    const abs = v * mul;
    if (abs > best) best = abs;
  }
  return best > 0 ? best : null;
}
