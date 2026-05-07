"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import Header from "@/components/Header";
import FilterRail, { type FilterState } from "@/components/FilterRail";
import ResultList from "@/components/ResultList";
import DetailDrawer from "@/components/DetailDrawer";
import BasketFab from "@/components/BasketFab";
import { getCatalog } from "@/lib/data";
import { POWER_BUCKETS, wattageNumber, type Model } from "@/lib/types";

const PAGE_SIZE = 50;

const EMPTY_STATE: FilterState = {
  category: null,
  lineage: null,
  family: null,
  section: null,
  power: null,
  voltage: null,
  inputType: null,
};

export default function Home() {
  const catalog = getCatalog();

  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const [filters, setFilters] = useState<FilterState>(EMPTY_STATE);
  const [sort, setSort] = useState<
    "relevance" | "power-asc" | "power-desc" | "model-asc" | "page-asc"
  >("relevance");
  const [selected, setSelected] = useState<Model | null>(null);
  const [railOpen, setRailOpen] = useState(false);

  // ── Infinite scroll state ─────────────────────────────────────────
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

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

  const categoryScoped = useMemo<Model[]>(
    () =>
      filters.category
        ? queried.filter((m) => m.category === filters.category)
        : queried,
    [queried, filters.category],
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
      if (bucket) {
        const w = wattageNumber(m.watts);
        // watts 데이터가 있는 모델만 범위 검사 — 데이터 없는 모델은 pass-through
        if (w !== null && (w < bucket.minW || w >= bucket.maxW)) return false;
      }
      if (filters.voltage) {
        // volts 데이터가 있는 모델만 매칭 검사 — 데이터 없는 모델은 pass-through
        if (m.volts.length > 0 && !m.volts.some((v) => v.toUpperCase() === filters.voltage!.toUpperCase()))
          return false;
      }
      return true;
    });
  }, [sectionScoped, filters.power, filters.voltage]);

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
      <Header
        query={query}
        onQuery={setQuery}
        totalModels={catalog.meta.modelCount}
        view={view}
        onView={setView}
        onFilterOpen={() => setRailOpen(true)}
      />

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

        <main className="flex-1 min-w-0 px-4 py-4 md:px-8 md:py-6">
          {/* Breadcrumb */}
          <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1.5">
            {crumbs.map((c, i) => (
              <span key={`${c}-${i}`} className="label flex items-center">
                {i > 0 && <span className="mx-1 !text-ink-300">›</span>}
                <span className="truncate !text-ink-700">{c}</span>
              </span>
            ))}
          </nav>

          <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-tightest text-black md:text-[40px] md:leading-[1.05]">
            {title}
          </h1>
          <p className="mt-2 max-w-[65ch] text-[14px] text-ink-700 md:text-[15px]">{intro}</p>

          {/* Sort + count bar */}
          <div className="sticky top-14 z-30 -mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 bg-white px-4 py-2.5 md:top-16 md:-mx-8 md:mt-5 md:px-8 md:py-3">
            <span className="mono text-[13px] text-black md:text-[14px]">
              {sorted.length.toLocaleString()}
              <span className="text-ink-500"> results</span>
              {query && (
                <span className="text-ink-500"> · &ldquo;{query}&rdquo;</span>
              )}
            </span>

            <div className="flex items-center gap-2 md:gap-3">
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
