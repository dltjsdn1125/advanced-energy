"use client";

import type { Model } from "@/lib/types";
import { assetSrc } from "@/lib/data";

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
        active ? "border-black" : "border-ink-200"
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
  return DASH;
}

function outputLabel(m: Model): string {
  if (m.outputVolts?.length) {
    const shown = m.outputVolts.slice(0, 3).join(" / ");
    return m.outputVolts.length > 3 ? `${shown} …` : shown;
  }
  const s = m.specMap ?? {};
  if (s["Output Voltage Range (V)"]) return clean(s["Output Voltage Range (V)"]);
  return DASH;
}

function powerLabel(m: Model): string {
  const wl = wattsLabel(m.watts);
  if (wl) return wl;
  const s = m.specMap ?? {};
  const p = clean(s["Maximum Output Power (W)"] || s["Output Power (W)"]);
  return p ? `${p} W` : DASH;
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

// ── 스펙 아이콘 ────────────────────────────────────────────────────────────────
// 텍스트 라벨(Input/Output/…) 대신 SVG 아이콘으로 밀도 있게 표시. 각 행에는
// 영문 라벨을 title(툴팁)로 붙여 접근성을 유지한다.
const ICON: React.SVGProps<SVGSVGElement> = {
  width: 13,
  height: 13,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};
function InputIcon() {
  return (
    <svg {...ICON} aria-hidden>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}
function OutputIcon() {
  return (
    <svg {...ICON} aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
function PowerIcon() {
  return (
    <svg {...ICON} fill="currentColor" stroke="none" aria-hidden>
      <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
    </svg>
  );
}
function CertIcon() {
  return (
    <svg {...ICON} aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

const SPECS = [
  { key: "input", label: "Input", Icon: InputIcon, get: inputLabel },
  { key: "output", label: "Output", Icon: OutputIcon, get: outputLabel },
  { key: "power", label: "Power", Icon: PowerIcon, get: powerLabel },
  { key: "cert", label: "Cert", Icon: CertIcon, get: certLabel },
] as const;

// 모든 카드가 공유하는 스펙 목록 — 테두리 없이 아이콘이 라벨을 대신하는 정렬된
// 2열 그리드. 아이콘 위치가 항상 Input/Output/Power/Cert 순서로 고정돼 질서를 주고,
// 값이 없는 필드(주로 인증)는 흐리게 처리해 채워진 스펙이 또렷하게 읽히도록 한다.
function SpecList({ m, className = "" }: { m: Model; className?: string }) {
  return (
    <dl className={`grid grid-cols-2 gap-x-4 gap-y-1 ${className}`}>
      {SPECS.map(({ key, label, Icon, get }) => {
        const value = get(m);
        const empty = value === DASH;
        return (
          <div
            key={key}
            title={`${label}: ${value}`}
            className="flex min-w-0 items-center gap-1.5"
          >
            <span className={`shrink-0 ${empty ? "text-ink-200" : "text-ink-400"}`}>
              <Icon />
            </span>
            <span
              className={`mono truncate text-[12px] leading-tight ${
                empty ? "text-ink-300" : "text-ink-700"
              }`}
            >
              {value}
            </span>
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
                    ? "border-black bg-lime"
                    : "border-ink-200 bg-white hover:border-black"
                }`}
              >
                <div className="flex w-full items-center gap-3">
                  <Thumb m={m} active={active} />
                  <div className="min-w-0 flex-1">
                    <div className="mono truncate text-[14px] font-medium text-black">
                      {m.model}
                    </div>
                    <div className="label !normal-case !tracking-normal !text-ink-500">
                      {m.section ?? "Unclassified"}
                    </div>
                  </div>
                </div>
                <SpecList m={m} className="w-full" />
                <div className="mt-auto flex w-full items-center justify-between text-[12px]">
                  <span className="mono text-ink-500">p.{m.pages[0]}</span>
                  {m.brand && <span className="mono text-ink-500">{m.brand}</span>}
                </div>
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
                  <div className="flex items-baseline gap-3">
                    <span className="mono truncate text-[14px] font-medium text-black">
                      {m.model}
                    </span>
                    <span className="label !normal-case !tracking-normal !text-ink-500 truncate">
                      {m.section ?? "—"}
                    </span>
                  </div>
                </div>
                <div className="hidden shrink-0 flex-col items-end text-right md:flex">
                  {m.brand && (
                    <span className="mono text-[12px] text-black">{m.brand}</span>
                  )}
                  <span className="mono text-[11px] text-ink-500">
                    p.{m.pages.join(", ")}
                  </span>
                </div>
              </div>
              {/* 스펙은 이미지 아래 영역에 무테 그리드로 정렬 */}
              <SpecList m={m} className="w-full sm:max-w-xl" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
