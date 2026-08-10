"use client";

import { useEffect, useState } from "react";
import { useBasket } from "@/lib/basket";
import { useDocAttachments } from "@/lib/docAttachments";

// Floating action button — fixed top-right. Shows the count of saved products
// and documents; clicking opens a simple saved-list panel (view / remove).
// (공개 카탈로그 버전 — 이메일 작성 기능은 제외.)
export default function BasketFab() {
  const { items, remove, clear } = useBasket();
  const { items: docItems, remove: removeDoc, clear: clearDocs } = useDocAttachments();
  const [open, setOpen] = useState(false);
  const totalCount = items.length + docItems.length;

  useEffect(() => {
    const openPane = () => setOpen(true);
    window.addEventListener("ae:open-basket", openPane);
    return () => window.removeEventListener("ae:open-basket", openPane);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group fixed top-2 right-3 z-[45] flex items-center gap-1.5 rounded-pill border border-black bg-black px-2.5 py-1.5 text-lime shadow-md transition hover:bg-lime hover:text-black"
        title="저장된 선택"
        aria-label={`저장 ${totalCount}개`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 7h16l-1.5 10.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 7z" />
          <path d="M9 7V5a3 3 0 0 1 6 0v2" />
        </svg>
        <span className="mono text-[11px] font-semibold">저장 목록</span>
        {totalCount > 0 && (
          <span className="mono grid h-4 min-w-4 place-items-center rounded-pill bg-lime px-1 text-[10px] font-bold text-black group-hover:bg-black group-hover:text-lime">
            {totalCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[46] bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="fixed right-0 top-0 z-[47] flex h-[100dvh] w-full max-w-[380px] flex-col border-l border-ink-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <span className="mono text-[14px] font-semibold text-black">
                저장 목록 · {totalCount}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 text-[16px] leading-none text-ink-500 hover:text-black"
                aria-label="닫기"
              >
                ×
              </button>
            </header>

            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {totalCount === 0 && (
                <p className="mono text-[13px] text-ink-500">
                  저장된 항목이 없습니다. 제품 상세에서 저장할 수 있습니다.
                </p>
              )}

              {items.map((it) => (
                <div
                  key={it.modelKey}
                  className="flex items-center justify-between gap-2 rounded-md border border-ink-200 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="mono truncate text-[13px] font-medium text-black">
                      {it.model}
                    </div>
                    {it.section && (
                      <div className="truncate text-[11px] text-ink-500">{it.section}</div>
                    )}
                  </div>
                  <button
                    onClick={() => remove(it.modelKey)}
                    className="shrink-0 text-[16px] leading-none text-ink-400 hover:text-black"
                    aria-label="삭제"
                  >
                    ×
                  </button>
                </div>
              ))}

              {docItems.map((d) => (
                <div
                  key={d.url}
                  className="flex items-center justify-between gap-2 rounded-md border border-ink-200 px-3 py-2"
                >
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 truncate text-[12px] text-black underline underline-offset-2"
                  >
                    {d.title}
                  </a>
                  <button
                    onClick={() => removeDoc(d.url)}
                    className="shrink-0 text-[16px] leading-none text-ink-400 hover:text-black"
                    aria-label="삭제"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {totalCount > 0 && (
              <footer className="border-t border-ink-100 px-4 py-3">
                <button
                  onClick={() => {
                    clear();
                    clearDocs();
                  }}
                  className="mono w-full rounded-md border border-ink-200 py-2 text-[13px] text-ink-700 hover:bg-ink-50"
                >
                  전체 삭제
                </button>
              </footer>
            )}
          </aside>
        </>
      )}
    </>
  );
}
