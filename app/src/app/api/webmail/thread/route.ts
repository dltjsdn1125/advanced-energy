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

interface AttachmentMeta {
  name: string;
  size: number;
  contentType?: string;
  content?: string;
  /** MAILNARA download URL (relative or absolute) — used for proxy download */
  downloadUrl?: string;
}

// Decode percent-encoded UTF-8 strings safely
function tryDecodeURI(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

// Format bytes from a "12.3 KB" / "12345 byte" / "1.2MB" string
function parseSize(s: string): number {
  const m = s.match(/([\d,.]+)\s*(KB|MB|GB|byte|bytes|B)?/i);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(/,/g, ""));
  if (isNaN(n)) return 0;
  const unit = (m[2] ?? "byte").toUpperCase();
  if (unit === "KB") return Math.round(n * 1024);
  if (unit === "MB") return Math.round(n * 1024 * 1024);
  if (unit === "GB") return Math.round(n * 1024 * 1024 * 1024);
  return Math.round(n);
}

// MAILNARA exposes attachments via the wrapping mail_view page. The /new_mua/
// prefix appears in the logout redirect, so this install uses both prefixes.
async function fetchAttachmentList(
  host: string,
  cookie: string,
  uid: string,
  mailbox: string,
): Promise<{ list: AttachmentMeta[]; sample: string; hitUrl: string }> {
  const candidates = [
    `https://${host}/new_mua/index.php/mail/mail_view/${mailbox}/${uid}`,
    `https://${host}/new_mua/index.php/mail/mail_content/${mailbox}/${uid}`,
    `https://${host}/new_mailnara_web/index.php/mail/mail_view/${mailbox}/${uid}`,
    `https://${host}/new_mailnara_web/index.php/maildecode/mail_content_body/${mailbox}/${uid}/Y/Y`,
    `https://${host}/new_mailnara_web/index.php/mail/mail_view_v3/${mailbox}/${uid}`,
    `https://${host}/new_mailnara_web/index.php/maildecode/mail_attach_list/${mailbox}/${uid}`,
  ];

  let bestSample = "";
  let bestUrl = "";
  for (const url of candidates) {
    try {
      const resp = await fetch(url, { headers: { Cookie: cookie } });
      console.log(`[WEBMAIL-THREAD] attach probe ${url} → status=${resp.status}`);
      if (!resp.ok) continue;
      const html = await resp.text();
      console.log(`[WEBMAIL-THREAD] ${url} htmlLen=${html.length}`);
      const list = parseAttachmentsFromHtml(html);
      if (list.length > 0) {
        console.log(`[WEBMAIL-THREAD] ✓ found ${list.length} attachment(s) at ${url}`);
        return { list, sample: "", hitUrl: url };
      }
      // Track the page that contained "첨부" or file-extension hints so we can
      // ship a sample to the client for debugging
      if (!bestSample && (/첨부/.test(html) || /\.(pdf|xlsx?|docx?|hwp|zip|jpg|png|gif|pptx?)\b/i.test(html))) {
        bestSample = html.slice(0, 4000).replace(/\s+/g, " ");
        bestUrl = url;
      }
    } catch (e) {
      console.warn(`[WEBMAIL-THREAD] attach url failed ${url}:`, String(e));
    }
  }
  if (bestSample) console.log(`[WEBMAIL-THREAD] no parser hit. Best candidate ${bestUrl}: ${bestSample.slice(0, 1500)}`);
  return { list: [], sample: bestSample, hitUrl: bestUrl };
}

// Permissive parser — try many patterns, return ALL distinct file-like links
function parseAttachmentsFromHtml(html: string): AttachmentMeta[] {
  const list: AttachmentMeta[] = [];

  // Pattern 1: anchors with MAILNARA-style download hrefs.
  // CRITICAL: only accept anchors whose HREF actually points at a MAILNARA
  // attachment endpoint. Body emails frequently contain marketing PDF links
  // to external sites (e.g. artesyn.com) — the old "filename.pdf in link
  // text" heuristic mis-identified those as attachments.
  const linkPattern = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1];
    const inner = m[2].replace(/<[^>]+>/g, "").trim().replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
    if (!inner || inner.length > 200) continue;
    if (/^\s*(다운로드|download|첨부|view|보기|미리보기|preview|reply|회신|이전|다음)\s*$/i.test(inner)) continue;

    // Must be a real MAILNARA download URL: relative path OR contains a
    // MAILNARA-specific endpoint name. External http(s)://other-site/file.pdf
    // is rejected outright — those are inline links in the email body, not
    // server-stored attachments we can proxy via session cookie.
    if (/^javascript:/i.test(href) || /^mailto:/i.test(href) || /^#/.test(href)) continue;
    const isExternalUrl = /^https?:\/\//i.test(href);
    const isRelativePath = !isExternalUrl;
    // MAILNARA download endpoint signatures we know about.
    // The actual format on this install is `/mail/file_download.php?...&disposition=attachment`.
    const hrefHasMailnaraDownloadEndpoint =
      /file_download/i.test(href) ||              // /mail/file_download.php
      /maildownload/i.test(href) ||
      /mail_attach/i.test(href) ||
      /mail_download/i.test(href) ||
      /attach_download/i.test(href) ||
      /[?&]disposition=attachment/i.test(href) || // explicit MIME disposition param
      /\/mail\/.*download/i.test(href);            // generic /mail/...download...
    if (isExternalUrl) continue; // never accept external absolute URLs
    if (isRelativePath && !hrefHasMailnaraDownloadEndpoint) {
      // Relative link without a recognized download keyword — skip.
      // Accept only if link text has a filename pattern AND href contains
      // 'mail' somewhere (likely on MAILNARA).
      const looksLikeFilename = /\.[a-z0-9]{1,5}\b/i.test(inner) && inner.length < 150;
      const looksLikeMailUrl = /\/mail\b/i.test(href) || /\bmailbox=/i.test(href) || /\buid=/i.test(href);
      if (!(looksLikeFilename && looksLikeMailUrl)) continue;
    }

    const sm = inner.match(/^(.+?)\s*[\(（]\s*([\d.,]+\s*(?:KB|MB|GB|byte|bytes|B)?)\s*[\)）]\s*$/i);
    const name = tryDecodeURI(sm ? sm[1].trim() : inner);
    const size = sm ? parseSize(sm[2]) : 0;
    list.push({ name, size, downloadUrl: href });
  }

  // Pattern 2: MAILNARA attachment row containers — also try to find a download href inside
  const rowPattern = /<(?:li|tr|div|span)\b[^>]*class=["'][^"']*(?:m-file|attach|file_list|file_row|file_name|attachfile)[^"']*["'][^>]*>([\s\S]*?)<\/(?:li|tr|div|span)>/gi;
  while ((m = rowPattern.exec(html)) !== null) {
    const inner = m[1];
    const txt = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!txt || txt.length > 300) continue;
    const sm = txt.match(/(.+?\.[a-z0-9]{1,5})\s*[\(（]\s*([\d.,]+\s*(?:KB|MB|GB|byte|bytes|B)?)\s*[\)）]/i);
    if (!sm) continue;
    // Look for a download href inside this row — could be on a different element
    const hrefInRow = inner.match(/href=["']([^"']*?(?:download|attach|maildownload|mail_attach|attachment|file_down)[^"']*?)["']/i);
    list.push({
      name: tryDecodeURI(sm[1].trim()),
      size: parseSize(sm[2]),
      downloadUrl: hrefInRow ? hrefInRow[1] : undefined,
    });
  }

  // Dedupe by name (prefer entries that have a download URL)
  const byName = new Map<string, AttachmentMeta>();
  for (const a of list) {
    const k = a.name.toLowerCase();
    const existing = byName.get(k);
    if (!existing) byName.set(k, a);
    else if (!existing.downloadUrl && a.downloadUrl) byName.set(k, a);
  }
  return Array.from(byName.values());
}

async function fetchBody(
  host: string,
  cookie: string,
  uid: string,
  mailbox = "Inbox",
): Promise<{ htmlBody: string; body: string; attachments: AttachmentMeta[]; attachDebug?: { sample: string; hitUrl: string } }> {
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

  // Try external mail_view URLs first
  let { list: attachments, sample, hitUrl } = await fetchAttachmentList(host, cookie, uid, mailbox)
    .catch(() => ({ list: [] as AttachmentMeta[], sample: "", hitUrl: "" }));

  // Fallback: parse attachments out of the body HTML itself
  if (attachments.length === 0) {
    const fromBody = parseAttachmentsFromHtml(html);
    if (fromBody.length > 0) {
      console.log(`[WEBMAIL-THREAD] parsed ${fromBody.length} attachment(s) from body iframe`);
      attachments = fromBody;
    }
  }

  return {
    htmlBody: injectFont(inlinedHtml, baseHref),
    body: stripTags(html).slice(0, 2000),
    attachments,
    attachDebug: attachments.length === 0 && sample ? { sample, hitUrl } : undefined,
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;
  const host          = String(body.host          ?? "");
  const user          = String(body.user          ?? "");
  const pass          = String(body.pass          ?? "");
  const sessionCookie = String(body.sessionCookie ?? "");
  const uid           = String(body.uid           ?? "");
  const mailbox       = String(body.mailbox       ?? "Inbox");
  const subject       = String(body.subject       ?? "");
  const senderName    = String(body.senderName    ?? "");
  const senderEmail   = String(body.senderEmail   ?? "");
  const sentOn        = String(body.sentOn        ?? "");

  if (!host || !user || !pass || !uid) {
    return NextResponse.json({ error: "webmail 설정이 필요합니다 (host, user, pass, uid)" }, { status: 400 });
  }

  console.log(`[WEBMAIL-THREAD] host=${host} uid=${uid} sessionReuse=${!!sessionCookie}`);

  try {
    const cookie = sessionCookie || await mailnaraLogin(host, user, pass);
    const { htmlBody, body: plainBody, attachments, attachDebug } = await fetchBody(host, cookie, uid, mailbox);

    const thread = [{
      entryId:     `web-${uid}`,
      subject,
      senderName,
      senderEmail,
      sentOn,
      body:        plainBody,
      htmlBody,
      attachments,
      recipients:  [],
      _attachDebug: attachDebug,
    }];

    console.log(`[WEBMAIL-THREAD] done. htmlBody length=${htmlBody.length} attachments=${attachments.length}`);
    return NextResponse.json(thread);
  } catch (e: unknown) {
    const msg = String(e).replace(/^Error:\s*/gi, "");
    console.error(`[WEBMAIL-THREAD] FAILED:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
