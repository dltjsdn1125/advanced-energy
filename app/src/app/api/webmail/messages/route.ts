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

  // Collect all Set-Cookie values
  const allCookies: string[] = [];
  // Node 18+ supports getSetCookie()
  if (typeof (resp.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function") {
    const fn = (resp.headers as unknown as { getSetCookie: () => string[] }).getSetCookie;
    allCookies.push(...fn.call(resp.headers));
  } else {
    const raw = resp.headers.get("set-cookie");
    if (raw) allCookies.push(raw);
  }

  // Parse into name=value pairs
  const cookiePairs = allCookies.map(c => c.split(";")[0].trim()).filter(Boolean);
  if (!cookiePairs.length) throw new Error("웹메일 로그인 실패: 세션 쿠키 없음");
  return cookiePairs.join("; ");
}

function parseMailList(html: string): unknown[] {
  const messages: unknown[] = [];

  // Split on each row_id boundary — more robust than lookahead regex
  const parts = html.split(/(?=id=["']row_id_\d+["'])/);

  for (const part of parts) {
    const uidMatch = part.match(/id=["']row_id_(\d+)["']/);
    if (!uidMatch) continue;
    const uid = uidMatch[1];
    // Limit block to at most 6000 chars to avoid cross-item bleed
    const block = part.slice(0, 6000);

    // seen status (double or single quotes)
    const seenMatch = block.match(new RegExp(`id=["']seen_${uid}["'][^>]*value=["']([^"']+)["']`));
    const isUnread = !seenMatch || seenMatch[1] === "N";

    // from email
    const fromEmailMatch = block.match(new RegExp(`id=["']from_address_${uid}["'][^>]*value=["']([^"']+)["']`));
    const fromEmail = fromEmailMatch ? fromEmailMatch[1] : "";

    // from name — span with title attr in m-from area
    const fromNameMatch = block.match(/<span[^>]+title=["'][^"']*["'][^>]*>([^<]+)<\/span>/);
    const fromNameRaw = fromNameMatch ? fromNameMatch[1] : "";
    const fromName = decodeHtml(fromNameRaw.replace(/\s*\.\.\.$/, "").trim());

    // subject (try double quote, then single quote id variant)
    const subjMatch =
      block.match(new RegExp(`id=["']title_list_${uid}["'][^>]*>([^<]+)<`)) ||
      block.match(/class=["']m-subject[^"']*["'][^>]*>\s*<[^>]+>([^<]+)</) ;
    const subject = subjMatch ? decodeHtml(subjMatch[1]) : "(제목 없음)";

    // date — handles "2026.05.07 <span>21:38</span>" and similar patterns
    const dateMatch = block.match(/class=["']m-date[^"']*["'][^>]*>([\d.]+)\s*<span[^>]*>([\d:]+)<\/span>/);
    let receivedTime = "";
    if (dateMatch) {
      const [, datePart, timePart] = dateMatch;
      const normalized = datePart.replace(/\./g, "-") + "T" + timePart + ":00+09:00";
      receivedTime = new Date(normalized).toISOString();
    }

    // attachment icon
    const hasAttach = /class=["']m-file["']/.test(block) && !/style=["'][^"']*display\s*:\s*none/.test(block);

    messages.push({
      entryId: `web-${uid}`,
      conversationId: `web-${uid}`,
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

const PAGE_SIZE = 200; // messages per MAILNARA page request
const FETCH_TIMEOUT_MS = 25_000; // stop paging 5s before Vercel's 30s limit

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;
  const host = String(body.host ?? "");
  const user = String(body.user ?? "");
  const pass = String(body.pass ?? "");

  if (!host || !user || !pass) {
    return NextResponse.json({ error: "webmail 설정이 필요합니다 (host, user, pass)" }, { status: 400 });
  }

  console.log(`[WEBMAIL] connecting → https://${host} user=${user}`);

  try {
    const cookie = await mailnaraLogin(host, user, pass);
    console.log(`[WEBMAIL] login ok, cookie=${cookie.slice(0, 40)}…`);

    const allMessages: unknown[] = [];
    const started = Date.now();
    let page = 0;

    while (true) {
      if (Date.now() - started > FETCH_TIMEOUT_MS) {
        console.log(`[WEBMAIL] timeout guard hit — stopping at page=${page} total=${allMessages.length}`);
        break;
      }

      const listUrl = `https://${host}/new_mailnara_web/index.php/mail/mail_list/Inbox/${page}/${PAGE_SIZE}`;
      const listResp = await fetch(listUrl, { headers: { Cookie: cookie } });
      if (!listResp.ok) throw new Error(`메일 목록 가져오기 실패: HTTP ${listResp.status}`);

      const html = await listResp.text();
      const msgs = parseMailList(html);
      console.log(`[WEBMAIL] page=${page} got=${msgs.length}`);

      if (msgs.length === 0) break;
      allMessages.push(...msgs);
      if (msgs.length < PAGE_SIZE) break; // partial page = last page

      page++;
    }

    console.log(`[WEBMAIL] done. total=${allMessages.length} messages (${page + 1} pages)`);
    return NextResponse.json(allMessages);
  } catch (e: unknown) {
    const msg = String(e).replace(/^Error:\s*/gi, "");
    console.error(`[WEBMAIL] FAILED:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
