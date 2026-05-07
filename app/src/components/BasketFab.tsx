"use client";

import { useState } from "react";
import { useBasket } from "@/lib/basket";
import ComposePane from "./ComposePane";

// Floating action button — fixed bottom-right across the app. Shows a badge
// with the current basket count; clicking opens the Outlook-style compose
// pane so the user can email their selections to a customer.

export default function BasketFab() {
  const { items } = useBasket();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-pill border-2 border-black bg-black px-4 py-3 text-lime shadow-card transition hover:bg-lime hover:text-black"
        title="저장된 선택 · 이메일 보내기"
        aria-label={`저장된 선택 ${items.length}개 — 이메일 작성`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 7h16l-1.5 10.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 7z" />
          <path d="M9 7V5a3 3 0 0 1 6 0v2" />
        </svg>
        <span className="mono text-[13px] font-semibold">저장 목록</span>
        {items.length > 0 && (
          <span className="mono ml-1 grid h-6 min-w-6 place-items-center rounded-pill bg-lime px-1.5 text-[12px] font-bold text-black group-hover:bg-black group-hover:text-lime">
            {items.length}
          </span>
        )}
      </button>

      {open && <ComposePane onClose={() => setOpen(false)} />}
    </>
  );
}
