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
  if (!m.primaryImage) {
    return (
      <div className="grid h-28 w-28 shrink-0 place-items-center rounded-md border border-ink-200 bg-white">
        <ThumbIcon active={active} />
      </div>
    );
  }
  return (
    <div
      className={`grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-md border ${
        active ? "border-black bg-white" : "border-ink-200 bg-white"
      }`}
    >
      {/* Native img to avoid next/image config on static export. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={assetSrc(m.primaryImage)}
        alt={m.model}
        loading="lazy"
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}

function wattsLabel(watts: string[]): string {
  if (!watts.length) return "";
  if (watts.length === 1) return watts[0];
  return `${watts[0]}-${watts[watts.length - 1]}`;
}

function primarySpec(m: Model): string {
  const bits: string[] = [];
  if (m.input) bits.push(m.input);
  const wl = wattsLabel(m.watts);
  if (wl) bits.push(wl);
  if (m.volts.length) bits.push(m.volts.slice(0, 2).join(" / "));
  if (!bits.length && m.contextLines[0]) return m.contextLines[0];
  return bits.join(" · ");
}

function rightPrimary(m: Model): string {
  return wattsLabel(m.watts) || m.section || "—";
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
                <p className="line-clamp-2 text-[14px] text-ink-700">
                  {m.contextLines[0] ?? primarySpec(m)}
                </p>
                <div className="mt-auto flex w-full items-center justify-between text-[12px]">
                  <span className="mono text-ink-500">p.{m.pages[0]}</span>
                  <span className="mono text-black">{rightPrimary(m)}</span>
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
                <p className="mt-0.5 truncate text-[14px] text-ink-700">
                  {primarySpec(m)}
                </p>
              </div>
              <div className="hidden flex-col items-end text-right md:flex">
                <span className="mono text-[14px] text-black">
                  {rightPrimary(m)}
                </span>
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
