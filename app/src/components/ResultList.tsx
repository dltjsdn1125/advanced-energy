"use client";

import type { Brand, Model } from "@/lib/types";
import { BRAND_LOGO } from "@/lib/types";
import { assetSrc } from "@/lib/data";

// 카드의 벤더 표시 — 로고가 있으면 텍스트 대신 로고를, 모든 브랜드가 동일한 크기
// 박스(h-4 × w-16) 안에서 object-contain 으로(늘림 없이) 표시한다. 로고가 없는
// 브랜드(SL Power·Tegam)는 작은 텍스트로 폴백.
function BrandTag({ brand }: { brand: Brand | null | undefined }) {
  if (!brand) return null;
  const logo = BRAND_LOGO[brand];
  if (logo) {
    return (
      <span className="inline-flex h-4 w-16 items-center justify-end">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          alt={brand}
          loading="lazy"
          className="max-h-full max-w-full object-contain"
        />
      </span>
    );
  }
  return <span className="mono text-[11px] text-ink-500">{brand}</span>;
}

interface Props {
  items: Model[];
  view: "list" | "grid";
  onOpen: (m: Model) => void;
  highlightedId?: string | null;
}

function ThumbIcon({ active }: { active?: boolean }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className="h-3/4 w-3/4 shrink-0"
      aria-hidden
    >
      <rect
        x="4"
        y="8"
        width="32"
        height="24"
        rx="4"
        fill={active ? "#000000" : "#FFFFFF"}
        stroke="#000000"
        strokeWidth="1.5"
      />
      <path
        d="M10 20h5l2-4 4 8 2-4h7"
        stroke={active ? "#C6F24A" : "#000000"}
        strokeWidth="1.6"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="30" cy="14" r="1.2" fill={active ? "#C6F24A" : "#000000"} />
    </svg>
  );
}

function Thumb({ m, active }: { m: Model; active?: boolean }) {
  // Prefer the consistent AE web image; fall back to the PDF-extracted local one.
  const imgPath = m.webImage ?? m.primaryImage;
  if (!imgPath) {
    return (
      <div className="grid h-28 w-28 shrink-0 place-items-center rounded-md border border-ink-200 bg-white">
        <ThumbIcon active={active} />
      </div>
    );
  }
  return (
    <div
      className={`grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-md border bg-white p-1.5 ${
        active ? "border-lime" : "border-ink-200"
      }`}
    >
      {/* Native img to avoid next/image config on static export. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={assetSrc(imgPath)}
        alt={m.model}
        loading="lazy"
        className="h-full w-full object-contain"
      />
    </div>
  );
}

function wattsLabel(watts: string[]): string {
  if (!watts.length) return "";
  if (watts.length === 1) return watts[0];
  return `${watts[0]}-${watts[watts.length - 1]}`;
}

const DASH = "—";

function clean(s: string | undefined | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

// PDF 추출이 구조화 필드로 못 옮긴 값이 자주 남아있는 원본 텍스트 (예: DC-DC
// 모듈의 "4.5 to 10 VDC 3.3 V @ 0.6 A (14 x 14 x 8) 79%"). 라벨 폴백에서 파싱한다.
function specText(m: Model): string {
  return `${(m.contextLines ?? []).join(" ")} ${m.searchText ?? ""}`;
}

// ── 카드 공통 스펙 해석 ────────────────────────────────────────────────────────
// 카드마다 데이터 밀도가 달라 표시가 제각각이던 문제를 없애기 위해, 모든 카드가
// 동일한 4개 필드(입력·출력·전력·인증)를 같은 순서로 표시한다. 각 값은
// 구조화 필드 → specMap → 원본 텍스트 순으로 최선을 고르고, 없으면 "—".

function inputLabel(m: Model): string {
  if (m.input) return clean(m.input);
  const s = m.specMap ?? {};
  if (s["입력 전압 범위"]) return clean(s["입력 전압 범위"]);
  const lo = clean(s["Minimum Input Voltage (V)"]);
  const hi = clean(s["Maximum Input Voltage (V)"]);
  const suffix = m.inputType ? ` V${m.inputType}` : " V";
  if (lo && hi) return `${lo}–${hi}${suffix}`;
  if (m.inputVoltageMin != null && m.inputVoltageMax != null)
    return `${m.inputVoltageMin}–${m.inputVoltageMax}${suffix}`;
  // fallback: 원본 텍스트에서 입력 전압 범위 파싱 (예: "4.5 to 10 VDC")
  const r = specText(m).match(
    /(\d+(?:\.\d+)?)\s*(?:to|~|–|-)\s*(\d+(?:\.\d+)?)\s*V\s*(AC|DC)?/i,
  );
  if (r) return `${r[1]}–${r[2]} V${(r[3] ?? "").toUpperCase()}`.trim();
  return DASH;
}

function outputLabel(m: Model): string {
  if (m.outputVolts?.length) {
    const shown = m.outputVolts.slice(0, 3).join(" / ");
    return m.outputVolts.length > 3 ? `${shown} …` : shown;
  }
  const s = m.specMap ?? {};
  if (s["Output Voltage Range (V)"]) return clean(s["Output Voltage Range (V)"]);
  // fallback: "±?N V @ I A" 형태에서 출력 전압 파싱
  const o = specText(m).match(/(±?\d+(?:\.\d+)?)\s*V\s*@\s*[\d.]+\s*A/i);
  if (o) return `${o[1]}V`;
  return DASH;
}

function powerLabel(m: Model): string {
  const wl = wattsLabel(m.watts);
  if (wl) return wl;
  const s = m.specMap ?? {};
  const p = clean(s["Maximum Output Power (W)"] || s["Output Power (W)"]);
  if (p) return `${p} W`;
  const t = specText(m);
  // 명시된 와트값
  const w = t.match(/(\d+(?:\.\d+)?)\s*(k?W)\b/i);
  if (w) return `${w[1]}${w[2].toUpperCase()}`;
  // DC-DC 모듈: 출력전압 × 출력전류 로 전력 산출 (예: 3.3V @ 0.6A → 2 W)
  const vn = parseFloat((m.outputVolts?.[0] ?? "").replace(/[^\d.]/g, ""));
  const cm = t.match(/V\s*@\s*([\d.]+)\s*A\b/i);
  if (Number.isFinite(vn) && vn > 0 && cm) {
    const watts = vn * parseFloat(cm[1]);
    if (watts > 0) return watts < 1 ? `${watts.toFixed(1)} W` : `${Math.round(watts)} W`;
  }
  return DASH;
}

// 인증은 데이터가 희소해(≈14%) 원본 텍스트에서 표준/마크 토큰을 추출해 정규화한다.
function certLabel(m: Model): string {
  const s = m.specMap ?? {};
  const text = [m.searchText ?? "", ...(m.contextLines ?? []), ...Object.values(s)].join("  ");
  const out: string[] = [];
  const add = (v: string) => {
    if (!out.includes(v)) out.push(v);
  };
  if (/\b60601\b/.test(text)) add("IEC 60601");
  if (/\b62368\b/.test(text)) add("IEC 62368");
  if (/\b60950\b/.test(text)) add("IEC 60950");
  if (/\b61010\b/.test(text)) add("IEC 61010");
  if (/\bEN\s?550(?:3[02]|22)\b/i.test(text)) add("EN 55032");
  if (/\bUL\b/.test(text)) add("UL");
  if (/\bCSA\b/.test(text)) add("CSA");
  if (/\bCB\b/.test(text)) add("CB");
  if (/\bT[UÜ]V\b/i.test(text)) add("TÜV");
  if (/\bVDE\b/.test(text)) add("VDE");
  if (/\bCE\b/.test(text)) add("CE");
  if (/\bFCC\b/.test(text)) add("FCC");
  if (/\bRoHS\b/i.test(text)) add("RoHS");
  return out.length ? out.slice(0, 3).join(" · ") : DASH;
}

// ── 공통 추가 스펙 (밀도 보강용) ──────────────────────────────────────────────
function currentLabel(m: Model): string {
  if (m.amps?.length) return m.amps.slice(0, 2).join(" / ");
  const s = m.specMap ?? {};
  const c = clean(s["Maximum Output Current (A)"] || s["최대 출력 전류"]);
  if (c) return `${c} A`;
  // fallback: "N V @ I A" 에서 출력 전류 파싱
  const cm = specText(m).match(/V\s*@\s*([\d.]+)\s*A\b/i);
  return cm ? `${cm[1]} A` : DASH;
}

function efficiencyLabel(m: Model): string {
  const s = m.specMap ?? {};
  const e = clean(s["효율"] || s["Efficiency"]);
  if (!e) return DASH;
  const pct = e.match(/(\d{2,3}(?:\.\d+)?)\s*%/);
  if (pct) return `${pct[1]}%`;
  const bare = e.match(/^(\d{2,3}(?:\.\d+)?)$/);
  return bare ? `${bare[1]}%` : e.length <= 8 ? e : DASH;
}

function freqLabel(m: Model): string {
  const s = m.specMap ?? {};
  const f = clean(s["입력 주파수"] || s["Input Frequency"] || s["주파수"]);
  if (!f) return DASH;
  const range = f.match(/(\d+)\s*(?:to|-|~|–|—)\s*(\d+)/i);
  if (range) return `${range[1]}-${range[2]} Hz`;
  const one = f.match(/(\d+)\s*Hz/i);
  return one ? `${one[1]} Hz` : f.length <= 10 ? f : DASH;
}

// 치수는 항상 mm 로만 표시한다. 소스가 인치면 ×25.4 변환, mm 병기가 있으면
// 그 값을 사용. 헤더/오추출 문자열("… Model", 효율값 등)은 치수가 아니므로 제외.
function dimLabel(m: Model): string {
  const s = m.specMap ?? {};
  const mm3 = (a: number, b: number, c: number) =>
    `${Math.round(a)} × ${Math.round(b)} × ${Math.round(c)} mm`;

  // 1) 깨끗한 인치 L/W/H 필드 → mm 변환
  const L = parseFloat(clean(s["Length (Inches)"]));
  const W = parseFloat(clean(s["Width (Inches)"]));
  const H = parseFloat(clean(s["Height (Inches)"]));
  if ([L, W, H].every((x) => Number.isFinite(x) && x > 0)) {
    return mm3(L * 25.4, W * 25.4, H * 25.4);
  }

  // 2) 자유 텍스트 "크기"
  const raw = clean(s["크기"] || s["Dimensions"] || s["Size"]);
  if (!raw || /model|typical|%|V:|W x L x H/i.test(raw)) return DASH;

  // 2a) 괄호 안 mm 병기값 (예: "… (44 mm) … (224 mm) … (262 mm)")
  const mm = [...raw.matchAll(/([\d.]+)\s*mm/gi)]
    .map((x) => parseFloat(x[1]))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (mm.length >= 3) return mm3(mm[0], mm[1], mm[2]);

  // 2b) 삼중값 "a x b x c" (+ 단위 판별)
  const t = raw.match(/([\d.]+)\s*[x×]\s*([\d.]+)\s*[x×]\s*([\d.]+)/i);
  if (t) {
    const a = parseFloat(t[1]);
    const b = parseFloat(t[2]);
    const c = parseFloat(t[3]);
    if ([a, b, c].every((x) => Number.isFinite(x) && x > 0)) {
      const isMm = /\bmm\b/i.test(raw) && !/\bin\b|inch|"/i.test(raw);
      const f = isMm ? 1 : 25.4;
      return mm3(a * f, b * f, c * f);
    }
  }
  return DASH;
}

// ── 카드 스펙 정의 ────────────────────────────────────────────────────────────
// 각 스펙은 짧은 텍스트 라벨 + 값으로 표시한다 (SVG 아이콘 미사용).
const SPECS = [
  { key: "input", label: "Input", get: inputLabel },
  { key: "output", label: "Output", get: outputLabel },
  { key: "power", label: "Power", get: powerLabel },
  { key: "current", label: "Current", get: currentLabel },
  { key: "eff", label: "Eff.", get: efficiencyLabel },
  { key: "freq", label: "Freq.", get: freqLabel },
  { key: "size", label: "Size", get: dimLabel },
  { key: "cert", label: "Cert", get: certLabel },
] as const;

// 모든 카드가 공유하는 스펙 목록 — 각 셀은 [라벨] [값]. 라벨은 고정 폭으로 정렬해
// 값이 같은 열에서 나란히 읽히도록 한다. 값이 없는 필드는 흐리게 처리.
const SPEC_COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
};
function SpecList({
  m,
  cols = 2,
  className = "",
}: {
  m: Model;
  cols?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <dl className={`grid ${SPEC_COLS[cols]} gap-x-4 gap-y-1 ${className}`}>
      {SPECS.map(({ key, label, get }) => {
        const value = get(m);
        const empty = value === DASH;
        return (
          <div
            key={key}
            title={`${label}: ${value}`}
            className="flex min-w-0 items-baseline gap-1.5"
          >
            <dt
              className={`w-12 shrink-0 text-[10px] font-semibold uppercase tracking-wide ${
                empty ? "text-ink-300" : "text-ink-500"
              }`}
            >
              {label}
            </dt>
            <dd
              className={`mono min-w-0 flex-1 truncate text-[12px] leading-tight ${
                empty ? "text-ink-300" : "text-ink-800"
              }`}
            >
              {value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export default function ResultList({
  items,
  view,
  onOpen,
  highlightedId,
}: Props) {
  if (items.length === 0) {
    return (
      <div className="flex h-80 flex-col items-center justify-center rounded-card border border-dashed border-ink-200 text-center">
        <p className="text-[16px] text-black">
          No models match the current filters.
        </p>
        <p className="mt-1 text-[14px] text-ink-500">
          Try clearing a filter or broadening the power range.
        </p>
      </div>
    );
  }

  if (view === "grid") {
    return (
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((m) => {
          const active = highlightedId === m.modelKey;
          return (
            <li key={m.modelKey}>
              <button
                onClick={() => onOpen(m)}
                className={`flex h-full w-full flex-col items-start gap-3 rounded-card border p-4 text-left transition ${
                  active
                    ? "border-transparent bg-lime"
                    : "border-ink-200 bg-white hover:bg-ink-50"
                }`}
              >
                <div className="flex w-full items-center gap-3">
                  <Thumb m={m} active={active} />
                  <div className="min-w-0 flex-1">
                    <div className="mono break-words text-[16px] font-semibold leading-tight text-black">
                      {m.model}
                    </div>
                    <div className="label !normal-case !tracking-normal !text-ink-500">
                      {m.section ?? "Unclassified"}
                    </div>
                  </div>
                </div>
                <SpecList m={m} cols={2} className="w-full" />
                {m.brand && (
                  <div className="mt-auto flex w-full justify-end">
                    <BrandTag brand={m.brand} />
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="row-divider overflow-hidden rounded-card border border-ink-200 bg-white">
      {items.map((m) => {
        const isActive = highlightedId === m.modelKey;
        return (
          <li key={m.modelKey}>
            <button
              onClick={() => onOpen(m)}
              className={`group flex w-full flex-col gap-2 px-4 py-3 text-left transition ${
                isActive ? "bg-lime" : "hover:bg-ink-50"
              }`}
              style={
                isActive ? { boxShadow: "inset 4px 0 0 0 #000000" } : undefined
              }
            >
              <div className="flex w-full items-center gap-4">
                <Thumb m={m} active={isActive} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="mono break-words text-[16px] font-semibold leading-tight text-black">
                      {m.model}
                    </span>
                    <span className="label !normal-case !tracking-normal !text-ink-500 truncate">
                      {m.section ?? "—"}
                    </span>
                  </div>
                </div>
                <div className="hidden shrink-0 flex-col items-end text-right md:flex">
                  <BrandTag brand={m.brand} />
                </div>
              </div>
              {/* 스펙은 이미지 아래 영역에 무테 그리드로 정렬 (넓은 행은 4열로 밀도↑) */}
              <SpecList m={m} cols={4} className="w-full" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
