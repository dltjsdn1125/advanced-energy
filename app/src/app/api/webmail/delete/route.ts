import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

async function mailnaraLogin(host: string, user: string, pass: string): Promise<string> {
  const loginHost = host.replace(/^(mail|smtp|pop|imap)\./i, "");
  const body = new URLSearchParams({
    login_host: loginHost, login_type: "U", template_language: "korean",
    admin_login: "0", org_domain: "", org_uid: "", passwd_validation: "true",
    is_mobile: "W", webmail_admin_login: "", usingAdminChange: "", keyTime: "",
    login_id: user, login_passwd: pass,
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

// Try a list of candidate URLs until one returns a non-error HTTP status.
// Returns true if any succeeded, false otherwise.
async function tryUrls(
  candidates: { method: string; url: string; body?: string; contentType?: string }[],
  cookie: string,
): Promise<boolean> {
  for (const c of candidates) {
    try {
      const headers: Record<string, string> = { Cookie: cookie };
      if (c.contentType) headers["Content-Type"] = c.contentType;
      const resp = await fetch(c.url, {
        method: c.method,
        headers,
        body: c.body,
        redirect: "follow",
      });
      // Accept 200–399 as success (MAILNARA may 200 or 302-to-redirect on success)
      if (resp.status < 400) {
        console.log(`[WEBMAIL-DELETE] success with ${c.method} ${c.url} → ${resp.status}`);
        return true;
      }
      console.log(`[WEBMAIL-DELETE] ${c.method} ${c.url} → ${resp.status} (trying next)`);
    } catch (e) {
      console.log(`[WEBMAIL-DELETE] ${c.method} ${c.url} → fetch error: ${e}`);
    }
  }
  return false;
}

export async function POST(request: NextRequest) {
  const body          = await request.json() as Record<string, unknown>;
  const host          = String(body.host          ?? "");
  const user          = String(body.user          ?? "");
  const pass          = String(body.pass          ?? "");
  const entryId       = String(body.entryId       ?? "");
  const sessionCookie = String(body.sessionCookie ?? "");
  const permanent     = Boolean(body.permanent    ?? false);

  if (!host || !user || !pass || !entryId) {
    return NextResponse.json({ error: "host, user, pass, entryId 필요" }, { status: 400 });
  }

  // Parse entryId: "web-123" → Inbox/123, "web-Sent:123" → Sent/123
  const withoutPrefix = entryId.replace(/^web-/, "");
  let mailbox = "Inbox";
  let uid = withoutPrefix;
  if (withoutPrefix.includes(":")) {
    const colonIdx = withoutPrefix.indexOf(":");
    mailbox = withoutPrefix.slice(0, colonIdx);
    uid = withoutPrefix.slice(colonIdx + 1);
  }

  console.log(`[WEBMAIL-DELETE] host=${host} mailbox=${mailbox} uid=${uid} permanent=${permanent}`);

  try {
    const cookie = sessionCookie || await mailnaraLogin(host, user, pass);
    const base = `https://${host}/new_mailnara_web/index.php`;

    // Build form bodies for POST candidates
    const formMove = new URLSearchParams({ mailbox, target_mailbox: "Trash", "uid[]": uid }).toString();
    const formDel  = new URLSearchParams({ mailbox, "uid[]": uid }).toString();
    const formDelReal = new URLSearchParams({ mailbox, "uid[]": uid, del_mode: "real" }).toString();
    const ct = "application/x-www-form-urlencoded";

    let candidates;
    if (permanent) {
      candidates = [
        // GET-style (CodeIgniter resource URL pattern)
        { method: "GET",  url: `${base}/mail/mail_delete_real/${mailbox}/${uid}` },
        { method: "GET",  url: `${base}/mail/mail_delete/${mailbox}/${uid}/real` },
        { method: "GET",  url: `${base}/mail/mail_delete_proc/${mailbox}/${uid}/Y` },
        // POST-style
        { method: "POST", url: `${base}/mail/mail_delete_real`, body: formDelReal, contentType: ct },
        { method: "POST", url: `${base}/mail/mail_delete`,      body: formDel,     contentType: ct },
        { method: "POST", url: `${base}/mail/ajax_mail_delete`, body: formDel,     contentType: ct },
      ];
    } else {
      candidates = [
        // GET-style (move to trash)
        { method: "GET",  url: `${base}/mail/mail_delete/${mailbox}/${uid}` },
        { method: "GET",  url: `${base}/mail/mail_move_to_trash/${mailbox}/${uid}` },
        { method: "GET",  url: `${base}/mail/mail_delete_proc/${mailbox}/${uid}/N` },
        // POST-style
        { method: "POST", url: `${base}/mail/mail_move`,        body: formMove,    contentType: ct },
        { method: "POST", url: `${base}/mail/mail_delete`,      body: formDel,     contentType: ct },
        { method: "POST", url: `${base}/mail/ajax_mail_delete`, body: formDel,     contentType: ct },
      ];
    }

    const serverOk = await tryUrls(candidates, cookie);
    // Always return ok:true — UI removes from cache regardless.
    // serverDeleted tells the client whether the server actually confirmed deletion.
    console.log(`[WEBMAIL-DELETE] serverOk=${serverOk}`);
    return NextResponse.json({ ok: true, serverDeleted: serverOk });
  } catch (e: unknown) {
    const msg = String(e).replace(/^Error:\s*/gi, "");
    console.error(`[WEBMAIL-DELETE] FAILED:`, msg);
    // Still return ok:true so UI removes the message from the list.
    // The actual server state may not be updated but the UX is preserved.
    return NextResponse.json({ ok: true, serverDeleted: false, warning: msg });
  }
}
