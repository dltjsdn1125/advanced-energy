import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function extractBetween(html: string, start: string, end: string): string {
  const s = html.indexOf(start);
  if (s < 0) return "";
  const e = html.indexOf(end, s + start.length);
  if (e < 0) return "";
  return html.slice(s + start.length, e).trim();
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

async function mailnaraLogin(
  host: string,
  user: string,
  pass: string
): Promise<string> {
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

  if (resp.status !== 302) {
    const text = await resp.text();
    const err = extractBetween(text, "fmt_str = \"", "\"") ||
      extractBetween(text, "error_code = '", "'") ||
      `HTTP ${resp.status}`;
    throw new Error(`웹메일 로그인 실패: ${err}`);
  }

  const allCookies: string[] = [];
  if (typeof (resp.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function") {
    const fn = (resp.headers as unknown as { getSetCookie: () => string[] }).getSetCookie;
    allCookies.push(...fn.call(resp.headers));
  } else {
    const raw = resp.headers.get("set-cookie");
    if (raw) allCookies.push(raw);
  }

  const cookiePairs = allCookies.map(c => c.split(";")[0].trim()).filter(Boolean);
  if (!cookiePairs.length) throw new Error("웹메일 로그인 실패: 세션 쿠키 없음");
  return cookiePairs.join("; ");
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
      entryId,
      conversationId: entryId,
      subject,
      senderName: fromName || fromEmail,
      senderEmail: fromEmail,
      receivedTime,
      preview: "",
      isUnread,
      isToMe: false,
      attachmentCount: hasAttach ? 1 : 0,
    });
  }

  return messages;
}

const PAGE_SIZE = 200;
// Kept for legacy full-pagination mode only
const FETCH_TIMEOUT_MS = 25_000;

const MAILBOX_MAP: Record<string, string> = {
  inbox:   "Inbox",
  sent:    "Sent",
  drafts:  "Temp",
  deleted: "Trash",
  junk:    "Advert",
};

export async function POST(request: NextRequest) {
  const body          = await request.json() as Record<string, unknown>;
  const host          = String(body.host          ?? "");
  const user          = String(body.user          ?? "");
  const pass          = String(body.pass          ?? "");
  const folder        = String(body.folder        ?? "inbox").toLowerCase();
  // Client-driven pagination: sessionCookie avoids re-login; page fetches one page
  const sessionCookie = String(body.sessionCookie ?? "");
  const pageParam     = body.page !== undefined ? Number(body.page) : undefined;

  const mailbox = MAILBOX_MAP[folder] ?? "Inbox";

  if (!host || !user || !pass) {
    return NextResponse.json({ error: "webmail 설정이 필요합니다 (host, user, pass)" }, { status: 400 });
  }

  console.log(`[WEBMAIL] host=${host} user=${user} mailbox=${mailbox} page=${pageParam ?? "full"}`);

  try {
    // Reuse existing session cookie when provided (avoids re-login for pages 1+)
    const cookie = sessionCookie || await mailnaraLogin(host, user, pass);
    console.log(`[WEBMAIL] cookie ok (${sessionCookie ? "reused" : "fresh"}) ${cookie.slice(0, 30)}…`);

    // ── Single-page mode (client-driven pagination) ──────────────────────────
    if (pageParam !== undefined) {
      const listUrl = `https://${host}/new_mailnara_web/index.php/mail/mail_list/${mailbox}/${pageParam}/${PAGE_SIZE}`;
      const listResp = await fetch(listUrl, { headers: { Cookie: cookie } });
      if (!listResp.ok) throw new Error(`메일 목록 가져오기 실패: HTTP ${listResp.status}`);
      const html = await listResp.text();
      // Detect redirect to login page (session not working)
      if (pageParam === 0 && !html.includes("row_id_")) {
        const isLoginPage = /login\.php|login_id|login_passwd/i.test(html);
        const snippet = html.slice(0, 300).replace(/\s+/g, " ");
        console.log(`[WEBMAIL] page0 no row_id_. isLoginPage=${isLoginPage} snippet: ${snippet}`);
        if (isLoginPage) throw new Error(`웹메일 세션 만료 또는 로그인 실패. 서버 응답: ${snippet}`);
      }
      const msgs = parseMailList(html, mailbox);
      console.log(`[WEBMAIL] single-page mode page=${pageParam} got=${msgs.length}`);
      return NextResponse.json({
        messages: msgs,
        hasMore: msgs.length >= PAGE_SIZE,
        sessionCookie: cookie,
      });
    }

    // ── Full-pagination mode (legacy / first load fallback) ──────────────────
    const allMessages: unknown[] = [];
    const started = Date.now();
    let page = 0;

    while (true) {
      if (Date.now() - started > FETCH_TIMEOUT_MS) {
        console.log(`[WEBMAIL] timeout guard — page=${page} total=${allMessages.length}`);
        break;
      }

      const listUrl = `https://${host}/new_mailnara_web/index.php/mail/mail_list/${mailbox}/${page}/${PAGE_SIZE}`;
      const listResp = await fetch(listUrl, { headers: { Cookie: cookie } });
      if (!listResp.ok) throw new Error(`메일 목록 가져오기 실패: HTTP ${listResp.status}`);

      const html = await listResp.text();
      if (page === 0) {
        const rowIdx = html.indexOf("row_id_");
        const snippet = rowIdx >= 0 ? html.slice(Math.max(0, rowIdx - 50), rowIdx + 500) : html.slice(0, 500);
        console.log(`[WEBMAIL] page0 snippet: ${snippet.replace(/\n/g, " ").replace(/\s+/g, " ")}`);
      }
      const msgs = parseMailList(html, mailbox);
      console.log(`[WEBMAIL] page=${page} got=${msgs.length}`);

      if (msgs.length === 0) break;
      allMessages.push(...msgs);
      if (msgs.length < PAGE_SIZE) break;

      page++;
    }

    console.log(`[WEBMAIL] done. total=${allMessages.length} (${page + 1} pages)`);
    return NextResponse.json(allMessages);
  } catch (e: unknown) {
    const msg = String(e).replace(/^Error:\s*/gi, "");
    console.error(`[WEBMAIL] FAILED:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
