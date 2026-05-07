import { NextRequest, NextResponse } from "next/server";
import { runPs } from "@/lib/runPs";

type Action = "reply" | "replyAll" | "forward";

// Convert markdown pipe-tables to HTML tables, then plain-text newlines to <br>
function markdownToHtml(text: string): string {
  const TABLE_ROW = /^\|.+\|$/;
  const SEP_ROW   = /^\|[\s\-|:]+\|$/;

  const lines = text.replace(/\. /g, ".\n").split("\n");
  const out: string[] = [];
  let tableBuf: string[] = [];

  function flushTable() {
    if (tableBuf.length === 0) return;
    const dataRows = tableBuf.filter(r => !SEP_ROW.test(r));
    const rows = dataRows.map((row, i) => {
      const cells = row.split("|").slice(1, -1).map(c => c.trim());
      return i === 0
        ? `<tr>${cells.map(c => `<th style="background:#e8eef4;font-weight:bold;padding:6px 10px;border:1px solid #b0b8c1;text-align:left">${c}</th>`).join("")}</tr>`
        : `<tr>${cells.map(c => `<td style="padding:6px 10px;border:1px solid #b0b8c1">${c}</td>`).join("")}</tr>`;
    });
    out.push(`<table style="border-collapse:collapse;font-size:13px;margin:8px 0;font-family:Calibri,Arial,sans-serif">${rows.join("")}</table>`);
    tableBuf = [];
  }

  for (const line of lines) {
    if (TABLE_ROW.test(line.trim())) {
      tableBuf.push(line.trim());
    } else {
      flushTable();
      out.push(line);
    }
  }
  flushTable();

  // For non-table segments, replace \n with <br>; leave table HTML intact
  return out
    .join("\n")
    .split(/(<table[\s\S]*?<\/table>)/)
    .map((part, i) => (i % 2 === 0 ? part.replace(/\n/g, "<br>") : part))
    .join("");
}

function buildScript(entryId: string, body: string, send: boolean, to: string, cc: string, action: Action): string {
  const safeEntry = entryId.replace(/'/g, "''");
  const safeTo    = to.replace(/'/g, "''");
  const safeCc    = cc.replace(/'/g, "''");

  const createItem =
    action === "replyAll" ? "$item = $original.ReplyAll()" :
    action === "forward"  ? "$item = $original.Forward()"  :
                            "$item = $original.Reply()";

  const injectBody = body.trim() ? (() => {
    const htmlBody = `<div style="font-family:Calibri,Arial,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a">${markdownToHtml(body)}</div><br><br>`;
    const bodyB64  = Buffer.from(htmlBody, "utf8").toString("base64");
    return `
  $bodyHtml = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${bodyB64}'))
  $item.HTMLBody = $bodyHtml + $item.HTMLBody`;
  })() : "";

  const setTo     = `if ('${safeTo}' -ne '') { $item.To = '${safeTo}' }`;
  const setCc     = `if ('${safeCc}' -ne '') { $item.CC = '${safeCc}' }`;
  const execAction = send ? "$item.Send()" : "$item.Display($false)";

  return `
$ol = $null
try { $ol = [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application') } catch {}
if (-not $ol) { try { $ol = New-Object -ComObject Outlook.Application } catch {} }
if (-not $ol) { Out-B64 @{ error = "Outlook 연결 실패" }; exit }

try {
  $ns       = $ol.GetNamespace('MAPI')
  $original = $ns.GetItemFromID('${safeEntry}')
  ${createItem}
${injectBody}
  ${setTo}
  ${setCc}
  ${execAction}
  Out-B64 @{ ok = $true }
} catch {
  Out-B64 @{ error = "$_" }
}
`;
}

export async function POST(request: NextRequest) {
  const { entryId, body = "", send, to = "", cc = "", action = "reply" } =
    await request.json() as { entryId: string; body?: string; send?: boolean; to?: string; cc?: string; action?: Action };

  if (!entryId)
    return NextResponse.json({ error: "entryId 필요" }, { status: 400 });

  try {
    const result = runPs(buildScript(entryId, body, !!send, to, cc, action), 30000) as { ok?: boolean; error?: string };
    if (result?.error) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
