import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Diagnostic: verify token via getMe, list recent chat IDs via getUpdates
export async function POST(request: NextRequest) {
  const { token, chatId } = await request.json();
  if (!token) return NextResponse.json({ ok: false, error: "token 필요" }, { status: 400 });

  const result: Record<string, unknown> = { tokenLen: String(token).length, chatIdProvided: chatId };

  // Step 1: getMe — verifies the token works
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const me = await meRes.json();
    result.getMe = me;
    if (!me.ok) {
      return NextResponse.json({ ok: false, step: "getMe", ...result });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, step: "getMe", error: String(e), ...result });
  }

  // Step 2: getUpdates — lists recent messages, shows actual chat IDs
  try {
    const upRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const updates = await upRes.json();
    if (!updates.ok) {
      result.getUpdates = updates;
      return NextResponse.json({ ok: false, step: "getUpdates", ...result });
    }

    // Extract unique chats
    type Update = { message?: { chat?: { id?: number; type?: string; title?: string; username?: string; first_name?: string } } };
    const chats = new Map<number, { id: number; type: string; name: string }>();
    for (const u of (updates.result ?? []) as Update[]) {
      const c = u?.message?.chat;
      if (c?.id) {
        chats.set(c.id, {
          id: c.id,
          type: c.type ?? "?",
          name: c.title ?? c.username ?? c.first_name ?? "(no name)",
        });
      }
    }
    result.recentChats = Array.from(chats.values());
    result.updateCount = updates.result?.length ?? 0;

    if (chats.size === 0) {
      return NextResponse.json({
        ok: false,
        step: "noUpdates",
        hint: "봇에게 한 번도 메시지를 보낸 적이 없습니다. Telegram에서 봇을 찾아 /start 또는 아무 메시지나 보낸 후 다시 시도하세요.",
        ...result,
      });
    }

    // Step 3: try sendMessage with provided chatId if any
    if (chatId) {
      const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "✅ 진단 테스트 — 이 메시지를 받으셨다면 모든 설정이 올바릅니다." }),
      });
      const send = await sendRes.json();
      result.sendMessage = send;
      result.ok = send.ok;
      if (!send.ok) {
        const matched = result.recentChats as Array<{ id: number; name: string; type: string }>;
        const matchInfo = matched.find(c => String(c.id) === String(chatId));
        result.hint = matchInfo
          ? "Chat ID는 등록되어 있지만 메시지 전송에 실패했습니다. 봇이 차단되었을 수 있습니다."
          : `입력한 Chat ID(${chatId})가 봇과 대화한 적 없는 ID입니다. 위의 recentChats 중 본인 ID를 사용하세요.`;
      }
      return NextResponse.json(result);
    }

    return NextResponse.json({ ok: true, hint: "recentChats에 표시된 ID 중 본인 chat_id를 사용하세요.", ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), ...result });
  }
}
