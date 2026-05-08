import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

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

async function trySend(opts: SendOpts, port: number): Promise<{ ok: boolean; error?: string }> {
  const transporter = nodemailer.createTransport({
    host: opts.smtpHost,
    port,
    secure: port === 465,
    requireTLS: opts.ssl && port !== 465,
    auth: { user: opts.user, pass: opts.pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
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
  } catch (e: unknown) {
    return { ok: false, error: String(e) };
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, string | number | boolean>;
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
    return NextResponse.json(
      { error: "필수 파라미터 누락 (smtpHost, user, pass, to, subject)" },
      { status: 400 },
    );
  }

  // Try the configured port first, then alternates. Some hosts whitelist
  // certain submission ports differently (e.g. 587 IP-restricted but 465 not).
  const portsToTry = Array.from(new Set([opts.smtpPort, 587, 465, 25, 2525]));
  let lastErr = "";
  for (const port of portsToTry) {
    const r = await trySend(opts, port);
    if (r.ok) return NextResponse.json({ ok: true, port });
    lastErr = r.error ?? "unknown error";
    console.log(`[MAIL-SEND] port ${port} failed: ${lastErr}`);
    // If error is IP-policy 5.8.1 the other ports almost certainly fail too,
    // but still try them — some hosts have one open port for relay.
  }

  return NextResponse.json(
    {
      error: lastErr,
      hint: lastErr.includes("5.8.1") || lastErr.toLowerCase().includes("ip is not possible")
        ? "메일 호스팅에서 SMTP 인증을 IP로 제한하고 있습니다. 호스팅 관리자에게 'SMTP relay IP 제한 해제'를 요청하세요."
        : undefined,
    },
    { status: 500 },
  );
}
