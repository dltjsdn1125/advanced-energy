// Server-side only — do not import in client components
import { execSync, spawn } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const PS_HEADER = [
  "$OutputEncoding = [System.Text.Encoding]::UTF8",
  "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
  '$ErrorActionPreference = "SilentlyContinue"',
  "",
  "function Out-B64 {",
  "  param($obj)",
  "  $json = if ($obj -is [string]) { $obj } else { $obj | ConvertTo-Json -Depth 5 -Compress }",
  "  if (-not $json) { $json = 'null' }",
  "  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)",
  "  [Convert]::ToBase64String($bytes)",
  "}",
  "",
].join("\n");

function writeTmp(script: string): string {
  const tmp = join(tmpdir(), `ae_ps_${Date.now()}_${Math.random().toString(36).slice(2)}.ps1`);
  writeFileSync(tmp, "﻿" + PS_HEADER + script, "utf8");
  return tmp;
}

function decode(raw: string): unknown {
  const b64 = raw.trim();
  if (!b64) throw new Error("PowerShell이 빈 출력을 반환했습니다");
  const json = Buffer.from(b64, "base64").toString("utf8");
  return JSON.parse(json);
}

/** Blocking — use only when you must wait for the result inline */
export function runPs(script: string, timeoutMs = 20000): unknown {
  const tmp = writeTmp(script);
  try {
    const raw = execSync(
      `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmp}"`,
      { timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024, encoding: "ascii" }
    ) as unknown as string;
    return decode(raw);
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

/** Non-blocking — frees the Node event loop during PS execution */
export function runPsAsync(script: string, timeoutMs = 30000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tmp = writeTmp(script);
    let stdout = "";
    let settled = false;

    const ps = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", tmp],
      { windowsHide: true }
    );

    ps.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("ascii"); });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ps.kill(); } catch {}
      try { unlinkSync(tmp); } catch {}
      reject(new Error(`PowerShell timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    ps.on("close", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { unlinkSync(tmp); } catch {}
      try { resolve(decode(stdout)); }
      catch (e) { reject(e); }
    });

    ps.on("error", (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { unlinkSync(tmp); } catch {}
      reject(e);
    });
  });
}
