import { NextRequest, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { simpleParser, type Attachment } from "mailparser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export const preferredRegion = ["icn1", "nrt1", "sin1"];

// Fetch a single message by UID with full body + attachments.
// Used when the user opens an IMAP-prefixed message in the inbox list.
export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;
  const host   = String(body.host ?? "");
  const port   = Number(body.port) || 993;
  const secure = body.ssl !== false && body.ssl !== "false";
  const user   = String(body.user ?? "");
  const pass   = String(body.pass ?? "");
  const uid    = String(body.uid ?? "");
  const folder = String(body.folder ?? "INBOX");

  if (!host || !user || !pass || !uid) {
    return NextResponse.json({ error: "host, user, pass, uid 필수" }, { status: 400 });
  }

  const client = new ImapFlow({
    host, port, secure,
    auth: { user, pass },
    logger: false,
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 25_000,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    let msgRecord: Record<string, unknown> | null = null;
    try {
      const fetchedMsg = await client.fetchOne(
        uid,
        { source: true, envelope: true, flags: true },
        { uid: true },
      );
      const src = fetchedMsg && typeof fetchedMsg === "object" && "source" in fetchedMsg
        ? (fetchedMsg as { source?: Buffer }).source
        : undefined;
      if (!src) {
        return NextResponse.json({ error: "메시지를 찾을 수 없습니다" }, { status: 404 });
      }
      const parsed = await simpleParser(src);

      const recipients: Array<{ name: string; email: string; rtype: number }> = [];
      const toObj = parsed.to;
      const toList = Array.isArray(toObj) ? toObj.flatMap(o => o.value ?? []) : (toObj?.value ?? []);
      for (const r of toList) {
        if (r.address) recipients.push({ name: r.name ?? "", email: r.address, rtype: 1 });
      }
      const ccObj = parsed.cc;
      const ccList = Array.isArray(ccObj) ? ccObj.flatMap(o => o.value ?? []) : (ccObj?.value ?? []);
      for (const r of ccList) {
        if (r.address) recipients.push({ name: r.name ?? "", email: r.address, rtype: 2 });
      }

      const attachments = (parsed.attachments ?? [])
        .filter((a: Attachment) => !a.related && a.size < 25 * 1024 * 1024)
        .map((a: Attachment) => ({
          name: a.filename ?? "attachment",
          size: a.size,
          contentType: a.contentType ?? "application/octet-stream",
          content: (a.content as Buffer).toString("base64"),
        }));

      msgRecord = {
        entryId:     `imap-${uid}`,
        subject:     parsed.subject ?? "",
        senderName:  parsed.from?.value?.[0]?.name ?? "",
        senderEmail: parsed.from?.value?.[0]?.address ?? "",
        sentOn:      parsed.date?.toISOString() ?? "",
        body:        parsed.text ?? "",
        htmlBody:    typeof parsed.html === "string" ? parsed.html : "",
        attachments,
        recipients,
      };
    } finally {
      lock.release();
    }
    await client.logout();
    return NextResponse.json([msgRecord]);
  } catch (e: unknown) {
    try { client.close(); } catch {}
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
