import { NextResponse } from "next/server";
import { runPsAsync } from "@/lib/runPs";

const SCRIPT = `
$ol = $null
try { $ol = [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application') } catch {}
if (-not $ol) { try { $ol = New-Object -ComObject Outlook.Application } catch {} }
if (-not $ol) { Out-B64 @{ error = "Outlook 연결 실패" }; exit }

$ns    = $ol.GetNamespace('MAPI')
$name  = ''
$email = ''

# Try accounts collection first (most reliable for SMTP address)
try {
  $acc   = $ns.Accounts.Item(1)
  $email = [string]$acc.SmtpAddress
  $name  = [string]$acc.DisplayName
} catch {}

# Fallback: CurrentUser
if (-not $email) {
  try { $name  = [string]$ns.CurrentUser.Name    } catch {}
  try { $email = [string]$ns.CurrentUser.Address } catch {}
}

# If email looks like Exchange DN (/o=...), try AddressEntry
if ($email -like '/o=*') {
  try {
    $email = [string]$ns.CurrentUser.AddressEntry.GetExchangeUser().PrimarySmtpAddress
  } catch {}
}

Out-B64 @{ name = $name; email = $email }
`;

let cached: { name: string; email: string } | null = null;

export async function GET() {
  if (process.platform !== "win32") {
    return NextResponse.json({ error: "Outlook 연동은 Windows 환경에서만 사용 가능합니다" }, { status: 503 });
  }
  if (cached) return NextResponse.json(cached);
  try {
    const data = await runPsAsync(SCRIPT, 15000) as { name?: string; email?: string; error?: string };
    if (data?.error) return NextResponse.json({ error: data.error }, { status: 500 });
    cached = { name: data?.name ?? "", email: data?.email ?? "" };
    return NextResponse.json(cached);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
