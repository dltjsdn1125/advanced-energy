import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

async function mailnaraLogin(host: string, user: string, pass: string): Promise<string> {
  const loginHost = host.replace(/^(mail|smtp|pop|imap)\./i, "");
  const body = new URLSearchParams({
    login_host: loginHost,
    login_type: "U",
    template_language: "korean",
    admin_login: "0",
    org_domain: "",
    org_uid: "",
    passwd_validation: "true",
    is_mobile: "W",
    webmail_admin_login: "",
    usingAdminChange: "",
    keyTime: "",
    login_id: user,
    login_passwd: pass,
  });
  const resp = await fetch(`https://${host}/login.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redirect: "manual",
  });
  if (resp.status !== 302) throw new Error("웹메일 로그인 실패");
  const allCookies: string[] = [];
  if (typeof (resp.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function") {
    const fn = (resp.headers as unknown as { getSetCookie: () => string[] }).getSetCookie;
    allCookies.push(...fn.call(resp.headers));
  } else {
    const raw = resp.headers.get("set-cookie");
    if (raw) allCookies.push(raw);
  }
  const pairs = allCookies.map(c => c.split(";")[0].trim()).filter(Boolean);
  if (!pairs.length) throw new Error("웹메일 세션 쿠키 없음");
  return pairs.join("; ");
}

const FONT_CSS = `<style>
html,body{overflow:hidden!important;margin:0!important;}
body{padding:10px 18px!important;}
*{font-family:'고운돋움','Goun Dotum','Dotum','돋움','Gulim','굴림',Arial,sans-serif!important;font-size:11px!important;line-height:1.65!important;}
img{max-width:100%!important;height:auto!important;display:inline-block!important;}
</style>`;

function injectFont(html: string): string {
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, FONT_CSS + "</head>");
  if (/<body/i.test(html)) return html.replace(/<body/i, FONT_CSS + "<body");
  return FONT_CSS + html;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchBody(
  host: string,
  cookie: string,
  uid: string,
): Promise<{ htmlBody: string; body: string }> {
  // Try multiple MAILNARA view URL patterns until one returns 200
  const candidates = [
    `https://${host}/new_mailnara_web/index.php/mail/view_mail/Inbox/${uid}`,
    `https://${host}/new_mailnara_web/index.php/mail/mail_read/Inbox/${uid}`,
    `https://${host}/new_mailnara_web/index.php/mail/read_mail/Inbox/${uid}`,
    `https://${host}/new_mailnara_web/index.php/mail/mail_content/Inbox/${uid}`,
    `https://${host}/new_mailnara_web/index.php/mail/mail_print/Inbox/${uid}`,
    `https://${host}/new_mailnara_web/index.php/mail/mail_source/Inbox/${uid}`,
    `https://${host}/new_mailnara_web/index.php/mail/mail_view/Inbox/${uid}`,
  ];

  let html = "";
  let usedUrl = "";
  for (const url of candidates) {
    const r = await fetch(url, { headers: { Cookie: cookie } });
    console.log(`[WEBMAIL-THREAD] try ${url.split("/").slice(-3).join("/")} → ${r.status}`);
    if (r.ok) {
      html = await r.text();
      usedUrl = url;
      break;
    }
  }
  if (!html) throw new Error(`메일 본문을 가져올 수 없습니다 (모든 URL 패턴 실패)`);

  console.log(`[WEBMAIL-THREAD] got html from ${usedUrl} len=${html.length} preview=${html.slice(0, 300).replace(/\n/g, " ").replace(/\s+/g, " ")}`);

  // 1) Look for iframe that holds the mail body
  const iframeMatch = html.match(
    /src=["']([^"']*(?:mail_body|view_body|body)[^"']*)["']/i,
  ) || html.match(/<iframe[^>]+src=["']([^"']+)["']/i);

  if (iframeMatch) {
    const src = iframeMatch[1];
    const iframeUrl = src.startsWith("http")
      ? src
      : `https://${host}${src.startsWith("/") ? src : "/" + src}`;
    console.log(`[WEBMAIL-THREAD] fetching iframe src=${iframeUrl}`);
    const ir = await fetch(iframeUrl, { headers: { Cookie: cookie } });
    if (ir.ok) {
      const ih = await ir.text();
      return { htmlBody: injectFont(ih), body: stripTags(ih).slice(0, 2000) };
    }
  }

  // 2) Try known MAILNARA body container IDs/classes
  const bodyPatterns: RegExp[] = [
    /id=["']viewMailBody["'][^>]*>([\s\S]+?)(?=<div[^>]+id=["']|$)/i,
    /id=["']mail_body_text["'][^>]*>([\s\S]+?)(?=<\/div>)/i,
    /id=["']mailContent["'][^>]*>([\s\S]+?)(?=<\/div>)/i,
    /class=["']view-mail-body[^"']*["'][^>]*>([\s\S]+?)(?=<\/div>)/i,
    /class=["']mail-body[^"']*["'][^>]*>([\s\S]+?)(?=<\/div>)/i,
    /id=["']view_mail_content["'][^>]*>([\s\S]+?)(?=<\/div>)/i,
  ];
  for (const pat of bodyPatterns) {
    const m = html.match(pat);
    if (m && m[1].trim().length > 30) {
      const content = m[1].trim();
      return {
        htmlBody: injectFont(`<html><body style="margin:0;padding:10px 18px">${content}</body></html>`),
        body: stripTags(content).slice(0, 2000),
      };
    }
  }

  // 3) Fallback: whole page (remove nav/header cruft, keep <body>)
  const bodyTagMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return {
    htmlBody: injectFont(html),
    body: stripTags(bodyTagMatch ? bodyTagMatch[1] : html).slice(0, 2000),
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;
  const host        = String(body.host        ?? "");
  const user        = String(body.user        ?? "");
  const pass        = String(body.pass        ?? "");
  const uid         = String(body.uid         ?? "");
  const subject     = String(body.subject     ?? "");
  const senderName  = String(body.senderName  ?? "");
  const senderEmail = String(body.senderEmail ?? "");
  const sentOn      = String(body.sentOn      ?? "");

  if (!host || !user || !pass || !uid) {
    return NextResponse.json({ error: "webmail 설정이 필요합니다 (host, user, pass, uid)" }, { status: 400 });
  }

  console.log(`[WEBMAIL-THREAD] host=${host} uid=${uid}`);

  try {
    const cookie = await mailnaraLogin(host, user, pass);
    const { htmlBody, body: plainBody } = await fetchBody(host, cookie, uid);

    const thread = [{
      entryId:     `web-${uid}`,
      subject,
      senderName,
      senderEmail,
      sentOn,
      body:        plainBody,
      htmlBody,
      attachments: [],
      recipients:  [],
    }];

    console.log(`[WEBMAIL-THREAD] done. htmlBody length=${htmlBody.length}`);
    return NextResponse.json(thread);
  } catch (e: unknown) {
    const msg = String(e).replace(/^Error:\s*/gi, "");
    console.error(`[WEBMAIL-THREAD] FAILED:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
