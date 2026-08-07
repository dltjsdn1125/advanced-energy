"use client";

import { useMemo, useState } from "react";
import type { Brand, Catalog, Category, Lineage, Model } from "@/lib/types";
import { BRAND_LOGO, BRANDS, LINEAGE_ORDER, POWER_BUCKETS, wattageNumber } from "@/lib/types";

export interface FilterState {
  /** 제조 브랜드 (raw data/ 의 브랜드 로고 PDF 기준). */
  brand: Brand | null;
  category: Category | null;
  lineage: Lineage | null;
  family: string | null;
  section: string | null;
  power: string | null;
  voltage: string | null;
  inputType: "AC" | "DC" | null;
  /** When true, hide models whose watts/volts couldn't be parsed. */
  hideIncomplete: boolean;
}

interface Props {
  catalog: Catalog;
  models: Model[];
  filtered: Model[];
  categoryScoped: Model[];
  lineageScoped: Model[];
  state: FilterState;
  onState: (patch: Partial<FilterState>) => void;
  onClear: () => void;
  /** Mobile drawer open state */
  mobileOpen?: boolean;
  /** Callback to close mobile drawer */
  onMobileClose?: () => void;
}

// Voltages we always show even if the current filter scope has zero models
// with that value — keeps the UI stable while users navigate. Real available
// values are merged with this list inside the component below.
const COMMON_VOLT_OPTIONS = ["3.3V", "5V", "12V", "15V", "24V", "28V", "48V"];

function count<T>(arr: T[], pred: (x: T) => boolean) {
  let n = 0;
  for (const x of arr) if (pred(x)) n++;
  return n;
}

function voltSortKey(v: string): number {
  const m = v.match(/^([\d.]+)V$/i);
  return m ? parseFloat(m[1]) : Number.POSITIVE_INFINITY;
}

export default function FilterRail({
  catalog,
  models,
  filtered,
  categoryScoped,
  lineageScoped,
  state,
  onState,
  onClear,
  mobileOpen = false,
  onMobileClose,
}: Props) {
  const [openGroups, setOpenGroups] = useState({
    lineage: true,
    family: true,
    section: false,
    power: true,
    voltage: true,
    inputType: true,
  });

  const familiesInLineage = useMemo<string[]>(() => {
    if (!state.category || !state.lineage) return [];
    const node = catalog.lineageTree.find(
      (n) => n.category === state.category && n.lineage === state.lineage,
    );
    return node?.families ?? [];
  }, [catalog, state.category, state.lineage]);

  const sectionsInScope = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const s of catalog.sections) {
      if (state.category && s.category !== state.category) continue;
      if (state.lineage && s.lineage !== state.lineage) continue;
      if (state.family && s.subcategory !== state.family) continue;
      set.add(s.section);
    }
    return [...set];
  }, [catalog.sections, state.category, state.lineage, state.family]);

  // Each option count is computed against the full model set with EVERY
  // active filter applied EXCEPT the dimension that option belongs to.
  // This way clicking that option produces the count shown — and other
  // options in the same group remain visible (non-zero where possible)
  // even when an adjacent dimension is already active.
  function passesExcept(
    m: Model,
    ignore: keyof FilterState | null,
  ): boolean {
    if (ignore !== "brand" && state.brand && m.brand !== state.brand) return false;
    if (ignore !== "category" && state.category && m.category !== state.category) return false;
    if (ignore !== "lineage" && state.lineage && m.lineage !== state.lineage) return false;
    if (ignore !== "family" && state.family && m.subcategory !== state.family) return false;
    if (ignore !== "section" && state.section && m.section !== state.section) return false;
    if (ignore !== "power" && state.power) {
      const b = POWER_BUCKETS.find((x) => x.id === state.power);
      if (b) {
        const w = wattageNumber(m.watts);
        if (w === null) return false;
        if (w < b.minW || w >= b.maxW) return false;
      }
    }
    if (ignore !== "voltage" && state.voltage) {
      const want = state.voltage.toUpperCase();
      if (m.outputVolts.length === 0) return false;
      if (!m.outputVolts.some((v) => v.toUpperCase() === want)) return false;
    }
    if (ignore !== "inputType" && state.inputType) {
      if (m.inputType !== state.inputType) return false;
    }
    if (ignore !== "hideIncomplete" && state.hideIncomplete) {
      if (m.watts.length === 0 || m.outputVolts.length === 0) return false;
    }
    return true;
  }

  // Pre-compute the candidate set for each filter dimension so option
  // counts are O(N) per group instead of O(N*options).
  const baseForCategory = useMemo(() => models.filter((m) => passesExcept(m, "category")), [models, state]);
  const baseForLineage = useMemo(() => models.filter((m) => passesExcept(m, "lineage")), [models, state]);
  const baseForFamily = useMemo(() => models.filter((m) => passesExcept(m, "family")), [models, state]);
  const baseForSection = useMemo(() => models.filter((m) => passesExcept(m, "section")), [models, state]);
  const baseForPower = useMemo(() => models.filter((m) => passesExcept(m, "power")), [models, state]);
  const baseForVoltage = useMemo(() => models.filter((m) => passesExcept(m, "voltage")), [models, state]);
  const baseForInputType = useMemo(() => models.filter((m) => passesExcept(m, "inputType")), [models, state]);

  const catCount = (c: Category) => count(baseForCategory, (m) => m.category === c);
  const lineageCount = (lin: Lineage) =>
    count(baseForLineage, (m) => m.lineage === lin);
  const familyCount = (fam: string) =>
    count(baseForFamily, (m) => m.subcategory === fam);
  const sectionCount = (sec: string) => count(baseForSection, (m) => m.section === sec);
  const powerCount = (id: string) => {
    const b = POWER_BUCKETS.find((x) => x.id === id);
    if (!b) return 0;
    return count(baseForPower, (m) => {
      const w = wattageNumber(m.watts);
      return w !== null && w >= b.minW && w < b.maxW;
    });
  };
  const voltCount = (v: string) =>
    count(baseForVoltage, (m) =>
      m.outputVolts.some((x) => x.toUpperCase() === v.toUpperCase()),
    );
  const inputTypeCount = (t: "AC" | "DC") =>
    count(baseForInputType, (m) => m.inputType === t);

  // Brand totals across the WHOLE catalogue — used to grey out brands that
  // have no products in this catalogue (e.g. Impac). The number shown on each
  // button stays context-aware (brandCount), but disabling is based on totals.
  const brandTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const b of BRANDS) t[b] = 0;
    for (const m of models) if (m.brand) t[m.brand] = (t[m.brand] ?? 0) + 1;
    return t;
  }, [models]);

  // Dynamic voltage options — union of catalogue-observed voltages and the
  // common ones, sorted numerically.
  const voltOptions = useMemo(() => {
    const seen = new Set<string>(COMMON_VOLT_OPTIONS);
    for (const m of models) {
      for (const v of m.outputVolts) seen.add(v);
    }
    return [...seen].sort((a, b) => voltSortKey(a) - voltSortKey(b));
  }, [models]);

  function Group({
    id,
    title,
    children,
    hint,
  }: {
    id: keyof typeof openGroups;
    title: string;
    children: React.ReactNode;
    hint?: string;
  }) {
    const open = openGroups[id];
    return (
      <section className="border-t border-ink-100 py-3">
        <button
          onClick={() => setOpenGroups({ ...openGroups, [id]: !open })}
          className="flex w-full items-center justify-between text-left"
          aria-expanded={open}
        >
          <div className="flex items-baseline gap-2">
            <span className="label !text-black">{title}</span>
            {hint && <span className="mono text-[11px] text-ink-500">{hint}</span>}
          </div>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            className={`text-ink-500 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && <div className="mt-2 space-y-0.5">{children}</div>}
      </section>
    );
  }

  function Option({
    label,
    count,
    active,
    disabled,
    onClick,
  }: {
    label: string;
    count: number;
    active: boolean;
    disabled?: boolean;
    onClick: () => void;
  }) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left transition ${
          active
            ? "bg-lime text-black font-medium"
            : disabled
            ? "text-ink-400"
            : "text-ink-700 hover:bg-ink-100 hover:text-black"
        }`}
      >
        <span className="truncate text-[14px]">{label}</span>
        <span
          className={`mono ml-2 shrink-0 text-[12px] ${
            active ? "text-black" : "text-ink-500"
          }`}
        >
          {count}
        </span>
      </button>
    );
  }

  const railContent = (
    <>
      {/* Mobile header with close button */}
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 md:hidden">
        <span className="mono text-[13px] font-semibold text-black">필터</span>
        <button
          onClick={onMobileClose}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 active:bg-ink-50"
          aria-label="닫기"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 18L18 6M6 6l12 12"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Brand — 최상단 브랜드 버튼 (raw data/ 로고 PDF 8종 기준) */}
        <section className="pb-3">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="label !text-black">Brand</span>
            {state.brand && (
              <button
                onClick={() => onState({ brand: null })}
                className="mono text-[11px] text-ink-500 underline underline-offset-2 hover:text-black"
              >
                전체
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {BRANDS.map((b) => {
              const active = state.brand === b;
              const disabled = brandTotals[b] === 0;
              return (
                <button
                  key={b}
                  disabled={disabled}
                  onClick={() => onState({ brand: active ? null : b })}
                  title={disabled ? `${b} — 이 카탈로그에 제품 없음` : b}
                  className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg border px-2.5 py-2 text-center transition-colors ${
                    active
                      ? "border-transparent bg-lime text-black"
                      : disabled
                      ? "cursor-not-allowed border-dashed border-ink-200 bg-ink-50 text-ink-300"
                      : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50 hover:text-black"
                  }`}
                >
                  {BRAND_LOGO[b] ? (
                    // 로고가 있는 브랜드는 로고만 표시 (원본 78px 를 축소 — 억지
                    // 확대 없이 object-contain 으로 비율 유지). 필터 카운트는 로고와
                    // 겹쳐 표기하지 않는다.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={BRAND_LOGO[b]}
                      alt={b}
                      loading="lazy"
                      className="h-12 w-auto max-w-[140px] object-contain px-1 py-0.5"
                    />
                  ) : (
                    <span className="truncate text-[13px] font-medium">{b}</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Category cards */}
        <section className="grid grid-cols-2 gap-2 border-t border-ink-100 pt-3">
          {(["AC-DC", "DC-DC"] as Category[]).map((c) => {
            const active = state.category === c;
            return (
              <button
                key={c}
                onClick={() =>
                  onState({
                    category: active ? null : c,
                    lineage: null,
                    family: null,
                    section: null,
                  })
                }
                className={`flex flex-col items-start rounded-card border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-transparent bg-lime"
                    : "border-ink-200 bg-white hover:bg-ink-50"
                }`}
              >
                <span className="label !tracking-[0.08em] !text-black">
                  {c === "AC-DC" ? "AC–DC" : "DC–DC"}
                </span>
                <span className="mono mt-0.5 text-[11px] text-ink-700">
                  {catCount(c).toLocaleString()} models
                </span>
              </button>
            );
          })}
        </section>

        {/* Lineup */}
        {state.category ? (
          <Group
            id="lineage"
            title="Lineup"
            hint={state.category === "AC-DC" ? "AC–DC" : "DC–DC"}
          >
            {LINEAGE_ORDER[state.category].map((lin) => (
              <Option
                key={lin}
                label={lin}
                count={lineageCount(lin)}
                active={state.lineage === lin}
                onClick={() =>
                  onState({
                    lineage: state.lineage === lin ? null : lin,
                    family: null,
                    section: null,
                  })
                }
              />
            ))}
          </Group>
        ) : null}

        {/* Sub-Family */}
        {state.lineage && familiesInLineage.length > 0 && (
          <Group id="family" title="Sub-Family" hint={state.lineage}>
            {familiesInLineage.map((f) => (
              <Option
                key={f}
                label={f}
                count={familyCount(f)}
                active={state.family === f}
                onClick={() =>
                  onState({
                    family: state.family === f ? null : f,
                    section: null,
                  })
                }
              />
            ))}
          </Group>
        )}

        {/* Series */}
        {state.lineage && sectionsInScope.length > 0 && (
          <Group id="section" title="Series" hint={`${sectionsInScope.length}`}>
            {sectionsInScope.slice(0, 40).map((s) => (
              <Option
                key={s}
                label={s}
                count={sectionCount(s)}
                active={state.section === s}
                onClick={() => onState({ section: state.section === s ? null : s })}
              />
            ))}
          </Group>
        )}

        {/* Power */}
        <Group id="power" title="Power Range">
          {POWER_BUCKETS.map((b) => (
            <Option
              key={b.id}
              label={b.label}
              count={powerCount(b.id)}
              active={state.power === b.id}
              onClick={() =>
                onState({ power: state.power === b.id ? null : b.id })
              }
            />
          ))}
        </Group>

        {/* Voltage */}
        <Group id="voltage" title="Output Voltage">
          {voltOptions.map((v) => (
            <Option
              key={v}
              label={v}
              count={voltCount(v)}
              active={state.voltage === v}
              onClick={() =>
                onState({ voltage: state.voltage === v ? null : v })
              }
            />
          ))}
        </Group>

        {/* Input Type */}
        <Group id="inputType" title="Input Type">
          {(["AC", "DC"] as const).map((t) => (
            <Option
              key={t}
              label={`${t} input`}
              count={inputTypeCount(t)}
              active={state.inputType === t}
              onClick={() =>
                onState({ inputType: state.inputType === t ? null : t })
              }
            />
          ))}
        </Group>

        {/* Toggle: hide models with no parsed specs */}
        <section className="border-t border-ink-100 py-3">
          <label className="flex items-center justify-between gap-2 text-[14px] text-ink-700">
            <span>Hide models without spec data</span>
            <input
              type="checkbox"
              checked={state.hideIncomplete}
              onChange={(e) =>
                onState({ hideIncomplete: e.target.checked })
              }
              className="h-4 w-4 accent-black"
            />
          </label>
          <p className="mono mt-1 text-[11px] text-ink-400">
            {state.hideIncomplete
              ? "Showing only models with parsed watts + volts."
              : "Some models lack parsed watts/volts and are still shown."}
          </p>
        </section>
      </div>

      <footer className="border-t border-ink-100 px-4 py-3">
        <span className="mono text-[11px] text-ink-500">
          {catalog.meta.modelCount.toLocaleString()} models ·{" "}
          {catalog.meta.sectionCount} sections
        </span>
      </footer>
    </>
  );

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Desktop: sticky sidebar | Mobile: fixed slide-in drawer */}
      <aside
        className={[
          // Shared
          "flex flex-col border-r border-ink-100 bg-white",
          // Mobile: fixed full-height drawer, slides in from left
          "fixed left-0 top-0 z-50 h-[100dvh] w-[min(85vw,320px)] transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
          // Desktop: revert to sticky sidebar, always visible
          "md:sticky md:top-[6.5rem] md:z-auto md:h-[calc(100dvh-6.5rem)] md:w-[280px] md:shrink-0 md:translate-x-0 md:shadow-none",
        ].join(" ")}
      >
        {railContent}
      </aside>
    </>
  );
}
