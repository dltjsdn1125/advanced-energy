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

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;
  const host          = String(body.host          ?? "");
  const user          = String(body.user          ?? "");
  const pass          = String(body.pass          ?? "");
  const sessionCookie = String(body.sessionCookie ?? "");
  const downloadUrl   = String(body.downloadUrl   ?? "");
  const filename      = String(body.filename      ?? "attachment");

  if (!host || !user || !pass || !downloadUrl) {
    return NextResponse.json({ error: "필수 파라미터: host, user, pass, downloadUrl" }, { status: 400 });
  }

  // Resolve download URL — accept relative or absolute, but pin to host
  let absUrl = downloadUrl;
  if (downloadUrl.startsWith("/")) {
    absUrl = `https://${host}${downloadUrl}`;
  } else if (!downloadUrl.startsWith("http")) {
    absUrl = `https://${host}/${downloadUrl}`;
  } else if (!downloadUrl.startsWith(`https://${host}`) && !downloadUrl.startsWith(`http://${host}`)) {
    return NextResponse.json({ error: "외부 URL 다운로드 불가" }, { status: 400 });
  }

  console.log(`[WEBMAIL-ATTACH] ${user} download ${absUrl}`);

  try {
    const cookie = sessionCookie || await mailnaraLogin(host, user, pass);
    const resp = await fetch(absUrl, { headers: { Cookie: cookie }, redirect: "follow" });
    if (!resp.ok) {
      // Session may have expired — re-login once and retry
      const fresh = await mailnaraLogin(host, user, pass);
      const retry = await fetch(absUrl, { headers: { Cookie: fresh }, redirect: "follow" });
      if (!retry.ok) throw new Error(`첨부 다운로드 실패: HTTP ${retry.status}`);
      const buf = await retry.arrayBuffer();
      return new Response(buf, {
        headers: {
          "Content-Type": retry.headers.get("content-type") ?? "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
          "Content-Length": String(buf.byteLength),
        },
      });
    }
    const buf = await resp.arrayBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": resp.headers.get("content-type") ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": String(buf.byteLength),
      },
    });
  } catch (e: unknown) {
    const msg = String(e).replace(/^Error:\s*/i, "");
    console.error(`[WEBMAIL-ATTACH] FAILED:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
