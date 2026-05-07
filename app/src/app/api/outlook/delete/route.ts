import { NextRequest, NextResponse } from "next/server";
import { runPsAsync } from "@/lib/runPs";

function buildScript(entryId: string): string {
  const safeEntry = entryId.replace(/'/g, "''");
  return `
$ol = $null
try { $ol = [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application') } catch {}
if (-not $ol) { try { $ol = New-Object -ComObject Outlook.Application } catch {} }
if (-not $ol) { Out-B64 @{ error = "Outlook 연결 실패" }; exit }

$ns = $ol.GetNamespace('MAPI')
try {
  $item = $ns.GetItemFromID('${safeEntry}')
  if ($item -eq $null) {
    Out-B64 @{ ok = $false; error = "메일을 찾을 수 없습니다." }
    exit
  }
  $item.Delete()
  Out-B64 @{ ok = $true }
} catch {
  Out-B64 @{ ok = $false; error = "$_" }
}
`;
}

export async function POST(request: NextRequest) {
  const { entryId } = (await request.json()) as { entryId?: string };
  if (!entryId) {
    return NextResponse.json({ error: "entryId 필요" }, { status: 400 });
  }

  try {
    const result = await runPsAsync(buildScript(entryId), 30000) as { ok?: boolean; error?: unknown };
    if (result?.ok === false) {
      return NextResponse.json({ error: String(result.error ?? "삭제 실패") }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
