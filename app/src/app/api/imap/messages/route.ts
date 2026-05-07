import { NextRequest, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;
  const host   = String(body.host ?? "");
  const port   = Number(body.port) || 993;
  const secure = body.ssl !== false && body.ssl !== "false";
  const user   = String(body.user ?? "");
  const pass   = String(body.pass ?? "");
  const limit  = Math.min(Number(body.limit) || 50, 200);

  if (!host || !user || !pass) {
    return NextResponse.json({ error: "IMAP 설정이 필요합니다 (host, user, pass)" }, { status: 400 });
  }

  console.log(`[IMAP] connecting → ${host}:${port} secure=${secure} user=${user}`);

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user, pass },
    logger: false,
    tls: { rejectUnauthorized: false },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });

  try {
    await client.connect();
    console.log(`[IMAP] connected`);

    const messages: unknown[] = [];

    const mailbox = await client.mailboxOpen("INBOX");
    const total = typeof mailbox === "object" && mailbox ? mailbox.exists : 0;
    console.log(`[IMAP] INBOX total=${total}`);

    if (total > 0) {
      const fetchCount = Math.min(limit, total);
      const start = Math.max(1, total - fetchCount + 1);

      for await (const msg of client.fetch(`${start}:${total}`, {
        uid: true,
        flags: true,
        envelope: true,
        bodyStructure: true,
        bodyParts: ["text", "1"],
        size: true,
      })) {
        try {
          const env = msg.envelope;
          const from = env?.from?.[0];
          const subject = env?.subject ?? "(제목 없음)";
          const date = env?.date ?? null;
          const isUnread = !msg.flags?.has("\\Seen");

          let preview = "";
          if (msg.bodyParts?.size) {
            const part = msg.bodyParts.get("text") ?? msg.bodyParts.get("1");
            if (part) {
              const buf = Buffer.isBuffer(part) ? part : Buffer.from(part as string, "binary");
              preview = buf.toString("utf8").slice(0, 130).replace(/[\r\n\t ]+/g, " ").trim();
            }
          }

          messages.push({
            entryId:        `imap-${msg.uid}`,
            conversationId: env?.messageId ?? `imap-${msg.uid}`,
            subject,
            senderName:  from?.name ?? from?.address ?? "",
            senderEmail: from?.address ?? "",
            receivedTime: date ? date.toISOString() : "",
            preview,
            isUnread,
            isToMe: false,
            attachmentCount: 0,
          });
        } catch {
          // skip individual message parse errors
        }
      }
    }

    await client.logout();
    console.log(`[IMAP] done. returned ${messages.length} messages`);
    return NextResponse.json(messages.reverse());
  } catch (e: unknown) {
    const msg = String(e);
    console.error(`[IMAP] FAILED host=${host} port=${port}:`, msg);
    try { await client.logout(); } catch {}
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
