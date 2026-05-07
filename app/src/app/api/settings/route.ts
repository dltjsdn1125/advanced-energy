import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const POP3_FIELDS = new Set(["pop_host", "pop_port", "pop_ssl", "pop_user", "pop_pass", "pop_leave_on_server"]);

async function getUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
  });
  if (!res.ok) return null;
  const data = await res.json() as { id?: string };
  return data?.id ?? null;
}

function db() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await db()
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? {});
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const payload = { ...body, user_id: userId };

  const { data, error } = await db()
    .from("user_settings")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    // POP3 columns may not exist yet — retry without them
    const core: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (!POP3_FIELDS.has(k)) core[k] = v;
    }
    const { data: data2, error: error2 } = await db()
      .from("user_settings")
      .upsert(core, { onConflict: "user_id" })
      .select()
      .single();
    if (error2) return NextResponse.json({ error: error2.message }, { status: 500 });
    return NextResponse.json(data2 ?? {});
  }
  return NextResponse.json(data ?? {});
}
