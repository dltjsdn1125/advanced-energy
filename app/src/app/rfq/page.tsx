"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { catalog } from "@/lib/data";
import type { Model } from "@/lib/types";
import {
  type CustomerInfo,
  type EmailPreset,
  type OutputChannel,
  type RfqRecord,
  type RfqRevision,
  type SmpsSpec,
  addEmailPreset,
  addRevision,
  deleteEmailPreset,
  deleteRevision,
  updateEmailPreset,
  updateRevisionComment,
  buildMailto,
  createRecord,
  downloadCsv,
  downloadXls,
  emptyChannel,
  emptyCustomer,
  emptySpec,
  exportRecordsJson,
  importRecordsJson,
  loadEmailPresets,
  loadEmailSubject,
  loadEmailTemplate,
  loadRecords,
  saveEmailSubject,
  saveEmailTemplate,
  saveRecords,
  substituteTemplate,
  APPLICATION_OPTIONS,
  CERT_OPTIONS,
  COOLING_OPTIONS,
  DEFAULT_EMAIL_TEMPLATE,
  DEFAULT_EMAIL_SUBJECT,
  FEATURE_OPTIONS,
  FORM_FACTOR_OPTIONS,
  INDUSTRY_OPTIONS,
  INPUT_FREQ_OPTIONS,
  INPUT_PHASE_OPTIONS,
  INPUT_VOLTAGE_OPTIONS,
  MPQ_QUANTITY_OPTIONS,
  OUTPUT_CURRENT_OPTIONS,
  OUTPUT_POWER_OPTIONS,
  OUTPUT_VOLTAGE_OPTIONS,
  PROTECTION_OPTIONS,
  REGULATION_OPTIONS,
  RIPPLE_OPTIONS,
  SAMPLE_OPTIONS,
  TOTAL_POWER_OPTIONS,
} from "@/lib/rfq";

function cx(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

// ── 아이콘 라이브러리 (Fluent UI 스타일 / 1.2px 스트로크) ───────────────────
function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  const s = size;
  const stroke = "currentColor";
  const sw = 1.3;
  switch (name) {
    case "draft":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M3.5 2h5.5L13 6v7.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-11A.5.5 0 0 1 3.5 2z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>
        <path d="M9 2v4h4M5.5 9h5M5.5 11.5h3" stroke={stroke} strokeWidth={sw} strokeLinecap="round"/>
      </svg>;
    case "trash":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M5 4.5l.5 8.5a1 1 0 0 0 1 .9h3a1 1 0 0 0 1-.9l.5-8.5M7 7v4M9 7v4" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>;
    case "save":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M2.5 2.5h8.5l3 3v8a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>
        <path d="M5 2.5v4h6v-4M5 9.5h6v4.5h-6z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>
      </svg>;
    case "plus":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M8 3v10M3 8h10" stroke={stroke} strokeWidth="1.7" strokeLinecap="round"/>
      </svg>;
    case "refresh":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M2.5 8a5.5 5.5 0 0 1 9.5-3.8M13.5 8a5.5 5.5 0 0 1-9.5 3.8" stroke={stroke} strokeWidth={sw} strokeLinecap="round"/>
        <path d="M12 2v3h-3M4 14v-3h3" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>;
    case "folder":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M2 5a1 1 0 0 1 1-1h3l1.5 1.5h5.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>
      </svg>;
    case "chevron-down":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M4 6l4 4 4-4" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>;
    case "chevron-up":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M4 10l4-4 4 4" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>;
    case "edit":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M11 2l3 3-8.5 8.5H2.5V11L11 2z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>
      </svg>;
    case "x":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke={stroke} strokeWidth="1.6" strokeLinecap="round"/>
      </svg>;
    case "paperclip":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M13 6L7 12a2.5 2.5 0 0 1-3.5-3.5L9.5 2.5a3.5 3.5 0 0 1 5 5L8 14a4.5 4.5 0 0 1-6.4-6.4" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>;
    case "image":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="2" y="3" width="12" height="10" rx="1" stroke={stroke} strokeWidth={sw}/>
        <circle cx="5.5" cy="6.5" r="1" stroke={stroke} strokeWidth={sw}/>
        <path d="M2 11l3-3 3 2.5 2.5-2 3.5 3" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>;
    case "link":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M7 9.5l1.5-1.5M5.5 11l-1 1a2.5 2.5 0 0 1-3.5-3.5l2.5-2.5M11 5l1-1a2.5 2.5 0 0 1 3.5 3.5l-2.5 2.5" stroke={stroke} strokeWidth={sw} strokeLinecap="round"/>
      </svg>;
    case "doc":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M4 2h5l3 3v9a.5.5 0 0 1-.5.5h-7.5a.5.5 0 0 1-.5-.5V2.5A.5.5 0 0 1 4 2z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>
        <path d="M9 2v3h3M5.5 9h5M5.5 11h4" stroke={stroke} strokeWidth={sw} strokeLinecap="round"/>
      </svg>;
    case "info":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="6" stroke={stroke} strokeWidth={sw}/>
        <path d="M8 7.5v3.5M8 5v.01" stroke={stroke} strokeWidth="1.6" strokeLinecap="round"/>
      </svg>;
    case "external":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M9 2.5h4.5V7M13.5 2.5L8 8M7 2.5H3a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V9" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>;
    case "align-left":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M2 4h12M2 8h8M2 12h12" stroke={stroke} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>;
    case "align-center":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M2 4h12M4 8h8M2 12h12" stroke={stroke} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>;
    case "align-right":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M2 4h12M6 8h8M2 12h12" stroke={stroke} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>;
    case "list-bullet":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="3" cy="4.5" r="0.9" fill={stroke}/>
        <circle cx="3" cy="8" r="0.9" fill={stroke}/>
        <circle cx="3" cy="11.5" r="0.9" fill={stroke}/>
        <path d="M6 4.5h8M6 8h8M6 11.5h8" stroke={stroke} strokeWidth="1.4" strokeLinecap="round"/>
      </svg>;
    case "list-number":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M6 4.5h8M6 8h8M6 11.5h8" stroke={stroke} strokeWidth="1.4" strokeLinecap="round"/>
        <text x="1.5" y="5.6" fontSize="4" fill={stroke} fontFamily="Arial">1</text>
        <text x="1.5" y="9.1" fontSize="4" fill={stroke} fontFamily="Arial">2</text>
        <text x="1.5" y="12.6" fontSize="4" fill={stroke} fontFamily="Arial">3</text>
      </svg>;
    case "quote":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M3 5h2v3a3 3 0 0 1-3 3M9 5h2v3a3 3 0 0 1-3 3" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>;
    case "clear-format":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M4 3h9M9 3l-3 6M2 13l11-11" stroke={stroke} strokeWidth={sw} strokeLinecap="round"/>
      </svg>;
    case "send":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M14 2L2 8l5 1.5L14 2zM14 2L8 14l-1-4.5L14 2z" fill={stroke}/>
      </svg>;
    case "arrow-right":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M3 8h10M9 4l4 4-4 4" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>;
    case "arrow-left":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M13 8H3M7 4L3 8l4 4" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>;
    case "check":
      return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M3 8.5L6.5 12L13 5" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>;
    default: return null;
  }
}
type IconName =
  | "draft" | "trash" | "save" | "plus" | "refresh" | "folder"
  | "chevron-down" | "chevron-up" | "edit" | "x" | "paperclip"
  | "image" | "link" | "doc" | "info" | "external"
  | "align-left" | "align-center" | "align-right"
  | "list-bullet" | "list-number" | "quote" | "clear-format"
  | "send" | "arrow-right" | "arrow-left" | "check";

// ── Cell-level input / select ─────────────────────────────────────────────────

function CI({
  value, onChange, placeholder = "", type = "text",
}: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="mono w-full bg-transparent text-[14px] text-black placeholder:text-zinc-400 focus:outline-none" />
  );
}

function CS({
  value, onChange, options, placeholder = "Select", allowCustom = true,
}: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; allowCustom?: boolean }) {
  const [custom, setCustom] = useState(false);
  const known = options.includes(value) || value === "";
  const showInput = custom || (!known && value !== "");
  if (showInput) {
    return (
      <div className="flex gap-1.5">
        <input autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder="직접 입력…"
          className="mono w-full bg-transparent text-[14px] text-black placeholder:text-zinc-400 focus:outline-none" />
        <button type="button" onClick={() => { setCustom(false); onChange(""); }}
          className="mono shrink-0 text-[11px] text-black underline">↩</button>
      </div>
    );
  }
  // 셀 전체를 연한 노란색으로 채움 (negative margin으로 td 패딩 상쇄)
  return (
    <div className="-mx-3 -my-2 px-3 py-2" style={{ background: "#fefce8" }}>
      <select value={value}
        onChange={(e) => { if (allowCustom && e.target.value === "__custom__") { setCustom(true); onChange(""); } else onChange(e.target.value); }}
        className="mono w-full cursor-pointer bg-transparent text-[14px] text-black focus:outline-none">
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        {allowCustom && <option value="__custom__">＋ 직접 입력…</option>}
      </select>
    </div>
  );
}

// ── Table cell style constants ────────────────────────────────────────────────

const LC = "border-b border-r border-zinc-300 bg-zinc-100 w-[120px] px-3 py-2 align-middle"; // label cell
const VC = "border-b border-zinc-300 px-3 py-2 align-middle";                                 // value cell
const LC2 = "border-b border-r border-l border-zinc-300 bg-zinc-100 w-[120px] px-3 py-2 align-middle"; // middle label cell

function LabelSpan({ children }: { children: React.ReactNode }) {
  return <span className="mono whitespace-nowrap text-[12px] font-semibold text-black">{children}</span>;
}

// 2-field row
function R2({ l1, c1, l2, c2 }: { l1: string; c1: React.ReactNode; l2?: string; c2?: React.ReactNode }) {
  return (
    <tr>
      <td className={LC}><LabelSpan>{l1}</LabelSpan></td>
      <td className={cx(VC, l2 !== undefined ? "border-r border-zinc-300" : "")} colSpan={l2 === undefined ? 3 : 1}>{c1}</td>
      {l2 !== undefined && <>
        <td className={LC2}><LabelSpan>{l2}</LabelSpan></td>
        <td className={VC}>{c2}</td>
      </>}
    </tr>
  );
}

// Full-width row
function RF({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <tr>
      <td className={LC}><LabelSpan>{l}</LabelSpan></td>
      <td colSpan={3} className={VC}>{children}</td>
    </tr>
  );
}

// Toggle chips
function Chips({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 py-0.5">
      {options.map((opt) => (
        <button key={opt} type="button"
          onClick={() => onChange(selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt])}
          className={cx("mono rounded-pill border px-2.5 py-0.5 text-[12px] transition",
            selected.includes(opt) ? "border-black bg-black text-white" : "border-zinc-300 bg-white text-black hover:border-black")}>
          {opt}
        </button>
      ))}
    </div>
  );
}

// Table section wrapper
function FT({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-x-auto", className)}>
      <table className="rfq-form-table w-full min-w-[520px] border-collapse bg-white text-left">
        <thead>
          <tr>
            <th colSpan={4}
              className="mono border-b border-zinc-300 bg-zinc-200 px-4 py-2 text-left text-[12px] font-bold uppercase tracking-widest text-black">
              {title}
            </th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// ── Revision row ──────────────────────────────────────────────────────────────

function RevRow({ rev, onLoad, onPdf, onXls, onCsv, onMail, onDelete, onSaveComment }: {
  rev: RfqRevision;
  onLoad: () => void; onPdf: () => void; onXls: () => void; onCsv: () => void; onMail: () => void;
  onDelete: () => void; onSaveComment: (comment: string) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(rev.comment);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      {/* 상단: Rev 번호 + 날짜 + 코멘트 편집 */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono rounded-pill border border-zinc-400 px-2 py-0.5 text-[11px] font-bold text-black">Rev.{rev.rev}</span>
          <span className="mono text-[12px] text-black">{rev.savedAt.replace("T", " ").slice(0, 16)}</span>
          {editMode ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { onSaveComment(draft); setEditMode(false); } if (e.key === "Escape") { setDraft(rev.comment); setEditMode(false); } }}
              placeholder="코멘트 입력…"
              className="mono min-w-[140px] flex-1 rounded border border-zinc-300 px-2 py-0.5 text-[12px] text-black focus:border-black focus:outline-none"
            />
          ) : (
            rev.comment && <span className="mono text-[12px] text-black">— {rev.comment}</span>
          )}
        </div>
        <p className="mono mt-1 text-[12px] text-black">
          {rev.customer.company || "(미입력)"} · {rev.customer.customerProject || "—"} · {rev.spec.totalPower || "—"} · {rev.spec.formFactor || "—"}
        </p>
      </div>
      {/* 하단: 액션 버튼 */}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onLoad} className="mono rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[11px] text-black hover:border-black">불러오기</button>
        <button type="button" onClick={onXls} className="mono rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[11px] text-black hover:border-black">Excel</button>
        <button type="button" onClick={onCsv} className="mono rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[11px] text-black hover:border-black">CSV</button>
        <button type="button" onClick={onPdf} className="mono rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[11px] text-black hover:border-black">PDF</button>
        <button type="button" onClick={onMail} className="mono rounded-lg border border-lime bg-lime px-3 py-1.5 text-[11px] font-semibold text-black hover:bg-black hover:text-lime">메일</button>
        {/* 코멘트 수정 */}
        {editMode ? (
          <>
            <button type="button" onClick={() => { onSaveComment(draft); setEditMode(false); }}
              className="mono rounded-lg border border-black bg-black px-3 py-1.5 text-[11px] text-white hover:bg-zinc-700">저장</button>
            <button type="button" onClick={() => { setDraft(rev.comment); setEditMode(false); }}
              className="mono rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[11px] text-black">취소</button>
          </>
        ) : (
          <button type="button" onClick={() => setEditMode(true)}
            className="mono rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[11px] text-black hover:border-black">수정</button>
        )}
        {/* 삭제 */}
        <button type="button" onClick={onDelete}
          className="mono rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[11px] text-red-500 hover:border-red-400 hover:bg-red-50">삭제</button>
      </div>
    </div>
  );
}

// ── Recommendation engine ─────────────────────────────────────────────────────

function hasKW(m: Model, kw: string) {
  return (m.searchText + " " + m.contextLines.join(" ")).toLowerCase().includes(kw.toLowerCase());
}

function recommendModels(spec: SmpsSpec): Model[] {
  // ── 의미있는 사양이 하나라도 입력돼야 추천 시작 ───────────────────
  const hasCriteria =
    spec.formFactor.trim() !== "" ||
    spec.totalPower.trim() !== "" ||
    spec.certifications.length > 0 ||
    spec.features.length > 0 ||
    spec.protections.length > 0 ||
    spec.application.trim() !== "" ||
    spec.cooling.trim() !== "" ||
    spec.inputVoltageRange.trim() !== "" ||
    spec.inputPhase.trim() !== "" ||
    spec.outputChannels.some((ch) => ch.voltage || ch.current || ch.power);

  if (!hasCriteria) return [];

  let candidates = catalog.models;

  // ── 폼팩터 → lineage 필터 ─────────────────────────────────────────
  const ff = spec.formFactor;
  const co = spec.cooling;
  if (ff.includes("Modular") || ff.includes("모듈"))
    candidates = candidates.filter((m) => m.lineage === "MODULAR");
  else if (ff.includes("Open Frame") || ff.includes("오픈"))
    candidates = candidates.filter((m) => m.lineage === "OPEN FRAME");
  else if (ff.includes("Rack") || ff.includes("U-Type"))
    candidates = candidates.filter((m) => m.lineage === "RACKS");
  else if (ff.includes("Fanless") || ff.includes("무팬") || co.includes("무팬") || co.includes("Fanless") || co.includes("전도"))
    candidates = candidates.filter((m) => m.lineage === "FANLESS/CONDUCTION COOLED");
  else if (ff.includes("DIN"))
    candidates = candidates.filter((m) => hasKW(m, "din"));
  else if (ff.includes("Desktop") || ff.includes("Adapter"))
    candidates = candidates.filter((m) => m.lineage === "ADAPTERS" || m.lineage === "BENCH");

  // ── 인증 필터 ─────────────────────────────────────────────────────
  if (spec.certifications.includes("IEC 60601-1 (의료)"))
    candidates = candidates.filter((m) => m.lineage === "MODULAR" || hasKW(m, "medical") || hasKW(m, "60601"));
  if (spec.certifications.some((c) => c.includes("MIL-STD")))
    candidates = candidates.filter((m) => hasKW(m, "mil") || hasKW(m, "military"));
  if (spec.certifications.includes("SEMI F47"))
    candidates = candidates.filter((m) => hasKW(m, "semi") || hasKW(m, "f47"));

  // ── 기능 필터 ─────────────────────────────────────────────────────
  if (spec.features.some((f) => f.includes("병렬")))
    candidates = candidates.filter((m) => m.lineage === "MODULAR" || hasKW(m, "parallel"));
  if (spec.features.some((f) => f.includes("PMBus")))
    candidates = candidates.filter((m) => hasKW(m, "pmbus") || hasKW(m, "i2c") || hasKW(m, "digital"));
  if (spec.features.some((f) => f.includes("Hot Swap")))
    candidates = candidates.filter((m) => hasKW(m, "hot swap") || hasKW(m, "hotswap"));

  // ── 출력 전력 범위 필터 (강한 필터) ───────────────────────────────
  // 사용자가 totalPower를 "600W–1kW" 로 설정하면 그 범위 [600, 1000] 안에
  // 들어가는 watt를 가진 제품을 모두 통과시킨다.
  const pwRange = parsePowRange(spec.totalPower);
  const chMaxW = spec.outputChannels.reduce((acc, ch) => {
    const w = parsePow(ch.power);
    return w && w > acc ? w : acc;
  }, 0);

  // 1) totalPower 범위가 명시되면: 범위 안에 들어가는 watt 가진 모델만 필터링
  if (pwRange) {
    candidates = candidates.filter((m) => wattInRange(m.watts, pwRange.lo, pwRange.hi) !== null);
  } else if (chMaxW > 0) {
    // 2) totalPower 미입력 + 출력 채널 W만 있을 때: ±20% 허용 범위
    const lo = chMaxW * 0.8, hi = chMaxW * 1.2;
    candidates = candidates.filter((m) => wattInRange(m.watts, lo, hi) !== null);
  }

  // ── 스코어링 (정렬용) — 범위 통과 제품 안에서 응용/입력 매칭으로 정렬 ──
  const targetW = pwRange ? (pwRange.lo + pwRange.hi) / 2 : (chMaxW > 0 ? chMaxW : null);

  return candidates
    .map((m) => {
      let score = 0;
      // 범위 안에 watt가 있으면 풀 점수 (50)
      if (pwRange && wattInRange(m.watts, pwRange.lo, pwRange.hi) !== null) {
        score += 50;
      } else if (targetW && m.watts.length) {
        // 범위 밖이지만 가까울 경우 (단일값 + chMaxW only 케이스)
        const mw = closestW(m.watts, targetW);
        if (mw) score += (Math.min(targetW, mw) / Math.max(targetW, mw)) * 50;
      }
      // 응용 분야 키워드 (10점)
      if (spec.application && hasKW(m, spec.application.split(/[/,·]/)[0].trim())) score += 10;
      // 입력 전압 AC/DC 매칭 (5점)
      if (spec.inputPhase.includes("단상") && m.input && m.input.toLowerCase().includes("ac")) score += 5;
      if (spec.inputPhase.includes("삼상") && m.input && (m.input.includes("3") || m.input.toLowerCase().includes("three"))) score += 5;
      // 기본점수
      score += 1;
      return { m, score };
    })
    .sort((a, b) => b.score - a.score)
    // 범위 필터가 활성된 경우엔 결과 수 제한 완화 (사용자가 모두 보길 원함)
    .slice(0, pwRange ? 60 : 24)
    .map(({ m }) => m);
}

// ── parsePowRange: 출력 전력 입력값을 [lo, hi] 범위로 파싱 ───────────────
// "600W–1kW" → {lo: 600, hi: 1000}
// "1–3kW"    → {lo: 1000, hi: 3000}
// "< 50W"    → {lo: 0, hi: 50}
// "> 10kW"   → {lo: 10000, hi: ∞}
// "800W"     → {lo: 680, hi: 920} (단일값은 ±15% 허용)
function parsePowRange(s: string): { lo: number; hi: number } | null {
  if (!s) return null;
  s = s.trim();
  const pv = (num: string, unit: string) => parseFloat(num) * (/k/i.test(unit) ? 1000 : 1);
  // "< 50W"
  const lt = s.match(/^<\s*([\d.]+)\s*([kK]?[wW])/i);
  if (lt) return { lo: 0, hi: pv(lt[1], lt[2]) };
  // "> 10kW"
  const gt = s.match(/^>\s*([\d.]+)\s*([kK]?[wW])/i);
  if (gt) return { lo: pv(gt[1], gt[2]), hi: Number.POSITIVE_INFINITY };
  // "600W–1kW" (양쪽 단위)
  const r2 = s.match(/^([\d.]+)\s*([kK]?[wW])\s*[–\-~]\s*([\d.]+)\s*([kK]?[wW])/i);
  if (r2) {
    const lo = pv(r2[1], r2[2]);
    const hi = pv(r2[3], r2[4]);
    return { lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
  }
  // "1–3kW" (마지막에만 단위)
  const r1 = s.match(/^([\d.]+)\s*[–\-~]\s*([\d.]+)\s*([kK]?[wW])/i);
  if (r1) {
    const lo = pv(r1[1], r1[3]);
    const hi = pv(r1[2], r1[3]);
    return { lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
  }
  // "800W" (단일값)
  const sg = s.match(/([\d.]+)\s*([kK]?[wW])/i);
  if (sg) {
    const v = pv(sg[1], sg[2]);
    return { lo: v * 0.85, hi: v * 1.15 };
  }
  return null;
}

// ── wattInRange: 모델의 watts 배열에서 [lo, hi] 안에 들어가는 첫 watt 반환 ──
function wattInRange(watts: string[], lo: number, hi: number): number | null {
  for (const w of watts) {
    const m = w.match(/^([\d.]+)(K?W)$/i);
    if (!m) continue;
    const v = parseFloat(m[1]) * (m[2].toUpperCase() === "KW" ? 1000 : 1);
    if (v >= lo && v <= hi) return v;
  }
  return null;
}

// parsePow: 단일값("800W"), 범위("600W–1kW","1–3kW"), 부등호("< 50W","> 10kW") 모두 처리
// 범위/부등호의 경우 중간값(또는 추정값) 반환 — 출력 채널 등 단일 추정 용도
function parsePow(s: string): number | null {
  if (!s) return null;
  s = s.trim();
  function pv(num: string, unit: string): number {
    return parseFloat(num) * (/k/i.test(unit) ? 1000 : 1);
  }
  // "< 50W"
  const lt = s.match(/^<\s*([\d.]+)\s*([kK]?[wW])/i);
  if (lt) return pv(lt[1], lt[2]) * 0.5;
  // "> 10kW"
  const gt = s.match(/^>\s*([\d.]+)\s*([kK]?[wW])/i);
  if (gt) return pv(gt[1], gt[2]) * 2;
  // "600W–1kW" (양쪽에 단위)
  const r2 = s.match(/^([\d.]+)\s*([kK]?[wW])\s*[–\-]\s*([\d.]+)\s*([kK]?[wW])/i);
  if (r2) return (pv(r2[1], r2[2]) + pv(r2[3], r2[4])) / 2;
  // "1–3kW" / "100–300W" (마지막 숫자에만 단위)
  const r1 = s.match(/^([\d.]+)\s*[–\-]\s*([\d.]+)\s*([kK]?[wW])/i);
  if (r1) return (pv(r1[1], r1[3]) + pv(r1[2], r1[3])) / 2;
  // 단일 "800W" / "1.5kW"
  const sg = s.match(/([\d.]+)\s*([kK]?[wW])/i);
  if (sg) return pv(sg[1], sg[2]);
  return null;
}

// closestW: 목표 전력에 가장 가까운 watt 값 반환 (maxW 대신 사용)
function closestW(watts: string[], target: number): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const w of watts) {
    const m = w.match(/^([\d.]+)(K?W)$/i);
    if (!m) continue;
    const v = parseFloat(m[1]) * (m[2].toUpperCase() === "KW" ? 1000 : 1);
    const dist = Math.abs(v - target);
    if (dist < bestDist) { bestDist = dist; best = v; }
  }
  return best;
}

function maxW(watts: string[]): number | null {
  let best = 0;
  for (const w of watts) { const m = w.match(/^([\d.]+)(K?W)$/i); if (m) { const v = parseFloat(m[1]) * (m[2].toUpperCase() === "KW" ? 1000 : 1); if (v > best) best = v; } }
  return best > 0 ? best : null;
}

// ── generatePrintHtml ─────────────────────────────────────────────────────────
// Produces a standalone HTML document (all inline styles) for window.open() PDF printing.

function generatePrintHtml(rev: RfqRevision, docNo: string, origin: string): string {
  const c = rev.customer;
  const s = rev.spec;

  function esc(v: string): string {
    return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ── inline style constants ──────────────────────────────────────────────────
  // 화면 RFQ 폼의 Tailwind 클래스와 매칭 (zinc-100/200/300, 12-13px text)
  const PCA = "-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact;";

  // 라벨 셀 — 화면 LC 와 동일: bg-zinc-100, w-[120px], px-3 py-2, font-semibold 12px
  const LS = `border:1px solid #d4d4d8;padding:8px 12px;${PCA}background:#f4f4f5;font-weight:600;font-size:12px;white-space:nowrap;width:120px;color:#000000;line-height:1.4;`;
  // 값 셀 — 화면 VC 와 동일: bg-white, px-3 py-2, 13px
  const VS = `border:1px solid #d4d4d8;padding:8px 12px;font-size:13px;color:#000000;background:#ffffff;line-height:1.4;`;
  // 섹션 헤더 — 화면 FT 와 동일: bg-zinc-200, font-bold 12px uppercase tracking-widest
  const TH = `${PCA}background:#e4e4e7;color:#000000;padding:10px 16px;text-align:left;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;border:1px solid #d4d4d8;`;

  function secHead(title: string, cols = 4): string {
    return `<tr><th colspan="${cols}" style="${TH}">${esc(title)}</th></tr>`;
  }

  function r2(l1: string, v1: string, l2 = "", v2 = ""): string {
    if (l2) {
      return `<tr>
        <td style="${LS}">${esc(l1)}</td>
        <td style="${VS}border-right:1px solid #d4d4d8;">${esc(v1)}</td>
        <td style="${LS}">${esc(l2)}</td>
        <td style="${VS}">${esc(v2)}</td>
      </tr>`;
    }
    return `<tr>
      <td style="${LS}">${esc(l1)}</td>
      <td colspan="3" style="${VS}">${esc(v1)}</td>
    </tr>`;
  }

  function tbl(head: string, body: string): string {
    return `<table style="width:100%;border-collapse:collapse;margin-bottom:4pt;">
      ${head ? `<thead>${head}</thead>` : ""}
      <tbody>${body}</tbody>
    </table>`;
  }

  const outputRows = s.outputChannels.map((ch, i) =>
    `<tr>
      <td style="${LS}">CH${i + 1}</td>
      <td style="${VS}border-right:1px solid #d4d4d8;">${esc(ch.voltage)}</td>
      <td style="${VS}border-right:1px solid #d4d4d8;">${esc(ch.current)}</td>
      <td style="${VS}">${esc(ch.power)}</td>
    </tr>`
  ).join("");

  // PDF 저장 시 기본 파일명용 — 형식: {회사명}_사양요청서_{YYYYMMDD}
  const _now = new Date();
  const _ymd = `${_now.getFullYear()}${String(_now.getMonth() + 1).padStart(2, "0")}${String(_now.getDate()).padStart(2, "0")}`;
  const _safeCompany = (c.company || "Draft").trim().replace(/[\\/:*?"<>|\r\n\t]/g, "").replace(/\s+/g, "");
  const fileTitle = `${_safeCompany}_사양요청서_${_ymd}`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${esc(fileTitle)}</title>
<style>
  /* @page margin: 0 → 브라우저 기본 헤더/푸터 (날짜·URL·페이지번호) 숨김 */
  @page { size: A4 portrait; margin: 0; }
  *, *::before, *::after {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  html, body { margin: 0; padding: 0; }
  body {
    /* 화면과 동일한 폰트 스택 (Tailwind 기본) */
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
                 "Segoe UI", Roboto, "Helvetica Neue", Arial,
                 "Malgun Gothic", "Apple SD Gothic Neo", "맑은 고딕",
                 sans-serif;
    font-size: 13px;
    line-height: 1.45;
    color: #000000;
    background: #ffffff;
  }
  table { border-collapse: collapse; width: 100%; margin-bottom: 0; page-break-inside: avoid; }
  tr { page-break-inside: avoid; }
  #memo-td { vertical-align: top; height: 35mm; }
  /* 화면 미리보기 — 회색 배경 + 흰 카드로 폼 느낌 (인쇄에는 영향 없음) */
  @media screen {
    body { padding: 12mm 6mm; background: #f4f4f5; }
    body > * { max-width: 195mm; margin: 0 auto; }
    body > table:first-of-type { box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
  }
  /* 인쇄: 본문 여백 (브라우저 헤더/푸터 차단됨) */
  @media print {
    body {
      padding: 8mm 12mm;
      background: #ffffff;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
</style>
</head>
<body>

<!-- ── 문서 헤더 — 화면 폼과 동일하게 logo + title + Semigate ─────── -->
<table>
  <tbody>
    <tr>
      <td colspan="4" style="${PCA}background:#ffffff;padding:14px 16px;border:1px solid #d4d4d8;border-bottom:2px solid #18181b;">
        <table style="margin-bottom:0;border:none;">
          <tr>
            <td style="border:none;padding:0;width:1%;vertical-align:middle;">
              <img src="${origin}/logo.png" alt="Advanced Energy" style="height:36px;width:auto;display:block;" />
            </td>
            <td style="border:none;padding:0 16px;text-align:center;white-space:nowrap;vertical-align:middle;">
              <span style="font-size:22px;font-weight:900;letter-spacing:0.06em;color:#000000;">
                SMPS Product Specification Request
              </span>
            </td>
            <td style="border:none;padding:0;width:1%;text-align:right;vertical-align:middle;">
              <img src="${origin}/Semigate.png" alt="Semigate" style="height:36px;width:auto;display:block;" />
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td colspan="4" style="${PCA}background:#f4f4f5;padding:5px 16px;border:1px solid #d4d4d8;border-top:none;text-align:center;font-size:11px;letter-spacing:0.12em;color:#52525b;text-transform:uppercase;font-weight:600;">
        Advanced Energy Industries — Sales Engineering
      </td>
    </tr>
    ${r2("Doc No.", docNo, "Revision", `Rev.${rev.rev}`)}
    ${r2("작성일", new Date().toISOString().slice(0, 10), "저장일시", rev.savedAt.replace("T", " ").slice(0, 16))}
    ${r2("고객사", c.company, "프로젝트명", c.customerProject)}
    ${r2("담당자", c.contactName, "이메일", c.contactEmail)}
    ${r2("전화", c.contactPhone, "산업 분야", c.industry)}
    ${r2("미팅일시", [c.meetingDate, c.meetingTime].filter(Boolean).join(" "), "미팅 장소", c.meetingVenue)}
    ${r2("영업 담당자", c.salesperson, "최초 컨택일", c.contactDate)}
    ${r2("회신 마감일", c.responseDeadline, "비고", c.notes)}
  </tbody>
</table>

<!-- ── 영업 정보 ─────────────────────────────────────── -->
${tbl(secHead("영업 정보"), `
  ${r2("경쟁사 / 현재 제품", c.competitor, "타겟 단가 (USD)", s.targetPrice)}
  ${r2("양산 시점", c.mpqStart, "양산 수량", c.mpqQuantity)}
  ${r2("샘플 요청", c.sampleRequested, "샘플 수량", c.sampleQuantity)}
  ${r2("납기 목표", s.targetDate, "최종 용도", s.application)}
`)}

<!-- ── 입력 사양 ─────────────────────────────────────── -->
${tbl(secHead("입력 사양"), `
  ${r2("입력 전압 범위", s.inputVoltageRange, "입력 위상", s.inputPhase)}
  ${r2("입력 주파수", s.inputFrequency)}
`)}

<!-- ── 출력 사양 ─────────────────────────────────────── -->
${tbl(
  secHead("출력 사양") + `<tr>
    <td style="${LS}">채널</td>
    <td style="${VS}border-right:1px solid #d4d4d8;">출력 전압</td>
    <td style="${VS}border-right:1px solid #d4d4d8;">출력 전류</td>
    <td style="${VS}">출력 전력</td>
  </tr>`,
  outputRows + `
  ${r2("총 출력 전력", s.totalPower, "전압 조정률", s.outputRegulation)}
  ${r2("리플 / 노이즈", s.rippleNoise)}
`)}

<!-- ── 기구 사양 ─────────────────────────────────────── -->
${tbl(secHead("기구 사양"), `
  ${r2("폼팩터", s.formFactor, "냉각 방식", s.cooling)}
  ${r2("외형 치수 (mm)", s.dimensions, "무게", s.weight)}
`)}

<!-- ── 기능 / 보호 / 인증 ──────────────────────────── -->
${tbl(secHead("기능 / 보호 회로 / 요구 인증", 2), `
  <tr><td style="${LS}">특수 기능</td><td style="${VS}">${esc(s.features.join(" / ") || "—")}</td></tr>
  <tr><td style="${LS}">보호 회로</td><td style="${VS}">${esc(s.protections.join(" / ") || "—")}</td></tr>
  <tr><td style="${LS}">요구 인증</td><td style="${VS}">${esc(s.certifications.join(" / ") || "—")}</td></tr>
`)}

<!-- ── 미팅 메모 ─────────────────────────────────── -->
<table style="margin-bottom:0;">
  <thead>${secHead("미팅 메모 / 자유 기록", 1)}</thead>
  <tbody>
    <tr>
      <td id="memo-td" style="${VS}white-space:pre-wrap;padding:6pt 8pt;height:30mm;">${esc(c.meetingMemo || "")}</td>
    </tr>
  </tbody>
</table>

</body>
</html>`;
}

// ── Email preview helpers ────────────────────────────────────────────────────

function buildEmailVars(
  c: CustomerInfo,
  s: SmpsSpec,
  docNo: string,
  revNum: number,
): Record<string, string> {
  return {
    "{{company}}": c.company,
    "{{contactName}}": c.contactName,
    "{{industry}}": c.industry,
    "{{project}}": c.customerProject,
    "{{salesperson}}": c.salesperson,
    "{{meetingDate}}": c.meetingDate,
    "{{responseDeadline}}": c.responseDeadline,
    "{{competitor}}": c.competitor,
    "{{sampleRequested}}": c.sampleRequested,
    "{{mpqStart}}": c.mpqStart,
    "{{mpqQuantity}}": c.mpqQuantity,
    "{{inputVoltage}}": s.inputVoltageRange,
    "{{inputPhase}}": s.inputPhase,
    "{{inputFrequency}}": s.inputFrequency,
    "{{totalPower}}": s.totalPower,
    "{{outputRegulation}}": s.outputRegulation,
    "{{rippleNoise}}": s.rippleNoise,
    "{{formFactor}}": s.formFactor,
    "{{cooling}}": s.cooling,
    "{{features}}": s.features.join(", "),
    "{{protections}}": s.protections.join(", "),
    "{{certifications}}": s.certifications.join(", "),
    "{{application}}": s.application,
    "{{targetDate}}": s.targetDate,
    "{{docNo}}": docNo,
    "{{rev}}": String(revNum),
  };
}

// ── Attachment type ──────────────────────────────────────────────────────────
interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}

// ── Rich Text Editor (Outlook-style) ─────────────────────────────────────────
// HTML 기반 contentEditable 에디터. 폰트/색상/이미지 붙여넣기 등 지원.
const FONT_FAMILIES = [
  { label: "맑은 고딕", value: "'Malgun Gothic','Apple SD Gothic Neo',sans-serif" },
  { label: "Segoe UI", value: "'Segoe UI',Arial,sans-serif" },
  { label: "Arial", value: "Arial,sans-serif" },
  { label: "Calibri", value: "Calibri,sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman',serif" },
  { label: "Courier New", value: "'Courier New',monospace" },
  { label: "고운돋움", value: "'Gowun Dodum',sans-serif" },
];
const FONT_SIZES = ["10px", "11px", "12px", "13px", "14px", "15px", "16px", "18px", "20px", "24px", "28px", "32px"];
const TEXT_COLORS = ["#000000", "#605e5c", "#0078d4", "#107c10", "#d83b01", "#a4262c", "#5c2d91", "#ca5010", "#498205", "#038387"];
const HIGHLIGHT_COLORS = ["transparent", "#fef9c3", "#fde68a", "#bef264", "#a7f3d0", "#bae6fd", "#c4b5fd", "#fbcfe8", "#fecaca"];

interface RichEditorProps {
  html: string;
  onHtmlChange: (h: string) => void;
  onAttachFiles: (files: AttachedFile[]) => void;
  modeRich: boolean;
  onToggleMode: () => void;
}

function RichTextEditor({ html, onHtmlChange, onAttachFiles, modeRich, onToggleMode }: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [showColors, setShowColors] = useState<"text" | "bg" | null>(null);
  const [colorPickerPos, setColorPickerPos] = useState<{ top: number; left: number } | null>(null);
  const textColorBtnRef = useRef<HTMLButtonElement>(null);
  const bgColorBtnRef = useRef<HTMLButtonElement>(null);

  // 색상 picker 위치 계산 — fixed 좌표로 부모 overflow 무시
  function openColorPicker(kind: "text" | "bg") {
    if (showColors === kind) {
      setShowColors(null);
      setColorPickerPos(null);
      return;
    }
    const btn = kind === "text" ? textColorBtnRef.current : bgColorBtnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setColorPickerPos({ top: rect.bottom + 4, left: rect.left });
    }
    setShowColors(kind);
  }

  // 외부 클릭 시 picker 닫기
  useEffect(() => {
    if (!showColors) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("[data-color-picker]") || target.closest("[data-color-trigger]")) return;
      setShowColors(null);
      setColorPickerPos(null);
    }
    function onScrollOrResize() {
      // 스크롤/리사이즈 시 위치 재계산
      const btn = showColors === "text" ? textColorBtnRef.current : bgColorBtnRef.current;
      if (btn) {
        const rect = btn.getBoundingClientRect();
        setColorPickerPos({ top: rect.bottom + 4, left: rect.left });
      }
    }
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [showColors]);

  // 외부 상태 → 에디터 동기화 (커서 손실 방지: innerHTML이 다를 때만 갱신)
  useEffect(() => {
    if (!modeRich) return;
    const el = editorRef.current;
    if (el && el.innerHTML !== html) el.innerHTML = html;
  }, [html, modeRich]);

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    // styleWithCSS 활성화 — 색상/폰트가 deprecated <font> 태그가 아닌 CSS 로 적용되도록
    try { document.execCommand("styleWithCSS", false, "true"); } catch {}
    document.execCommand(cmd, false, value);
    if (editorRef.current) onHtmlChange(editorRef.current.innerHTML);
  }

  // 선택 영역을 span 으로 감싸 CSS 속성 적용 — execCommand("insertHTML") 사용
  //   ★ execCommand 사용 이유: 브라우저 네이티브 undo/redo 스택에 자동 기록 (Ctrl+Z/Y 정상 작동)
  //   직접 DOM 조작 (Range.insertNode 등) 은 undo 스택에 기록되지 않아 되돌리기 불가
  // CSS prop name (camelCase) → CSS property name (kebab-case)
  function camelToKebab(s: string): string {
    return s.replace(/([A-Z])/g, "-$1").toLowerCase();
  }
  function applySpanStyle(prop: keyof CSSStyleDeclaration, value: string) {
    const cssProp = camelToKebab(prop as string);
    editorRef.current?.focus();
    try { document.execCommand("styleWithCSS", false, "true"); } catch {}
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    // 선택 영역이 없으면 zero-width span 삽입 (이후 입력 시 스타일 적용)
    if (range.collapsed) {
      const html = `<span style="${cssProp}: ${value}">​</span>`;
      document.execCommand("insertHTML", false, html);
    } else {
      // 선택 영역 HTML 추출 후 span 으로 감싸 insertHTML
      const cloned = range.cloneContents();
      const wrap = document.createElement("div");
      wrap.appendChild(cloned);
      // CSS escape — value 에 따옴표가 있을 수 있어 안전 처리
      const safeValue = value.replace(/"/g, "&quot;");
      const html = `<span style="${cssProp}: ${safeValue}">${wrap.innerHTML}</span>`;
      document.execCommand("insertHTML", false, html);
    }
    if (editorRef.current) onHtmlChange(editorRef.current.innerHTML);
  }

  function handleInput() {
    if (editorRef.current) onHtmlChange(editorRef.current.innerHTML);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of Array.from(items)) {
      if (it.type.startsWith("image/")) {
        e.preventDefault();
        const file = it.getAsFile();
        if (!file) continue;
        const r = new FileReader();
        r.onload = (ev) => {
          const url = ev.target?.result as string;
          // 클립보드 이미지를 본문에 inline 삽입
          exec("insertImage", url);
        };
        r.readAsDataURL(file);
        return;
      }
    }
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => exec("insertImage", ev.target?.result as string);
    r.readAsDataURL(f);
    e.target.value = "";
  }

  function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    Promise.all(
      files.map(
        (f) =>
          new Promise<AttachedFile>((res) => {
            const r = new FileReader();
            r.onload = (ev) =>
              res({
                id: Math.random().toString(36).slice(2, 10),
                name: f.name,
                size: f.size,
                type: f.type || "application/octet-stream",
                dataUrl: ev.target?.result as string,
              });
            r.readAsDataURL(f);
          }),
      ),
    ).then((arr) => onAttachFiles(arr));
    e.target.value = "";
  }

  function insertLink() {
    const url = prompt("링크 URL 입력:", "https://");
    if (url) exec("createLink", url);
  }

  // ── 툴바 버튼 공통 스타일 ─────────────────────────────────────────────
  const btn = "flex h-7 min-w-[28px] items-center justify-center rounded px-1.5 text-[12px] text-[#323130] hover:bg-black/5 active:bg-black/10";

  return (
    <div className="flex flex-col" style={{ background: "#ffffff" }}>
      {/* ══ 포맷 툴바 ══════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1" style={{ background: "#faf9f8", borderColor: "#e0e0e0" }}>
        {/* 모드 토글 */}
        <button type="button" onClick={onToggleMode}
          className={`${btn} px-2`} style={{ fontWeight: 600, color: modeRich ? "#0078d4" : "#605e5c" }}
          title={modeRich ? "HTML 소스 편집 전환" : "리치 편집 전환"}>
          {modeRich ? "Rich" : "HTML"}
        </button>
        <div className="mx-1 h-5 w-px" style={{ background: "#c8c6c4" }} />
        {/* 되돌리기 / 앞당기기 (Undo / Redo) */}
        <button type="button"
          onClick={() => {
            editorRef.current?.focus();
            document.execCommand("undo");
            if (editorRef.current) onHtmlChange(editorRef.current.innerHTML);
          }}
          className={btn} title="되돌리기 (Ctrl+Z)" aria-label="Undo">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M3 7l3-3M3 7l3 3M3 7h7a4 4 0 1 1 0 8H8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button type="button"
          onClick={() => {
            editorRef.current?.focus();
            document.execCommand("redo");
            if (editorRef.current) onHtmlChange(editorRef.current.innerHTML);
          }}
          className={btn} title="앞당기기 (Ctrl+Y)" aria-label="Redo">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M13 7l-3-3M13 7l-3 3M13 7H6a4 4 0 1 0 0 8h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="mx-1 h-5 w-px" style={{ background: "#c8c6c4" }} />
        {/* 폰트 패밀리 — execCommand("fontName")는 CSS 스택 미지원이라 span 으로 직접 적용 */}
        <select onChange={(e) => { applySpanStyle("fontFamily", e.target.value); e.currentTarget.value = ""; }} defaultValue=""
          className="h-7 rounded border px-1 text-[11px]"
          style={{ borderColor: "#d0d0d0", background: "#fff" }}
          title="글꼴">
          <option value="" disabled>글꼴</option>
          {FONT_FAMILIES.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
        </select>
        {/* 폰트 사이즈 (CSS px) — span 으로 직접 적용 */}
        <select onChange={(e) => { applySpanStyle("fontSize", e.target.value); e.currentTarget.value = ""; }} defaultValue=""
          className="h-7 rounded border px-1 text-[11px]"
          style={{ borderColor: "#d0d0d0", background: "#fff" }}
          title="크기">
          <option value="" disabled>크기</option>
          {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="mx-1 h-5 w-px" style={{ background: "#c8c6c4" }} />
        {/* B/I/U/S */}
        <button type="button" onClick={() => exec("bold")} className={btn} title="굵게 (Ctrl+B)"><b>B</b></button>
        <button type="button" onClick={() => exec("italic")} className={btn} title="기울임 (Ctrl+I)"><i>I</i></button>
        <button type="button" onClick={() => exec("underline")} className={btn} title="밑줄 (Ctrl+U)"><u>U</u></button>
        <button type="button" onClick={() => exec("strikeThrough")} className={btn} title="취소선"><s>S</s></button>
        <div className="mx-1 h-5 w-px" style={{ background: "#c8c6c4" }} />
        {/* 색상 — picker 는 portal 처럼 body 에 fixed 위치로 띄움 */}
        <button type="button" ref={textColorBtnRef}
          data-color-trigger
          onClick={() => openColorPicker("text")}
          className={btn} title="글자색">
          <span style={{ borderBottom: "3px solid #d83b01", padding: "0 2px", lineHeight: 1 }}>A</span>
        </button>
        <button type="button" ref={bgColorBtnRef}
          data-color-trigger
          onClick={() => openColorPicker("bg")}
          className={btn} title="배경색">
          <span style={{ background: "#fef9c3", padding: "0 3px", borderRadius: 2 }}>A</span>
        </button>
        <div className="mx-1 h-5 w-px" style={{ background: "#c8c6c4" }} />
        {/* 정렬 */}
        <button type="button" onClick={() => exec("justifyLeft")} className={btn} title="왼쪽 정렬"><Icon name="align-left"/></button>
        <button type="button" onClick={() => exec("justifyCenter")} className={btn} title="가운데"><Icon name="align-center"/></button>
        <button type="button" onClick={() => exec("justifyRight")} className={btn} title="오른쪽"><Icon name="align-right"/></button>
        <div className="mx-1 h-5 w-px" style={{ background: "#c8c6c4" }} />
        {/* 리스트 */}
        <button type="button" onClick={() => exec("insertUnorderedList")} className={btn} title="글머리 기호"><Icon name="list-bullet"/></button>
        <button type="button" onClick={() => exec("insertOrderedList")} className={btn} title="번호 매기기"><Icon name="list-number"/></button>
        <button type="button" onClick={() => exec("formatBlock", "blockquote")} className={btn} title="인용"><Icon name="quote"/></button>
        <div className="mx-1 h-5 w-px" style={{ background: "#c8c6c4" }} />
        {/* 링크 / 이미지 / 첨부 */}
        <button type="button" onClick={insertLink} className={btn} title="링크 삽입"><Icon name="link"/></button>
        <button type="button" onClick={() => imgInputRef.current?.click()} className={btn} title="이미지 삽입"><Icon name="image"/></button>
        <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
        <button type="button" onClick={() => fileInputRef.current?.click()} className={btn} title="파일 첨부"><Icon name="paperclip"/></button>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileAttach} />
        <div className="mx-1 h-5 w-px" style={{ background: "#c8c6c4" }} />
        {/* 지우기 */}
        <button type="button" onClick={() => exec("removeFormat")} className={btn} title="서식 제거"><Icon name="clear-format"/></button>
      </div>

      {/* ══ 본문 영역 (Rich / HTML) ════════════════════════════════ */}
      {modeRich ? (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            // Ctrl+Z / Cmd+Z → undo, Ctrl+Y or Ctrl+Shift+Z → redo
            const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
            const ctrlKey = isMac ? e.metaKey : e.ctrlKey;
            if (!ctrlKey) return;
            const key = e.key.toLowerCase();
            if (key === "z" && !e.shiftKey) {
              e.preventDefault();
              document.execCommand("undo");
              if (editorRef.current) onHtmlChange(editorRef.current.innerHTML);
            } else if (key === "y" || (key === "z" && e.shiftKey)) {
              e.preventDefault();
              document.execCommand("redo");
              if (editorRef.current) onHtmlChange(editorRef.current.innerHTML);
            }
          }}
          spellCheck={false}
          style={{
            minHeight: "320px",
            maxHeight: "420px",
            overflowY: "auto",
            padding: "16px 20px",
            fontFamily: "'Segoe UI','Malgun Gothic',Arial,sans-serif",
            fontSize: "13px",
            lineHeight: 1.65,
            color: "#323130",
            outline: "none",
            background: "#ffffff",
          }}
        />
      ) : (
        <textarea
          value={html}
          onChange={(e) => onHtmlChange(e.target.value)}
          spellCheck={false}
          style={{
            width: "100%",
            minHeight: "320px",
            maxHeight: "420px",
            padding: "16px 20px",
            fontFamily: "'Courier New',monospace",
            fontSize: "12px",
            lineHeight: 1.55,
            color: "#323130",
            background: "#fffbe6",
            border: "none",
            outline: "none",
            resize: "none",
          }}
          placeholder="HTML 소스. {{company}} 등 변수 사용 가능."
        />
      )}

      {/* ══ 색상 picker (fixed 좌표로 부모 overflow 무시) ══════════════ */}
      {showColors && colorPickerPos && (
        <div
          data-color-picker
          className="grid grid-cols-5 gap-1 rounded border bg-white p-2 shadow-lg"
          style={{
            position: "fixed",
            top: colorPickerPos.top,
            left: colorPickerPos.left,
            zIndex: 9999,
            borderColor: "#d0d0d0",
          }}
        >
          {(showColors === "text" ? TEXT_COLORS : HIGHLIGHT_COLORS).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                if (showColors === "text") exec("foreColor", c);
                else exec("hiliteColor", c);
                setShowColors(null);
                setColorPickerPos(null);
              }}
              className="h-6 w-6 rounded border transition hover:scale-110"
              style={{
                background: c === "transparent"
                  ? "repeating-conic-gradient(#ddd 0% 25%, #fff 25% 50%) 50%/8px 8px"
                  : c,
                borderColor: "#d0d0d0",
              }}
              title={c}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// HTML → 평문 변환 (mailto fallback용)
function htmlToPlainText(html: string): string {
  if (typeof document === "undefined") return html;
  const div = document.createElement("div");
  div.innerHTML = html;
  // <br>, </p>, </div> 등을 개행으로
  div.querySelectorAll("br").forEach((b) => b.replaceWith("\n"));
  div.querySelectorAll("p, div, li, tr").forEach((b) => {
    if (b.lastChild?.nodeType !== 3 || !/\n$/.test(b.lastChild.textContent || "")) {
      b.appendChild(document.createTextNode("\n"));
    }
  });
  return (div.textContent || div.innerText || "").replace(/\n{3,}/g, "\n\n").trim();
}

// 평문 → 안전한 HTML (개행 → <br>, 변수 보존)
function plainTextToHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

// ── .eml 파일 생성기 (Outlook 새 초안으로 열기) ──────────────────────────────
// X-Unsent: 1 헤더가 핵심 — Outlook이 이 파일을 받은 메일이 아닌 "보내지 않은 초안"으로
// 열어 사용자가 바로 발송할 수 있게 함. HTML 본문, 인라인 이미지, 첨부파일 모두 포함.

function utf8ToBase64(s: string): string {
  // UTF-8 안전 base64 (한글 포함)
  if (typeof window === "undefined") return "";
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function wrap76(b64: string): string {
  return b64.match(/.{1,76}/g)?.join("\r\n") || b64;
}
function mimeHeader(s: string): string {
  // 비-ASCII 포함 시 B-encoding
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  return `=?UTF-8?B?${utf8ToBase64(s)}?=`;
}

interface EmlAttachment {
  name: string;
  mime: string;
  base64: string;
}

function buildEml(opts: {
  to: string;
  cc?: string;
  subject: string;
  htmlBody: string;
  attachments: EmlAttachment[];
}): Blob {
  const CRLF = "\r\n";
  const boundaryMixed = `==AE_MIXED_${Math.random().toString(36).slice(2, 12)}==`;
  const boundaryRelated = `==AE_RELATED_${Math.random().toString(36).slice(2, 12)}==`;

  // ── 1) 본문 HTML 안의 data:URL 이미지를 cid 참조로 치환, inline 첨부 추출 ──
  let bodyHtml = opts.htmlBody;
  const inlineImgs: { cid: string; mime: string; base64: string }[] = [];
  bodyHtml = bodyHtml.replace(
    /<img([^>]*?)src="data:([^;]+);base64,([^"]+)"([^>]*)>/gi,
    (_m, pre, mime, b64, post) => {
      const cid = `aeimg_${inlineImgs.length + 1}@rfq`;
      inlineImgs.push({ cid, mime, base64: b64 });
      return `<img${pre}src="cid:${cid}"${post}>`;
    },
  );

  // 본문은 한글 안전을 위해 base64로 인코딩
  const htmlPart =
    `Content-Type: text/html; charset=UTF-8${CRLF}` +
    `Content-Transfer-Encoding: base64${CRLF}${CRLF}` +
    wrap76(utf8ToBase64(bodyHtml));

  // ── 2) related 파트 (HTML + inline 이미지) ──
  let relatedPart = "";
  if (inlineImgs.length === 0) {
    relatedPart = htmlPart;
  } else {
    const relParts: string[] = [];
    relParts.push(`--${boundaryRelated}${CRLF}${htmlPart}`);
    for (const img of inlineImgs) {
      relParts.push(
        `--${boundaryRelated}${CRLF}` +
          `Content-Type: ${img.mime}${CRLF}` +
          `Content-Transfer-Encoding: base64${CRLF}` +
          `Content-ID: <${img.cid}>${CRLF}` +
          `Content-Disposition: inline${CRLF}${CRLF}` +
          wrap76(img.base64),
      );
    }
    relatedPart =
      `Content-Type: multipart/related; boundary="${boundaryRelated}"${CRLF}${CRLF}` +
      relParts.join(CRLF) +
      `${CRLF}--${boundaryRelated}--`;
  }

  // ── 3) 첨부파일이 없으면 헤더 + relatedPart 직접 합치기 ──
  const headers: string[] = [];
  headers.push(`To: ${opts.to}`);
  if (opts.cc) headers.push(`Cc: ${opts.cc}`);
  headers.push(`Subject: ${mimeHeader(opts.subject)}`);
  headers.push(`Date: ${new Date().toUTCString()}`);
  headers.push(`MIME-Version: 1.0`);
  headers.push(`X-Unsent: 1`); // ← 핵심: Outlook이 새 초안으로 열도록

  if (opts.attachments.length === 0) {
    const eml = headers.join(CRLF) + CRLF + relatedPart + CRLF;
    return new Blob([eml], { type: "message/rfc822" });
  }

  // ── 4) 첨부파일이 있으면 multipart/mixed 로 감싸기 ──
  headers.push(`Content-Type: multipart/mixed; boundary="${boundaryMixed}"`);

  const mixedParts: string[] = [];
  mixedParts.push(`--${boundaryMixed}${CRLF}${relatedPart}`);
  for (const att of opts.attachments) {
    mixedParts.push(
      `--${boundaryMixed}${CRLF}` +
        `Content-Type: ${att.mime}; name="${mimeHeader(att.name)}"${CRLF}` +
        `Content-Transfer-Encoding: base64${CRLF}` +
        `Content-Disposition: attachment; filename="${mimeHeader(att.name)}"${CRLF}${CRLF}` +
        wrap76(att.base64),
    );
  }
  const eml =
    headers.join(CRLF) + CRLF + CRLF +
    mixedParts.join(CRLF) +
    `${CRLF}--${boundaryMixed}--${CRLF}`;
  return new Blob([eml], { type: "message/rfc822" });
}

// dataURL → { mime, base64 } 분해
function splitDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RfqPage() {
  // today는 클라이언트에서만 확정 → SSR 하이드레이션 불일치 방지
  const [today, setToday] = useState("");
  const [records, setRecords] = useState<RfqRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerInfo>(emptyCustomer);
  const [spec, setSpec] = useState<SmpsSpec>(emptySpec);
  const [commentDraft, setCommentDraft] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  // 이메일 템플릿
  const [emailTemplate, setEmailTemplate] = useState(DEFAULT_EMAIL_TEMPLATE);
  const [emailSubject, setEmailSubject] = useState(DEFAULT_EMAIL_SUBJECT);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailOpen, setEmailOpen] = useState(true);
  const [emailSentMsg, setEmailSentMsg] = useState("");
  const [templateEditMode, setTemplateEditMode] = useState(false); // false = 미리보기, true = 편집
  // 리치 에디터 상태
  const [emailHtml, setEmailHtml] = useState<string>(""); // contentEditable HTML
  const [editorRichMode, setEditorRichMode] = useState<boolean>(true); // true=리치, false=HTML 소스
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  // 명명된 템플릿 (다중 저장)
  const [emailPresets, setEmailPresets] = useState<EmailPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  // Outlook 미리보기 모달 (보내기 클릭 시)
  const [outlookPreview, setOutlookPreview] = useState<null | {
    to: string;
    cc: string;
    subject: string;
    htmlBody: string;
    atts: { name: string; size: number; type: string }[];
    emlUrl: string;
    emlFilename: string;
    xlsFilename: string;
  }>(null);
  // 임시저장 (자동 + 수동) 상태
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<"" | "saving" | "saved">("");

  // RFQ 목록 패널 (인라인)
  const [listOpen, setListOpen] = useState(false);

  // PDF 미리보기 모달
  const [pdfPreviewHtml, setPdfPreviewHtml] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 제안서 (Proposal) 모달
  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalStep, setProposalStep] = useState<1 | 2 | 3>(1);
  const [proposalKeys, setProposalKeys] = useState<string[]>([]);
  const [proposalHtml, setProposalHtml] = useState<string | null>(null);
  const [proposalEmailBody, setProposalEmailBody] = useState("");
  const [proposalTab, setProposalTab] = useState<"doc" | "email">("doc");
  // 제안서 Outlook 발송 모달
  const [proposalOutlookPreview, setProposalOutlookPreview] = useState<null | {
    to: string; cc: string; subject: string; htmlBody: string;
    atts: { name: string; size: number; type: string }[];
    emlUrl: string; emlFilename: string;
  }>(null);
  const [proposalSentMsg, setProposalSentMsg] = useState("");
  const proposalIframeRef = useRef<HTMLIFrameElement>(null);
  // 카탈로그 페이지 첨부 옵션 + 진행 상태
  const [includeCatalogPages, setIncludeCatalogPages] = useState(true);
  const [catalogPagesGenerating, setCatalogPagesGenerating] = useState(false);
  const [catalogPagesProgress, setCatalogPagesProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  const importInputRef = useRef<HTMLInputElement>(null);
  const emailTemplateRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
    setRecords(loadRecords());
    const tpl = loadEmailTemplate();
    setEmailTemplate(tpl);
    setEmailSubject(loadEmailSubject());
    // 저장된 HTML 본문이 있으면 사용, 없으면 평문 템플릿을 HTML로 변환
    if (typeof window !== "undefined") {
      const savedHtml = window.localStorage.getItem("rfq.emailHtml");
      if (savedHtml) setEmailHtml(savedHtml);
      else setEmailHtml(plainTextToHtml(tpl));
    }
    // 저장된 명명 템플릿 목록 로드
    setEmailPresets(loadEmailPresets());
    // 임시저장 (자동저장) 복원
    if (typeof window !== "undefined") {
      try {
        const draftRaw = window.localStorage.getItem("ae_rfq_email_draft");
        if (draftRaw) {
          const d = JSON.parse(draftRaw);
          if (d && typeof d === "object") {
            if (d.subject) setEmailSubject(d.subject);
            if (d.htmlBody) setEmailHtml(d.htmlBody);
            if (typeof d.to === "string") setEmailTo(d.to);
            if (typeof d.cc === "string") setEmailCc(d.cc);
            if (Array.isArray(d.attachments)) setAttachments(d.attachments);
            setDraftSavedAt(d.savedAt || null);
          }
        }
      } catch { /* ignore */ }
    }
  }, []);

  // ── emailTo 자동 입력 — 폼의 고객 이메일이 바뀌면 받는 사람 필드를 동기화
  // 사용자가 직접 수정한 경우(autoFilledEmail 과 다를 때)는 덮어쓰지 않음
  const autoFilledEmail = useRef("");
  useEffect(() => {
    if (emailTo === "" || emailTo === autoFilledEmail.current) {
      autoFilledEmail.current = customer.contactEmail;
      setEmailTo(customer.contactEmail);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.contactEmail]);

  // ── 자동 임시저장 (debounced) ───────────────────────────────────────────
  // 본문/제목/수신자/첨부 변경 시 1.5초 후 localStorage 에 저장
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDraftStatus("saving");
    const timer = setTimeout(() => {
      try {
        const draft = {
          subject: emailSubject,
          htmlBody: emailHtml,
          to: emailTo,
          cc: emailCc,
          attachments,
          savedAt: new Date().toISOString(),
        };
        window.localStorage.setItem("ae_rfq_email_draft", JSON.stringify(draft));
        setDraftSavedAt(draft.savedAt);
        setDraftStatus("saved");
        setTimeout(() => setDraftStatus(""), 1500);
      } catch (e) {
        console.warn("임시저장 실패:", e);
        setDraftStatus("");
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [emailSubject, emailHtml, emailTo, emailCc, attachments]);

  // 수동 임시저장
  function handleSaveDraft() {
    if (typeof window === "undefined") return;
    try {
      const draft = {
        subject: emailSubject,
        htmlBody: emailHtml,
        to: emailTo,
        cc: emailCc,
        attachments,
        savedAt: new Date().toISOString(),
      };
      window.localStorage.setItem("ae_rfq_email_draft", JSON.stringify(draft));
      setDraftSavedAt(draft.savedAt);
      setEmailSentMsg("임시저장 완료");
      setTimeout(() => setEmailSentMsg(""), 2000);
    } catch {
      alert("임시저장 실패: 첨부파일 용량이 너무 큽니다. 첨부를 줄여주세요.");
    }
  }
  // 임시저장 삭제
  function handleClearDraft() {
    if (typeof window === "undefined") return;
    if (!confirm("임시저장을 삭제하시겠습니까?")) return;
    window.localStorage.removeItem("ae_rfq_email_draft");
    setDraftSavedAt(null);
    setEmailSentMsg("임시저장 삭제됨");
    setTimeout(() => setEmailSentMsg(""), 2000);
  }
  // 임시저장 시각 → "X초/분 전" 표시
  function draftLabel(): string {
    if (draftStatus === "saving") return "임시저장 중…";
    if (!draftSavedAt) return "";
    const diffMs = Date.now() - new Date(draftSavedAt).getTime();
    const sec = Math.floor(diffMs / 1000);
    if (sec < 5) return "방금 임시저장";
    if (sec < 60) return `${sec}초 전 임시저장`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}분 전 임시저장`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}시간 전 임시저장`;
    return new Date(draftSavedAt).toLocaleString("ko-KR");
  }

  const activeRecord = useMemo(() => records.find((r) => r.id === activeId) ?? null, [records, activeId]);
  const latestRev = activeRecord ? activeRecord.revisions[activeRecord.revisions.length - 1] : null;
  const docNo = activeId ? `RFQ-${activeId.slice(0, 6).toUpperCase()}` : "RFQ-NEW";

  function setC<K extends keyof CustomerInfo>(k: K, v: CustomerInfo[K]) { setCustomer((p) => ({ ...p, [k]: v })); setIsDirty(true); }
  function setS<K extends keyof SmpsSpec>(k: K, v: SmpsSpec[K]) { setSpec((p) => ({ ...p, [k]: v })); setIsDirty(true); }
  function updateCh(i: number, ch: OutputChannel) { setSpec((p) => { const chs = [...p.outputChannels]; chs[i] = ch; return { ...p, outputChannels: chs }; }); setIsDirty(true); }
  function addCh() { setSpec((p) => ({ ...p, outputChannels: [...p.outputChannels, emptyChannel()] })); setIsDirty(true); }
  function removeCh(i: number) { setSpec((p) => ({ ...p, outputChannels: p.outputChannels.filter((_, j) => j !== i) })); setIsDirty(true); }

  function handleSave() {
    let updated: RfqRecord[];
    if (!activeRecord) {
      const rec = createRecord(customer, spec, commentDraft || "최초 작성");
      updated = [...records, rec];
      setActiveId(rec.id);
    } else {
      const rec = addRevision(activeRecord, customer, spec, commentDraft || `Rev.${activeRecord.revisions.length} 업데이트`);
      updated = records.map((r) => (r.id === rec.id ? rec : r));
    }
    saveRecords(updated); setRecords(updated); setCommentDraft("");
    setIsDirty(false);
    setSaveMsg("저장 완료!"); setTimeout(() => setSaveMsg(""), 2000);
  }

  function handleNew() {
    if (isDirty && !confirm("저장하지 않은 변경사항이 있습니다.\n새 RFQ를 시작하시겠습니까?")) return;
    setActiveId(null); setCustomer(emptyCustomer()); setSpec(emptySpec()); setCommentDraft(""); setIsDirty(false);
  }

  // ── 이메일 발송 ──────────────────────────────────────────────────────────
  // 변수 토큰을 HTML 안에서 치환 (발송용 — 하이라이트 없음)
  function substituteHtml(html: string, vars: Record<string, string>): string {
    let out = html;
    for (const [k, v] of Object.entries(vars)) {
      const safe = (v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      out = out.split(k).join(safe);
    }
    return out;
  }

  // 에디터 미리보기용 치환 — 치환된 값을 연두색 배경 span 으로 감쌈
  function substituteHtmlHighlighted(html: string, vars: Record<string, string>): string {
    let out = html;
    for (const [k, v] of Object.entries(vars)) {
      const safe = (v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      if (safe) {
        out = out.split(k).join(
          `<span data-sub style="background:#d1fae5;border-radius:2px;padding:0 1px;">${safe}</span>`
        );
      } else {
        out = out.split(k).join(safe);
      }
    }
    return out;
  }

  // 발송 직전 data-sub 하이라이트 span 제거 (span 의 자식 노드는 보존)
  function stripSubHighlights(html: string): string {
    if (typeof document === "undefined") return html;
    const div = document.createElement("div");
    div.innerHTML = html;
    div.querySelectorAll<HTMLElement>("[data-sub]").forEach((el) => {
      el.replaceWith(...Array.from(el.childNodes));
    });
    return div.innerHTML;
  }

  function handleOutlookSend() {
    const currentRev: RfqRevision = {
      rev: activeRecord ? activeRecord.revisions.length : 0,
      savedAt: new Date().toISOString(),
      customer,
      spec,
      comment: "",
    };
    const revNum = currentRev.rev;
    const vars = buildEmailVars(customer, spec, docNo, revNum);

    // 1) RFQ Excel 파일을 메모리에서 생성하여 첨부파일에 포함시킨다
    //    (downloadXls는 다운로드만 하므로, 동일한 HTML을 여기서 직접 생성)
    const xlsBlob = (() => {
      // RFQ Excel HTML — downloadXls 와 동일한 컨텐츠. 간단히 재현.
      // (rfq.ts 의 buildXls 와 같은 방식: 첨부 시점에는 dataURL 로 변환)
      // 사용자가 "Excel 다운 + 보내기" 를 누르면 RFQ Excel 도 자동 첨부됨.
      const filename = `RFQ_${customer.company || "draft"}_Rev${currentRev.rev}.xls`;
      // downloadXls 호출 → 파일이 다운로드됨 (백업 용도)
      downloadXls(currentRev, filename);
      return null; // (본문 .eml 에는 별도로 안 넣음. 사용자가 첨부함)
    })();
    void xlsBlob;

    // 2) 본문 HTML 변수 치환 + 에디터 하이라이트 span 제거 (발송본에는 미포함)
    const htmlBody = stripSubHighlights(substituteHtml(emailHtml, vars));
    const subject = substituteTemplate(emailSubject, currentRev, docNo);
    const to = emailTo || customer.contactEmail || "";

    // 3) 첨부파일을 EmlAttachment 형식으로 변환
    const emlAttachments: EmlAttachment[] = attachments
      .map((a) => {
        const parts = splitDataUrl(a.dataUrl);
        return parts ? { name: a.name, mime: parts.mime, base64: parts.base64 } : null;
      })
      .filter((x): x is EmlAttachment => x !== null);

    // 4) .eml 파일 생성 (HTML 본문 + 인라인 이미지 + 첨부파일 + X-Unsent: 1)
    const emlBlob = buildEml({
      to,
      cc: emailCc || undefined,
      subject,
      htmlBody,
      attachments: emlAttachments,
    });

    // 5) Outlook 미리보기 모달로 띄움 (사용자가 확인 후 다운로드/실행)
    const emlUrl = URL.createObjectURL(emlBlob);
    const emlFilename = `RFQ_${customer.company || "draft"}_Rev${currentRev.rev}.eml`;
    const xlsFilename = `RFQ_${customer.company || "draft"}_Rev${currentRev.rev}.xls`;
    setOutlookPreview({
      to,
      cc: emailCc || "",
      subject,
      htmlBody,
      atts: attachments.map((a) => ({ name: a.name, size: a.size, type: a.type })),
      emlUrl,
      emlFilename,
      xlsFilename,
    });
  }

  // 미리보기 "보내기" 클릭 — 실제 Outlook 창을 즉시 띄움 + 서식/첨부는 클립보드/파일로 보조
  async function handleOutlookPreviewSend() {
    if (!outlookPreview) return;
    const { to, cc, subject, htmlBody, emlUrl, emlFilename, atts } = outlookPreview;

    // 1) HTML 서식 본문 + 평문을 클립보드에 복사 (Outlook 본문에 Ctrl+V 로 붙여넣기 가능)
    try {
      const blobHtml = new Blob([htmlBody], { type: "text/html" });
      const blobText = new Blob([htmlToPlainText(htmlBody)], { type: "text/plain" });
      const item = new ClipboardItem({ "text/html": blobHtml, "text/plain": blobText });
      await navigator.clipboard.write([item]);
    } catch {
      try { await navigator.clipboard.writeText(htmlToPlainText(htmlBody)); } catch {}
    }

    // 2) 첨부파일이 있으면 .eml 다운로드 (서식+이미지+첨부 모두 포함)
    if (atts.length > 0) {
      const a = document.createElement("a");
      a.href = emlUrl;
      a.download = emlFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    // 3) ★ 실제 Outlook 데스크톱 창을 즉시 띄움 (mailto: 프로토콜)
    //    To/Cc/Subject + 평문 본문이 자동 입력된 새 메시지 창이 바로 열린다
    const params: string[] = [];
    if (cc) params.push(`cc=${encodeURIComponent(cc)}`);
    params.push(`subject=${encodeURIComponent(subject)}`);
    params.push(`body=${encodeURIComponent(htmlToPlainText(htmlBody))}`);
    const mailtoUrl = `mailto:${encodeURIComponent(to)}?${params.join("&")}`;
    // location.href 가 가장 안정적으로 Outlook 핸들러를 호출함
    window.location.href = mailtoUrl;

    // 4) 임시저장 클리어 (보낸 것으로 간주)
    if (typeof window !== "undefined") window.localStorage.removeItem("ae_rfq_email_draft");
    setDraftSavedAt(null);

    const attMsg = atts.length > 0
      ? ` · 서식 본문 클립보드 복사 완료 (Outlook 본문에서 Ctrl+V) · 첨부파일은 .eml 파일에서 확인`
      : ` · 서식 본문 클립보드 복사 완료 (Outlook 본문에서 Ctrl+V)`;
    setEmailSentMsg(`Outlook 새 메시지 창 열림${attMsg}`);
    setTimeout(() => setEmailSentMsg(""), 8000);
    closeOutlookPreview();
  }
  function closeOutlookPreview() {
    if (outlookPreview) {
      setTimeout(() => URL.revokeObjectURL(outlookPreview.emlUrl), 1500);
    }
    setOutlookPreview(null);
  }

  // ── 제안서 Outlook 발송 모달 열기 ────────────────────────────────────────
  function openProposalOutlook() {
    if (!proposalHtml) return;
    const propId = `PROP-${(activeId ?? "NEW").slice(0, 6).toUpperCase()}`;
    const subject = `[제안서] ${customer.company || "(주)고객사"} ${customer.customerProject || "SMPS 제안"} — ${propId}`;
    const to = emailTo || customer.contactEmail || "";
    const htmlBody = plainTextToHtml(proposalEmailBody);

    // 제안서 HTML 파일 첨부
    const safeCompany = (customer.company || "Draft").trim().replace(/[\\/:*?"<>|\r\n\t]/g, "").replace(/\s+/g, "");
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const attFilename = `${safeCompany}_제안서_${ymd}.html`;
    const attBase64 = utf8ToBase64(proposalHtml);
    const attSize = new Blob([proposalHtml]).size;

    const emlBlob = buildEml({
      to,
      cc: emailCc || undefined,
      subject,
      htmlBody,
      attachments: [{ name: attFilename, mime: "text/html", base64: attBase64 }],
    });
    const emlUrl = URL.createObjectURL(emlBlob);
    const emlFilename = `${safeCompany}_제안서_${ymd}.eml`;

    setProposalOutlookPreview({
      to,
      cc: emailCc || "",
      subject,
      htmlBody,
      atts: [{ name: attFilename, size: attSize, type: "text/html" }],
      emlUrl,
      emlFilename,
    });
  }

  function closeProposalOutlook() {
    if (proposalOutlookPreview) {
      setTimeout(() => URL.revokeObjectURL(proposalOutlookPreview.emlUrl), 1500);
    }
    setProposalOutlookPreview(null);
  }

  async function handleProposalOutlookSend() {
    if (!proposalOutlookPreview) return;
    const { to, cc, subject, htmlBody, emlUrl, emlFilename } = proposalOutlookPreview;
    // 서식 본문 클립보드 복사
    try {
      const blobHtml = new Blob([htmlBody], { type: "text/html" });
      const blobText = new Blob([htmlToPlainText(htmlBody)], { type: "text/plain" });
      await navigator.clipboard.write([new ClipboardItem({ "text/html": blobHtml, "text/plain": blobText })]);
    } catch {
      try { await navigator.clipboard.writeText(htmlToPlainText(htmlBody)); } catch {}
    }
    // .eml 다운로드 (제안서 첨부 포함)
    const a = document.createElement("a");
    a.href = emlUrl; a.download = emlFilename;
    document.body.appendChild(a); a.click(); a.remove();
    // Outlook 창 열기
    const params: string[] = [];
    if (cc) params.push(`cc=${encodeURIComponent(cc)}`);
    params.push(`subject=${encodeURIComponent(subject)}`);
    params.push(`body=${encodeURIComponent(htmlToPlainText(htmlBody))}`);
    window.location.href = `mailto:${encodeURIComponent(to)}?${params.join("&")}`;
    setProposalSentMsg("Outlook 새 메시지 창 열림 · 서식 본문 클립보드 복사 완료 (Ctrl+V)");
    setTimeout(() => setProposalSentMsg(""), 8000);
    closeProposalOutlook();
  }

  function handleSaveTemplate() {
    saveEmailTemplate(emailTemplate);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("rfq.emailHtml", emailHtml);
    }
    saveEmailSubject(emailSubject);
    setEmailSentMsg("템플릿 저장 완료!");
    setTimeout(() => setEmailSentMsg(""), 2000);
  }

  function handleResetTemplate() {
    setEmailTemplate(DEFAULT_EMAIL_TEMPLATE);
    setEmailSubject(DEFAULT_EMAIL_SUBJECT);
    setEmailHtml(plainTextToHtml(DEFAULT_EMAIL_TEMPLATE));
    setAttachments([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("rfq.emailHtml");
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }
  function formatBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ── 명명된 이메일 템플릿: 저장 / 불러오기 / 삭제 ─────────────────────────
  function handleSavePresetAs() {
    const defaultName = customer.company
      ? `${customer.company}${customer.customerProject ? ` — ${customer.customerProject}` : ""}`
      : `템플릿 ${emailPresets.length + 1}`;
    const name = prompt("템플릿 이름을 입력하세요:", defaultName);
    if (!name || !name.trim()) return;
    try {
      const created = addEmailPreset({
        name: name.trim(),
        subject: emailSubject,
        plainTemplate: emailTemplate,
        htmlBody: emailHtml,
        attachments: attachments.map((a) => ({ id: a.id, name: a.name, size: a.size, type: a.type, dataUrl: a.dataUrl })),
      });
      setEmailPresets(loadEmailPresets());
      setActivePresetId(created.id);
      setEmailSentMsg(`'${created.name}' 저장 완료`);
      setTimeout(() => setEmailSentMsg(""), 2500);
    } catch {
      alert("저장 실패: 첨부파일 용량이 너무 큽니다 (브라우저 저장소 5MB 제한). 첨부파일을 제거하거나 줄여주세요.");
    }
  }

  function handleOverwritePreset() {
    if (!activePresetId) { handleSavePresetAs(); return; }
    const cur = emailPresets.find((p) => p.id === activePresetId);
    if (!cur) { handleSavePresetAs(); return; }
    if (!confirm(`'${cur.name}' 템플릿을 현재 내용으로 덮어쓰시겠습니까?`)) return;
    try {
      updateEmailPreset(activePresetId, {
        subject: emailSubject,
        plainTemplate: emailTemplate,
        htmlBody: emailHtml,
        attachments: attachments.map((a) => ({ id: a.id, name: a.name, size: a.size, type: a.type, dataUrl: a.dataUrl })),
      });
      setEmailPresets(loadEmailPresets());
      setEmailSentMsg(`'${cur.name}' 덮어쓰기 완료`);
      setTimeout(() => setEmailSentMsg(""), 2500);
    } catch {
      alert("저장 실패: 첨부파일 용량이 너무 큽니다.");
    }
  }

  function handleLoadPreset(id: string) {
    const p = emailPresets.find((x) => x.id === id);
    if (!p) return;
    if ((emailHtml || emailTemplate || attachments.length > 0) &&
        !confirm(`'${p.name}' 템플릿을 불러오면 현재 본문/첨부파일이 교체됩니다. 계속하시겠습니까?`)) return;
    setEmailSubject(p.subject);
    setEmailTemplate(p.plainTemplate);
    setEmailHtml(p.htmlBody);
    setAttachments((p.attachments || []).map((a) => ({ id: a.id, name: a.name, size: a.size, type: a.type, dataUrl: a.dataUrl })));
    setActivePresetId(p.id);
    setPresetMenuOpen(false);
    setEmailSentMsg(`'${p.name}' 불러오기 완료`);
    setTimeout(() => setEmailSentMsg(""), 2500);
  }

  function handleDeletePreset(id: string) {
    const p = emailPresets.find((x) => x.id === id);
    if (!p) return;
    if (!confirm(`'${p.name}' 템플릿을 삭제하시겠습니까?`)) return;
    deleteEmailPreset(id);
    setEmailPresets(loadEmailPresets());
    if (activePresetId === id) setActivePresetId(null);
  }

  function handleRenamePreset(id: string) {
    const p = emailPresets.find((x) => x.id === id);
    if (!p) return;
    const name = prompt("새 이름:", p.name);
    if (!name || !name.trim() || name === p.name) return;
    updateEmailPreset(id, { name: name.trim() });
    setEmailPresets(loadEmailPresets());
  }

  // ── JSON 백업/복구 ────────────────────────────────────────────────────────
  function handleExportJson() { exportRecordsJson(records); }

  function handleImportJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = importRecordsJson(ev.target?.result as string);
        // 기존 ID와 겹치지 않는 것만 추가 (merge)
        const existingIds = new Set(records.map((r) => r.id));
        const newRecs = imported.filter((r) => !existingIds.has(r.id));
        const merged = [...records, ...newRecs];
        saveRecords(merged);
        setRecords(merged);
        alert(`${newRecs.length}건 가져오기 완료 (총 ${merged.length}건)`);
      } catch {
        alert("파일을 읽을 수 없습니다. 올바른 RFQ 백업 파일인지 확인하세요.");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  }
  function handleLoadRev(rev: RfqRevision, rid: string) { setActiveId(rid); setCustomer(rev.customer); setSpec(rev.spec); setCommentDraft(""); setIsDirty(false); }

  // 특정 revision 삭제
  function handleDeleteRev(recordId: string, revNum: number) {
    if (!confirm(`Rev.${revNum}을 삭제하시겠습니까?`)) return;
    const rec = records.find((r) => r.id === recordId);
    if (!rec) return;
    const updated_rec = deleteRevision(rec, revNum);
    let updated: RfqRecord[];
    if (!updated_rec) {
      updated = records.filter((r) => r.id !== recordId);
      if (activeId === recordId) { setActiveId(null); setCustomer(emptyCustomer()); setSpec(emptySpec()); setIsDirty(false); }
    } else {
      updated = records.map((r) => r.id === recordId ? updated_rec : r);
      if (activeId === recordId) {
        const last = updated_rec.revisions[updated_rec.revisions.length - 1];
        setCustomer(last.customer); setSpec(last.spec); setIsDirty(false);
      }
    }
    saveRecords(updated); setRecords(updated);
  }

  // revision 코멘트 수정
  function handleUpdateRevComment(recordId: string, revNum: number, comment: string) {
    const rec = records.find((r) => r.id === recordId);
    if (!rec) return;
    const updated_rec = updateRevisionComment(rec, revNum, comment);
    const updated = records.map((r) => r.id === recordId ? updated_rec : r);
    saveRecords(updated); setRecords(updated);
  }
  // RFQ 목록: 고객사별 그룹핑 + 시간순
  const groupedRecords = useMemo(() => {
    const groups = new Map<string, RfqRecord[]>();
    const sorted = [...records].sort((a, b) => {
      const al = a.revisions[a.revisions.length - 1].savedAt;
      const bl = b.revisions[b.revisions.length - 1].savedAt;
      return bl.localeCompare(al); // newest first
    });
    for (const rec of sorted) {
      const last = rec.revisions[rec.revisions.length - 1];
      const company = last.customer.company || "(미입력)";
      if (!groups.has(company)) groups.set(company, []);
      groups.get(company)!.push(rec);
    }
    return groups;
  }, [records]);

  function handleCsv(rev: RfqRevision) { downloadCsv(rev, `RFQ_${rev.customer.company || "draft"}_Rev${rev.rev}.csv`); }
  function handleXls(rev: RfqRevision) { downloadXls(rev, `RFQ_${rev.customer.company || "draft"}_Rev${rev.rev}.xls`); }

  // PDF 출력 — 화면의 실제 폼을 그대로 인쇄 (window.print 사용)
  // @media print CSS 가 폼 외 영역(헤더, 사이드바, Outlook 패널 등)을 숨김
  function handlePdf() {
    // 인쇄 직전 파일명을 위해 document.title 임시 변경
    const _now = new Date();
    const _ymd = `${_now.getFullYear()}${String(_now.getMonth() + 1).padStart(2, "0")}${String(_now.getDate()).padStart(2, "0")}`;
    const _safeCompany = (customer.company || "Draft").trim().replace(/[\\/:*?"<>|\r\n\t]/g, "").replace(/\s+/g, "");
    const fileTitle = `${_safeCompany}_사양요청서_${_ymd}`;
    const originalTitle = document.title;
    document.title = fileTitle;
    // 빈 select 들에 data-print-empty 표시 — CSS 에서 placeholder 텍스트 숨기기 위함
    const emptySelects: HTMLSelectElement[] = [];
    document.querySelectorAll<HTMLSelectElement>("#rfq-print-area select").forEach((s) => {
      if (!s.value) {
        s.setAttribute("data-print-empty", "true");
        emptySelects.push(s);
      }
    });
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        // 정리: 표시 제거 + 제목 복원
        emptySelects.forEach((s) => s.removeAttribute("data-print-empty"));
        document.title = originalTitle;
      }, 1000);
    }, 50);
  }
  function handleDelete(id: string) {
    if (!confirm("이 RFQ를 삭제하시겠습니까?")) return;
    const updated = records.filter((r) => r.id !== id);
    saveRecords(updated); setRecords(updated);
    if (activeId === id) { setActiveId(null); setCustomer(emptyCustomer()); setSpec(emptySpec()); }
  }

  const recommended = useMemo(() => recommendModels(spec), [spec]);

  // ── 제안서 helpers ────────────────────────────────────────────────────────
  const proposalModels = useMemo(
    () => recommended.filter((m) => proposalKeys.includes(m.modelKey)),
    [recommended, proposalKeys],
  );

  function toggleProposalKey(key: string) {
    setProposalKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : prev.length < 5 ? [...prev, key] : prev,
    );
  }

  function openProposal() {
    setProposalKeys([]);
    setProposalHtml(null);
    setProposalStep(1);
    setProposalOpen(true);
  }

  // ── 카탈로그 PDF 의 특정 페이지를 PNG dataURL 로 렌더링 (무손실 고해상도) ──
  // pdfjs-dist 를 동적 import 해서 SSR 빌드 영향 없도록 함
  async function renderCatalogPagesToImages(
    pages: number[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<{ page: number; dataUrl: string }[]> {
    if (typeof window === "undefined" || pages.length === 0) return [];
    // 같은 페이지 중복 호출 방지 — 호출자에서 이미 dedup 했지만 안전 장치
    const uniquePages = [...new Set(pages)].sort((a, b) => a - b);

    // pdfjs-dist 동적 import — 패키지 메인 엔트리(타입 포함)
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

    // 카탈로그 PDF 로드 (한 번만)
    const loadingTask = pdfjs.getDocument("/docs/AE Catalogue2026.pdf");
    const pdf = await loadingTask.promise;

    const out: { page: number; dataUrl: string }[] = [];
    let done = 0;
    for (const pageNum of uniquePages) {
      if (pageNum < 1 || pageNum > pdf.numPages) {
        done++;
        onProgress?.(done, uniquePages.length);
        continue;
      }
      try {
        const page = await pdf.getPage(pageNum);
        // ★ 해상도 보존: scale 2.5 = ~180 DPI (인쇄 품질 충분)
        //   디스플레이 해상도 보정을 위해 devicePixelRatio 도 곱함 (선택)
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const renderScale = 2.5 * dpr;
        const viewport = page.getViewport({ scale: renderScale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) { done++; onProgress?.(done, uniquePages.length); continue; }
        // 흰색 배경 채우기 (PNG 안티앨리어싱 모서리 깔끔)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        // ★ PNG 무손실 인코딩 — 카탈로그의 텍스트·도면 선명도 유지
        const dataUrl = canvas.toDataURL("image/png");
        out.push({ page: pageNum, dataUrl });
        // 큰 캔버스 메모리 해제
        canvas.width = 0;
        canvas.height = 0;
      } catch (e) {
        console.warn(`카탈로그 ${pageNum} 페이지 렌더링 실패:`, e);
      }
      done++;
      onProgress?.(done, uniquePages.length);
    }
    await pdf.cleanup();
    return out;
  }

  // ── 카탈로그 페이지 섹션 HTML 생성 ──────────────────────────────────────
  // 각 모델별로 명확한 구분 + 모든 페이지 순차 출력
  function buildCatalogPagesSection(
    rendered: { modelName: string; sectionLabel: string | null; pages: { page: number; dataUrl: string }[] }[],
  ): string {
    if (rendered.length === 0) return "";
    const esc = (v: string) => (v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const totalProducts = rendered.filter((r) => r.pages.length > 0).length;

    const sections = rendered.map((r, modelIdx) => {
      if (r.pages.length === 0) return "";
      const startP = r.pages[0].page;
      const endP = r.pages[r.pages.length - 1].page;
      const pageRangeStr = startP === endP ? `p. ${startP}` : `pp. ${startP} – ${endP}`;

      // 명확한 모델 구분 — 사이드 컬러 바 + 모델명 + 진행번호
      const modelDivider = `
<div style="page-break-before:always;padding:50px 0 24px;">
  <div style="border-left:8px solid #0078D4;background:#f0f7ff;padding:18px 22px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
      <div>
        <div style="font-size:9px;color:#0078D4;letter-spacing:0.2em;font-weight:700;margin-bottom:2px;">
          PRODUCT ${modelIdx + 1} / ${totalProducts}
        </div>
        <div style="font-size:24px;color:#0a1929;font-weight:900;letter-spacing:-0.01em;line-height:1.1;">${esc(r.modelName)}</div>
      </div>
      <div style="text-align:right;">
        <div style="display:inline-block;background:#0078D4;color:#fff;padding:5px 12px;border-radius:3px;font-size:9.5px;font-weight:700;letter-spacing:0.08em;">
          ${r.pages.length} 페이지
        </div>
        <div style="font-size:9px;color:#64748b;margin-top:4px;font-weight:600;">${pageRangeStr}</div>
      </div>
    </div>
    ${r.sectionLabel ? `
    <div style="border-top:1px solid #c3d5f4;padding-top:8px;margin-top:8px;">
      <span style="font-size:9px;color:#475569;letter-spacing:0.06em;">CATALOGUE SECTION:</span>
      <span style="font-size:11px;color:#1e40af;font-weight:700;margin-left:6px;">${esc(r.sectionLabel)}</span>
    </div>` : ""}
  </div>
</div>`;

      // 각 페이지에 명확한 모델명 + 진행번호 라벨
      const pagesHtml = r.pages.map((p, idx) =>
        `<div style="page-break-before:always;page-break-inside:avoid;margin:0;padding:0;">
          <div style="background:#0078D4;color:#fff;padding:5px 10px;font-size:9.5px;font-weight:700;display:flex;justify-content:space-between;align-items:center;letter-spacing:0.04em;">
            <span>${esc(r.modelName)}${r.sectionLabel ? ` &nbsp;<span style="opacity:0.75;font-weight:500;">· ${esc(r.sectionLabel)}</span>` : ""}</span>
            <span style="opacity:0.85;">CATALOGUE p.${p.page} &nbsp;·&nbsp; ${idx + 1}/${r.pages.length}</span>
          </div>
          <img src="${p.dataUrl}" alt="${esc(r.modelName)} catalogue p.${p.page}"
            style="width:100%;height:auto;display:block;border:1px solid #d4d4d8;"/>
        </div>`
      ).join("");
      return modelDivider + pagesHtml;
    }).join("");

    const totalPages = rendered.reduce((acc, r) => acc + r.pages.length, 0);
    const totalModels = rendered.filter((r) => r.pages.length > 0).length;

    return `
<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- 부록: 카탈로그 페이지 (선택 제품 원본 페이지)                    -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<div style="page-break-before:always;">
  <div class="sec-title" style="margin-top:0;">부록 — 카탈로그 원본 페이지 <span>Appendix · Catalogue Pages</span></div>
  <p style="font-size:9.5px;color:#475569;margin-bottom:14px;line-height:1.7;">
    제안 대상 제품들의 카탈로그 원본 페이지를 모두 포함합니다 (총 <strong>${totalModels}</strong>개 제품 · <strong>${totalPages}</strong> 페이지). 각 페이지는 원본 해상도 그대로 무손실(PNG) 포함되며, 자세한 사양·치수·핀배치·블록 다이어그램 등은 본 부록을 직접 참조해 주세요.
  </p>
</div>
${sections}`;
  }

  // ── 모델 → 카탈로그 datasheet 페이지 범위 계산 ──────────────────────
  // 알고리즘 (3단계 우선순위):
  //   ① 섹션명 정확 매칭: 섹션 이름이 모델명(또는 시리즈명)과 일치하면 섹션 전체 페이지
  //      예: "CoolX®600 Series" + 모델="CoolX600" → pp.24~25 전부
  //      예: "TF Series" + 모델="TF200" → pp.84~87 전부 (TF Series 가 모델 prefix 매칭)
  //   ② 시리즈 섹션 + variant prefix 매칭: 섹션 안에서 같은 prefix variant 의 페이지 합집합
  //      예: "LCM Series"(LCM600 기준) → variant LCM600L/N/Q/U/W 의 페이지 = pp.76~77
  //   ③ 폴백: m.pages 그대로
  //
  // 데이터 분석 결과:
  //   • LCM600 m.pages=[44,76], LCM600L/N/Q/U/W m.pages=[77] → ② 적용 → [76,77] ✓
  //   • CoolX600 m.pages=[44] (Healthcare 요약), 별도 "CoolX®600 Series" pp.24~25 → ① 적용 → [24,25] ✓
  //   • TF200 → "TF Series" 섹션이 prefix 매칭 → ① 적용 → 섹션 전체
  function getDatasheetPagesFor(model: Model): { pages: number[]; sectionLabel: string | null } {
    const sections = catalog.sections;
    const allModels = catalog.models;
    const modelName = model.model;

    // 정규화: 소문자 + ®™§ 등 특수문자 제거 + 공백 제거 + "Series" 접미어 제거
    const norm = (s: string) => s.toLowerCase().replace(/[®™§©]/g, "").replace(/\s+series\s*$/i, "").replace(/\s+/g, "");
    const modelNorm = norm(modelName);

    // variant prefix 매칭 함수
    //   suffix 첫 글자가 숫자면 variant 가 아님 (model number 의 일부일 가능성 큼)
    //   예: "LCM3000" 은 "LCM300" 의 variant 가 아님 (숫자 추가 = 다른 wattage class)
    //   예: "LCM300L" 은 variant ✓ (suffix "L" — 출력 전압 designation)
    function isVariantOf(candidate: string, base: string): boolean {
      if (candidate === base) return true;
      if (!candidate.startsWith(base)) return false;
      const suffix = candidate.slice(base.length);
      if (suffix.length === 0 || suffix.length > 6) return false;
      if (/^[0-9]/.test(suffix)) return false; // ★ 숫자 시작 suffix 거부
      return /^[A-Za-z0-9-]+$/.test(suffix);
    }

    // ── ① EXACT 섹션명 매칭 (가장 강력, 최우선) ────────────────────────
    //   섹션명이 모델명과 정확히 일치 → 그 섹션이 모델의 전용 섹션
    //   예: "CoolX®600 Series" === "CoolX600" → pp.24-25
    for (const sec of sections) {
      if (norm(sec.section) === modelNorm) {
        const pages: number[] = [];
        for (let p = sec.startPage; p <= sec.endPage; p++) pages.push(p);
        return { pages, sectionLabel: sec.section };
      }
    }

    // ── ② Variant prefix 매칭 — base 후보를 단계적으로 시도 ─────────────
    //   case A: 모델 자신이 base ⇒ "LCM600" 입력시 LCM600L/N/Q/U/W variant 매칭
    //   case B: 모델 자신이 variant ⇒ "LCM600W" 입력시 base "LCM600" 추출 → 동일 family
    //   알고리즘: modelName 부터 4자까지 줄여가며 가장 긴 (구체적인) base 우선
    const candidateBases: string[] = [modelName];
    for (let strip = 1; strip <= 4; strip++) {
      const candidate = modelName.slice(0, modelName.length - strip);
      if (candidate.length >= 4) candidateBases.push(candidate);
    }

    let bestVariant: { section: typeof sections[0]; base: string; variantNames: string[] } | null = null;
    let bestVariantScore = 0;
    for (const base of candidateBases) {
      for (const sec of sections) {
        const variantNames = sec.models.filter((mn) => isVariantOf(mn, base) && mn !== modelName);
        if (variantNames.length < 2) continue;
        const inSectionPages = model.pages.filter((p) => p >= sec.startPage && p <= sec.endPage).length;
        const score = base.length * 100 + variantNames.length * 10 + inSectionPages * 5;
        if (score > bestVariantScore) {
          bestVariant = { section: sec, base, variantNames };
          bestVariantScore = score;
        }
      }
    }
    if (bestVariant) {
      const pageSet = new Set<number>();
      // 모델 자신의 페이지 (섹션 범위 내)
      for (const p of model.pages) {
        if (p >= bestVariant.section.startPage && p <= bestVariant.section.endPage) pageSet.add(p);
      }
      // ★ allModels 전체에서 base prefix 매칭되는 모든 모델의 페이지 수집
      //   (section.models 가 LCM600 처럼 base 모델을 누락할 수 있어 보완)
      for (const am of allModels) {
        if (am.model === modelName) continue;
        if (!isVariantOf(am.model, bestVariant.base)) continue;
        for (const p of am.pages) {
          if (p >= bestVariant.section.startPage && p <= bestVariant.section.endPage) pageSet.add(p);
        }
      }
      if (pageSet.size > 0) {
        return { pages: [...pageSet].sort((a, b) => a - b), sectionLabel: bestVariant.section.section };
      }
    }

    // ── ①' PREFIX 섹션명 매칭 (모델이 섹션명으로 시작) ─────────────────
    //   섹션명에 숫자가 있어야 매칭 (generic prefix "lcm" 차단)
    let bestNameMatch: typeof sections[0] | null = null;
    let bestNameMatchLen = 0;
    for (const sec of sections) {
      const secNorm = norm(sec.section);
      if (!secNorm || secNorm.length < 3) continue;
      const hasDigit = /\d/.test(secNorm);
      const isPrefix = hasDigit && modelNorm.startsWith(secNorm) && secNorm !== modelNorm;
      if (isPrefix && secNorm.length > bestNameMatchLen) {
        bestNameMatch = sec;
        bestNameMatchLen = secNorm.length;
      }
    }
    if (bestNameMatch) {
      const pages: number[] = [];
      for (let p = bestNameMatch.startPage; p <= bestNameMatch.endPage; p++) pages.push(p);
      return { pages, sectionLabel: bestNameMatch.section };
    }

    // ── ①'' 모델이 section.models 에 있는 단일 섹션 ───────────────────
    const sectionsWithModel = sections.filter((sec) => sec.models.includes(modelName));
    if (sectionsWithModel.length > 0) {
      const best = sectionsWithModel.sort((a, b) =>
        (a.endPage - a.startPage) - (b.endPage - b.startPage)
      )[0];
      const pages: number[] = [];
      for (let p = best.startPage; p <= best.endPage; p++) pages.push(p);
      return { pages, sectionLabel: best.section };
    }

    // ── ③ 폴백: m.pages 그대로 ───────────────────────────────────────
    return {
      pages: [...new Set(model.pages)].sort((a, b) => a - b),
      sectionLabel: model.section,
    };
  }

  // ── 카탈로그 페이지 포함 제안서 생성 (비동기) ──────────────────────────
  async function buildProposalWithCatalogPages(models: Model[]): Promise<string> {
    let baseHtml = buildProposalHtml(models);
    if (!includeCatalogPages) return baseHtml;

    // 각 모델의 datasheet 섹션 페이지 range 계산
    const targets = models.map((m) => {
      const { pages, sectionLabel } = getDatasheetPagesFor(m);
      return { modelName: m.model, sectionLabel, pages };
    }).filter((t) => t.pages.length > 0);

    if (targets.length === 0) return baseHtml;

    // 전 모델 통합 고유 페이지 (PDF 1번만 로드, 페이지 1번만 렌더)
    const uniquePages = [...new Set(targets.flatMap((t) => t.pages))].sort((a, b) => a - b);
    if (uniquePages.length === 0) return baseHtml;

    setCatalogPagesGenerating(true);
    setCatalogPagesProgress({ done: 0, total: uniquePages.length });

    const rendered = await renderCatalogPagesToImages(uniquePages, (done, total) => {
      setCatalogPagesProgress({ done, total });
    });

    // 모델별로 매핑 (같은 페이지를 여러 모델이 공유하면 dataURL 재사용)
    const byPage = new Map<number, string>();
    for (const r of rendered) byPage.set(r.page, r.dataUrl);
    const grouped: { modelName: string; sectionLabel: string | null; pages: { page: number; dataUrl: string }[] }[] = targets.map((t) => ({
      modelName: t.modelName,
      sectionLabel: t.sectionLabel,
      pages: t.pages.filter((p) => byPage.has(p)).map((p) => ({ page: p, dataUrl: byPage.get(p)! })),
    }));

    const catalogSection = buildCatalogPagesSection(grouped);
    // Sentinel 기반 삽입 (regex 보다 안정적)
    if (baseHtml.includes("<!-- ▼▼▼ CATALOG_PAGES_INSERTION_POINT ▼▼▼ -->")) {
      baseHtml = baseHtml.replace(
        "<!-- ▼▼▼ CATALOG_PAGES_INSERTION_POINT ▼▼▼ -->",
        catalogSection,
      );
    } else {
      // 폴백: </body> 직전에 삽입
      baseHtml = baseHtml.replace("</body>", `${catalogSection}\n</body>`);
    }

    setCatalogPagesGenerating(false);
    return baseHtml;
  }

  // ── buildProposalHtml: 전문가 수준 제안서 HTML ──────────────────────────
  function buildProposalHtml(models: Model[]): string {
    const c = customer;
    const s = spec;
    const now = new Date();
    const todayStr = now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
    // PDF 저장 시 기본 파일명용 (브라우저는 <title> 을 파일명으로 사용)
    // 형식: {회사명}_제안서_{YYYYMMDD}
    const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    // 파일명에 사용 불가한 특수문자 제거 (공백·점·언더스코어는 보존)
    const safeCompany = (c.company || "고객사").trim().replace(/[\\/:*?"<>|\r\n\t]/g, "").replace(/\s+/g, "");
    const fileTitle = `${safeCompany}_제안서_${yyyymmdd}`;
    const propNo = `PROP-${(activeId ?? "NEW").slice(0, 6).toUpperCase()}`;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const esc = (v: string) => (v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const rec = models[0]; // 추천 제품 (첫 번째 선택)
    const appLabel = s.application || "해당 응용 분야";
    const companyLabel = c.company || "귀사";
    const projLabel = c.customerProject || "해당 프로젝트";
    const powerLabel = s.totalPower || "요구 출력";
    const ffLabel = s.formFactor || "해당 폼팩터";

    // ── 제안 개요 문단 (auto-generated) ──────────────────────────────────
    const execSummary = `본 제안서는 ${esc(companyLabel)} ${esc(projLabel)}의 ${esc(appLabel)} 응용을 위한 SMPS 전원 공급 장치 선정을 지원하기 위해 작성되었습니다.
${c.meetingDate ? `${esc(c.meetingDate)} 미팅을 통해 확인된 요구 사양을 기반으로,` : "요구 사양 검토를 바탕으로,"} Advanced Energy의 ${esc(ffLabel)} 제품군에서 ${esc(powerLabel)} 출력 범위에 최적화된 솔루션 <strong>${models.length}종</strong>을 선정하여 상세 사양 비교 및 추천 제품을 제안드립니다.
본 제안서의 내용은 고객 요구 사양 분석 → 제품 비교표 → 추천 제품 → 기술적 장점 → 향후 진행 사항 순으로 구성되어 있습니다.`;

    // ── 고객 사양 rows ────────────────────────────────────────────────────
    const specRows: [string, string, string][] = [
      ["입력 사양", "입력 전압 범위", s.inputVoltageRange],
      ["입력 사양", "입력 위상", s.inputPhase],
      ["입력 사양", "입력 주파수", s.inputFrequency],
      ["출력 사양", "총 출력 전력", s.totalPower],
      ["출력 사양", "출력 레귤레이션", s.outputRegulation],
      ["출력 사양", "리플/노이즈", s.rippleNoise],
      ["외형 / 냉각", "폼팩터", s.formFactor],
      ["외형 / 냉각", "냉각 방식", s.cooling],
      ["기능 요구", "기능 요구사항", s.features.join(", ")],
      ["기능 요구", "보호 기능", s.protections.join(", ")],
      ["인증 / 응용", "요구 인증", s.certifications.join(", ")],
      ["인증 / 응용", "응용 분야", s.application],
      ["인증 / 응용", "납기 목표", s.targetDate],
      ["양산 계획", "양산 시점", c.mpqStart],
      ["양산 계획", "양산 수량", c.mpqQuantity],
      ["양산 계획", "샘플 요청", c.sampleRequested],
    ].filter(([, , v]) => v) as [string, string, string][];

    let lastGroup = "";
    const specRowsHtml = specRows.map(([group, label, value]) => {
      const isNewGroup = group !== lastGroup;
      lastGroup = group;
      return `<tr>
        ${isNewGroup ? `<td rowspan="${specRows.filter(([g]) => g === group).length}" style="padding:5px 8px;font-size:9px;font-weight:700;background:#dbeafe;color:#1e40af;border:1px solid #c3d5f4;text-align:center;vertical-align:middle;white-space:nowrap;">${esc(group)}</td>` : ""}
        <td style="padding:5px 8px;font-size:9.5px;font-weight:600;background:#f8fafc;border:1px solid #e2e8f0;white-space:nowrap;color:#334155;">${esc(label)}</td>
        <td style="padding:5px 8px;font-size:9.5px;border:1px solid #e2e8f0;color:#111;">${esc(value)}</td>
      </tr>`;
    }).join("");

    // ── 비교 테이블 ───────────────────────────────────────────────────────
    // 좌측 2열(그룹 8% + 라벨 14%) = 22% / 나머지 78% 를 모델 수로 균등 분할
    const colW = Math.floor(78 / Math.max(models.length, 1));
    const cmpRows: Array<{ label: string; group: string; fn: (m: Model) => string }> = [
      { group: "제품 정보", label: "제품명", fn: (m) => `<strong style="color:#0078D4;font-size:10px;">${esc(m.model)}</strong>` },
      { group: "제품 정보", label: "제품군", fn: (m) => esc(m.lineage ?? "—") },
      { group: "제품 정보", label: "카테고리", fn: (m) => esc(m.subcategory ?? m.section ?? "—") },
      { group: "전기 사양", label: "출력 전력", fn: (m) => m.watts.slice(0, 4).map(esc).join("<br/>") || "—" },
      { group: "전기 사양", label: "출력 전압", fn: (m) => m.volts.slice(0, 4).map(esc).join(", ") || "—" },
      { group: "전기 사양", label: "출력 전류", fn: (m) => m.amps.slice(0, 3).map(esc).join(", ") || "—" },
      { group: "전기 사양", label: "입력 사양", fn: (m) => esc(m.input ?? "—") },
      { group: "참고 정보", label: "주요 특징", fn: (m) => m.contextLines.slice(0, 5).map((l) => `• ${esc(l)}`).join("<br/>") || "—" },
      { group: "참고 정보", label: "카탈로그 페이지", fn: (m) => m.pages.slice(0, 3).join(", ") || "—" },
    ];

    let lastCmpGroup = "";
    const cmpRowsHtml = cmpRows.map((row, ri) => {
      const isNewGroup = row.group !== lastCmpGroup;
      lastCmpGroup = row.group;
      const groupRowspan = cmpRows.filter((r) => r.group === row.group).length;
      // ★ 데이터 셀에 word-break / overflow-wrap 추가 — 긴 문자열 (BULK/DISTRIBUTED/ENCLOSED 등) 자동 줄바꿈
      const cellWrap = "word-break:break-word;overflow-wrap:anywhere;hyphens:auto;";
      return `<tr>
        ${isNewGroup ? `<td rowspan="${groupRowspan}" style="padding:5px 8px;font-size:9px;font-weight:700;background:#dbeafe;color:#1e40af;border:1px solid #c3d5f4;text-align:center;vertical-align:middle;writing-mode:horizontal-tb;${cellWrap}">${esc(row.group)}</td>` : ""}
        <td style="padding:6px 8px;font-size:9.5px;font-weight:600;background:#f8fafc;border:1px solid #e2e8f0;color:#334155;${cellWrap}">${esc(row.label)}</td>
        ${models.map((m, ci) => `<td style="padding:6px 8px;font-size:9.5px;border:1px solid #e2e8f0;text-align:center;vertical-align:top;${cellWrap}${ci === 0 ? "background:#f0f7ff;" : ri % 2 === 0 ? "background:#fff;" : "background:#fafafa;"}">${row.fn(m)}</td>`).join("")}
      </tr>`;
    }).join("");

    // ── 추천 이유 (기술적 장점) ───────────────────────────────────────────
    const advList: string[] = [];
    if (s.certifications.includes("IEC 60601-1 (의료)")) advList.push("의료 등급 절연 및 IEC 60601-1 안전 규격 대응 설계");
    if (s.features.some((f) => f.includes("PMBus"))) advList.push("PMBus / I²C 디지털 제어 인터페이스 내장으로 시스템 통합 용이");
    if (s.features.some((f) => f.includes("병렬"))) advList.push("병렬 운전(Parallel Operation) 지원으로 N+1 이중화 구성 가능");
    if (s.features.some((f) => f.includes("PFC"))) advList.push("Active PFC 내장으로 입력 역률 0.99 이상 달성, 고조파 전류 규제(EN 61000-3-2) 준수");
    if (s.cooling?.includes("무팬") || s.cooling?.includes("Fanless")) advList.push("팬리스 무음 설계로 유지보수 불필요, 내진동·내충격 환경에 최적");
    if ((s.formFactor || "").includes("Modular") || (s.formFactor || "").includes("모듈")) advList.push("모듈형 구조로 현장 요구에 따른 출력 채널 유연한 구성·확장 가능");
    if (advList.length === 0) {
      advList.push("Advanced Energy의 40년 이상 전력 기술 노하우 기반 고신뢰성 설계");
      advList.push("전 세계 주요 반도체·산업·의료 고객사에 납품 실적 검증된 제품");
    }
    advList.push(`${esc(appLabel)} 분야 레퍼런스 다수 보유, 국내 기술 지원 및 A/S 체계 구비`);
    advList.push("RoHS / REACH 준수, 글로벌 인증 취득으로 수출 제품 적용 가능");

    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<title>${esc(fileTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=swap" rel="stylesheet"/>
<style>
  /* ══ 화면 미리보기: zoom으로 전체 균일 확대 ════════════════════════ */
  /* zoom은 인라인 style px값까지 포함 모든 요소를 비례 확대함         */
  html { zoom: 1.75; }

  /* ══ Base ═══════════════════════════════════════════════════════════ */
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Gowun Dodum', 'Malgun Gothic', 'Apple SD Gothic Neo', Arial, sans-serif;
    font-size: 10px;
    line-height: 1.7;
    color: #1a1a1a;
    background: #e8e8ea;
  }
  .page {
    max-width: 860px;
    margin: 20px auto;
    padding: 28px 56px;
    background: #fff;
    box-shadow: 0 2px 16px rgba(0,0,0,0.12);
    border-radius: 4px;
  }
  .sec-title { font-size: 11.5px; font-weight: 800; color: #0078D4; border-bottom: 2.5px solid #0078D4; padding-bottom: 4px; margin: 18px 0 8px; letter-spacing: 0.02em; }
  .sec-title span { font-size: 9px; font-weight: 400; color: #64748b; margin-left: 8px; }
  p { margin-bottom: 6px; }
  table { border-collapse: collapse; width: 100%; }
  .label-cell { padding: 5px 8px; font-size: 9.5px; font-weight: 600; background: #f8fafc; border: 1px solid #e2e8f0; white-space: nowrap; color: #334155; }
  .val-cell { padding: 5px 8px; font-size: 9.5px; border: 1px solid #e2e8f0; color: #111; }
  .pill { display: inline-block; background: #0078D4; color: #fff; border-radius: 10px; padding: 1px 7px; font-size: 8px; font-weight: 700; margin-right: 3px; }
  .pill-alt { background: #64748b; }
  .no-break { page-break-inside: avoid; }

  /* ══ 인쇄: zoom 리셋 + A4 ════════════════════════════════════════ */
  /* @page margin: 0 → 브라우저 기본 헤더/푸터 (날짜·URL·제목·페이지번호) 영역 제거 */
  /* 본문 자체 여백은 body padding 으로 대체 */
  @page { size: A4 portrait; margin: 0; }
  @media print {
    html { zoom: 1; }
    body { background: #fff; font-size: 9.5px; padding: 12mm 10mm; margin: 0; }
    .page { padding: 0; box-shadow: none; border-radius: 0; max-width: none; margin: 0; }
    .sec-title { font-size: 11.5px; margin: 14px 0 6px; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  .page { margin: 0 auto; }
  .sec-title { font-weight: 800; color: #0078D4; border-bottom: 2.5px solid #0078D4; padding-bottom: 5px; letter-spacing: 0.02em; }
  .sec-title span { font-weight: 400; color: #64748b; margin-left: 8px; }
  p { margin-bottom: 7px; }
  table { border-collapse: collapse; width: 100%; }
  .label-cell { font-weight: 600; background: #f8fafc; border: 1px solid #e2e8f0; white-space: nowrap; color: #334155; }
  .val-cell { border: 1px solid #e2e8f0; color: #111; }
  .pill { display: inline-block; background: #0078D4; color: #fff; border-radius: 10px; font-weight: 700; margin-right: 3px; }
  .pill-alt { background: #64748b; }
</style>
</head>
<body>
<div class="page">

<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- COVER HEADER                                                   -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<div style="display:flex;align-items:stretch;margin-bottom:16px;">
  <!-- Blue accent bar -->
  <div style="width:5px;background:#0078D4;border-radius:3px 0 0 3px;margin-right:16px;flex-shrink:0;"></div>
  <div style="flex:1;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <img src="${origin}/logo.png" alt="Advanced Energy" style="height:38px;object-fit:contain;" crossorigin="anonymous"/>
      <div style="text-align:right;">
        <div style="font-size:20px;font-weight:900;color:#0078D4;letter-spacing:0.04em;line-height:1.1;">SMPS 전원 공급 장치</div>
        <div style="font-size:20px;font-weight:900;color:#1a1a1a;letter-spacing:0.02em;line-height:1.1;">제품 제안서</div>
        <div style="font-size:9px;color:#94a3b8;margin-top:4px;letter-spacing:0.08em;">PRODUCT PROPOSAL · ADVANCED ENERGY INDUSTRIES</div>
      </div>
    </div>
    <!-- Meta bar -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:10px 14px;display:flex;gap:24px;">
      <div style="flex:1;">
        <table style="border:none;width:auto;">
          <tr><td style="padding:2px 10px 2px 0;font-weight:700;font-size:9px;color:#64748b;white-space:nowrap;border:none;">수&nbsp;&nbsp;&nbsp;&nbsp;신</td><td style="padding:2px 0;font-size:9.5px;border:none;"><strong>${esc(c.company || "—")}</strong> ${esc(c.contactName ? c.contactName + " 담당자님" : "담당자님")}</td></tr>
          <tr><td style="padding:2px 10px 2px 0;font-weight:700;font-size:9px;color:#64748b;border:none;">프로젝트</td><td style="padding:2px 0;font-size:9.5px;border:none;">${esc(c.customerProject || "—")}</td></tr>
          <tr><td style="padding:2px 10px 2px 0;font-weight:700;font-size:9px;color:#64748b;border:none;">산업 분야</td><td style="padding:2px 0;font-size:9.5px;border:none;">${esc(c.industry || "—")}</td></tr>
          <tr><td style="padding:2px 10px 2px 0;font-weight:700;font-size:9px;color:#64748b;border:none;">참&nbsp;&nbsp;&nbsp;&nbsp;조</td><td style="padding:2px 0;font-size:9.5px;border:none;">${esc(c.contactEmail || "—")}</td></tr>
        </table>
      </div>
      <div style="border-left:1px solid #e2e8f0;"></div>
      <div>
        <table style="border:none;width:auto;">
          <tr><td style="padding:2px 10px 2px 0;font-weight:700;font-size:9px;color:#64748b;white-space:nowrap;border:none;">문서번호</td><td style="padding:2px 0;font-size:9.5px;border:none;"><strong>${esc(propNo)}</strong></td></tr>
          <tr><td style="padding:2px 10px 2px 0;font-weight:700;font-size:9px;color:#64748b;border:none;">작&nbsp;성&nbsp;일</td><td style="padding:2px 0;font-size:9.5px;border:none;">${esc(todayStr)}</td></tr>
          <tr><td style="padding:2px 10px 2px 0;font-weight:700;font-size:9px;color:#64748b;border:none;">발&nbsp;&nbsp;&nbsp;&nbsp;신</td><td style="padding:2px 0;font-size:9.5px;border:none;">${esc(c.salesperson || "AE Korea")}</td></tr>
          <tr><td style="padding:2px 10px 2px 0;font-weight:700;font-size:9px;color:#64748b;border:none;">Rev.</td><td style="padding:2px 0;font-size:9.5px;border:none;">1.0</td></tr>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- SECTION 1: 제안 개요 (Executive Summary)                       -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<div class="sec-title">1. 제안 개요 <span>Executive Summary</span></div>
<div class="no-break" style="background:#f0f7ff;border-left:4px solid #0078D4;border-radius:0 4px 4px 0;padding:10px 14px;font-size:9.5px;line-height:1.7;color:#1a1a1a;">
  ${execSummary}
</div>

<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- SECTION 2: Advanced Energy 소개                                -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<div class="sec-title">2. Advanced Energy 소개 <span>Company Overview</span></div>
<div class="no-break" style="display:flex;gap:12px;align-items:stretch;">
  <div style="flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:4px;padding:10px 14px;">
    <div style="font-weight:800;font-size:10.5px;color:#0078D4;margin-bottom:6px;">Advanced Energy Industries, Inc.</div>
    <p style="font-size:9px;color:#334155;line-height:1.65;">Advanced Energy(NASDAQ: AEIS)는 1981년 설립된 글로벌 전력 기술 선도 기업으로, 반도체 제조, 산업 자동화, 의료, 통신 등 다양한 분야에 정밀 전원 공급 장치(SMPS)를 공급합니다. 본사 미국 콜로라도, 전 세계 30개국 이상 영업망 보유, 누적 매출 수 십억 달러 규모의 글로벌 기업입니다.</p>
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;">
      <span class="pill">40년+ 기술 노하우</span>
      <span class="pill">NASDAQ 상장</span>
      <span class="pill">글로벌 30개국</span>
      <span class="pill">ISO 9001 인증</span>
      <span class="pill">RoHS / REACH</span>
    </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:8px;min-width:160px;">
    <div style="background:#0078D4;color:#fff;border-radius:4px;padding:8px 12px;text-align:center;">
      <div style="font-size:18px;font-weight:900;line-height:1;">40+</div>
      <div style="font-size:8px;margin-top:2px;opacity:0.9;">Years of Experience</div>
    </div>
    <div style="background:#f0f7ff;border:1px solid #c3d5f4;border-radius:4px;padding:8px 12px;text-align:center;">
      <div style="font-size:18px;font-weight:900;color:#0078D4;line-height:1;">IEC</div>
      <div style="font-size:8px;color:#64748b;margin-top:2px;">60601 / 62368 인증</div>
    </div>
    <div style="background:#f0f7ff;border:1px solid #c3d5f4;border-radius:4px;padding:8px 12px;text-align:center;">
      <div style="font-size:18px;font-weight:900;color:#0078D4;line-height:1;">MIL</div>
      <div style="font-size:8px;color:#64748b;margin-top:2px;">방산 등급 제품 라인</div>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- SECTION 3: 고객 요구 사양 분석                                 -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<div class="sec-title">3. 고객 요구 사양 분석 <span>Customer Requirements</span></div>
<div class="no-break">
  <p style="margin-bottom:8px;font-size:9px;color:#64748b;">아래 사양은 ${esc(c.meetingDate || "미팅")} 미팅 및 RFQ 사양서(${esc(docNo)})를 기반으로 정리하였습니다.</p>
  <table>
    <colgroup><col style="width:90px;"/><col style="width:130px;"/><col/></colgroup>
    <thead>
      <tr>
        <th style="padding:6px 8px;background:#0078D4;color:#fff;font-size:9.5px;font-weight:700;border:1px solid #0066bb;text-align:center;">구분</th>
        <th style="padding:6px 8px;background:#0078D4;color:#fff;font-size:9.5px;font-weight:700;border:1px solid #0066bb;">항목</th>
        <th style="padding:6px 8px;background:#0078D4;color:#fff;font-size:9.5px;font-weight:700;border:1px solid #0066bb;">요구 사양</th>
      </tr>
    </thead>
    <tbody>
      ${specRowsHtml || `<tr><td colspan="3" style="padding:8px;text-align:center;color:#aaa;font-size:9.5px;border:1px solid #e2e8f0;">사양 정보 없음</td></tr>`}
    </tbody>
  </table>
  ${s.outputChannels?.length > 0 ? `
  <div style="margin-top:8px;">
    <div style="font-size:9px;font-weight:700;color:#334155;margin-bottom:4px;">출력 채널 상세</div>
    <table>
      <thead>
        <tr>
          <th style="padding:5px 8px;background:#f8fafc;border:1px solid #e2e8f0;font-size:9px;font-weight:700;color:#334155;">채널</th>
          <th style="padding:5px 8px;background:#f8fafc;border:1px solid #e2e8f0;font-size:9px;font-weight:700;color:#334155;">전압 (V)</th>
          <th style="padding:5px 8px;background:#f8fafc;border:1px solid #e2e8f0;font-size:9px;font-weight:700;color:#334155;">전류 (A)</th>
          <th style="padding:5px 8px;background:#f8fafc;border:1px solid #e2e8f0;font-size:9px;font-weight:700;color:#334155;">전력 (W)</th>
        </tr>
      </thead>
      <tbody>
        ${s.outputChannels.map((ch, i) => `<tr>
          <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:center;font-size:9px;">CH${i + 1}</td>
          <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:center;font-size:9px;">${esc(ch.voltage) || "—"}</td>
          <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:center;font-size:9px;">${esc(ch.current) || "—"}</td>
          <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:center;font-size:9px;">${esc(ch.power) || "—"}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>` : ""}
</div>

<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- SECTION 4: 제안 제품 사양 비교표                               -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<div class="sec-title">4. 제안 제품 사양 비교표 <span>Product Comparison</span></div>
<div class="no-break">
  <table style="table-layout:fixed;width:100%;">
    <colgroup>
      <col style="width:8%;"/>
      <col style="width:14%;"/>
      ${models.map(() => `<col style="width:${colW}%;"/>`).join("")}
    </colgroup>
    <thead>
      <tr>
        <th style="padding:7px 8px;background:#0078D4;color:#fff;font-size:9.5px;font-weight:700;border:1px solid #0066bb;text-align:center;" colspan="2">비교 항목</th>
        ${models.map((m) => `<th style="padding:7px 8px;background:#0078D4;color:#fff;font-size:9.5px;font-weight:700;border:1px solid #0066bb;text-align:center;word-break:break-word;overflow-wrap:anywhere;">
          <span style="font-weight:700;">${esc(m.model)}</span>
        </th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${cmpRowsHtml}
    </tbody>
  </table>
</div>

<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- SECTION 5: 추천 제품 상세 & 선정 사유                          -->
<!-- ═══════════════════════════════════════════════════════════════ -->
${rec ? `
<div class="sec-title">5. 추천 제품 및 선정 사유 <span>Recommendation</span></div>
<div class="no-break">
  <div style="background:#e8f2fc;border:1.5px solid #0078D4;border-radius:6px;padding:12px 16px;margin-bottom:10px;">
    <div style="display:flex;align-items:flex-start;gap:12px;">
      <div style="flex:1;">
        <div style="font-size:14px;font-weight:900;color:#0078D4;margin-bottom:4px;">${esc(rec.model)}</div>
        <div style="font-size:9px;color:#334155;margin-bottom:6px;">
          <span class="pill">${esc(rec.lineage ?? "—")}</span>
          ${rec.subcategory ? `<span class="pill pill-alt">${esc(rec.subcategory)}</span>` : ""}
          ${rec.category ? `<span class="pill pill-alt">${esc(rec.category)}</span>` : ""}
        </div>
        <table style="border:none;width:auto;">
          <tr><td style="padding:2px 10px 2px 0;font-weight:700;font-size:9px;color:#64748b;border:none;white-space:nowrap;">출력 전력</td><td style="font-size:9.5px;border:none;">${rec.watts.join(", ") || "—"}</td></tr>
          <tr><td style="padding:2px 10px 2px 0;font-weight:700;font-size:9px;color:#64748b;border:none;white-space:nowrap;">출력 전압</td><td style="font-size:9.5px;border:none;">${rec.volts.slice(0, 5).join(", ") || "—"}</td></tr>
          <tr><td style="padding:2px 10px 2px 0;font-weight:700;font-size:9px;color:#64748b;border:none;white-space:nowrap;">입력 사양</td><td style="font-size:9.5px;border:none;">${esc(rec.input ?? "—")}</td></tr>
          <tr><td style="padding:2px 10px 2px 0;font-weight:700;font-size:9px;color:#64748b;border:none;white-space:nowrap;">카탈로그</td><td style="font-size:9.5px;border:none;">p.${rec.pages.slice(0, 3).join(", p.")}</td></tr>
        </table>
      </div>
    </div>
    ${rec.contextLines.length > 0 ? `
    <div style="margin-top:10px;border-top:1px solid #c3d5f4;padding-top:8px;">
      <div style="font-size:9px;font-weight:700;color:#0078D4;margin-bottom:4px;">주요 제품 특징</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;">
        ${rec.contextLines.slice(0, 6).map((l) => `<div style="font-size:9px;color:#334155;">▸ ${esc(l)}</div>`).join("")}
      </div>
    </div>` : ""}
  </div>
  <p style="font-size:9.5px;line-height:1.7;color:#1a1a1a;">
    <strong>${esc(rec.model)}</strong>은 귀사 ${esc(projLabel)}의 ${esc(appLabel)} 응용 환경에서 요구되는 ${esc(powerLabel)} 출력 요건을 충족하며,
    ${esc(ffLabel)} 규격에 부합하는 기계적 치수와 신뢰성을 제공합니다.
    Advanced Energy의 ${esc(rec.lineage ?? "해당 제품군")} 라인업은 글로벌 검증된 품질 기반으로 장기 안정 공급이 가능하며, 국내 기술 지원 및 현지 재고 운영을 통해 리드타임 리스크를 최소화할 수 있습니다.
  </p>
</div>` : ""}

<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- SECTION 6: 기술적 장점                                         -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<div class="sec-title">6. Advanced Energy 기술적 장점 <span>Technical Advantages</span></div>
<div class="no-break">
  <table>
    <tbody>
      ${advList.map((adv, i) => `<tr style="${i % 2 === 0 ? "background:#f8fafc;" : "background:#fff;"}">
        <td style="padding:6px 10px;border:1px solid #e2e8f0;width:20px;color:#0078D4;font-weight:700;font-size:10px;text-align:center;">-</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;font-size:9.5px;color:#1a1a1a;">${esc(adv)}</td>
      </tr>`).join("")}
    </tbody>
  </table>
</div>

<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- SECTION 7: 향후 진행 사항                                      -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<div class="sec-title">7. 향후 진행 사항 <span>Next Steps</span></div>
<div class="no-break">
  <table>
    <thead>
      <tr>
        <th style="padding:6px 8px;background:#0078D4;color:#fff;font-size:9.5px;font-weight:700;border:1px solid #0066bb;text-align:center;width:24px;">No.</th>
        <th style="padding:6px 8px;background:#0078D4;color:#fff;font-size:9.5px;font-weight:700;border:1px solid #0066bb;">진행 사항</th>
        <th style="padding:6px 8px;background:#0078D4;color:#fff;font-size:9.5px;font-weight:700;border:1px solid #0066bb;text-align:center;white-space:nowrap;">담당</th>
        <th style="padding:6px 8px;background:#0078D4;color:#fff;font-size:9.5px;font-weight:700;border:1px solid #0066bb;text-align:center;white-space:nowrap;">완료 기한</th>
      </tr>
    </thead>
    <tbody>
      ${[
        ["1", "본 제안서 검토 및 의견 회신", `${esc(companyLabel)} ${esc(c.contactName || "담당자")}`, c.responseDeadline ? esc(c.responseDeadline) : "협의"],
        ["2", "샘플 신청 및 평가 일정 수립", `AE ${esc(c.salesperson || "담당자")}`, "협의"],
        ["3", "기술 미팅 — 세부 사양 협의 (회로 연동, 커넥터, 인터페이스)", "양사", "협의"],
        ["4", "정식 RFQ 접수 및 공식 견적 제출", `${esc(companyLabel)} → AE`, "협의"],
        ["5", "인증 자료 / 데이터시트 / 컴플라이언스 문서 추가 제공", `AE ${esc(c.salesperson || "담당자")}`, "요청 시"],
      ].map(([no, task, resp, due], i) => `<tr style="${i % 2 === 0 ? "background:#fff;" : "background:#f8fafc;"}">
        <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;font-weight:700;color:#0078D4;font-size:9.5px;">${no}</td>
        <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:9.5px;">${task}</td>
        <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:9px;text-align:center;white-space:nowrap;color:#334155;">${resp}</td>
        <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:9px;text-align:center;white-space:nowrap;color:#334155;">${due}</td>
      </tr>`).join("")}
    </tbody>
  </table>
</div>

<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- SECTION 8: 맺음말                                              -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<div class="sec-title">8. 맺음말 <span>Closing</span></div>
<div class="no-break" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:12px 16px;font-size:9.5px;line-height:1.8;">
  <p>${esc(c.contactName || "담당자")}님, 본 제안서를 검토해 주셔서 진심으로 감사드립니다.</p>
  <p>Advanced Energy는 ${esc(companyLabel)}의 ${esc(projLabel)} 프로젝트가 성공적으로 진행될 수 있도록 최선을 다하여 기술적·상업적 지원을 제공할 것을 약속드립니다. 추가 문의사항이나 수정 요청이 있으시면 언제든지 연락 주시기 바라며, ${c.responseDeadline ? `<strong>${esc(c.responseDeadline)}</strong>까지 ` : ""}회신을 기다리겠습니다.</p>
</div>

<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- SIGNATURE / FOOTER                                             -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<div style="margin-top:16px;border-top:2.5px solid #0078D4;padding-top:12px;display:flex;align-items:flex-start;justify-content:space-between;">
  <div>
    <div style="font-weight:900;font-size:11px;color:#0078D4;">Advanced Energy Industries, Inc.</div>
    <div style="font-size:9px;color:#334155;margin-top:2px;">Korea Sales Engineering | 영업 엔지니어</div>
    <div style="font-size:9.5px;font-weight:700;color:#1a1a1a;margin-top:4px;">${esc(c.salesperson || "담당 영업")}</div>
    <div style="font-size:9px;color:#64748b;margin-top:1px;">E: ae-korea@aei.com &nbsp;|&nbsp; Web: www.advancedenergy.com</div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:9px;color:#94a3b8;">${esc(propNo)}</div>
    <div style="font-size:9px;color:#94a3b8;">${esc(todayStr)}</div>
    <div style="margin-top:4px;font-size:8px;color:#cbd5e1;">Advanced Energy Catalogue 2026</div>
    <div style="margin-top:4px;padding:3px 8px;background:#0078D4;color:#fff;border-radius:3px;font-size:8px;font-weight:700;display:inline-block;">CONFIDENTIAL</div>
  </div>
</div>

<!-- ▼▼▼ CATALOG_PAGES_INSERTION_POINT ▼▼▼ -->
</div>
</body>
</html>`;
  }

  // ── buildProposalEmailBody: 전문가 수준 이메일 본문 ──────────────────────
  function buildProposalEmailBody(models: Model[]): string {
    const c = customer;
    const s = spec;
    const rec = models[0];
    const propNo = `PROP-${(activeId ?? "NEW").slice(0, 6).toUpperCase()}`;
    const companyLabel = c.company || "귀사";
    const projLabel = c.customerProject ? `'${c.customerProject}'` : "해당 프로젝트";
    const appLabel = s.application || "해당 응용 분야";

    const specSummary = [
      s.totalPower && `  ▷ 총 출력 전력 : ${s.totalPower}`,
      s.formFactor && `  ▷ 폼팩터      : ${s.formFactor}`,
      s.inputVoltageRange && `  ▷ 입력 전압   : ${s.inputVoltageRange}`,
      s.cooling && `  ▷ 냉각 방식   : ${s.cooling}`,
      s.certifications.length && `  ▷ 요구 인증   : ${s.certifications.join(", ")}`,
      s.application && `  ▷ 응용 분야   : ${s.application}`,
      s.targetDate && `  ▷ 납기 목표   : ${s.targetDate}`,
    ].filter(Boolean).join("\n");

    const productList = models.map((m, i) =>
      `  ${i + 1}. ${m.model}${i === 0 ? "  ← 최우선 추천" : ""}\n` +
      `     제품군 : ${m.lineage ?? "—"} / ${m.subcategory ?? m.section ?? "—"}\n` +
      `     출력   : ${m.watts.slice(0, 3).join(", ") || "—"}` +
      (m.input ? `  |  입력 : ${m.input}` : "") + "\n" +
      (m.contextLines.slice(0, 2).map((l) => `     • ${l}`).join("\n") || "")
    ).join("\n\n");

    return `${c.contactName || "담당자"}님,

안녕하세요. Advanced Energy Korea ${c.salesperson || "영업 담당자"}입니다.

${c.meetingDate ? `지난 ${c.meetingDate} 미팅에서 논의해 주신 ` : ""}${appLabel} 분야의 SMPS 전원 공급 장치 선정과 관련하여, 당사의 검토 결과를 첨부 제안서(${propNo})로 정리하여 전달드립니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 제안 배경 및 요구 사양 요약
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${companyLabel} ${projLabel}에서 요구하시는 주요 사양을 아래와 같이 확인하였으며, 이를 기반으로 Advanced Energy 제품 라인업에서 최적 매칭 솔루션을 선정하였습니다.

${specSummary || "  (사양 정보 없음)"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 제안 제품 목록 (총 ${models.length}종 비교)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${productList || "  (제품 정보 없음)"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 최우선 추천 제품
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${rec ? `${rec.model}

  Advanced Energy의 ${rec.lineage ?? "해당 제품군"} 라인업 중 귀사 요구 사양에 가장 부합하는 제품으로 추천드립니다.
${rec.contextLines.slice(0, 4).map((l) => `  • ${l}`).join("\n")}

  - 출력 전력  : ${rec.watts.join(", ") || "—"}
  - 입력 사양  : ${rec.input ?? "—"}
  - 카탈로그   : p.${rec.pages.slice(0, 3).join(", p.")}` : "  (제품 선택 없음)"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 향후 진행 사항 (Next Steps)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  □ 본 제안서 검토 후 의견 회신${c.responseDeadline ? ` (기한: ${c.responseDeadline})` : ""}
  □ 샘플 신청 및 평가 일정 수립
  □ 기술 미팅 — 세부 회로 연동 / 커넥터 / 인터페이스 검토
  □ 정식 RFQ 접수 및 공식 견적 제출
  □ 인증 자료 / 데이터시트 / 컴플라이언스 문서 추가 제공

첨부된 제안서(PDF)에 상세 사양 비교표와 선정 사유가 포함되어 있으니 검토 부탁드립니다.
추가 문의 사항이 있으시면 언제든지 연락 주시기 바랍니다.

감사합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${c.salesperson || "영업 담당자"}
Advanced Energy Korea
영업 엔지니어 / Sales Engineer
E-mail: ae-korea@aei.com
Web   : www.advancedenergy.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }

  return (
    <>
      {/* ── 인쇄 전용 CSS — window.print() 시 RFQ 폼만 화면 그대로 출력 ──── */}
      <style jsx global>{`
        @media print {
          /* @page margin: 0 → 모든 페이지에서 브라우저 기본 헤더/푸터 (날짜·URL·제목) 숨김 */
          /* 페이지 가장자리 여백은 #rfq-print-area 의 padding 으로 대체 */
          @page { size: A4 portrait; margin: 0; }

          /* 색상·배경 강제 인쇄 */
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          /* 스크롤바 완전 숨김 */
          html, body { overflow: hidden !important; }
          *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
          * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
          /* 모든 요소 숨김 */
          body * { visibility: hidden !important; }
          /* RFQ 폼만 보이게 (children 포함) */
          #rfq-print-area, #rfq-print-area * { visibility: visible !important; overflow: visible !important; }
          /* 폼을 페이지 좌상단에 배치 — 콘텐츠 자체 여백 padding 으로 */
          /* box-decoration-break: clone → 페이지 분할 시 padding 이 모든 페이지에 반복 */
          /* → 2페이지+ 도 상단 12mm 여백 자동 적용 */
          #rfq-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 12mm 8mm 8mm 8mm !important;
            background: #ffffff !important;
            overflow: visible !important;
            max-height: none !important;
            -webkit-box-decoration-break: clone !important;
            box-decoration-break: clone !important;
          }
          /* 페이지 내부 줄바꿈 방지 */
          #rfq-print-area table, #rfq-print-area tr { page-break-inside: avoid; }
          /* ── Placeholder 텍스트 숨김 ──────────────────────────────── */
          /* input / textarea 의 placeholder 속성 텍스트 */
          #rfq-print-area input::placeholder,
          #rfq-print-area textarea::placeholder {
            color: transparent !important;
            opacity: 0 !important;
          }
          /* 빈 select (handlePdf 에서 data-print-empty 표시) — 표시 텍스트 투명 */
          #rfq-print-area select[data-print-empty] {
            color: transparent !important;
          }
          /* 빈 select 의 모든 option 도 투명 (드롭다운 자체가 인쇄에 잡혀도 안 보이게) */
          #rfq-print-area select[data-print-empty] option {
            color: transparent !important;
          }
        }
        /* ── Mobile responsive form tables ─────────────────────────── */
        @media (max-width: 639px) {
          table.rfq-form-table { display: block !important; min-width: 0 !important; width: 100% !important; }
          table.rfq-form-table thead, table.rfq-form-table tbody { display: block; }
          table.rfq-form-table thead tr { display: block; }
          table.rfq-form-table thead th { display: block !important; padding: 6px 12px !important; }
          table.rfq-form-table tbody tr { display: grid !important; grid-template-columns: 86px 1fr; border-bottom: 1px solid #e4e4e7; }
          table.rfq-form-table tbody td { display: block !important; border: none !important; padding: 5px 10px !important; word-break: break-word; min-width: 0; }
          table.rfq-form-table tbody td:nth-child(3),
          table.rfq-form-table tbody td:nth-child(4) { border-top: 1px solid #f0f0f0 !important; }
          table.rfq-form-table tbody td.rfq-full-cell { grid-column: 1 / -1 !important; border-top: none !important; }
        }
      `}</style>
      <div className="flex h-[100dvh] flex-col bg-zinc-50">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
          <div className="flex h-14 items-center gap-2 pl-2 pr-3 md:h-16 md:gap-4 md:pl-2 md:pr-6">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <Image src="/logo.png" alt="Advanced Energy" width={180} height={48} className="h-8 w-auto object-contain md:h-12" priority />
              <span className="mono hidden rounded-pill border border-zinc-300 px-2 py-0.5 text-[11px] text-black sm:inline">RFQ</span>
            </Link>
            <div className="flex-1" />
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/" className="mono whitespace-nowrap rounded-pill border border-zinc-300 bg-white px-3 py-1.5 text-[12px] text-black hover:bg-lime">← 카탈로그</Link>
              <Link href="/filter/" className="mono whitespace-nowrap rounded-pill border border-zinc-300 bg-white px-3 py-1.5 text-[12px] text-black hover:bg-lime">Filter →</Link>
              <Link href="/finder/" className="mono whitespace-nowrap rounded-pill border border-black bg-lime px-3 py-1.5 text-[12px] font-semibold text-black hover:bg-black hover:text-lime">Finder →</Link>
            </div>
            <button type="button" onClick={() => setNavOpen((o) => !o)} className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 md:hidden">
              {navOpen
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>}
            </button>
          </div>
          {navOpen && (
            <nav className="border-t border-zinc-200 bg-white px-4 py-3 md:hidden">
              <div className="grid gap-2">
                <Link href="/" onClick={() => setNavOpen(false)} className="mono flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 text-[13px] text-black"><span>← 카탈로그</span><span>홈</span></Link>
                <Link href="/filter/" onClick={() => setNavOpen(false)} className="mono flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 text-[13px] text-black"><span>Filter</span><span>→</span></Link>
                <Link href="/finder/" onClick={() => setNavOpen(false)} className="mono flex items-center justify-between rounded-lg border border-black bg-lime px-4 py-3 text-[13px] font-semibold text-black"><span>Finder</span><span>→</span></Link>
              </div>
            </nav>
          )}
        </header>

        {/* ── Body: sidebar + main ─────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0">

          {/* ── 모바일 사이드바 오버레이 ──────────────────────────────────────── */}
          {showMobileSidebar && (
            <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setShowMobileSidebar(false)}>
              <div className="absolute inset-0 bg-black/40" />
            </div>
          )}

          {/* ── RFQ 저장 목록 사이드바 ─────────────────────────────────────────── */}
          <aside className={`
            fixed bottom-0 left-0 top-14 z-50 flex w-[220px] shrink-0 flex-col border-r border-zinc-200 bg-white shadow-xl transition-transform duration-200
            ${showMobileSidebar ? "translate-x-0" : "-translate-x-full"}
            lg:static lg:top-auto lg:z-auto lg:flex lg:w-[196px] lg:translate-x-0 lg:shadow-none
          `}>
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0 text-zinc-500">
                  <rect x="3" y="5" width="18" height="2" rx="1" fill="currentColor"/>
                  <rect x="3" y="11" width="12" height="2" rx="1" fill="currentColor"/>
                  <rect x="3" y="17" width="15" height="2" rx="1" fill="currentColor"/>
                </svg>
                <span className="mono text-[11px] font-semibold text-black">저장 목록</span>
                {records.length > 0 && (
                  <span className="mono rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">{records.length}</span>
                )}
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={handleExportJson}
                  className="mono rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[9px] text-zinc-500 hover:border-zinc-400">백업</button>
                <button type="button" onClick={() => importInputRef.current?.click()}
                  className="mono rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[9px] text-zinc-500 hover:border-zinc-400">복구</button>
              </div>
            </div>
            {/* + 새 RFQ */}
            <div className="border-b border-zinc-100 px-2 py-2">
              <button type="button" onClick={handleNew}
                className="mono flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 py-1.5 text-[11px] text-zinc-500 hover:border-black hover:text-black">
                + 새 RFQ
              </button>
            </div>
            {/* 목록 */}
            <div className="flex flex-col gap-1 p-2">
              {records.length === 0 ? (
                <p className="mono px-2 py-4 text-center text-[11px] text-zinc-400">저장된 RFQ가<br/>없습니다.</p>
              ) : (
                [...groupedRecords.entries()].map(([company, recs]) =>
                  recs.map((rec) => {
                    const last = rec.revisions[rec.revisions.length - 1];
                    return (
                      <button key={rec.id} type="button"
                        onClick={() => handleLoadRev(last, rec.id)}
                        className={cx(
                          "mono flex w-full flex-col gap-0.5 rounded-lg border px-2.5 py-2 text-left transition hover:border-black hover:bg-zinc-50",
                          rec.id === activeId ? "border-black bg-lime/20" : "border-zinc-200 bg-white"
                        )}>
                        <span className="text-[11px] font-semibold leading-tight text-black">{company || "—"}</span>
                        <span className="line-clamp-1 text-[10px] text-zinc-500">{last.customer.customerProject || "프로젝트 없음"}</span>
                        <span className="text-[9px] text-zinc-400">Rev.{last.rev} · {last.savedAt.slice(0,10)}</span>
                      </button>
                    );
                  })
                )
              )}
            </div>
          </aside>

          {/* ── Main 스크롤 영역 ──────────────────────────────────────────── */}
          <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-2 py-4 md:px-4">

          {/* ── Action bar ───────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-1 items-center gap-2">
              <button type="button" onClick={() => setShowMobileSidebar(o => !o)}
                className="mono flex items-center gap-1 rounded-pill border border-zinc-300 bg-white px-2.5 py-1.5 text-[11px] text-black hover:bg-zinc-50 lg:hidden">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0"><rect x="3" y="5" width="18" height="2" rx="1" fill="currentColor"/><rect x="3" y="11" width="12" height="2" rx="1" fill="currentColor"/><rect x="3" y="17" width="15" height="2" rx="1" fill="currentColor"/></svg>
                목록{records.length > 0 ? ` (${records.length})` : ""}
              </button>
              <div>
                <h1 className="mono text-[18px] font-bold text-black md:text-[22px]">SMPS 사양 요청서</h1>
                {activeRecord && (
                  <p className="mono mt-0.5 text-[12px] text-black">{docNo} · Rev.{activeRecord.revisions.length - 1}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={openProposal}
                className="mono rounded-pill border border-[#0078D4] bg-[#0078D4] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#005a9e]">
                제안서 작성
              </button>
              <button type="button" onClick={handlePdf} className="mono rounded-pill border border-zinc-300 bg-white px-3 py-1.5 text-[12px] text-black hover:border-black">PDF 출력</button>
              {latestRev && (
                <>
                  <button type="button" onClick={() => handleXls(latestRev)} className="mono rounded-pill border border-zinc-300 bg-white px-3 py-1.5 text-[12px] text-black hover:border-black">Excel 다운</button>
                  <button type="button" onClick={() => handleCsv(latestRev)} className="mono rounded-pill border border-zinc-300 bg-white px-3 py-1.5 text-[12px] text-black hover:border-black">CSV</button>
                  <a href={buildMailto(latestRev)} className="mono rounded-pill border border-black bg-white px-3 py-1.5 text-[12px] text-black hover:bg-lime">메일 발송</a>
                </>
              )}
              <button type="button" onClick={handleSave}
                className="mono rounded-pill border border-black bg-black px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-lime hover:text-black">
                {activeRecord ? `Rev.${activeRecord.revisions.length} 저장` : "저장 (Rev.0)"}
              </button>
              {saveMsg && <span className="mono text-[12px] text-green-600">{saveMsg}</span>}
            </div>
          </div>

          {/* hidden file input for JSON import */}
          <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={handleImportJson} />

          {/* ══ 2열 레이아웃: SMPS 사양 (좌 6) | Outlook 발송 (우 4) ════════ */}
          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-10 lg:items-start lg:gap-8">

            {/* ════ LEFT COLUMN: SMPS 사양 요청서 (6/10) ═════════════════ */}
            {/* className "rfq-print-area" — @media print 에서 이 영역만 출력 */}
            <div id="rfq-print-area" className="rfq-print-area flex min-w-0 flex-col gap-5 lg:col-span-6">

          {/* ══ 문서 헤더 (배너 + 정보) ══════════════════════════════════ */}
          <div className="overflow-x-auto">
            <table className="rfq-form-table w-full min-w-[520px] border-collapse bg-white">
              <thead>
                <tr>
                  <th colSpan={4} className="rfq-full-cell border-b border-zinc-300 bg-white px-4 py-3">
                    <div className="flex items-center gap-2 sm:gap-4">
                      <Image src="/logo.png" alt="Advanced Energy" width={160} height={42} className="h-7 w-auto shrink-0 object-contain sm:h-9" priority />
                      <span className="mono flex-1 text-center text-[14px] font-black tracking-[0.04em] text-black sm:whitespace-nowrap sm:text-[22px] sm:tracking-[0.06em]">
                        SMPS Product Specification Request
                      </span>
                      <Image src="/Semigate.png" alt="Semigate" width={160} height={42} className="h-7 w-auto shrink-0 object-contain sm:h-9" />
                    </div>
                  </th>
                </tr>
                <tr>
                  <th colSpan={4} className="rfq-full-cell mono border-b border-zinc-300 bg-zinc-50 py-1 text-center text-[10px] font-normal tracking-widest text-black">
                    Advanced Energy Industries — Sales Engineering
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* 문서번호 / 작성일 / Rev */}
                <tr>
                  <td className={cx(LC, "w-[110px]")}><LabelSpan>문서번호</LabelSpan></td>
                  <td className={cx(VC, "border-r border-zinc-300")}><span className="mono text-[13px] font-bold text-black">{docNo}</span></td>
                  <td className={LC2}><LabelSpan>작성일</LabelSpan></td>
                  <td className={VC}><span className="mono text-[13px] text-black">{today}</span></td>
                </tr>
                <tr>
                  <td className={cx(LC, "w-[110px]")}><LabelSpan>고객사</LabelSpan></td>
                  <td className={cx(VC, "border-r border-zinc-300")}>
                    <CI value={customer.company} onChange={(v) => setC("company", v)} placeholder="(주)고객사명" />
                  </td>
                  <td className={LC2}><LabelSpan>프로젝트명</LabelSpan></td>
                  <td className={VC}><CI value={customer.customerProject} onChange={(v) => setC("customerProject", v)} placeholder="프로젝트명" /></td>
                </tr>
                <tr>
                  <td className={cx(LC, "w-[110px]")}><LabelSpan>담당자</LabelSpan></td>
                  <td className={cx(VC, "border-r border-zinc-300")}>
                    <CI value={customer.contactName} onChange={(v) => setC("contactName", v)} placeholder="홍길동" />
                  </td>
                  <td className={LC2}><LabelSpan>이메일</LabelSpan></td>
                  <td className={VC}><CI value={customer.contactEmail} onChange={(v) => setC("contactEmail", v)} placeholder="name@company.com" type="email" /></td>
                </tr>
                <tr>
                  <td className={cx(LC, "w-[110px]")}><LabelSpan>전화</LabelSpan></td>
                  <td className={cx(VC, "border-r border-zinc-300")}>
                    <CI value={customer.contactPhone} onChange={(v) => setC("contactPhone", v)} placeholder="02-0000-0000" />
                  </td>
                  <td className={LC2}><LabelSpan>산업 분야</LabelSpan></td>
                  <td className={VC}><CS value={customer.industry} onChange={(v) => setC("industry", v)} options={INDUSTRY_OPTIONS} /></td>
                </tr>
                <tr>
                  <td className={cx(LC, "w-[110px]")}><LabelSpan>미팅일시</LabelSpan></td>
                  <td className={cx(VC, "border-r border-zinc-300")}>
                    <div className="flex gap-2">
                      <CI value={customer.meetingDate} onChange={(v) => setC("meetingDate", v)} type="date" />
                      <CI value={customer.meetingTime} onChange={(v) => setC("meetingTime", v)} type="time" />
                    </div>
                  </td>
                  <td className={LC2}><LabelSpan>미팅 장소</LabelSpan></td>
                  <td className={VC}><CI value={customer.meetingVenue} onChange={(v) => setC("meetingVenue", v)} placeholder="회의실 / 온라인 등" /></td>
                </tr>
                <tr>
                  <td className={cx(LC, "w-[110px]")}><LabelSpan>영업 담당자</LabelSpan></td>
                  <td className={cx(VC, "border-r border-zinc-300")}>
                    <CI value={customer.salesperson} onChange={(v) => setC("salesperson", v)} placeholder="AE 담당자명" />
                  </td>
                  <td className={LC2}><LabelSpan>최초 컨택일</LabelSpan></td>
                  <td className={VC}><CI value={customer.contactDate} onChange={(v) => setC("contactDate", v)} type="date" /></td>
                </tr>
                <tr>
                  <td className={cx(LC, "w-[110px]")}><LabelSpan>회신 마감일</LabelSpan></td>
                  <td className={cx(VC, "border-r border-zinc-300")}>
                    <CI value={customer.responseDeadline} onChange={(v) => setC("responseDeadline", v)} type="date" />
                  </td>
                  <td className={LC2}><LabelSpan>비고 / 메모</LabelSpan></td>
                  <td className={VC}><CI value={customer.notes} onChange={(v) => setC("notes", v)} placeholder="미팅 요약, 추가 메모…" /></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ══ 영업 정보 ═══════════════════════════════════════════════════ */}
          <FT title="영업 정보">
            <R2
              l1="경쟁사 / 현재 제품" c1={<CI value={customer.competitor} onChange={(v) => setC("competitor", v)} placeholder="브랜드 / 모델명" />}
              l2="타겟 단가 (USD)" c2={<CI value={spec.targetPrice} onChange={(v) => setS("targetPrice", v)} placeholder="예: $150" />}
            />
            <R2
              l1="양산 시점" c1={<CI value={customer.mpqStart} onChange={(v) => setC("mpqStart", v)} placeholder="예: 2026-Q3" />}
              l2="양산 수량" c2={<CS value={customer.mpqQuantity} onChange={(v) => setC("mpqQuantity", v)} options={MPQ_QUANTITY_OPTIONS} allowCustom />}
            />
            <R2
              l1="샘플 요청" c1={<CS value={customer.sampleRequested} onChange={(v) => setC("sampleRequested", v)} options={SAMPLE_OPTIONS} allowCustom={false} />}
              l2="샘플 수량" c2={<CI value={customer.sampleQuantity} onChange={(v) => setC("sampleQuantity", v)} placeholder="예: 5ea" />}
            />
            <R2
              l1="납기 목표" c1={<CI value={spec.targetDate} onChange={(v) => setS("targetDate", v)} type="date" />}
              l2="최종 용도" c2={<CS value={spec.application} onChange={(v) => setS("application", v)} options={APPLICATION_OPTIONS} />}
            />
          </FT>

          {/* ══ 입력 사양 ════════════════════════════════════════════════════ */}
          <FT title="입력 사양">
            <R2
              l1="입력 전압 범위" c1={<CS value={spec.inputVoltageRange} onChange={(v) => setS("inputVoltageRange", v)} options={INPUT_VOLTAGE_OPTIONS} />}
              l2="입력 위상" c2={<CS value={spec.inputPhase} onChange={(v) => setS("inputPhase", v)} options={INPUT_PHASE_OPTIONS} allowCustom={false} />}
            />
            <R2 l1="입력 주파수" c1={<CS value={spec.inputFrequency} onChange={(v) => setS("inputFrequency", v)} options={INPUT_FREQ_OPTIONS} allowCustom={false} />} />
          </FT>

          {/* ══ 출력 사양 ════════════════════════════════════════════════════ */}
          <FT title="출력 사양">
            {/* 채널 헤더 */}
            <tr>
              <td className="border-b border-r border-zinc-300 bg-zinc-200 w-[120px] px-3 py-1.5"><LabelSpan>채널</LabelSpan></td>
              <td className="border-b border-r border-zinc-300 bg-zinc-200 px-3 py-1.5"><LabelSpan>출력 전압</LabelSpan></td>
              <td className="border-b border-r border-zinc-300 bg-zinc-200 px-3 py-1.5"><LabelSpan>출력 전류</LabelSpan></td>
              <td className="border-b border-zinc-300 bg-zinc-200 px-3 py-1.5"><LabelSpan>출력 전력</LabelSpan></td>
            </tr>
            {spec.outputChannels.map((ch, i) => (
              <tr key={ch.id}>
                <td className="border-b border-r border-zinc-300 bg-zinc-100 px-3 py-2 align-middle">
                  <div className="flex items-center justify-between gap-2">
                    <span className="mono text-[12px] font-bold text-black">CH{i + 1}</span>
                    {spec.outputChannels.length > 1 && (
                      <button type="button" onClick={() => removeCh(i)} className="mono flex items-center justify-center text-red-500 hover:text-red-700" aria-label="삭제"><Icon name="x" size={11}/></button>
                    )}
                  </div>
                </td>
                <td className="border-b border-r border-zinc-300 px-3 py-2">
                  <CS value={ch.voltage} onChange={(v) => updateCh(i, { ...ch, voltage: v })} options={OUTPUT_VOLTAGE_OPTIONS} placeholder="전압 선택" />
                </td>
                <td className="border-b border-r border-zinc-300 px-3 py-2">
                  <CS value={ch.current} onChange={(v) => updateCh(i, { ...ch, current: v })} options={OUTPUT_CURRENT_OPTIONS} placeholder="전류 선택" />
                </td>
                <td className="border-b border-zinc-300 px-3 py-2">
                  <CS value={ch.power} onChange={(v) => updateCh(i, { ...ch, power: v })} options={OUTPUT_POWER_OPTIONS} placeholder="전력 선택" />
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} className="rfq-full-cell border-b border-zinc-300 px-3 py-2">
                <button type="button" onClick={addCh} className="mono text-[12px] text-black underline underline-offset-2 hover:no-underline">+ 출력 채널 추가</button>
              </td>
            </tr>
            <R2
              l1="총 출력 전력" c1={<CS value={spec.totalPower} onChange={(v) => setS("totalPower", v)} options={TOTAL_POWER_OPTIONS} />}
              l2="전압 조정률" c2={<CS value={spec.outputRegulation} onChange={(v) => setS("outputRegulation", v)} options={REGULATION_OPTIONS} />}
            />
            <R2 l1="리플 / 노이즈" c1={<CS value={spec.rippleNoise} onChange={(v) => setS("rippleNoise", v)} options={RIPPLE_OPTIONS} />} />
          </FT>

          {/* ══ 기구 사양 ════════════════════════════════════════════════════ */}
          <FT title="기구 사양">
            <R2
              l1="폼팩터" c1={<CS value={spec.formFactor} onChange={(v) => setS("formFactor", v)} options={FORM_FACTOR_OPTIONS} />}
              l2="냉각 방식" c2={<CS value={spec.cooling} onChange={(v) => setS("cooling", v)} options={COOLING_OPTIONS} />}
            />
            <R2
              l1="외형 치수 (mm)" c1={<CI value={spec.dimensions} onChange={(v) => setS("dimensions", v)} placeholder="예: 170×97×38" />}
              l2="무게" c2={<CI value={spec.weight} onChange={(v) => setS("weight", v)} placeholder="예: 500g" />}
            />
          </FT>

          {/* ══ 기능 / 보호 / 인증 ══════════════════════════════════════════ */}
          <FT title="기능 / 보호 회로 / 요구 인증">
            <RF l="특수 기능"><Chips options={FEATURE_OPTIONS} selected={spec.features} onChange={(v) => setS("features", v)} /></RF>
            <RF l="보호 회로"><Chips options={PROTECTION_OPTIONS} selected={spec.protections} onChange={(v) => setS("protections", v)} /></RF>
            <RF l="요구 인증"><Chips options={CERT_OPTIONS} selected={spec.certifications} onChange={(v) => setS("certifications", v)} /></RF>
          </FT>

          {/* ══ 미팅 메모 / 자유 기록 ══════════════════════════════════════ */}
          <div className="overflow-x-auto">
            <table className="rfq-form-table w-full min-w-[520px] border-collapse bg-white text-left">
              <thead>
                <tr>
                  <th className="mono border-b border-zinc-300 bg-zinc-200 px-4 py-2 text-left text-[12px] font-bold uppercase tracking-widest text-black">
                    미팅 메모 / 자유 기록
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="rfq-full-cell p-0">
                    <textarea
                      value={customer.meetingMemo}
                      onChange={(e) => setC("meetingMemo", e.target.value)}
                      placeholder="상담 중 기록할 내용을 자유롭게 입력하세요.&#10;고객 요구사항 / 특이사항 / 논의 내용 / 경쟁 현황 / 다음 액션 아이템 등…"
                      rows={8}
                      className="mono w-full resize-y bg-white px-4 py-3 text-[14px] leading-relaxed text-black placeholder:text-zinc-400 focus:outline-none"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

            </div>
            {/* ════ RIGHT COLUMN: Outlook 발송 설정 (4/10) ══════════════ */}
            {/* 아웃룩 패널: 1열 상단(로고 위치)과 동일 높이로 정렬 */}
            <div className="flex min-w-0 flex-col gap-5 lg:col-span-4 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto lg:pt-0">

          {/* ══ Outlook 메일 발송 ══════════════════════════════════════════ */}
          {(() => {
            const revNum = activeRecord ? activeRecord.revisions.length : 0;
            const emailVars = buildEmailVars(customer, spec, docNo, revNum);
            // 발송 전 미리보기: 현재 폼 값으로 변수 치환한 제목·본문
            const tempRev: RfqRevision = { rev: revNum, savedAt: "", customer, spec, comment: "" };
            const liveSubject = substituteTemplate(emailSubject, tempRev, docNo);
            const liveHtml = substituteHtmlHighlighted(emailHtml, emailVars);
            return (
            <div className="overflow-hidden rounded-lg shadow-[0_2px_8px_0_rgba(0,0,0,0.14)]" style={{ border: "1px solid #d0d0d0" }}>

              {/* ── Title bar (Microsoft Blue #0078D4) ────────────────── */}
              <button type="button" onClick={() => setEmailOpen((o) => !o)}
                className="flex w-full items-center gap-2.5 px-3 py-2"
                style={{ background: "#0078D4" }}>
                {/* Outlook envelope icon */}
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
                  <rect width="20" height="20" rx="2" fill="#0078D4"/>
                  <rect x="3" y="5" width="14" height="10" rx="1" fill="white" fillOpacity="0.9"/>
                  <path d="M3 6.5L10 11.5L17 6.5" stroke="#0078D4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontFamily: "'Segoe UI', Arial, sans-serif", fontWeight: 600, fontSize: "13px", color: "#ffffff", letterSpacing: "0.01em" }}>
                  새 메시지 — Outlook 발송 설정
                </span>
                <span className="ml-auto inline-flex shrink-0 items-center gap-1" style={{ color: "#ffffffaa", fontSize: "11px" }}>
                  <Icon name={emailOpen ? "chevron-up" : "chevron-down"} size={11}/>
                  {emailOpen ? "접기" : "펼치기"}
                </span>
              </button>

              {emailOpen && (
                <>
                  {/* ── Ribbon toolbar ──────────────────────────────────── */}
                  <div className="flex flex-wrap items-center gap-1 border-b px-3 py-1.5"
                    style={{ background: "#f3f2f1", borderColor: "#e0e0e0" }}>
                    {/* 보내기 */}
                    <button type="button" onClick={handleOutlookSend}
                      className="flex items-center gap-1.5 rounded px-3 py-1 text-white transition hover:brightness-90 active:brightness-75"
                      style={{ background: "#0078d4", fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", fontWeight: 600 }}>
                      <Icon name="send" size={13}/>
                      Excel 다운 + 보내기
                    </button>
                    <div className="mx-1 h-5 w-px" style={{ background: "#c8c6c4" }} />
                    {/* 임시저장 (수동) */}
                    <button type="button" onClick={handleSaveDraft}
                      style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", color: "#605e5c", fontWeight: 600 }}
                      className="flex items-center gap-1.5 rounded px-2.5 py-1 hover:bg-black/5"
                      title="현재 작성 중인 메일을 임시저장 (1.5초마다 자동저장 됨)">
                      <Icon name="draft" size={13}/> 임시저장
                    </button>
                    {draftSavedAt && (
                      <button type="button" onClick={handleClearDraft}
                        style={{ color: "#a4262c" }}
                        className="flex items-center justify-center rounded px-1.5 py-1 hover:bg-[#a4262c]/10"
                        title="임시저장 삭제">
                        <Icon name="trash" size={13}/>
                      </button>
                    )}
                    {(draftStatus || draftSavedAt) && (
                      <span style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "10px", color: draftStatus === "saving" ? "#a19f9d" : "#107c10" }}
                        title={draftSavedAt ? new Date(draftSavedAt).toLocaleString("ko-KR") : ""}>
                        {draftLabel()}
                      </span>
                    )}
                    <div className="mx-1 h-5 w-px" style={{ background: "#c8c6c4" }} />
                    {/* 기본 단일 템플릿 저장 (현재 본문 → localStorage) */}
                    <button type="button" onClick={handleSaveTemplate}
                      style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", color: "#323130" }}
                      className="flex items-center gap-1.5 rounded px-2.5 py-1 hover:bg-black/5"
                      title="현재 본문을 기본 템플릿으로 저장 (페이지 새로고침 후 복원)">
                      <Icon name="save" size={13}/> 기본 저장
                    </button>
                    {/* 명명된 템플릿 — 새로 저장 / 덮어쓰기 / 불러오기 */}
                    <button type="button" onClick={handleSavePresetAs}
                      style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", color: "#0078d4", fontWeight: 600 }}
                      className="flex items-center gap-1.5 rounded px-2.5 py-1 hover:bg-[#0078d4]/10"
                      title="이름을 지정하여 새 템플릿으로 저장 (영구)">
                      <Icon name="plus" size={13}/> 새 템플릿
                    </button>
                    {activePresetId && (
                      <button type="button" onClick={handleOverwritePreset}
                        style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", color: "#107c10", fontWeight: 600 }}
                        className="flex items-center gap-1.5 rounded px-2.5 py-1 hover:bg-[#107c10]/10"
                        title="현재 활성 템플릿에 덮어쓰기">
                        <Icon name="refresh" size={13}/> 덮어쓰기
                      </button>
                    )}
                    <div className="relative">
                      <button type="button"
                        onClick={() => setPresetMenuOpen((o) => !o)}
                        style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", color: "#323130" }}
                        className="flex items-center gap-1.5 rounded px-2.5 py-1 hover:bg-black/5"
                        title="저장된 템플릿 불러오기">
                        <Icon name="folder" size={13}/> 불러오기 ({emailPresets.length}) <Icon name={presetMenuOpen ? "chevron-up" : "chevron-down"} size={11}/>
                      </button>
                      {presetMenuOpen && (
                        <div className="absolute left-0 top-full z-20 mt-1 w-[300px] overflow-hidden rounded border bg-white shadow-lg"
                          style={{ borderColor: "#d0d0d0" }}>
                          {emailPresets.length === 0 ? (
                            <div className="px-3 py-3 text-center" style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "11px", color: "#a19f9d" }}>
                              저장된 템플릿이 없습니다.<br/>&apos;새 템플릿&apos; 으로 저장하세요.
                            </div>
                          ) : (
                            <ul className="max-h-[280px] overflow-y-auto">
                              {[...emailPresets].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).map((p) => (
                                <li key={p.id}
                                  className={`flex items-center gap-2 border-b px-3 py-2 text-left hover:bg-[#0078d4]/5 ${activePresetId === p.id ? "bg-[#fef9c3]/40" : ""}`}
                                  style={{ borderColor: "#e0e0e0" }}>
                                  <button type="button" onClick={() => handleLoadPreset(p.id)}
                                    className="flex-1 text-left">
                                    <div style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", fontWeight: 600, color: "#323130" }}>
                                      {p.name}
                                    </div>
                                    <div className="mt-0.5 flex items-center gap-2" style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "10px", color: "#a19f9d" }}>
                                      <span>{p.savedAt.slice(0, 10)}</span>
                                      {p.attachments && p.attachments.length > 0 && (
                                        <span className="inline-flex items-center gap-0.5" style={{ color: "#0078d4" }}><Icon name="paperclip" size={10}/> {p.attachments.length}</span>
                                      )}
                                      {activePresetId === p.id && <span style={{ color: "#107c10" }}>● 사용 중</span>}
                                    </div>
                                  </button>
                                  <button type="button" onClick={() => handleRenamePreset(p.id)}
                                    className="flex items-center justify-center rounded px-1.5 py-0.5 hover:bg-black/5"
                                    style={{ color: "#605e5c" }} title="이름 변경"><Icon name="edit" size={11}/></button>
                                  <button type="button" onClick={() => handleDeletePreset(p.id)}
                                    className="flex items-center justify-center rounded px-1.5 py-0.5 hover:bg-[#a4262c]/10"
                                    style={{ color: "#a4262c" }} title="삭제"><Icon name="x" size={11}/></button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={handleResetTemplate}
                      style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", color: "#323130" }}
                      className="rounded px-2.5 py-1 hover:bg-black/5">
                      기본값 복원
                    </button>
                    <div className="mx-1 h-5 w-px" style={{ background: "#c8c6c4" }} />
                    <button type="button" onClick={() => setTemplateEditMode((m) => !m)}
                      style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", color: templateEditMode ? "#0078d4" : "#323130", fontWeight: templateEditMode ? 600 : 400 }}
                      className="flex items-center gap-1.5 rounded px-2.5 py-1 hover:bg-black/5">
                      <Icon name="edit" size={12}/> {templateEditMode ? "편집 중" : "템플릿 편집"}
                    </button>
                    {emailSentMsg && (
                      <span className="ml-2" style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", color: "#107c10" }}>{emailSentMsg}</span>
                    )}
                  </div>

                  {/* ── Fields ──────────────────────────────────────────── */}
                  <div style={{ background: "#ffffff" }}>
                    {/* 받는 사람 */}
                    <div className="flex items-center border-b px-4 py-2" style={{ borderColor: "#e0e0e0" }}>
                      <span className="w-20 shrink-0" style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>받는 사람</span>
                      <input
                        value={emailTo}
                        onChange={(e) => { autoFilledEmail.current = ""; setEmailTo(e.target.value); }}
                        placeholder={customer.contactEmail || "이메일 주소"}
                        type="email"
                        style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "13px", color: "#323130" }}
                        className="min-w-0 flex-1 bg-transparent placeholder:text-[#a19f9d] focus:outline-none"
                      />
                    </div>
                    {/* 참조 */}
                    <div className="flex items-center border-b px-4 py-2" style={{ borderColor: "#e0e0e0" }}>
                      <span className="w-20 shrink-0" style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>참조</span>
                      <input
                        value={emailCc}
                        onChange={(e) => setEmailCc(e.target.value)}
                        placeholder="참조 주소 (선택)"
                        type="email"
                        style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "13px", color: "#323130" }}
                        className="min-w-0 flex-1 bg-transparent placeholder:text-[#a19f9d] focus:outline-none"
                      />
                    </div>
                    {/* 제목 */}
                    <div className="flex items-center border-b px-4 py-2.5" style={{ borderColor: "#e0e0e0" }}>
                      <span className="w-20 shrink-0" style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>제목</span>
                      <input
                        value={liveSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="메일 제목"
                        style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "14px", fontWeight: 600, color: "#323130" }}
                        className="min-w-0 flex-1 bg-transparent placeholder:text-[#a19f9d] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* ── Body (Rich Text Editor) ────────────────────────── */}
                  {templateEditMode ? (
                    /* 변수 템플릿 편집 모드 (평문 + {{변수}}) */
                    <div style={{ background: "#fffbe6", borderTop: "1px solid #e0e0e0" }}>
                      <textarea
                        ref={emailTemplateRef}
                        value={emailTemplate}
                        onChange={(e) => setEmailTemplate(e.target.value)}
                        rows={18}
                        spellCheck={false}
                        placeholder="이메일 본문 템플릿. {{company}}, {{contactName}} 등 변수 사용 가능."
                        style={{ fontFamily: "'Courier New', monospace", fontSize: "12px", color: "#323130", lineHeight: 1.6, background: "#fffbe6", width: "100%", minHeight: "320px", maxHeight: "420px", resize: "none", padding: "16px 20px", border: "none", outline: "none" }}
                      />
                      <div className="flex justify-end border-t px-3 py-2" style={{ background: "#f3f2f1", borderColor: "#e0e0e0" }}>
                        <button type="button"
                          onClick={() => { setEmailHtml(plainTextToHtml(emailTemplate)); setTemplateEditMode(false); }}
                          className="flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] hover:bg-black/5"
                          style={{ fontFamily: "'Segoe UI',Arial,sans-serif", color: "#0078d4", fontWeight: 600 }}>
                          <Icon name="arrow-right" size={12}/> 리치 본문에 적용
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 리치 텍스트 에디터 */
                    <RichTextEditor
                      html={liveHtml}
                      onHtmlChange={setEmailHtml}
                      onAttachFiles={(arr) => setAttachments((prev) => [...prev, ...arr])}
                      modeRich={editorRichMode}
                      onToggleMode={() => setEditorRichMode((m) => !m)}
                    />
                  )}

                  {/* ── 첨부파일 리스트 ─────────────────────────────────── */}
                  {attachments.length > 0 && (
                    <div className="border-t px-3 py-2" style={{ background: "#f8f8f8", borderColor: "#e0e0e0" }}>
                      <div className="mb-1.5 flex items-center gap-1.5" style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "11px", color: "#605e5c", fontWeight: 600 }}>
                        <Icon name="paperclip" size={11}/>
                        첨부파일 ({attachments.length})
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {attachments.map((a) => (
                          <div key={a.id} className="flex items-center gap-2 rounded border bg-white px-2 py-1"
                            style={{ borderColor: "#d0d0d0", fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "11px" }}>
                            <span style={{ color: "#0078d4" }}><Icon name="doc" size={12}/></span>
                            <span style={{ color: "#323130", fontWeight: 600 }}>{a.name}</span>
                            <span style={{ color: "#a19f9d" }}>{formatBytes(a.size)}</span>
                            <button type="button" onClick={() => removeAttachment(a.id)}
                              style={{ color: "#a4262c" }}
                              className="ml-1 flex items-center justify-center hover:opacity-70" aria-label="삭제">
                              <Icon name="x" size={11}/>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Status bar ───────────────────────────────────────── */}
                  <div className="flex items-center gap-3 border-t px-4 py-1.5" style={{ background: "#f3f2f1", borderColor: "#e0e0e0" }}>
                    <span style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "11px", color: "#605e5c" }}>
                      {templateEditMode
                        ? "변수 템플릿 모드 — {{변수}} 직접 입력 가능. 적용 시 리치 본문으로 변환."
                        : editorRichMode
                          ? "리치 편집 — 폰트/색상/이미지/링크 가능. 보내기 시 서식 본문이 클립보드에 복사됨 (Outlook에서 Ctrl+V)."
                          : "HTML 소스 — 직접 HTML 편집 가능. 변수 {{xxx}} 도 그대로 인식."}
                    </span>
                  </div>
                </>
              )}
            </div>
            );
          })()}

            </div>
          </div>
          {/* ═══════════════════════ END 2-column grid ══════════════════════ */}

          {/* ══ 저장 ════════════════════════════════════════════════════════ */}
          <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="mono mb-1 block text-[11px] font-semibold text-black">개정 코멘트 (선택)</label>
              <input value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} placeholder="예: 출력 전압 변경, 의료 인증 추가…"
                className="mono w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] text-black placeholder:text-zinc-400 focus:border-black focus:outline-none" />
            </div>
            <button type="button" onClick={handleSave}
              className="mono shrink-0 rounded-xl border border-black bg-black px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-lime hover:text-black">
              {activeRecord ? `Rev.${activeRecord.revisions.length} 저장` : "저장 (Rev.0)"}
            </button>
            {saveMsg && <span className="mono text-[12px] text-green-600">{saveMsg}</span>}
          </div>

          {/* ══ 개정 이력 ═══════════════════════════════════════════════════ */}
          {activeRecord && activeRecord.revisions.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="mono mb-4 text-[13px] font-bold uppercase tracking-widest text-black">개정 이력</h2>
              <div className="flex flex-col gap-3">
                {[...activeRecord.revisions].reverse().map((rev) => (
                  <RevRow key={rev.rev} rev={rev}
                    onLoad={() => handleLoadRev(rev, activeRecord.id)}
                    onPdf={handlePdf}
                    onXls={() => handleXls(rev)}
                    onCsv={() => handleCsv(rev)}
                    onMail={() => { window.location.href = buildMailto(rev); }}
                    onDelete={() => handleDeleteRev(activeRecord.id, rev.rev)}
                    onSaveComment={(comment) => handleUpdateRevComment(activeRecord.id, rev.rev, comment)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ══ 자동 추천 제품 ═══════════════════════════════════════════════ */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="mono mb-4 text-[13px] font-bold uppercase tracking-widest text-black">자동 추천 제품군</h2>
            {recommended.length === 0 ? (
              <p className="mono text-[13px] text-black">폼팩터, 출력 전력, 인증 등을 선택하면 추천 제품이 자동 생성됩니다.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recommended.map((m) => (
                  <Link key={m.modelKey} href={`/?q=${encodeURIComponent(m.model)}`} target="_blank" rel="noopener noreferrer"
                    className="flex flex-col gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 transition hover:border-black hover:bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <span className="mono text-[13px] font-semibold text-black">{m.model}</span>
                      {m.watts.length > 0 && (
                        <span className="mono shrink-0 rounded-pill border border-zinc-300 bg-white px-2 py-0.5 text-[10px] text-black">
                          {m.watts.slice(0, 2).join(" / ")}
                        </span>
                      )}
                    </div>
                    <p className="mono line-clamp-1 text-[11px] text-black">{m.lineage} · {m.subcategory || m.section || "—"}</p>
                    {m.contextLines[0] && <p className="mono line-clamp-1 text-[11px] text-black">{m.contextLines[0]}</p>}
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>
          </main>
        </div>{/* end sidebar+main flex row */}
      </div>{/* end h-[100dvh] */}

      {/* ══════════════════════════════════════════════════════════════
          ── Outlook 미리보기 모달 (보내기 전 확인) ───────────────────
          ══════════════════════════════════════════════════════════════ */}
      {outlookPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
          <div className="flex max-h-[90vh] w-full max-w-[920px] flex-col overflow-hidden rounded-lg shadow-2xl"
            style={{ background: "#ffffff" }}>
            {/* ── Outlook 타이틀 바 ─────────────────────────────────── */}
            <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ background: "#0078d4" }}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <rect width="20" height="20" rx="2" fill="#0078D4"/>
                <rect x="3" y="5" width="14" height="10" rx="1" fill="white" fillOpacity="0.92"/>
                <path d="M3 6.5L10 11.5L17 6.5" stroke="#0078D4" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "13px", fontWeight: 600, color: "#ffffff", letterSpacing: "0.01em" }}>
                Outlook — 메시지 미리보기
              </span>
              <button type="button" onClick={closeOutlookPreview}
                className="ml-auto flex h-7 w-7 items-center justify-center rounded hover:bg-white/10"
                aria-label="닫기">
                <span style={{ color: "white", fontSize: "16px", lineHeight: 1 }}>×</span>
              </button>
            </div>

            {/* ── 액션 바 ────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 border-b px-4 py-2" style={{ background: "#f3f2f1", borderColor: "#e0e0e0" }}>
              <button type="button" onClick={handleOutlookPreviewSend}
                className="flex items-center gap-1.5 rounded px-4 py-1.5 text-white hover:brightness-90 active:brightness-75"
                style={{ background: "#0078d4", fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", fontWeight: 600 }}
                title="Outlook 새 메시지 창을 즉시 열고, 서식 본문은 클립보드에 복사됩니다">
                <Icon name="send" size={13}/>
                Outlook으로 보내기
              </button>
              <button type="button"
                onClick={() => {
                  if (!outlookPreview) return;
                  // .eml 다운로드 + 자동 실행 시도
                  const a = document.createElement("a");
                  a.href = outlookPreview.emlUrl;
                  a.download = outlookPreview.emlFilename;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  // 다운로드 직후 같은 blob URL 로 navigate — 브라우저가 OS 핸들러를 호출할 수 있음
                  // (Edge + Outlook 등록 시 자동 실행, Chrome 등은 두 번째 다운로드로 처리됨)
                  setTimeout(() => {
                    window.open(outlookPreview.emlUrl, "_blank", "noopener,noreferrer");
                  }, 300);
                  setEmailSentMsg(".eml 다운로드 완료 — 자동 실행 안 되면 다운로드 폴더에서 더블클릭");
                  setTimeout(() => setEmailSentMsg(""), 7000);
                }}
                className="flex items-center gap-1.5 rounded border px-3 py-1.5 hover:bg-black/5"
                style={{ borderColor: "#d0d0d0", fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", color: "#323130" }}
                title=".eml 파일을 다운로드하고 자동 실행을 시도합니다 (Edge 권장)">
                <Icon name="external" size={13}/> .eml 다운로드 & 자동 실행
              </button>
              <button type="button" onClick={closeOutlookPreview}
                className="ml-auto rounded border px-3 py-1.5 hover:bg-black/5"
                style={{ borderColor: "#d0d0d0", fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", color: "#323130" }}>
                취소
              </button>
            </div>

            {/* ── 헤더 (받는 사람/참조/제목) ─────────────────────────── */}
            <div className="border-b" style={{ background: "#fafafa", borderColor: "#e0e0e0" }}>
              <div className="flex items-center gap-3 border-b px-4 py-2" style={{ borderColor: "#e8e8e8" }}>
                <span className="w-16 shrink-0" style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "11px", fontWeight: 600, color: "#605e5c" }}>받는 사람</span>
                <span style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "13px", color: outlookPreview.to ? "#323130" : "#a19f9d" }}>
                  {outlookPreview.to || "(미입력)"}
                </span>
              </div>
              {outlookPreview.cc && (
                <div className="flex items-center gap-3 border-b px-4 py-2" style={{ borderColor: "#e8e8e8" }}>
                  <span className="w-16 shrink-0" style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "11px", fontWeight: 600, color: "#605e5c" }}>참조</span>
                  <span style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "13px", color: "#323130" }}>{outlookPreview.cc}</span>
                </div>
              )}
              <div className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-16 shrink-0" style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "11px", fontWeight: 600, color: "#605e5c" }}>제목</span>
                <span style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "14px", fontWeight: 600, color: "#323130" }}>
                  {outlookPreview.subject || "(제목 없음)"}
                </span>
              </div>
              {outlookPreview.atts.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 border-t px-4 py-2" style={{ borderColor: "#e8e8e8", background: "#f8f8f8" }}>
                  <span className="inline-flex items-center gap-1" style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "11px", fontWeight: 600, color: "#605e5c" }}>
                    <Icon name="paperclip" size={11}/> 첨부 {outlookPreview.atts.length}
                  </span>
                  {outlookPreview.atts.map((a, i) => (
                    <span key={i} className="flex items-center gap-1.5 rounded border bg-white px-2 py-0.5"
                      style={{ borderColor: "#d0d0d0", fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "11px" }}>
                      <span style={{ color: "#0078d4" }}><Icon name="doc" size={11}/></span>
                      <span style={{ color: "#323130", fontWeight: 600 }}>{a.name}</span>
                      <span style={{ color: "#a19f9d" }}>{formatBytes(a.size)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── 본문 (HTML 렌더링) ────────────────────────────────── */}
            <iframe
              srcDoc={`<!DOCTYPE html><html><head><meta charset="UTF-8"/><base target="_blank"/><style>
                body { font-family: 'Segoe UI','Malgun Gothic',Arial,sans-serif; font-size: 14px; line-height: 1.65; color: #323130; padding: 24px 32px; margin: 0; }
                img { max-width: 100%; height: auto; }
                a { color: #0078d4; }
              </style></head><body>${outlookPreview.htmlBody}</body></html>`}
              className="flex-1"
              style={{ width: "100%", minHeight: "320px", border: "none", background: "#ffffff" }}
              title="Outlook 본문 미리보기"
              sandbox="allow-same-origin"
            />

            {/* ── 푸터 (사용 안내) ────────────────────────────────── */}
            <div className="border-t" style={{ background: "#f3f2f1", borderColor: "#e0e0e0" }}>
              <div className="flex items-start gap-2 px-4 py-2">
                <span className="mt-0.5 shrink-0" style={{ color: "#0078d4" }}><Icon name="info" size={12}/></span>
                <div style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "10.5px", color: "#605e5c", lineHeight: 1.55 }}>
                  <div className="mb-1.5">
                    <strong style={{ color: "#0078d4" }}>Outlook으로 보내기</strong> — 실제 Outlook 새 메시지 창이 즉시 열리며 받는 사람·제목·평문 본문이 자동 입력됩니다. 서식 본문은 클립보드에 자동 복사되므로 본문 영역에서 <kbd style={{padding:"1px 4px",border:"1px solid #d0d0d0",borderRadius:"3px",fontSize:"10px",background:"#fff"}}>Ctrl+V</kbd> 로 붙여넣으면 폰트·색상·이미지 그대로 유지됩니다.
                  </div>
                  <div className="mb-1.5">
                    <strong style={{ color: "#323130" }}>.eml 다운로드 &amp; 자동 실행</strong> — 서식·이미지·첨부파일이 모두 포함된 .eml 파일을 다운로드하고 자동 실행을 시도합니다. (브라우저 보안 정책상 100% 자동 실행은 안 되며, 안 되면 다운로드 폴더에서 더블클릭).
                  </div>
                  <details className="mt-1.5 rounded border bg-white/60 px-2.5 py-1.5" style={{ borderColor: "#d0d0d0" }}>
                    <summary className="cursor-pointer text-[10.5px]" style={{ color: "#0078d4", fontWeight: 600 }}>
                      ⓘ .eml 파일을 항상 자동 실행하려면? (브라우저 설정 가이드)
                    </summary>
                    <div className="mt-1.5 space-y-1" style={{ fontSize: "10px", color: "#605e5c", lineHeight: 1.5 }}>
                      <div><strong>Chrome / Edge</strong>: .eml을 처음 다운로드한 후, 다운로드 바에 나오는 파일 우측 화살표(▾) 클릭 → <strong>&quot;이 형식의 파일은 항상 열기&quot;</strong> 체크. 이후 다운로드부터 Outlook이 자동 실행됩니다.</div>
                      <div><strong>Windows</strong>: <kbd style={{padding:"0 3px",border:"1px solid #d0d0d0",borderRadius:"2px",fontSize:"9px",background:"#fff"}}>설정 → 앱 → 기본 앱</kbd> 에서 <code style={{background:"#fff",padding:"0 2px",borderRadius:"2px"}}>.eml</code> 의 기본 앱이 <strong>Outlook</strong> 으로 지정돼 있어야 합니다.</div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ── 제안서 작성 모달 (3-step wizard) ─────────────────────────
          ══════════════════════════════════════════════════════════════ */}
      {proposalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-100">

          {/* ── Top toolbar ─────────────────────────────────────────── */}
          <div className="shrink-0 border-b border-zinc-200 bg-white shadow-sm">
            {/* Row 1: step indicator + close */}
            <div className="flex items-center gap-2 px-3 py-2 sm:px-5">
              <div className="flex min-w-0 flex-1 items-center gap-0 overflow-x-auto">
                {(["1. 제품 선택", "2. 비교표", "3. 미리보기"] as const).map((label, idx) => {
                  const step = (idx + 1) as 1 | 2 | 3;
                  const active = proposalStep === step;
                  const done = proposalStep > step;
                  return (
                    <div key={step} className="flex shrink-0 items-center">
                      <button
                        type="button"
                        onClick={() => { if (step <= proposalStep) setProposalStep(step); }}
                        className={`mono flex h-7 items-center gap-1.5 rounded-pill px-2 text-[11px] font-semibold transition sm:px-3 ${
                          active ? "bg-[#0078D4] text-white" :
                          done ? "bg-zinc-200 text-zinc-600 hover:bg-zinc-300" :
                          "text-zinc-400"
                        }`}
                      >
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${
                          active ? "bg-white text-[#0078D4]" : done ? "bg-zinc-500 text-white" : "border border-zinc-300 text-zinc-400"
                        }`}>{done ? <Icon name="check" size={9}/> : step}</span>
                        <span className="hidden sm:inline">{label}</span>
                        <span className="sm:hidden">{["제품", "비교표", "미리보기"][idx]}</span>
                      </button>
                      {idx < 2 && <span className="mx-0.5 shrink-0 text-[11px] text-zinc-300 sm:mx-1">›</span>}
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={() => setProposalOpen(false)}
                className="mono ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-400 hover:border-zinc-600 hover:text-black"
                aria-label="닫기">
                <Icon name="x" size={14}/>
              </button>
            </div>
            {/* Row 2: action buttons */}
            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 px-3 pb-2 pt-1.5 sm:px-5">
              {/* Step 1 → 2 */}
              {proposalStep === 1 && (
                <button type="button"
                  disabled={proposalKeys.length < 2}
                  onClick={() => setProposalStep(2)}
                  className="mono flex items-center gap-1.5 rounded-pill border border-[#0078D4] bg-[#0078D4] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#005a9e] disabled:opacity-40 disabled:cursor-not-allowed sm:px-4">
                  비교표 보기 ({proposalKeys.length}/5) <Icon name="arrow-right" size={12}/>
                </button>
              )}
              {/* Step 2 → 3 */}
              {proposalStep === 2 && (
                <>
                  <button type="button" onClick={() => setProposalStep(1)}
                    className="mono flex items-center gap-1.5 rounded-pill border border-zinc-300 bg-white px-3 py-1.5 text-[12px] text-black hover:bg-zinc-50">
                    <Icon name="arrow-left" size={11}/> 제품 재선택
                  </button>
                  <label className="mono flex cursor-pointer items-center gap-1.5 rounded-pill border border-zinc-300 bg-white px-3 py-1.5 text-[12px] text-black hover:border-black"
                    title="선택 제품의 카탈로그 원본 페이지를 모두 PNG 무손실로 부록에 추가합니다">
                    <input
                      type="checkbox"
                      checked={includeCatalogPages}
                      onChange={(e) => setIncludeCatalogPages(e.target.checked)}
                      className="h-3.5 w-3.5 cursor-pointer accent-[#0078D4]"
                    />
                    <span>카탈로그 포함</span>
                  </label>
                  <button type="button"
                    disabled={catalogPagesGenerating}
                    onClick={async () => {
                      try {
                        setProposalEmailBody(buildProposalEmailBody(proposalModels));
                        setProposalTab("doc");
                        const html = await buildProposalWithCatalogPages(proposalModels);
                        setProposalHtml(html);
                        setProposalStep(3);
                      } catch (e) {
                        console.error("제안서 생성 실패:", e);
                        alert("제안서 생성 중 오류가 발생했습니다. 카탈로그 페이지 포함 옵션을 끄고 다시 시도해 주세요.");
                        setCatalogPagesGenerating(false);
                      }
                    }}
                    className="mono flex items-center gap-1.5 rounded-pill border border-[#0078D4] bg-[#0078D4] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#005a9e] disabled:opacity-60 disabled:cursor-wait sm:px-4">
                    {catalogPagesGenerating ? (
                      <>
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"/>
                        렌더링 ({catalogPagesProgress.done}/{catalogPagesProgress.total})
                      </>
                    ) : (
                      <>
                        제안서 생성 <Icon name="arrow-right" size={12}/>
                      </>
                    )}
                  </button>
                </>
              )}
              {/* Step 3: actions */}
              {proposalStep === 3 && (
                <>
                  <button type="button" onClick={() => setProposalStep(2)}
                    className="mono flex items-center gap-1.5 rounded-pill border border-zinc-300 bg-white px-3 py-1.5 text-[12px] text-black hover:bg-zinc-50">
                    <Icon name="arrow-left" size={11}/> 비교표
                  </button>
                  <button type="button"
                    onClick={() => proposalIframeRef.current?.contentWindow?.print()}
                    className="mono rounded-pill border border-zinc-300 bg-white px-3 py-1.5 text-[12px] text-black hover:bg-zinc-50 sm:px-4">
                    인쇄 / PDF
                  </button>
                  <button type="button"
                    onClick={openProposalOutlook}
                    className="mono flex items-center gap-1.5 rounded-pill border border-[#0078D4] bg-[#0078D4] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#005a9e] sm:px-4">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className="shrink-0">
                      <rect width="20" height="20" rx="2" fill="#0078D4"/>
                      <rect x="3" y="5" width="14" height="10" rx="1" fill="white" fillOpacity="0.9"/>
                      <path d="M3 6.5L10 11.5L17 6.5" stroke="#0078D4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Outlook 발송
                  </button>
                  {proposalSentMsg && (
                    <span className="mono text-[11px] text-[#107c10]">{proposalSentMsg}</span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Step 1: 제품 선택 ─────────────────────────────────────── */}
          {proposalStep === 1 && (
            <div className="flex-1 overflow-y-auto p-5">
              <div className="mx-auto max-w-[1100px]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="mono text-[16px] font-bold text-black">제안 제품 선택</h2>
                    <p className="mono mt-0.5 text-[12px] text-zinc-500">
                      고객 사양에 매칭된 제품군입니다. 비교할 제품을 <strong>2~5개</strong> 선택하세요.
                      {recommended.length === 0 && " (사양 입력 후 제품군이 나타납니다)"}
                    </p>
                  </div>
                  {proposalKeys.length > 0 && (
                    <div className="mono flex items-center gap-2 rounded-xl border border-[#0078D4]/30 bg-[#e8f2fc] px-4 py-2">
                      <span className="text-[12px] font-semibold text-[#0078D4]">{proposalKeys.length}개 선택됨</span>
                      <button type="button" onClick={() => setProposalKeys([])} className="text-[11px] text-zinc-400 hover:text-black">초기화</button>
                    </div>
                  )}
                </div>

                {recommended.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-200 py-20 text-center">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-zinc-300"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    <p className="mono text-[13px] text-zinc-400">RFQ 폼에서 폼팩터, 출력 전력, 인증 등을 입력하면<br/>매칭 제품군이 자동으로 표시됩니다.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {recommended.map((m) => {
                      const sel = proposalKeys.includes(m.modelKey);
                      const rank = proposalKeys.indexOf(m.modelKey);
                      return (
                        <button key={m.modelKey} type="button"
                          onClick={() => toggleProposalKey(m.modelKey)}
                          className={`relative flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition ${
                            sel
                              ? "border-[#0078D4] bg-[#e8f2fc] shadow-md"
                              : "border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-sm"
                          }`}>
                          {/* Rank badge */}
                          {sel && (
                            <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#0078D4] text-[10px] font-bold text-white shadow">
                              {rank + 1}
                            </span>
                          )}
                          {/* Model image */}
                          {m.primaryImage && (
                            <div className="flex h-16 items-center justify-center overflow-hidden rounded-lg bg-zinc-50">
                              <img src={`/${m.primaryImage}`} alt={m.model} className="max-h-14 max-w-full object-contain" />
                            </div>
                          )}
                          {/* Name + lineage */}
                          <div>
                            <div className="mono text-[13px] font-bold text-black">{m.model}</div>
                            <div className="mono mt-0.5 text-[10px] text-zinc-500">{m.lineage} {m.subcategory ? `· ${m.subcategory}` : ""}</div>
                          </div>
                          {/* Watts / Volts badges */}
                          {m.watts.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {m.watts.slice(0, 3).map((w, wi) => (
                                <span key={`${w}-${wi}`} className="mono rounded-full border border-zinc-300 bg-white px-2 py-0.5 text-[9px] text-black">{w}</span>
                              ))}
                            </div>
                          )}
                          {/* Context preview */}
                          <p className="mono line-clamp-2 text-[10px] text-zinc-400">{m.contextLines.slice(0, 2).join(" · ") || "—"}</p>
                          {/* Select indicator */}
                          <div className={`mono flex items-center gap-1 text-[10px] font-semibold ${sel ? "text-[#0078D4]" : "text-zinc-300"}`}>
                            {sel ? <><Icon name="check" size={11}/> 선택됨</> : !proposalKeys.length || proposalKeys.length < 5 ? <><Icon name="plus" size={11}/> 선택</> : "—"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: 비교표 ───────────────────────────────────────── */}
          {proposalStep === 2 && (
            <div className="flex-1 overflow-y-auto bg-[#e8e8ea] p-6">
              <div className="mx-auto w-full max-w-[1400px] rounded-md bg-white px-4 py-5 shadow-[0_2px_16px_rgba(0,0,0,0.12)] sm:px-8 md:px-14 md:py-8">
                <h2 className="mono mb-1 text-[22px] font-bold text-black">제품 사양 비교표</h2>
                <p className="mono mb-6 text-[15px] text-zinc-500">선택된 {proposalModels.length}개 제품의 주요 사양을 비교합니다.</p>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse" style={{ minWidth: `${proposalModels.length * 220 + 220}px` }}>
                    <colgroup>
                      <col style={{ width: "200px" }} />
                      {proposalModels.map((_, i) => <col key={i} />)}
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="border border-zinc-200 bg-zinc-100 px-4 py-3 text-left text-[15px] font-semibold text-zinc-500">비교 항목</th>
                        {proposalModels.map((m) => (
                          <th key={m.modelKey} className="border border-zinc-200 px-4 py-3 text-center text-[15px] font-bold"
                            style={{ background: "#0078D4", color: "#fff" }}>
                            {m.model}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "제품군 / Lineage", fn: (m: Model) => m.lineage ?? "—" },
                        { label: "카테고리", fn: (m: Model) => m.category ?? "—" },
                        { label: "서브카테고리", fn: (m: Model) => m.subcategory ?? m.section ?? "—" },
                        { label: "출력 전력", fn: (m: Model) => m.watts.slice(0, 4).join(" / ") || "—" },
                        { label: "출력 전압", fn: (m: Model) => m.volts.slice(0, 4).join(" / ") || "—" },
                        { label: "출력 전류", fn: (m: Model) => m.amps.slice(0, 3).join(" / ") || "—" },
                        { label: "입력 사양", fn: (m: Model) => m.input ?? "—" },
                        { label: "카탈로그 페이지", fn: (m: Model) => m.pages.slice(0, 4).join(", ") || "—" },
                      ].map((row, ri) => (
                        <tr key={row.label} className={ri % 2 === 0 ? "bg-white" : "bg-zinc-50"}>
                          <td className="border border-zinc-200 px-4 py-3 text-[14px] font-semibold text-zinc-500">{row.label}</td>
                          {proposalModels.map((m) => (
                            <td key={m.modelKey} className="border border-zinc-200 px-4 py-3 text-center text-[14px] text-black">
                              {row.fn(m)}
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr className="bg-white">
                        <td className="border border-zinc-200 px-4 py-3 text-[14px] font-semibold text-zinc-500">주요 특징</td>
                        {proposalModels.map((m) => (
                          <td key={m.modelKey} className="border border-zinc-200 px-4 py-3 text-[13px] leading-relaxed">
                            {m.contextLines.slice(0, 4).map((l, li) => <div key={li} className="text-zinc-600">· {l}</div>)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="mono mt-4 text-[13px] text-zinc-400">
                  ← 뒤로 돌아가서 제품 선택을 변경할 수 있습니다.
                </p>

                {/* 카탈로그 페이지 미리보기 (선택 제품별로 어떤 페이지가 첨부될지 표시) */}
                {includeCatalogPages && (
                  <div className="mt-8 rounded-lg border-2 border-[#0078D4]/30 bg-[#f0f7ff] px-6 py-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Icon name="doc" size={14}/>
                      <h3 className="mono text-[14px] font-bold text-[#0078D4]">
                        카탈로그 페이지 미리보기 — 제안서에 첨부될 페이지
                      </h3>
                    </div>
                    <p className="mono mb-3 text-[11.5px] text-zinc-600">
                      각 제품의 datasheet 섹션이 자동으로 식별됩니다. 아래 페이지들이 카탈로그 원본 그대로 무손실 PNG 로 부록에 추가됩니다.
                    </p>
                    <ul className="space-y-2">
                      {proposalModels.map((m) => {
                        const { pages, sectionLabel } = getDatasheetPagesFor(m);
                        return (
                          <li key={m.modelKey} className="flex items-start gap-3 rounded border border-zinc-200 bg-white px-3 py-2">
                            <div className="min-w-[100px] flex-shrink-0">
                              <div className="mono text-[13px] font-bold text-black">{m.model}</div>
                              <div className="mono mt-0.5 text-[10px] text-zinc-500">{m.lineage}</div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="mono text-[11px] font-semibold text-[#0078D4]">
                                {sectionLabel || "(섹션 없음)"}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                {pages.length === 0 ? (
                                  <span className="mono text-[10px] italic text-zinc-400">페이지 정보 없음</span>
                                ) : (
                                  <>
                                    <span className="mono text-[10px] text-zinc-500">총 {pages.length}p:</span>
                                    {pages.map((p) => (
                                      <span key={p} className="mono inline-block rounded border border-[#0078D4]/40 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#0078D4]">
                                        p.{p}
                                      </span>
                                    ))}
                                  </>
                                )}
                              </div>
                              {/* m.pages 와 비교 표시 (참고) */}
                              {pages.length > 0 && JSON.stringify(pages) !== JSON.stringify([...new Set(m.pages)].sort((a,b)=>a-b)) && (
                                <div className="mono mt-1 text-[9.5px] text-zinc-400">
                                  원본 m.pages: [{[...new Set(m.pages)].sort((a,b)=>a-b).join(", ")}] → datasheet 섹션으로 보정됨
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 3: 제안서 미리보기 ─────────────────────────────── */}
          {proposalStep === 3 && (
            <iframe
              key={proposalHtml?.length ?? 0}
              ref={proposalIframeRef}
              srcDoc={proposalHtml ?? ""}
              className="w-full flex-1 border-0"
              style={{ background: "#f4f4f5" }}
              title="제안서 미리보기"
            />
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ── 제안서 Outlook 발송 모달 ──────────────────────────────────
          ══════════════════════════════════════════════════════════════ */}
      {proposalOutlookPreview && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6" style={{ background: "rgba(0,0,0,0.55)" }}>
          <div className="flex w-full max-w-[1100px] flex-col overflow-hidden rounded-t-lg shadow-2xl sm:rounded-lg" style={{ maxHeight: "92dvh", background: "#ffffff" }}>

            {/* ── Outlook 타이틀 바 ─────────────────────────────────── */}
            <div className="flex shrink-0 items-center gap-2.5 px-4 py-2.5" style={{ background: "#0078d4" }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
                <rect width="20" height="20" rx="2" fill="#0078D4"/>
                <rect x="3" y="5" width="14" height="10" rx="1" fill="white" fillOpacity="0.9"/>
                <path d="M3 6.5L10 11.5L17 6.5" stroke="#0078D4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "13px", fontWeight: 600, color: "#ffffff", letterSpacing: "0.01em" }}>
                Outlook — 제안서 발송 메시지 미리보기
              </span>
              <button type="button" onClick={closeProposalOutlook}
                className="ml-auto flex h-7 w-7 items-center justify-center rounded hover:bg-white/10"
                aria-label="닫기">
                <span style={{ color: "white", fontSize: "18px", lineHeight: 1 }}>×</span>
              </button>
            </div>

            {/* ── 액션 바 ──────────────────────────────────────────── */}
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2" style={{ background: "#f3f2f1", borderColor: "#e0e0e0" }}>
              <button type="button" onClick={handleProposalOutlookSend}
                className="flex items-center gap-1.5 rounded px-4 py-1.5 text-white hover:brightness-90 active:brightness-75"
                style={{ background: "#0078d4", fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", fontWeight: 600 }}
                title="Outlook 새 메시지 창을 즉시 열고, 서식 본문은 클립보드에 복사됩니다">
                <Icon name="send" size={13}/>
                Outlook으로 보내기
              </button>
              <button type="button"
                onClick={() => {
                  if (!proposalOutlookPreview) return;
                  const a = document.createElement("a");
                  a.href = proposalOutlookPreview.emlUrl;
                  a.download = proposalOutlookPreview.emlFilename;
                  document.body.appendChild(a); a.click(); a.remove();
                  setTimeout(() => window.open(proposalOutlookPreview.emlUrl, "_blank", "noopener,noreferrer"), 300);
                  setProposalSentMsg(".eml 다운로드 완료 — 자동 실행 안 되면 다운로드 폴더에서 더블클릭");
                  setTimeout(() => setProposalSentMsg(""), 7000);
                }}
                className="flex items-center gap-1.5 rounded border px-3 py-1.5 hover:bg-black/5"
                style={{ borderColor: "#d0d0d0", fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", color: "#323130" }}
                title=".eml 파일(제안서 첨부 포함)을 다운로드하고 자동 실행을 시도합니다">
                <Icon name="external" size={13}/> .eml 다운로드 &amp; 자동 실행
              </button>
              {/* 본문 편집 — 접이식 textarea */}
              <button type="button"
                onClick={() => {
                  const cur = proposalOutlookPreview.htmlBody;
                  const plain = htmlToPlainText(cur);
                  const edited = window.prompt("이메일 본문을 수정하세요 (평문):", plain);
                  if (edited !== null) {
                    setProposalOutlookPreview({ ...proposalOutlookPreview, htmlBody: plainTextToHtml(edited) });
                  }
                }}
                className="flex items-center gap-1.5 rounded border px-3 py-1.5 hover:bg-black/5"
                style={{ borderColor: "#d0d0d0", fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", color: "#323130" }}>
                <Icon name="edit" size={13}/> 본문 편집
              </button>
              <button type="button"
                onClick={() => setProposalOutlookPreview({ ...proposalOutlookPreview, htmlBody: plainTextToHtml(buildProposalEmailBody(proposalModels)) })}
                className="flex items-center gap-1.5 rounded border px-3 py-1.5 hover:bg-black/5"
                style={{ borderColor: "#d0d0d0", fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", color: "#323130" }}>
                <Icon name="refresh" size={13}/> 본문 초기화
              </button>
              {proposalSentMsg && (
                <span className="ml-2" style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", color: "#107c10" }}>{proposalSentMsg}</span>
              )}
              <button type="button" onClick={closeProposalOutlook}
                className="ml-auto rounded border px-3 py-1.5 hover:bg-black/5"
                style={{ borderColor: "#d0d0d0", fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "12px", color: "#323130" }}>
                취소
              </button>
            </div>

            {/* ── 헤더 (받는 사람 / 참조 / 제목 / 첨부) ──────────────── */}
            <div className="shrink-0 border-b" style={{ background: "#fafafa", borderColor: "#e0e0e0" }}>
              <div className="flex items-center gap-3 border-b px-5 py-2.5" style={{ borderColor: "#e8e8e8" }}>
                <span className="w-16 shrink-0" style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "11px", fontWeight: 600, color: "#605e5c" }}>받는 사람</span>
                <span style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "13px", color: proposalOutlookPreview.to ? "#323130" : "#a19f9d" }}>
                  {proposalOutlookPreview.to || "(미입력 — 사양 요청서에서 이메일을 입력하세요)"}
                </span>
              </div>
              {proposalOutlookPreview.cc && (
                <div className="flex items-center gap-3 border-b px-5 py-2.5" style={{ borderColor: "#e8e8e8" }}>
                  <span className="w-16 shrink-0" style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "11px", fontWeight: 600, color: "#605e5c" }}>참조</span>
                  <span style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "13px", color: "#323130" }}>{proposalOutlookPreview.cc}</span>
                </div>
              )}
              <div className="flex items-center gap-3 border-b px-5 py-2.5" style={{ borderColor: "#e8e8e8" }}>
                <span className="w-16 shrink-0" style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "11px", fontWeight: 600, color: "#605e5c" }}>제목</span>
                <span style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "14px", fontWeight: 600, color: "#323130" }}>
                  {proposalOutlookPreview.subject || "(제목 없음)"}
                </span>
              </div>
              {proposalOutlookPreview.atts.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-5 py-2" style={{ background: "#f8f8f8" }}>
                  <span className="inline-flex items-center gap-1" style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "11px", fontWeight: 600, color: "#605e5c" }}>
                    <Icon name="paperclip" size={11}/> 첨부 {proposalOutlookPreview.atts.length}
                  </span>
                  {proposalOutlookPreview.atts.map((a, i) => (
                    <span key={i} className="flex items-center gap-1.5 rounded border bg-white px-2.5 py-1"
                      style={{ borderColor: "#d0d0d0", fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "11px" }}>
                      <span style={{ color: "#0078d4" }}><Icon name="doc" size={12}/></span>
                      <span style={{ color: "#323130", fontWeight: 600 }}>{a.name}</span>
                      <span style={{ color: "#a19f9d" }}>{formatBytes(a.size)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── 본문 미리보기 (iframe) ────────────────────────────── */}
            <iframe
              srcDoc={`<!DOCTYPE html><html><head><meta charset="UTF-8"/><base target="_blank"/><style>
                body { font-family: 'Segoe UI','Malgun Gothic',Arial,sans-serif; font-size: 14px; line-height: 1.7; color: #323130; padding: 28px 40px; margin: 0; }
                img { max-width: 100%; height: auto; }
                a { color: #0078d4; }
                pre, code { font-family: 'Courier New',monospace; white-space: pre-wrap; }
              </style></head><body>${proposalOutlookPreview.htmlBody}</body></html>`}
              className="flex-1"
              style={{ width: "100%", minHeight: "360px", border: "none", background: "#ffffff" }}
              title="제안서 Outlook 본문 미리보기"
              sandbox="allow-same-origin"
            />

            {/* ── 안내 푸터 ─────────────────────────────────────────── */}
            <div className="shrink-0 border-t px-5 py-2.5" style={{ background: "#f3f2f1", borderColor: "#e0e0e0" }}>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0" style={{ color: "#0078d4" }}><Icon name="info" size={12}/></span>
                <div style={{ fontFamily: "'Segoe UI',Arial,sans-serif", fontSize: "10.5px", color: "#605e5c", lineHeight: 1.55 }}>
                  <strong style={{ color: "#0078d4" }}>Outlook으로 보내기</strong> — Outlook 새 메시지 창이 열리며 서식 본문이 클립보드에 복사됩니다. 본문 영역에서
                  <kbd style={{ padding: "1px 4px", border: "1px solid #d0d0d0", borderRadius: "3px", fontSize: "10px", background: "#fff", margin: "0 2px" }}>Ctrl+V</kbd>
                  로 붙여넣으면 폰트·색상이 그대로 유지됩니다.
                  &nbsp;|&nbsp;
                  <strong style={{ color: "#323130" }}>.eml 다운로드</strong> — 제안서 HTML 파일이 첨부된 .eml을 다운로드합니다. Outlook이 기본 앱으로 설정된 경우 자동 실행됩니다.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PDF 미리보기 모달 ────────────────────────────────────────── */}
      {pdfPreviewHtml && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(0,0,0,0.72)" }}>
          {/* 상단 툴바 */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2.5 sm:px-5 sm:py-3">
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 text-red-500">
                <rect x="3" y="2" width="18" height="20" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M7 7h10M7 11h10M7 15h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <span className="mono text-[13px] font-semibold text-black sm:text-[14px]">PDF 미리보기</span>
              <span className="mono hidden text-[12px] text-zinc-400 sm:inline">— 서식 100% 보존 (인쇄/저장)</span>
            </div>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => iframeRef.current?.contentWindow?.print()}
                className="mono rounded-pill border border-black bg-black px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-lime hover:text-black sm:px-4"
              >
                인쇄 / PDF
              </button>
              <button
                type="button"
                onClick={() => setPdfPreviewHtml(null)}
                className="mono rounded-pill border border-zinc-300 bg-white px-3 py-1.5 text-[12px] text-black hover:bg-zinc-50 sm:px-4"
              >
                닫기
              </button>
            </div>
          </div>
          {/* iframe — srcDoc으로 완전한 HTML 렌더링, 브라우저 폰트/색상 100% 적용 */}
          <iframe
            key={pdfPreviewHtml.length}
            ref={iframeRef}
            srcDoc={pdfPreviewHtml}
            className="w-full flex-1 border-0 bg-zinc-100"
            title="PDF 미리보기"
          />
        </div>
      )}
    </>
  );
}

