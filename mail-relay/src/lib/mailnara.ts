/**
 * Shared MAILNARA login helper.
 * POSTs login form, returns the session cookie joined as a Cookie header string.
 */
export async function mailnaraLogin(host: string, user: string, pass: string): Promise<string> {
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
    throw new Error(`웹메일 로그인 실패 (HTTP ${resp.status})`);
  }
  const allCookies: string[] = [];
  const getSetCookie = (resp.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === "function") {
    allCookies.push(...getSetCookie.call(resp.headers));
  } else {
    const raw = resp.headers.get("set-cookie");
    if (raw) allCookies.push(raw);
  }
  const pairs = allCookies.map(c => c.split(";")[0].trim()).filter(Boolean);
  if (!pairs.length) throw new Error("웹메일 로그인 실패: 세션 쿠키 없음");
  return pairs.join("; ");
}
