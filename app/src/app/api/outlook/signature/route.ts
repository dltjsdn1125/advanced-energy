import { NextResponse } from "next/server";
import { runPsAsync } from "@/lib/runPs";

// GetInspector() triggers Outlook to inject the default signature into the item body.
// Without it, MailItem.Body is always empty on a new unsaved item.
// Fallback: read .txt signature files directly from %APPDATA%\Microsoft\Signatures\.
const script = `
$ol = $null
try { $ol = [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application') } catch {}
if (-not $ol) { try { $ol = New-Object -ComObject Outlook.Application } catch {} }
if (-not $ol) { Out-B64 @{ error = "Outlook 연결 실패" }; exit }

$sig = ''
try {
  $item = $ol.CreateItem(0)
  $null = $item.GetInspector()   # triggers signature injection
  $sig  = [string]$item.Body
  try { $item.Close(1) } catch {} # 1 = olDiscard (no save)
} catch {}

# Fallback — read the most-recently-modified .txt signature file
if ([string]::IsNullOrWhiteSpace($sig)) {
  try {
    $dir = [System.IO.Path]::Combine($env:APPDATA, 'Microsoft', 'Signatures')
    if ([System.IO.Directory]::Exists($dir)) {
      $files = Get-ChildItem -Path $dir -Filter '*.txt' -ErrorAction SilentlyContinue |
               Sort-Object LastWriteTime -Descending
      if ($files) {
        $sig = [System.IO.File]::ReadAllText($files[0].FullName, [System.Text.Encoding]::UTF8)
      }
    }
  } catch {}
}

Out-B64 @{ signature = $sig.Trim() }
`;

export async function GET() {
  try {
    const data = await runPsAsync(script, 20000) as { signature?: string; error?: string };
    if (data?.error) return NextResponse.json({ error: data.error }, { status: 500 });
    return NextResponse.json({ signature: data?.signature ?? "" });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
