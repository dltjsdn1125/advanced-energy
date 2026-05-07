"use client";

import { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { getCatalog, getSpecIndex } from "@/lib/data";
import type { Model, Spec, SpecValue } from "@/lib/types";
import DetailDrawer from "@/components/DetailDrawer";
import ResultList from "@/components/ResultList";
import BasketFab from "@/components/BasketFab";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ChipKind = "value" | "range" | "text";

interface FacetChip {
  id: string;           // unique within the facet
  kind: ChipKind;
  display: string;      // shown in chip
  matchedValues: number; // number of catalogue values that matched
  pages: number[];      // pages contributed by this chip
}

interface PickedFacet {
  specKey: string;
  label: string;
  chips: FacetChip[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const GROUP_ORDER = [
  "Electrical Specifications",
  "Input",
  "Output",
  "Environmental Specifications",
  "Mechanical Specifications",
  "Physical Specifications",
  "Safety & Compliance",
  "Protection",
  "Cooling",
  "Control & Status",
  "Signals",
  "Summary",
  "General",
];

// Parse the free-text input as a numeric range predicate. Returns null for
// non-range input (which then falls back to substring matching).
function parseRange(input: string): {
  label: string;
  test: (n: number) => boolean;
} | null {
  const s = input.trim().replace(/\s+/g, " ");
  if (!s) return null;

  let m: RegExpMatchArray | null;

  // "100-200", "100 - 200", "100~200", "100–200"
  m = s.match(/^(-?\d+(?:\.\d+)?)\s*[-~–]\s*(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const lo = Math.min(parseFloat(m[1]), parseFloat(m[2]));
    const hi = Math.max(parseFloat(m[1]), parseFloat(m[2]));
    return { label: `${lo}–${hi}`, test: (n) => n >= lo && n <= hi };
  }

  m = s.match(/^>=\s*(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const v = parseFloat(m[1]);
    return { label: `≥ ${v}`, test: (n) => n >= v };
  }
  m = s.match(/^>\s*(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const v = parseFloat(m[1]);
    return { label: `> ${v}`, test: (n) => n > v };
  }
  m = s.match(/^<=\s*(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const v = parseFloat(m[1]);
    return { label: `≤ ${v}`, test: (n) => n <= v };
  }
  m = s.match(/^<\s*(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const v = parseFloat(m[1]);
    return { label: `< ${v}`, test: (n) => n < v };
  }
  return null;
}

// Pull the first number out of a catalogue value string.
// "100 x 50 x 20 mm" -> 100   "500,000 hours" -> 500000
// "90 to 264 VAC"    -> 90    "3.3 V @ 5 A"   -> 3.3
function firstNumber(value: string): number | null {
  const cleaned = value.replace(/,/g, "");
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  return parseFloat(m[0]);
}

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

function unionPages(...pageLists: number[][]): number[] {
  const set = new Set<number>();
  for (const arr of pageLists) for (const p of arr) set.add(p);
  return [...set];
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const catalog = getCatalog();
  const specIndex = getSpecIndex();

  const [specQuery, setSpecQuery] = useState("");
  const [picked, setPicked] = useState<PickedFacet[]>([]);
  const [selected, setSelected] = useState<Model | null>(null);
  // 사이드바 (모바일에서는 슬라이드 인)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 그룹별 펼침 상태 (사용자 토글)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [showOnlyPicked, setShowOnlyPicked] = useState(false);

  const specsByKey = useMemo(() => {
    const m = new Map<string, Spec>();
    for (const s of specIndex.specs) m.set(s.key, s);
    return m;
  }, [specIndex.specs]);

  const groupedSpecs = useMemo(() => {
    const map = new Map<string, Spec[]>();
    for (const s of specIndex.specs) {
      const key = s.groups[0] ?? "General";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => b.occurrenceCount - a.occurrenceCount);
    }
    const keys = [...map.keys()];
    keys.sort((a, b) => {
      const ia = GROUP_ORDER.indexOf(a);
      const ib = GROUP_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return keys.map((k) => ({ group: k, specs: map.get(k)! }));
  }, [specIndex.specs]);

  const pickedKeys = useMemo(() => new Set(picked.map((p) => p.specKey)), [picked]);

  const visibleSpecs = useMemo(() => {
    const q = specQuery.trim().toLowerCase();
    return groupedSpecs
      .map((g) => ({
        ...g,
        specs: g.specs.filter((s) => {
          if (showOnlyPicked && !pickedKeys.has(s.key)) return false;
          if (!q) return true;
          return s.label.toLowerCase().includes(q);
        }),
      }))
      .filter((g) => g.specs.length > 0);
  }, [groupedSpecs, specQuery, showOnlyPicked, pickedKeys]);

  // 그룹 펼침 기본값: 검색어 있으면 모두 펼침, picked 가 있으면 그 그룹만 펼침, 그 외엔 첫 그룹만 펼침
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const g of groupedSpecs) {
        if (next[g.group] === undefined) {
          next[g.group] = false;
        }
      }
      // picked 의 spec 이 속한 그룹은 자동 펼침
      for (const p of picked) {
        const sp = specsByKey.get(p.specKey);
        const grp = sp?.groups[0] ?? "General";
        next[grp] = true;
      }
      return next;
    });
  }, [groupedSpecs, picked, specsByKey]);

  // 검색어 입력 시 모든 매칭 그룹 자동 펼침
  useEffect(() => {
    if (!specQuery.trim()) return;
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const g of visibleSpecs) next[g.group] = true;
      return next;
    });
  }, [specQuery, visibleSpecs]);

  // ── Matching logic ─────────────────────────────────────────────────
  // A facet contributes iff it has at least one chip. A model matches the
  // facet if any of its pages appears in the union of the facet's chip pages.
  // The overall filter ANDs across facets.
  const activeFacets = useMemo(
    () => picked.filter((f) => f.chips.length > 0),
    [picked],
  );

  const matchingModels = useMemo<Model[]>(() => {
    if (activeFacets.length === 0) return catalog.models;
    const facetPageSets = activeFacets.map(
      (f) => new Set<number>(unionPages(...f.chips.map((c) => c.pages))),
    );
    return catalog.models.filter((m) => {
      for (const pageSet of facetPageSets) {
        let hit = false;
        for (const p of m.pages) {
          if (pageSet.has(p)) {
            hit = true;
            break;
          }
        }
        if (!hit) return false;
      }
      return true;
    });
  }, [catalog.models, activeFacets]);

  // ── Facet management ───────────────────────────────────────────────

  function addSpec(specKey: string) {
    const spec = specsByKey.get(specKey);
    if (!spec) return;
    setPicked((prev) => {
      if (prev.some((p) => p.specKey === specKey)) return prev;
      return [
        ...prev,
        { specKey, label: spec.label, chips: [] },
      ];
    });
  }

  function removeSpec(specKey: string) {
    setPicked((prev) => prev.filter((p) => p.specKey !== specKey));
  }

  function removeChip(specKey: string, chipId: string) {
    setPicked((prev) =>
      prev.map((f) =>
        f.specKey === specKey
          ? { ...f, chips: f.chips.filter((c) => c.id !== chipId) }
          : f,
      ),
    );
  }

  function addValueChip(specKey: string, value: SpecValue) {
    setPicked((prev) =>
      prev.map((f) => {
        if (f.specKey !== specKey) return f;
        // Skip if an identical exact-value chip already exists.
        if (
          f.chips.some((c) => c.kind === "value" && c.display === value.value)
        )
          return f;
        const chip: FacetChip = {
          id: makeId(),
          kind: "value",
          display: value.value,
          matchedValues: 1,
          pages: [...value.pages],
        };
        return { ...f, chips: [...f.chips, chip] };
      }),
    );
  }

  function addQueryChip(specKey: string, raw: string) {
    const text = raw.trim();
    if (!text) return;
    const spec = specsByKey.get(specKey);
    if (!spec) return;

    const range = parseRange(text);
    let matched: SpecValue[] = [];
    let kind: ChipKind;
    let display: string;

    if (range) {
      matched = spec.values.filter((v) => {
        const n = firstNumber(v.value);
        return n !== null && range.test(n);
      });
      kind = "range";
      display = range.label;
    } else {
      const needle = text.toLowerCase();
      matched = spec.values.filter((v) =>
        v.value.toLowerCase().includes(needle),
      );
      kind = "text";
      display = `~ ${text}`;
    }

    if (matched.length === 0) return;

    const chip: FacetChip = {
      id: makeId(),
      kind,
      display,
      matchedValues: matched.length,
      pages: unionPages(...matched.map((m) => m.pages)),
    };

    setPicked((prev) =>
      prev.map((f) =>
        f.specKey === specKey ? { ...f, chips: [...f.chips, chip] } : f,
      ),
    );
  }

  function clearAll() {
    setPicked([]);
  }

  function toggleGroup(g: string) {
    setOpenGroups((prev) => ({ ...prev, [g]: !prev[g] }));
  }
  function expandAll() {
    const next: Record<string, boolean> = {};
    for (const g of groupedSpecs) next[g.group] = true;
    setOpenGroups(next);
  }
  function collapseAll() {
    const next: Record<string, boolean> = {};
    for (const g of groupedSpecs) next[g.group] = false;
    setOpenGroups(next);
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="flex h-[100dvh] flex-col bg-white">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 shrink-0 border-b border-ink-100 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
        <div className="flex h-14 items-center gap-2 pl-2 pr-3 md:h-16 md:gap-4 md:pr-6">
          {/* Mobile sidebar toggle */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-ink-200 bg-white hover:bg-ink-50 lg:hidden"
            aria-label="Open spec sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Image
              src="/logo.png"
              alt="Advanced Energy"
              width={180}
              height={48}
              className="h-8 w-auto object-contain md:h-12"
              priority
            />
            <span className="mono hidden rounded-pill border border-ink-200 px-2 py-0.5 text-[11px] text-ink-700 sm:inline">
              Spec Search
            </span>
          </Link>
          <Link
            href="/"
            className="mono hidden whitespace-nowrap text-[13px] text-black underline underline-offset-2 hover:text-ink-700 md:inline"
          >
            ← Catalogue
          </Link>
          <div className="flex-1" />
          <div className="flex shrink-0 items-center gap-2">
            <span className="mono hidden whitespace-nowrap text-[12px] text-ink-500 sm:inline">
              {specIndex.specs.length.toLocaleString()} specs
            </span>
            {picked.length > 0 && (
              <button
                onClick={clearAll}
                className="mono whitespace-nowrap rounded-pill border border-black bg-white px-2.5 py-1.5 text-[12px] font-medium text-black hover:bg-lime md:px-3"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── 2-column body: sidebar + main ──────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            aria-label="Close sidebar"
          />
        )}

        {/* ── Sidebar ───────────────────────────────────────────── */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[300px] flex-col border-r border-ink-100 bg-white transition-transform lg:static lg:z-0 lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          {/* Sidebar header */}
          <div className="shrink-0 border-b border-ink-100 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="mono text-[12px] font-bold uppercase tracking-wider text-black">
                스펙 카테고리
              </h2>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded text-ink-500 hover:bg-ink-50 lg:hidden"
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {/* Search input */}
            <div className="relative">
              <input
                value={specQuery}
                onChange={(e) => setSpecQuery(e.target.value)}
                placeholder="스펙 검색… (예: Size, Input)"
                className="mono h-9 w-full rounded-md border border-ink-200 bg-white pl-8 pr-7 text-[12px] text-black placeholder:text-ink-400 focus:border-black focus:outline-none"
              />
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400">
                <path d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              {specQuery && (
                <button
                  type="button"
                  onClick={() => setSpecQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[14px] leading-none text-ink-400 hover:text-black"
                  aria-label="Clear"
                >×</button>
              )}
            </div>
            {/* Toolbar: expand/collapse + show only picked */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={expandAll}
                className="mono rounded border border-ink-200 bg-white px-2 py-0.5 text-[10.5px] text-ink-700 hover:border-black hover:text-black"
              >전체 펼침</button>
              <button
                type="button"
                onClick={collapseAll}
                className="mono rounded border border-ink-200 bg-white px-2 py-0.5 text-[10.5px] text-ink-700 hover:border-black hover:text-black"
              >전체 접기</button>
              <button
                type="button"
                onClick={() => setShowOnlyPicked((v) => !v)}
                className={`mono rounded border px-2 py-0.5 text-[10.5px] ${
                  showOnlyPicked ? "border-black bg-lime text-black" : "border-ink-200 bg-white text-ink-700 hover:border-black hover:text-black"
                }`}
              >선택만 ({picked.length})</button>
            </div>
          </div>

          {/* Sidebar groups */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {visibleSpecs.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-ink-500">
                {showOnlyPicked
                  ? "선택된 스펙이 없습니다."
                  : "검색 결과가 없습니다."}
              </p>
            ) : (
              <ul>
                {visibleSpecs.map((g) => {
                  const isOpen = openGroups[g.group] ?? false;
                  const groupPickedCount = g.specs.filter((s) => pickedKeys.has(s.key)).length;
                  return (
                    <li key={g.group} className="border-b border-ink-100">
                      {/* Group header */}
                      <button
                        type="button"
                        onClick={() => toggleGroup(g.group)}
                        className="mono flex w-full items-center gap-2 px-4 py-2 text-left text-[12px] font-semibold uppercase tracking-wide hover:bg-ink-50"
                      >
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className={`shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}>
                          <path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="flex-1 text-black">{g.group}</span>
                        {groupPickedCount > 0 && (
                          <span className="rounded-full bg-lime px-1.5 py-0.5 text-[10px] font-medium text-black">
                            {groupPickedCount}
                          </span>
                        )}
                        <span className="text-[10.5px] text-ink-400">{g.specs.length}</span>
                      </button>
                      {/* Spec list */}
                      {isOpen && (
                        <ul className="border-t border-ink-100 bg-ink-50/40">
                          {g.specs.map((s) => {
                            const isPicked = pickedKeys.has(s.key);
                            return (
                              <li key={s.key}>
                                <button
                                  type="button"
                                  onClick={() => (isPicked ? removeSpec(s.key) : addSpec(s.key))}
                                  className={`mono group flex w-full items-center gap-2 px-4 py-1.5 text-left text-[12px] transition ${
                                    isPicked
                                      ? "bg-lime/40 text-black"
                                      : "text-ink-700 hover:bg-white hover:text-black"
                                  }`}
                                >
                                  {/* Checkbox */}
                                  <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                                    isPicked ? "border-black bg-black" : "border-ink-300 bg-white group-hover:border-black"
                                  }`}>
                                    {isPicked && (
                                      <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                                        <path d="M3 8.5L6.5 12L13 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    )}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate">{s.label}</span>
                                  <span className="shrink-0 text-[10.5px] text-ink-400">{s.valueCount}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Sidebar footer */}
          <div className="shrink-0 border-t border-ink-100 px-4 py-2">
            <div className="mono flex items-center justify-between text-[10.5px] text-ink-500">
              <span>
                <span className="font-semibold text-black">{picked.length}</span> 선택됨
              </span>
              <span>
                <span className="font-semibold text-black">{matchingModels.length.toLocaleString()}</span> / {catalog.models.length.toLocaleString()} 모델
              </span>
            </div>
          </div>
        </aside>

        {/* ── Main ───────────────────────────────────────────── */}
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          {picked.length === 0 ? (
            <div className="rounded-card border border-dashed border-ink-200 bg-white px-6 py-10 text-center">
              <h2 className="mono text-[16px] font-semibold text-black">
                스펙 쿼리 만들기
              </h2>
              <p className="mono mt-1 text-[13px] text-ink-500">
                좌측 사이드바의 카테고리에서 원하는 스펙을 클릭하여 추가하세요.<br/>
                각 필터마다 정확값(드롭다운) + 범위/부분일치(예{" "}
                <span className="rounded bg-ink-50 px-1.5 py-0.5 text-black">100-200</span>,{" "}
                <span className="rounded bg-ink-50 px-1.5 py-0.5 text-black">&gt;=48</span>,{" "}
                <span className="rounded bg-ink-50 px-1.5 py-0.5 text-black">VAC</span>) 입력 가능.
              </p>
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="mono mt-5 inline-flex items-center gap-1.5 rounded-pill border border-black bg-black px-4 py-2 text-[12px] font-semibold text-white hover:bg-lime hover:text-black lg:hidden"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                스펙 카테고리 열기
              </button>
            </div>
          ) : (
            <section className="space-y-3">
              {picked.map((facet) => {
                const spec = specsByKey.get(facet.specKey);
                if (!spec) return null;
                return (
                  <FacetCard
                    key={facet.specKey}
                    spec={spec}
                    facet={facet}
                    onRemove={() => removeSpec(facet.specKey)}
                    onPickValue={(v) => addValueChip(facet.specKey, v)}
                    onQuery={(q) => addQueryChip(facet.specKey, q)}
                    onRemoveChip={(id) => removeChip(facet.specKey, id)}
                  />
                );
              })}
            </section>
          )}

          {/* Matching models */}
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between border-b border-ink-100 pb-2">
              <h2 className="mono text-[14px] text-black">
                {matchingModels.length.toLocaleString()}
                <span className="text-ink-500"> matching models</span>
                {activeFacets.length > 0 && (
                  <span className="text-ink-500">
                    {" "}· out of {catalog.models.length.toLocaleString()}
                  </span>
                )}
              </h2>
              <span className="mono text-[12px] text-ink-500">
                {activeFacets.length} active filter{activeFacets.length === 1 ? "" : "s"}
              </span>
            </div>
            <ResultList
              items={matchingModels.slice(0, 100)}
              view="list"
              onOpen={(m) => setSelected(m)}
              highlightedId={selected?.modelKey ?? null}
            />
            {matchingModels.length > 100 && (
              <p className="mt-2 text-[12px] text-ink-500">
                Showing first 100 of {matchingModels.length}. Add more
                filters to narrow down.
              </p>
            )}
          </section>
        </main>
      </div>

      <DetailDrawer
        model={selected}
        related={[]}
        onClose={() => setSelected(null)}
        onSelect={(m) => setSelected(m)}
      />

      <BasketFab />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Facet card
// ─────────────────────────────────────────────────────────────────────────────

function FacetCard({
  spec,
  facet,
  onRemove,
  onPickValue,
  onQuery,
  onRemoveChip,
}: {
  spec: Spec;
  facet: PickedFacet;
  onRemove: () => void;
  onPickValue: (v: SpecValue) => void;
  onQuery: (q: string) => void;
  onRemoveChip: (chipId: string) => void;
}) {
  const [dropdownValue, setDropdownValue] = useState("");
  const [queryInput, setQueryInput] = useState("");

  const valuesByString = useMemo(() => {
    const map = new Map<string, SpecValue>();
    for (const v of spec.values) map.set(v.value, v);
    return map;
  }, [spec.values]);

  // How many catalogue values look numeric? If most are numeric, we hint
  // range syntax in the placeholder.
  const isNumericSpec = useMemo(() => {
    let n = 0;
    for (const v of spec.values) if (firstNumber(v.value) !== null) n++;
    return n >= Math.max(3, spec.values.length * 0.5);
  }, [spec.values]);

  const previewPredicate = useMemo(() => {
    const s = queryInput.trim();
    if (!s) return null;
    const r = parseRange(s);
    if (r) {
      const matches = spec.values.filter((v) => {
        const n = firstNumber(v.value);
        return n !== null && r.test(n);
      });
      return { kind: "range" as const, label: r.label, matches };
    }
    const needle = s.toLowerCase();
    const matches = spec.values.filter((v) =>
      v.value.toLowerCase().includes(needle),
    );
    return { kind: "text" as const, label: `~ ${s}`, matches };
  }, [queryInput, spec.values]);

  function commitQuery() {
    if (!queryInput.trim()) return;
    onQuery(queryInput);
    setQueryInput("");
  }

  function handleDropdown(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = valuesByString.get(e.target.value);
    if (v) onPickValue(v);
    setDropdownValue("");
  }

  return (
    <article className="rounded-card border border-ink-200 bg-white">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-ink-100 px-4 py-3">
        <div>
          <h3 className="mono text-[16px] font-semibold text-black">
            {spec.label}
          </h3>
          <p className="mono mt-0.5 text-[12px] text-ink-500">
            {spec.valueCount} distinct values · {spec.occurrenceCount}{" "}
            occurrences · {spec.groups.join(" / ")}
          </p>
        </div>
        <button
          onClick={onRemove}
          className="label !text-black underline underline-offset-2 hover:!text-ink-700"
          aria-label={`Remove ${spec.label} filter`}
        >
          Remove
        </button>
      </header>

      <div className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-2">
        {/* Dropdown: exact value pick */}
        <div>
          <label className="label">Pick exact value</label>
          <div className="relative mt-1.5">
            <select
              value={dropdownValue}
              onChange={handleDropdown}
              className="mono h-10 w-full appearance-none rounded-md border border-ink-200 bg-white pl-3 pr-9 text-[14px] text-black focus:border-black focus:outline-none"
            >
              <option value="">Select a value… ({spec.valueCount})</option>
              {spec.values.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.value}  ·  {v.count}×
                </option>
              ))}
            </select>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-500"
            >
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Free-text range / substring */}
        <div>
          <label className="label">
            {isNumericSpec ? "Range or substring" : "Substring search"}
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitQuery();
                }
              }}
              placeholder={
                isNumericSpec
                  ? "e.g. 100-200, >=48, <500, 3.3"
                  : "e.g. VAC, 48V, medical"
              }
              className="mono h-10 flex-1 rounded-md border border-ink-200 bg-white px-3 text-[14px] text-black placeholder:text-ink-400 focus:border-black focus:outline-none"
            />
            <button
              onClick={commitQuery}
              disabled={!previewPredicate || previewPredicate.matches.length === 0}
              className="mono h-10 shrink-0 rounded-pill border border-black bg-black px-3 text-[12px] font-medium text-white hover:bg-lime hover:!text-black disabled:border-ink-200 disabled:bg-white disabled:!text-ink-400"
            >
              Apply
            </button>
          </div>
          {queryInput.trim() && previewPredicate && (
            <p className="mono mt-1 text-[11px] text-ink-500">
              {previewPredicate.kind === "range" ? (
                <>
                  Range <span className="text-black">{previewPredicate.label}</span>
                </>
              ) : (
                <>
                  Substring{" "}
                  <span className="text-black">{previewPredicate.label}</span>
                </>
              )}
              {" → "}
              <span className="text-black">
                {previewPredicate.matches.length}
              </span>{" "}
              catalogue value
              {previewPredicate.matches.length === 1 ? "" : "s"} match
              {previewPredicate.matches.length > 0 && (
                <>
                  {" — "}
                  <span className="text-ink-700">
                    {previewPredicate.matches
                      .slice(0, 3)
                      .map((v) => truncate(v.value, 24))
                      .join(", ")}
                    {previewPredicate.matches.length > 3 ? "…" : ""}
                  </span>
                </>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Active chips for this facet */}
      {facet.chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-ink-100 bg-ink-50 px-4 py-2.5">
          <span className="label">Applied</span>
          {facet.chips.map((c) => (
            <span
              key={c.id}
              className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[12px] font-medium ${
                c.kind === "value"
                  ? "border-black bg-lime text-black"
                  : "border-black bg-white text-black"
              }`}
              title={
                c.kind === "value"
                  ? "Exact value"
                  : `${c.matchedValues} catalogue value(s) matched`
              }
            >
              <span className="mono">
                {c.kind === "value"
                  ? c.display
                  : `${c.kind === "range" ? "⇔" : "⌕"} ${c.display}`}
              </span>
              {c.kind !== "value" && (
                <span className="mono text-ink-500">
                  ({c.matchedValues})
                </span>
              )}
              <button
                onClick={() => onRemoveChip(c.id)}
                aria-label="Remove chip"
                className="text-black hover:text-ink-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
