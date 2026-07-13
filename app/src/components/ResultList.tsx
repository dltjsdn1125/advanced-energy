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

function cardSpecs(m: Model): { label: string; value: string }[] {
  return [
    { label: "입력", value: inputLabel(m) },
    { label: "출력", value: outputLabel(m) },
    { label: "전력", value: powerLabel(m) },
    { label: "인증", value: certLabel(m) },
  ];
}

// 모든 카드가 공유하는 스펙 그리드 (2열). 값이 없는 필드는 "—" 로 자리를 유지해
// 카드 간 높이·정렬을 통일한다.
function SpecGrid({ m, className = "" }: { m: Model; className?: string }) {
  return (
    <dl className={`grid grid-cols-2 gap-x-4 gap-y-1 ${className}`}>
      {cardSpecs(m).map((s) => (
        <div key={s.label} className="flex min-w-0 items-baseline gap-1.5">
          <dt className="w-7 shrink-0 text-[10px] font-semibold text-ink-400">
            {s.label}
          </dt>
          <dd
            className={`mono truncate text-[12px] ${
              s.value === DASH ? "text-ink-300" : "text-ink-700"
            }`}
            title={s.value}
          >
            {s.value}
          </dd>
        </div>
      ))}
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
                <SpecGrid m={m} className="w-full" />
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
              className={`group flex w-full items-center gap-4 px-4 py-3 text-left transition ${
                isActive ? "bg-lime" : "hover:bg-ink-50"
              }`}
              style={
                isActive ? { boxShadow: "inset 4px 0 0 0 #000000" } : undefined
              }
            >
              <Thumb m={m} active={isActive} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3">
                  <span className="mono truncate text-[14px] font-medium text-black">
                    {m.model}
                  </span>
                  <span className="label !normal-case !tracking-normal !text-ink-500">
                    {m.section ?? "—"}
                  </span>
                </div>
                <SpecGrid m={m} className="mt-1.5 max-w-2xl" />
              </div>
              <div className="hidden flex-col items-end text-right md:flex">
                {m.brand && (
                  <span className="mono text-[12px] text-black">{m.brand}</span>
                )}
                <span className="mono text-[11px] text-ink-500">
                  p.{m.pages.join(", ")}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
