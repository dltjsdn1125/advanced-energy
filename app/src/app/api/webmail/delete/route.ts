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

export async function POST(request: NextRequest) {
  const body      = await request.json() as Record<string, unknown>;
  const host      = String(body.host      ?? "");
  const user      = String(body.user      ?? "");
  const pass      = String(body.pass      ?? "");
  const entryId   = String(body.entryId   ?? "");
  const permanent = Boolean(body.permanent ?? false);

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
    const cookie = await mailnaraLogin(host, user, pass);

    if (permanent) {
      // Permanent delete from server
      const delUrl = `https://${host}/new_mailnara_web/index.php/mail/mail_delete_real`;
      const form = new URLSearchParams();
      form.append("mailbox", mailbox);
      form.append("uid[]", uid);
      const resp = await fetch(delUrl, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      if (!resp.ok) {
        // Fallback: try alternate permanent delete endpoint
        const alt = `https://${host}/new_mailnara_web/index.php/mail/mail_delete/${mailbox}/${uid}/real`;
        const r2 = await fetch(alt, { headers: { Cookie: cookie } });
        if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
      }
    } else {
      // Move to Trash
      const moveUrl = `https://${host}/new_mailnara_web/index.php/mail/mail_move`;
      const form = new URLSearchParams();
      form.append("mailbox", mailbox);
      form.append("target_mailbox", "Trash");
      form.append("uid[]", uid);
      const resp = await fetch(moveUrl, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      if (!resp.ok) {
        // Fallback: try alternate delete endpoint (moves to trash by default)
        const alt = `https://${host}/new_mailnara_web/index.php/mail/mail_delete`;
        const form2 = new URLSearchParams();
        form2.append("mailbox", mailbox);
        form2.append("uid[]", uid);
        const r2 = await fetch(alt, {
          method: "POST",
          headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
          body: form2.toString(),
        });
        if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
      }
    }

    console.log(`[WEBMAIL-DELETE] done`);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = String(e).replace(/^Error:\s*/gi, "");
    console.error(`[WEBMAIL-DELETE] FAILED:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
