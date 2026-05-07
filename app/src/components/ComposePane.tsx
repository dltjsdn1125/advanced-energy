"use client";

import { useEffect, useMemo, useState } from "react";
import { useBasket, type BasketItem } from "@/lib/basket";
import { useComposeTemplates } from "@/lib/composeTemplates";

// Outlook-style compose pane — mimics the Microsoft Outlook "New message"
// chrome (Send bar, To/Cc/Subject stack, body, attachments row). Supports
// three delivery paths so the user is never blocked by what mail client is
// configured:
//   1. "Outlook 웹에서 열기" — deeplink to outlook.office.com compose
//   2. "기본 메일 앱으로 보내기" — mailto: URI (works offline, size-limited)
//   3. ".eml 파일 다운로드" — standard RFC-822 file, opens in any mail client
// The email body is generated as both plain text (for mailto) and HTML (for
// the .eml attachment) from the saved BasketItem snapshots.

interface Props {
  onClose: () => void;
}

function formatItemText(item: BasketItem): string {
  const lines: string[] = [];
  lines.push(`■ ${item.model}`);
  if (item.category || item.lineage || item.section) {
    const tag = [item.category, item.lineage, item.section].filter(Boolean).join(" · ");
    if (tag) lines.push(`  구분: ${tag}`);
  }
  if (item.watts.length) lines.push(`  정격 전력: ${item.watts.slice(0, 4).join(", ")}`);
  if (item.volts.length) lines.push(`  출력 전압: ${item.volts.slice(0, 8).join(", ")}`);
  if (item.input) lines.push(`  입력: ${item.input}`);
  if (item.configuredSKU) {
    lines.push(`  선정 모델번호: ${item.configuredSKU}${item.orderingPage ? `  (카탈로그 p.${item.orderingPage})` : ""}`);
  }
  if (item.configuredHeaders && item.configuredRow) {
    const pairs = item.configuredHeaders
      .map((h, i) => (h && item.configuredRow![i] ? `${h}: ${item.configuredRow![i]}` : null))
      .filter(Boolean)
      .slice(0, 10);
    if (pairs.length) lines.push(`  구성: ${pairs.join(" / ")}`);
  }
  if (item.note) lines.push(`  메모: ${item.note}`);
  return lines.join("\n");
}

function buildPlainTextBody(
  items: BasketItem[],
  intro: string,
  signature?: string,
): string {
  const head = intro.trim() ? intro.trim() + "\n\n" : "";
  const body = items.map(formatItemText).join("\n\n");
  const sig = signature && signature.trim() ? "\n\n" + signature.trim() : "";
  const foot =
    "\n\n" +
    "— —\n" +
    "본 제안은 Advanced Energy Embedded Power Catalogue 2026 의 공개 스펙을 기반으로 한 후보 추천입니다. 실제 구매 결정 전 AE FAE 와 상세 사양·리드타임을 최종 확인해 주세요.";
  return head + body + sig + foot;
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtmlBody(
  items: BasketItem[],
  intro: string,
  signature?: string,
): string {
  const rows = items
    .map((it) => {
      const tag = [it.category, it.lineage, it.section]
        .filter((x): x is string => !!x)
        .map(htmlEscape)
        .join(" · ");
      const cfgRow =
        it.configuredHeaders && it.configuredRow
          ? `<table cellspacing="0" cellpadding="4" style="border-collapse:collapse;font:12px/1.4 Segoe UI,Geist,sans-serif;margin-top:4px;">
              <tr>${it.configuredHeaders.map((h) => `<th style="border:1px solid #ddd;background:#f6f6f6;text-align:left;font-weight:600;">${htmlEscape(h)}</th>`).join("")}</tr>
              <tr>${it.configuredRow.map((c) => `<td style="border:1px solid #ddd;">${htmlEscape(c || "—")}</td>`).join("")}</tr>
            </table>`
          : "";
      return `<div style="margin:0 0 16px 0;padding:10px 12px;border:1px solid #e5e5e5;border-radius:6px;">
        <div style="font:600 14px/1.3 Segoe UI,Geist,sans-serif;color:#111;">${htmlEscape(it.model)}</div>
        ${tag ? `<div style="font:12px/1.4 Segoe UI,Geist,sans-serif;color:#555;margin-top:2px;">${tag}</div>` : ""}
        <table cellspacing="0" cellpadding="2" style="margin-top:6px;font:12px/1.5 Segoe UI,Geist,sans-serif;color:#222;">
          ${it.watts.length ? `<tr><td style="color:#777;padding-right:10px;">정격 전력</td><td>${htmlEscape(it.watts.slice(0, 4).join(", "))}</td></tr>` : ""}
          ${it.volts.length ? `<tr><td style="color:#777;padding-right:10px;">출력 전압</td><td>${htmlEscape(it.volts.slice(0, 8).join(", "))}</td></tr>` : ""}
          ${it.input ? `<tr><td style="color:#777;padding-right:10px;">입력</td><td>${htmlEscape(it.input)}</td></tr>` : ""}
          ${it.configuredSKU ? `<tr><td style="color:#777;padding-right:10px;">선정 모델번호</td><td style="font-weight:600;">${htmlEscape(it.configuredSKU)}${it.orderingPage ? ` <span style="color:#777;">(카탈로그 p.${it.orderingPage})</span>` : ""}</td></tr>` : ""}
          ${it.note ? `<tr><td style="color:#777;padding-right:10px;">메모</td><td>${htmlEscape(it.note)}</td></tr>` : ""}
        </table>
        ${cfgRow}
      </div>`;
    })
    .join("\n");

  const sigBlock = signature && signature.trim()
    ? `<div style="margin:18px 0 0 0;white-space:pre-wrap;color:#333;">${htmlEscape(signature.trim())}</div>`
    : "";

  return `<div style="font:13px/1.6 Segoe UI,Geist,sans-serif;color:#111;max-width:720px;">
    ${intro.trim() ? `<div style="margin:0 0 16px 0;white-space:pre-wrap;">${htmlEscape(intro.trim())}</div>` : ""}
    ${rows}
    ${sigBlock}
    <hr style="border:0;border-top:1px solid #eee;margin:18px 0;" />
    <div style="font-size:11px;color:#777;">본 제안은 Advanced Energy Embedded Power Catalogue 2026 의 공개 스펙을 기반으로 한 후보 추천입니다. 실제 구매 결정 전 AE FAE 와 상세 사양·리드타임을 최종 확인해 주세요.</div>
  </div>`;
}

// RFC-822 .eml builder — minimal multipart/alternative with plain + HTML bodies.
function buildEml({
  to,
  cc,
  subject,
  plain,
  html,
}: {
  to: string;
  cc: string;
  subject: string;
  plain: string;
  html: string;
}): string {
  const boundary = "----AE2026Boundary" + Math.random().toString(36).slice(2);
  const date = new Date().toUTCString();
  const encodedSubject = "=?UTF-8?B?" + btoa(unescape(encodeURIComponent(subject))) + "?=";
  const headers = [
    `To: ${to}`,
    cc ? `Cc: ${cc}` : null,
    `Subject: ${encodedSubject}`,
    `Date: ${date}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]
    .filter(Boolean)
    .join("\r\n");

  const plainPart = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(plain))),
  ].join("\r\n");

  const htmlPart = [
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(html))),
  ].join("\r\n");

  return [headers, "", plainPart, htmlPart, `--${boundary}--`, ""].join("\r\n");
}

// mailto: 와 Outlook 딥링크 모두 URL 쿼리스트링을 사용하지만, `URLSearchParams`
// 는 공백을 `+` 로 인코딩한다. 메일 클라이언트(Outlook · Apple Mail · Gmail)
// 는 그 `+` 를 공백이 아닌 리터럴 '+' 로 해석하므로 제목·본문이 깨진다.
// 반드시 `encodeURIComponent` 로 수동 인코딩(%20 사용)해야 올바로 열린다.
function encodeQS(params: Record<string, string>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== "" && v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
}

// Windows 11 에서 기본 메일 앱이 설정되지 않은 경우가 많고, 그 경우 브라우저는
// `mailto:` 클릭을 아무 알림 없이 무시한다. 따라서 호출 후 일정 시간이 지나도
// 페이지가 살아있으면 "아무 일도 없었다" 로 간주하고 대체 수단을 제안한다.
async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallthrough to execCommand */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

type ToastKind = "info" | "ok" | "warn" | "err";

export default function ComposePane({ onClose }: Props) {
  const { items, remove, clear, updateNote } = useBasket();
  const { templates, save: saveTemplate, remove: removeTemplate, isBuiltIn } =
    useComposeTemplates();
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  // 초기값은 첫 번째 (기본) 템플릿에서 가져와서 단일 소스-of-truth 유지.
  const defaultTpl = templates[0];
  const [subject, setSubject] = useState(defaultTpl?.subject ?? "AE 2026 제품 선정 제안");
  const [intro, setIntro] = useState(defaultTpl?.intro ?? "");
  const [signature, setSignature] = useState(defaultTpl?.signature ?? "");
  const [activeTplId, setActiveTplId] = useState<string | null>(defaultTpl?.id ?? null);
  const [toast, setToast] = useState<{ kind: ToastKind; msg: string } | null>(null);

  // Esc 닫기 — Outlook 과 동일한 단축키 동작.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const plainBody = useMemo(
    () => buildPlainTextBody(items, intro, signature),
    [items, intro, signature],
  );
  const htmlBody = useMemo(
    () => buildHtmlBody(items, intro, signature),
    [items, intro, signature],
  );

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setSubject(t.subject);
    setIntro(t.intro);
    setSignature(t.signature ?? "");
    setActiveTplId(t.id);
    showToast("ok", `"${t.name}" 템플릿을 적용했습니다.`);
  }

  function saveCurrentAsTemplate() {
    const name = window.prompt(
      "템플릿 이름을 입력하세요. 같은 이름이 이미 있으면 덮어씁니다.",
      activeTplId && !isBuiltIn(activeTplId)
        ? templates.find((t) => t.id === activeTplId)?.name ?? ""
        : "",
    );
    if (name === null) return;
    const saved = saveTemplate(name, subject, intro, signature);
    setActiveTplId(saved.id);
    showToast("ok", `템플릿 "${saved.name}" 을 저장했습니다.`);
  }

  function deleteActiveTemplate() {
    if (!activeTplId || isBuiltIn(activeTplId)) return;
    const t = templates.find((x) => x.id === activeTplId);
    if (!t) return;
    if (!window.confirm(`템플릿 "${t.name}" 을 삭제할까요?`)) return;
    removeTemplate(t.id);
    setActiveTplId(null);
    showToast("ok", `템플릿 "${t.name}" 을 삭제했습니다.`);
  }

  const canSend = items.length > 0;

  function showToast(kind: ToastKind, msg: string) {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 4500);
  }

  async function sendMailto() {
    if (!canSend) return;
    // Windows 에서 브라우저가 mailto 를 OS 쉘로 넘길 때 URL 총 길이는 약
    // 2,000자로 제한된다. 본문이 그보다 길면 쉘이 요청을 버려서 Outlook 이
    // 아예 열리지 않는 현상이 자주 발생한다. 긴 본문은 클립보드에 넣고
    // Outlook 은 To/Subject/짧은 안내문만 달아서 호출해야 안정적이다.
    const fullUrl = `mailto:${encodeURIComponent(to)}?${encodeQS({ subject, cc, body: plainBody })}`;

    if (fullUrl.length <= 1900) {
      window.location.href = fullUrl;
      showToast("ok", "로컬 Outlook 으로 메일 창을 열었습니다.");
      return;
    }

    // 본문 자동 복사 → 짧은 mailto 로 Outlook 만 깨우기
    const copied = await copyTextToClipboard(plainBody);
    const hint =
      "※ 본문이 길어 Outlook 창에 자동으로 넣지 못했습니다. 이 창에서 Ctrl+V 로 붙여넣으세요. (본문은 클립보드에 복사되어 있습니다)";
    const shortUrl = `mailto:${encodeURIComponent(to)}?${encodeQS({ subject, cc, body: hint })}`;
    window.location.href = shortUrl;
    showToast(
      copied ? "warn" : "err",
      copied
        ? "본문이 길어 Outlook 은 제목·수신자만 채워 열었습니다. 본문은 클립보드에 복사됐으니 새 창에서 Ctrl+V 로 붙여넣으세요."
        : "본문이 길어 mailto 로 보낼 수 없고 클립보드 복사도 실패했습니다. [.eml 다운로드] 를 이용해 주세요.",
    );
  }

  function downloadEml() {
    if (!canSend) return;
    try {
      const eml = buildEml({ to, cc, subject, plain: plainBody, html: htmlBody });
      const blob = new Blob([eml], { type: "message/rfc822;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeSubject =
        subject.replace(/[^\w\u3131-\uD79D-]+/g, "_").slice(0, 60) || "ae-proposal";
      a.download = `${safeSubject}.eml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("ok", ".eml 파일을 다운로드했습니다 — 더블클릭하면 Outlook 앱에서 열립니다.");
    } catch (e) {
      showToast("err", `.eml 생성 실패: ${(e as Error).message}`);
    }
  }

  async function copyBody() {
    if (!canSend) return;
    const header =
      `받는 사람: ${to || "(미입력)"}\n` +
      (cc ? `참조: ${cc}\n` : "") +
      `제목: ${subject}\n` +
      "\n";
    const ok = await copyTextToClipboard(header + plainBody);
    showToast(
      ok ? "ok" : "err",
      ok
        ? "메일 머리말 + 본문을 클립보드에 복사했습니다. 메일 앱에 붙여넣으세요."
        : "클립보드 복사에 실패했습니다. 브라우저가 clipboard 권한을 허용하는지 확인하세요.",
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/55"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed right-0 top-0 z-50 flex h-[100dvh] w-full max-w-[920px] flex-col bg-white shadow-card"
        role="dialog"
        aria-labelledby="compose-title"
      >
        {/* Title bar — Outlook chrome */}
        <div className="flex items-center justify-between gap-3 border-b border-ink-200 bg-[#0078D4] px-5 py-2 text-white">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M22 6v12a2 2 0 0 1-2 2H11V4h9a2 2 0 0 1 2 2zM9 4v16H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5zm-2 5H4v2h3V9zm0 3H4v2h3v-2z" />
            </svg>
            <span id="compose-title" className="text-[14px] font-semibold">
              새 메일 — AE 제품 제안
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded px-2 py-0.5 text-[18px] leading-none hover:bg-white/15"
            aria-label="Close compose"
          >
            ×
          </button>
        </div>

        {/* Send bar — 로컬 Outlook 데스크톱 전용 경로만 제공 */}
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 bg-[#F3F2F1] px-5 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={sendMailto}
              disabled={!canSend}
              className="flex items-center gap-1.5 rounded-sm bg-[#0078D4] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#106EBE] disabled:cursor-not-allowed disabled:opacity-40"
              title="로컬 Outlook 데스크톱으로 새 메일 작성 창 열기 (mailto: 프로토콜)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M3 21V3l18 9-18 9z" />
              </svg>
              Outlook 으로 보내기
            </button>
            <button
              onClick={downloadEml}
              disabled={!canSend}
              className="rounded-sm border border-ink-200 bg-white px-3 py-1.5 text-[13px] font-medium text-black hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
              title="HTML 표 서식이 들어간 .eml 파일을 다운로드합니다. 파일을 더블클릭하면 Outlook 데스크톱에서 열립니다."
            >
              HTML 서식으로 (.eml)
            </button>
            <button
              onClick={copyBody}
              disabled={!canSend}
              className="rounded-sm border border-ink-200 bg-white px-3 py-1.5 text-[13px] font-medium text-black hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
              title="메일 머리말 + 본문을 클립보드에 복사 — Outlook 창에 직접 붙여넣을 때 사용"
            >
              본문 복사
            </button>
          </div>
          <div className="ml-auto mono text-[11px] text-ink-500">
            로컬 Outlook 전용 · {items.length.toLocaleString()}개 선택
          </div>
        </div>

        {/* Templates bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 bg-white px-5 py-2">
          <span className="label shrink-0">템플릿</span>
          <select
            value={activeTplId ?? ""}
            onChange={(e) => {
              if (e.target.value) applyTemplate(e.target.value);
            }}
            className="mono min-w-0 flex-1 rounded-sm border border-ink-200 bg-white px-2 py-1 text-[12px] text-black outline-none focus:border-black"
          >
            <option value="">— 선택 —</option>
            <optgroup label="기본 내장 (50종)">
              {templates.filter((t) => isBuiltIn(t.id)).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
            {templates.filter((t) => !isBuiltIn(t.id)).length > 0 && (
              <optgroup label="내 저장 템플릿">
                {templates.filter((t) => !isBuiltIn(t.id)).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={saveCurrentAsTemplate}
              className="mono rounded-pill border border-black bg-white px-2.5 py-0.5 text-[12px] font-medium text-black hover:bg-lime"
              title="현재 제목·인사말·서명을 새 템플릿으로 저장하거나 같은 이름을 덮어쓰기"
            >
              ＋ 저장
            </button>
            {activeTplId && !isBuiltIn(activeTplId) && (
              <button
                onClick={deleteActiveTemplate}
                className="mono rounded-pill border border-ink-200 bg-white px-2.5 py-0.5 text-[12px] text-ink-700 hover:border-black hover:text-black"
                title="선택된 사용자 템플릿 삭제"
              >
                삭제
              </button>
            )}
          </div>
        </div>

        {toast && (
          <div
            role="status"
            className={`border-b px-5 py-2 text-[12.5px] ${
              toast.kind === "ok"
                ? "border-lime/50 bg-lime-soft text-black"
                : toast.kind === "warn"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : toast.kind === "err"
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-ink-200 bg-ink-50 text-black"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {/* Headers */}
        <div className="flex flex-col border-b border-ink-200 bg-white px-5 py-3 text-[13px]">
          <label className="flex items-center gap-3 border-b border-ink-100 py-1.5">
            <span className="mono w-16 shrink-0 text-[12px] font-semibold text-ink-500">받는 사람</span>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="customer@example.com"
              className="min-w-0 flex-1 bg-transparent text-black outline-none placeholder:text-ink-300"
              type="email"
            />
          </label>
          <label className="flex items-center gap-3 border-b border-ink-100 py-1.5">
            <span className="mono w-16 shrink-0 text-[12px] font-semibold text-ink-500">참조</span>
            <input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="내부 팀원 등 (선택)"
              className="min-w-0 flex-1 bg-transparent text-black outline-none placeholder:text-ink-300"
              type="email"
            />
          </label>
          <label className="flex items-center gap-3 py-1.5">
            <span className="mono w-16 shrink-0 text-[12px] font-semibold text-ink-500">제목</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-black outline-none"
            />
          </label>
        </div>

        {/* Body: intro + attached items preview */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="rounded-card border border-dashed border-ink-200 bg-white p-10 text-center">
              <p className="text-[14px] font-medium text-black">저장된 선택이 없습니다</p>
              <p className="mt-1 text-[13px] text-ink-500">
                제품 상세 또는 오더링 구성 화면에서 <span className="mono">＋ 선택 저장</span> 을 눌러
                여기에 후보를 담은 뒤 이메일로 전송하세요.
              </p>
            </div>
          ) : (
            <>
              <label className="label mb-1 block">인사말 · 도입</label>
              <textarea
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                rows={5}
                className="mb-3 w-full resize-y rounded-sm border border-ink-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-black outline-none focus:border-black"
                placeholder="고객에게 보낼 인사말·컨텍스트를 입력하세요. 템플릿에 {{고객사명}} 같은 치환자를 넣어두고 직접 바꿔 쓰세요."
              />

              <label className="label mb-1 block">서명 (선택)</label>
              <textarea
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                rows={3}
                className="mb-4 w-full resize-y rounded-sm border border-ink-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-black outline-none focus:border-black"
                placeholder={"예) \n홍길동 / AE 영업팀\n010-0000-0000 / hong@example.com"}
              />

              <div className="mb-2 flex items-center justify-between">
                <span className="label">첨부 제품 ({items.length})</span>
                <button
                  onClick={() => {
                    if (confirm("저장된 선택을 모두 비우시겠습니까?")) clear();
                  }}
                  className="mono text-[11px] text-ink-500 underline underline-offset-2 hover:text-black"
                >
                  전체 비우기
                </button>
              </div>

              <div className="grid gap-2.5">
                {items.map((it) => (
                  <article
                    key={it.modelKey}
                    className="rounded-card border border-ink-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mono text-[14px] font-semibold text-black">{it.model}</div>
                        <div className="mono mt-0.5 text-[11px] text-ink-500">
                          {[it.category, it.lineage, it.section].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                      <button
                        onClick={() => remove(it.modelKey)}
                        className="mono shrink-0 rounded-pill border border-ink-200 bg-white px-2.5 py-0.5 text-[11px] text-ink-700 hover:border-black hover:text-black"
                        title="이 선택 제거"
                      >
                        제거
                      </button>
                    </div>

                    <div className="mono mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-[12px] text-black sm:grid-cols-2">
                      {it.watts.length > 0 && (
                        <div>
                          <span className="text-ink-500">정격 전력 · </span>
                          {it.watts.slice(0, 4).join(", ")}
                        </div>
                      )}
                      {it.volts.length > 0 && (
                        <div>
                          <span className="text-ink-500">출력 전압 · </span>
                          {it.volts.slice(0, 8).join(", ")}
                        </div>
                      )}
                      {it.input && (
                        <div>
                          <span className="text-ink-500">입력 · </span>
                          {it.input}
                        </div>
                      )}
                      {it.configuredSKU && (
                        <div className="font-semibold">
                          <span className="text-ink-500">선정 P/N · </span>
                          {it.configuredSKU}
                          {it.orderingPage ? (
                            <span className="ml-1 text-ink-500">(p.{it.orderingPage})</span>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <label className="mt-2 flex items-start gap-2">
                      <span className="label shrink-0 pt-0.5">메모</span>
                      <input
                        value={it.note ?? ""}
                        onChange={(e) => updateNote(it.modelKey, e.target.value)}
                        placeholder="이 모델에 대한 고객 맞춤 코멘트 (선택)"
                        className="mono min-w-0 flex-1 rounded-sm border border-ink-100 bg-white px-2 py-1 text-[12px] text-black outline-none focus:border-black"
                      />
                    </label>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
