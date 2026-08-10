"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { Model } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Saved-selection basket — client-only, persisted in localStorage. Users save
// models (optionally with a configured SKU + the matching ordering row) and
// later compose an Outlook-style email bundling the selections.
// ─────────────────────────────────────────────────────────────────────────────

export interface BasketItem {
  modelKey: string;
  model: string;
  category: string | null;
  lineage: string | null;
  section: string | null;
  watts: string[];
  volts: string[];
  input: string | null;
  primaryImage: string | null;
  // Configurator snapshot (optional — present when user clicked Save from the
  // ordering configurator with a narrowed-down selection).
  configuredSKU?: string;
  configuredHeaders?: string[];
  configuredRow?: string[];
  orderingPage?: number;
  // Free-form note from the user.
  note?: string;
  addedAt: number;
}

const STORAGE_KEY = "ae2026:basket:v1";

function readStore(): BasketItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(items: BasketItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // quota or serialization — non-fatal; basket just won't persist.
  }
}

// Small pub/sub so every mounted component stays in sync across the app
// (floating button, drawers, detail pane) without prop drilling.
type Listener = () => void;
const listeners = new Set<Listener>();
let cached: BasketItem[] | null = null;

// 서버 스냅샷은 반드시 안정된 참조여야 한다. 매번 새 []를 반환하면
// useSyncExternalStore 가 스냅샷이 변한 것으로 판단해 무한 렌더 루프가 발생.
const EMPTY_SNAPSHOT: BasketItem[] = [];

function getSnapshot(): BasketItem[] {
  if (cached === null) cached = readStore();
  return cached;
}

function getServerSnapshot(): BasketItem[] {
  return EMPTY_SNAPSHOT;
}

function mutate(next: BasketItem[]) {
  cached = next;
  writeStore(next);
  listeners.forEach((l) => l());
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

export function modelToBasketItem(
  m: Model,
  extras?: Partial<
    Pick<
      BasketItem,
      "configuredSKU" | "configuredHeaders" | "configuredRow" | "orderingPage" | "note"
    >
  >,
): BasketItem {
  return {
    modelKey: m.modelKey,
    model: m.model,
    category: m.category,
    lineage: m.lineage,
    section: m.section,
    watts: m.watts,
    volts: m.volts,
    input: m.input,
    primaryImage: m.primaryImage,
    addedAt: Date.now(),
    ...extras,
  };
}

export function useBasket() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Cross-tab sync — if another window edits the basket, re-read our store.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        cached = readStore();
        listeners.forEach((l) => l());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((item: BasketItem) => {
    const next = [...getSnapshot()];
    const existing = next.findIndex((x) => x.modelKey === item.modelKey);
    if (existing >= 0) {
      next[existing] = { ...next[existing], ...item, addedAt: Date.now() };
    } else {
      next.push(item);
    }
    mutate(next);
  }, []);

  const remove = useCallback((modelKey: string) => {
    mutate(getSnapshot().filter((x) => x.modelKey !== modelKey));
  }, []);

  const clear = useCallback(() => mutate([]), []);

  const updateNote = useCallback((modelKey: string, note: string) => {
    const next = getSnapshot().map((x) =>
      x.modelKey === modelKey ? { ...x, note } : x,
    );
    mutate(next);
  }, []);

  const has = useCallback(
    (modelKey: string) => items.some((x) => x.modelKey === modelKey),
    [items],
  );

  return { items, add, remove, clear, updateNote, has };
}
