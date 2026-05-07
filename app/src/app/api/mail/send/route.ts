import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    email,
    password,
    smtpHost = "smtp.office365.com",
    smtpPort = 587,
    to,
    subject,
    htmlBody,
    inReplyTo,
    references,
  } = body as Record<string, string | number>;

  if (!email || !password || !to || !subject) {
    return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
  }

  const port = Number(smtpPort);
  const transporter = nodemailer.createTransport({
    host: String(smtpHost),
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user: String(email), pass: String(password) },
    tls: { rejectUnauthorized: false },
  });

  try {
    const subjectStr = String(subject);
    await transporter.sendMail({
      from: String(email),
      to: String(to),
      subject: /^re\s*:/i.test(subjectStr) ? subjectStr : `Re: ${subjectStr}`,
      html: String(htmlBody ?? ""),
      ...(inReplyTo ? { inReplyTo: String(inReplyTo) } : {}),
      ...(references ? { references: String(references) } : {}),
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
