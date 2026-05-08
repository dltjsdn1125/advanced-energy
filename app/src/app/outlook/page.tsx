"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch, getToken } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────
interface OutlookMessage {
  entryId: string; conversationId: string; subject: string;
  senderName: string; senderEmail: string; receivedTime: string;
  preview: string; isUnread: boolean; isToMe?: boolean; attachmentCount: number;
}
interface RecipAddr { name: string; email: string }
interface ThreadMessage {
  entryId: string; subject: string;
  senderName: string; senderEmail: string; sentOn: string;
  body: string; htmlBody: string;
  attachments: { name: string; size: number; contentType?: string; content?: string; downloadUrl?: string }[];
  recipients: { name: string; email: string; rtype: number }[];
}
type Tone         = "neutral" | "positive" | "negative" | "custom";
type Folder       = "inbox" | "toMe" | "sent" | "drafts" | "junk" | "deleted" | "important";
type ReportPeriod = "daily" | "weekly" | "monthly";
type Zone   = "pool" | "to" | "cc";

const FOLDER_LABELS: Record<Folder, string> = {
  toMe: "To Me",
  inbox: "Inbox", sent: "Sent", drafts: "Drafts",
  junk: "Junk", deleted: "Deleted", important: "Important",
};
const REAL_FOLDERS: Folder[] = ["inbox", "sent", "drafts", "junk", "deleted"];
const CACHE_KEY         = "ae_outlook_msg_cache_v1";
const LS_CACHE_KEY      = "ae_outlook_msg_ls_v2"; // localStorage — survives tab close
const REPORT_CACHE_KEY  = "ae_report_cache_v1";
const PATTERN_CACHE_KEY = "ae_pattern_cache_v1";
const TASK_CACHE_KEY    = "ae_task_cache_v1";
const CACHE_TTL_MS      = 60_000;
const PROTO_KEY         = "ae_mail_proto"; // "webmail" | "imap" | "pop3" | ""
// MAILNARA session cookie (survives soft navigations, cleared after 18 min)
const WM_SESSION_KEY    = "ae_wm_session";
const WM_SESSION_TS_KEY = "ae_wm_session_ts";
const WM_SESSION_TTL    = 18 * 60 * 1000;

const REPORT_PERIOD_LABEL: Record<ReportPeriod, string> = {
  daily: "Daily Report",
  weekly: "Weekly Report",
  monthly: "Monthly Report",
};
const REPORT_PERIOD_DAYS: Record<ReportPeriod, number> = {
  daily: 1, weekly: 7, monthly: 30,
};
const TONE_LABELS: Record<Tone, string> = {
  neutral: "Neutral", positive: "Positive", negative: "Negative", custom: "Custom",
};

// ── Util ──────────────────────────────────────────────────────────────────────
function formatTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso), mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "방금"; if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}일 전`;
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}
function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function formatSize(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)}KB`;
  return `${(b / 1048576).toFixed(1)}MB`;
}
function fileIcon(name: string) {
  const e = name.split(".").pop()?.toLowerCase() ?? "";
  if (e === "pdf") return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0 text-red-500"><rect x="3" y="2" width="18" height="20" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M7 12h4a2 2 0 000-4H7v8m0-4h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
  );
  if (["xlsx","xls","csv"].includes(e)) return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0 text-green-600"><rect x="3" y="2" width="18" height="20" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
  );
  if (["docx","doc"].includes(e)) return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0 text-blue-600"><rect x="3" y="2" width="18" height="20" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M7 8h10M7 12h10M7 16h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
  );
  if (["pptx","ppt"].includes(e)) return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0 text-orange-500"><rect x="3" y="2" width="18" height="20" rx="2" stroke="currentColor" strokeWidth="1.6"/><rect x="7" y="7" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.6"/><path d="M12 14v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
  );
  if (["png","jpg","jpeg","gif","bmp","webp"].includes(e)) return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0 text-purple-500"><rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/><circle cx="8.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M2 16l5-5 4 4 3-3 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
  );
  if (["zip","rar","7z"].includes(e)) return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0 text-yellow-600"><rect x="3" y="2" width="18" height="20" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M10 2v4M14 2v4M10 6h4M10 10h4M10 14h4M12 14v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
  );
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ink-400"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 17.41A2 2 0 016.59 14.59L15.8 5.38" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
  );
}
function Avatar({ name }: { name?: string }) {
  const init = (name ?? "").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
  const col  = ["bg-blue-500","bg-purple-500","bg-green-600","bg-orange-500","bg-rose-500","bg-teal-500"];
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white ${col[((name ?? "").charCodeAt(0)||0)%col.length]}`}>
      {init}
    </div>
  );
}

// ── Settings Modal ────────────────────────────────────────────────────────────
function SettingsModal({ initial, onSave, onClose }: {
  initial: { openaiKey: string };
  onSave: (v: { openaiKey: string }) => void;
  onClose: () => void;
}) {
  const [val, setVal] = useState(initial.openaiKey);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-[420px] rounded-xl border border-ink-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="text-[15px] font-semibold">설정</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 text-[16px]">×</button>
        </div>
        <div className="px-5 py-5 space-y-3">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11px] text-blue-800">
            <p className="font-semibold text-[12px] mb-0.5">로컬 Outlook 2016 연동</p>
            <p>Outlook이 실행 중이면 별도 로그인 없이 자동으로 연결됩니다.</p>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-ink-700">OpenAI API Key <span className="font-normal text-ink-400">(sk-...)</span></label>
            <input type="password" value={val} onChange={e => setVal(e.target.value)} placeholder="sk-…"
              className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-[12px] focus:border-[#0078d4] focus:outline-none"/>
            <p className="mt-0.5 text-[11px] text-ink-400">키는 브라우저 localStorage에만 저장됩니다.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3">
          <button onClick={onClose} className="rounded border border-ink-200 px-4 py-1.5 text-[13px] text-ink-600 hover:bg-ink-50">취소</button>
          <button onClick={() => onSave({ openaiKey: val })} className="rounded bg-[#0078d4] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#005fa3]">저장</button>
        </div>
      </div>
    </div>
  );
}

// ── Recipient Modal ───────────────────────────────────────────────────────────
function RecipientModal({ pool: initPool, onConfirm, onClose }: {
  pool: RecipAddr[];
  onConfirm: (to: RecipAddr[], cc: RecipAddr[]) => void;
  onClose: () => void;
}) {
  const [pool, setPool]   = useState<RecipAddr[]>(initPool);
  const [toList, setTo]   = useState<RecipAddr[]>([]);
  const [ccList, setCc]   = useState<RecipAddr[]>([]);
  const [dragOver, setDragOver]         = useState<Zone | null>(null);
  const [selEmails, setSelEmails]       = useState<Set<string>>(new Set());
  const dragRef = useRef<{ addrs: RecipAddr[]; from: Zone } | null>(null);

  function getList(z: Zone) { return z === "pool" ? pool : z === "to" ? toList : ccList; }
  function setList(z: Zone, v: RecipAddr[]) {
    if (z === "pool") setPool(v);
    else if (z === "to") setTo(v);
    else setCc(v);
  }

  function handleClick(addr: RecipAddr, e: React.MouseEvent) {
    e.stopPropagation();
    setSelEmails(prev => {
      const next = new Set(prev);
      if (e.shiftKey) {
        if (next.has(addr.email)) next.delete(addr.email);
        else next.add(addr.email);
      } else {
        if (next.has(addr.email) && next.size === 1) next.clear();
        else { next.clear(); next.add(addr.email); }
      }
      return next;
    });
  }

  function onDragStart(addr: RecipAddr, from: Zone) {
    const addrsToMove = selEmails.has(addr.email)
      ? getList(from).filter(a => selEmails.has(a.email))
      : [addr];
    dragRef.current = { addrs: addrsToMove, from };
  }
  function onDrop(target: Zone) {
    if (!dragRef.current) return;
    const { addrs, from } = dragRef.current;
    if (from === target) { dragRef.current = null; setDragOver(null); return; }
    const moving = new Set(addrs.map(a => a.email));
    setList(from, getList(from).filter(a => !moving.has(a.email)));
    setList(target, [...getList(target).filter(a => !moving.has(a.email)), ...addrs]);
    setSelEmails(new Set());
    dragRef.current = null;
    setDragOver(null);
  }
  function remove(z: Zone, addr: RecipAddr) {
    setList(z, getList(z).filter(a => a.email !== addr.email));
    setPool(prev => [...prev.filter(a => a.email !== addr.email), addr]);
    setSelEmails(prev => { const n = new Set(prev); n.delete(addr.email); return n; });
  }

  const ZoneBox = ({ zone, label, color }: { zone: Zone; label: string; color: string }) => (
    <div className="flex min-h-0 flex-col gap-1.5">
      <div className={`shrink-0 text-[11px] font-semibold uppercase tracking-wide ${color}`}>{label}</div>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(zone); }}
        onDragLeave={() => setDragOver(null)}
        onDrop={() => onDrop(zone)}
        className={`flex-1 overflow-y-auto rounded-lg border-2 border-dashed p-2 transition-colors ${
          dragOver === zone ? "border-[#0078d4] bg-[#deecf9]" : "border-ink-200 bg-white"
        }`}>
        {getList(zone).map(addr => {
          const isSel = selEmails.has(addr.email);
          return (
            <div key={addr.email} draggable
              onClick={e => handleClick(addr, e)}
              onDragStart={() => onDragStart(addr, zone)}
              className={`mb-1.5 flex cursor-grab items-center gap-1.5 rounded border px-2 py-1 text-[11px] transition active:cursor-grabbing ${
                isSel
                  ? "border-[#0f3460] bg-[#dce6f5] font-semibold"
                  : "border-ink-200 bg-[#f9f9f9] hover:border-[#0078d4] hover:bg-[#deecf9]"
              }`}>
              <span className="flex-1 min-w-0">
                <span className="font-medium truncate block">{addr.name || addr.email}</span>
                {addr.name && <span className="text-ink-400 truncate block">{addr.email}</span>}
              </span>
              {zone !== "pool" && (
                <button onClick={e => { e.stopPropagation(); remove(zone, addr); }}
                  className="shrink-0 text-ink-300 hover:text-red-500 text-[14px] leading-none">×</button>
              )}
            </div>
          );
        })}
        {getList(zone).length === 0 && (
          <div className="flex h-full min-h-[80px] items-center justify-center text-[11px] text-ink-300">여기에 드래그</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-[700px] flex-col rounded-xl border border-ink-200 bg-white shadow-2xl" style={{ height: "min(520px, 90dvh)" }}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-ink-100 px-5 py-3">
          <h2 className="text-[15px] font-semibold">수신자 선택</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 text-[16px]">×</button>
        </div>
        {/* Hint */}
        <div className="shrink-0 px-5 pt-3 pb-1">
          <p className="text-[11px] text-ink-400">
            주소를 클릭해 선택 · <kbd className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[10px]">Shift</kbd>+클릭으로 다중 선택 후 드래그 이동
          </p>
        </div>
        {/* Zone grid — fills remaining height, each column scrolls independently */}
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-3 overflow-hidden px-5 pb-2">
          <ZoneBox zone="pool"  label="스레드 주소"    color="text-ink-500"/>
          <ZoneBox zone="to"    label="받는 사람 (To)" color="text-[#0078d4]"/>
          <ZoneBox zone="cc"    label="참조 (CC)"      color="text-purple-600"/>
        </div>
        {/* Footer */}
        <div className="flex shrink-0 flex-col gap-2 border-t border-ink-100 px-5 py-3">
          <p className="text-[11px] text-ink-400">받는 사람이 비어있으면 원본 수신자로 발송됩니다</p>
          <div className="flex flex-row gap-2">
            <button onClick={onClose} className="flex-1 rounded border border-ink-200 px-4 py-1.5 text-[13px] text-ink-600 hover:bg-ink-50">취소</button>
            <button onClick={() => onConfirm(toList, ccList)}
              className="flex-1 rounded bg-[#0078d4] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#005fa3]">
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mail API call helper ──────────────────────────────────────────────────────
async function callMailApi(
  endpoint: string,
  payload: Record<string, unknown>,
  label: string,
): Promise<OutlookMessage[]> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let data: unknown;
  try { data = await res.json(); } catch { throw new Error(`${label}: 서버 응답 파싱 실패 (HTTP ${res.status})`); }
  if (!res.ok || (data as { error?: string })?.error) {
    const raw = String((data as { error?: string })?.error ?? `HTTP ${res.status}`)
      .replace(/^Error:\s*/gi, "").trim();
    // IP 차단 에러 감지
    const isIpBlock = /not allowed ip|ip.*block|connection refused/i.test(raw);
    const detail = isIpBlock
      ? `${label} 연결 실패: 메일 서버가 클라우드 IP를 차단했습니다.\n\n` +
        `semigate.com 등 일부 메일 서버는 외부 IP 접속을 허용하지 않습니다.\n` +
        `해결 방법: PC에서 직접 실행하세요 →\n` +
        `  cd app && npm run dev\n` +
        `  브라우저에서 http://localhost:4300 접속`
      : `${label}: ${raw}`;
    throw new Error(detail);
  }
  return Array.isArray(data) ? data as OutlookMessage[] : [];
}

// ── IMAP fallback: returns null if no IMAP settings ──────────────────────────
async function tryImapFetch(limit: number): Promise<OutlookMessage[] | null> {
  const raw = localStorage.getItem("ae_settings_v1");
  if (!raw) return null;
  const cfg  = JSON.parse(raw) as Record<string, unknown>;
  const host = String(cfg.imapHost ?? "");
  const port = Number(cfg.imapPort) || 993;
  const ssl  = cfg.imapSsl !== false && cfg.imapSsl !== "false";
  const user = String(cfg.imapUser ?? "");
  const pass = String(cfg.imapPass ?? "");
  if (!host || !user || !pass) return null;
  return callMailApi("/api/imap/messages", { host, port, ssl, user, pass, limit }, "IMAP");
}

// ── POP3 fallback: returns null if no POP3 settings ──────────────────────────
async function tryPop3Fetch(limit: number): Promise<OutlookMessage[] | null> {
  const raw = localStorage.getItem("ae_settings_v1");
  if (!raw) return null;
  const cfg  = JSON.parse(raw) as Record<string, unknown>;
  const host = String(cfg.popHost ?? "");
  const port = Number(cfg.popPort) || 995;
  const ssl  = cfg.popSsl !== false && cfg.popSsl !== "false";
  const user = String(cfg.popUser ?? "");
  const pass = String(cfg.popPass ?? "");
  if (!host || !user || !pass) return null;
  return callMailApi("/api/pop3/messages", { host, port, ssl, user, pass, limit }, "POP3");
}

// ── Webmail (MAILNARA) fallback: uses POP3 host/user/pass via HTTPS ───────────
async function tryWebmailFetch(folder = "inbox"): Promise<OutlookMessage[] | null> {
  const raw = localStorage.getItem("ae_settings_v1");
  if (!raw) return null;
  const cfg  = JSON.parse(raw) as Record<string, unknown>;
  const host = String(cfg.popHost ?? "") || String(cfg.imapHost ?? "");
  const user = String(cfg.popUser ?? "") || String(cfg.imapUser ?? "");
  const pass = String(cfg.popPass ?? "") || String(cfg.imapPass ?? "");
  if (!host || !user || !pass) return null;
  return callMailApi("/api/webmail/messages", { host, user, pass, folder }, "Webmail");
}

// ── MAILNARA session cookie helpers ──────────────────────────────────────────
function getWebmailSession(): string {
  try {
    const ts = Number(sessionStorage.getItem(WM_SESSION_TS_KEY) ?? "0");
    if (Date.now() - ts > WM_SESSION_TTL) return "";
    return sessionStorage.getItem(WM_SESSION_KEY) ?? "";
  } catch { return ""; }
}
function saveWebmailSession(cookie: string) {
  if (!cookie) return;
  try {
    sessionStorage.setItem(WM_SESSION_KEY, cookie);
    sessionStorage.setItem(WM_SESSION_TS_KEY, String(Date.now()));
  } catch {}
}

interface WebmailPageResult {
  messages: OutlookMessage[];
  hasMore: boolean;
  sessionCookie: string;
}

// Single-page fetch — used for client-driven incremental loading
async function fetchWebmailPage(
  folder: string,
  page: number,
  sessionCookie: string,
): Promise<WebmailPageResult | null> {
  try {
    const raw = localStorage.getItem("ae_settings_v1");
    if (!raw) {
      console.warn("[fetchWebmailPage] no ae_settings_v1 in localStorage");
      return null;
    }
    const cfg  = JSON.parse(raw) as Record<string, unknown>;
    // Prefer POP3 credentials; fall back to IMAP (same MAILNARA server address)
    const host = String(cfg.popHost ?? "") || String(cfg.imapHost ?? "");
    const user = String(cfg.popUser ?? "") || String(cfg.imapUser ?? "");
    const pass = String(cfg.popPass ?? "") || String(cfg.imapPass ?? "");
    if (!host || !user || !pass) {
      console.warn(`[fetchWebmailPage] missing creds host=${!!host} user=${!!user} pass=${!!pass}`);
      return null;
    }
    console.log(`[fetchWebmailPage] folder=${folder} page=${page} host=${host} user=${user}`);
    const res = await fetch("/api/webmail/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host, user, pass, folder, page, sessionCookie }),
    });
    const data = await res.json() as {
      messages?: OutlookMessage[];
      hasMore?: boolean;
      sessionCookie?: string;
      error?: string;
      _debug?: { htmlLen?: number; rowIdCount?: number; firstUid?: string; lastUid?: string; mailbox?: string; page?: number; sampleHtml?: string };
    };
    if (data._debug) {
      const d = data._debug;
      console.log(`[fetchWebmailPage debug] folder=${folder} page=${page} htmlLen=${d.htmlLen} rowIdCount=${d.rowIdCount} firstUid=${d.firstUid} lastUid=${d.lastUid} mailbox=${d.mailbox}`);
      if (d.sampleHtml) {
        console.log(`[fetchWebmailPage SAMPLE folder=${folder} page=${page}]: ${d.sampleHtml}`);
      }
    }
    if (data?.error) {
      console.error(`[fetchWebmailPage] folder=${folder} page=${page} server error:`, data.error);
      throw new Error(String(data.error).replace(/^Error:\s*/i, ""));
    }
    const msgs = data.messages ?? [];
    console.log(`[fetchWebmailPage] folder=${folder} page=${page} returned=${msgs.length} hasMore=${data.hasMore} status=${res.status}`);
    return {
      messages: msgs,
      hasMore:  data.hasMore  ?? false,
      sessionCookie: data.sessionCookie ?? "",
    };
  } catch (e) {
    console.error(`[fetchWebmailPage] folder=${folder} page=${page} threw:`, e);
    throw e; // propagate to caller for connError collection
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OutlookPage() {
  const [openaiKey,    setOpenaiKey]    = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Note: cache is hydrated in a useEffect (line ~602) — initializing from
  // localStorage in useState causes a server/client hydration mismatch
  // (React error #418) since the server renders without storage access.
  const [messages,      setMessages]      = useState<OutlookMessage[]>([]);
  const [msgLoading,    setMsgLoading]    = useState(false);
  const [isRefreshing,  setIsRefreshing]  = useState(false);
  const [loadingCount,  setLoadingCount]  = useState(0);
  const [msgError,      setMsgError]      = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<Folder>("inbox");
  const [search,       setSearch]       = useState("");
  const [mobileView,   setMobileView]   = useState<"folders" | "list" | "reading" | "ai">("list");

  const [selected,      setSelected]      = useState<OutlookMessage | null>(null);
  const [thread,        setThread]        = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [checkedIds,    setCheckedIds]    = useState<Set<string>>(new Set());
  const [bulkDeleting,  setBulkDeleting]  = useState(false);

  // Custom confirm/alert dialogs (replace native window.confirm / alert)
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; resolve: (v: boolean) => void } | null>(null);
  const [alertDialog,   setAlertDialog]   = useState<string | null>(null);
  const [iframeH,       setIframeH]       = useState<Record<number, number>>({});
  const [iframeW,       setIframeW]       = useState<Record<number, number>>({});

  // In-memory caches — hydrated in a useEffect (line ~602) to avoid SSR mismatch
  const msgCache        = useRef<Map<Folder, OutlookMessage[]>>(new Map());
  const msgCacheTs      = useRef<Map<Folder, number>>(new Map());
  const threadCache     = useRef<Map<string, ThreadMessage[]>>(new Map());
  // Ref so background async tasks can check the current folder without stale closure
  const activeFolderRef  = useRef<Folder>("inbox");
  // Track which folders have been fully loaded (all pages) and which are currently loading
  const fullyLoadedRef   = useRef<Set<Folder>>(new Set());
  // Separate mutexes per protocol so an in-flight IMAP attempt doesn't block
  // the webmail background pagination loop from making progress.
  const bgLoadingRef     = useRef<Set<Folder>>(new Set()); // webmail page loop
  const imapEnhanceRef   = useRef<Set<Folder>>(new Set()); // IMAP enhance attempt

  const persistMsgCache = useCallback(() => {
    try {
      const payload: Record<string, { ts: number; data: OutlookMessage[] }> = {};
      for (const f of REAL_FOLDERS) {
        const data = msgCache.current.get(f);
        if (!data) continue;
        payload[f] = { ts: msgCacheTs.current.get(f) ?? Date.now(), data };
      }
      const serialized = JSON.stringify(payload);
      sessionStorage.setItem(CACHE_KEY, serialized);
      localStorage.setItem(LS_CACHE_KEY, serialized); // persist across tab close / next visit
    } catch {}
  }, []);

  const setFolderCache = useCallback((folder: Folder, msgs: OutlookMessage[]) => {
    msgCache.current.set(folder, msgs);
    msgCacheTs.current.set(folder, Date.now());
    persistMsgCache();
  }, [persistMsgCache]);

  const [aiOpen,       setAiOpen]       = useState(true);
  const [tone,         setTone]         = useState<Tone>("neutral");
  const [customNote,   setCustomNote]   = useState("");
  const [draft,         setDraft]         = useState("");
  const [draftPreview,  setDraftPreview]  = useState(false);
  const [draftCopied,   setDraftCopied]   = useState(false);
  const [tableMode,     setTableMode]     = useState(false);
  const [draftLoading,  setDraftLoading]  = useState(false);
  const [draftError,    setDraftError]    = useState<string | null>(null);
  const [replyStatus,  setReplyStatus]  = useState("");
  const [replyAction,  setReplyAction]  = useState<"reply" | "replyAll" | "forward">("reply");

  // Inline compose
  const [composeOpen,    setComposeOpen]    = useState(false);
  const [composeMode,    setComposeMode]    = useState<"reply" | "new">("reply");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeToStr,   setComposeToStr]   = useState("");
  const [composeCcStr,   setComposeCcStr]   = useState("");
  const [composeBody,    setComposeBody]    = useState("");
  const [composeSending, setComposeSending] = useState(false);
  const [composeQuoteH,  setComposeQuoteH]  = useState(200);
  const [composeAiOpen,  setComposeAiOpen]  = useState(false);
  const [sendSuccess,    setSendSuccess]    = useState(false);
  const [sendSuccessOut, setSendSuccessOut] = useState(false);

  // 보내는 사람 (localStorage 고정 가능)
  const [senderName,   setSenderName]   = useState("");
  const [senderEmail,  setSenderEmail]  = useState("");
  const [senderLocked, setSenderLocked] = useState(false);
  // 메일 목적 (매번 입력)
  const [purpose,      setPurpose]      = useState("");
  // 글자 수 제한
  const [charLimitSel,    setCharLimitSel]    = useState("No Limit");
  const [charLimitCustom, setCharLimitCustom] = useState("");

  const [transResult,    setTransResult]    = useState("");
  const [transIsHtml,    setTransIsHtml]    = useState(false);
  const [transIframeH,   setTransIframeH]   = useState(300);
  const [transLoading,   setTransLoading]   = useState(false);
  const [transError,     setTransError]     = useState<string | null>(null);
  const [transLang,      setTransLang]      = useState("Korean");
  const [transModalOpen, setTransModalOpen] = useState(false);
  const [copyDone,       setCopyDone]       = useState(false);

  // Summary
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryText,    setSummaryText]    = useState("");
  const [summaryError,   setSummaryError]   = useState<string | null>(null);
  const [summaryOpen,    setSummaryOpen]    = useState(false);
  const [summaryCopied,  setSummaryCopied]  = useState(false);

  // Recipient modal
  const [recipOpen,   setRecipOpen]   = useState(false);
  const [pendingSend, setPendingSend] = useState(false);
  const [recipPool,   setRecipPool]   = useState<RecipAddr[]>([]);
  // "ai" mode: modal opens before draft generation to pre-select recipients
  const [recipMode,   setRecipMode]   = useState<"send" | "ai">("send");
  const [aiTo,        setAiTo]        = useState<RecipAddr[]>([]);
  const [aiCc,        setAiCc]        = useState<RecipAddr[]>([]);

  // Important messages — persisted in localStorage
  const [important, setImportant] = useState<OutlookMessage[]>([]);

  // Report
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportPeriod,    setReportPeriod]    = useState<ReportPeriod>("daily");
  const [reportText,      setReportText]      = useState("");
  const [reportLoading,   setReportLoading]   = useState(false);
  const [reportError,     setReportError]     = useState<string | null>(null);
  const [reportCopied,    setReportCopied]    = useState(false);
  const [reportSaving,    setReportSaving]    = useState(false);
  const [reportSaved,     setReportSaved]     = useState(false);
  const [reportShareUrl,  setReportShareUrl]  = useState("");
  const [telegramSending, setTelegramSending] = useState(false);
  const [telegramStatus,  setTelegramStatus]  = useState("");

  // Work Pattern Analysis
  const [patternModalOpen, setPatternModalOpen] = useState(false);
  const [patternText,      setPatternText]      = useState("");
  const [patternLoading,   setPatternLoading]   = useState(false);
  const [patternError,     setPatternError]     = useState<string | null>(null);
  const [patternCopied,    setPatternCopied]    = useState(false);
  const [patternTgSending, setPatternTgSending] = useState(false);
  const [patternTgStatus,  setPatternTgStatus]  = useState("");
  const [patternDays,      setPatternDays]      = useState<"7"|"30"|"90"|"180"|"365"|"all">("all");
  const [patternScope,     setPatternScope]     = useState<"all"|"inbox"|"sent">("all");

  // All Task Summary
  const [taskModalOpen,  setTaskModalOpen]  = useState(false);
  const [taskText,       setTaskText]       = useState("");
  const [taskLoading,    setTaskLoading]    = useState(false);
  const [taskError,      setTaskError]      = useState<string | null>(null);
  const [taskCopied,     setTaskCopied]     = useState(false);
  const [taskTgSending,  setTaskTgSending]  = useState(false);
  const [taskTgStatus,   setTaskTgStatus]   = useState("");
  const [taskDays,       setTaskDays]       = useState<"7"|"30"|"90"|"180"|"365"|"all">("all");
  const [taskScope,      setTaskScope]      = useState<"all"|"inbox"|"sent">("all");

  useEffect(() => {
    setOpenaiKey(localStorage.getItem("ae_openai_key") ?? "");
    setSenderName(localStorage.getItem("ae_sender_name") ?? "");
    setSenderEmail(localStorage.getItem("ae_sender_email") ?? "");
    setSenderLocked(localStorage.getItem("ae_sender_locked") === "true");
    try {
      setImportant(JSON.parse(localStorage.getItem("ae_important") ?? "[]"));
    } catch {
      setImportant([]);
    }
  }, []);

  useEffect(() => {
    try {
      // sessionStorage survives same tab; localStorage survives tab close / next visit
      const raw = sessionStorage.getItem(CACHE_KEY) ?? localStorage.getItem(LS_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, { ts?: number; data?: OutlookMessage[] }>;
      for (const f of REAL_FOLDERS) {
        const row = parsed?.[f];
        if (!row || !Array.isArray(row.data)) continue;
        msgCache.current.set(f, row.data);
        // When loaded from localStorage (different session) treat as stale so a background
        // refresh is triggered, but the user sees data immediately
        msgCacheTs.current.set(f, row.ts ?? 0);
      }
      const inbox = msgCache.current.get("inbox");
      if (inbox?.length) {
        setMessages(inbox);
        setLoadingCount(inbox.length);
      }
    } catch {}
  }, []);

  // Keep activeFolderRef in sync for background async tasks
  useEffect(() => { activeFolderRef.current = activeFolder; }, [activeFolder]);
  function handleSaveSettings(v: { openaiKey: string }) {
    localStorage.setItem("ae_openai_key", v.openaiKey);
    setOpenaiKey(v.openaiKey); setSettingsOpen(false);
  }

  const loadMessages = useCallback(async (folder: Folder = activeFolder, forceRefresh = false) => {
    setMsgError(null);
    const selectedEntryId = selected?.entryId ?? "";
    const preserveSelection = folder === activeFolder && !!selectedEntryId;

    // Virtual folders — no API call
    if (folder === "important" || folder === "toMe") {
      if (folder === "toMe") {
        const inboxCached = msgCache.current.get("inbox") ?? [];
        setMessages(inboxCached.filter(m => !!m.isToMe));
      }
      setSelected(null); setThread([]);
      return;
    }

    const cached = msgCache.current.get(folder);
    const mailProto = localStorage.getItem(PROTO_KEY) ?? "";

    // ── Helper: merge new messages into cache & update UI ─────────────────────
    // Returns the count of truly-new messages added. Callers (e.g., the
    // background page loop) use this to detect "no new mails on this page"
    // and stop paginating when MAILNARA starts repeating the tail.
    const applyMerge = (capturedFolder: Folder, newMsgs: OutlookMessage[], prepend: boolean): number => {
      const existing = msgCache.current.get(capturedFolder) ?? [];
      const existingIds = new Set(existing.map(m => m.entryId.toUpperCase()));
      const trulyNew = newMsgs.filter(m => !existingIds.has(m.entryId.toUpperCase()));
      if (trulyNew.length === 0) {
        // Refresh read/unread state for already-known messages
        const updMap = new Map(newMsgs.map(m => [m.entryId.toUpperCase(), m]));
        const refreshed = existing.map(m => updMap.get(m.entryId.toUpperCase()) ?? m);
        setFolderCache(capturedFolder, refreshed);
        if (activeFolderRef.current === capturedFolder) setMessages(refreshed);
        return 0;
      }
      const merged = prepend ? [...trulyNew, ...existing] : [...existing, ...trulyNew];
      setFolderCache(capturedFolder, merged);
      if (activeFolderRef.current === capturedFolder) {
        setMessages([...merged]);
        setLoadingCount(merged.length);
      }
      return trulyNew.length;
    };

    // ── Background webmail page loader (runs after page 0 is shown) ──────────
    // Sequential fetch with one retry per page on failure. Stops on:
    //   - 2 consecutive empty pages (rowIdCount=0)
    //   - 3 consecutive pages with the same lastUid (MAILNARA tail)
    //   - 2 consecutive failed-after-retry pages (server gave up)
    const startBackgroundPages = (capturedFolder: Folder, startPage: number, initCookie: string) => {
      if (bgLoadingRef.current.has(capturedFolder)) {
        console.log(`[bg pages] ${capturedFolder} already loading — skip`);
        return;
      }
      bgLoadingRef.current.add(capturedFolder);
      const MAX_CONSECUTIVE_EMPTY = 2;
      const MAX_CONSECUTIVE_SAME_LASTUID = 3;
      const MAX_CONSECUTIVE_FAILS = 2;
      const HARD_PAGE_CAP = 200;
      (async () => {
        let page = startPage;
        let cookie = initCookie;
        let consecutiveEmpty = 0;
        let consecutiveFails = 0;
        let lastUidSeen = "";
        let lastUidStreak = 0;
        try {
          while (page < HARD_PAGE_CAP) {
            // One try + one retry per page (handle transient session blips)
            let result: WebmailPageResult | null = null;
            let pageErr: unknown = null;
            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                result = await fetchWebmailPage(capturedFolder, page, cookie);
                pageErr = null;
                break;
              } catch (e) {
                pageErr = e;
                if (attempt === 0) {
                  // Transient — try once more after a brief pause
                  await new Promise(r => setTimeout(r, 800));
                }
              }
            }
            if (pageErr || !result) {
              consecutiveFails++;
              console.warn(`[bg pages] page=${page} failed (consecutive fails=${consecutiveFails}):`, pageErr);
              if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
                console.warn(`[bg pages] giving up after ${consecutiveFails} consecutive failures at page=${page}`);
                break;
              }
              page++;
              continue;
            }
            consecutiveFails = 0;
            cookie = result.sessionCookie || cookie;
            saveWebmailSession(cookie);
            const added = applyMerge(capturedFolder, result.messages, page === 0);
            const msgs = result.messages as Array<{ entryId: string }>;
            const lastEntry = msgs.length > 0 ? msgs[msgs.length - 1].entryId : "";
            const totalNow = msgCache.current.get(capturedFolder)?.length ?? 0;
            console.log(`[bg pages] page=${page} got=${msgs.length} added=${added} total=${totalNow} lastUid=${lastEntry}`);
            // Empty-page tracker
            if (msgs.length === 0) {
              consecutiveEmpty++;
              if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) {
                fullyLoadedRef.current.add(capturedFolder);
                break;
              }
            } else {
              consecutiveEmpty = 0;
            }
            // Same-lastUid tracker (MAILNARA cursor stuck at tail)
            if (lastEntry && lastEntry === lastUidSeen) {
              lastUidStreak++;
              if (lastUidStreak >= MAX_CONSECUTIVE_SAME_LASTUID) {
                console.log(`[bg pages] tail reached — lastUid stuck at ${lastEntry} for ${lastUidStreak} pages, stop at page=${page}`);
                fullyLoadedRef.current.add(capturedFolder);
                break;
              }
            } else if (lastEntry) {
              lastUidSeen = lastEntry;
              lastUidStreak = 1;
            }
            page++;
          }
          if (page >= HARD_PAGE_CAP) {
            console.warn(`[bg pages] hit HARD_PAGE_CAP=${HARD_PAGE_CAP} — stopping`);
          }
        } finally {
          // Always release the mutex so the next refresh can start a new loop.
          bgLoadingRef.current.delete(capturedFolder);
        }
      })();
    };

    // ── Incremental refresh (새로고침 버튼) ────────────────────────────────────
    if (forceRefresh && cached && cached.length > 0) {
      if (mailProto === "webmail") {
        // Webmail: fetch page 0 only, merge new into top, then continue paginating
        // in background so the rest of the inbox catches up with the user's clicks.
        try {
          const session   = getWebmailSession();
          const firstPage = await fetchWebmailPage(folder, 0, session);
          if (firstPage) {
            saveWebmailSession(firstPage.sessionCookie);
            applyMerge(folder, firstPage.messages, true);
            if (firstPage.hasMore && !fullyLoadedRef.current.has(folder)) {
              startBackgroundPages(folder, 1, firstPage.sessionCookie);
            }
            return;
          }
        } catch (err) { console.error("[REFRESH] webmail incremental failed:", err); }
      } else {
        // Outlook COM incremental
        try {
          const qs  = new URLSearchParams({ folder, limit: "200", force: "1" });
          const res = await fetch(`/api/outlook/messages?${qs}`, { cache: "no-store" });
          const data = await res.json();
          if (data?.error) throw new Error(data.error);
          if (Array.isArray(data) && data.length > 0) {
            applyMerge(folder, data as OutlookMessage[], true);
          }
          return;
        } catch (err) { console.error("[REFRESH] COM incremental failed:", err); }
      }
      // Fall through to full reload if incremental failed
    }

    // ── Serve from cache ──────────────────────────────────────────────────────
    if (cached && !forceRefresh) {
      setMessages(cached); setLoadingCount(cached.length);
      if (preserveSelection) {
        const matched = cached.find(m => m.entryId === selectedEntryId);
        if (matched) setSelected(matched);
        else if (cached.length > 0) selectMessage(cached[0]);
      } else if (cached.length > 0) {
        selectMessage(cached[0]);
      }
      cached.slice(1, 6).forEach(m => prefetchThread(m));

      const capturedFolder = folder;

      // Trigger IMAP+POP3 background enhancement in parallel. Whichever returns
      // more messages than the current cache wins. Uses imapEnhanceRef as a
      // single mutex so we don't double-fire. Critical: this user has POP3
      // configured (not IMAP), so POP3 must be tried — IMAP-only would miss it.
      if ((capturedFolder === "inbox" || capturedFolder === "sent")
          && !imapEnhanceRef.current.has(capturedFolder)) {
        imapEnhanceRef.current.add(capturedFolder);
        (async () => {
          try {
            const [imapResult, pop3Result] = await Promise.allSettled([
              tryImapFetch(2000),
              tryPop3Fetch(2000),
            ]);
            const imapMsgs = imapResult.status === "fulfilled" ? imapResult.value : null;
            const pop3Msgs = pop3Result.status === "fulfilled" ? pop3Result.value : null;
            const imapLen = Array.isArray(imapMsgs) ? imapMsgs.length : 0;
            const pop3Len = Array.isArray(pop3Msgs) ? pop3Msgs.length : 0;
            console.log(`[bg enhance] IMAP=${imapLen} POP3=${pop3Len}`);
            const winner = imapLen >= pop3Len ? imapMsgs : pop3Msgs;
            const winnerProto = imapLen >= pop3Len ? "imap" : "pop3";
            if (Array.isArray(winner) && winner.length > 0) {
              const cur = msgCache.current.get(capturedFolder) ?? [];
              if (winner.length > cur.length) {
                setFolderCache(capturedFolder, winner);
                if (activeFolderRef.current === capturedFolder) {
                  setMessages(winner);
                  setLoadingCount(winner.length);
                }
                localStorage.setItem(PROTO_KEY, winnerProto);
                // Don't lock fullyLoadedRef — POP3 might have hit Vercel's
                // 60s timeout and returned partial results. Let webmail
                // pagination keep going to fill in the rest.
              }
            }
          } catch (e) { console.warn("[bg enhance] failed:", e); }
          finally { imapEnhanceRef.current.delete(capturedFolder); }
        })();
      }

      // Webmail background pagination — keep loading older pages even if
      // POP3/IMAP returned a partial set. Fires whenever webmail credentials
      // exist and we haven't already declared the folder fully loaded.
      const hasWebmailCreds = (() => {
        try {
          const raw = localStorage.getItem("ae_settings_v1");
          if (!raw) return false;
          const cfg = JSON.parse(raw) as Record<string, unknown>;
          const h = String(cfg.popHost ?? "") || String(cfg.imapHost ?? "");
          const u = String(cfg.popUser ?? "") || String(cfg.imapUser ?? "");
          const p = String(cfg.popPass ?? "") || String(cfg.imapPass ?? "");
          return !!(h && u && p);
        } catch { return false; }
      })();
      if (hasWebmailCreds
          && !fullyLoadedRef.current.has(capturedFolder)
          && !bgLoadingRef.current.has(capturedFolder)
          && cached.length > 0) {
        // Resume from page 1 — page 0 was just shown from cache. applyMerge
        // dedupes by entryId so overlap with cache is harmless.
        startBackgroundPages(capturedFolder, 1, getWebmailSession());
      }
      return;
    } else {
      if (!cached || cached.length === 0) {
        setMessages([]); setLoadingCount(0);
        if (!preserveSelection) { setSelected(null); setThread([]); }
      }
    }

    // ── Full load ─────────────────────────────────────────────────────────────
    setMsgLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any;
      let connError = "";

      // ── Step 1: Webmail first — guaranteed to return SOMETHING quickly ────
      // MAILNARA returns an empty list under concurrent-request load. If we get
      // 0 messages, retry up to 2 times (with brief delays) before giving up.
      try {
        let firstPage: WebmailPageResult | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const session = getWebmailSession();
          firstPage = await fetchWebmailPage(folder, 0, session);
          if (firstPage && firstPage.messages.length > 0) break;
          if (attempt < 2) {
            console.warn(`[loadMessages] webmail attempt ${attempt + 1} returned 0 — retrying`);
            await new Promise(r => setTimeout(r, 800));
          }
        }
        if (firstPage !== null) {
          saveWebmailSession(firstPage.sessionCookie);
          data = firstPage.messages;
          localStorage.setItem(PROTO_KEY, "webmail");
          if (firstPage.hasMore) {
            startBackgroundPages(folder, 1, firstPage.sessionCookie);
          } else {
            fullyLoadedRef.current.add(folder);
          }
        }
      } catch (e) {
        connError = String(e);
      }

      // ── Step 1b: IMAP+POP3 background enhance — race them, use whichever wins.
      // Independent mutex (imapEnhanceRef) so the webmail page loop is not
      // blocked. POP3 typically returns the entire inbox in one shot.
      if ((folder === "inbox" || folder === "sent") && !imapEnhanceRef.current.has(folder)) {
        imapEnhanceRef.current.add(folder);
        (async () => {
          try {
            const [imapResult, pop3Result] = await Promise.allSettled([
              tryImapFetch(2000),
              tryPop3Fetch(2000),
            ]);
            const imapMsgs = imapResult.status === "fulfilled" ? imapResult.value : null;
            const pop3Msgs = pop3Result.status === "fulfilled" ? pop3Result.value : null;
            const imapLen = Array.isArray(imapMsgs) ? imapMsgs.length : 0;
            const pop3Len = Array.isArray(pop3Msgs) ? pop3Msgs.length : 0;
            console.log(`[full-load bg enhance] IMAP=${imapLen} POP3=${pop3Len}`);
            const winner = imapLen >= pop3Len ? imapMsgs : pop3Msgs;
            const winnerProto = imapLen >= pop3Len ? "imap" : "pop3";
            if (Array.isArray(winner) && winner.length > 0) {
              const cur = msgCache.current.get(folder) ?? [];
              if (winner.length > cur.length) {
                setFolderCache(folder, winner);
                if (activeFolderRef.current === folder) {
                  setMessages(winner);
                  setLoadingCount(winner.length);
                }
                localStorage.setItem(PROTO_KEY, winnerProto);
                // Note: do NOT mark fullyLoadedRef. POP3 may have hit a 60s
                // Vercel timeout and returned partial results. Letting the
                // webmail page loop continue gives us a second chance to
                // surface any messages POP3 missed.
              }
            }
          } catch (e) {
            console.warn("[full-load bg enhance] failed:", e);
          } finally {
            imapEnhanceRef.current.delete(folder);
          }
        })();
      }

      // ── Step 3: Outlook COM (Windows desktop only) ───────────────────────
      if (data === undefined) {
        const qs  = new URLSearchParams({ folder });
        const res = await fetch(`/api/outlook/messages?${qs}`);
        const comData = await res.json();
        if (res.status !== 503 && !comData?.error) {
          data = comData;
          localStorage.setItem(PROTO_KEY, "outlook");
        }
      }

      // ── Step 4: POP3 fallback ─────────────────────────────────────────────
      if (data === undefined) {
        const pop3Result = await tryPop3Fetch(2000).then(m => ({ ok: m })).catch(e => ({ err: String(e) }));
        if ("ok" in pop3Result && pop3Result.ok !== null) {
          data = pop3Result.ok;
          localStorage.setItem(PROTO_KEY, "pop3");
        } else if ("err" in pop3Result) {
          connError = connError ? `${connError}\n${(pop3Result as { err: string }).err}` : (pop3Result as { err: string }).err;
        }
      }

      if (data === undefined) {
        throw new Error(connError ||
          "메일을 불러올 수 없습니다.\n설정 → IMAP 또는 POP3 항목에 서버 주소와 계정 정보를 입력하세요."
        );
      }

      const msgs: OutlookMessage[] = Array.isArray(data) ? data : [];
      setFolderCache(folder, msgs);
      setMessages(msgs); setLoadingCount(msgs.length);
      if (preserveSelection) {
        const matched = msgs.find(m => m.entryId === selectedEntryId);
        if (matched) setSelected(matched);
        else if (msgs.length > 0) selectMessage(msgs[0]);
      } else if (msgs.length > 0) {
        selectMessage(msgs[0]);
      }
      msgs.slice(1, 6).forEach(m => prefetchThread(m));
    } catch (e: unknown) {
      if (!cached || forceRefresh) setMsgError(String(e));
    } finally { setMsgLoading(false); }
  }, [activeFolder, selected, setFolderCache]);

  useEffect(() => {
    // Auto-detect current Outlook user if not already saved
    if (!localStorage.getItem("ae_sender_email")) {
      fetch("/api/outlook/me")
        .then(r => r.json())
        .then((d: { name?: string; email?: string }) => {
          if (d.email) {
            setSenderEmail(d.email);
            localStorage.setItem("ae_sender_email", d.email);
          }
          if (d.name && !localStorage.getItem("ae_sender_name")) {
            setSenderName(d.name);
            localStorage.setItem("ae_sender_name", d.name);
          }
        })
        .catch(() => {});
    }

    // Auto-sync settings from cloud when localStorage has no IMAP creds.
    // Without this, a user who only Saved settings on another device would land
    // here with empty creds and see no mail at all.
    async function ensureSettings() {
      try {
        const raw = localStorage.getItem("ae_settings_v1");
        const cfg = raw ? JSON.parse(raw) as Record<string, unknown> : {};
        const hasCreds = !!String(cfg.imapHost ?? "") && !!String(cfg.imapUser ?? "") && !!String(cfg.imapPass ?? "");
        if (hasCreds) return;
        const token = await getToken();
        if (!token) return;
        const res = await fetch("/api/settings", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json() as Record<string, unknown>;
        const next: Record<string, unknown> = { ...cfg };
        const map: Record<string, string> = {
          openai_key: "openaiKey", telegram_token: "telegramToken", telegram_chat_id: "telegramChatId",
          daily_start_time: "dailyStartTime", daily_end_time: "dailyEndTime",
          imap_host: "imapHost", imap_port: "imapPort", imap_ssl: "imapSsl", imap_user: "imapUser", imap_pass: "imapPass",
          smtp_host: "smtpHost", smtp_port: "smtpPort", smtp_ssl: "smtpSsl",
          pop_host: "popHost", pop_port: "popPort", pop_ssl: "popSsl", pop_user: "popUser", pop_pass: "popPass",
          pop_leave_on_server: "popLeaveOnServer",
        };
        for (const [from, to] of Object.entries(map)) {
          if (data[from] !== undefined && data[from] !== null && data[from] !== "") next[to] = data[from];
        }
        localStorage.setItem("ae_settings_v1", JSON.stringify(next));
      } catch { /* ignore — non-critical */ }
    }

    // Migration logic removed — it was wiping perfectly good caches (e.g., a
    // mobile cache holding 115 IMAP-loaded messages) when conditions matched.
    // The cache-serve path now handles mixed webmail/imap entries gracefully
    // via applyMerge, so no aggressive clearing is needed.
    function migrateProtoIfNeeded() { /* no-op */ }

    // Sync settings from cloud BEFORE first load (with a 4s timeout so we
    // never block longer than that). Then re-load if creds arrived.
    const syncWithTimeout = Promise.race([
      ensureSettings(),
      new Promise<void>(resolve => setTimeout(resolve, 4000)),
    ]);
    // Mutex so the primary loadMessages call cannot overlap with anything
    // else that might fire fetchWebmailPage(inbox, 0). MAILNARA returns
    // empty under concurrent load, which would mask valid responses.
    let inboxLoading = false;
    syncWithTimeout.then(async () => {
      if (inboxLoading) return;
      inboxLoading = true;
      // After settings have settled, kick off the load. If creds were absent
      // before but present now, this is the load that actually finds them.
      migrateProtoIfNeeded();
      loadMessages("inbox").finally(() => { inboxLoading = false; }).then(() => {
      // Prefetch other folders after inbox loads. IMAP route only supports INBOX,
      // so for sent/drafts/deleted/junk we always fall back to webmail.
      setTimeout(async () => {
        const proto = localStorage.getItem(PROTO_KEY) ?? "";
        if (proto === "imap" || proto === "webmail") {
          // Sequential webmail fetch for the secondary folders to avoid session conflicts
          for (const f of ["sent", "drafts", "deleted", "junk"] as Folder[]) {
            try {
              const session = getWebmailSession();
              const result  = await fetchWebmailPage(f, 0, session);
              if (result) {
                saveWebmailSession(result.sessionCookie);
                setFolderCache(f, result.messages);
              }
            } catch { /* non-critical, ignore */ }
            await new Promise(r => setTimeout(r, 300));
          }
        } else {
          // Outlook COM — fire and forget
          for (const f of ["sent", "drafts", "deleted", "junk"] as Folder[]) {
            fetch(`/api/outlook/messages?folder=${f}`)
              .then(r => r.json())
              .then(data => { if (Array.isArray(data)) setFolderCache(f, data); })
              .catch(() => {});
          }
        }
      }, 1500);
    });
    });
  }, []); // eslint-disable-line

  // Keyboard shortcuts: Ctrl+A (select all), Delete (bulk delete)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        setCheckedIds(new Set(filtered.map(m => m.entryId)));
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        setCheckedIds(prev => {
          if (prev.size > 0) {
            bulkDelete(Array.from(prev));
            return prev;
          }
          return prev;
        });
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }); // eslint-disable-line

  // Background thread prefetch — warms server PS cache, no UI side-effects
  const prefetchingRef = useRef<Set<string>>(new Set());
  function prefetchThread(msg: OutlookMessage) {
    // webmail/imap/pop3 messages can't use Outlook COM prefetch
    if (msg.entryId.startsWith("web-") || msg.entryId.startsWith("imap-") || msg.entryId.startsWith("pop3-")) return;
    if (threadCache.current.has(msg.entryId)) return;
    if (prefetchingRef.current.has(msg.entryId)) return;
    prefetchingRef.current.add(msg.entryId);
    const params = new URLSearchParams({ convId: msg.conversationId, entryId: msg.entryId });
    fetch(`/api/outlook/thread?${params}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) threadCache.current.set(msg.entryId, data); })
      .catch(() => {})
      .finally(() => prefetchingRef.current.delete(msg.entryId));
  }

  async function selectMessage(msg: OutlookMessage) {
    setSelected(msg); setDraft(""); setDraftError(null); setReplyStatus(""); setIframeH({}); setIframeW({});
    setMobileView("reading");
    setSummaryText(""); setSummaryError(null);
    setComposeOpen(false); setComposeBody("");
    if (msg.isUnread) {
      setMessages(prev => prev.map(m => (m.entryId === msg.entryId ? { ...m, isUnread: false } : m)));
      setFolderCache(
        activeFolder,
        (msgCache.current.get(activeFolder) ?? []).map(m => (m.entryId === msg.entryId ? { ...m, isUnread: false } : m)),
      );
      setImportant(prev => prev.map(m => (m.entryId === msg.entryId ? { ...m, isUnread: false } : m)));
      fetch("/api/outlook/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryId: msg.entryId }),
      }).catch(() => {});
    }
    const cached = threadCache.current.get(msg.entryId);
    if (cached) {
      setThread(cached);
      // Prefetch neighbours after serving from cache
      const list = msgCache.current.get(activeFolder) ?? [];
      const idx  = list.findIndex(m => m.entryId === msg.entryId);
      [list[idx + 1], list[idx + 2]].filter(Boolean).forEach(m => prefetchThread(m));
      return;
    }
    setThread([]); setThreadLoading(true);
    try {
      let fetchedMsgs: unknown[];
      if (msg.entryId.startsWith("imap-")) {
        // IMAP — fetch single message with body + attachments by UID
        const uid = msg.entryId.slice(5);
        const raw = localStorage.getItem("ae_settings_v1");
        const cfg = raw ? JSON.parse(raw) as Record<string, unknown> : {};
        const res = await fetch("/api/imap/thread", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            host: String(cfg.imapHost ?? ""),
            port: Number(cfg.imapPort) || 993,
            ssl:  cfg.imapSsl !== false,
            user: String(cfg.imapUser ?? ""),
            pass: String(cfg.imapPass ?? ""),
            uid,
            folder: "INBOX",
          }),
        });
        const data = await res.json();
        if (data?.error) throw new Error(data.error);
        fetchedMsgs = Array.isArray(data) ? data : [];
      } else if (msg.entryId.startsWith("web-")) {
        // MAILNARA webmail — Outlook COM 없이 HTTPS로 본문 가져오기
        // entryId format: "web-{uid}" for Inbox, "web-{Mailbox}:{uid}" for other folders
        const raw2 = msg.entryId.slice(4);
        const colonIdx = raw2.indexOf(":");
        const mailbox = colonIdx >= 0 ? raw2.slice(0, colonIdx) : "Inbox";
        const uid     = colonIdx >= 0 ? raw2.slice(colonIdx + 1) : raw2;
        const raw = localStorage.getItem("ae_settings_v1");
        const cfg = raw ? JSON.parse(raw) as Record<string, unknown> : {};
        const res = await fetch("/api/webmail/thread", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            host:          String(cfg.popHost ?? "") || String(cfg.imapHost ?? ""),
            user:          String(cfg.popUser ?? "") || String(cfg.imapUser ?? ""),
            pass:          String(cfg.popPass ?? "") || String(cfg.imapPass ?? ""),
            sessionCookie: getWebmailSession(),
            uid,
            mailbox,
            subject:     msg.subject,
            senderName:  msg.senderName,
            senderEmail: msg.senderEmail,
            sentOn:      msg.receivedTime,
          }),
        });
        const data = await res.json();
        if (data?.error) throw new Error(data.error);
        fetchedMsgs = Array.isArray(data) ? data : [];
        // Surface attachment-parser debug info so we can fix the parser pattern
        const dbg = Array.isArray(data) && data[0]?._attachDebug;
        if (dbg) {
          console.warn(`[ATTACH DEBUG] no attachments parsed. tried=${dbg.hitUrl}. sample HTML follows:`);
          console.warn(dbg.sample);
        }
      } else {
        const params = new URLSearchParams({ convId: msg.conversationId, entryId: msg.entryId });
        const res  = await fetch(`/api/outlook/thread?${params}`);
        const data = await res.json();
        if (data?.error) throw new Error(data.error);
        fetchedMsgs = Array.isArray(data) ? data : [];
      }
      const typedMsgs = fetchedMsgs as ThreadMessage[];
      threadCache.current.set(msg.entryId, typedMsgs);
      setThread(typedMsgs);
      // Prefetch next two messages in background
      const list = msgCache.current.get(activeFolder) ?? [];
      const idx  = list.findIndex(m => m.entryId === msg.entryId);
      [list[idx + 1], list[idx + 2]].filter(Boolean).forEach(m => prefetchThread(m));
    } catch (e: unknown) { setMsgError(String(e)); }
    finally { setThreadLoading(false); }
  }

  async function downloadAtt(
    entryId: string,
    att: { name: string; contentType?: string; content?: string; downloadUrl?: string },
  ) {
    // 1) IMAP path — base64 content is already in the response
    if (att.content) {
      try {
        const binary = atob(att.content);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: att.contentType || "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = att.name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
        return;
      } catch (e) { console.error("[downloadAtt] blob fail:", e); }
    }

    // 2) Webmail path — proxy through MAILNARA session via /api/webmail/attachment
    if (entryId.startsWith("web-") && att.downloadUrl) {
      console.log(`[downloadAtt] webmail proxy → ${att.name} (downloadUrl=${att.downloadUrl})`);
      // Reject obviously non-fetchable URLs early so we can give a useful error
      if (/^javascript:/i.test(att.downloadUrl)) {
        alert(`이 첨부는 JavaScript 함수로 다운로드되도록 되어 있어 프록시할 수 없습니다.\nhref: ${att.downloadUrl}`);
        return;
      }
      try {
        const raw = localStorage.getItem("ae_settings_v1");
        const cfg = raw ? JSON.parse(raw) as Record<string, unknown> : {};
        const res = await fetch("/api/webmail/attachment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            host:          String(cfg.popHost ?? "") || String(cfg.imapHost ?? ""),
            user:          String(cfg.popUser ?? "") || String(cfg.imapUser ?? ""),
            pass:          String(cfg.popPass ?? "") || String(cfg.imapPass ?? ""),
            sessionCookie: getWebmailSession(),
            downloadUrl:   att.downloadUrl,
            filename:      att.name,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = att.name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
        return;
      } catch (e) {
        console.error("[downloadAtt] webmail proxy fail:", e, "downloadUrl was:", att.downloadUrl);
        alert(`첨부파일 다운로드 실패: ${String(e)}\nURL: ${att.downloadUrl}`);
        return;
      }
    }

    // 3) Outlook COM fallback (Windows desktop only)
    window.open(`/api/outlook/attachment?${new URLSearchParams({ entryId, name: att.name })}`, "_blank");
  }

  async function translateThread() {
    if (!thread.length) return;
    setTransLoading(true); setTransError(null); setTransIframeH(300);
    // Keep previous result visible until new one arrives (don't flash empty)
    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          htmlMessages: thread.map(m => ({
            senderName: m.senderName,
            sentOn: m.sentOn,
            html: m.htmlBody ||
              `<div style="font-family:'고운돋움',Arial,sans-serif;font-size:11px;line-height:1.7;padding:12px;white-space:pre-wrap">${
                (m.body || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
              }</div>`,
          })),
          targetLang: transLang,
          apiKey: openaiKey,
        }),
      });
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      const result = data.translated ?? "";
      setTransResult(result);
      setTransIsHtml(data.isHtml ?? false);
      if (result) setTransModalOpen(true);
    } catch (e: unknown) { setTransError((e as Error).message); }
    finally { setTransLoading(false); }
  }

  async function generateSummary() {
    if (!selected) return;
    // Read thread from cache ref — always contains the latest data regardless of React state timing
    const currentThread = threadCache.current.get(selected.entryId) ?? thread;
    if (currentThread.length === 0) return;
    const entryIdAtStart = selected.entryId;
    setSummaryLoading(true); setSummaryError(null); setSummaryText("");
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          thread: currentThread.map(m => ({
            senderName: m.senderName, senderEmail: m.senderEmail, sentOn: m.sentOn,
            body: m.body || m.htmlBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
          })),
          convId: selected.conversationId,
          apiKey: openaiKey,
        }),
      });
      const data = await res.json();
      // Discard result if user switched to a different email while request was in flight
      if (selected?.entryId !== entryIdAtStart) return;
      if (data?.error) throw new Error(data.error);
      setSummaryText(data.summary ?? "");
      setSummaryOpen(true);
    } catch (e: unknown) {
      if (selected?.entryId === entryIdAtStart) setSummaryError((e as Error).message);
    }
    finally { if (selected?.entryId === entryIdAtStart) setSummaryLoading(false); }
  }

  async function generateDraft(toList: RecipAddr[] = aiTo, ccList: RecipAddr[] = aiCc) {
    if (!selected || thread.length === 0) return;
    setDraftLoading(true); setDraftError(null); setDraft("");
    try {
      // Fetch Outlook signature in parallel with nothing (fail-soft)
      const sigData = await fetch("/api/outlook/signature").then(r => r.json()).catch(() => ({}));
      const signature = (sigData as { signature?: string }).signature ?? "";

      const res = await fetch("/api/ai/reply", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          thread: thread.map(m => ({
            senderName: m.senderName, senderEmail: m.senderEmail, sentOn: m.sentOn,
            body: m.body || m.htmlBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
            attachments: m.attachments.map(a => ({ name: a.name, size: a.size })),
          })),
          tone, customToneNote: tone === "custom" ? customNote : "",
          senderName, senderEmail, purpose,
          recipientsTo: toList.map(a => `${a.name} <${a.email}>`),
          recipientsCc: ccList.map(a => `${a.name} <${a.email}>`),
          charLimit: charLimitSel === "Custom" ? (charLimitCustom || "") : charLimitSel === "No Limit" ? "" : charLimitSel,
          apiKey: openaiKey,
          signature,
          tableMode,
          convId: selected.conversationId,
        }),
      });
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      // Strip structural markers the AI may echo back
      const cleaned = (data.draft ?? "")
        .replace(/---서명시작---\n?/g, "")
        .replace(/---서명끝---\n?/g, "");
      setDraft(cleaned);
    } catch (e: unknown) { setDraftError((e as Error).message); }
    finally { setDraftLoading(false); }
  }

  function toggleImportant(msg: OutlookMessage) {
    setImportant(prev => {
      const exists = prev.some(m => m.entryId === msg.entryId);
      const next = exists ? prev.filter(m => m.entryId !== msg.entryId) : [...prev, msg];
      localStorage.setItem("ae_important", JSON.stringify(next));
      return next;
    });
  }

  // Collect unique addresses from thread for the modal
  function buildRecipPool(): RecipAddr[] {
    const seen = new Set<string>();
    const addrs: RecipAddr[] = [];
    for (const msg of thread) {
      const add = (name: string, email: string) => {
        const key = email.toLowerCase().trim();
        if (!key || seen.has(key)) return;
        seen.add(key); addrs.push({ name: name.trim(), email: email.trim() });
      };
      add(msg.senderName, msg.senderEmail);
      for (const r of msg.recipients ?? []) add(r.name, r.email);
    }
    return addrs;
  }

  function openRecipientModal(send: boolean) {
    setRecipPool(buildRecipPool()); setRecipMode("send");
    setPendingSend(send); setRecipOpen(true);
  }

  function openAiRecipModal() {
    setRecipPool(buildRecipPool()); setRecipMode("ai");
    setRecipOpen(true);
  }

  // Shared SMTP helper — used by every send path (compose dialog, AI flow,
  // direct forward). Outlook COM is unavailable on Vercel/Linux.
  async function sendMailViaSmtp(opts: { to: string; cc: string; subject: string; htmlBody: string }): Promise<void> {
    const raw = localStorage.getItem("ae_settings_v1");
    const cfg = raw ? JSON.parse(raw) as Record<string, unknown> : {};
    const smtpHost = String(cfg.smtpHost ?? "") || String(cfg.imapHost ?? "");
    const smtpPort = Number(cfg.smtpPort) || 587;
    const ssl      = cfg.smtpSsl !== false;
    const user     = String(cfg.imapUser ?? cfg.popUser ?? "");
    const pass     = String(cfg.imapPass ?? cfg.popPass ?? "");
    if (!smtpHost || !user || !pass) {
      throw new Error("SMTP 설정이 필요합니다 (설정 → SMTP/IMAP).");
    }
    const res = await fetch("/api/mail/send", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        smtpHost, smtpPort, ssl, user, pass,
        to: opts.to, cc: opts.cc, subject: opts.subject, htmlBody: opts.htmlBody,
      }),
    });
    const data = await res.json() as { error?: string; ok?: boolean; hint?: string };
    if (data?.error) {
      // Include the server's hint (e.g., explaining IP-policy SMTP rejection)
      // so the user sees actionable guidance in the alert.
      throw new Error(data.hint ? `${data.error}\n\n${data.hint}` : data.error);
    }
  }

  // Build the quoted thread + final HTML body for a reply/forward.
  function buildReplyHtml(action: "reply" | "replyAll" | "forward", userText: string): { subject: string; html: string } {
    const escape = (s: string) =>
      s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const userBodyHtml = `<div style="font-family:Calibri,Arial,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a">${
      escape(userText).replace(/\n/g,"<br>")
    }</div>`;

    const orig = selected?.subject ?? "";
    const subject = action === "forward"
      ? (/^(fw|fwd)\s*:/i.test(orig) ? orig : `Fwd: ${orig}`)
      : (/^re\s*:/i.test(orig) ? orig : `Re: ${orig}`);

    const msgs = thread.length > 0 ? [...thread].reverse() : (selected ? [{
      senderName:  selected.senderName,
      senderEmail: selected.senderEmail,
      sentOn:      selected.receivedTime,
      htmlBody:    "",
      body:        "",
    } as ThreadMessage] : []);

    const quotedParts: string[] = [];
    for (const m of msgs) {
      const bodyContent = m.htmlBody
        ? (m.htmlBody.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? m.htmlBody)
        : escape(m.body || "").replace(/\n/g, "<br>");
      const senderDisp = m.senderName
        ? `${escape(m.senderName)} &lt;${escape(m.senderEmail)}&gt;`
        : escape(m.senderEmail);
      quotedParts.push(
        `<hr style="border:none;border-top:1px solid #ccc;margin:14px 0">` +
        `<div style="font-family:Calibri,Arial,sans-serif;font-size:12px;color:#666;margin-bottom:6px">` +
        `<b>보낸 사람:</b> ${senderDisp}<br>` +
        `<b>보낸 날짜:</b> ${escape(m.sentOn ?? "")}<br>` +
        `<b>제목:</b> ${escape(orig)}` +
        `</div><div style="font-family:Calibri,Arial,sans-serif;font-size:13px;color:#1a1a1a">${bodyContent}</div>`
      );
    }
    return { subject, html: userBodyHtml + quotedParts.join("") };
  }

  async function handleRecipConfirm(to: RecipAddr[], cc: RecipAddr[]) {
    setRecipOpen(false);
    if (recipMode === "ai") {
      setAiTo(to); setAiCc(cc);
      await generateDraft(to, cc);
    } else if ((recipMode as string) === "forward") {
      // Direct forward via SMTP
      const toStr = to.map(a => a.email).join("; ");
      const ccStr = cc.map(a => a.email).join("; ");
      setReplyStatus("전달 발송 중…");
      try {
        const { subject, html } = buildReplyHtml("forward", "");
        await sendMailViaSmtp({ to: toStr, cc: ccStr, subject, htmlBody: html });
        setReplyStatus("✓ 전달 발송 완료!");
        setTimeout(() => setReplyStatus(""), 4000);
      } catch (e: unknown) { setReplyStatus("오류: " + String(e)); }
    } else {
      await executeReply(to, cc, pendingSend);
    }
  }

  async function executeReply(to: RecipAddr[], cc: RecipAddr[], send: boolean) {
    const label = replyAction === "forward" ? "전달" : replyAction === "replyAll" ? "전체 회신" : "회신";
    if (!send) {
      // Outlook desktop is unavailable on Vercel. Instead of failing silently,
      // open the inline compose dialog pre-filled with the AI draft + recipients
      // so the user can review/edit and click Send.
      setComposeMode("reply");
      setComposeToStr(to.map(a => a.email).join("; "));
      setComposeCcStr(cc.map(a => a.email).join("; "));
      setComposeBody(draft);
      setComposeAiOpen(false);
      setComposeQuoteH(200);
      setReplyStatus("");
      setComposeOpen(true);
      return;
    }
    setReplyStatus(`${label} 발송 중…`);
    try {
      const toStr = to.map(a => a.email).join("; ");
      const ccStr = cc.map(a => a.email).join("; ");
      const { subject, html } = buildReplyHtml(replyAction, draft);
      await sendMailViaSmtp({ to: toStr, cc: ccStr, subject, htmlBody: html });
      setReplyStatus(`✓ ${label} 발송 완료!`);
      setTimeout(() => setReplyStatus(""), 4000);
    } catch (e: unknown) { setReplyStatus("오류: " + String(e)); }
  }

  // Open compose dialog in "new mail" mode (no entryId, fresh subject input)
  function openNewMail() {
    setComposeMode("new");
    setComposeSubject("");
    setComposeToStr("");
    setComposeCcStr("");
    setComposeBody("");
    setReplyStatus("");
    setComposeQuoteH(0);
    setComposeAiOpen(false);
    setComposeOpen(true);
  }

  // Open inline compose panel pre-filled based on action
  function quickOutlookAction(action: "reply" | "replyAll" | "forward") {
    if (!selected) return;
    setComposeMode("reply");
    setReplyAction(action);
    setComposeBody("");
    setReplyStatus("");
    setComposeQuoteH(200);
    setComposeAiOpen(false);

    const latest = thread[thread.length - 1];
    const me = senderEmail.toLowerCase().trim();

    if (action === "reply") {
      setComposeToStr(latest?.senderEmail ?? selected.senderEmail ?? "");
      setComposeCcStr("");
    } else if (action === "replyAll") {
      const toAddrs: string[] = [];
      const latestSender = (latest?.senderEmail ?? selected.senderEmail ?? "").toLowerCase().trim();
      if (latestSender && latestSender !== me) toAddrs.push(latest?.senderEmail ?? selected.senderEmail ?? "");
      for (const r of latest?.recipients ?? []) {
        if (r.rtype === 1 && r.email.toLowerCase().trim() !== me) toAddrs.push(r.email);
      }
      const ccAddrs = (latest?.recipients ?? [])
        .filter(r => r.rtype === 2 && r.email.toLowerCase().trim() !== me)
        .map(r => r.email);
      setComposeToStr(toAddrs.join("; "));
      setComposeCcStr(ccAddrs.join("; "));
    } else {
      // forward — empty recipients, user fills in
      setComposeToStr("");
      setComposeCcStr("");
    }

    setComposeOpen(true);
  }

  async function sendCompose() {
    if (composeSending) return;
    if (composeMode === "reply" && !selected) return;
    if (composeMode === "new" && !composeSubject.trim()) {
      setReplyStatus("제목을 입력하세요");
      return;
    }
    setComposeSending(true);
    setReplyStatus("발송 중…");
    try {
      // All modes go through SMTP — Outlook COM only works on Windows desktop
      // and the reply/forward route shells out to powershell.exe which is
      // unavailable on the Vercel/Linux deployment.
      const raw = localStorage.getItem("ae_settings_v1");
      const cfg = raw ? JSON.parse(raw) as Record<string, unknown> : {};
      const smtpHost = String(cfg.smtpHost ?? "") || String(cfg.imapHost ?? "");
      const smtpPort = Number(cfg.smtpPort) || 587;
      const ssl      = cfg.smtpSsl !== false;
      const user     = String(cfg.imapUser ?? cfg.popUser ?? "");
      const pass     = String(cfg.imapPass ?? cfg.popPass ?? "");
      if (!smtpHost || !user || !pass) {
        throw new Error("SMTP 설정이 필요합니다 (설정 → SMTP/IMAP).");
      }

      // Build subject + quoted thread for reply/forward modes
      let subject = composeSubject;
      let html: string;
      const escape = (s: string) =>
        s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      const userBodyHtml = `<div style="font-family:Calibri,Arial,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a">${
        escape(composeBody).replace(/\n/g,"<br>")
      }</div>`;

      if (composeMode === "new") {
        html = userBodyHtml;
      } else if (selected) {
        // Reply / replyAll / forward — derive subject + quote thread
        const orig = selected.subject ?? "";
        if (replyAction === "forward") {
          subject = /^(fw|fwd)\s*:/i.test(orig) ? orig : `Fwd: ${orig}`;
        } else {
          subject = /^re\s*:/i.test(orig) ? orig : `Re: ${orig}`;
        }
        const quotedParts: string[] = [];
        const msgs = thread.length > 0 ? [...thread].reverse() : [{
          senderName:  selected.senderName,
          senderEmail: selected.senderEmail,
          sentOn:      selected.receivedTime,
          htmlBody:    "",
          body:        "",
        } as ThreadMessage];
        for (const m of msgs) {
          const bodyContent = m.htmlBody
            ? (m.htmlBody.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? m.htmlBody)
            : escape(m.body || "").replace(/\n/g, "<br>");
          const senderDisp = m.senderName
            ? `${escape(m.senderName)} &lt;${escape(m.senderEmail)}&gt;`
            : escape(m.senderEmail);
          quotedParts.push(
            `<hr style="border:none;border-top:1px solid #ccc;margin:14px 0">` +
            `<div style="font-family:Calibri,Arial,sans-serif;font-size:12px;color:#666;margin-bottom:6px">` +
            `<b>보낸 사람:</b> ${senderDisp}<br>` +
            `<b>보낸 날짜:</b> ${escape(m.sentOn ?? "")}<br>` +
            `<b>제목:</b> ${escape(orig)}` +
            `</div><div style="font-family:Calibri,Arial,sans-serif;font-size:13px;color:#1a1a1a">${bodyContent}</div>`
          );
        }
        html = userBodyHtml + quotedParts.join("");
      } else {
        html = userBodyHtml;
      }

      const res = await fetch("/api/mail/send", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          smtpHost, smtpPort, ssl, user, pass,
          to: composeToStr, cc: composeCcStr,
          subject, htmlBody: html,
        }),
      });
      const data = await res.json() as { error?: string; ok?: boolean };

      if (data?.error) throw new Error(data.error);
      setComposeOpen(false);
      setComposeBody("");
      setComposeSubject("");
      setReplyStatus("");
      setSendSuccessOut(false);
      setSendSuccess(true);
      setTimeout(() => setSendSuccessOut(true), 2000);
      setTimeout(() => setSendSuccess(false), 2500);
    } catch (e: unknown) {
      setReplyStatus("오류: " + String(e));
    } finally {
      setComposeSending(false);
    }
  }

  function showConfirm(message: string): Promise<boolean> {
    return new Promise(resolve => setConfirmDialog({ message, resolve }));
  }
  function showAlert(message: string) { setAlertDialog(message); }

  async function deleteMessage(msg: OutlookMessage) {
    const permanent = activeFolder === "deleted";
    const ok = await showConfirm(
      permanent ? "이 메일을 영구 삭제할까요?" : "이 메일을 삭제할까요? (지운 편지함으로 이동)",
    );
    if (!ok) return;

    try {
      let res: Response;
      if (msg.entryId.startsWith("web-")) {
        const cfg = JSON.parse(localStorage.getItem("ae_settings_v1") ?? "{}") as Record<string, unknown>;
        res = await fetch("/api/webmail/delete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ host: String(cfg.popHost ?? "") || String(cfg.imapHost ?? ""), user: String(cfg.popUser ?? "") || String(cfg.imapUser ?? ""), pass: String(cfg.popPass ?? "") || String(cfg.imapPass ?? ""), sessionCookie: getWebmailSession(), entryId: msg.entryId, permanent }),
        });
      } else {
        res = await fetch("/api/outlook/delete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ entryId: msg.entryId }),
        });
      }
      const data = await res.json();
      if (data?.error) throw new Error(data.error);

      setMessages(prev => prev.filter(m => m.entryId !== msg.entryId));
      setFolderCache(
        activeFolder,
        (msgCache.current.get(activeFolder) ?? []).filter(m => m.entryId !== msg.entryId),
      );
      if (msgCache.current.has("inbox")) {
        setFolderCache(
          "inbox",
          (msgCache.current.get("inbox") ?? []).filter(m => m.entryId !== msg.entryId),
        );
      }
      msgCache.current.delete("deleted");
      msgCacheTs.current.delete("deleted");
      persistMsgCache();
      threadCache.current.delete(msg.entryId);
      setImportant(prev => {
        const next = prev.filter(m => m.entryId !== msg.entryId);
        localStorage.setItem("ae_important", JSON.stringify(next));
        return next;
      });
      if (selected?.entryId === msg.entryId) {
        setSelected(null);
        setThread([]);
        setDraft("");
      }
    } catch (e: unknown) {
      showAlert(`삭제 실패: ${String(e)}`);
    }
  }

  async function bulkDelete(ids: string[]) {
    if (ids.length === 0) return;
    const permanent = activeFolder === "deleted";
    const ok = await showConfirm(
      permanent
        ? `선택된 메일 ${ids.length}건을 영구 삭제할까요?`
        : `선택된 메일 ${ids.length}건을 삭제할까요? (지운 편지함으로 이동)`,
    );
    if (!ok) return;
    setBulkDeleting(true);
    const idSet = new Set(ids);
    try {
      const cfg = JSON.parse(localStorage.getItem("ae_settings_v1") ?? "{}") as Record<string, unknown>;
      await Promise.all(
        ids.map(entryId => {
          if (entryId.startsWith("web-")) {
            return fetch("/api/webmail/delete", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ host: String(cfg.popHost ?? "") || String(cfg.imapHost ?? ""), user: String(cfg.popUser ?? "") || String(cfg.imapUser ?? ""), pass: String(cfg.popPass ?? "") || String(cfg.imapPass ?? ""), sessionCookie: getWebmailSession(), entryId, permanent }),
            });
          }
          return fetch("/api/outlook/delete", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ entryId }),
          });
        }),
      );
      setMessages(prev => prev.filter(m => !idSet.has(m.entryId)));
      for (const f of ["inbox", "sent", "drafts", "junk", "deleted", activeFolder] as Folder[]) {
        if (msgCache.current.has(f)) {
          setFolderCache(f, (msgCache.current.get(f) ?? []).filter(m => !idSet.has(m.entryId)));
        }
      }
      msgCache.current.delete("deleted");
      msgCacheTs.current.delete("deleted");
      persistMsgCache();
      for (const id of ids) threadCache.current.delete(id);
      setImportant(prev => {
        const next = prev.filter(m => !idSet.has(m.entryId));
        localStorage.setItem("ae_important", JSON.stringify(next));
        return next;
      });
      if (selected && idSet.has(selected.entryId)) {
        setSelected(null); setThread([]); setDraft("");
      }
      setCheckedIds(new Set());
    } catch (e: unknown) {
      showAlert(`일괄 삭제 실패: ${String(e)}`);
    } finally {
      setBulkDeleting(false);
    }
  }

  async function generateReport(period: ReportPeriod) {
    setReportPeriod(period);
    setReportText("");
    setReportError(null);
    setTelegramStatus("");
    setReportModalOpen(true);
    setReportLoading(true);

    const now   = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - REPORT_PERIOD_DAYS[period]);

    // For daily: apply configured time range filter
    let dailyStartH = 0, dailyStartM = 0, dailyEndH = 23, dailyEndM = 59;
    if (period === "daily") {
      try {
        const startStr = localStorage.getItem("ae_daily_start") ?? "00:00";
        const endStr   = localStorage.getItem("ae_daily_end")   ?? "23:59";
        [dailyStartH, dailyStartM] = startStr.split(":").map(Number);
        [dailyEndH,   dailyEndM]   = endStr.split(":").map(Number);
      } catch {}
    }

    // Collect inbox + sent emails within the period
    const allEmails: { id: string; subject: string; senderName: string; senderEmail: string; date: string; preview: string; folder: string }[] = [];
    for (const folder of ["inbox", "sent"] as Folder[]) {
      for (const m of msgCache.current.get(folder) ?? []) {
        const d = new Date(m.receivedTime);
        if (d < since) continue;
        if (period === "daily") {
          const totalMinutes = d.getHours() * 60 + d.getMinutes();
          const startMinutes = dailyStartH * 60 + dailyStartM;
          const endMinutes   = dailyEndH   * 60 + dailyEndM;
          if (totalMinutes < startMinutes || totalMinutes > endMinutes) continue;
        }
        allEmails.push({
          id: m.entryId.toUpperCase(),
          subject: m.subject,
          senderName: m.senderName,
          senderEmail: m.senderEmail,
          date: m.receivedTime,
          preview: m.preview,
          folder,
        });
      }
    }

    // Load cache
    let cache: Record<string, { ids: string[]; report: string; ts: number }> = {};
    try { cache = JSON.parse(localStorage.getItem(REPORT_CACHE_KEY) ?? "{}"); } catch {}

    const hit         = cache[period];
    const analyzedSet = new Set<string>(hit?.ids ?? []);
    const newEmails   = allEmails.filter(e => !analyzedSet.has(e.id));

    if (newEmails.length === 0 && hit?.report) {
      setReportText(hit.report);
      setReportLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/ai/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          period,
          newEmails,
          previousReport: hit?.report ?? "",
          apiKey: openaiKey,
        }),
      });
      const data = await res.json();
      if (data?.error) throw new Error(data.error);

      const updatedIds = [...Array.from(analyzedSet), ...newEmails.map(e => e.id)];
      cache[period] = { ids: updatedIds, report: data.report, ts: Date.now() };
      localStorage.setItem(REPORT_CACHE_KEY, JSON.stringify(cache));
      setReportText(data.report);
    } catch (e: unknown) {
      setReportError(String(e));
    } finally {
      setReportLoading(false);
    }
  }

  async function sendReportTelegram() {
    if (!reportText) return;
    const token  = localStorage.getItem("ae_telegram_token") ?? "";
    const chatId = localStorage.getItem("ae_telegram_chat_id") ?? "";
    if (!token || !chatId) {
      setTelegramStatus("⚙ Settings에서 Telegram 토큰과 Chat ID를 먼저 설정하세요.");
      return;
    }
    setTelegramSending(true);
    setTelegramStatus("전송 중…");
    try {
      const header = `*[${REPORT_PERIOD_LABEL[reportPeriod]}]*\n${new Date().toLocaleString("ko-KR")}\n\n`;
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, chatId, text: header + reportText }),
      });
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      setTelegramStatus("✓ Telegram 발송 완료");
    } catch (e: unknown) {
      setTelegramStatus("✗ " + String(e));
    } finally {
      setTelegramSending(false);
    }
  }

  async function saveReportToCloud(
    period: string,
    title: string,
    content: string,
    emailCount: number
  ) {
    if (!content) return;
    setReportSaving(true);
    setReportShareUrl("");
    try {
      const data = await apiFetch<{ id: string; share_token: string | null; is_shared: boolean }>(
        "/reports",
        {
          method: "POST",
          body: JSON.stringify({ period, title, content, email_count: emailCount, is_shared: false }),
        }
      );
      setReportSaved(true);
      if (data.share_token) {
        setReportShareUrl(`${window.location.origin}/reports/shared/${data.share_token}`);
      }
      setTimeout(() => setReportSaved(false), 3000);
    } catch {
      // silently ignore — cloud save is best-effort
    } finally {
      setReportSaving(false);
    }
  }

  async function generatePatternAnalysis() {
    setPatternModalOpen(true);
    setPatternText("");
    setPatternError(null);
    setPatternTgStatus("");
    setPatternLoading(true);

    // Determine folder scope
    const scopeFolders: Folder[] = patternScope === "inbox" ? ["inbox"] : patternScope === "sent" ? ["sent"] : ["inbox", "sent"];

    // Determine date cutoff
    const cutoff = patternDays === "all" ? null : (() => {
      const d = new Date();
      d.setDate(d.getDate() - Number(patternDays));
      return d;
    })();

    // Collect emails matching scope + date filter
    const allEmails: { id: string; subject: string; senderName: string; senderEmail: string; date: string; preview: string; folder: string }[] = [];
    for (const folder of scopeFolders) {
      for (const m of msgCache.current.get(folder) ?? []) {
        if (cutoff && new Date(m.receivedTime) < cutoff) continue;
        allEmails.push({
          id: m.entryId.toUpperCase(),
          subject: m.subject,
          senderName: m.senderName,
          senderEmail: m.senderEmail,
          date: m.receivedTime,
          preview: m.preview,
          folder,
        });
      }
    }

    // Cache key is scoped to settings so different configurations stay separate
    const cacheKey = `${PATTERN_CACHE_KEY}_${patternScope}_${patternDays}`;

    let cache: { ids: string[]; analysis: string; ts: number } | null = null;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) cache = JSON.parse(raw);
    } catch {}

    const analyzedSet = new Set<string>(cache?.ids ?? []);
    const newEmails   = allEmails.filter(e => !analyzedSet.has(e.id));

    if (newEmails.length === 0 && cache?.analysis) {
      setPatternText(cache.analysis);
      setPatternLoading(false);
      return;
    }

    const periodLabel = patternDays === "all" ? "전체 기간" : `최근 ${patternDays}일`;
    const scopeLabel  = patternScope === "inbox" ? "받은 편지함" : patternScope === "sent" ? "보낸 편지함" : "전체 (받은+보낸)";

    try {
      const res = await fetch("/api/ai/pattern", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          newEmails,
          previousAnalysis: cache?.analysis ?? "",
          apiKey: openaiKey,
          periodLabel,
          scopeLabel,
        }),
      });
      const data = await res.json();
      if (data?.error) throw new Error(data.error);

      const updatedIds = [...Array.from(analyzedSet), ...newEmails.map((e: { id: string }) => e.id)];
      const newCache = { ids: updatedIds, analysis: data.analysis, ts: Date.now() };
      localStorage.setItem(cacheKey, JSON.stringify(newCache));
      setPatternText(data.analysis);
    } catch (e: unknown) {
      setPatternError(String(e));
    } finally {
      setPatternLoading(false);
    }
  }

  async function sendPatternTelegram() {
    if (!patternText) return;
    const token  = localStorage.getItem("ae_telegram_token") ?? "";
    const chatId = localStorage.getItem("ae_telegram_chat_id") ?? "";
    if (!token || !chatId) {
      setPatternTgStatus("⚙ Set Telegram token and Chat ID in Settings first.");
      return;
    }
    setPatternTgSending(true);
    setPatternTgStatus("Sending…");
    try {
      const header = `*[Work Pattern Analysis]*\n${new Date().toLocaleString("ko-KR")}\n\n`;
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, chatId, text: header + patternText }),
      });
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      setPatternTgStatus("✓ Sent via Telegram");
    } catch (e: unknown) {
      setPatternTgStatus("✗ " + String(e));
    } finally {
      setPatternTgSending(false);
    }
  }

  async function generateTaskSummary() {
    setTaskModalOpen(true);
    setTaskText("");
    setTaskError(null);
    setTaskTgStatus("");
    setTaskLoading(true);

    const scopeFolders: Folder[] = taskScope === "inbox" ? ["inbox"] : taskScope === "sent" ? ["sent"] : ["inbox", "sent"];
    const cutoff = taskDays === "all" ? null : (() => {
      const d = new Date(); d.setDate(d.getDate() - Number(taskDays)); return d;
    })();

    const allEmails: { id: string; subject: string; senderName: string; senderEmail: string; date: string; preview: string; folder: string }[] = [];
    for (const folder of scopeFolders) {
      for (const m of msgCache.current.get(folder) ?? []) {
        if (cutoff && new Date(m.receivedTime) < cutoff) continue;
        allEmails.push({ id: m.entryId.toUpperCase(), subject: m.subject, senderName: m.senderName, senderEmail: m.senderEmail, date: m.receivedTime, preview: m.preview, folder });
      }
    }

    const cacheKey = `${TASK_CACHE_KEY}_${taskScope}_${taskDays}`;
    let cache: { ids: string[]; summary: string; ts: number } | null = null;
    try { const raw = localStorage.getItem(cacheKey); if (raw) cache = JSON.parse(raw); } catch {}

    const analyzedSet = new Set<string>(cache?.ids ?? []);
    const newEmails   = allEmails.filter(e => !analyzedSet.has(e.id));

    if (newEmails.length === 0 && cache?.summary) {
      setTaskText(cache.summary); setTaskLoading(false); return;
    }

    const periodLabel = taskDays === "all" ? "전체 기간" : `최근 ${taskDays}일`;
    const scopeLabel  = taskScope === "inbox" ? "받은 편지함" : taskScope === "sent" ? "보낸 편지함" : "전체 (받은+보낸)";

    try {
      const res = await fetch("/api/ai/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newEmails, previousSummary: cache?.summary ?? "", apiKey: openaiKey, periodLabel, scopeLabel }),
      });
      const data = await res.json();
      if (data?.error) throw new Error(data.error);

      const updatedIds = [...Array.from(analyzedSet), ...newEmails.map((e: { id: string }) => e.id)];
      localStorage.setItem(cacheKey, JSON.stringify({ ids: updatedIds, summary: data.summary, ts: Date.now() }));
      setTaskText(data.summary);
    } catch (e: unknown) {
      setTaskError(String(e));
    } finally {
      setTaskLoading(false);
    }
  }

  async function sendTaskTelegram() {
    if (!taskText) return;
    const token  = localStorage.getItem("ae_telegram_token") ?? "";
    const chatId = localStorage.getItem("ae_telegram_chat_id") ?? "";
    if (!token || !chatId) { setTaskTgStatus("⚙ Set Telegram token and Chat ID in Settings first."); return; }
    setTaskTgSending(true); setTaskTgStatus("Sending…");
    try {
      const header = `*[All Task Summary]*\n${new Date().toLocaleString("ko-KR")}\n\n`;
      const res = await fetch("/api/telegram", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, chatId, text: header + taskText }) });
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      setTaskTgStatus("✓ Sent via Telegram");
    } catch (e: unknown) { setTaskTgStatus("✗ " + String(e)); }
    finally { setTaskTgSending(false); }
  }

  // Convert markdown pipe-tables to HTML for draft preview
  function draftToHtml(text: string): string {
    const TABLE_ROW = /^\|.+\|$/;
    const SEP_ROW   = /^\|[\s\-|:]+\|$/;
    const lines = text.split("\n");
    const out: string[] = [];
    let buf: string[] = [];
    function flush() {
      if (!buf.length) return;
      const rows = buf.filter(r => !SEP_ROW.test(r)).map((row, i) => {
        const cells = row.split("|").slice(1, -1).map(c => c.trim());
        return i === 0
          ? `<tr>${cells.map(c => `<th style="background:#e8eef4;font-weight:600;padding:5px 9px;border:1px solid #b0b8c1;text-align:left">${c}</th>`).join("")}</tr>`
          : `<tr>${cells.map(c => `<td style="padding:5px 9px;border:1px solid #b0b8c1">${c}</td>`).join("")}</tr>`;
      });
      out.push(`<table style="border-collapse:collapse;font-size:12px;margin:6px 0">${rows.join("")}</table>`);
      buf = [];
    }
    for (const line of lines) {
      if (TABLE_ROW.test(line.trim())) { buf.push(line.trim()); }
      else { flush(); out.push(line); }
    }
    flush();
    return out.join("\n")
      .split(/(<table[\s\S]*?<\/table>)/)
      .map((p, i) => i % 2 === 0 ? p.replace(/\n/g, "<br>") : p)
      .join("");
  }

  // Shared srcDoc for translation iframes — injects 10px forced font
  const TRANS_FONT = `<style>*,*::before,*::after,body,p,span,div,td,th,li,a,font{font-size:11px!important;font-family:'고운돋움','Goun Dotum','Dotum','돋움',Arial,sans-serif!important;line-height:1.65!important;}html,body{overflow:hidden!important;margin:0!important;}body{padding:10px 14px!important;}</style>`;
  const transDoc = transIsHtml
    ? TRANS_FONT + transResult
    : `<html><head>${TRANS_FONT}</head><body style="white-space:pre-wrap;color:#1a1a1a">${(transResult).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</body></html>`;

  const isSearching = search.trim().length > 0;
  const displayMsgs = isSearching ? (() => {
    const all = new Map<string, OutlookMessage>();
    for (const f of REAL_FOLDERS) {
      for (const m of msgCache.current.get(f) ?? []) all.set(m.entryId.toUpperCase(), m);
    }
    for (const m of important) all.set(m.entryId.toUpperCase(), m);
    return Array.from(all.values()).sort(
      (a, b) => new Date(b.receivedTime).getTime() - new Date(a.receivedTime).getTime()
    );
  })() : activeFolder === "important" ? important : messages;

  const searchFolderMap: Map<string, Folder> | null = isSearching ? (() => {
    const map = new Map<string, Folder>();
    for (const f of REAL_FOLDERS) {
      for (const m of msgCache.current.get(f) ?? []) map.set(m.entryId.toUpperCase(), f);
    }
    for (const m of important) map.set(m.entryId.toUpperCase(), "important");
    return map;
  })() : null;

  const filtered = displayMsgs.filter(m => {
    if (!search.trim()) return true;
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    const haystack = [m.subject, m.senderName, m.senderEmail, m.preview].join(" ").toLowerCase();
    return terms.every(t => haystack.includes(t));
  });
  const unreadCount = (msgCache.current.get("inbox") ?? messages).filter(m => m.isUnread).length;
  const isTagged    = (msg: OutlookMessage) => important.some(m => m.entryId === msg.entryId);

  return (
    <>
      {settingsOpen && (
        <SettingsModal initial={{ openaiKey }} onSave={handleSaveSettings} onClose={() => setSettingsOpen(false)}/>
      )}
      {recipOpen && (
        <RecipientModal
          pool={recipPool}
          onConfirm={handleRecipConfirm}
          onClose={() => setRecipOpen(false)}
        />
      )}
      {/* ── Report modal ──────────────────────────────────────────────────── */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setReportModalOpen(false)}>
          <div className="flex w-full max-w-2xl flex-col rounded-xl border border-ink-200 bg-white shadow-2xl" style={{ maxHeight: "90vh" }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-ink-100 px-5 py-3">
              <div className="min-w-0">
                <span className="text-[14px] font-bold text-ink-900">{REPORT_PERIOD_LABEL[reportPeriod]}</span>
                <span className="ml-2 text-[11px] text-ink-400">{new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Regenerate */}
                <button onClick={() => generateReport(reportPeriod)} disabled={reportLoading}
                  title="새로 생성"
                  className="flex h-7 w-7 items-center justify-center rounded text-ink-400 hover:bg-ink-100 disabled:opacity-40">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className={reportLoading ? "animate-spin" : ""}>
                    <path d="M4 12a8 8 0 018-8 8 8 0 016.93 4M20 12a8 8 0 01-8 8 8 8 0 01-6.93-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    <path d="M19 4v4h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button onClick={() => setReportModalOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 text-[18px]">×</button>
              </div>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 min-h-0">
              {reportLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-400">
                  <span className="h-7 w-7 animate-spin rounded-full border-2 border-[#0078d4] border-t-transparent"/>
                  <span className="text-[12px]">Analyzing emails…</span>
                </div>
              ) : reportError ? (
                <div className="rounded border border-red-200 bg-red-50 p-4 text-[12px] text-red-600">{reportError}</div>
              ) : reportText ? (
                (() => {
                  const stripEmoji = (s: string) =>
                    s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{200D}]/gu, "").trim();
                  const lines = reportText.split("\n");
                  const nodes: React.ReactNode[] = [];
                  let key = 0;
                  for (const raw of lines) {
                    const line = stripEmoji(raw.trim());
                    if (!line) continue;
                    if (line.startsWith("## ")) {
                      nodes.push(
                        <div key={key++} className="mt-5 first:mt-0 border-b border-[#0f3460] pb-1">
                          <span className="text-[13px] font-bold text-[#0f3460]">{stripEmoji(line.replace(/^##\s*/, ""))}</span>
                        </div>
                      );
                    } else if (line.startsWith("### ")) {
                      nodes.push(
                        <div key={key++} className="mt-3 mb-0.5">
                          <span className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">{stripEmoji(line.replace(/^###\s*/, ""))}</span>
                        </div>
                      );
                    } else if (/^[•\-\*]\s/.test(line)) {
                      const clean = stripEmoji(line.replace(/^[•\-\*]\s*/, ""));
                      const parts = clean.split(/(\*\*[^*]+\*\*)/g);
                      nodes.push(
                        <div key={key++} className="flex items-start gap-2 pl-2">
                          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-400"/>
                          <span className="text-[12.5px] leading-relaxed text-ink-800">
                            {parts.map((p, pi) =>
                              p.startsWith("**") && p.endsWith("**")
                                ? <strong key={pi} className="font-semibold text-ink-900">{p.slice(2, -2)}</strong>
                                : p
                            )}
                          </span>
                        </div>
                      );
                    } else {
                      nodes.push(
                        <p key={key++} className="pl-2 text-[12.5px] leading-relaxed text-ink-600">{stripEmoji(line)}</p>
                      );
                    }
                  }
                  return nodes;
                })()
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-ink-300">
                  <span className="text-[13px]">No emails to analyze</span>
                  <span className="text-[11px]">Load Inbox / Sent first</span>
                </div>
              )}
            </div>
            {/* Footer */}
            <div className="flex shrink-0 flex-col gap-2 border-t border-ink-100 px-5 py-3">
              {telegramStatus && (
                <p className={`text-[11px] font-medium ${telegramStatus.startsWith("✓") ? "text-green-600" : telegramStatus.startsWith("⚙") || telegramStatus.includes("중") ? "text-ink-400" : "text-red-500"}`}>
                  {telegramStatus}
                </p>
              )}
              {reportShareUrl && (
                <div className="flex items-center gap-2 rounded bg-green-50 border border-green-200 px-3 py-1.5">
                  <span className="text-[11px] text-green-700 font-medium">Share link:</span>
                  <a href={reportShareUrl} target="_blank" rel="noreferrer"
                    className="text-[11px] text-blue-600 underline truncate max-w-[260px]">{reportShareUrl}</a>
                  <button onClick={() => navigator.clipboard.writeText(reportShareUrl)}
                    className="ml-auto shrink-0 text-[11px] text-green-700 hover:text-green-900">Copy</button>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <button
                  onClick={sendReportTelegram}
                  disabled={!reportText || telegramSending || reportLoading}
                  className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-[12px] font-medium transition whitespace-nowrap ${
                    !reportText || telegramSending || reportLoading
                      ? "border-ink-200 text-ink-300 cursor-not-allowed"
                      : "border-[#229ED9] text-[#229ED9] hover:bg-[#229ED9] hover:text-white"
                  }`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {telegramSending ? "Sending…" : "Send via Telegram"}
                </button>
                <div className="flex gap-2 flex-wrap">
                  {process.env.NEXT_PUBLIC_API_URL && (
                    <button
                      onClick={() => saveReportToCloud(
                        reportPeriod,
                        `${REPORT_PERIOD_LABEL[reportPeriod]} — ${new Date().toLocaleDateString("en-US")}`,
                        reportText,
                        (msgCache.current.get("inbox")?.length ?? 0) + (msgCache.current.get("sent")?.length ?? 0)
                      )}
                      disabled={!reportText || reportSaving || reportLoading}
                      className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-[12px] font-medium transition whitespace-nowrap ${
                        reportSaved
                          ? "border-green-500 text-green-600 bg-green-50"
                          : !reportText || reportSaving || reportLoading
                            ? "border-ink-200 text-ink-300 cursor-not-allowed"
                            : "border-purple-500 text-purple-600 hover:bg-purple-50"
                      }`}>
                      {reportSaving ? "Saving…" : reportSaved ? "✓ Saved" : "☁ Save to Cloud"}
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(reportText);
                        setReportCopied(true);
                        setTimeout(() => setReportCopied(false), 2000);
                      } catch {}
                    }}
                    disabled={!reportText}
                    className="rounded border border-[#0f3460] px-4 py-1.5 text-[12px] font-medium text-[#0f3460] hover:bg-[#f5f6f8] transition disabled:opacity-40 whitespace-nowrap">
                    {reportCopied ? "✓ Copied" : "Copy"}
                  </button>
                  <button onClick={() => setReportModalOpen(false)}
                    className="rounded bg-[#0f3460] px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0a2342] whitespace-nowrap">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Work Pattern Analysis modal ──────────────────────────────────── */}
      {patternModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPatternModalOpen(false)}>
          <div className="flex w-full max-w-2xl flex-col rounded-xl border border-ink-200 bg-white shadow-2xl" style={{ maxHeight: "90vh" }} onClick={e => e.stopPropagation()}>
            <div className="shrink-0 border-b border-ink-100 px-5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold text-ink-900">Work Pattern Analysis</span>
                <div className="flex items-center gap-2">
                  <button onClick={generatePatternAnalysis} disabled={patternLoading}
                    title="Regenerate"
                    className="flex h-7 w-7 items-center justify-center rounded text-ink-400 hover:bg-ink-100 disabled:opacity-40">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className={patternLoading ? "animate-spin" : ""}>
                      <path d="M4 12a8 8 0 018-8 8 8 0 016.93 4M20 12a8 8 0 01-8 8 8 8 0 01-6.93-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      <path d="M19 4v4h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button onClick={() => setPatternModalOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 text-[18px]">×</button>
                </div>
              </div>
              {/* Scope badges + inline selects for changing settings from modal */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Period</span>
                  <select value={patternDays} onChange={e => setPatternDays(e.target.value as typeof patternDays)}
                    className="rounded border border-ink-200 px-2 py-0.5 text-[11px] text-ink-700 focus:border-[#0078d4] focus:outline-none bg-white">
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="180">Last 180 days</option>
                    <option value="365">Last 1 year</option>
                    <option value="all">All</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Folder</span>
                  <select value={patternScope} onChange={e => setPatternScope(e.target.value as typeof patternScope)}
                    className="rounded border border-ink-200 px-2 py-0.5 text-[11px] text-ink-700 focus:border-[#0078d4] focus:outline-none bg-white">
                    <option value="all">All (Inbox + Sent)</option>
                    <option value="inbox">Inbox only</option>
                    <option value="sent">Sent only</option>
                  </select>
                </div>
                <button onClick={generatePatternAnalysis} disabled={patternLoading}
                  className="rounded bg-[#0f3460] px-3 py-0.5 text-[11px] font-semibold text-white hover:bg-[#0a2342] disabled:opacity-40 whitespace-nowrap">
                  {patternLoading ? "Analyzing…" : "Run"}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 min-h-0">
              {patternLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-400">
                  <span className="h-7 w-7 animate-spin rounded-full border-2 border-[#0078d4] border-t-transparent"/>
                  <span className="text-[12px]">Analyzing work patterns…</span>
                </div>
              ) : patternError ? (
                <div className="rounded border border-red-200 bg-red-50 p-4 text-[12px] text-red-600">{patternError}</div>
              ) : patternText ? (
                (() => {
                  const stripEmoji = (s: string) =>
                    s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{200D}]/gu, "").trim();
                  const lines = patternText.split("\n");
                  const nodes: React.ReactNode[] = [];
                  let key = 0;
                  for (const raw of lines) {
                    const line = stripEmoji(raw.trim());
                    if (!line) continue;
                    if (line.startsWith("## ")) {
                      nodes.push(
                        <div key={key++} className="mt-5 first:mt-0 border-b border-[#0f3460] pb-1">
                          <span className="text-[13px] font-bold text-[#0f3460]">{stripEmoji(line.replace(/^##\s*/, ""))}</span>
                        </div>
                      );
                    } else if (line.startsWith("### ")) {
                      nodes.push(
                        <div key={key++} className="mt-3 mb-0.5">
                          <span className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">{stripEmoji(line.replace(/^###\s*/, ""))}</span>
                        </div>
                      );
                    } else if (/^[•\-\*]\s/.test(line)) {
                      const clean = stripEmoji(line.replace(/^[•\-\*]\s*/, ""));
                      const parts = clean.split(/(\*\*[^*]+\*\*)/g);
                      nodes.push(
                        <div key={key++} className="flex items-start gap-2 pl-2">
                          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-400"/>
                          <span className="text-[12.5px] leading-relaxed text-ink-800">
                            {parts.map((p, pi) =>
                              p.startsWith("**") && p.endsWith("**")
                                ? <strong key={pi} className="font-semibold text-ink-900">{p.slice(2, -2)}</strong>
                                : p
                            )}
                          </span>
                        </div>
                      );
                    } else {
                      nodes.push(
                        <p key={key++} className="pl-2 text-[12.5px] leading-relaxed text-ink-600">{stripEmoji(line)}</p>
                      );
                    }
                  }
                  return nodes;
                })()
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-ink-300">
                  <span className="text-[13px]">No emails to analyze</span>
                  <span className="text-[11px]">Load Inbox / Sent first</span>
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2 border-t border-ink-100 px-5 py-3">
              {patternTgStatus && (
                <p className={`text-[11px] font-medium ${patternTgStatus.startsWith("✓") ? "text-green-600" : patternTgStatus.startsWith("⚙") || patternTgStatus.includes("ing") ? "text-ink-400" : "text-red-500"}`}>
                  {patternTgStatus}
                </p>
              )}
              <div className="flex items-center justify-between">
                <button onClick={sendPatternTelegram}
                  disabled={!patternText || patternTgSending || patternLoading}
                  className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-[12px] font-medium transition whitespace-nowrap ${
                    !patternText || patternTgSending || patternLoading
                      ? "border-ink-200 text-ink-300 cursor-not-allowed"
                      : "border-[#229ED9] text-[#229ED9] hover:bg-[#229ED9] hover:text-white"
                  }`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {patternTgSending ? "Sending…" : "Send via Telegram"}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(patternText);
                        setPatternCopied(true);
                        setTimeout(() => setPatternCopied(false), 2000);
                      } catch {}
                    }}
                    disabled={!patternText}
                    className="rounded border border-[#0f3460] px-4 py-1.5 text-[12px] font-medium text-[#0f3460] hover:bg-[#f5f6f8] transition disabled:opacity-40 whitespace-nowrap">
                    {patternCopied ? "✓ Copied" : "Copy"}
                  </button>
                  <button onClick={() => setPatternModalOpen(false)}
                    className="rounded bg-[#0f3460] px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0a2342] whitespace-nowrap">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── All Task Summary modal ───────────────────────────────────────── */}
      {taskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setTaskModalOpen(false)}>
          <div className="flex w-full max-w-2xl flex-col rounded-xl border border-ink-200 bg-white shadow-2xl" style={{ maxHeight: "90vh" }} onClick={e => e.stopPropagation()}>
            <div className="shrink-0 border-b border-ink-100 px-5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold text-ink-900">All Task Summary</span>
                <div className="flex items-center gap-2">
                  <button onClick={generateTaskSummary} disabled={taskLoading} title="Regenerate"
                    className="flex h-7 w-7 items-center justify-center rounded text-ink-400 hover:bg-ink-100 disabled:opacity-40">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className={taskLoading ? "animate-spin" : ""}>
                      <path d="M4 12a8 8 0 018-8 8 8 0 016.93 4M20 12a8 8 0 01-8 8 8 8 0 01-6.93-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      <path d="M19 4v4h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button onClick={() => setTaskModalOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 text-[18px]">×</button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Period</span>
                  <select value={taskDays} onChange={e => setTaskDays(e.target.value as typeof taskDays)}
                    className="rounded border border-ink-200 px-2 py-0.5 text-[11px] text-ink-700 focus:border-[#0078d4] focus:outline-none bg-white">
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="180">Last 180 days</option>
                    <option value="365">Last 1 year</option>
                    <option value="all">All</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Folder</span>
                  <select value={taskScope} onChange={e => setTaskScope(e.target.value as typeof taskScope)}
                    className="rounded border border-ink-200 px-2 py-0.5 text-[11px] text-ink-700 focus:border-[#0078d4] focus:outline-none bg-white">
                    <option value="all">All (Inbox + Sent)</option>
                    <option value="inbox">Inbox only</option>
                    <option value="sent">Sent only</option>
                  </select>
                </div>
                <button onClick={generateTaskSummary} disabled={taskLoading}
                  className="rounded bg-[#0f3460] px-3 py-0.5 text-[11px] font-semibold text-white hover:bg-[#0a2342] disabled:opacity-40 whitespace-nowrap">
                  {taskLoading ? "Analyzing…" : "Run"}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 min-h-0">
              {taskLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-400">
                  <span className="h-7 w-7 animate-spin rounded-full border-2 border-[#0078d4] border-t-transparent"/>
                  <span className="text-[12px]">Summarizing all tasks…</span>
                </div>
              ) : taskError ? (
                <div className="rounded border border-red-200 bg-red-50 p-4 text-[12px] text-red-600">{taskError}</div>
              ) : taskText ? (
                (() => {
                  const stripEmoji = (s: string) =>
                    s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{200D}]/gu, "").trim();
                  const lines = taskText.split("\n");
                  const nodes: React.ReactNode[] = [];
                  let key = 0;
                  for (const raw of lines) {
                    const line = stripEmoji(raw.trim());
                    if (!line) continue;
                    if (line.startsWith("## ")) {
                      nodes.push(<div key={key++} className="mt-5 first:mt-0 border-b border-[#0f3460] pb-1"><span className="text-[13px] font-bold text-[#0f3460]">{stripEmoji(line.replace(/^##\s*/, ""))}</span></div>);
                    } else if (line.startsWith("### ")) {
                      nodes.push(<div key={key++} className="mt-3 mb-0.5"><span className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">{stripEmoji(line.replace(/^###\s*/, ""))}</span></div>);
                    } else if (/^[•\-\*]\s/.test(line)) {
                      const clean = stripEmoji(line.replace(/^[•\-\*]\s*/, ""));
                      const parts = clean.split(/(\*\*[^*]+\*\*)/g);
                      nodes.push(<div key={key++} className="flex items-start gap-2 pl-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-400"/><span className="text-[12.5px] leading-relaxed text-ink-800">{parts.map((p, pi) => p.startsWith("**") && p.endsWith("**") ? <strong key={pi} className="font-semibold text-ink-900">{p.slice(2, -2)}</strong> : p)}</span></div>);
                    } else {
                      nodes.push(<p key={key++} className="pl-2 text-[12.5px] leading-relaxed text-ink-600">{stripEmoji(line)}</p>);
                    }
                  }
                  return nodes;
                })()
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-ink-300">
                  <span className="text-[13px]">No emails to analyze</span>
                  <span className="text-[11px]">Load Inbox / Sent first</span>
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2 border-t border-ink-100 px-5 py-3">
              {taskTgStatus && (
                <p className={`text-[11px] font-medium ${taskTgStatus.startsWith("✓") ? "text-green-600" : taskTgStatus.startsWith("⚙") || taskTgStatus.includes("ing") ? "text-ink-400" : "text-red-500"}`}>{taskTgStatus}</p>
              )}
              <div className="flex items-center justify-between">
                <button onClick={sendTaskTelegram} disabled={!taskText || taskTgSending || taskLoading}
                  className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-[12px] font-medium transition whitespace-nowrap ${!taskText || taskTgSending || taskLoading ? "border-ink-200 text-ink-300 cursor-not-allowed" : "border-[#229ED9] text-[#229ED9] hover:bg-[#229ED9] hover:text-white"}`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {taskTgSending ? "Sending…" : "Send via Telegram"}
                </button>
                <div className="flex gap-2">
                  <button onClick={async () => { try { await navigator.clipboard.writeText(taskText); setTaskCopied(true); setTimeout(() => setTaskCopied(false), 2000); } catch {} }}
                    disabled={!taskText}
                    className="rounded border border-[#0f3460] px-4 py-1.5 text-[12px] font-medium text-[#0f3460] hover:bg-[#f5f6f8] transition disabled:opacity-40 whitespace-nowrap">
                    {taskCopied ? "✓ Copied" : "Copy"}
                  </button>
                  <button onClick={() => setTaskModalOpen(false)}
                    className="rounded bg-[#0f3460] px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0a2342] whitespace-nowrap">Close</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Summary modal ─────────────────────────────────────────────────── */}
      {summaryOpen && summaryText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSummaryOpen(false)}>
          <div className="flex w-full max-w-2xl flex-col rounded-xl border border-ink-200 bg-white shadow-2xl" style={{ maxHeight: "88vh" }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-ink-100 px-5 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="min-w-0">
                  <span className="text-[14px] font-bold text-ink-900">Thread Report</span>
                  <span className="ml-2 text-[11px] text-ink-400 truncate">{selected?.subject ?? ""}</span>
                </div>
              </div>
              <button onClick={() => setSummaryOpen(false)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 text-[18px]">×</button>
            </div>
            {/* Body — report renderer */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
              {(() => {
                // Strip emojis then parse markdown
                const stripEmoji = (s: string) =>
                  s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{200D}]/gu, "").trim();
                const lines = summaryText.split("\n");
                const nodes: React.ReactNode[] = [];
                let key = 0;
                for (const raw of lines) {
                  const line = stripEmoji(raw.trim());
                  if (!line) continue;
                  if (line.startsWith("## ")) {
                    const title = stripEmoji(line.replace(/^##\s*/, ""));
                    nodes.push(
                      <div key={key++} className="mt-5 first:mt-0 border-b border-[#0f3460] pb-1">
                        <span className="text-[13px] font-bold text-[#0f3460]">{title}</span>
                      </div>
                    );
                  } else if (line.startsWith("### ")) {
                    const title = stripEmoji(line.replace(/^###\s*/, ""));
                    nodes.push(
                      <div key={key++} className="mt-3 mb-0.5">
                        <span className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">{title}</span>
                      </div>
                    );
                  } else if (/^[•\-\*]\s/.test(line)) {
                    const clean = stripEmoji(line.replace(/^[•\-\*]\s*/, ""));
                    const parts = clean.split(/(\*\*[^*]+\*\*)/g);
                    nodes.push(
                      <div key={key++} className="flex items-start gap-2 pl-2">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-400"/>
                        <span className="text-[12.5px] leading-relaxed text-ink-800">
                          {parts.map((p, pi) =>
                            p.startsWith("**") && p.endsWith("**")
                              ? <strong key={pi} className="font-semibold text-ink-900">{p.slice(2, -2)}</strong>
                              : p
                          )}
                        </span>
                      </div>
                    );
                  } else {
                    nodes.push(
                      <p key={key++} className="pl-2 text-[12.5px] leading-relaxed text-ink-600">{stripEmoji(line)}</p>
                    );
                  }
                }
                return nodes;
              })()}
            </div>
            {/* Footer */}
            <div className="flex shrink-0 items-center justify-between border-t border-ink-100 px-5 py-3">
              <span className="text-[11px] text-ink-400">
                {thread.length}개 메시지 기준
              </span>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(summaryText);
                      setSummaryCopied(true);
                      setTimeout(() => setSummaryCopied(false), 2000);
                    } catch {}
                  }}
                  className="rounded border border-[#0f3460] px-4 py-1.5 text-[12px] font-medium text-[#0f3460] hover:bg-[#f5f6f8] transition">
                  {summaryCopied ? "✓ Copied" : "Copy"}
                </button>
                <button onClick={() => setSummaryOpen(false)}
                  className="rounded bg-[#0f3460] px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0a2342]">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {transModalOpen && transResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-[1200px] flex-col rounded-xl border border-ink-200 bg-white shadow-2xl" style={{ maxHeight: "90dvh" }}>
            <div className="flex shrink-0 items-center justify-between border-b border-ink-100 px-5 py-3">
              <span className="text-[14px] font-semibold">Translation ({transLang})</span>
              <button onClick={() => setTransModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 text-[16px]">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              <iframe
                srcDoc={transDoc}
                sandbox="allow-scripts allow-same-origin"
                className="w-full rounded border-none"
                style={{ minHeight: 300, height: transIframeH, maxHeight: "80vh" }}
                onLoad={e => {
                  const frame = e.currentTarget;
                  const measure = () => {
                    try {
                      const doc = frame.contentDocument;
                      const h = Math.max(doc?.documentElement?.scrollHeight ?? 0, doc?.body?.scrollHeight ?? 0, 200) + 20;
                      setTransIframeH(h);
                    } catch {}
                  };
                  measure();
                  setTimeout(measure, 400);
                }}
              />
            </div>
            <div className="flex shrink-0 flex-row gap-2 border-t border-ink-100 px-5 py-3">
              <button
                onClick={async () => {
                  try {
                    const html = transIsHtml ? transResult : `<pre style="font-family:inherit;white-space:pre-wrap">${transResult.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre>`;
                    const plain = transResult.replace(/<[^>]+>/g, "").replace(/&nbsp;/g," ").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").trim();
                    if (typeof ClipboardItem !== "undefined") {
                      await navigator.clipboard.write([new ClipboardItem({
                        "text/html":  new Blob([html],  { type: "text/html" }),
                        "text/plain": new Blob([plain], { type: "text/plain" }),
                      })]);
                    } else {
                      await navigator.clipboard.writeText(plain);
                    }
                    setCopyDone(true);
                    setTimeout(() => setCopyDone(false), 2000);
                  } catch {}
                }}
                className="flex-1 rounded border border-[#0f3460] px-4 py-1.5 text-[12px] font-medium text-[#0f3460] hover:bg-[#0f3460] hover:text-white transition whitespace-nowrap">
                Copy
              </button>
              <button onClick={() => setTransModalOpen(false)}
                className="flex-1 rounded bg-[#0f3460] px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0a2342] whitespace-nowrap">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Send success overlay ─────────────────────────────────────────── */}
      {sendSuccess && (
        <div className="success-overlay fixed inset-0 z-[200] flex items-center justify-center bg-black/30 pointer-events-none">
          <div className={`success-card${sendSuccessOut ? " success-card-out" : ""} flex flex-col items-center gap-4 rounded-2xl bg-white px-12 py-10 shadow-2xl`}>
            <div className="success-ring flex h-20 w-20 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-200">
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
                <path className="success-check" d="M4 12l5.5 5.5L20 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-gray-800">Sent!</p>
              <p className="mt-1 text-[12px] text-gray-500">Saved to Outlook Sent Items</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Compose popup window ─────────────────────────────────────────── */}
      {composeOpen && (
        <div className="fixed z-50 flex flex-col rounded-xl border border-ink-200 bg-white shadow-2xl
          bottom-0 right-0 left-0 w-full rounded-b-none
          sm:bottom-4 sm:right-4 sm:left-auto sm:w-[540px] sm:rounded-xl"
          style={{ maxHeight: "calc(100dvh - 48px)" }}>
          {/* Title bar */}
          <div className="flex shrink-0 items-center justify-between rounded-t-xl bg-[#0f3460] px-4 py-2.5">
            <span className="text-[13px] font-semibold text-white min-w-0 truncate mr-2">
              {composeMode === "new"
                ? "New Mail"
                : replyAction === "reply" ? "Reply" : replyAction === "replyAll" ? "Reply All" : "Forward"}
              {composeMode === "reply" && selected && <span className="ml-2 font-normal text-white/60 text-[11px]">{selected.subject}</span>}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => setComposeAiOpen(o => !o)}
                className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition ${
                  composeAiOpen ? "bg-white text-[#0f3460]" : "bg-white/20 text-white hover:bg-white/30"
                }`}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill={composeAiOpen ? "#0f3460" : "none"}/>
                </svg>
                AI
              </button>
              <button onClick={() => { setComposeOpen(false); setComposeBody(""); setComposeSubject(""); setComposeAiOpen(false); }}
                className="flex h-6 w-6 items-center justify-center rounded text-white/60 hover:text-white hover:bg-white/20 text-[18px] leading-none">×</button>
            </div>
          </div>
          {/* Subject (new mail only) */}
          {composeMode === "new" && (
            <div className="flex shrink-0 items-center border-b border-ink-100 px-4">
              <span className="w-10 shrink-0 text-[11px] font-medium text-ink-400">Subject</span>
              <input
                autoFocus
                value={composeSubject}
                onChange={e => setComposeSubject(e.target.value)}
                placeholder="Email subject"
                className="flex-1 bg-transparent py-2.5 text-[12px] text-ink-800 focus:outline-none placeholder:text-ink-300"
              />
            </div>
          )}
          {/* To */}
          <div className="flex shrink-0 items-center border-b border-ink-100 px-4">
            <span className="w-10 shrink-0 text-[11px] font-medium text-ink-400">To</span>
            <input
              autoFocus={composeMode !== "new"}
              value={composeToStr}
              onChange={e => setComposeToStr(e.target.value)}
              placeholder="Email address (separate with semicolons)"
              className="flex-1 bg-transparent py-2.5 text-[12px] text-ink-800 focus:outline-none placeholder:text-ink-300"
            />
          </div>
          {/* CC */}
          <div className="flex shrink-0 items-center border-b border-ink-100 px-4">
            <span className="w-10 shrink-0 text-[11px] font-medium text-ink-400">CC</span>
            <input
              value={composeCcStr}
              onChange={e => setComposeCcStr(e.target.value)}
              placeholder="CC email (optional)"
              className="flex-1 bg-transparent py-2.5 text-[12px] text-ink-800 focus:outline-none placeholder:text-ink-300"
            />
          </div>
          {/* Scrollable body area (textarea + quoted email) */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* Body */}
          <textarea
            value={composeBody}
            onChange={e => setComposeBody(e.target.value)}
            placeholder={
              composeMode === "new" ? "Enter your message…" :
              replyAction === "forward" ? "Enter forwarding message…" : "Enter reply…"
            }
            className="min-h-[120px] flex-1 resize-none bg-white px-4 py-3 text-[12px] leading-relaxed text-ink-800 focus:outline-none placeholder:text-ink-300"
          />
          {/* Quoted thread history */}
          {(() => {
            if (composeMode === "new") return null;
            if (!selected) return null;
            if (threadLoading) return (
              <div className="shrink-0 border-t border-ink-100 flex items-center justify-center" style={{ height: 60 }}>
                <span className="text-[11px] text-ink-400">원본 메일 불러오는 중…</span>
              </div>
            );
            if (thread.length === 0) return null;

            // Build quoted HTML from ALL thread messages (newest first = reversed)
            const msgs = [...thread].reverse();
            const partsHtml = msgs.map((msg, idx) => {
              // Extract body content only (skip injected <head> styles that have overflow:hidden)
              let bodyContent = "";
              if (msg.htmlBody) {
                const m = msg.htmlBody.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
                bodyContent = m ? m[1] : msg.htmlBody;
              } else if (msg.body) {
                bodyContent = `<pre style="white-space:pre-wrap;font-family:Calibri,Arial,sans-serif;font-size:11px;margin:0">${msg.body.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre>`;
              }
              const senderDisp = msg.senderName
                ? `${msg.senderName} &lt;${msg.senderEmail}&gt;`
                : msg.senderEmail;
              const dateStr = formatDate(msg.sentOn ?? "");
              const toRecips = msg.recipients.filter(r => r.rtype === 1).map(r => r.name || r.email).join("; ");
              const subjStr  = (msg.subject ?? "").replace(/</g,"&lt;").replace(/>/g,"&gt;");
              const label    = idx === 0
                ? (replyAction === "forward" ? "전달된 메시지" : "원본 메시지")
                : "이전 메시지";
              return `<div style="padding:10px 0;${idx > 0 ? "border-top:1px solid #ddd;margin-top:8px" : ""}">
                <div style="background:#f5f5f5;padding:6px 10px;border-radius:3px;margin-bottom:8px;font-size:11px;color:#555;line-height:1.6">
                  <b>----- ${label} -----</b><br/>
                  <b>보낸 사람:</b> ${senderDisp}<br/>
                  <b>보낸 날짜:</b> ${dateStr}<br/>
                  ${toRecips ? `<b>받는 사람:</b> ${toRecips}<br/>` : ""}
                  <b>제목:</b> ${subjStr}
                </div>
                ${bodyContent}
              </div>`;
            }).join("");

            const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
              *{box-sizing:border-box}
              html,body{margin:0;padding:0;overflow-y:auto!important;overflow-x:hidden}
              body{font-family:'고운돋움','Goun Dotum',Calibri,Arial,sans-serif;font-size:12px;color:#333;padding:8px 12px}
              img{max-width:100%!important;height:auto!important}
            </style></head><body>${partsHtml}</body></html>`;

            return (
              <div className="shrink-0 border-t border-ink-100" style={{ height: composeQuoteH }}>
                <iframe
                  srcDoc={srcDoc}
                  sandbox="allow-same-origin"
                  className="w-full border-none"
                  style={{ height: composeQuoteH }}
                  onLoad={e => {
                    try {
                      const doc = e.currentTarget.contentDocument;
                      const h = Math.max(
                        doc?.documentElement?.scrollHeight ?? 0,
                        doc?.body?.scrollHeight ?? 0,
                        80,
                      ) + 24;
                      setComposeQuoteH(Math.min(h, 450));
                    } catch {}
                  }}
                />
              </div>
            );
          })()}
          {/* ── AI panel inside compose (collapsible) ───────────────── */}
          {composeAiOpen && (
            <div className="shrink-0 border-t-2 border-[#0f3460]/20 bg-[#f3f6fb]">
              <div className="px-4 py-3 space-y-3">
                {/* From */}
                <div className="grid grid-cols-2 gap-2">
                  <input value={senderName} onChange={e => { setSenderName(e.target.value); if (senderLocked) localStorage.setItem("ae_sender_name", e.target.value); }}
                    placeholder="Your Name"
                    className="rounded border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] focus:border-[#0f3460] focus:outline-none"/>
                  <input value={senderEmail} onChange={e => { setSenderEmail(e.target.value); if (senderLocked) localStorage.setItem("ae_sender_email", e.target.value); }}
                    placeholder="Your Email"
                    className="rounded border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] focus:border-[#0f3460] focus:outline-none"/>
                </div>
                {/* Purpose */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-ink-600">Purpose / Request</p>
                    {purpose && <button onClick={() => setPurpose("")} className="text-[11px] text-ink-400 hover:text-red-500">Clear</button>}
                  </div>
                  <textarea value={purpose} onChange={e => setPurpose(e.target.value)}
                    placeholder="e.g. Delivery schedule inquiry, quote request, technical Q&A reply"
                    rows={2}
                    className="w-full rounded border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] focus:border-[#0f3460] focus:outline-none resize-none"/>
                </div>
                {/* Tone */}
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold text-ink-600">Tone</p>
                  <div className="grid grid-cols-4 gap-1">
                    {(["neutral","positive","negative","custom"] as Tone[]).map(t => (
                      <button key={t} onClick={() => setTone(t)}
                        className={`rounded border py-1.5 text-[11px] font-medium transition ${
                          tone === t ? "border-[#0f3460] bg-[#0f3460] text-white" : "border-ink-200 bg-white text-ink-600 hover:border-[#0f3460]"
                        }`}>
                        {TONE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>
                {tone === "custom" && (
                  <textarea value={customNote} onChange={e => setCustomNote(e.target.value)}
                    placeholder="e.g. Apologize for delay and propose alternatives" rows={2}
                    className="w-full rounded border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] focus:border-[#0f3460] focus:outline-none resize-none"/>
                )}
                {/* Generate Draft */}
                <button onClick={openAiRecipModal} disabled={!selected || thread.length === 0 || draftLoading}
                  className={`w-full rounded py-2.5 text-[13px] font-semibold transition ${
                    !selected || thread.length === 0 || draftLoading
                      ? "cursor-not-allowed bg-ink-100 text-ink-400"
                      : "bg-[#0f3460] text-white hover:bg-[#0a2342]"
                  }`}>
                  {draftLoading
                    ? <span className="flex items-center justify-center gap-2"><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/>Generating…</span>
                    : "✨ Generate Draft"}
                </button>
                {draftError && (
                  <div className="rounded border border-red-200 bg-red-50 px-2.5 py-2 text-[12px] text-red-600">{draftError}</div>
                )}
                {/* Draft result + insert button */}
                {draft && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-ink-600">Generated Draft</p>
                      <button
                        onClick={() => { setComposeBody(draft); setComposeAiOpen(false); }}
                        className="flex items-center gap-1 rounded bg-green-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-green-600 transition">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        본문에 삽입
                      </button>
                    </div>
                    <textarea value={draft} onChange={e => setDraft(e.target.value)}
                      className="mono w-full rounded border border-ink-200 bg-white px-2.5 py-2 text-[12px] leading-relaxed focus:border-[#0f3460] focus:outline-none resize-none"
                      style={{ height: 180 }}/>
                  </div>
                )}
                {/* Summarize */}
                <div className="flex items-center justify-between border-t border-ink-200 pt-2">
                  <span className="text-[11px] font-semibold text-ink-600">Summarize</span>
                  <button onClick={generateSummary} disabled={!selected || summaryLoading}
                    className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-semibold transition ${
                      !selected || summaryLoading ? "bg-ink-100 text-ink-400 cursor-not-allowed" : "bg-[#0f3460] text-white hover:bg-[#0a2342]"
                    }`}>
                    {summaryLoading
                      ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent inline-block"/>요약 중…</>
                      : <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.6"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                          Summarize
                        </>
                    }
                  </button>
                </div>
                {summaryError && (
                  <div className="rounded border border-red-200 bg-red-50 px-2.5 py-2 text-[12px] text-red-600">{summaryError}</div>
                )}
                {summaryText && (
                  <div className="rounded border border-ink-200 bg-white px-3 py-2.5 text-[12px] text-ink-700 leading-relaxed whitespace-pre-wrap">
                    {summaryText}
                  </div>
                )}
              </div>
            </div>
          )}
          </div>{/* end scrollable body */}
          {/* Footer */}
          <div className="flex shrink-0 flex-col gap-2 border-t border-ink-100 px-4 py-3">
            {replyStatus && (
              <span className={`text-[11px] font-medium ${replyStatus.startsWith("✓") ? "text-green-600" : replyStatus.includes("중") ? "text-ink-400" : "text-red-500"}`}>
                {replyStatus}
              </span>
            )}
            <div className="flex flex-row items-center gap-2">
              <button onClick={() => { setComposeOpen(false); setComposeBody(""); setComposeSubject(""); }}
                className="flex-1 rounded border border-ink-200 px-4 py-1.5 text-[12px] text-ink-600 hover:bg-ink-50 whitespace-nowrap">
                Cancel
              </button>
              <button onClick={sendCompose} disabled={composeSending || !composeToStr.trim()}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded px-4 py-1.5 text-[12px] font-semibold transition whitespace-nowrap ${
                  composeSending || !composeToStr.trim()
                    ? "bg-ink-100 text-ink-400 cursor-not-allowed"
                    : "bg-[#0078d4] text-white hover:bg-[#005fa3]"
                }`}>
                {composeSending ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"/>
                    Sending…
                  </>
                ) : (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy toast */}
      {copyDone && (
        <div className="pointer-events-none fixed inset-x-0 top-5 z-[200] flex justify-center">
          <div className="flex items-center gap-2 rounded-lg bg-[#1a3a5c] px-5 py-2.5 text-[13px] font-medium text-white shadow-xl">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Copied with formatting
          </div>
        </div>
      )}

      <div className="flex h-[calc(100dvh-40px)] flex-col overflow-hidden bg-white">
        {/* Top bar */}
        <div className="flex h-10 shrink-0 items-center gap-2 bg-[#0f3460] px-2 text-white">
          {/* Search */}
          <div className="flex flex-1 h-7 items-center rounded border border-white/20 bg-white/10 px-2.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="mr-1.5 shrink-0 opacity-50">
              <path d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search mail…"
              className="flex-1 bg-transparent text-[12px] text-white placeholder:text-white/40 focus:outline-none min-w-0"/>
            {search && <button onClick={() => setSearch("")} className="text-white/50 hover:text-white ml-1 text-[14px] leading-none">×</button>}
          </div>
          {/* Connection test */}
          <button title="연결 진단" onClick={async () => {
            const cfg = JSON.parse(localStorage.getItem("ae_settings_v1") ?? "{}") as Record<string, unknown>;
            const host = String(cfg.popHost ?? "") || String(cfg.imapHost ?? "");
            const user = String(cfg.popUser ?? "") || String(cfg.imapUser ?? "");
            const pass = String(cfg.popPass ?? "") || String(cfg.imapPass ?? "");
            if (!host) { alert("Settings에 IMAP/POP3 서버 주소가 없습니다."); return; }
            const res = await fetch("/api/webmail/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ host, user, pass }) });
            const data = await res.json();
            alert(JSON.stringify(data, null, 2));
          }} className="flex h-7 shrink-0 items-center justify-center rounded px-1.5 text-[10px] font-bold text-white/70 hover:bg-white/10 hover:text-white">
            진단
          </button>
          {/* Refresh */}
          <button
            onClick={async () => { setIsRefreshing(true); try { await loadMessages(activeFolder, true); } finally { setIsRefreshing(false); } }}
            disabled={isRefreshing} title="새로고침"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-white/10 disabled:opacity-40">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className={isRefreshing ? "animate-spin" : "transition-transform hover:rotate-180 duration-300"}>
              <path d="M4 12a8 8 0 018-8 8 8 0 016.93 4M20 12a8 8 0 01-8 8 8 8 0 01-6.93-4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M19 4v4h-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {/* Settings */}
          <button onClick={() => setSettingsOpen(true)} title="설정"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-white/10">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.8"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="white" strokeWidth="1.8"/>
            </svg>
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Folder pane */}
          <aside className={`${mobileView === "folders" ? "flex" : "hidden"} md:flex w-full md:w-[220px] shrink-0 flex-col bg-[#f3f6fb] border-r border-ink-200`}>
            <div className="px-3 py-3">
              <button
                onClick={() => { openNewMail(); setMobileView("list"); }}
                className="flex w-full items-center gap-2 rounded border border-[#0078d4] bg-white px-3 py-2 text-[13px] font-medium text-[#0078d4] hover:bg-[#deecf9] whitespace-nowrap">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                New Mail
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 pb-2">
              {(["inbox", "toMe", ...REAL_FOLDERS.slice(1), "important"] as Folder[]).map(f => (
                <button key={f} onClick={() => {
                  setActiveFolder(f);
                  setCheckedIds(new Set());
                  setMobileView("list");
                  if (f === "important") {
                    const imp = important;
                    setMessages(imp); setThread([]);
                    if (imp.length > 0) selectMessage(imp[0]); else setSelected(null);
                  } else if (f === "toMe") {
                    const toMe = (msgCache.current.get("inbox") ?? []).filter(m => !!m.isToMe);
                    setMessages(toMe); setThread([]);
                    if (toMe.length > 0) selectMessage(toMe[0]); else setSelected(null);
                  } else loadMessages(f, false);
                }}
                  className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-[13px] transition ${
                    activeFolder === f
                      ? f === "important" ? "bg-[#f5f6f8] font-semibold text-[#0f3460]" : "bg-[#deecf9] font-semibold text-[#0f3460]"
                      : "text-[#3c3c3c] hover:bg-white hover:text-black"
                  }`}>
                  <span>{FOLDER_LABELS[f]}</span>
                  {f === "inbox" && unreadCount > 0 && (
                    <span className="rounded-full bg-[#0078d4] px-1.5 text-[10px] font-bold text-white">{unreadCount}</span>
                  )}
                  {f === "toMe" && (
                    <span className="rounded-full bg-[#0f3460] px-1.5 text-[10px] font-bold text-white">
                      {(msgCache.current.get("inbox") ?? []).filter(m => !!m.isToMe).length}
                    </span>
                  )}
                  {f === "important" && important.length > 0 && (
                    <span className="rounded-full bg-[#0f3460] px-1.5 text-[10px] font-bold text-white">{important.length}</span>
                  )}
                </button>
              ))}
            </nav>
            {/* Report section */}
            <div className="border-t border-ink-200 px-2 pt-2 pb-1">
              <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-widest text-ink-400">Report</div>
              {(["daily", "weekly", "monthly"] as ReportPeriod[]).map(p => (
                <button key={p} onClick={() => generateReport(p)}
                  disabled={reportLoading}
                  className={`mb-0.5 flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-[12px] transition whitespace-nowrap ${
                    reportLoading && reportPeriod === p
                      ? "bg-[#deecf9] text-[#0f3460] font-semibold"
                      : "text-[#3c3c3c] hover:bg-white hover:text-black"
                  }`}>
                  <span>{REPORT_PERIOD_LABEL[p]}</span>
                  {reportLoading && reportPeriod === p && (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#0078d4] border-t-transparent shrink-0"/>
                  )}
                </button>
              ))}
              {/* Pattern Analysis settings */}
              <div className="mt-1 mb-0.5 space-y-1 rounded bg-white border border-ink-200 px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-10 shrink-0 text-[9px] font-bold uppercase tracking-wide text-ink-400">Period</span>
                  <select value={patternDays} onChange={e => setPatternDays(e.target.value as typeof patternDays)}
                    className="flex-1 rounded border border-ink-200 px-1.5 py-0.5 text-[10px] text-ink-700 focus:border-[#0078d4] focus:outline-none bg-white">
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="180">Last 180 days</option>
                    <option value="365">Last 1 year</option>
                    <option value="all">All</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-10 shrink-0 text-[9px] font-bold uppercase tracking-wide text-ink-400">Folder</span>
                  <select value={patternScope} onChange={e => setPatternScope(e.target.value as typeof patternScope)}
                    className="flex-1 rounded border border-ink-200 px-1.5 py-0.5 text-[10px] text-ink-700 focus:border-[#0078d4] focus:outline-none bg-white">
                    <option value="all">All (Inbox + Sent)</option>
                    <option value="inbox">Inbox only</option>
                    <option value="sent">Sent only</option>
                  </select>
                </div>
              </div>
              <button onClick={generatePatternAnalysis}
                disabled={patternLoading}
                className={`mb-0.5 flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-[12px] transition whitespace-nowrap ${
                  patternLoading
                    ? "bg-[#deecf9] text-[#0f3460] font-semibold"
                    : "text-[#0f3460] font-medium hover:bg-white hover:text-black"
                }`}>
                <span>Work Pattern Analysis</span>
                {patternLoading && (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#0078d4] border-t-transparent shrink-0"/>
                )}
              </button>
              {/* All Task Summary settings + button */}
              <div className="mt-1 mb-0.5 space-y-1 rounded bg-white border border-ink-200 px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-10 shrink-0 text-[9px] font-bold uppercase tracking-wide text-ink-400">Period</span>
                  <select value={taskDays} onChange={e => setTaskDays(e.target.value as typeof taskDays)}
                    className="flex-1 rounded border border-ink-200 px-1.5 py-0.5 text-[10px] text-ink-700 focus:border-[#0078d4] focus:outline-none bg-white">
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="180">Last 180 days</option>
                    <option value="365">Last 1 year</option>
                    <option value="all">All</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-10 shrink-0 text-[9px] font-bold uppercase tracking-wide text-ink-400">Folder</span>
                  <select value={taskScope} onChange={e => setTaskScope(e.target.value as typeof taskScope)}
                    className="flex-1 rounded border border-ink-200 px-1.5 py-0.5 text-[10px] text-ink-700 focus:border-[#0078d4] focus:outline-none bg-white">
                    <option value="all">All (Inbox + Sent)</option>
                    <option value="inbox">Inbox only</option>
                    <option value="sent">Sent only</option>
                  </select>
                </div>
              </div>
              <button onClick={generateTaskSummary}
                disabled={taskLoading}
                className={`mb-0.5 flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-[12px] transition whitespace-nowrap ${
                  taskLoading
                    ? "bg-[#deecf9] text-[#0f3460] font-semibold"
                    : "text-[#0f3460] font-medium hover:bg-white hover:text-black"
                }`}>
                <span>All Task Summary</span>
                {taskLoading && (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#0078d4] border-t-transparent shrink-0"/>
                )}
              </button>
            </div>
            <div className="border-t border-ink-200 px-3 py-2">
              <span className="mono text-[11px] text-ink-400">
                {msgLoading ? `로딩 중… ${loadingCount}개` : `${messages.length}개`}
              </span>
            </div>
          </aside>

          {/* Message list */}
          <aside className={`${mobileView === "list" ? "flex" : "hidden"} md:flex w-full md:w-[340px] shrink-0 flex-col border-r border-ink-200 bg-white`}>
            <div className="flex items-center justify-between border-b border-ink-100 bg-[#f9f9f9] px-3 py-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {/* Mobile back to folders */}
                <button onClick={() => setMobileView("folders")}
                  className="md:hidden flex h-7 w-7 items-center justify-center rounded text-[#0078d4] hover:bg-[#deecf9] shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {/* Select all checkbox */}
                <input type="checkbox"
                  title="Select all (Ctrl+A)"
                  checked={filtered.length > 0 && checkedIds.size === filtered.length}
                  ref={el => { if (el) el.indeterminate = checkedIds.size > 0 && checkedIds.size < filtered.length; }}
                  onChange={e => setCheckedIds(e.target.checked ? new Set(filtered.map(m => m.entryId)) : new Set())}
                  className="h-3.5 w-3.5 shrink-0 rounded accent-[#0078d4] cursor-pointer"/>
                <span className="text-[13px] font-semibold text-[#3c3c3c] truncate">{isSearching ? "Search" : FOLDER_LABELS[activeFolder]}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Mobile report shortcuts */}
                <div className="md:hidden flex items-center gap-1">
                  {(["daily", "weekly", "monthly"] as ReportPeriod[]).map(p => (
                    <button key={p} onClick={() => generateReport(p)} disabled={reportLoading}
                      className={`flex h-6 items-center rounded px-2 text-[10px] font-semibold whitespace-nowrap transition ${
                        reportLoading && reportPeriod === p
                          ? "bg-[#0f3460] text-white"
                          : "border border-[#0f3460] text-[#0f3460] hover:bg-[#0f3460] hover:text-white"
                      } disabled:opacity-40`}>
                      {reportLoading && reportPeriod === p
                        ? <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-white border-t-transparent"/>
                        : p === "daily" ? "D" : p === "weekly" ? "W" : "M"}
                    </button>
                  ))}
                  <button onClick={generatePatternAnalysis} disabled={patternLoading}
                    title="Work Pattern Analysis"
                    className={`flex h-6 items-center rounded px-2 text-[10px] font-semibold whitespace-nowrap transition ${
                      patternLoading ? "bg-[#0f3460] text-white" : "border border-[#0f3460] text-[#0f3460] hover:bg-[#0f3460] hover:text-white"
                    } disabled:opacity-40`}>
                    {patternLoading
                      ? <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-white border-t-transparent"/>
                      : "P"}
                  </button>
                </div>
                <span className="mono text-[11px] text-ink-400 flex items-center gap-1">
                  {msgLoading && <span className="h-2 w-2 rounded-full bg-[#0078d4] animate-pulse"/>}
                  {filtered.length}
                  {msgLoading && msgCache.current.has(activeFolder) && <span className="text-ink-300">↻</span>}
                </span>
              </div>
            </div>
            {/* Bulk action bar */}
            {checkedIds.size > 0 && (
              <div className="flex shrink-0 items-center gap-2 border-b border-ink-100 bg-[#deecf9] px-3 py-1.5">
                <input type="checkbox" checked={checkedIds.size === filtered.length}
                  onChange={e => setCheckedIds(e.target.checked ? new Set(filtered.map(m => m.entryId)) : new Set())}
                  className="h-3.5 w-3.5 rounded accent-[#0078d4] cursor-pointer"/>
                <span className="flex-1 text-[12px] font-medium text-[#0f3460]">{checkedIds.size} selected</span>
                <button onClick={() => bulkDelete(Array.from(checkedIds))} disabled={bulkDeleting}
                  className="flex items-center gap-1 rounded bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50 whitespace-nowrap">
                  {bulkDeleting
                    ? <><span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-white border-t-transparent"/>Deleting…</>
                    : <>Delete {checkedIds.size}</>}
                </button>
                <button onClick={() => setCheckedIds(new Set())}
                  className="rounded px-2 py-1 text-[11px] text-ink-500 hover:bg-ink-100 whitespace-nowrap">
                  Cancel
                </button>
              </div>
            )}
            {!msgLoading && msgError && (
              <div className="p-4 text-center">
                <p className="text-[12px] text-red-600 whitespace-pre-wrap break-all">{msgError}</p>
                <div className="mt-2 flex justify-center gap-2">
                  <button onClick={() => loadMessages(activeFolder, true)} className="rounded bg-[#0078d4] px-3 py-1.5 text-[12px] text-white">재시도</button>
                  <button onClick={async () => {
                    const cfg = JSON.parse(localStorage.getItem("ae_settings_v1") ?? "{}") as Record<string, unknown>;
                    const host = String(cfg.popHost ?? "") || String(cfg.imapHost ?? "");
                    const user = String(cfg.popUser ?? "") || String(cfg.imapUser ?? "");
                    const pass = String(cfg.popPass ?? "") || String(cfg.imapPass ?? "");
                    if (!host) { alert("설정에 서버 주소가 없습니다"); return; }
                    setMsgError("🔍 연결 테스트 중...");
                    const res = await fetch("/api/webmail/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ host, user, pass }) });
                    const data = await res.json();
                    setMsgError(JSON.stringify(data, null, 2));
                  }} className="rounded bg-gray-600 px-3 py-1.5 text-[12px] text-white">연결 진단</button>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {filtered.map(msg => (
                <div key={msg.entryId} className="relative group">
                <button
                  onClick={() => { setCheckedIds(prev => { if (prev.size > 0) { const next = new Set(prev); next.has(msg.entryId) ? next.delete(msg.entryId) : next.add(msg.entryId); return next; } return prev; }); selectMessage(msg); }}
                  onMouseEnter={() => prefetchThread(msg)}
                  onDoubleClick={e => { e.preventDefault(); toggleImportant(msg); }}
                  className={`w-full border-b border-ink-50 pl-8 pr-3 py-2.5 text-left hover:bg-[#f3f6fb] transition ${
                    selected?.entryId === msg.entryId ? "border-l-2 border-l-[#0078d4] bg-[#deecf9]" : "border-l-2 border-l-transparent"
                  } ${isTagged(msg) ? "border-l-2 !border-l-blue-400" : ""}`}>
                  <div className="flex items-start gap-1.5">
                    <div className="mt-1.5 h-2 w-2 shrink-0">
                      {isTagged(msg)
                        ? <div className="h-2 w-2 rounded-full bg-blue-500"/>
                        : msg.isUnread && <div className="h-2 w-2 rounded-full bg-[#0078d4]"/>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`truncate text-[13px] ${msg.isUnread ? "font-semibold text-black" : "text-[#3c3c3c]"}`}>
                          {msg.senderName || msg.senderEmail}
                        </span>
                        <span className="mono shrink-0 text-[11px] text-ink-400">{formatTime(msg.receivedTime)}</span>
                      </div>
                      <div className={`mt-0.5 truncate text-[12px] ${msg.isUnread ? "font-medium text-black" : "text-[#3c3c3c]"}`}>
                        {msg.subject}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between">
                        <span className="truncate text-[11px] text-black">{msg.preview}</span>
                        <div className="ml-1 flex shrink-0 items-center gap-1">
                          {isSearching && searchFolderMap && (
                            <span className="rounded bg-ink-100 px-1 py-0.5 text-[10px] text-ink-500 shrink-0">
                              {FOLDER_LABELS[searchFolderMap.get(msg.entryId.toUpperCase()) ?? "inbox"]}
                            </span>
                          )}
                          {msg.attachmentCount > 0 && <span className="text-[11px] text-ink-400">📎</span>}
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={e => { e.stopPropagation(); deleteMessage(msg); }}
                            onKeyDown={e => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                deleteMessage(msg);
                              }
                            }}
                            title="삭제"
                            className="rounded px-1 text-[11px] text-ink-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                          >
                            🗑
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
                {/* Checkbox overlay */}
                <label onClick={e => e.stopPropagation()}
                  className="absolute left-0 top-0 flex h-full w-8 cursor-pointer items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <input type="checkbox"
                    checked={checkedIds.has(msg.entryId)}
                    onChange={e => {
                      e.stopPropagation();
                      setCheckedIds(prev => {
                        const next = new Set(prev);
                        e.target.checked ? next.add(msg.entryId) : next.delete(msg.entryId);
                        return next;
                      });
                    }}
                    className="h-3.5 w-3.5 rounded accent-[#0078d4] cursor-pointer"/>
                </label>
                </div>
              ))}
              {msgLoading && (
                <div className="flex items-center justify-center gap-2 py-3 text-[12px] text-ink-400">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#0078d4] border-t-transparent"/>
                  {loadingCount > 0 ? `${loadingCount} loaded…` : "Loading from Outlook…"}
                </div>
              )}
              {!msgLoading && filtered.length === 0 && !msgError && (
                <div className="p-8 text-center text-[13px] text-ink-400">
                  <p>No emails</p>
                  <button onClick={async () => {
                    const cfg = JSON.parse(localStorage.getItem("ae_settings_v1") ?? "{}") as Record<string, unknown>;
                    const host = String(cfg.popHost ?? "") || String(cfg.imapHost ?? "");
                    const user = String(cfg.popUser ?? "") || String(cfg.imapUser ?? "");
                    const pass = String(cfg.popPass ?? "") || String(cfg.imapPass ?? "");
                    if (!host) { setMsgError("설정에 서버 주소(IMAP/POP3)가 없습니다. Settings → 서버 정보를 입력하세요."); return; }
                    setMsgError("🔍 연결 테스트 중...");
                    const res = await fetch("/api/webmail/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ host, user, pass }) });
                    const data = await res.json();
                    setMsgError(JSON.stringify(data, null, 2));
                  }} className="mt-2 rounded bg-gray-500 px-3 py-1.5 text-[12px] text-white">연결 진단</button>
                </div>
              )}
            </div>
          </aside>

          {/* Reading pane */}
          <main className={`${mobileView === "reading" ? "flex" : "hidden"} md:flex min-w-0 flex-1 flex-col bg-white`}>
            {!selected ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-ink-300">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" className="opacity-30">
                  <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 8l10 6 10-6" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
                <span className="text-[14px]">Select a mail</span>
              </div>
            ) : (
              <>
                <div className="shrink-0 border-b border-ink-100 px-3 md:px-5 py-2 md:py-3">
                  {/* ── Mobile icon bar — single row ─────────────────────── */}
                  <div className="flex md:hidden items-center gap-0.5">
                    {/* Back to list */}
                    <button onClick={() => setMobileView("list")} title="목록"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-ink-500 hover:bg-ink-100 active:bg-ink-200">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <div className="w-px h-4 bg-ink-200 mx-0.5 shrink-0"/>
                    {/* Reply */}
                    <button onClick={() => quickOutlookAction("reply")} title="회신" disabled={!selected}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#0078d4] hover:bg-[#deecf9] active:bg-[#c7e0f4] disabled:opacity-30">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 17l-5-5 5-5M4 12h11a5 5 0 010 10H11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    {/* Reply All */}
                    <button onClick={() => quickOutlookAction("replyAll")} title="전체 회신" disabled={!selected}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#0078d4] hover:bg-[#deecf9] active:bg-[#c7e0f4] disabled:opacity-30">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 17l-5-5 5-5M2 12h11a5 5 0 010 10H9M13 17l-5-5 5-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    {/* Forward */}
                    <button onClick={() => quickOutlookAction("forward")} title="전달" disabled={!selected}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#107c10] hover:bg-[#e6f4e6] active:bg-[#cceacc] disabled:opacity-30">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 7l5 5-5 5M20 12H9a5 5 0 000 10h2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    {/* Delete */}
                    <button onClick={() => selected && deleteMessage(selected)} title="삭제" disabled={!selected}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-red-500 hover:bg-red-50 active:bg-red-100 disabled:opacity-30">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <div className="w-px h-4 bg-ink-200 mx-0.5 shrink-0"/>
                    {/* Prev / count / Next — inline */}
                    {(() => {
                      const idx  = filtered.findIndex(m => m.entryId === selected.entryId);
                      const prev = idx > 0 ? filtered[idx - 1] : null;
                      const next = idx < filtered.length - 1 ? filtered[idx + 1] : null;
                      return (
                        <>
                          <button onClick={() => prev && selectMessage(prev)} disabled={!prev}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-ink-500 hover:bg-ink-100 disabled:opacity-30">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                          <span className="shrink-0 text-[11px] text-ink-400 tabular-nums">{idx + 1}/{filtered.length}</span>
                          <button onClick={() => next && selectMessage(next)} disabled={!next}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-ink-500 hover:bg-ink-100 disabled:opacity-30">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        </>
                      );
                    })()}
                    {/* spacer */}
                    <div className="flex-1"/>
                    {/* AI toggle */}
                    <button onClick={() => setMobileView(v => v === "ai" ? "reading" : "ai")} title="AI Draft"
                      className={`flex h-8 shrink-0 items-center justify-center rounded px-2 text-[11px] font-bold transition ${mobileView === "ai" ? "bg-[#0f3460] text-white" : "border border-ink-200 text-[#0f3460]"}`}>
                      AI
                    </button>
                  </div>
                  {replyStatus && (
                    <div className="md:hidden mt-1 text-[11px] font-medium text-center" style={{ color: replyStatus.startsWith("✓") ? "#16a34a" : replyStatus.includes("중") ? "#9ca3af" : "#dc2626" }}>
                      {replyStatus}
                    </div>
                  )}
                  <hr className="md:hidden border-t border-ink-100 mt-1 mb-2"/>

                  {/* ── Desktop text button bar ──────────────────────────── */}
                  <div className="hidden md:flex mb-2 flex-wrap items-center gap-2">
                    <button onClick={() => quickOutlookAction("reply")} disabled={!selected}
                      className="flex items-center gap-1.5 rounded border border-[#0078d4] bg-white px-3 py-1.5 text-[12px] font-medium text-[#0078d4] hover:bg-[#deecf9] disabled:border-ink-200 disabled:text-ink-400 disabled:cursor-not-allowed transition whitespace-nowrap">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 17l-5-5 5-5M4 12h11a5 5 0 010 10H11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Reply
                    </button>
                    <button onClick={() => quickOutlookAction("replyAll")} disabled={!selected}
                      className="flex items-center gap-1.5 rounded border border-[#0078d4] bg-white px-3 py-1.5 text-[12px] font-medium text-[#0078d4] hover:bg-[#deecf9] disabled:border-ink-200 disabled:text-ink-400 disabled:cursor-not-allowed transition whitespace-nowrap">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M7 17l-5-5 5-5M2 12h11a5 5 0 010 10H9M13 17l-5-5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Reply All
                    </button>
                    <button onClick={() => quickOutlookAction("forward")} disabled={!selected}
                      className="flex items-center gap-1.5 rounded border border-[#107c10] bg-white px-3 py-1.5 text-[12px] font-medium text-[#107c10] hover:bg-[#e6f4e6] disabled:border-ink-200 disabled:text-ink-400 disabled:cursor-not-allowed transition whitespace-nowrap">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M15 7l5 5-5 5M20 12H9a5 5 0 000 10h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Forward
                    </button>
                    <div className="h-5 w-px bg-ink-200"/>
                    <button onClick={() => selected && deleteMessage(selected)} disabled={!selected}
                      className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-[12px] font-medium transition whitespace-nowrap ${selected ? "border-red-200 bg-white text-red-700 hover:bg-red-50" : "border-ink-200 text-ink-400 cursor-not-allowed"}`}>
                      Delete
                    </button>
                    <div className="flex-1"/>
                    {replyStatus && (
                      <span className={`text-[11px] font-medium ${replyStatus.startsWith("✓") ? "text-green-600" : replyStatus.includes("중") ? "text-ink-400" : "text-red-500"}`}>
                        {replyStatus}
                      </span>
                    )}
                    <button onClick={() => openRecipientModal(false)} disabled={!draft}
                      className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-[12px] font-medium transition whitespace-nowrap ${draft ? "border-[#0f3460] bg-white text-[#0f3460] hover:bg-[#0f3460] hover:text-white" : "border-ink-200 text-ink-400 cursor-not-allowed"}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 17l-5-5 5-5M20 18v-2a4 4 0 00-4-4H4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      편집 후 발송
                    </button>
                    <button onClick={() => openRecipientModal(true)} disabled={!draft}
                      className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-[12px] font-medium transition whitespace-nowrap ${draft ? "border-[#0f3460] bg-[#0f3460] text-white hover:bg-[#0a2342]" : "border-ink-200 bg-ink-100 text-ink-400 cursor-not-allowed"}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Send Now
                    </button>
                    <div className="flex-1"/>
                    <button onClick={() => setAiOpen(o => !o)}
                      className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-[12px] font-medium transition whitespace-nowrap ${aiOpen ? "border-[#0f3460] bg-[#0f3460] text-white" : "border-ink-200 bg-white text-ink-600 hover:border-[#0f3460] hover:text-[#0f3460]"}`}>
                      AI Draft
                    </button>
                  </div>
                  <h1 className="text-[17px] font-semibold leading-snug">{selected.subject}</h1>
                  <div className="mt-2 flex items-start gap-2.5">
                    <Avatar name={selected.senderName || selected.senderEmail}/>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-[13px]">{selected.senderName}</span>
                        <span className="text-[12px] text-ink-500">&lt;{selected.senderEmail}&gt;</span>
                      </div>
                      <div className="text-[12px] text-ink-400">{formatDate(selected.receivedTime)}</div>
                    </div>
                  </div>
                </div>

                {threadLoading ? (
                  <div className="flex flex-1 items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0078d4] border-t-transparent"/>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto divide-y divide-ink-100">
                    {thread.length === 0 ? (
                      <div className="p-6 text-center text-[13px] text-ink-400">대화 내용 없음</div>
                    ) : thread.map((msg, idx) => {
                      const isMine = senderEmail && msg.senderEmail &&
                        msg.senderEmail.toLowerCase().trim() === senderEmail.toLowerCase().trim();
                      return (
                      <div key={`${msg.entryId}-${idx}`} className="bg-white">
                        <div className={`flex items-start gap-2.5 px-5 py-2.5 ${isMine ? "bg-[#eef4ff]" : "bg-[#f9f9f9]"}`}>
                          <Avatar name={isMine ? "나" : (msg.senderName || msg.senderEmail)}/>
                          <div className="min-w-0 flex-1">
                            {/* 날짜 + 발신자 */}
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="flex items-baseline gap-1.5 min-w-0">
                                <span className="shrink-0 text-[10px] font-medium text-ink-400">보낸사람</span>
                                {isMine ? (
                                  <span className="font-semibold text-[12px] text-[#0078d4] truncate">나</span>
                                ) : (
                                  <span className="font-semibold text-[12px] truncate">{msg.senderName}</span>
                                )}
                                <span className="text-[11px] text-ink-500 truncate">&lt;{msg.senderEmail}&gt;</span>
                              </div>
                              <span className="mono shrink-0 text-[11px] text-ink-400">{formatDate(msg.sentOn)}</span>
                            </div>
                            {/* 받는사람 */}
                            {msg.recipients.filter(r => r.rtype === 1).length > 0 && (
                              <div className="mt-0.5 flex items-baseline gap-1.5 min-w-0">
                                <span className="shrink-0 text-[10px] font-medium text-ink-400">받는사람</span>
                                <span className="text-[11px] text-ink-600 truncate">
                                  {msg.recipients.filter(r => r.rtype === 1).map(r => r.name || r.email).join(", ")}
                                </span>
                              </div>
                            )}
                            {/* 참조 */}
                            {msg.recipients.filter(r => r.rtype === 2).length > 0 && (
                              <div className="mt-0.5 flex items-baseline gap-1.5 min-w-0">
                                <span className="shrink-0 text-[10px] font-medium text-ink-400">참조</span>
                                <span className="text-[11px] text-ink-500 truncate">
                                  {msg.recipients.filter(r => r.rtype === 2).map(r => r.name || r.email).join(", ")}
                                </span>
                              </div>
                            )}
                            {msg.attachments.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {msg.attachments.map((att, ai) => (
                                  <button key={ai} onClick={() => downloadAtt(msg.entryId, att)}
                                    className="flex items-center gap-1 rounded border border-ink-200 bg-white px-2 py-0.5 text-[11px] text-ink-700 hover:border-[#0078d4] hover:text-[#0078d4] transition">
                                    {fileIcon(att.name)}
                                    <span className="max-w-[180px] truncate">{att.name}</span>
                                    <span className="text-ink-400">({formatSize(att.size)})</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ overflowX: "auto", overflowY: "hidden" }}>
                          <iframe
                            srcDoc={(() => {
                              const fontCss = `@import url('https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=swap');*,*::before,*::after,body,p,span,div,td,th,li,a,font,b,i,em,strong,h1,h2,h3,h4,h5,h6{font-family:'Gowun Dodum','고운돋움','Goun Dotum','Dotum',Arial,sans-serif!important;font-size:13px!important;line-height:1.65!important;}html,body{overflow:visible!important;margin:0!important;}`;
                              if (msg.htmlBody) return `<style>${fontCss}</style>` + msg.htmlBody;
                              return `<html><head><style>${fontCss}body{color:#1a1a1a;padding:12px 18px;white-space:pre-wrap}</style></head><body>${
                                (msg.body || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
                              }</body></html>`;
                            })()}
                            sandbox="allow-scripts allow-same-origin allow-popups"
                            className="border-none"
                            style={{
                              height: iframeH[idx] ?? 300,
                              width: iframeW[idx] ? `${iframeW[idx]}px` : "100%",
                              minWidth: "100%",
                              display: "block",
                            }}
                            onLoad={e => {
                              const frame = e.currentTarget;
                              const measure = () => {
                                try {
                                  const doc = frame.contentDocument;
                                  const h = Math.max(
                                    doc?.documentElement?.scrollHeight ?? 0,
                                    doc?.body?.scrollHeight ?? 0,
                                    120
                                  ) + 50;
                                  const w = Math.max(
                                    doc?.documentElement?.scrollWidth ?? 0,
                                    doc?.body?.scrollWidth ?? 0,
                                    0
                                  );
                                  setIframeH(prev => ({ ...prev, [idx]: h }));
                                  if (w > frame.offsetWidth + 4) {
                                    setIframeW(prev => ({ ...prev, [idx]: w }));
                                  }
                                } catch {}
                              };
                              measure();
                              setTimeout(measure, 600);
                            }}
                            title={`메시지 from ${msg.senderName}`}
                          />
                        </div>
                      </div>
                    );})}
                  </div>
                )}

              </>
            )}
          </main>

          {/* AI panel — desktop: side panel when aiOpen; mobile: full-width pane when mobileView==="ai" */}
          {(aiOpen || mobileView === "ai") && (
            <aside className={`${
              mobileView === "ai" ? "flex w-full" : "hidden"
            } md:flex md:w-[330px] shrink-0 flex-col border-l border-ink-200 bg-[#f9f9f9]`}>
              <div className="flex shrink-0 items-center justify-between border-b border-ink-200 bg-[#f3f6fb] px-4 py-2.5">
                <div className="flex items-center gap-2">
                  {/* Mobile: back to reading pane */}
                  <button onClick={() => setMobileView("reading")}
                    className="md:hidden flex items-center gap-1.5 rounded border border-ink-200 px-2.5 py-1 text-[12px] font-medium text-ink-600 hover:bg-ink-100 active:bg-ink-200">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    메일
                  </button>
                  <span className="text-[13px] font-semibold text-[#3c3c3c]">AI Draft</span>
                </div>
                <button onClick={() => { setAiOpen(false); setMobileView("reading"); }} className="text-ink-400 hover:text-black text-[18px] leading-none">×</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* 보내는 사람 */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-ink-600">From</p>
                    <button
                      onClick={() => {
                        const next = !senderLocked;
                        setSenderLocked(next);
                        localStorage.setItem("ae_sender_locked", String(next));
                        if (next) {
                          localStorage.setItem("ae_sender_name",  senderName);
                          localStorage.setItem("ae_sender_email", senderEmail);
                        } else {
                          localStorage.removeItem("ae_sender_name");
                          localStorage.removeItem("ae_sender_email");
                          localStorage.setItem("ae_sender_locked", "false");
                        }
                      }}
                      className={`rounded border px-2 py-0.5 text-[11px] font-medium transition ${
                        senderLocked
                          ? "border-[#0f3460] bg-[#0f3460] text-white"
                          : "border-ink-200 text-ink-500 hover:border-[#0f3460] hover:text-[#0f3460]"
                      }`}>
                      {senderLocked ? "Pinned" : "Pin"}
                    </button>
                  </div>
                  <input value={senderName}
                    onChange={e => { setSenderName(e.target.value); if (senderLocked) localStorage.setItem("ae_sender_name", e.target.value); }}
                    placeholder="Name"
                    className="mb-1 w-full rounded border border-ink-200 px-2.5 py-1.5 text-[12px] focus:border-[#0f3460] focus:outline-none"/>
                  <input value={senderEmail}
                    onChange={e => { setSenderEmail(e.target.value); if (senderLocked) localStorage.setItem("ae_sender_email", e.target.value); }}
                    placeholder="Email"
                    className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-[12px] focus:border-[#0f3460] focus:outline-none"/>
                </div>

                {/* 메일 목적 */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-ink-600">Purpose / Request</p>
                    <button
                      onClick={() => setPurpose("")}
                      disabled={!purpose}
                      className={`rounded border px-2 py-0.5 text-[11px] font-medium transition ${
                        purpose
                          ? "border-[#0f3460] bg-[#0f3460] text-white hover:bg-[#0a2342]"
                          : "border-ink-200 text-ink-300 cursor-not-allowed"
                      }`}>
                      Clear
                    </button>
                  </div>
                  <textarea value={purpose} onChange={e => setPurpose(e.target.value)}
                    placeholder="e.g. Delivery schedule inquiry, quote request, technical Q&A reply"
                    rows={3}
                    className="mono w-full rounded border border-ink-200 bg-white px-2.5 py-2 text-[12px] focus:border-[#0f3460] focus:outline-none resize-none"/>
                </div>

                {/* 글자 수 제한 */}
                <div>
                  <p className="mb-1.5 text-[12px] font-semibold text-ink-600">Char Limit <span className="font-normal text-ink-400">(incl. spaces)</span></p>
                  <div className="flex gap-1.5">
                    <select
                      value={charLimitSel}
                      onChange={e => { setCharLimitSel(e.target.value); setCharLimitCustom(""); }}
                      className="flex-1 rounded border border-ink-200 bg-white px-2 py-1.5 text-[12px] focus:border-[#0f3460] focus:outline-none">
                      {["No Limit", "200", "300", "500", "800", "1000", "1500", "2000", "Custom"].map(v => (
                        <option key={v} value={v}>{v === "No Limit" || v === "Custom" ? v : `${v} chars`}</option>
                      ))}
                    </select>
                    {charLimitSel === "Custom" && (
                      <input
                        type="number"
                        min={50}
                        value={charLimitCustom}
                        onChange={e => setCharLimitCustom(e.target.value)}
                        placeholder="chars"
                        className="w-24 rounded border border-ink-200 bg-white px-2 py-1.5 text-[12px] focus:border-[#0f3460] focus:outline-none"
                      />
                    )}
                  </div>
                  {charLimitSel !== "No Limit" && (
                    <p className="mt-0.5 text-[11px] text-ink-400">
                      Target: within {charLimitSel === "Custom" ? (charLimitCustom ? `${charLimitCustom} chars` : "—") : `${charLimitSel} chars`}
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-[12px] font-semibold text-ink-600">Tone</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(["neutral","positive","negative","custom"] as Tone[]).map(t => (
                      <button key={t} onClick={() => setTone(t)}
                        className={`rounded border py-2 text-[12px] font-medium transition ${
                          tone===t
                            ? "border-[#0f3460] bg-[#0f3460] text-white font-semibold"
                            : "border-ink-200 bg-white text-ink-600 hover:border-[#0f3460] hover:text-[#0f3460]"
                        }`}>
                        {TONE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>
                {tone === "custom" && (
                  <div>
                    <p className="mb-1 text-[12px] font-semibold text-ink-600">Tone Instruction</p>
                    <textarea value={customNote} onChange={e => setCustomNote(e.target.value)}
                      placeholder="e.g. Apologize for delivery delay and propose alternatives" rows={2}
                      className="mono w-full rounded border border-ink-200 bg-white px-2.5 py-2 text-[12px] focus:border-[#0f3460] focus:outline-none resize-none"/>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button onClick={openAiRecipModal} disabled={!selected || thread.length===0 || draftLoading}
                    className={`flex-1 rounded py-2.5 text-[13px] font-semibold transition ${
                      !selected||thread.length===0||draftLoading
                        ? "cursor-not-allowed bg-ink-100 text-ink-400"
                        : "bg-[#0f3460] text-white hover:bg-[#0a2342]"
                    }`}>
                    {draftLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/>
                        Generating…
                      </span>
                    ) : "Generate Draft"}
                  </button>
                  {/* 표 형식 토글 */}
                  <button
                    onClick={() => setTableMode(p => !p)}
                    title={tableMode ? "Table ON — click to disable" : "Table OFF — click to enable"}
                    className={`flex shrink-0 items-center gap-1 rounded border px-2 py-2.5 text-[12px] font-semibold transition ${
                      tableMode
                        ? "border-[#0f7455] bg-[#0f7455] text-white"
                        : "border-ink-200 bg-white text-ink-500 hover:border-[#0f7455] hover:text-[#0f7455]"
                    }`}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.7"/>
                      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                  </button>
                </div>
                {draftError && (
                  <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">{draftError}</div>
                )}
                {draft ? (
                  <>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-[12px] font-semibold text-ink-600">Draft (editable)</p>
                        <div className="flex items-center gap-1.5">
                          {draftPreview && (
                            <button
                              onClick={async () => {
                                const plain = draft.replace(/\|.*\|[\s\S]*?(?=\n\n|\n[^|]|$)/g, m => {
                                  const rows = m.split("\n").filter(r => r.trim() && !/^\|[\s\-|:]+\|$/.test(r.trim()));
                                  return rows.map(r => r.split("|").slice(1,-1).map(c=>c.trim()).join("\t")).join("\n");
                                });
                                try {
                                  await navigator.clipboard.writeText(plain);
                                } catch {
                                  await navigator.clipboard.writeText(draft);
                                }
                                setDraftCopied(true);
                                setTimeout(() => setDraftCopied(false), 2000);
                              }}
                              className="rounded border border-ink-200 bg-white px-2 py-0.5 text-[11px] text-ink-500 hover:border-[#0f3460] hover:text-[#0f3460] transition">
                              {draftCopied ? "Copied" : "Copy"}
                            </button>
                          )}
                          <div className="flex rounded border border-ink-200 overflow-hidden text-[11px]">
                            <button
                              onClick={() => setDraftPreview(false)}
                              className={`px-2 py-0.5 transition ${!draftPreview ? "bg-[#0f3460] text-white" : "bg-white text-ink-500 hover:bg-ink-50"}`}>
                              Edit
                            </button>
                            <button
                              onClick={() => setDraftPreview(true)}
                              className={`px-2 py-0.5 transition ${draftPreview ? "bg-[#0f3460] text-white" : "bg-white text-ink-500 hover:bg-ink-50"}`}>
                              Preview
                            </button>
                          </div>
                        </div>
                      </div>
                      {draftPreview ? (
                        <iframe
                          srcDoc={`<html><head><style>html,body{margin:0;overflow-x:hidden;overflow-y:auto}body{font-family:Calibri,Arial,sans-serif;font-size:12px;line-height:1.6;color:#1a1a1a;padding:8px 10px;white-space:pre-wrap}</style></head><body>${draftToHtml(draft)}</body></html>`}
                          sandbox="allow-same-origin"
                          className="w-full rounded border border-ink-200 bg-white"
                          style={{ height: 280 }}
                          title="초안 미리보기"
                        />
                      ) : (
                        <textarea value={draft} onChange={e => setDraft(e.target.value)}
                          className="mono w-full rounded border border-ink-200 bg-white px-2.5 py-2 text-[12px] leading-relaxed focus:border-[#0f3460] focus:outline-none resize-none overflow-y-auto"
                          style={{ height: 280 }}/>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => executeReply(aiTo, aiCc, false)}
                        className="flex-1 rounded border border-[#0f3460] py-2 text-[12px] font-semibold text-[#0f3460] hover:bg-[#0f3460] hover:text-white transition">
                        편집 후 발송
                      </button>
                      <button onClick={() => executeReply(aiTo, aiCc, true)}
                        className="flex-1 rounded bg-[#0f3460] py-2 text-[12px] font-semibold text-white hover:bg-[#0a2342] transition">
                        Send Now
                      </button>
                    </div>
                    {replyStatus && (
                      <p className={`text-[12px] ${replyStatus.startsWith("✓") ? "text-green-600" : "text-ink-600"}`}>{replyStatus}</p>
                    )}
                  </>
                ) : (
                  <div className="rounded border border-ink-100 bg-white p-4 text-center text-[12px] text-ink-400">
                    {!selected ? "Select an email first" : thread.length===0 ? "Loading thread…" : "Select tone and click Generate Draft"}
                  </div>
                )}

                {/* ── Summarize 섹션 ────────────────────────────── */}
                <div className="border-t border-ink-200 pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-ink-700">Summarize</span>
                    <button
                      onClick={generateSummary}
                      disabled={!selected || threadLoading || summaryLoading}
                      className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-semibold transition ${
                        !selected || threadLoading || summaryLoading
                          ? "cursor-not-allowed bg-ink-100 text-ink-400"
                          : "bg-[#0f3460] text-white hover:bg-[#0a2342]"
                      }`}>
                      {summaryLoading ? (
                        <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent inline-block"/>Summarizing…</>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Summarize
                        </>
                      )}
                    </button>
                  </div>
                  {summaryError && (
                    <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">{summaryError}</div>
                  )}
                  {!summaryLoading && !summaryError && (
                    <div className="rounded border border-ink-100 bg-white p-3 text-center text-[11px] text-ink-400">
                      {!selected ? "Select an email first" : thread.length === 0 ? "Loading thread…" : "Click Summarize to extract key points"}
                    </div>
                  )}
                </div>

                {/* ── 한국어 번역 섹션 ─────────────────────────── */}
                <div className="border-t border-ink-200 pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-ink-700">Translate</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => { setTransResult(""); setTransError(null); }}
                        disabled={!transResult && !transError}
                        className={`rounded px-3 py-1.5 text-[12px] font-semibold transition ${
                          !transResult && !transError
                            ? "cursor-not-allowed bg-ink-100 text-ink-400"
                            : "bg-[#0f3460] text-white hover:bg-[#0a2342]"
                        }`}>
                        Clear
                      </button>
                      <button
                        onClick={translateThread}
                        disabled={!selected || thread.length === 0 || transLoading}
                        className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-semibold transition ${
                          !selected || thread.length === 0 || transLoading
                            ? "cursor-not-allowed bg-ink-100 text-ink-400"
                            : "bg-[#0f3460] text-white hover:bg-[#0a2342]"
                        }`}>
                        {transLoading ? (
                          <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent inline-block"/>Translating…</>
                        ) : "Translate"}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-ink-500 shrink-0">Language</span>
                    <select value={transLang} onChange={e => { setTransLang(e.target.value); setTransResult(""); }}
                      className="flex-1 rounded border border-ink-200 px-2 py-1 text-[12px] focus:border-[#0f3460] focus:outline-none bg-white">
                      {["Korean","English","Chinese (Simplified)","Chinese (Traditional)","Japanese","German","French","Spanish","Vietnamese","Thai","Indonesian","Russian","Arabic"].map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                  {transError && (
                    <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">{transError}</div>
                  )}
                  {transResult ? (
                    <iframe
                      srcDoc={transDoc}
                      sandbox="allow-scripts allow-same-origin"
                      className="w-full rounded border border-ink-200"
                      style={{ height: transIframeH }}
                      onLoad={e => {
                        const frame = e.currentTarget;
                        const measure = () => {
                          try {
                            const doc = frame.contentDocument;
                            const h = Math.max(doc?.documentElement?.scrollHeight ?? 0, doc?.body?.scrollHeight ?? 0, 80) + 20;
                            setTransIframeH(h);
                          } catch {}
                        };
                        measure();
                        setTimeout(measure, 500);
                      }}
                    />
                  ) : (
                    !transLoading && (
                      <div className="rounded border border-ink-100 bg-white p-3 text-center text-[11px] text-ink-400">
                        {!selected ? "Select an email first" : "Click Translate to convert"}
                      </div>
                    )
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* ── Custom Confirm Dialog ─────────────────────────────────────────── */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[360px] rounded-xl border border-ink-200 bg-white shadow-2xl">
            <div className="px-5 pt-5 pb-3">
              <p className="text-[14px] text-ink-800 whitespace-pre-wrap leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3">
              <button
                onClick={() => { confirmDialog.resolve(false); setConfirmDialog(null); }}
                className="rounded border border-ink-200 px-4 py-1.5 text-[13px] text-ink-600 hover:bg-ink-50">
                취소
              </button>
              <button
                onClick={() => { confirmDialog.resolve(true); setConfirmDialog(null); }}
                className="rounded bg-red-500 px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-red-600">
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom Alert Dialog ───────────────────────────────────────────── */}
      {alertDialog !== null && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[360px] rounded-xl border border-ink-200 bg-white shadow-2xl">
            <div className="px-5 pt-5 pb-3">
              <p className="text-[14px] text-ink-800 whitespace-pre-wrap leading-relaxed">{alertDialog}</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3">
              <button
                onClick={() => setAlertDialog(null)}
                className="rounded bg-[#0f3460] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#0a2342]">
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
