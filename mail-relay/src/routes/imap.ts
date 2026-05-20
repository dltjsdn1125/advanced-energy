import type { Request, Response } from "express";
import { ImapFlow } from "imapflow";

export async function imapRoute(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const host   = String(body.host ?? "");
  const port   = Number(body.port) || 993;
  const secure = body.ssl !== false && body.ssl !== "false";
  const user   = String(body.user ?? "");
  const pass   = String(body.pass ?? "");
  const limit  = Math.min(Number(body.limit) || 50, 2000);

  if (!host || !user || !pass) {
    res.status(400).json({ error: "IMAP 설정이 필요합니다 (host, user, pass)" });
    return;
  }

  const hostVariants: string[] = [host];
  const noPrefix = host.replace(/^(mail|webmail|smtp|pop|pop3)\./i, "");
  if (noPrefix !== host) {
    hostVariants.push(`imap.${noPrefix}`, noPrefix);
  } else {
    hostVariants.push(`imap.${host}`, `mail.${host}`);
  }

  let lastError = "";
  const MAX_ATTEMPTS = 3;
  for (const tryHost of hostVariants) {
    let connected = false;
    let client: ImapFlow | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !connected; attempt++) {
      client = new ImapFlow({
        host: tryHost,
        port,
        secure,
        auth: { user, pass },
        logger: false,
        tls: { rejectUnauthorized: false },
        connectionTimeout: 25_000,
        greetingTimeout: 25_000,
        socketTimeout: 50_000,
      });
      try {
        await client.connect();
        connected = true;
      } catch (e) {
        lastError = String(e);
        try { await client.logout(); } catch { /* noop */ }
        client = null;
        if (attempt < MAX_ATTEMPTS) await new Promise(r => setTimeout(r, 1500));
      }
    }
    if (!connected || !client) continue;

    try {
      const messages: unknown[] = [];
      const mailbox = await client.mailboxOpen("INBOX");
      const total = typeof mailbox === "object" && mailbox ? mailbox.exists : 0;
      if (total > 0) {
        const fetchCount = Math.min(limit, total);
        const start = Math.max(1, total - fetchCount + 1);
        for await (const msg of client.fetch(`${start}:${total}`, {
          uid: true,
          flags: true,
          envelope: true,
        })) {
          try {
            const env = msg.envelope;
            const from = env?.from?.[0];
            messages.push({
              entryId:        `imap-${msg.uid}`,
              conversationId: env?.messageId ?? `imap-${msg.uid}`,
              subject:        env?.subject ?? "(제목 없음)",
              senderName:     from?.name ?? from?.address ?? "",
              senderEmail:    from?.address ?? "",
              receivedTime:   env?.date ? new Date(env.date).toISOString() : "",
              preview:        "",
              isUnread:       !msg.flags?.has("\\Seen"),
              isToMe:         false,
              attachmentCount: 0,
            });
          } catch { /* skip parse errors */ }
        }
      }
      await client.logout();
      res.json(messages.reverse());
      return;
    } catch (e) {
      lastError = String(e);
      try { await client.logout(); } catch { /* noop */ }
    }
  }
  res.status(500).json({ error: `IMAP 연결 실패 (${hostVariants.join(", ")}): ${lastError}` });
}
