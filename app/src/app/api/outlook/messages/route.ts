import { NextRequest, NextResponse } from "next/server";
import { runPsAsync } from "@/lib/runPs";

const FOLDER_MAP: Record<string, number> = {
  inbox: 6, sent: 5, drafts: 16, junk: 23, deleted: 3,
};

// ── Server-side stale-while-revalidate cache ──────────────────────────────────
interface CacheEntry { data: unknown; ts: number; inflight: boolean }
const srvCache = new Map<string, CacheEntry>();
const FRESH_MS = 30_000;
const STALE_MS = 300_000;

function getCacheAge(key: string) {
  const e = srvCache.get(key);
  if (!e) return null;
  return { data: e.data, age: Date.now() - e.ts, inflight: e.inflight };
}

function buildScript(folderNum: number, limit: number): string {
  return `
$ol = $null
try { $ol = [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application') } catch {}
if (-not $ol) {
  try { $ol = New-Object -ComObject Outlook.Application } catch {
    Out-B64 @{ error = 'Outlook을 시작할 수 없습니다.' }
    exit
  }
}
try {
  $ns     = $ol.GetNamespace('MAPI')
  $folder = $ns.GetDefaultFolder(${folderNum})

  $myName  = ''
  $myEmail = ''
  try { $myName = [string]$ns.CurrentUser.Name } catch {}
  try {
    $ae = $ns.CurrentUser.AddressEntry
    $xu = $null
    try { $xu = $ae.GetExchangeUser() } catch {}
    if ($xu) { $myEmail = [string]$xu.PrimarySmtpAddress }
  } catch {}
  if ([string]::IsNullOrWhiteSpace($myEmail)) {
    try { $myEmail = [string]$ns.CurrentUser.Address } catch {}
  }
  $myEmail = $myEmail.ToLower().Trim()

  # folder.GetTable() handles Exchange server pagination via EndOfTable.
  # Items.GetFirst/GetNext returns null early on large Exchange folders.
  $table = $folder.GetTable()
  $cols  = $table.Columns
  $null  = $cols.RemoveAll()

  # Every Add() is wrapped in try/catch — invalid column names throw ArgumentOutOfRangeException
  try { $null = $cols.Add("EntryID")             } catch {}
  try { $null = $cols.Add("Subject")             } catch {}
  try { $null = $cols.Add("SenderName")          } catch {}
  try { $null = $cols.Add("SenderEmailAddress")  } catch {}
  try { $null = $cols.Add("ReceivedTime")        } catch {}
  try { $null = $cols.Add("UnRead")              } catch {}
  # ConversationID: try simple name first, then MAPI named property
  try { $null = $cols.Add("ConversationID") } catch {
    try { $null = $cols.Add("http://schemas.microsoft.com/mapi/id/{00062008-0000-0000-C000-000000000046}/8552001E") } catch {}
  }
  # PR_MESSAGE_SIZE
  try { $null = $cols.Add("http://schemas.microsoft.com/mapi/proptag/0x0E080003") } catch {}
  # PR_HASATTACH
  try { $null = $cols.Add("http://schemas.microsoft.com/mapi/proptag/0x0E1B000B") } catch {}
  # PR_DISPLAY_TO (semicolon-separated To recipient display names)
  try { $null = $cols.Add("http://schemas.microsoft.com/mapi/proptag/0x0E04001E") } catch {}
  # PR_SENDER_SMTP_ADDRESS (reliable SMTP even for internal Exchange senders)
  try { $null = $cols.Add("http://schemas.microsoft.com/mapi/proptag/0x5D01001E") } catch {}
  # PR_BODY (plain-text body for small-email preview)
  try { $null = $cols.Add("http://schemas.microsoft.com/mapi/proptag/0x1000001E") } catch {}

  try { $null = $table.Sort("[ReceivedTime]", $true) } catch {}

  $parts = [System.Collections.Generic.List[string]]::new()
  $count = 0
  $limit = ${limit}

  while (-not $table.EndOfTable -and $count -lt $limit) {
    try {
      $row = $table.GetNextRow()

      $sz = 0
      try { $sz = [int]$row["http://schemas.microsoft.com/mapi/proptag/0x0E080003"] } catch {}

      $preview = ''
      try {
        if ($sz -lt 40000) {
          $b = [string]$row["http://schemas.microsoft.com/mapi/proptag/0x1000001E"]
          if ($b -ne $null -and $b.Length -gt 0) {
            $preview = ($b.Substring(0, [Math]::Min(130, $b.Length)) -replace '[\r\n\t ]+', ' ').Trim()
          }
        }
      } catch {}

      $recv = ''
      try {
        $dt = $row["ReceivedTime"]
        if ($dt -ne $null) { $recv = ([datetime]$dt).ToString('yyyy-MM-ddTHH:mm:sszzz') }
      } catch {}

      $convId = ''
      try { $convId = [string]$row["ConversationID"] } catch {}
      if ([string]::IsNullOrWhiteSpace($convId)) {
        try { $convId = [string]$row["http://schemas.microsoft.com/mapi/id/{00062008-0000-0000-C000-000000000046}/8552001E"] } catch {}
      }

      $isToMe = $false
      try {
        if (-not [string]::IsNullOrWhiteSpace($myName)) {
          $toStr = [string]$row["http://schemas.microsoft.com/mapi/proptag/0x0E04001E"]
          if (-not [string]::IsNullOrWhiteSpace($toStr)) {
            foreach ($n in ($toStr.Split(';') | ForEach-Object { $_.Trim() })) {
              if ($n.ToLower() -eq $myName.ToLower()) { $isToMe = $true; break }
            }
          }
        }
      } catch {}

      $smtpEmail = ''
      try { $smtpEmail = [string]$row["http://schemas.microsoft.com/mapi/proptag/0x5D01001E"] } catch {}
      if ([string]::IsNullOrWhiteSpace($smtpEmail)) {
        try { $smtpEmail = [string]$row["SenderEmailAddress"] } catch {}
      }

      $hasAttach = $false
      try { $hasAttach = [bool]$row["http://schemas.microsoft.com/mapi/proptag/0x0E1B000B"] } catch {}

      $obj = [PSCustomObject]@{
        entryId        = [string]$row["EntryID"]
        conversationId = $convId
        subject        = [string]$row["Subject"]
        senderName     = [string]$row["SenderName"]
        senderEmail    = $smtpEmail
        receivedTime   = $recv
        preview        = $preview
        isUnread       = [bool]$row["UnRead"]
        isToMe         = [bool]$isToMe
        attachmentCount= [int][bool]$hasAttach
      }
      $parts.Add(($obj | ConvertTo-Json -Compress))
      $count++
    } catch {}
  }

  $json  = '[' + ($parts -join ',') + ']'
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  [Convert]::ToBase64String($bytes)
} catch {
  Out-B64 @{ error = "$_" }
}
`;
}

async function fetchFolder(folderKey: string, folderNum: number) {
  const e = srvCache.get(folderKey) ?? { data: null, ts: 0, inflight: false };
  srvCache.set(folderKey, { ...e, inflight: true });
  try {
    const data = await runPsAsync(buildScript(folderNum, 2147483647), 120_000);
    srvCache.set(folderKey, { data, ts: Date.now(), inflight: false });
  } catch {
    srvCache.set(folderKey, { ...e, inflight: false });
  }
}

export async function GET(request: NextRequest) {
  if (process.platform !== "win32") {
    return NextResponse.json({ error: "Outlook 연동은 Windows 환경에서만 사용 가능합니다" }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const folderKey = searchParams.get("folder") ?? "inbox";
  const folderNum = FOLDER_MAP[folderKey] ?? 6;
  const parsedLimit = parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? parsedLimit
    : 2147483647;
  const force = searchParams.get("force") === "1";

  if (force) {
    try {
      const data = await runPsAsync(buildScript(folderNum, limit), 120_000);
      if (limit === 2147483647) {
        srvCache.set(folderKey, { data, ts: Date.now(), inflight: false });
      }
      return NextResponse.json(data);
    } catch (e: unknown) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  const hit = getCacheAge(folderKey);

  if (hit && hit.age < FRESH_MS) {
    return NextResponse.json(hit.data, {
      headers: { "X-Cache": "HIT-FRESH", "X-Cache-Age": String(Math.round(hit.age / 1000)) + "s" },
    });
  }

  if (hit && hit.age < STALE_MS) {
    if (!hit.inflight) {
      fetchFolder(folderKey, folderNum).catch(() => {});
    }
    return NextResponse.json(hit.data, {
      headers: { "X-Cache": "HIT-STALE", "X-Cache-Age": String(Math.round(hit.age / 1000)) + "s" },
    });
  }

  try {
    const data = await runPsAsync(buildScript(folderNum, limit), 120_000);
    if (limit === 2147483647) {
      srvCache.set(folderKey, { data, ts: Date.now(), inflight: false });
    } else {
      fetchFolder(folderKey, folderNum).catch(() => {});
    }
    return NextResponse.json(data, { headers: { "X-Cache": "MISS" } });
  } catch (e: unknown) {
    if (hit) {
      return NextResponse.json(hit.data, {
        headers: { "X-Cache": "HIT-FALLBACK", "X-Cache-Error": String(e) },
      });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
