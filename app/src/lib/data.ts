import catalogJson from "../../public/data/catalog.json";
import specsJson from "../../public/data/specs.json";
import orderingJson from "../../public/data/ordering.json";
import type { Catalog, Model, OrderingIndex, OrderingTable, SpecIndex, Lineage } from "./types";

// ── 인증번호·표준코드 필터 ────────────────────────────────────────────────────
// PDF 추출 과정에서 규격·인증 번호(EN61000-3-2, IEC60601, MIL-STD-461 등)가
// 모델명으로 잘못 색인된다. 아래 패턴에 일치하면 실제 제품이 아닌 것으로 간주해
// 카탈로그에서 제외한다.
const CERT_PATTERN =
  /^(EN\d|IEC[\d]|MIL-STD|UL[\d\/]|CSA\d|ISO\d|CE\d{2}|Load\/|ES\d|IPC-\d|IP\d{2}|F\d{2}-|SEMI[\s-]|RS\d{3}|V[-\/]\d|W\/\d)/i;

// ── 유령 MODULAR 항목 필터 ────────────────────────────────────────────────────
// PDF의 Healthcare/Modular 섹션 표에서 참조(Reference)로 언급된 모델명이
// 독립 항목으로 잘못 색인되는 경우가 있다.
function buildGhostSet(models: Model[]): Set<string> {
  const nameSet = new Set(models.map((m) => m.model));
  const ghost = new Set<string>();
  for (const m of models) {
    if (m.lineage !== "MODULAR") continue;
    const base = m.model;
    const hasRealVariant = models.some(
      (x) =>
        x.model !== base &&
        x.model.startsWith(base) &&
        x.lineage !== "MODULAR",
    );
    if (hasRealVariant) ghost.add(base);
  }
  void nameSet;
  return ghost;
}

// ── RACKS 재분류 ─────────────────────────────────────────────────────────────
// PDF 추출기가 shelf/rack 제품들을 BULK/DISTRIBUTED/ENCLOSED 로 잘못 분류.
// "SHF"(Shelf) 접미사를 가진 모델 또는 알려진 rack 제품을 RACKS 로 재분류.
const KNOWN_RACK_MODELS = new Set([
  "HPR12K",
  "HPR12K-00",
  "HPR120K-00-001",
  "End/12",
]);

function reclassifyRackModels(models: Model[]): Model[] {
  return models.map((m) => {
    if (m.category !== "AC-DC") return m;
    if (m.lineage !== "BULK/DISTRIBUTED/ENCLOSED") return m;
    const isRack =
      KNOWN_RACK_MODELS.has(m.model) ||
      m.model.includes("SHF");
    if (!isRack) return m;
    return { ...m, lineage: "RACKS" as Lineage };
  });
}

// ── HIGH VOLTAGE 시리즈 합성 모델 ─────────────────────────────────────────────
// PDF 추출기가 시리즈 수준 항목(A, AA, LE, HVA, US 등)을 개별 모델로 색인하지
// 못했다. 카탈로그 섹션 lines 데이터를 기반으로 시리즈 대표 모델을 합성 추가.
function makeHvModel(
  partial: Pick<Model, "model" | "modelKey"> &
    Partial<Omit<Model, "model" | "modelKey">>,
): Model {
  return {
    category: "DC-DC",
    lineage: "HIGH VOLTAGE",
    subcategory: "Mission-Critical HV",
    section: "Mission-Critical High Voltage Solutions",
    pages: [145],
    watts: [],
    volts: [],
    amps: [],
    input: null,
    contextLines: [],
    searchText: "",
    images: [],
    primaryImage: null,
    imageSource: null,
    ...partial,
  };
}

const HV_SYNTHETIC_SERIES: Model[] = [
  makeHvModel({
    model: "A Series",
    modelKey: "hv-dc-a-series",
    watts: ["4W", "15W", "20W", "30W"],
    pages: [145],
    contextLines: [
      "A Series 62 V to 20 kV, 4–30 W, 12 V or 24 V input",
      "Configurable high voltage output, power and polarity",
      "0 to 5 VDC or 0 to 10 VDC analog interface",
    ],
    searchText:
      "A Series | Mission-Critical High Voltage Solutions | HIGH VOLTAGE | DC-DC | 62V 20kV high voltage configurable analog",
  }),
  makeHvModel({
    model: "AA Series",
    modelKey: "hv-dc-aa-series",
    watts: ["4W", "20W", "30W"],
    pages: [145],
    contextLines: [
      "AA Series 62 V to 6 kV, 4–30 W, 12 V or 24 V input",
      "Configurable high voltage output, power and polarity in common footprint",
      "Ripple performance as low as 100 ppm",
    ],
    searchText:
      "AA Series | Mission-Critical High Voltage Solutions | HIGH VOLTAGE | DC-DC | 62V 6kV configurable",
  }),
  makeHvModel({
    model: "C Series (HV)",
    modelKey: "hv-dc-c-series",
    watts: ["20W", "30W"],
    pages: [145],
    contextLines: [
      "C Series 125 V to 6 kV, 20–30 W, 24 V input",
      "Fast-rise charging power, limited overshoot less than 1%",
      "Configurable high voltage output, power and polarity",
    ],
    searchText:
      "C Series | Mission-Critical High Voltage Solutions | HIGH VOLTAGE | DC-DC | 125V 6kV charging fast-rise",
  }),
  makeHvModel({
    model: "High Power C",
    modelKey: "hv-dc-high-power-c",
    watts: ["60W", "125W", "250W"],
    pages: [146],
    contextLines: [
      "High Power C Series 125 V to 60 kV, 60–250 W, 24 V input",
      "High power-to-package size ratio, fast-rise charging power",
      "Full-featured analog interface: voltage/current controls and monitors",
    ],
    searchText:
      "High Power C Series | Mission-Critical High Voltage Solutions | HIGH VOLTAGE | DC-DC | 125V 60kV 60W 125W 250W",
  }),
  makeHvModel({
    model: "HVA",
    modelKey: "hv-dc-hva-series",
    watts: ["1W", "2W"],
    pages: [146],
    contextLines: [
      "HVA 1 kV to 20 kV, 1–2 W, 24 V input",
      "Full-range two- and four-quadrant output for bias, amplification or reversing",
      "Fast voltage slew rates and broad bandwidths up to 500 Hz",
    ],
    searchText:
      "HVA | Mission-Critical High Voltage Solutions | HIGH VOLTAGE | DC-DC | 1kV 20kV bipolar four-quadrant amplifier",
  }),
  makeHvModel({
    model: "LE Series",
    modelKey: "hv-dc-le-series",
    watts: ["4W", "15W", "20W", "30W"],
    pages: [146],
    contextLines: [
      "LE Series 1 kV to 30 kV, 4–30 W, 10 V or 24 V input",
      "Low ripple output, temperature coefficient 25 ppm/°C",
      "High voltage output control via differential analog inputs",
    ],
    searchText:
      "LE Series | Mission-Critical High Voltage Solutions | HIGH VOLTAGE | DC-DC | 1kV 30kV low ripple precision 25ppm",
  }),
  makeHvModel({
    model: "EFL Series",
    modelKey: "hv-dc-efl-series",
    watts: ["12W", "24W", "36W"],
    pages: [146],
    contextLines: [
      "EFL Series isolated up to 15 kV or 30 kV, 12–36 W, 12 V or 24 V input",
      "Precision analog control, linearity ±0.05%, 10 ppm temperature coefficient",
      "4 regulated floating LV power outputs, isolated digital and analog I/O",
    ],
    searchText:
      "EFL Series | Mission-Critical High Voltage Solutions | HIGH VOLTAGE | DC-DC | 15kV 30kV isolated floating precision",
  }),
  makeHvModel({
    model: "FL Series",
    modelKey: "hv-dc-fl-series",
    watts: ["12W", "24W"],
    pages: [146],
    contextLines: [
      "FL Series isolated up to 15 kV, 12–24 W, 12 V or 24 V input",
      "DC leakage current <10 nA, AC leakage capacitance <40 pF",
      "3 regulated floating LV power outputs, isolated digital and analog I/O",
    ],
    searchText:
      "FL Series | Mission-Critical High Voltage Solutions | HIGH VOLTAGE | DC-DC | 15kV isolated floating low leakage",
  }),
  makeHvModel({
    model: "D Series (HV)",
    modelKey: "hv-dc-d-series",
    watts: ["1W", "2W", "4W", "6W"],
    pages: [147],
    contextLines: [
      "D Series 1 kV to 6 kV, 1–6 W, 15 V or 24 V input, PCB-mountable",
      "High voltage control and monitoring accuracy better than 0.2%",
      "Analog interface with integral voltage control and monitors",
    ],
    searchText:
      "D Series | Mission-Critical High Voltage Solutions | HIGH VOLTAGE | DC-DC | 1kV 6kV PCB mount",
  }),
  makeHvModel({
    model: "M Series (HV)",
    modelKey: "hv-dc-m-series",
    watts: [],
    pages: [147],
    contextLines: [
      "M Series 600 V to 3 kV, 0.5–1 W, 12–24 V input, low profile lightweight PCB-mountable",
      "Wide selection of input and output voltage configurations",
      "Low output ripple, temperature coefficient, and line regulation",
    ],
    searchText:
      "M Series | Mission-Critical High Voltage Solutions | HIGH VOLTAGE | DC-DC | 600V 3kV PCB lightweight",
  }),
  makeHvModel({
    model: "US Series (HV)",
    modelKey: "hv-dc-us-series",
    watts: [],
    pages: [147],
    contextLines: [
      "US Series 200 V to 500 V, 100 mW, 5–12 V input",
      "Small, lightweight, PCB-mountable (5.8 cm³, 13 g)",
      "Integrated over-current and short circuit/arc protection",
    ],
    searchText:
      "US Series | Mission-Critical High Voltage Solutions | HIGH VOLTAGE | DC-DC | 200V 500V 100mW PCB ultra-miniature",
  }),
  makeHvModel({
    model: "V Series (HV)",
    modelKey: "hv-dc-v-series",
    watts: [],
    pages: [147],
    contextLines: [
      "V Series 600 V to 3 kV, 0.5–1 W, 12–24 V input, small-footprint lightweight PCB-mountable",
      "Analog interface with voltage control and voltage/current monitors",
    ],
    searchText:
      "V Series | Mission-Critical High Voltage Solutions | HIGH VOLTAGE | DC-DC | 600V 3kV PCB small",
  }),
  makeHvModel({
    model: "AEQ Series",
    modelKey: "hv-dc-aeq-series",
    watts: [],
    pages: [147],
    contextLines: [
      "AEQ Series up to ±300 VDC or 600 VDC, 500 mW, 5 V input, ultra-miniature 0.5 inch cube",
      "Adjustable dual polarity or floating/reversible output",
      "±1500 VDC isolation, ±0.05% linearity",
    ],
    searchText:
      "AEQ Series | Mission-Critical High Voltage Solutions | HIGH VOLTAGE | DC-DC | 300V 600V ultra-miniature isolated adjustable",
  }),
];

// ─────────────────────────────────────────────────────────────────────────────

const rawCatalog = catalogJson as unknown as Catalog;
const ghostSet = buildGhostSet(rawCatalog.models);

// 1) 인증번호·유령 항목 제거
const baseFiltered = rawCatalog.models.filter(
  (m) => !CERT_PATTERN.test(m.model) && !ghostSet.has(m.model),
);

// 2) RACKS 재분류 (BULK → RACKS for shelf/rack products)
const reclassified = reclassifyRackModels(baseFiltered);

// 3) HIGH VOLTAGE 합성 시리즈 추가 (중복 modelKey 방지)
const existingKeys = new Set(reclassified.map((m) => m.modelKey));
const hvToAdd = HV_SYNTHETIC_SERIES.filter((m) => !existingKeys.has(m.modelKey));

const filteredModels = [...reclassified, ...hvToAdd];

// 인증번호·유령 항목을 제외한 실제 제품만 담은 카탈로그를 내보낸다.
export const catalog: Catalog = {
  ...rawCatalog,
  models: filteredModels,
  meta: {
    ...rawCatalog.meta,
    modelCount: filteredModels.length,
  },
};

export const specIndex = specsJson as unknown as SpecIndex;
export const orderingIndex = orderingJson as unknown as OrderingIndex;

export function getCatalog(): Catalog {
  return catalog;
}

export function getSpecIndex(): SpecIndex {
  return specIndex;
}

export function getOrderingIndex(): OrderingIndex {
  return orderingIndex;
}

// Ordering tables relevant to a model
export function getOrderingTablesForModel(model: Model): OrderingTable[] {
  const out = new Map<number, OrderingTable>();
  const exactPages = orderingIndex.index[model.modelKey] ?? [];
  for (const p of exactPages) {
    const t = orderingIndex.tables.find((x) => x.page === p);
    if (t) out.set(p, t);
  }
  if (out.size === 0 && model.pages?.length) {
    const modelPageSet = new Set(model.pages);
    for (const t of orderingIndex.tables) {
      if (modelPageSet.has(t.page)) out.set(t.page, t);
    }
  }
  return [...out.values()].sort((a, b) => a.page - b.page);
}

// Resolve a catalog-manifest image path to a site-root absolute URL.
export function assetSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("/") || /^https?:\/\//i.test(path)) return path;
  return "/" + path;
}
