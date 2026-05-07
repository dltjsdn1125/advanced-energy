import { NextRequest, NextResponse } from "next/server";
import { runPs } from "@/lib/runPs";

function buildScript(entryId: string, attachName: string): string {
  const safeEntry = entryId.replace(/'/g, "''");
  const safeName = attachName.replace(/'/g, "''").replace(/"/g, '""');
  return `
$ol = $null
try { $ol = [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application') } catch {}
if (-not $ol) { try { $ol = New-Object -ComObject Outlook.Application } catch {} }
if (-not $ol) { Out-B64 @{ error = "Outlook 연결 실패" }; exit }

try {
  $ns   = $ol.GetNamespace('MAPI')
  $item = $ns.GetItemFromID('${safeEntry}')
  $found = $false
  for ($a = 1; $a -le $item.Attachments.Count; $a++) {
    $att = $item.Attachments.Item($a)
    if ($att.FileName -eq '${safeName}') {
      $tmp  = [System.IO.Path]::GetTempFileName()
      $att.SaveAsFile($tmp)
      $bytes = [System.IO.File]::ReadAllBytes($tmp)
      [System.IO.File]::Delete($tmp)
      $result = [PSCustomObject]@{
        name = "$($att.FileName)"
        data = [Convert]::ToBase64String($bytes)
        size = $bytes.Length
      }
      Out-B64 $result
      $found = $true
      break
    }
  }
  if (-not $found) { Out-B64 @{ error = "첨부파일을 찾을 수 없습니다" } }
} catch {
  Out-B64 @{ error = "$_" }
}
`;
}

function mimeType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    txt: "text/plain",
    csv: "text/csv",
    zip: "application/zip",
  };
  return map[ext] ?? "application/octet-stream";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const entryId = searchParams.get("entryId") ?? "";
  const name = searchParams.get("name") ?? "";
  if (!entryId || !name)
    return NextResponse.json({ error: "entryId, name 필요" }, { status: 400 });

  try {
    const result = runPs(buildScript(entryId, name), 20000) as {
      error?: string;
      data?: string;
      name?: string;
    };
    if (result?.error) return NextResponse.json({ error: result.error }, { status: 500 });
    const buf = Buffer.from(result.data ?? "", "base64");
    return new NextResponse(buf, {
      headers: {
        "Content-Type": mimeType(name),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
