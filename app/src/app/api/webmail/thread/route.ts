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
*{font-family:'고운돋움','Goun Dotum','Dotum','돋움','Gulim','굴림',Arial,sans-serif!important;font-size:13px!important;line-height:1.65!important;}
img{max-width:100%!important;height:auto!important;display:inline-block!important;}
</style>`;

function injectFont(html: string, baseHref?: string): string {
  let result = html;

  if (baseHref) {
    if (/<base\b[^>]*>/i.test(result)) {
      // Modify existing <base> tag — add href if missing, keep other attrs (e.g. target)
      result = result.replace(/<base\b([^>]*)>/i, (_m, attrs: string) => {
        if (/\bhref=/i.test(attrs)) return _m; // already has href, don't override
        return `<base${attrs} href="${baseHref}">`;
      });
    } else {
      const baseTag = `<base href="${baseHref}">`;
      if (/<\/head>/i.test(result)) result = result.replace(/<\/head>/i, baseTag + "</head>");
      else if (/<body/i.test(result)) result = result.replace(/<body/i, baseTag + "<body");
      else result = baseTag + result;
    }
  }

  if (/<\/head>/i.test(result)) return result.replace(/<\/head>/i, FONT_CSS + "</head>");
  if (/<body/i.test(result)) return result.replace(/<body/i, FONT_CSS + "<body");
  return FONT_CSS + result;
}

// Fetch relative/mail-server images and replace with base64 data URIs so
// the browser can display them without needing the MAILNARA session cookie.
async function inlineImages(html: string, host: string, cookie: string): Promise<string> {
  const hostOrigin = `https://${host}`;
  // Match src attributes that are relative or point to the same host
  const pattern = /(<img\b[^>]*?\bsrc=["'])([^"']+)(["'][^>]*?>)/gi;
  const toFetch: Array<{ tag: string; prefix: string; src: string; suffix: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const src = m[2];
    // Skip data URIs, CID references, and external URLs not on this host
    if (src.startsWith("data:") || src.startsWith("cid:")) continue;
    const isRelative = !src.startsWith("http");
    const isSameHost = src.startsWith(hostOrigin);
    if (!isRelative && !isSameHost) continue;
    toFetch.push({ tag: m[0], prefix: m[1], src, suffix: m[3] });
  }
  if (toFetch.length === 0) return html;

  const MAX_IMAGES = 20;
  const limited = toFetch.slice(0, MAX_IMAGES);

  const replacements = await Promise.all(limited.map(async ({ tag, prefix, src, suffix }) => {
    try {
      const absUrl = src.startsWith("/") ? `${hostOrigin}${src}` : isSameHostUrl(src, hostOrigin) ? src : `${hostOrigin}/${src}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(absUrl, { headers: { Cookie: cookie }, signal: controller.signal });
      clearTimeout(timer);
      if (!resp.ok) return { tag, replacement: tag };
      const ct = resp.headers.get("content-type") ?? "image/png";
      const buf = await resp.arrayBuffer();
      const b64 = Buffer.from(buf).toString("base64");
      const dataUri = `data:${ct};base64,${b64}`;
      return { tag, replacement: prefix + dataUri + suffix };
    } catch {
      return { tag, replacement: tag };
    }
  }));

  let result = html;
  for (const { tag, replacement } of replacements) {
    if (tag !== replacement) result = result.replace(tag, replacement);
  }
  return result;
}

function isSameHostUrl(src: string, hostOrigin: string): boolean {
  return src.startsWith(hostOrigin);
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchBody(
  host: string,
  cookie: string,
  uid: string,
  mailbox = "Inbox",
): Promise<{ htmlBody: string; body: string }> {
  // MAILNARA 4.x: body is in an iframe at maildecode/mail_content_body
  const bodyUrl = `https://${host}/new_mailnara_web/index.php/maildecode/mail_content_body/${mailbox}/${uid}/N/N`;
  console.log(`[WEBMAIL-THREAD] fetching body url: ${bodyUrl}`);
  const resp = await fetch(bodyUrl, { headers: { Cookie: cookie } });
  if (!resp.ok) throw new Error(`메일 본문 HTTP ${resp.status}`);
  const html = await resp.text();
  console.log(`[WEBMAIL-THREAD] body html len=${html.length}`);
  const baseHref = `https://${host}/`;
  // Inline relative images as data URIs so they load without the session cookie
  const inlinedHtml = await inlineImages(html, host, cookie);
  return { htmlBody: injectFont(inlinedHtml, baseHref), body: stripTags(html).slice(0, 2000) };
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;
  const host        = String(body.host        ?? "");
  const user        = String(body.user        ?? "");
  const pass        = String(body.pass        ?? "");
  const uid         = String(body.uid         ?? "");
  const mailbox     = String(body.mailbox     ?? "Inbox");
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
    const { htmlBody, body: plainBody } = await fetchBody(host, cookie, uid, mailbox);

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
