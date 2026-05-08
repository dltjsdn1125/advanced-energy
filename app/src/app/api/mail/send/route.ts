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
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
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

// IP-policy / authentication errors that no other port can fix.
function isFatalAuthError(err: string): boolean {
  return /5\.8\.1/.test(err)
    || /ip is not possible/i.test(err)
    || /authentication.*not.*possible/i.test(err)
    || /relay.*denied/i.test(err)
    || /not allowed/i.test(err);
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
  // CRITICAL: stop early on IP-policy errors so we always finish before
  // Vercel's 30s function cap and return a JSON error (not Vercel's HTML
  // timeout page that breaks client-side JSON.parse).
  const portsToTry = Array.from(new Set([opts.smtpPort, 587, 465, 25, 2525]));
  let lastErr = "";
  for (const port of portsToTry) {
    const r = await trySend(opts, port);
    if (r.ok) return NextResponse.json({ ok: true, port });
    lastErr = r.error ?? "unknown error";
    console.log(`[MAIL-SEND] port ${port} failed: ${lastErr}`);
    if (isFatalAuthError(lastErr)) {
      console.log(`[MAIL-SEND] fatal auth error — skipping remaining ports`);
      break;
    }
  }

  return NextResponse.json(
    {
      error: lastErr,
      hint: isFatalAuthError(lastErr)
        ? "메일 호스팅에서 SMTP 인증을 IP로 제한하고 있습니다. 평소엔 차단되어 있고 해외 출장시에만 임시 열린다고 합니다. 발송이 필요하시면 호스팅 관리자에게 IP 허용을 요청하세요."
        : undefined,
    },
    { status: 500 },
  );
}
