import type { Request, Response } from "express";
import { mailnaraLogin } from "../lib/mailnara.js";

interface AttachmentMeta {
  name: string;
  size: number;
  contentType?: string;
  content?: string;
  downloadUrl?: string;
}

function tryDecodeURI(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

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

function parseAttachmentsFromHtml(html: string): AttachmentMeta[] {
  const list: AttachmentMeta[] = [];
  const linkPattern = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1];
    const inner = m[2].replace(/<[^>]+>/g, "").trim().replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
    if (!inner || inner.length > 200) continue;
    if (/^\s*(다운로드|download|첨부|view|보기|미리보기|preview|reply|회신|이전|다음)\s*$/i.test(inner)) continue;
    if (/^javascript:/i.test(href) || /^mailto:/i.test(href) || /^#/.test(href)) continue;
    if (/^https?:\/\//i.test(href)) continue;
    const hrefHasMailnaraDownloadEndpoint =
      /file_download/i.test(href) ||
      /maildownload/i.test(href) ||
      /mail_attach/i.test(href) ||
      /mail_download/i.test(href) ||
      /attach_download/i.test(href) ||
      /[?&]disposition=attachment/i.test(href) ||
      /\/mail\/.*download/i.test(href);
    if (!hrefHasMailnaraDownloadEndpoint) {
      const looksLikeFilename = /\.[a-z0-9]{1,5}\b/i.test(inner) && inner.length < 150;
      const looksLikeMailUrl = /\/mail\b/i.test(href) || /\bmailbox=/i.test(href) || /\buid=/i.test(href);
      if (!(looksLikeFilename && looksLikeMailUrl)) continue;
    }
    const sm = inner.match(/^(.+?)\s*[\(（]\s*([\d.,]+\s*(?:KB|MB|GB|byte|bytes|B)?)\s*[\)）]\s*$/i);
    const name = tryDecodeURI(sm ? sm[1].trim() : inner);
    const size = sm ? parseSize(sm[2]) : 0;
    list.push({ name, size, downloadUrl: href });
  }
  const byName = new Map<string, AttachmentMeta>();
  for (const a of list) {
    const k = a.name.toLowerCase();
    const existing = byName.get(k);
    if (!existing) byName.set(k, a);
    else if (!existing.downloadUrl && a.downloadUrl) byName.set(k, a);
  }
  return Array.from(byName.values());
}

export async function webmailThreadRoute(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
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
    res.status(400).json({ error: "webmail 설정이 필요합니다" });
    return;
  }

  try {
    const cookie = sessionCookie || await mailnaraLogin(host, user, pass);
    const bodyUrl = `https://${host}/new_mailnara_web/index.php/maildecode/mail_content_body/${mailbox}/${uid}/N/N`;
    const resp = await fetch(bodyUrl, { headers: { Cookie: cookie } });
    if (!resp.ok) throw new Error(`메일 본문 HTTP ${resp.status}`);
    const html = await resp.text();

    // Try wrapping mail-view pages for attachment list
    const candidates = [
      `https://${host}/new_mua/index.php/mail/mail_view/${mailbox}/${uid}`,
      `https://${host}/new_mailnara_web/index.php/mail/mail_view/${mailbox}/${uid}`,
      `https://${host}/new_mailnara_web/index.php/maildecode/mail_content_body/${mailbox}/${uid}/Y/Y`,
    ];
    let attachments: AttachmentMeta[] = [];
    for (const u of candidates) {
      try {
        const r = await fetch(u, { headers: { Cookie: cookie } });
        if (!r.ok) continue;
        const t = await r.text();
        const parsed = parseAttachmentsFromHtml(t);
        if (parsed.length > 0) { attachments = parsed; break; }
      } catch { /* continue */ }
    }
    if (attachments.length === 0) attachments = parseAttachmentsFromHtml(html);

    const plainBody = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);

    res.json([{
      entryId: `web-${uid}`, subject, senderName, senderEmail, sentOn,
      body: plainBody, htmlBody: html, attachments, recipients: [],
    }]);
  } catch (e) {
    res.status(500).json({ error: String(e).replace(/^Error:\s*/gi, "") });
  }
}
