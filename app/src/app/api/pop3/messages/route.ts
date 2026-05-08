import { NextRequest, NextResponse } from "next/server";
import * as tls from "tls";
import * as net from "net";
import { simpleParser } from "mailparser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export const preferredRegion = ["icn1", "nrt1", "sin1"]; // Seoul → Tokyo → Singapore (Korean mail servers)

const CONNECT_TIMEOUT = 25_000;
const READ_TIMEOUT = 25_000;

function tcpConnect(host: string, port: number, ssl: boolean): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`연결 시간 초과 — ${host}:${port} 응답 없음 (서버가 연결을 차단했거나 주소가 잘못됐을 수 있습니다)`)),
      CONNECT_TIMEOUT
    );
    let sock: net.Socket;
    const onConnect = () => { clearTimeout(timeout); resolve(sock); };
    if (ssl) {
      sock = tls.connect(
        { host, port, rejectUnauthorized: false, servername: host },
        onConnect
      );
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

  readLine(timeoutMs = READ_TIMEOUT): Promise<string> {
    if (this.ready.length) return Promise.resolve(this.ready.shift()!);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("POP3 응답 대기 시간 초과")), timeoutMs);
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
  const limit  = Math.min(Number(body.limit) || 50, 2000);

  if (!host || !user || !pass) {
    return NextResponse.json({ error: "POP3 설정이 필요합니다 (host, user, pass)" }, { status: 400 });
  }
  if (host.includes("@")) {
    return NextResponse.json({
      error: `호스트 입력 오류: "${host}"는 이메일 주소입니다.\n호스트 칸에는 서버 주소를 입력하세요 (예: pop.semigate.com, mail.semigate.com)`,
    }, { status: 400 });
  }

  console.log(`[POP3] connecting → ${host}:${port} ssl=${ssl} user=${user}`);

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

    console.log(`[POP3] authenticated. total=${total}`);

    const messages: unknown[] = [];
    const fetchCount = Math.min(limit, total);

    for (let i = total; i > total - fetchCount && i >= 1; i--) {
      try {
        const topResp = await session.cmd(`TOP ${i} 5`);
        let rawLines: string[];
        if (topResp.startsWith("+OK")) {
          rawLines = await session.readMultiLine();
        } else {
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
        // skip unreadable individual messages
      }
    }

    try { await session.cmd("QUIT"); } catch {}
    session.destroy();

    console.log(`[POP3] done. returned ${messages.length} messages`);
    return NextResponse.json(messages);
  } catch (e: unknown) {
    const msg = String(e);
    console.error(`[POP3] FAILED host=${host} port=${port} ssl=${ssl}:`, msg);
    session?.destroy();
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
