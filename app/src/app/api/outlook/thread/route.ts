import { NextRequest, NextResponse } from "next/server";
import { runPsAsync } from "@/lib/runPs";

// Server-side thread cache — keyed by entryId, TTL 5 min
interface ThreadEntry { data: unknown; ts: number; ver?: string }
const threadSrvCache = new Map<string, ThreadEntry>();
const THREAD_TTL = 300_000;
// Bump this version string when the decode logic changes to invalidate stale cache entries
const CACHE_VER  = "v3-font";

function buildScript(convId: string, entryId: string): string {
  const safeConv  = convId.replace(/'/g, "''");
  const safeEntry = entryId.replace(/'/g, "''");
  return `
$ol = $null
try { $ol = [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application') } catch {}
if (-not $ol) { try { $ol = New-Object -ComObject Outlook.Application } catch {} }
if (-not $ol) { Out-B64 @{ error = "Outlook 연결 실패" }; exit }

$ns   = $ol.GetNamespace('MAPI')
$seen = @{}
$objs = New-Object 'System.Collections.Generic.List[PSCustomObject]'

function Add-Msg($m) {
  if ($m -eq $null) { return }
  $id = ''
  try { $id = [string]$m.EntryID } catch { return }
  if ($seen.ContainsKey($id)) { return }
  $seen[$id] = $true

  $html = ''; $plain = ''
  try { $html  = [string]$m.HTMLBody } catch {}
  try { $plain = [string]$m.Body    } catch {}
  if ($html.Length -eq 0) {
    try {
      $tmp = [System.IO.Path]::GetTempFileName() + '.html'
      $m.SaveAs($tmp, 5)
      $html = [System.IO.File]::ReadAllText($tmp, [System.Text.Encoding]::UTF8)
      try { [System.IO.File]::Delete($tmp) } catch {}
    } catch {}
  }

  # Attachments — include base64 content for inline images (cid:) up to 8 MB
  $ctMap = @{ png='image/png'; jpg='image/jpeg'; jpeg='image/jpeg'; gif='image/gif'; bmp='image/bmp'; webp='image/webp'; tif='image/tiff'; tiff='image/tiff'; svg='image/svg+xml' }
  $attList = New-Object 'System.Collections.Generic.List[PSCustomObject]'
  try {
    for ($a = 1; $a -le $m.Attachments.Count; $a++) {
      try {
        $att  = $m.Attachments.Item($a)
        $cid  = ''
        $b64  = ''
        $ext  = ''
        # Primary: ContentID property
        try { $cid = [string]$att.ContentID } catch {}
        # Fallback: MAPI PR_ATTACH_CONTENT_ID property
        if (-not $cid) {
          try { $cid = [string]$att.PropertyAccessor.GetProperty('http://schemas.microsoft.com/mapi/proptag/0x3712001E') } catch {}
        }
        # Strip angle brackets Outlook sometimes adds: <image001.png@...> → image001.png@...
        if ($cid -match '^<(.+)>$') { $cid = $Matches[1] }
        try { $ext = [System.IO.Path]::GetExtension([string]$att.FileName).TrimStart('.').ToLower() } catch {}
        $ctype = if ($ctMap.ContainsKey($ext)) { $ctMap[$ext] } else { 'application/octet-stream' }
        # Fetch base64 for all inline (cid-referenced) images up to 8 MB
        if ($cid -ne '' -and [int]$att.Size -lt 8388608) {
          try {
            $tmpA = [System.IO.Path]::GetTempFileName()
            $att.SaveAsFile($tmpA)
            $b64  = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($tmpA))
            try { [System.IO.File]::Delete($tmpA) } catch {}
          } catch {}
        }
        $attList.Add([PSCustomObject]@{
          name  = [string]$att.FileName
          size  = [int]$att.Size
          cid   = $cid
          ctype = $ctype
          b64   = $b64
        })
      } catch {}
    }
  } catch {}

  $recipList = New-Object 'System.Collections.Generic.List[PSCustomObject]'
  try {
    for ($r = 1; $r -le $m.Recipients.Count; $r++) {
      try {
        $rec = $m.Recipients.Item($r)
        $recipList.Add([PSCustomObject]@{ name=[string]$rec.Name; email=[string]$rec.Address; rtype=[int]$rec.Type })
      } catch {}
    }
  } catch {}

  $sentOn = ''
  try { $sentOn = $m.SentOn.ToString('yyyy-MM-ddTHH:mm:sszzz') } catch {}
  if ($sentOn -eq '') { try { $sentOn = $m.ReceivedTime.ToString('yyyy-MM-ddTHH:mm:sszzz') } catch {} }

  $objs.Add([PSCustomObject]@{
    entryId     = $id
    subject     = [string]$m.Subject
    senderName  = [string]$m.SenderName
    senderEmail = [string]$m.SenderEmailAddress
    sentOn      = $sentOn
    htmlB64     = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($html))
    bodyB64     = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($plain))
    attachments = $attList.ToArray()
    recipients  = $recipList.ToArray()
  })
}

try { Add-Msg ($ns.GetItemFromID('${safeEntry}')) } catch {}

$conv = '${safeConv}'
if ($conv -ne '') {
  foreach ($fid in @(6, 5, 3, 16)) {
    try {
      $found = $ns.GetDefaultFolder($fid).Items.Restrict("[ConversationID] = '$conv'")
      foreach ($m in $found) { try { Add-Msg $m } catch {} }
    } catch {}
  }
}

$sorted = @($objs | Sort-Object { $_.sentOn })
$parts  = New-Object 'System.Collections.Generic.List[string]'
foreach ($item in $sorted) {
  $parts.Add((ConvertTo-Json -InputObject $item -Depth 5 -Compress))
}
$json  = '[' + ($parts -join ',') + ']'
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
[Convert]::ToBase64String($bytes)
`;
}

interface RawAtt {
  name: string; size: number;
  cid: string; ctype: string; b64: string;
}
interface RawRecip { name: string; email: string; rtype: number }
interface RawMsg {
  entryId: string; subject: string;
  senderName: string; senderEmail: string; sentOn: string;
  bodyB64: string; htmlB64: string;
  attachments: RawAtt[];
  recipients: RawRecip[];
}

// Replace cid: inline image references with base64 data URIs
function replaceCids(html: string, atts: RawAtt[]): string {
  let out = html;
  for (const a of atts) {
    if (!a.cid || !a.b64) continue;
    // Strip angle brackets Outlook COM sometimes includes in ContentID
    const cleanCid = a.cid.replace(/^<|>$/g, "");
    const dataUri  = `data:${a.ctype};base64,${a.b64}`;
    const escaped  = cleanCid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Replace both quoted forms: src="cid:..." and src='cid:...'
    out = out.replace(new RegExp(`cid:${escaped}`, "gi"), dataUri);
    // Also try with original (angle-bracketed) form just in case
    if (cleanCid !== a.cid) {
      const escapedOrig = a.cid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`cid:${escapedOrig}`, "gi"), dataUri);
    }
  }
  return out;
}

// Inject font override + image-fix + no-internal-scroll CSS into the HTML
const FONT_CSS = `<style>
html,body{overflow:hidden!important;margin:0!important;}
body{padding:10px 18px!important;}
*{font-family:'고운돋움','Goun Dotum','Dotum','돋움','Gulim','굴림',Arial,sans-serif!important;font-size:11px!important;line-height:1.65!important;}
img{max-width:100%!important;height:auto!important;display:inline-block!important;}
</style>
<script>
(function(){
  function applyFont(el){
    el.style.setProperty('font-family',"'고운돋움','Dotum',Arial,sans-serif",'important');
    el.style.setProperty('font-size','11px','important');
  }
  function walk(root){
    var all=root.querySelectorAll('*');
    for(var i=0;i<all.length;i++) applyFont(all[i]);
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){walk(document.body);});
  } else { walk(document.body); }
})();
</script>`;

function injectStyle(html: string): string {
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, FONT_CSS + "</head>");
  if (/<body/i.test(html))    return html.replace(/<body/i, FONT_CSS + "<body");
  return FONT_CSS + html;
}

function decodeThread(raw: unknown) {
  const msgs = (Array.isArray(raw) ? raw : [raw]) as RawMsg[];
  return msgs.map(m => {
    const body  = Buffer.from(m.bodyB64  ?? "", "base64").toString("utf8");
    const atts  = m.attachments ?? [];
    let htmlBody = Buffer.from(m.htmlB64 ?? "", "base64").toString("utf8");
    if (htmlBody) {
      htmlBody = replaceCids(htmlBody, atts);
      htmlBody = injectStyle(htmlBody);
    }
    return {
      entryId:     m.entryId,
      subject:     m.subject,
      senderName:  m.senderName,
      senderEmail: m.senderEmail,
      sentOn:      m.sentOn,
      body,
      htmlBody,
      attachments: atts.map(a => ({ name: a.name, size: a.size })),
      recipients:  (m.recipients ?? []).map(r => ({ name: r.name, email: r.email, rtype: r.rtype })),
    };
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const convId  = searchParams.get("convId")  ?? "";
  const entryId = searchParams.get("entryId") ?? "";
  if (!entryId)
    return NextResponse.json({ error: "entryId 필요" }, { status: 400 });

  // Return cached thread if still fresh and same cache version
  const cached = threadSrvCache.get(entryId);
  if (cached && cached.ver === CACHE_VER && Date.now() - cached.ts < THREAD_TTL) {
    return NextResponse.json(cached.data, { headers: { "X-Cache": "HIT" } });
  }

  try {
    const raw     = await runPsAsync(buildScript(convId, entryId), 45000);
    const decoded = decodeThread(raw);
    threadSrvCache.set(entryId, { data: decoded, ts: Date.now(), ver: CACHE_VER });
    return NextResponse.json(decoded);
  } catch (e: unknown) {
    console.error("[thread error]", e);
    if (cached) return NextResponse.json(cached.data, { headers: { "X-Cache": "FALLBACK" } });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
