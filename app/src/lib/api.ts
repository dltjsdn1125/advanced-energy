import { createBrowserClient } from "@supabase/ssr";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Singleton: keeps Supabase auto-refresh timer alive across calls
let _sb: ReturnType<typeof createBrowserClient> | null = null;
function getSb() {
  if (!_sb) {
    _sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _sb;
}

async function getToken(): Promise<string | null> {
  const sb = getSb();
  // getUser() contacts Supabase server → validates & auto-refreshes expired token
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token ?? null;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}
