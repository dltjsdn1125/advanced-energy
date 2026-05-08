import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, string | number | boolean>;
  const smtpHost = String(body.smtpHost ?? "");
  const smtpPort = Number(body.smtpPort) || 587;
  const ssl      = body.ssl !== false && body.ssl !== "false";
  const user     = String(body.user ?? body.email ?? "");
  const pass     = String(body.pass ?? body.password ?? "");
  const to       = String(body.to ?? "");
  const cc       = String(body.cc ?? "");
  const subject  = String(body.subject ?? "");
  const htmlBody = String(body.htmlBody ?? "");

  if (!smtpHost || !user || !pass || !to || !subject) {
    return NextResponse.json(
      { error: "필수 파라미터 누락 (smtpHost, user, pass, to, subject)" },
      { status: 400 }
    );
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    requireTLS: ssl && smtpPort !== 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });

  try {
    await transporter.sendMail({
      from: user,
      to,
      ...(cc ? { cc } : {}),
      subject,
      html: htmlBody,
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
