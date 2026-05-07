"use client";

import { useCallback, useSyncExternalStore } from "react";
import { BUILTIN_TEMPLATES } from "./composeTemplateSeed";

// localStorage-backed compose templates. A template captures the editable
// header + body text fragments so a user can reuse a customer-specific salutation
// and subject without retyping. Items (basket) and To/Cc are deliberately NOT
// stored — those are per-send values.

export interface ComposeTemplate {
  id: string;
  name: string;
  subject: string;
  intro: string;
  signature?: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "ae2026:compose-templates:v1";

// Stable empty string — getServerSnapshot MUST return a cached primitive,
// not a new object, or useSyncExternalStore throws an infinite-loop error.
const SERVER_SNAPSHOT = "";

function readUser(): ComposeTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is ComposeTemplate =>
        !!t && typeof t.id === "string" && typeof t.name === "string",
    );
  } catch {
    return [];
  }
}

function writeUser(list: ComposeTemplate[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}

function subscribe(cb: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (!e.key || e.key === STORAGE_KEY) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

function getSnapshot(): string {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  return window.localStorage.getItem(STORAGE_KEY) ?? SERVER_SNAPSHOT;
}

function getServerSnapshot(): string {
  return SERVER_SNAPSHOT;
}

export function useComposeTemplates() {
  // Storage string as snapshot — cheap to compare and changes together with
  // writeUser's synthetic storage event.
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const user = readUser();
  const all = [...BUILTIN_TEMPLATES, ...user] as ComposeTemplate[];

  const save = useCallback(
    (name: string, subject: string, intro: string, signature?: string): ComposeTemplate => {
      const trimmed = name.trim() || "이름 없는 템플릿";
      const now = Date.now();
      const list = readUser();
      const existing = list.find((t) => t.name === trimmed);
      let updated: ComposeTemplate;
      if (existing) {
        updated = { ...existing, subject, intro, signature, updatedAt: now };
        writeUser(list.map((t) => (t.id === existing.id ? updated : t)));
      } else {
        updated = {
          id: `tpl-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          name: trimmed,
          subject,
          intro,
          signature,
          createdAt: now,
          updatedAt: now,
        };
        writeUser([updated, ...list]);
      }
      return updated;
    },
    [],
  );

  const remove = useCallback((id: string) => {
    if (id.startsWith("builtin-")) return;
    writeUser(readUser().filter((t) => t.id !== id));
  }, []);

  const isBuiltIn = (id: string) => id.startsWith("builtin-");

  return { templates: all, save, remove, isBuiltIn };
}
