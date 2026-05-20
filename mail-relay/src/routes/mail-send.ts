import type { Request, Response } from "express";
import nodemailer from "nodemailer";

interface SendOpts {
  smtpHost: string;
  smtpPort: number;
  ssl: boolean;
  user: string;
  pass: string;
  to: string;
  cc: string;
  subject: string;
  htmlBody: string;
}

function isFatalAuthError(err: string): boolean {
  return /5\.8\.1/.test(err)
    || /ip is not possible/i.test(err)
    || /authentication.*not.*possible/i.test(err)
    || /relay.*denied/i.test(err)
    || /not allowed/i.test(err);
}

async function trySend(opts: SendOpts, port: number): Promise<{ ok: boolean; error?: string }> {
  const transporter = nodemailer.createTransport({
    host: opts.smtpHost,
    port,
    secure: port === 465,
    requireTLS: opts.ssl && port !== 465,
    auth: { user: opts.user, pass: opts.pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  try {
    await transporter.sendMail({
      from: opts.user,
      to: opts.to,
      ...(opts.cc ? { cc: opts.cc } : {}),
      subject: opts.subject,
      html: opts.htmlBody,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function mailSendRoute(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, string | number | boolean>;
  const opts: SendOpts = {
    smtpHost: String(body.smtpHost ?? ""),
    smtpPort: Number(body.smtpPort) || 587,
    ssl: body.ssl !== false && body.ssl !== "false",
    user: String(body.user ?? body.email ?? ""),
    pass: String(body.pass ?? body.password ?? ""),
    to: String(body.to ?? ""),
    cc: String(body.cc ?? ""),
    subject: String(body.subject ?? ""),
    htmlBody: String(body.htmlBody ?? ""),
  };

  if (!opts.smtpHost || !opts.user || !opts.pass || !opts.to || !opts.subject) {
    res.status(400).json({ error: "필수 파라미터 누락 (smtpHost, user, pass, to, subject)" });
    return;
  }

  const portsToTry = Array.from(new Set([opts.smtpPort, 587, 465, 25, 2525]));
  let lastErr = "";
  for (const port of portsToTry) {
    const r = await trySend(opts, port);
    if (r.ok) { res.json({ ok: true, port }); return; }
    lastErr = r.error ?? "unknown error";
    if (isFatalAuthError(lastErr)) break;
  }

  res.status(500).json({
    error: lastErr,
    hint: isFatalAuthError(lastErr)
      ? "메일 호스팅에서 SMTP 인증을 IP로 제한하고 있습니다. 한국 IP에서도 막혀 있으면 호스팅 관리자에게 IP 허용을 요청하세요."
      : undefined,
  });
}
