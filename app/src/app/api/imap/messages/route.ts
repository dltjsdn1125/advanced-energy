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

  // Try the user-supplied host first; if that fails on connect, retry with a
  // few common variants (some users save the webmail host instead of IMAP).
  const hostVariants: string[] = [host];
  const noPrefix = host.replace(/^(mail|webmail|smtp|pop|pop3)\./i, "");
  if (noPrefix !== host) {
    hostVariants.push(`imap.${noPrefix}`);
    hostVariants.push(noPrefix);
  } else {
    hostVariants.push(`imap.${host}`);
    hostVariants.push(`mail.${host}`);
  }

  let lastError = "";
  for (const tryHost of hostVariants) {
    console.log(`[IMAP] connecting → ${tryHost}:${port} secure=${secure} user=${user}`);
    const client = new ImapFlow({
      host: tryHost,
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
      console.log(`[IMAP] connected to ${tryHost}`);

      const messages: unknown[] = [];
      const mailbox = await client.mailboxOpen("INBOX");
      const total = typeof mailbox === "object" && mailbox ? mailbox.exists : 0;
      console.log(`[IMAP] INBOX total=${total}`);

      if (total > 0) {
        const fetchCount = Math.min(limit, total);
        const start = Math.max(1, total - fetchCount + 1);

        // Envelope-only fetch (no body, no bodyStructure) — fastest and most
        // compatible. attachmentCount stays 0 in the list; the 📎 icon will
        // appear after the user opens the message (thread fetch returns it).
        for await (const msg of client.fetch(`${start}:${total}`, {
          uid: true,
          flags: true,
          envelope: true,
        })) {
          try {
            const env = msg.envelope;
            const from = env?.from?.[0];
            const subject = env?.subject ?? "(제목 없음)";
            const date = env?.date ?? null;
            const isUnread = !msg.flags?.has("\\Seen");

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
              attachmentCount: 0,
            });
          } catch { /* skip individual message parse errors */ }
        }
      }

      await client.logout();
      console.log(`[IMAP] done. host=${tryHost} returned ${messages.length} messages`);
      return NextResponse.json(messages.reverse());
    } catch (e: unknown) {
      lastError = String(e);
      console.error(`[IMAP] FAILED host=${tryHost}:${port}:`, lastError);
      try { await client.logout(); } catch {}
      // Keep trying next variant
    }
  }

  return NextResponse.json(
    { error: `IMAP 연결 실패 (${hostVariants.join(", ")}): ${lastError}` },
    { status: 500 },
  );
}
