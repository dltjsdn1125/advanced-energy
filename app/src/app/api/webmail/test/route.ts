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
  const location = resp.headers.get("location") ?? "";
  if (resp.status !== 302) {
    const text = await resp.text().catch(() => "");
    return JSON.stringify({ ok: false, step: "login", status: resp.status, location, htmlSnippet: text.slice(0, 300) });
  }
  const allCookies: string[] = [];
  if (typeof (resp.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function") {
    const fn = (resp.headers as unknown as { getSetCookie: () => string[] }).getSetCookie;
    allCookies.push(...fn.call(resp.headers));
  } else {
    const raw = resp.headers.get("set-cookie");
    if (raw) allCookies.push(raw);
  }
  const pairs = allCookies.map(c => c.split(";")[0].trim()).filter(Boolean);
  if (!pairs.length) return JSON.stringify({ ok: false, step: "cookie", status: resp.status, location });
  return pairs.join("; ");
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;
  const host = String(body.host ?? "");
  const user = String(body.user ?? "");
  const pass = String(body.pass ?? "");

  if (!host || !user || !pass) {
    return NextResponse.json({ ok: false, error: "host, user, pass 필요" });
  }

  const result: Record<string, unknown> = { host, user };

  // Step 1: Login
  let cookie = "";
  try {
    const loginResult = await mailnaraLogin(host, user, pass);
    // If loginResult looks like JSON, it's an error object
    if (loginResult.startsWith("{")) {
      const err = JSON.parse(loginResult);
      return NextResponse.json({ ok: false, step: "login", ...err });
    }
    cookie = loginResult;
    result.loginOk = true;
    result.cookieLen = cookie.length;
    result.cookiePreview = cookie.slice(0, 60);
  } catch (e) {
    return NextResponse.json({ ok: false, step: "login", error: String(e) });
  }

  // Step 2: Fetch inbox page 0
  try {
    const listUrl = `https://${host}/new_mailnara_web/index.php/mail/mail_list/Inbox/0/10`;
    const listResp = await fetch(listUrl, { headers: { Cookie: cookie } });
    result.listStatus = listResp.status;
    const html = await listResp.text();
    result.htmlLen = html.length;
    result.hasRowId = html.includes("row_id_");
    result.hasLoginForm = /login\.php|login_id|login_passwd/i.test(html);
    result.htmlSnippet = html.slice(0, 500).replace(/\s+/g, " ");

    // Count row_ids
    const rowMatches = html.match(/id=["']row_id_\d+["']/g);
    result.rowIdCount = rowMatches ? rowMatches.length : 0;

    result.ok = result.hasRowId && !result.hasLoginForm;
  } catch (e) {
    result.listError = String(e);
    result.ok = false;
  }

  return NextResponse.json(result);
}
