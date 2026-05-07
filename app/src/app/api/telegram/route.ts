import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { token, chatId, text } = await request.json();

  if (!token || !chatId || !text) {
    return NextResponse.json({ error: "token, chatId, text 필수" }, { status: 400 });
  }

  const MAX_LEN = 4096;
  const chunks: string[] = [];
  let remaining = text as string;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_LEN) {
      chunks.push(remaining);
      break;
    }
    let cut = remaining.lastIndexOf("\n", MAX_LEN);
    if (cut <= 0) cut = MAX_LEN;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }

  try {
    for (const chunk of chunks) {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: "Markdown" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // If Markdown parse fails, retry as plain text
        if ((err as { description?: string })?.description?.includes("parse")) {
          const res2 = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: chunk }),
          });
          if (!res2.ok) {
            const err2 = await res2.json().catch(() => ({}));
            return NextResponse.json({ error: `Telegram 오류: ${JSON.stringify(err2)}` }, { status: res2.status });
          }
        } else {
          return NextResponse.json({ error: `Telegram 오류: ${JSON.stringify(err)}` }, { status: res.status });
        }
      }
    }
    return NextResponse.json({ ok: true, chunks: chunks.length });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
