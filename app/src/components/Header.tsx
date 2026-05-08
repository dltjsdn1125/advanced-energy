"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface Props {
  query: string;
  onQuery: (v: string) => void;
  totalModels: number;
  view: "list" | "grid";
  onView: (v: "list" | "grid") => void;
  onFilterOpen?: () => void;
}

export default function Header({
  query,
  onQuery,
  totalModels,
  view,
  onView,
  onFilterOpen,
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close menu on route navigation
  useEffect(() => {
    if (menuOpen) setMenuOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
      {/* ── Main row ─────────────────────────────────────────────────── */}
      <div className="flex h-14 items-center gap-2 pl-2 pr-3 md:h-16 md:gap-4 md:pl-2 md:pr-6">
        {/* Search bar (always visible, shrinks on mobile) */}
        <div className="min-w-0 flex-1">
          <div className="group flex h-9 items-center rounded-pill border border-ink-200 bg-white px-3 focus-within:border-black focus-within:shadow-ring md:mx-auto md:h-10 md:max-w-[420px] md:px-4 lg:max-w-[560px]">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              className="mr-1.5 shrink-0 text-ink-500 md:mr-2 md:h-4 md:w-4 md:text-black"
            >
              <path
                d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <input
              ref={ref}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search models, specs…"
              className="mono h-full min-w-0 flex-1 bg-transparent text-[13px] text-black placeholder:text-ink-400 focus:outline-none md:text-[14px]"
              spellCheck={false}
              autoComplete="off"
            />
            {query && (
              <button
                onClick={() => onQuery("")}
                className="ml-1 shrink-0 text-[16px] leading-none text-ink-400 hover:text-black md:hidden"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
            <kbd className="mono ml-2 hidden items-center gap-1 rounded-[4px] border border-ink-200 bg-white px-1.5 text-[11px] text-ink-500 lg:flex">
              Ctrl K
            </kbd>
          </div>
        </div>

        {/* Desktop right section */}
        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <Link
            href="/filter/"
            className="mono whitespace-nowrap rounded-pill border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-black hover:bg-lime"
          >
            Filter →
          </Link>
          <Link
            href="/finder/"
            className="mono whitespace-nowrap rounded-pill border border-black bg-lime px-3 py-1.5 text-[12px] font-semibold text-black hover:bg-black hover:text-lime"
          >
            Finder →
          </Link>
          <Link
            href="/search/"
            className="mono whitespace-nowrap rounded-pill border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-black hover:bg-lime"
          >
            Search →
          </Link>
          <Link
            href="/rfq/"
            className="mono whitespace-nowrap rounded-pill border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-black hover:bg-lime"
          >
            RFQ →
          </Link>
          <Link
            href="/outlook/"
            className="mono whitespace-nowrap rounded-pill border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-black hover:bg-lime"
          >
            Outlook →
          </Link>
          <span className="mono hidden whitespace-nowrap text-[12px] text-ink-500 xl:inline">
            {totalModels.toLocaleString()} indexed
          </span>
          <div className="flex items-center rounded-pill border border-ink-200 p-0.5">
            <button
              onClick={() => onView("list")}
              aria-pressed={view === "list"}
              className={`label rounded-pill px-2.5 py-1 transition ${
                view === "list"
                  ? "bg-black !text-white"
                  : "!text-ink-700 hover:!text-black"
              }`}
              title="List view"
            >
              List
            </button>
            <button
              onClick={() => onView("grid")}
              aria-pressed={view === "grid"}
              className={`label rounded-pill px-2.5 py-1 transition ${
                view === "grid"
                  ? "bg-black !text-white"
                  : "!text-ink-700 hover:!text-black"
              }`}
              title="Grid view"
            >
              Grid
            </button>
          </div>
        </div>

        {/* Mobile: filter icon + view toggle + hamburger */}
        <div className="flex shrink-0 items-center gap-1.5 md:hidden">
          {onFilterOpen && (
            <button
              onClick={onFilterOpen}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white active:bg-ink-50"
              aria-label="필터 열기"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 6h16M7 12h10M10 18h4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
          <div className="flex items-center rounded-pill border border-ink-200 p-0.5">
            <button
              onClick={() => onView("list")}
              aria-pressed={view === "list"}
              className={`label rounded-pill px-2 py-0.5 text-[10px] transition ${
                view === "list" ? "bg-black !text-white" : "!text-ink-700"
              }`}
            >
              List
            </button>
            <button
              onClick={() => onView("grid")}
              aria-pressed={view === "grid"}
              className={`label rounded-pill px-2 py-0.5 text-[10px] transition ${
                view === "grid" ? "bg-black !text-white" : "!text-ink-700"
              }`}
            >
              Grid
            </button>
          </div>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 active:bg-ink-50"
            aria-label="메뉴"
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 18L18 6M6 6l12 12"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Mobile hamburger dropdown ────────────────────────────────── */}
      {menuOpen && (
        <nav className="border-t border-ink-100 bg-white px-4 py-3 md:hidden">
          <div className="grid grid-cols-1 gap-2">
            <Link
              href="/filter/"
              onClick={() => setMenuOpen(false)}
              className="mono flex items-center justify-between rounded-lg border border-ink-200 px-4 py-3 text-[13px] font-medium text-black active:bg-ink-50"
            >
              <span>체크박스 필터</span>
              <span className="text-ink-400">→</span>
            </Link>
            <Link
              href="/finder/"
              onClick={() => setMenuOpen(false)}
              className="mono flex items-center justify-between rounded-lg border border-black bg-lime px-4 py-3 text-[13px] font-semibold text-black"
            >
              <span>제품 파인더</span>
              <span>→</span>
            </Link>
            <Link
              href="/search/"
              onClick={() => setMenuOpen(false)}
              className="mono flex items-center justify-between rounded-lg border border-ink-200 px-4 py-3 text-[13px] font-medium text-black active:bg-ink-50"
            >
              <span>스펙 고급검색</span>
              <span className="text-ink-400">→</span>
            </Link>
            <Link
              href="/rfq/"
              onClick={() => setMenuOpen(false)}
              className="mono flex items-center justify-between rounded-lg border border-ink-200 px-4 py-3 text-[13px] font-medium text-black active:bg-ink-50"
            >
              <span>RFQ 사양 요청표</span>
              <span className="text-ink-400">→</span>
            </Link>
            <Link
              href="/outlook/"
              onClick={() => setMenuOpen(false)}
              className="mono flex items-center justify-between rounded-lg border border-ink-200 px-4 py-3 text-[13px] font-medium text-black active:bg-ink-50"
            >
              <span>Outlook 메일</span>
              <span className="text-ink-400">→</span>
            </Link>
            <div className="flex items-center justify-between border-t border-ink-100 pt-2">
              <span className="mono text-[11px] text-ink-500">
                {totalModels.toLocaleString()} 모델 인덱스
              </span>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
