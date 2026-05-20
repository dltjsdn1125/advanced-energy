import type { Request, Response } from "express";
import { mailnaraLogin } from "../lib/mailnara.js";

export async function webmailAttachmentRoute(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const host          = String(body.host          ?? "");
  const user          = String(body.user          ?? "");
  const pass          = String(body.pass          ?? "");
  const sessionCookie = String(body.sessionCookie ?? "");
  const downloadUrl   = String(body.downloadUrl   ?? "");
  const filename      = String(body.filename      ?? "attachment");

  if (!host || !user || !pass || !downloadUrl) {
    res.status(400).json({ error: "필수 파라미터 누락" });
    return;
  }

  let absUrl = downloadUrl;
  if (downloadUrl.startsWith("//")) absUrl = `https:${downloadUrl}`;
  else if (downloadUrl.startsWith("/")) absUrl = `https://${host}${downloadUrl}`;
  else if (!/^https?:\/\//i.test(downloadUrl)) absUrl = `https://${host}/${downloadUrl}`;

  try {
    const parsed = new URL(absUrl);
    const rootDomain = (h: string) => {
      const p = h.split(".");
      return p.length >= 2 ? p.slice(-2).join(".") : h;
    };
    if (rootDomain(parsed.hostname) !== rootDomain(host)) {
      res.status(400).json({ error: `다른 도메인 다운로드 불가: ${parsed.hostname}` });
      return;
    }
  } catch {
    res.status(400).json({ error: `잘못된 URL: ${absUrl}` });
    return;
  }

  try {
    const cookie = sessionCookie || await mailnaraLogin(host, user, pass);
    let r = await fetch(absUrl, { headers: { Cookie: cookie }, redirect: "follow" });
    if (!r.ok) {
      const fresh = await mailnaraLogin(host, user, pass);
      r = await fetch(absUrl, { headers: { Cookie: fresh }, redirect: "follow" });
      if (!r.ok) throw new Error(`첨부 다운로드 실패: HTTP ${r.status}`);
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", r.headers.get("content-type") ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Length", String(buf.byteLength));
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: String(e).replace(/^Error:\s*/gi, "") });
  }
}
