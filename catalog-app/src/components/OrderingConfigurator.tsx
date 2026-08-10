"use client";

import { useEffect, useMemo, useState } from "react";
import type { Model } from "@/lib/types";
import { getOrderingTablesForModel } from "@/lib/data";
import { useBasket, modelToBasketItem } from "@/lib/basket";

// Heuristic: which column of an ordering table holds the final SKU / model
// number? Matches against the header row only — the values are sourced from
// the extracted catalog rows, never fabricated.
const MODEL_HDR_TOKENS = [
  "model number",
  "model no",
  "model #",
  "part number",
  "p/n",
  "order code",
  "ordering code",
  "type",
];

function isModelCol(h: string): boolean {
  const t = (h ?? "").toLowerCase().trim();
  if (!t) return false;
  return MODEL_HDR_TOKENS.some((tok) => t === tok || t.includes(tok));
}

function pickModelColIdx(headers: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    if (isModelCol(headers[i])) return i;
  }
  return 0;
}

function uniqueValues(rows: string[][], colIdx: number): string[] {
  const s = new Set<string>();
  for (const r of rows) {
    const v = (r[colIdx] ?? "").trim();
    if (v) s.add(v);
  }
  return [...s].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export default function OrderingConfigurator({ model }: { model: Model }) {
  const tables = useMemo(() => getOrderingTablesForModel(model), [model]);
  const [tableIdx, setTableIdx] = useState(0);
  const [selections, setSelections] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const { add } = useBasket();

  useEffect(() => {
    setTableIdx(0);
    setSelections({});
    setCopied(false);
    setSaved(false);
  }, [model.modelKey]);

  const safeIdx = Math.min(tableIdx, Math.max(0, tables.length - 1));
  const table = tables[safeIdx] ?? null;

  const modelCol = useMemo(
    () => (table ? pickModelColIdx(table.headers) : 0),
    [table],
  );

  const optionCols = useMemo(
    () =>
      table
        ? table.headers.map((_, i) => i).filter((i) => i !== modelCol)
        : [],
    [table, modelCol],
  );

  const matchingRows = useMemo(() => {
    if (!table) return [] as string[][];
    return table.rows.filter((r) =>
      optionCols.every((ci) => {
        const pick = selections[ci];
        if (!pick) return true;
        return (r[ci] ?? "").trim() === pick;
      }),
    );
  }, [table, optionCols, selections]);

  if (!table) return null;

  const setPick = (ci: number, v: string) =>
    setSelections((prev) => {
      const next = { ...prev };
      if (v === "") delete next[ci];
      else next[ci] = v;
      return next;
    });

  const resetAll = () => setSelections({});

  const finalSKU = matchingRows.length === 1 ? matchingRows[0][modelCol] : null;
  const preselectedSKU =
    matchingRows.length > 1 ? matchingRows[0][modelCol] : null;

  const copyFinal = () => {
    if (!finalSKU) return;
    navigator.clipboard?.writeText(finalSKU);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const saveFinal = () => {
    if (!table) return;
    // 확정된 행이 있으면 그 행을, 없으면 첫 매칭을 스냅샷으로 저장한다.
    const row = matchingRows[0];
    add(
      modelToBasketItem(model, {
        configuredSKU: finalSKU ?? row?.[modelCol],
        configuredHeaders: table.headers,
        configuredRow: row,
        orderingPage: table.page,
      }),
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <section className="mt-6">
      <h3 className="label mb-2">
        Configure &amp; Order
        <span className="ml-2 !text-ink-500">
          (pick options → final part number)
        </span>
      </h3>

      <div className="rounded-card border-2 border-black bg-lime-soft p-4">
        {tables.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            <span className="label mr-2 self-center">Ordering table</span>
            {tables.map((t, i) => (
              <button
                key={t.page}
                onClick={() => {
                  setTableIdx(i);
                  setSelections({});
                }}
                className={`mono rounded-pill border px-2.5 py-1 text-[12px] transition ${
                  i === safeIdx
                    ? "border-black bg-black text-lime"
                    : "border-ink-200 bg-white text-black hover:border-black"
                }`}
                title={t.section ?? `p.${t.page}`}
              >
                p.{t.page} · {t.rows.length} row{t.rows.length === 1 ? "" : "s"}
              </button>
            ))}
          </div>
        )}

        {optionCols.length === 0 ? (
          <p className="mono text-[13px] text-ink-700">
            This ordering table has only a single column — no options to pick.
          </p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {optionCols.map((ci) => {
              // Options for this column are derived from rows that still
              // satisfy the OTHER selections, so cascading choices stay valid.
              const otherPicks: Record<number, string> = {};
              for (const [k, v] of Object.entries(selections)) {
                if (Number(k) !== ci) otherPicks[Number(k)] = v;
              }
              const availableRows = table.rows.filter((r) =>
                Object.entries(otherPicks).every(
                  ([k, v]) => (r[Number(k)] ?? "").trim() === v,
                ),
              );
              const options = uniqueValues(availableRows, ci);
              return (
                <label
                  key={ci}
                  className="flex flex-col gap-1 rounded-card border border-ink-200 bg-white px-3 py-2"
                >
                  <span className="label">
                    {table.headers[ci] || `Option ${ci + 1}`}
                  </span>
                  <select
                    value={selections[ci] ?? ""}
                    onChange={(e) => setPick(ci, e.target.value)}
                    className="mono rounded-md border border-ink-200 bg-white px-2 py-1 text-[13px] text-black"
                  >
                    <option value="">— Any —</option>
                    {options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/15 pt-3">
          <div className="min-w-0 flex-1">
            <span className="label">Final model number</span>
            <div className="mono mt-0.5 truncate text-[18px] font-semibold text-black">
              {finalSKU ??
                (matchingRows.length === 0
                  ? "No matching row — relax a filter"
                  : `${matchingRows.length} candidates — narrow further`)}
            </div>
            {!finalSKU && preselectedSKU && (
              <span className="mono mt-0.5 block text-[11px] text-ink-500">
                First candidate: {preselectedSKU}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={copyFinal}
              disabled={!finalSKU}
              className="mono rounded-pill border border-black bg-lime px-3 py-1.5 text-[12px] font-semibold text-black transition hover:bg-black hover:text-lime disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? "Copied ✓" : "Copy SKU"}
            </button>
            <button
              onClick={saveFinal}
              disabled={matchingRows.length === 0}
              className="mono rounded-pill border border-black bg-black px-3 py-1.5 text-[12px] font-semibold text-lime transition hover:bg-lime hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
              title="선택 내역을 저장하여 나중에 이메일로 고객에게 발송"
            >
              {saved ? "저장됨 ✓" : "＋ 선택 저장"}
            </button>
            <button
              onClick={resetAll}
              className="mono rounded-pill border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-black hover:bg-ink-50"
            >
              Reset
            </button>
          </div>
        </div>

        {matchingRows.length > 0 && matchingRows.length <= 12 && (
          <div className="mt-3 border-t border-black/15 pt-3">
            <span className="label mb-1.5 block">
              Matching row{matchingRows.length === 1 ? "" : "s"} (
              {matchingRows.length})
            </span>
            <div className="overflow-x-auto rounded-card border border-ink-200 bg-white">
              <table className="mono w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="bg-ink-50 text-left">
                    {table.headers.map((h, i) => (
                      <th
                        key={`${h}-${i}`}
                        className="whitespace-nowrap border-b border-ink-200 px-3 py-1.5 font-semibold text-black"
                      >
                        {h || "—"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matchingRows.map((row, ri) => (
                    <tr
                      key={ri}
                      className={ri % 2 === 0 ? "bg-white" : "bg-ink-50/40"}
                    >
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className={`align-top border-b border-ink-100 px-3 py-1.5 ${
                            ci === modelCol
                              ? "font-semibold text-black"
                              : "text-ink-700"
                          }`}
                        >
                          {cell || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
