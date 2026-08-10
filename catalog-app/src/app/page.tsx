"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import FilterRail, { type FilterState } from "@/components/FilterRail";
import ResultList from "@/components/ResultList";
import DetailDrawer from "@/components/DetailDrawer";
import BasketFab from "@/components/BasketFab";
import { getCatalog } from "@/lib/data";
import { POWER_BUCKETS, wattageNumber, type Model } from "@/lib/types";
import { usePersistentState } from "@/lib/usePersistentState";

const PAGE_SIZE = 50;

const EMPTY_STATE: FilterState = {
  brand: null,
  category: null,
  lineage: null,
  family: null,
  section: null,
  power: null,
  voltage: null,
  inputType: null,
  hideIncomplete: false,
};

export default function Home() {
  const catalog = getCatalog();

  const [query, setQuery] = usePersistentState("ae:catalog:query", "");
  const [view, setView] = usePersistentState<"list" | "grid">(
    "ae:catalog:view",
    "list",
  );
  const [filters, setFilters] = usePersistentState<FilterState>(
    "ae:catalog:filters",
    EMPTY_STATE,
  );
  const [sort, setSort] = usePersistentState<
    "relevance" | "power-asc" | "power-desc" | "model-asc" | "page-asc"
  >("ae:catalog:sort", "relevance");
  const [selected, setSelected] = useState<Model | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── Infinite scroll state ─────────────────────────────────────────
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K / Cmd+K focuses the integrated search input
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --- Fuse over the full catalog (built once) ---
  const fuse = useMemo(
    () =>
      new Fuse(catalog.models, {
        keys: [
          { name: "model", weight: 3 },
          { name: "section", weight: 2 },
          { name: "lineage", weight: 1.5 },
          { name: "subcategory", weight: 1.2 },
          { name: "searchText", weight: 1 },
        ],
        threshold: 0.32,
        ignoreLocation: true,
        includeScore: true,
        minMatchCharLength: 2,
      }),
    [catalog.models],
  );

  const queried = useMemo<Model[]>(() => {
    const q = query.trim();
    if (!q) return catalog.models;
    return fuse.search(q).map((r) => r.item);
  }, [query, fuse, catalog.models]);

  // Brand is a top-level filter (orthogonal to category) — apply it first so
  // every downstream scope + count reflects the selected brand.
  const brandScoped = useMemo<Model[]>(
    () =>
      filters.brand
        ? queried.filter((m) => m.brand === filters.brand)
        : queried,
    [queried, filters.brand],
  );
  const categoryScoped = useMemo<Model[]>(
    () =>
      filters.category
        ? brandScoped.filter((m) => m.category === filters.category)
        : brandScoped,
    [brandScoped, filters.category],
  );
  const lineageScoped = useMemo<Model[]>(
    () =>
      filters.lineage
        ? categoryScoped.filter((m) => m.lineage === filters.lineage)
        : categoryScoped,
    [categoryScoped, filters.lineage],
  );
  const familyScoped = useMemo<Model[]>(
    () =>
      filters.family
        ? lineageScoped.filter((m) => m.subcategory === filters.family)
        : lineageScoped,
    [lineageScoped, filters.family],
  );
  const sectionScoped = useMemo<Model[]>(
    () =>
      filters.section
        ? familyScoped.filter((m) => m.section === filters.section)
        : familyScoped,
    [familyScoped, filters.section],
  );

  const filtered = useMemo<Model[]>(() => {
    const bucket = filters.power
      ? POWER_BUCKETS.find((b) => b.id === filters.power) ?? null
      : null;
    return sectionScoped.filter((m) => {
      // "Hide models without specs" toggle — when active, models whose
      // wattage/voltage couldn't be parsed are excluded entirely. This
      // gives the user clean spec-driven results when they care.
      if (filters.hideIncomplete) {
        const hasWatts = m.watts.length > 0;
        const hasVolts = m.outputVolts.length > 0;
        if (!hasWatts || !hasVolts) return false;
      }
      // Power filter — when set, ONLY include models whose wattage is
      // known AND falls in the bucket. (Previously we pass-through models
      // with no watts which made the filter feel broken.)
      if (bucket) {
        const w = wattageNumber(m.watts);
        if (w === null) return false;
        if (w < bucket.minW || w >= bucket.maxW) return false;
      }
      // Voltage filter — ONLY include models whose outputVolts contain the
      // selected value. Models without voltage data are excluded.
      if (filters.voltage) {
        const want = filters.voltage.toUpperCase();
        if (m.outputVolts.length === 0) return false;
        if (!m.outputVolts.some((v) => v.toUpperCase() === want)) return false;
      }
      // Input type filter (AC vs DC) — ONLY include models with known
      // input type matching the selection.
      if (filters.inputType) {
        if (m.inputType !== filters.inputType) return false;
      }
      return true;
    });
  }, [sectionScoped, filters.power, filters.voltage, filters.inputType, filters.hideIncomplete]);

  const sorted = useMemo<Model[]>(() => {
    const arr = [...filtered];
    switch (sort) {
      case "power-asc":
        arr.sort(
          (a, b) =>
            (wattageNumber(a.watts) ?? Infinity) -
            (wattageNumber(b.watts) ?? Infinity),
        );
        break;
      case "power-desc":
        arr.sort(
          (a, b) =>
            (wattageNumber(b.watts) ?? -Infinity) -
            (wattageNumber(a.watts) ?? -Infinity),
        );
        break;
      case "model-asc":
        arr.sort((a, b) => a.model.localeCompare(b.model));
        break;
      case "page-asc":
        arr.sort((a, b) => a.pages[0] - b.pages[0]);
        break;
    }
    return arr;
  }, [filtered, sort]);

  // Reset visible count whenever results change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, filters, sort]);

  // ── IntersectionObserver for infinite scroll ──────────────────────
  const loadMore = useCallback(() => {
    setVisibleCount((n) => Math.min(n + PAGE_SIZE, sorted.length));
  }, [sorted.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const visibleItems = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  const related = useMemo<Model[]>(() => {
    if (!selected) return [];
    return catalog.models.filter(
      (m) =>
        m.section &&
        m.section === selected.section &&
        m.modelKey !== selected.modelKey,
    );
  }, [selected, catalog.models]);

  const crumbs = [
    "CATALOGUE",
    filters.category,
    filters.lineage,
    filters.family,
    filters.section,
  ].filter(Boolean) as string[];

  const onState = (patch: Partial<FilterState>) =>
    setFilters((f) => ({ ...f, ...patch }));
  const onClear = () => setFilters(EMPTY_STATE);

  // ── Active filter chips (rendered next to the results count) ─────────
  const activeChips = ([
    filters.brand && { key: "brand" as const, label: filters.brand },
    filters.category && { key: "category" as const, label: filters.category },
    filters.lineage && { key: "lineage" as const, label: filters.lineage },
    filters.family && { key: "family" as const, label: filters.family },
    filters.section && { key: "section" as const, label: filters.section },
    filters.power &&
      POWER_BUCKETS.find((b) => b.id === filters.power) && {
        key: "power" as const,
        label: POWER_BUCKETS.find((b) => b.id === filters.power)!.label,
      },
    filters.voltage && { key: "voltage" as const, label: filters.voltage },
    filters.inputType && { key: "inputType" as const, label: `${filters.inputType} input` },
    filters.hideIncomplete && { key: "hideIncomplete" as const, label: "Specs only" },
  ].filter(Boolean)) as { key: keyof FilterState; label: string }[];

  function removeChip(key: keyof FilterState) {
    const cascade: Partial<FilterState> = (key === "hideIncomplete"
      ? { hideIncomplete: false }
      : { [key]: null }) as Partial<FilterState>;
    if (key === "category") {
      cascade.lineage = null;
      cascade.family = null;
      cascade.section = null;
    }
    if (key === "lineage") {
      cascade.family = null;
      cascade.section = null;
    }
    if (key === "family") cascade.section = null;
    onState(cascade);
  }

  const title =
    filters.section ??
    filters.family ??
    filters.lineage ??
    (filters.category === "AC-DC"
      ? "AC–DC Power Supplies"
      : filters.category === "DC-DC"
      ? "DC–DC Converters"
      : "Embedded Power Catalogue");

  const intro = filters.lineage
    ? `${filters.category} · ${filters.lineage}`
    : filters.category
    ? `Select a lineup to narrow down the ${filters.category === "AC-DC" ? "AC–DC" : "DC–DC"} portfolio.`
    : `${catalog.meta.modelCount.toLocaleString()} models across ${catalog.meta.sectionCount} sections of the AE 2026 catalogue. Pick AC–DC or DC–DC to begin, then refine by lineup and spec.`;

  return (
    <div className="min-h-[100dvh] bg-white">
      {/* Unified sticky header — sits directly below the 40px GlobalNav so it
          stays frozen on scroll instead of slipping behind the nav. */}
      <header className="sticky top-10 z-40 border-b border-ink-100 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
        {/* Row 1 — title (left) + search (center) + nav buttons (right).
            On mobile the search wraps to its own full-width row so it never
            collides with the filter / view / menu buttons. */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 md:flex-nowrap md:gap-3 md:px-4 md:py-2">
              {/* Title cluster — left */}
              <div className="flex min-w-0 shrink items-baseline gap-2">
                <span className="label hidden text-[9px] !text-ink-500 md:inline">CATALOGUE</span>
                <h1 className="truncate text-[13px] font-semibold leading-tight tracking-tightest text-black md:text-[16px]">
                  {title}
                </h1>
              </div>

              {/* Search bar — own full-width row on mobile (basis-full forces the
                  flex line break), flexible center on desktop */}
              <div className="order-last w-full basis-full min-w-0 md:order-none md:w-auto md:basis-auto md:flex-1">
                <div className="group flex h-8 items-center rounded-pill border border-ink-200 bg-white px-2.5 focus-within:border-black focus-within:shadow-ring md:mx-auto md:max-w-[420px] md:px-3 lg:max-w-[520px]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="mr-1.5 shrink-0 text-ink-500 md:text-black">
                    <path d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <input
                    ref={searchInputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search models, specs…"
                    className="mono h-full min-w-0 flex-1 bg-transparent text-[12px] text-black placeholder:text-ink-400 focus:outline-none md:text-[13px]"
                    spellCheck={false}
                    autoComplete="off"
                  />
                  {query && (
                    <button onClick={() => setQuery("")} className="ml-1 shrink-0 text-[14px] leading-none text-ink-400 hover:text-black md:hidden" aria-label="Clear search">×</button>
                  )}
                  <kbd className="mono ml-2 hidden items-center gap-1 rounded-[4px] border border-ink-200 bg-white px-1 text-[10px] text-ink-500 lg:flex">Ctrl K</kbd>
                </div>
              </div>

              {/* Desktop right cluster — nav + view toggle */}
              <div className="hidden shrink-0 items-center gap-1.5 md:flex">
                <Link href="/finder/" className="mono whitespace-nowrap rounded-pill border border-transparent bg-lime px-2 py-1 text-[11px] font-semibold text-black hover:bg-black hover:text-lime">Finder →</Link>
                <span className="mono hidden whitespace-nowrap text-[11px] text-ink-500 xl:inline">{catalog.meta.modelCount.toLocaleString()} indexed</span>
                <div className="flex items-center rounded-pill border border-ink-200 p-0.5">
                  <button onClick={() => setView("list")} aria-pressed={view === "list"} className={`label rounded-pill px-2 py-0.5 transition ${view === "list" ? "bg-black !text-white" : "!text-ink-700 hover:!text-black"}`}>List</button>
                  <button onClick={() => setView("grid")} aria-pressed={view === "grid"} className={`label rounded-pill px-2 py-0.5 transition ${view === "grid" ? "bg-black !text-white" : "!text-ink-700 hover:!text-black"}`}>Grid</button>
                </div>
              </div>

              {/* Mobile right cluster — filter + view + hamburger */}
              <div className="flex shrink-0 items-center gap-1 md:hidden">
                <button onClick={() => setRailOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 bg-white active:bg-ink-50" aria-label="필터 열기">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                </button>
                <div className="flex items-center rounded-pill border border-ink-200 p-0.5">
                  <button onClick={() => setView("list")} aria-pressed={view === "list"} className={`label rounded-pill px-1.5 py-0.5 text-[9px] transition ${view === "list" ? "bg-black !text-white" : "!text-ink-700"}`}>List</button>
                  <button onClick={() => setView("grid")} aria-pressed={view === "grid"} className={`label rounded-pill px-1.5 py-0.5 text-[9px] transition ${view === "grid" ? "bg-black !text-white" : "!text-ink-700"}`}>Grid</button>
                </div>
                <button onClick={() => setMobileMenuOpen((o) => !o)} className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 active:bg-ink-50" aria-label="메뉴" aria-expanded={mobileMenuOpen}>
                  {mobileMenuOpen ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  )}
                </button>
              </div>
            </div>

        {/* Mobile hamburger dropdown */}
        {mobileMenuOpen && (
          <nav className="border-t border-ink-100 bg-white px-3 py-2 md:hidden">
            <div className="grid grid-cols-2 gap-1.5">
              <Link href="/finder/" onClick={() => setMobileMenuOpen(false)} className="mono col-span-2 rounded-md border border-transparent bg-lime px-2 py-2 text-center text-[11px] font-semibold text-black">Finder</Link>
            </div>
          </nav>
        )}
      </header>

      <div className="flex w-full">
        <FilterRail
          catalog={catalog}
          models={catalog.models}
          filtered={filtered}
          categoryScoped={categoryScoped}
          lineageScoped={lineageScoped}
          state={filters}
          onState={onState}
          onClear={onClear}
          mobileOpen={railOpen}
          onMobileClose={() => setRailOpen(false)}
        />

        <main className="flex-1 min-w-0 px-4 pb-4 pt-0 md:px-8 md:pb-6">
          {/* Sort + count bar */}
          <div className="relative z-30 -mx-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-ink-100 bg-white px-4 py-2 md:-mx-8 md:sticky md:top-[5.5rem] md:px-8 md:py-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="mono shrink-0 text-[13px] text-black md:text-[14px]">
                {sorted.length.toLocaleString()}
                <span className="text-ink-500"> results</span>
                {query && (
                  <span className="text-ink-500"> · &ldquo;{query}&rdquo;</span>
                )}
              </span>

              {activeChips.length > 0 && (
                <>
                  {activeChips.map((c) => (
                    <button
                      key={`${c.key}-${c.label}`}
                      onClick={() => removeChip(c.key)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-0.5 text-[12px] text-black antialiased hover:bg-ink-50 md:text-[13px]"
                    >
                      <span className="max-w-[180px] truncate">{c.label}</span>
                      <span aria-hidden className="text-ink-500">×</span>
                    </button>
                  ))}
                  <button
                    onClick={onClear}
                    className="ml-1 text-[12px] text-ink-500 underline underline-offset-2 hover:text-black md:text-[13px]"
                  >
                    Clear all
                  </button>
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2 md:gap-3">
              <label className="label hidden sm:block">Sort</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="mono rounded-md border border-ink-200 bg-white px-2 py-1 text-[13px] text-black md:px-2.5 md:text-[14px]"
              >
                <option value="relevance">Relevance</option>
                <option value="power-asc">Power ↑</option>
                <option value="power-desc">Power ↓</option>
                <option value="model-asc">Model A→Z</option>
                <option value="page-asc">Page order</option>
              </select>
            </div>
          </div>

          {/* Results */}
          <div className="mt-4">
            <ResultList
              items={visibleItems}
              view={view}
              onOpen={(m) => setSelected(m)}
              highlightedId={selected?.modelKey ?? null}
            />
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-8" aria-hidden="true" />

          {/* Loading indicator */}
          {hasMore && (
            <div className="flex items-center justify-center py-6">
              <span className="mono text-[13px] text-ink-400">
                {visibleCount.toLocaleString()} / {sorted.length.toLocaleString()} 표시 중…
              </span>
            </div>
          )}

          {/* All loaded indicator */}
          {!hasMore && sorted.length > PAGE_SIZE && (
            <div className="flex items-center justify-center py-6">
              <span className="mono text-[12px] text-ink-300">
                — {sorted.length.toLocaleString()} 개 전체 표시 —
              </span>
            </div>
          )}
        </main>
      </div>

      <DetailDrawer
        model={selected}
        related={related}
        onClose={() => setSelected(null)}
        onSelect={(m) => setSelected(m)}
      />

      <BasketFab />
    </div>
  );
}
