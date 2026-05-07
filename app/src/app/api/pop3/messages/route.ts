import { NextRequest, NextResponse } from "next/server";
import * as tls from "tls";
import * as net from "net";
import { simpleParser } from "mailparser";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

function tcpConnect(host: string, port: number, ssl: boolean): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("연결 시간 초과 (15초)")), 15_000);
    let sock: net.Socket;
    const onConnect = () => { clearTimeout(timeout); resolve(sock); };
    if (ssl) {
      sock = tls.connect({ host, port, rejectUnauthorized: false }, onConnect);
    } else {
      sock = net.createConnection({ host, port }, onConnect);
    }
    sock.on("error", (e) => { clearTimeout(timeout); reject(e); });
  });
}

class Pop3Session {
  private buf = "";
  private pending: Array<(line: string) => void> = [];
  private ready: string[] = [];

  constructor(private sock: net.Socket) {
    sock.setEncoding("binary");
    sock.on("data", (chunk: string) => {
      this.buf += chunk;
      const parts = this.buf.split("\r\n");
      this.buf = parts.pop()!;
      for (const line of parts) {
        const res = this.pending.shift();
        if (res) res(line);
        else this.ready.push(line);
      }
    });
  }

  readLine(timeoutMs = 30_000): Promise<string> {
    if (this.ready.length) return Promise.resolve(this.ready.shift()!);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("POP3 읽기 시간 초과")), timeoutMs);
      this.pending.push((l) => { clearTimeout(t); resolve(l); });
    });
  }

  async readMultiLine(): Promise<string[]> {
    const lines: string[] = [];
    for (;;) {
      const line = await this.readLine();
      if (line === ".") break;
      lines.push(line.startsWith("..") ? line.slice(1) : line);
    }
    return lines;
  }

  send(cmd: string) {
    this.sock.write(cmd + "\r\n", "binary");
  }

  async cmd(command: string): Promise<string> {
    this.send(command);
    return this.readLine();
  }

  destroy() {
    try { this.sock.destroy(); } catch {}
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;
  const host   = String(body.host ?? "");
  const port   = Number(body.port) || 995;
  const ssl    = body.ssl !== false && body.ssl !== "false";
  const user   = String(body.user ?? "");
  const pass   = String(body.pass ?? "");
  const limit  = Math.min(Number(body.limit) || 50, 200);

  if (!host || !user || !pass) {
    return NextResponse.json({ error: "POP3 설정이 필요합니다 (host, user, pass)" }, { status: 400 });
  }

  let session: Pop3Session | null = null;
  try {
    const sock = await tcpConnect(host, port, ssl);
    session = new Pop3Session(sock);

    const greeting = await session.readLine();
    if (!greeting.startsWith("+OK")) throw new Error(`POP3 인사 실패: ${greeting}`);

    const userResp = await session.cmd(`USER ${user}`);
    if (!userResp.startsWith("+OK")) throw new Error(`USER 실패: ${userResp}`);

    const passResp = await session.cmd(`PASS ${pass}`);
    if (!passResp.startsWith("+OK")) throw new Error(`인증 실패: ${passResp}`);

    const statResp = await session.cmd("STAT");
    if (!statResp.startsWith("+OK")) throw new Error(`STAT 실패: ${statResp}`);
    const total = parseInt(statResp.split(" ")[1] ?? "0", 10);

    const messages: unknown[] = [];
    const fetchCount = Math.min(limit, total);

    for (let i = total; i > total - fetchCount && i >= 1; i--) {
      try {
        // TOP: get headers + 5 body lines for preview
        const topResp = await session.cmd(`TOP ${i} 5`);
        let rawLines: string[];
        if (topResp.startsWith("+OK")) {
          rawLines = await session.readMultiLine();
        } else {
          // Some servers don't support TOP — fall back to full RETR
          const retrResp = await session.cmd(`RETR ${i}`);
          if (!retrResp.startsWith("+OK")) continue;
          rawLines = await session.readMultiLine();
        }

        const rawBuffer = Buffer.from(rawLines.join("\r\n"), "binary");
        const parsed = await simpleParser(rawBuffer, { skipHtmlToText: true });

        const from    = parsed.from?.value?.[0];
        const subject = parsed.subject ?? "(제목 없음)";
        const date    = parsed.date ?? null;
        const preview = (parsed.text ?? "").slice(0, 130).replace(/[\r\n\t ]+/g, " ").trim();
        const msgId   = parsed.messageId ?? `pop3-${i}`;

        messages.push({
          entryId:        `pop3-${i}`,
          conversationId: msgId,
          subject,
          senderName:  from?.name ?? from?.address ?? "",
          senderEmail: from?.address ?? "",
          receivedTime: date ? date.toISOString() : "",
          preview,
          isUnread:       false,
          isToMe:         false,
          attachmentCount: 0,
        });
      } catch {
        // Skip unreadable messages
      }
    }

    try { await session.cmd("QUIT"); } catch {}
    session.destroy();

    return NextResponse.json(messages);
  } catch (e: unknown) {
    session?.destroy();
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
