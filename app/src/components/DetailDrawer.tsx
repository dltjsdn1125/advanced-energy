"use client";

import { useEffect, useMemo, useState } from "react";
import type { Model } from "@/lib/types";
import { assetSrc, getOrderingTablesForModel, getSpecIndex } from "@/lib/data";
import OrderingConfigurator from "./OrderingConfigurator";
import { useBasket, modelToBasketItem } from "@/lib/basket";

interface Props {
  model: Model | null;
  related: Model[];
  onClose: () => void;
  onSelect: (m: Model) => void;
}

// --- helpers ---------------------------------------------------------------

const BULLET_SPLIT = /\s*[■▪•●◆▶▷]\s*/u;

const MM_PER_INCH = 25.4;

// Convert an inch number to mm, 1-decimal, trimming trailing .0.
function inchToMm(n: number): string {
  const mm = n * MM_PER_INCH;
  const rounded = Math.round(mm * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}

// Heuristic: is this string a dimensional value in inches?
// Catches: "4.0\"", "4.00 in", "4.00 x 2.50 x 1.25 in", "4.0 inches"
// Skips anything with explicit mm/cm/m/V/A/W/Hz, or with no number.
const SIZE_HINT = /(size|dimension|footprint|length|width|height|depth|thickness|package)/i;
const INCH_MARKER = /(\"|\bin\b|\binches?\b)/i;
const MM_MARKER = /(\bmm\b|\bcm\b)/i;
const NUMBER_RE = /\d+(?:\.\d+)?/g;
const DIM_SEP_RE = /\s*[x×]\s*/i;

// Decide if the value is inch-dimensional and transform it so every numeric
// component is followed by " [NNmm]". If not, return the value unchanged.
function appendMmIfInch(value: string, hint: string = ""): string {
  if (!value) return value;
  if (MM_MARKER.test(value)) return value; // already metric
  const marked =
    INCH_MARKER.test(value) || SIZE_HINT.test(hint) || DIM_SEP_RE.test(value);
  if (!marked) return value;
  // Don't touch electrical values (V/A/W/Hz/Ω) that also happen to have × in them.
  if (/\b(V|A|W|Hz|Ω|VAC|VDC|mA|kW|KW|MHz|kHz)\b/.test(value)) return value;
  // Extract numbers and format each with " [Nmm]" inline.
  return value.replace(NUMBER_RE, (n) => {
    const v = parseFloat(n);
    if (!isFinite(v) || v <= 0) return n;
    return `${n} [${inchToMm(v)} mm]`;
  });
}

// Convenience wrapper for DetailDrawer contexts that don't know the label
// hint; uses the value alone.
function withMm(value: string): string {
  return appendMmIfInch(value);
}

function splitBullets(line: string): string[] {
  return line
    .split(BULLET_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean);
}

function groupByPage(lines: string[], pages: number[]) {
  // The parser preserves the line's order but doesn't tag a page on each
  // contextLine. We group sequentially: divide lines across pages in order,
  // and tag as many pages as we have. When counts don't align, spill into
  // the first page so nothing is lost.
  if (!lines.length) return [] as { page: number; items: string[] }[];
  const p = pages.length ? pages : [0];
  const perPage = Math.ceil(lines.length / p.length);
  return p.map((pg, i) => ({
    page: pg,
    items: lines.slice(i * perPage, (i + 1) * perPage),
  }));
}

// --- small subcomponents ---------------------------------------------------

function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "lime" | "dark";
}) {
  const cls =
    tone === "lime"
      ? "border-black bg-lime text-black"
      : tone === "dark"
      ? "border-black bg-black text-white"
      : "border-ink-200 bg-white text-black";
  return (
    <span
      className={`mono inline-flex items-center rounded-pill border px-2.5 py-0.5 text-[12px] ${cls}`}
    >
      {children}
    </span>
  );
}

function SpecRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[128px,1fr] items-start gap-3 border-b border-ink-100 py-2.5 last:border-b-0">
      <span className="label pt-0.5">{label}</span>
      <span className="mono text-[14px] leading-snug text-black">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-card border border-ink-200 bg-white px-3 py-2.5">
      <span className="label !text-ink-500">{label}</span>
      <span className="mono text-[16px] font-semibold leading-tight text-black">
        {value}
      </span>
    </div>
  );
}

// --- main ------------------------------------------------------------------

export default function DetailDrawer({
  model,
  related,
  onClose,
  onSelect,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const { add, remove, has } = useBasket();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (model) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [model, onClose]);

  useEffect(() => {
    setCopied(false);
    setSaved(false);
  }, [model?.modelKey]);

  const pageGroups = useMemo(
    () => (model ? groupByPage(model.contextLines, model.pages) : []),
    [model],
  );

  // Every catalogue spec whose printed value appears on one of this model's
  // pages. Gives the drawer a full per-model spec dump sourced from the
  // extracted tables (see specs.json), grouped by section banner.
  const fullSpecs = useMemo(() => {
    if (!model) return [] as { group: string; rows: { label: string; values: string[] }[] }[];
    const idx = getSpecIndex();
    const pageSet = new Set(model.pages);
    const byGroup = new Map<string, { label: string; values: string[] }[]>();
    for (const spec of idx.specs) {
      const hits: string[] = [];
      for (const v of spec.values) {
        if (v.pages.some((p) => pageSet.has(p))) hits.push(v.value);
      }
      if (hits.length === 0) continue;
      const grp = spec.groups[0] ?? "General";
      if (!byGroup.has(grp)) byGroup.set(grp, []);
      byGroup.get(grp)!.push({ label: spec.label, values: hits });
    }
    const order = [
      "Summary",
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
      "General",
    ];
    const keys = [...byGroup.keys()].sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return keys.map((group) => ({
      group,
      rows: byGroup
        .get(group)!
        .sort((a, b) => a.label.localeCompare(b.label)),
    }));
  }, [model]);

  const orderingTables = useMemo(
    () => (model ? getOrderingTablesForModel(model) : []),
    [model],
  );

  if (!model) return null;

  const specSeen = new Set<string>();
  const primaryWatt = model.watts[0] ?? "—";
  const primaryVolt = model.volts[0] ?? "—";
  const primaryAmp = model.amps[0] ?? "—";

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/50 transition-opacity"
        onClick={onClose}
      />
      <aside
        className="fixed right-0 top-0 z-40 flex h-[100dvh] w-full max-w-[680px] flex-col border-l border-black bg-white shadow-card"
        role="dialog"
        aria-labelledby="drawer-title"
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="flex items-center justify-between gap-3 border-b border-ink-100 px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {model.category && <Chip tone="dark">{model.category}</Chip>}
              {model.lineage && <Chip>{model.lineage}</Chip>}
              {model.subcategory && <Chip>{model.subcategory}</Chip>}
            </div>
            <h2
              id="drawer-title"
              className="mono mt-1.5 truncate text-[25px] font-semibold tracking-tightest text-black"
            >
              {model.model}
            </h2>
            <div className="truncate text-[14px] text-ink-700">
              {model.section ?? "Unclassified"}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <button
              onClick={() => {
                if (!model) return;
                if (has(model.modelKey)) {
                  remove(model.modelKey);
                  setSaved(false);
                } else {
                  add(modelToBasketItem(model));
                  setSaved(true);
                  setTimeout(() => setSaved(false), 1500);
                }
              }}
              className={`mono rounded-pill border px-3 py-1.5 text-[12px] font-semibold transition ${
                has(model.modelKey)
                  ? "border-black bg-black text-lime hover:bg-lime hover:text-black"
                  : "border-black bg-lime text-black hover:bg-black hover:text-lime"
              }`}
              title={
                has(model.modelKey)
                  ? "저장 목록에서 제거"
                  : "저장 목록에 추가 — 나중에 고객에게 이메일로 발송"
              }
            >
              {has(model.modelKey)
                ? "저장됨 · 제거"
                : saved
                  ? "저장됨 ✓"
                  : "＋ 선택 저장"}
            </button>
            <button
              onClick={onClose}
              className="label rounded-pill border border-ink-200 bg-white px-3 py-1.5 !text-black hover:bg-ink-50"
              aria-label="Close detail"
            >
              Close · Esc
            </button>
          </div>
        </header>

        {/* ── Body ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Hero image */}
          {model.primaryImage && (
            <section className="mb-5">
              <div className="relative grid place-items-center rounded-card border border-ink-200 bg-white p-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetSrc(model.primaryImage)}
                  alt={model.model}
                  className="max-h-[280px] w-auto object-contain"
                />
                {model.imageSource === "series-hero" && (
                  <span className="absolute left-3 top-3 rounded-pill border border-black bg-white px-2 py-0.5 text-[11px] font-medium text-black">
                    Series photo
                  </span>
                )}
              </div>
              {model.images.length > 1 && (
                <div className="mt-2 flex gap-2 overflow-x-auto">
                  {model.images.map((img) => (
                    <div
                      key={img.path}
                      className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md border border-ink-200 bg-white"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={assetSrc(img.path)}
                        alt=""
                        loading="lazy"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* At-a-glance stats */}
          <section className="grid grid-cols-3 gap-2">
            <Stat label="Power" value={primaryWatt} />
            <Stat label="Voltage" value={primaryVolt} />
            <Stat label="Current" value={primaryAmp} />
          </section>

          {/* Full specifications */}
          <section className="mt-6">
            <h3 className="label mb-2">Specifications</h3>
            <div className="rounded-card border border-ink-200 bg-white px-4">
              <SpecRow label="Model" value={model.model} />
              <SpecRow
                label="Input Range"
                value={model.input ?? "see source context"}
              />
              <SpecRow
                label="Output Power"
                value={
                  model.watts.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {model.watts.map((w) => {
                        if (specSeen.has(`w-${w}`)) return null;
                        specSeen.add(`w-${w}`);
                        return <Chip key={w}>{w}</Chip>;
                      })}
                    </div>
                  ) : (
                    "—"
                  )
                }
              />
              <SpecRow
                label="Output Voltage"
                value={
                  model.volts.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {model.volts.map((v) => {
                        if (specSeen.has(`v-${v}`)) return null;
                        specSeen.add(`v-${v}`);
                        return <Chip key={v}>{v}</Chip>;
                      })}
                    </div>
                  ) : (
                    "—"
                  )
                }
              />
              <SpecRow
                label="Output Current"
                value={
                  model.amps.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {model.amps.map((a) => {
                        if (specSeen.has(`a-${a}`)) return null;
                        specSeen.add(`a-${a}`);
                        return <Chip key={a}>{a}</Chip>;
                      })}
                    </div>
                  ) : (
                    "—"
                  )
                }
              />
              <SpecRow
                label="Catalogue Pages"
                value={
                  <div className="flex flex-wrap gap-1.5">
                    {model.pages.map((p) => (
                      <a
                        key={p}
                        href={`docs/AE%20Catalogue2026.pdf#page=${p}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mono rounded-pill border border-ink-200 bg-white px-2.5 py-0.5 text-[12px] text-black hover:bg-lime-soft hover:border-black"
                      >
                        p.{p}
                      </a>
                    ))}
                  </div>
                }
              />
              <SpecRow
                label="Taxonomy"
                value={[
                  model.category,
                  model.lineage,
                  model.subcategory,
                  model.section,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            </div>
          </section>

          {/* Every catalogue spec whose value is printed on this model's page */}
          {fullSpecs.length > 0 && (
            <section className="mt-6">
              <h3 className="label mb-2">
                All Catalogue Specs
                <span className="ml-2 !text-ink-500">
                  ({fullSpecs.reduce((n, g) => n + g.rows.length, 0)})
                </span>
              </h3>
              <div className="space-y-3">
                {fullSpecs.map((g) => (
                  <div
                    key={g.group}
                    className="rounded-card border border-ink-200 bg-white"
                  >
                    <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2">
                      <span className="label">{g.group}</span>
                      <span className="mono text-[11px] text-ink-500">
                        {g.rows.length} field{g.rows.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="px-4">
                      {g.rows.map((row) => (
                        <SpecRow
                          key={row.label}
                          label={row.label}
                          value={
                            <div className="flex flex-wrap gap-1.5">
                              {row.values.map((v, i) => (
                                <Chip key={`${v}-${i}`}>
                                  {appendMmIfInch(v, row.label)}
                                </Chip>
                              ))}
                            </div>
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Interactive model-number configurator — options come straight from
              the extracted Ordering Information rows, never fabricated. */}
          {orderingTables.length > 0 && <OrderingConfigurator model={model} />}

          {/* Ordering Information — exact catalogue table(s) */}
          {orderingTables.length > 0 && (
            <section className="mt-6">
              <h3 className="label mb-2">
                Ordering Information
                <span className="ml-2 !text-ink-500">
                  ({orderingTables.reduce((n, t) => n + t.rows.length, 0)}{" "}
                  part numbers)
                </span>
              </h3>
              <div className="space-y-3">
                {orderingTables.map((t) => (
                  <div
                    key={t.page}
                    className="overflow-hidden rounded-card border border-ink-200 bg-white"
                  >
                    <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2">
                      <div className="min-w-0">
                        <span className="label">
                          {t.section ?? "Ordering table"}
                        </span>
                        <span className="ml-2 mono text-[11px] text-ink-500">
                          {t.rows.length} row{t.rows.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <a
                        href={`docs/AE%20Catalogue2026.pdf#page=${t.page}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mono text-[12px] text-black underline underline-offset-2 hover:text-ink-700"
                      >
                        p.{t.page} ↗
                      </a>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="mono w-full border-collapse text-[12.5px]">
                        <thead>
                          <tr className="bg-ink-50 text-left">
                            {t.headers.map((h, i) => (
                              <th
                                key={`${h}-${i}`}
                                className="whitespace-nowrap border-b border-ink-200 px-3 py-2 font-semibold text-black"
                              >
                                {h || "—"}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {t.rows.map((row, ri) => {
                            const isSelf = row[0] === model.modelKey;
                            return (
                              <tr
                                key={ri}
                                className={
                                  isSelf
                                    ? "bg-lime"
                                    : ri % 2 === 0
                                    ? "bg-white"
                                    : "bg-ink-50/40"
                                }
                              >
                                {row.map((cell, ci) => (
                                  <td
                                    key={ci}
                                    className={`align-top border-b border-ink-100 px-3 py-1.5 ${
                                      ci === 0
                                        ? "font-semibold text-black"
                                        : "text-ink-700"
                                    }`}
                                  >
                                    {appendMmIfInch(cell, t.headers[ci] ?? "")}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Features — bullets per line */}
          {model.contextLines.length > 0 && (
            <section className="mt-6">
              <h3 className="label mb-2">Features &amp; Notes</h3>
              <ul className="rounded-card border border-ink-200 bg-white">
                {model.contextLines.flatMap((l, li) =>
                  splitBullets(l).map((b, bi) => (
                    <li
                      key={`${li}-${bi}`}
                      className="flex gap-3 border-b border-ink-100 px-4 py-2 text-[14px] leading-relaxed text-black last:border-b-0"
                    >
                      <span
                        aria-hidden
                        className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-pill bg-lime"
                      />
                      <span className="mono flex-1 break-words">{b}</span>
                    </li>
                  )),
                )}
              </ul>
            </section>
          )}

          {/* Source lines grouped by page */}
          {pageGroups.length > 0 && (
            <section className="mt-6">
              <h3 className="label mb-2">Source Lines</h3>
              <div className="space-y-3">
                {pageGroups.map((g) => (
                  <details
                    key={g.page}
                    className="rounded-card border border-ink-200 bg-white"
                    open
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5">
                      <span className="label">
                        Page {g.page}
                        <span className="ml-2 !text-ink-500">
                          ({g.items.length})
                        </span>
                      </span>
                      <a
                        href={`docs/AE%20Catalogue2026.pdf#page=${g.page}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mono text-[12px] text-black underline underline-offset-2 hover:text-ink-700"
                      >
                        Open PDF ↗
                      </a>
                    </summary>
                    <ul className="border-t border-ink-100 bg-ink-50 px-3 py-2">
                      {g.items.map((l, i) => (
                        <li
                          key={i}
                          className="mono border-b border-ink-100 py-1 text-[13px] leading-relaxed text-black last:border-b-0"
                        >
                          {l}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Related */}
          {related.length > 0 && (
            <section className="mt-6 mb-2">
              <h3 className="label mb-2">
                Related in {model.section ?? "Series"}
                <span className="ml-2 !text-ink-500">({related.length})</span>
              </h3>
              <ul className="row-divider overflow-hidden rounded-card border border-ink-200">
                {related.slice(0, 12).map((m) => (
                  <li key={m.modelKey}>
                    <button
                      onClick={() => onSelect(m)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-lime-soft"
                    >
                      {m.primaryImage ? (
                        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-ink-200 bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={assetSrc(m.primaryImage)}
                            alt=""
                            loading="lazy"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-10 shrink-0 rounded-md border border-ink-200 bg-white" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="mono truncate text-[14px] text-black">
                          {m.model}
                        </div>
                        <div className="mono truncate text-[12px] text-ink-500">
                          {[m.watts[0], m.volts[0]].filter(Boolean).join(" · ") ||
                            `p.${m.pages[0]}`}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ── Footer actions ─────────────────────────────────────── */}
        <footer className="flex items-center justify-between gap-3 border-t border-ink-100 px-6 py-3">
          <a
            href={`docs/AE%20Catalogue2026.pdf#page=${model.pages[0]}`}
            target="_blank"
            rel="noreferrer"
            className="mono rounded-pill border border-black bg-lime px-4 py-2 text-[13px] font-semibold text-black hover:bg-black hover:text-lime"
          >
            Open PDF · p.{model.pages[0]}
          </a>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(model.model);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="label rounded-pill border border-ink-200 bg-white px-3 py-2 !text-black hover:bg-ink-50"
          >
            {copied ? "Copied ✓" : "Copy SKU"}
          </button>
        </footer>
      </aside>
    </>
  );
}
