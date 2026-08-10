"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

/**
 * Drop-in replacement for useState whose value is remembered in localStorage.
 * (공개 카탈로그 버전 — 서버/클라우드 동기화 없이 localStorage 만 사용.)
 *  - survives route navigation and full page reload
 *  - SSR-safe: renders `initial` on the server, hydrates after mount
 *  - JSON-serializable values only; each call needs a unique, stable `key`.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* corrupt JSON or storage unavailable */
    }
    hydrated.current = true;
  }, [key]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota / serialization failure — non-critical */
    }
  }, [key, value]);

  const setPersistent = useCallback<Dispatch<SetStateAction<T>>>(
    (next) => setValue(next),
    [],
  );

  return [value, setPersistent];
}
