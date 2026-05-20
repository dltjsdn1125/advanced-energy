import type { Request, Response } from "express";
import { mailnaraLogin } from "../lib/mailnara.js";

const PAGE_SIZE = 50;
const FETCH_TIMEOUT_MS = 25_000;

const MAILBOX_MAP: Record<string, string> = {
  inbox: "Inbox", sent: "Sent", drafts: "Temp", deleted: "Trash", junk: "Advert",
};

function extractBetween(html: string, start: string, end: string): string {
  const s = html.indexOf(start);
  if (s < 0) return "";
  const e = html.indexOf(end, s + start.length);
  if (e < 0) return "";
  return html.slice(s + start.length, e).trim();
}

function decodeHtml(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, " ").trim();
}

function parseMailList(html: string, mailbox = "Inbox"): unknown[] {
  const messages: unknown[] = [];
  const parts = html.split(/(?=id=["']row_id_\d+["'])/);
  for (const part of parts) {
    const uidMatch = part.match(/id=["']row_id_(\d+)["']/);
    if (!uidMatch) continue;
    const uid = uidMatch[1];
    const block = part.slice(0, 6000);
    const seenMatch = block.match(new RegExp(`id=["']seen_${uid}["'][^>]*value=["']([^"']+)["']`));
    const isUnread = !seenMatch || seenMatch[1] === "N";
    const fromEmailMatch = block.match(new RegExp(`id=["']from_address_${uid}["'][^>]*value=["']([^"']+)["']`));
    const fromEmail = fromEmailMatch ? fromEmailMatch[1] : "";
    const fromNameMatch = block.match(/<span[^>]+title=["'][^"']*["'][^>]*>([^<]+)<\/span>/);
    const fromNameRaw = fromNameMatch ? fromNameMatch[1] : "";
    const fromName = decodeHtml(fromNameRaw.replace(/\s*\.\.\.$/, "").trim());
    const subjMatch =
      block.match(new RegExp(`id=["']title_list_${uid}["'][^>]*>([^<]+)<`)) ||
      block.match(/class=["']m-subject[^"']*["'][^>]*>\s*<[^>]+>([^<]+)</);
    const subject = subjMatch ? decodeHtml(subjMatch[1]) : "(제목 없음)";
    const dateMatch = block.match(/class=["']m-date[^"']*["'][^>]*>([\d.]+)\s*<span[^>]*>([\d:]+)<\/span>/);
    let receivedTime = "";
    if (dateMatch) {
      const [, datePart, timePart] = dateMatch;
      const normalized = datePart.replace(/\./g, "-") + "T" + timePart + ":00+09:00";
      receivedTime = new Date(normalized).toISOString();
    }
    const hasAttach = /class=["']m-file["']/.test(block) && !/style=["'][^"']*display\s*:\s*none/.test(block);
    const entryId = mailbox === "Inbox" ? `web-${uid}` : `web-${mailbox}:${uid}`;
    messages.push({
      entryId, conversationId: entryId, subject,
      senderName: fromName || fromEmail, senderEmail: fromEmail,
      receivedTime, preview: "", isUnread, isToMe: false,
      attachmentCount: hasAttach ? 1 : 0,
    });
  }
  return messages;
}

export async function webmailMessagesRoute(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const host = String(body.host ?? "");
  const user = String(body.user ?? "");
  const pass = String(body.pass ?? "");
  const folder = String(body.folder ?? "inbox").toLowerCase();
  const sessionCookie = String(body.sessionCookie ?? "");
  const pageParam = body.page !== undefined ? Number(body.page) : undefined;

  const mailbox = MAILBOX_MAP[folder] ?? "Inbox";

  if (!host || !user || !pass) {
    res.status(400).json({ error: "webmail 설정이 필요합니다 (host, user, pass)" });
    return;
  }

  try {
    const cookie = sessionCookie || await mailnaraLogin(host, user, pass);

    if (pageParam !== undefined) {
      const candidates = [
        `https://${host}/new_mailnara_web/index.php/mail/mail_list/${mailbox}/${pageParam}/${PAGE_SIZE}/Y/Y`,
        `https://${host}/new_mailnara_web/index.php/mail/mail_list/${mailbox}/${pageParam}/${PAGE_SIZE}`,
        `https://${host}/new_mailnara_web/index.php/mail/mail_list/${mailbox}/${pageParam}/${PAGE_SIZE}/N/Y`,
        `https://${host}/new_mailnara_web/index.php/mail/mail_list/${mailbox}/${pageParam}/${PAGE_SIZE}/N/N`,
      ];

      let bestHtml = "";
      let bestCount = -1;
      let activeCookie = cookie;
      for (const tryUrl of candidates) {
        try {
          const r = await fetch(tryUrl, { headers: { Cookie: activeCookie } });
          if (!r.ok) continue;
          const txt = await r.text();
          const matches = txt.match(/id=["']row_id_(\d+)["']/g) ?? [];
          const cnt = matches.length;
          if (cnt === 0 && !!sessionCookie && pageParam === 0 &&
              /login\.php|login_id|login_passwd/i.test(txt)) {
            const fresh = await mailnaraLogin(host, user, pass);
            activeCookie = fresh;
            const r2 = await fetch(tryUrl, { headers: { Cookie: fresh } });
            if (!r2.ok) continue;
            const t2 = await r2.text();
            const m2 = t2.match(/id=["']row_id_(\d+)["']/g) ?? [];
            if (m2.length > bestCount) { bestHtml = t2; bestCount = m2.length; }
            continue;
          }
          if (cnt > bestCount) { bestHtml = txt; bestCount = cnt; }
        } catch { /* continue */ }
      }
      if (bestCount < 0) throw new Error("모든 mail_list URL 변형 실패");

      const msgs = parseMailList(bestHtml, mailbox);
      const rowIdMatches = bestHtml.match(/id=["']row_id_(\d+)["']/g) ?? [];
      const uids = rowIdMatches.map(s => s.match(/\d+/)?.[0] ?? "").filter(Boolean);
      const firstUid = uids[0] ?? "";
      const lastUid  = uids[uids.length - 1] ?? "";
      res.json({
        messages: msgs,
        hasMore: msgs.length > 0,
        sessionCookie: activeCookie,
        _debug: { htmlLen: bestHtml.length, rowIdCount: uids.length, firstUid, lastUid, mailbox, page: pageParam },
      });
      return;
    }

    // Full-pagination mode
    const allMessages: unknown[] = [];
    const started = Date.now();
    let page = 0;
    while (true) {
      if (Date.now() - started > FETCH_TIMEOUT_MS) break;
      const listUrl = `https://${host}/new_mailnara_web/index.php/mail/mail_list/${mailbox}/${page}/${PAGE_SIZE}`;
      const r = await fetch(listUrl, { headers: { Cookie: cookie } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const html = await r.text();
      const msgs = parseMailList(html, mailbox);
      if (msgs.length === 0) break;
      allMessages.push(...msgs);
      if (msgs.length < PAGE_SIZE) break;
      page++;
    }
    res.json(allMessages);
  } catch (e) {
    res.status(500).json({ error: String(e).replace(/^Error:\s*/gi, "") });
  }
}

void extractBetween; // unused but kept for parity with original parser
