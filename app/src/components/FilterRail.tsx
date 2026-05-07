"use client";

import { useMemo, useState } from "react";
import type { Catalog, Category, Lineage, Model } from "@/lib/types";
import { LINEAGE_ORDER, POWER_BUCKETS, wattageNumber } from "@/lib/types";

export interface FilterState {
  category: Category | null;
  lineage: Lineage | null;
  family: string | null;
  section: string | null;
  power: string | null;
  voltage: string | null;
  inputType: "AC" | "DC" | null;
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

const VOLT_OPTIONS = ["3.3V", "5V", "12V", "15V", "24V", "28V", "48V", "54V", "380V"];

function count<T>(arr: T[], pred: (x: T) => boolean) {
  let n = 0;
  for (const x of arr) if (pred(x)) n++;
  return n;
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

  const catCount = (c: Category) => count(models, (m) => m.category === c);
  const lineageCount = (lin: Lineage) =>
    count(categoryScoped, (m) => m.lineage === lin);
  const familyCount = (fam: string) =>
    count(lineageScoped, (m) => m.subcategory === fam);
  const sectionCount = (sec: string) => count(filtered, (m) => m.section === sec);
  const powerCount = (id: string) => {
    const b = POWER_BUCKETS.find((x) => x.id === id);
    if (!b) return 0;
    return count(filtered, (m) => {
      const w = wattageNumber(m.watts);
      return w !== null && w >= b.minW && w < b.maxW;
    });
  };
  const voltCount = (v: string) =>
    count(filtered, (m) =>
      m.volts.some((x) => x.toUpperCase() === v.toUpperCase()),
    );

  const activeChips = [
    state.category && { key: "category" as const, label: state.category },
    state.lineage && { key: "lineage" as const, label: state.lineage },
    state.family && { key: "family" as const, label: state.family },
    state.section && { key: "section" as const, label: state.section },
    state.power &&
      POWER_BUCKETS.find((b) => b.id === state.power) && {
        key: "power" as const,
        label: POWER_BUCKETS.find((b) => b.id === state.power)!.label,
      },
    state.voltage && { key: "voltage" as const, label: state.voltage },
  ].filter(Boolean) as { key: keyof FilterState; label: string }[];

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
        {/* Active filters */}
        <div className="flex items-center justify-between">
          <span className="label">Active Filters</span>
          {activeChips.length > 0 && (
            <button
              onClick={onClear}
              className="label !text-black underline underline-offset-2 hover:!text-ink-700"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {activeChips.length === 0 ? (
            <span className="text-[13px] text-ink-400">None selected</span>
          ) : (
            activeChips.map((c) => (
              <button
                key={`${c.key}-${c.label}`}
                onClick={() => {
                  const cascade: Partial<FilterState> = {
                    [c.key]: null,
                  } as Partial<FilterState>;
                  if (c.key === "category") {
                    cascade.lineage = null;
                    cascade.family = null;
                    cascade.section = null;
                  }
                  if (c.key === "lineage") {
                    cascade.family = null;
                    cascade.section = null;
                  }
                  if (c.key === "family") cascade.section = null;
                  onState(cascade);
                }}
                className="flex items-center gap-1.5 rounded-pill border border-black bg-lime px-2.5 py-1 text-[12px] font-medium text-black hover:bg-black hover:text-lime"
              >
                <span className="truncate max-w-[180px]">{c.label}</span>
                <span aria-hidden>×</span>
              </button>
            ))
          )}
        </div>

        {/* Category cards */}
        <section className="mt-4 grid grid-cols-2 gap-2">
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
                    ? "border-black bg-lime"
                    : "border-ink-200 bg-white hover:border-black"
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
          {VOLT_OPTIONS.map((v) => (
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
          "md:sticky md:top-16 md:z-auto md:h-[calc(100dvh-4rem)] md:w-[280px] md:shrink-0 md:translate-x-0 md:shadow-none",
        ].join(" ")}
      >
        {railContent}
      </aside>
    </>
  );
}
