"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

// Global doc-attachment queue — PDF links selected from the catalogue's
// AE 공식 문서 panel, held in localStorage until the user sends an email.

export interface DocAttachment {
  url: string;
  title: string;
  docType: string;
  productTitle: string;
  addedAt: number;
}

const STORAGE_KEY = "ae2026:docattach:v1";

function readStore(): DocAttachment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeStore(items: DocAttachment[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* quota */ }
}

type Listener = () => void;
const listeners = new Set<Listener>();
let cached: DocAttachment[] | null = null;
const EMPTY_SNAPSHOT: DocAttachment[] = [];

function getSnapshot(): DocAttachment[] {
  if (cached === null) cached = readStore();
  return cached;
}
function getServerSnapshot(): DocAttachment[] { return EMPTY_SNAPSHOT; }

function mutate(next: DocAttachment[]) {
  cached = next;
  writeStore(next);
  listeners.forEach((l) => l());
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useDocAttachments() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) { cached = readStore(); listeners.forEach((l) => l()); }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((doc: Omit<DocAttachment, "addedAt">) => {
    const next = [...getSnapshot()];
    if (!next.some((x) => x.url === doc.url)) {
      next.push({ ...doc, addedAt: Date.now() });
      mutate(next);
    }
  }, []);

  const remove = useCallback((url: string) => {
    mutate(getSnapshot().filter((x) => x.url !== url));
  }, []);

  const clear = useCallback(() => mutate([]), []);

  const has = useCallback(
    (url: string) => items.some((x) => x.url === url),
    [items],
  );

  return { items, add, remove, clear, has };
}
