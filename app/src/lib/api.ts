import { createClient } from "./supabase";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getToken(forceRefresh = false): Promise<string | null> {
  const sb = createClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const now = Math.floor(Date.now() / 1000);
  // Force refresh if requested, or if token expires within 5 minutes, or already expired
  if (forceRefresh || (session.expires_at ?? 0) - now < 300) {
    const { data } = await sb.auth.refreshSession();
    if (data.session) return data.session.access_token;
    // Refresh failed — return existing token as last resort
    return session.access_token;
  }
  return session.access_token;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const makeHeaders = (t: string | null): HeadersInit => ({
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  });

  const res = await fetch(`${BASE}${path}`, { ...options, headers: makeHeaders(token) });

  // On 401, force-refresh the token once and retry
  if (res.status === 401) {
    const fresh = await getToken(true);
    if (fresh && fresh !== token) {
      const retry = await fetch(`${BASE}${path}`, { ...options, headers: makeHeaders(fresh) });
      if (!retry.ok) {
        const text = await retry.text();
        throw new Error(`API ${retry.status}: ${text}`);
      }
      return retry.json() as Promise<T>;
    }
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}
