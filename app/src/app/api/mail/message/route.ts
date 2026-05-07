import { NextRequest, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { simpleParser, type Attachment } from "mailparser";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    email,
    password,
    imapHost = "outlook.office365.com",
    imapPort = 993,
    uid,
    folder = "INBOX",
  } = body as Record<string, string | number>;

  if (!email || !password || !uid) {
    return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
  }

  const portNum = Number(imapPort) || 993;
  const client = new ImapFlow({
    host: String(imapHost) || "outlook.office365.com",
    port: portNum,
    secure: portNum !== 143,
    auth: { user: String(email), pass: String(password) },
    logger: false,
    tls: { rejectUnauthorized: false },
    greetingTimeout: 10000,
  });

  type MsgRecord = Record<string, unknown>;

  async function fetchFromFolder(folderName: string, baseSubject: string): Promise<MsgRecord[]> {
    const results: MsgRecord[] = [];
    const lock = await client.getMailboxLock(folderName);
    try {
      const rawUids = await client.search({ subject: baseSubject }, { uid: true });
      const uids = Array.isArray(rawUids) ? rawUids : [];
      if (uids.length === 0) return results;
      const recent = uids.slice(-20);
      for await (const msg of client.fetch(recent, { source: true }, { uid: true })) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
        results.push({
          uid: String(msg.uid ?? msg.seq),
          subject: parsed.subject ?? "",
          senderName: parsed.from?.value?.[0]?.name ?? "",
          senderEmail: parsed.from?.value?.[0]?.address ?? "",
          sentOn: parsed.date?.toISOString() ?? "",
          htmlBody: typeof parsed.html === "string" ? parsed.html : "",
          textBody: parsed.text ?? "",
          messageId: parsed.messageId ?? "",
          inReplyTo: parsed.inReplyTo ?? "",
          attachments: (parsed.attachments ?? [])
            .filter((a: Attachment) => !a.related && a.size < 15 * 1024 * 1024)
            .map((a: Attachment) => ({
              filename: a.filename ?? "attachment",
              contentType: a.contentType,
              size: a.size,
              content: (a.content as Buffer).toString("base64"),
            })),
        });
      }
    } finally {
      lock.release();
    }
    return results;
  }

  try {
    await client.connect();

    // Fetch the target message to get its subject
    let baseSubject = "";
    const currentFolder = String(folder);
    const firstLock = await client.getMailboxLock(currentFolder);
    try {
      const msgData = await client.fetchOne(String(uid), { source: true }, { uid: true });
      const msgSource = msgData && typeof msgData === "object" && "source" in msgData ? (msgData as { source?: Buffer }).source : undefined;
      if (!msgSource) {
        return NextResponse.json({ error: "메시지를 찾을 수 없습니다" }, { status: 404 });
      }
      const parsed = await simpleParser(msgSource);
      baseSubject = (parsed.subject ?? "").replace(/^(re|fwd?|fw)\s*:\s*/gi, "").trim();
      if (!baseSubject) baseSubject = parsed.subject ?? "";
    } finally {
      firstLock.release();
    }

    if (!baseSubject) {
      await client.logout();
      return NextResponse.json({ thread: [] });
    }

    const currentMsgs = await fetchFromFolder(currentFolder, baseSubject);

    let sentMsgs: MsgRecord[] = [];
    if (currentFolder !== "Sent Items") {
      try {
        sentMsgs = await fetchFromFolder("Sent Items", baseSubject);
      } catch { /* sent folder may not exist or have a different name */ }
    }

    await client.logout();

    const all = [...currentMsgs, ...sentMsgs];
    const seen = new Set<string>();
    const deduped = all.filter(m => {
      const key = String(m.messageId ?? `${m.senderEmail}-${m.sentOn}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    deduped.sort((a, b) =>
      new Date(String(a.sentOn)).getTime() - new Date(String(b.sentOn)).getTime()
    );

    return NextResponse.json({ thread: deduped });
  } catch (e: unknown) {
    try { client.close(); } catch {}
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
