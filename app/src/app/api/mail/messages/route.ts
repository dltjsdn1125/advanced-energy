import { NextRequest, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";

export const dynamic = "force-dynamic";

function hasAttachNode(bs: unknown): boolean {
  if (!bs || typeof bs !== "object") return false;
  const o = bs as Record<string, unknown>;
  const disp = String((o.disposition as Record<string, unknown>)?.type ?? "").toLowerCase();
  if (disp === "attachment") return true;
  const kids = o.childNodes as unknown[] | undefined;
  return !!(kids?.length && kids.some(hasAttachNode));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    email,
    password,
    imapHost = "outlook.office365.com",
    imapPort = 993,
    folder = "INBOX",
  } = body as Record<string, string | number>;

  if (!email || !password) {
    return NextResponse.json({ error: "이메일과 비밀번호를 입력하세요" }, { status: 400 });
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

  try {
    await client.connect();
    const lock = await client.getMailboxLock(String(folder));
    const messages: unknown[] = [];

    try {
      const mailbox = client.mailbox as unknown as Record<string, number>;
      const total = mailbox.exists ?? 0;
      if (total > 0) {
        const start = Math.max(1, total - 499);
        for await (const msg of client.fetch(`${start}:*`, {
          uid: true,
          envelope: true,
          flags: true,
          bodyStructure: true,
        })) {
          const from = msg.envelope?.from?.[0];
          messages.push({
            uid: String(msg.uid ?? msg.seq),
            subject: msg.envelope?.subject || "(제목 없음)",
            senderName: from?.name || from?.address || "",
            senderEmail: from?.address || "",
            receivedTime: msg.envelope?.date?.toISOString() ?? "",
            isUnread: !msg.flags?.has("\\Seen"),
            hasAttachments: hasAttachNode(msg.bodyStructure),
            preview: "",
          });
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    messages.reverse();
    return NextResponse.json({ messages });
  } catch (e: unknown) {
    try { client.close(); } catch {}
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
