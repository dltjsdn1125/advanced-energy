import { NextRequest, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export const preferredRegion = ["icn1", "nrt1", "sin1"]; // Seoul → Tokyo → Singapore (Korean mail servers)

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;
  const host   = String(body.host ?? "");
  const port   = Number(body.port) || 993;
  const secure = body.ssl !== false && body.ssl !== "false";
  const user   = String(body.user ?? "");
  const pass   = String(body.pass ?? "");
  const limit  = Math.min(Number(body.limit) || 50, 2000);

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
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 50_000,
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

      // Envelope + bodyStructure (metadata only, no body content).
      // bodyStructure lets us count attachments without fetching them.
      type BodyNode = { disposition?: string; childNodes?: BodyNode[] };
      function countAttachments(node: BodyNode | undefined): number {
        if (!node) return 0;
        let count = 0;
        if (node.disposition === "attachment") count += 1;
        for (const child of node.childNodes ?? []) count += countAttachments(child);
        return count;
      }

      for await (const msg of client.fetch(`${start}:${total}`, {
        uid: true,
        flags: true,
        envelope: true,
        bodyStructure: true,
      })) {
        try {
          const env = msg.envelope;
          const from = env?.from?.[0];
          const subject = env?.subject ?? "(제목 없음)";
          const date = env?.date ?? null;
          const isUnread = !msg.flags?.has("\\Seen");
          const attachmentCount = countAttachments(msg.bodyStructure as BodyNode | undefined);

          messages.push({
            entryId:        `imap-${msg.uid}`,
            conversationId: env?.messageId ?? `imap-${msg.uid}`,
            subject,
            senderName:  from?.name ?? from?.address ?? "",
            senderEmail: from?.address ?? "",
            receivedTime: date ? date.toISOString() : "",
            preview:        "",
            isUnread,
            isToMe: false,
            attachmentCount,
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
