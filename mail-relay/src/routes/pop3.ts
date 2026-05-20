import type { Request, Response } from "express";
import * as tls from "tls";
import * as net from "net";
import { simpleParser } from "mailparser";

const CONNECT_TIMEOUT = 25_000;
const READ_TIMEOUT = 25_000;

function tcpConnect(host: string, port: number, ssl: boolean): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`연결 시간 초과 — ${host}:${port}`)),
      CONNECT_TIMEOUT,
    );
    let sock: net.Socket;
    const onConnect = () => { clearTimeout(timeout); resolve(sock); };
    if (ssl) {
      sock = tls.connect({ host, port, rejectUnauthorized: false, servername: host }, onConnect);
    } else {
      sock = net.createConnection({ host, port }, onConnect);
    }
    sock.on("error", (e) => { clearTimeout(timeout); reject(e); });
  });
}

class Pop3Session {
  private buf = "";
  constructor(public sock: net.Socket) {
    sock.setEncoding("binary");
    sock.on("data", (chunk: string) => { this.buf += chunk; });
  }
  destroy() { try { this.sock.destroy(); } catch { /* noop */ } }
  readLine(): Promise<string> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        const idx = this.buf.indexOf("\r\n");
        if (idx >= 0) {
          const line = this.buf.slice(0, idx);
          this.buf = this.buf.slice(idx + 2);
          resolve(line);
          return;
        }
        if (Date.now() - start > READ_TIMEOUT) { reject(new Error("POP3 read timeout")); return; }
        setTimeout(tick, 20);
      };
      tick();
    });
  }
  async readMultiLine(): Promise<string[]> {
    const lines: string[] = [];
    while (true) {
      const line = await this.readLine();
      if (line === ".") break;
      lines.push(line.startsWith("..") ? line.slice(1) : line);
    }
    return lines;
  }
  async cmd(c: string): Promise<string> {
    this.sock.write(c + "\r\n");
    return this.readLine();
  }
}

export async function pop3Route(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const host   = String(body.host ?? "");
  const port   = Number(body.port) || 995;
  const ssl    = body.ssl !== false && body.ssl !== "false";
  const user   = String(body.user ?? "");
  const pass   = String(body.pass ?? "");
  const limit  = Math.min(Number(body.limit) || 50, 100);
  const offset = Math.max(0, Number(body.offset) || 0);

  if (!host || !user || !pass) {
    res.status(400).json({ error: "POP3 설정이 필요합니다 (host, user, pass)" });
    return;
  }

  const hostVariants: string[] = [host];
  const noPrefix = host.replace(/^(mail|webmail|smtp|imap|pop|pop3)\./i, "");
  if (noPrefix !== host) {
    hostVariants.push(`pop.${noPrefix}`, `pop3.${noPrefix}`, noPrefix);
  } else {
    hostVariants.push(`pop.${host}`, `pop3.${host}`, `mail.${host}`);
  }

  let session: Pop3Session | null = null;
  let connectErr: unknown = null;
  outer: for (const tryHost of hostVariants) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const sock = await tcpConnect(tryHost, port, ssl);
        session = new Pop3Session(sock);
        const greeting = await session.readLine();
        if (!greeting.startsWith("+OK")) throw new Error(`POP3 인사 실패: ${greeting}`);
        const userResp = await session.cmd(`USER ${user}`);
        if (!userResp.startsWith("+OK")) throw new Error(`USER 실패: ${userResp}`);
        const passResp = await session.cmd(`PASS ${pass}`);
        if (!passResp.startsWith("+OK")) throw new Error(`인증 실패: ${passResp}`);
        connectErr = null;
        break outer;
      } catch (e) {
        connectErr = e;
        try { session?.destroy(); } catch { /* noop */ }
        session = null;
        if (attempt < 3) await new Promise(r => setTimeout(r, 1500));
      }
    }
  }
  if (connectErr || !session) {
    res.status(500).json({ error: `POP3 연결 실패: ${String(connectErr)}` });
    return;
  }

  try {
    const statResp = await session.cmd("STAT");
    if (!statResp.startsWith("+OK")) throw new Error(`STAT 실패: ${statResp}`);
    const total = parseInt(statResp.split(" ")[1] ?? "0", 10);

    const messages: unknown[] = [];
    const startMsg = total - offset;
    const endMsg   = Math.max(1, startMsg - limit + 1);
    const hasMore = startMsg - limit > 0;

    for (let i = startMsg; i >= endMsg && i >= 1; i--) {
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
        const from = parsed.from?.value?.[0];
        const msgId = parsed.messageId ?? `pop3-${i}`;
        messages.push({
          entryId:        `pop3-${i}`,
          conversationId: msgId,
          subject:        parsed.subject ?? "(제목 없음)",
          senderName:     from?.name ?? from?.address ?? "",
          senderEmail:    from?.address ?? "",
          receivedTime:   parsed.date ? parsed.date.toISOString() : "",
          preview:        (parsed.text ?? "").slice(0, 130).replace(/[\r\n\t ]+/g, " ").trim(),
          isUnread:       false,
          isToMe:         false,
          attachmentCount: 0,
        });
      } catch { /* skip individual */ }
    }

    try { await session.cmd("QUIT"); } catch { /* noop */ }
    session.destroy();

    res.json({ messages, total, hasMore, nextOffset: hasMore ? offset + limit : null });
  } catch (e) {
    session?.destroy();
    res.status(500).json({ error: String(e) });
  }
}
