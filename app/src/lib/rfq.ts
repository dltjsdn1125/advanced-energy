// ── RFQ (Request for Quotation) types and utilities ───────────────────────────

export interface CustomerInfo {
  // 기본 고객 정보
  company: string;           // 고객사명
  industry: string;          // 산업 분야
  contactName: string;       // 담당자
  contactEmail: string;      // 이메일
  contactPhone: string;      // 전화
  contactDate: string;       // 최초컨택일 (ISO date)
  meetingDate: string;       // 미팅일 (ISO date)
  meetingTime: string;       // 미팅시간 (HH:mm)
  meetingVenue: string;      // 미팅장소
  salesperson: string;       // 영업 담당자
  responseDeadline: string;  // 요청 회신일 (ISO date)
  notes: string;             // 비고 / 미팅 메모

  // 영업 정보
  customerProject: string;   // 고객사 프로젝트명
  competitor: string;        // 경쟁사 / 현재 사용 제품
  mpqStart: string;          // 양산 시점 (ISO date or text)
  mpqQuantity: string;       // 양산 수량 (ea/yr)
  sampleRequested: string;   // 샘플 요청 여부
  sampleQuantity: string;    // 샘플 수량
  meetingMemo: string;       // 미팅 메모 / 자유 기록
}

// ── SMPS Specification ────────────────────────────────────────────────────────

export interface OutputChannel {
  id: string;
  voltage: string;
  current: string;
  power: string;
}

export interface SmpsSpec {
  // Input
  inputVoltageRange: string;
  inputPhase: string;
  inputFrequency: string;

  // Output
  outputChannels: OutputChannel[];
  totalPower: string;
  outputRegulation: string;
  rippleNoise: string;

  // Physical
  formFactor: string;
  dimensions: string;
  weight: string;
  cooling: string;

  // Features & protections
  features: string[];
  protections: string[];

  // Compliance
  certifications: string[];

  // Application
  application: string;
  targetPrice: string;
  targetDate: string;
}

// ── Revision / History ────────────────────────────────────────────────────────

export interface RfqRevision {
  rev: number;
  savedAt: string;
  customer: CustomerInfo;
  spec: SmpsSpec;
  comment: string;
}

export interface RfqRecord {
  id: string;
  createdAt: string;
  revisions: RfqRevision[];
}

// ── Option Constants ──────────────────────────────────────────────────────────

export const INPUT_VOLTAGE_OPTIONS = [
  "100–240 VAC (Universal)",
  "85–264 VAC (Wide Range)",
  "90–132 / 180–264 VAC",
  "100–120 VAC",
  "200–240 VAC",
  "380–480 VAC (삼상)",
  "24 VDC",
  "48 VDC",
  "110 VDC",
  "직접 입력",
];

export const INPUT_PHASE_OPTIONS = ["단상 (1φ)", "삼상 (3φ)", "DC 입력"];
export const INPUT_FREQ_OPTIONS = ["50 Hz", "60 Hz", "50–60 Hz", "DC (해당 없음)"];

export const OUTPUT_VOLTAGE_OPTIONS = [
  "3.3V", "5V", "12V", "15V", "24V", "28V", "36V", "48V",
  "54V (PoE)", "±15V", "±12V", "직접 입력",
];
export const OUTPUT_CURRENT_OPTIONS = [
  "0.5A", "1A", "2A", "3A", "5A", "10A", "15A", "20A",
  "30A", "40A", "50A", "60A", "직접 입력",
];
export const OUTPUT_POWER_OPTIONS = [
  "10W", "20W", "30W", "50W", "60W", "100W", "150W", "200W",
  "300W", "500W", "600W", "800W", "1000W", "1500W", "2000W", "3000W", "직접 입력",
];
export const TOTAL_POWER_OPTIONS = [
  "< 50W", "50–100W", "100–300W", "300–600W", "600W–1kW",
  "1–3kW", "3–10kW", "> 10kW", "직접 입력",
];
export const REGULATION_OPTIONS = ["±1%", "±2%", "±3%", "±5%", "±10%", "직접 입력"];
export const RIPPLE_OPTIONS = [
  "< 20mV pk-pk", "< 50mV pk-pk", "< 100mV pk-pk", "< 200mV pk-pk", "직접 입력",
];

export const FORM_FACTOR_OPTIONS = [
  "Enclosed (밀폐형)",
  "Open Frame (오픈프레임)",
  "Modular (모듈형)",
  "DIN Rail",
  "U-Type Rack",
  "PCB Mount",
  "Fanless / Conduction Cooled",
  "Desktop Adapter",
  "직접 입력",
];

export const COOLING_OPTIONS = [
  "강제 공냉 (팬 내장)",
  "자연 공냉 (무팬)",
  "전도 냉각",
  "수냉 (워터 쿨링)",
  "직접 입력",
];

export const FEATURE_OPTIONS = [
  "병렬운전 지원 (Parallel Operation)",
  "원격 On/Off",
  "출력 전압 조정 (Trim)",
  "PMBus / 디지털 제어",
  "Power Good 신호",
  "원격 센싱 (Remote Sense)",
  "N+1 이중화",
  "배터리 충전 기능",
  "PFC (역률 개선)",
  "Hot Swap",
  "Fan Speed Control",
];

export const PROTECTION_OPTIONS = [
  "과전류 보호 (OCP)",
  "과전압 보호 (OVP)",
  "과온도 보호 (OTP)",
  "단락 보호 (SCP)",
  "저전압 락아웃 (UVLO)",
  "역전압 보호",
  "입력 퓨즈",
];

export const CERT_OPTIONS = [
  "UL/cUL",
  "CE (LVD + EMC)",
  "IEC 62368-1 (IT/AV)",
  "IEC 60601-1 (의료)",
  "EN 61000-3-2 (고조파)",
  "MIL-STD-461 (군용 EMC)",
  "SEMI F47",
  "CB Scheme",
  "FCC Part 15",
  "KS / KC",
];

export const APPLICATION_OPTIONS = [
  "산업 자동화 / 로봇",
  "의료 기기",
  "통신 / 네트워크",
  "반도체 제조 장비",
  "방산 / 항공우주",
  "LED / 조명",
  "충전기 / ESS",
  "계측 / 분석 장비",
  "철도 / 차량",
  "직접 입력",
];

export const QUANTITY_OPTIONS = [
  "< 100 ea/yr",
  "100–500 ea/yr",
  "500–1,000 ea/yr",
  "1,000–5,000 ea/yr",
  "> 5,000 ea/yr",
  "프로토타입 (소량)",
];

export const INDUSTRY_OPTIONS = [
  "반도체/디스플레이",
  "의료/헬스케어",
  "통신/네트워크",
  "산업자동화/로봇",
  "방산/항공우주",
  "에너지/ESS",
  "철도/운송",
  "연구/계측",
  "기타",
];

export const SAMPLE_OPTIONS = [
  "미요청",
  "요청 (평가용)",
  "요청 (검증용)",
  "요청 (인증용)",
];

export const MPQ_QUANTITY_OPTIONS = [
  "< 100 ea/yr",
  "100–500 ea/yr",
  "500–1,000 ea/yr",
  "1,000–5,000 ea/yr",
  "> 5,000 ea/yr",
];

// ── Empty defaults ────────────────────────────────────────────────────────────

export function emptyCustomer(): CustomerInfo {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    company: "",
    industry: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    contactDate: now.toISOString().slice(0, 10),
    meetingDate: now.toISOString().slice(0, 10),
    meetingTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    meetingVenue: "",
    salesperson: "",
    responseDeadline: "",
    notes: "",
    customerProject: "",
    competitor: "",
    mpqStart: "",
    mpqQuantity: "",
    sampleRequested: "",
    sampleQuantity: "",
    meetingMemo: "",
  };
}

export function emptyChannel(): OutputChannel {
  return { id: crypto.randomUUID(), voltage: "", current: "", power: "" };
}

export function emptySpec(): SmpsSpec {
  return {
    inputVoltageRange: "",
    inputPhase: "",
    inputFrequency: "",
    outputChannels: [emptyChannel()],
    totalPower: "",
    outputRegulation: "",
    rippleNoise: "",
    formFactor: "",
    dimensions: "",
    weight: "",
    cooling: "",
    features: [],
    protections: [],
    certifications: [],
    application: "",
    targetPrice: "",
    targetDate: "",
  };
}

// ── Email template system ─────────────────────────────────────────────────────

export const EMAIL_TEMPLATE_VARS = [
  // 고객 정보
  { key: "{{company}}", label: "고객사명" },
  { key: "{{contactName}}", label: "담당자" },
  { key: "{{industry}}", label: "산업분야" },
  { key: "{{project}}", label: "프로젝트명" },
  { key: "{{salesperson}}", label: "영업담당자" },
  { key: "{{meetingDate}}", label: "미팅일" },
  { key: "{{responseDeadline}}", label: "회신마감" },
  { key: "{{competitor}}", label: "경쟁사" },
  { key: "{{sampleRequested}}", label: "샘플요청" },
  { key: "{{mpqStart}}", label: "양산시점" },
  { key: "{{mpqQuantity}}", label: "양산수량" },
  // SMPS 사양 (드롭다운)
  { key: "{{inputVoltage}}", label: "입력전압" },
  { key: "{{inputPhase}}", label: "입력위상" },
  { key: "{{inputFrequency}}", label: "입력주파수" },
  { key: "{{totalPower}}", label: "총출력" },
  { key: "{{outputRegulation}}", label: "출력레귤레이션" },
  { key: "{{rippleNoise}}", label: "리플노이즈" },
  { key: "{{formFactor}}", label: "폼팩터" },
  { key: "{{cooling}}", label: "냉각방식" },
  { key: "{{features}}", label: "기능요구사항" },
  { key: "{{protections}}", label: "보호기능" },
  { key: "{{certifications}}", label: "인증" },
  { key: "{{application}}", label: "응용분야" },
  { key: "{{targetDate}}", label: "납기목표" },
  // 문서
  { key: "{{docNo}}", label: "문서번호" },
  { key: "{{rev}}", label: "Rev" },
];

export const DEFAULT_EMAIL_SUBJECT = "[사양 확인 요청] {{company}} {{project}} SMPS Rev.{{rev}}";

export const DEFAULT_EMAIL_TEMPLATE = `수신: {{contactName}} 담당자님

안녕하세요. Advanced Energy {{salesperson}}입니다.

지난 {{meetingDate}} 미팅에서 논의해 주신 SMPS 사양서를 정리하여 첨부 드립니다.
상세 내용을 검토해 주시고, 수정이나 추가 요청 사항이 있으시면 회신 부탁드립니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 문서 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 문서번호   : {{docNo}} (Rev.{{rev}})
- 고객사     : {{company}}
- 산업 분야  : {{industry}}
- 프로젝트   : {{project}}
- 담당자     : {{contactName}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ SMPS 사양 요약 — 입력
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 입력 전압  : {{inputVoltage}}
- 입력 위상  : {{inputPhase}}
- 입력 주파수: {{inputFrequency}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ SMPS 사양 요약 — 출력
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 총 출력    : {{totalPower}}
- 출력 레귤  : {{outputRegulation}}
- 리플 노이즈: {{rippleNoise}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ SMPS 사양 요약 — 외형 / 냉각
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 폼팩터     : {{formFactor}}
- 냉각 방식  : {{cooling}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ SMPS 사양 요약 — 기능 / 보호
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 기능 요구  : {{features}}
- 보호 기능  : {{protections}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ SMPS 사양 요약 — 인증 / 응용
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 요구 인증  : {{certifications}}
- 응용 분야  : {{application}}
- 납기 목표  : {{targetDate}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 영업 / 양산 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 경쟁사     : {{competitor}}
- 샘플 요청  : {{sampleRequested}}
- 양산 시점  : {{mpqStart}}
- 양산 수량  : {{mpqQuantity}}
- 회신 마감  : {{responseDeadline}}

검토 후 수정 사항이나 추가 요청이 있으시면 {{responseDeadline}}까지 회신 부탁드립니다.

감사합니다.

{{salesperson}}
Advanced Energy Industries
`;

export function substituteTemplate(
  template: string,
  rev: RfqRevision,
  docNo: string,
): string {
  const c = rev.customer;
  const s = rev.spec;
  const map: Record<string, string> = {
    // 고객 정보
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
    // SMPS 입력
    "{{inputVoltage}}": s.inputVoltageRange,
    "{{inputPhase}}": s.inputPhase,
    "{{inputFrequency}}": s.inputFrequency,
    // SMPS 출력
    "{{totalPower}}": s.totalPower,
    "{{outputRegulation}}": s.outputRegulation,
    "{{rippleNoise}}": s.rippleNoise,
    // 외형 / 냉각
    "{{formFactor}}": s.formFactor,
    "{{cooling}}": s.cooling,
    // 기능 / 보호
    "{{features}}": s.features.join(", "),
    "{{protections}}": s.protections.join(", "),
    // 인증 / 응용
    "{{certifications}}": s.certifications.join(", "),
    "{{application}}": s.application,
    "{{targetDate}}": s.targetDate,
    // 문서
    "{{docNo}}": docNo,
    "{{rev}}": String(rev.rev),
  };
  return template.replace(/\{\{[^}]+\}\}/g, (m) => map[m] ?? m);
}

const EMAIL_TEMPLATE_KEY = "ae_rfq_email_template";
const EMAIL_SUBJECT_KEY = "ae_rfq_email_subject";

export function loadEmailTemplate(): string {
  if (typeof window === "undefined") return DEFAULT_EMAIL_TEMPLATE;
  return localStorage.getItem(EMAIL_TEMPLATE_KEY) ?? DEFAULT_EMAIL_TEMPLATE;
}
export function saveEmailTemplate(t: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(EMAIL_TEMPLATE_KEY, t);
}
export function loadEmailSubject(): string {
  if (typeof window === "undefined") return DEFAULT_EMAIL_SUBJECT;
  return localStorage.getItem(EMAIL_SUBJECT_KEY) ?? DEFAULT_EMAIL_SUBJECT;
}
export function saveEmailSubject(s: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(EMAIL_SUBJECT_KEY, s);
}

// ── Named Email Presets (다중 저장 템플릿) ─────────────────────────────────
// 사용자가 원하는 이름으로 여러 개의 이메일 템플릿(제목 + 평문 템플릿 + HTML 본문)을
// 저장/불러오기할 수 있도록 함. 첨부파일은 base64 dataURL 로 저장.

export interface EmailAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}

export interface EmailPreset {
  id: string;          // 내부 식별자
  name: string;        // 사용자 지정 이름 (예: "삼성전자 견적 요청")
  savedAt: string;     // ISO timestamp
  subject: string;     // 제목 (변수 포함)
  plainTemplate: string; // 평문 템플릿 ({{변수}} 포함)
  htmlBody: string;    // 리치 본문 HTML
  attachments?: EmailAttachment[]; // 선택: 첨부파일까지 함께 저장
}

const EMAIL_PRESETS_KEY = "ae_rfq_email_presets";

export function loadEmailPresets(): EmailPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EMAIL_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EmailPreset[]) : [];
  } catch { return []; }
}

export function saveEmailPresets(list: EmailPreset[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EMAIL_PRESETS_KEY, JSON.stringify(list));
  } catch (e) {
    // QuotaExceeded 가능 (큰 첨부파일 base64 → 5MB 제한 초과)
    console.error("이메일 템플릿 저장 실패:", e);
    throw e;
  }
}

export function addEmailPreset(p: Omit<EmailPreset, "id" | "savedAt">): EmailPreset {
  const preset: EmailPreset = {
    ...p,
    id: `tpl_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`,
    savedAt: new Date().toISOString(),
  };
  const list = loadEmailPresets();
  saveEmailPresets([...list, preset]);
  return preset;
}

export function updateEmailPreset(id: string, patch: Partial<Omit<EmailPreset, "id">>): EmailPreset | null {
  const list = loadEmailPresets();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const updated: EmailPreset = { ...list[idx], ...patch, savedAt: new Date().toISOString() };
  list[idx] = updated;
  saveEmailPresets(list);
  return updated;
}

export function deleteEmailPreset(id: string): void {
  const list = loadEmailPresets();
  saveEmailPresets(list.filter((p) => p.id !== id));
}

// ── JSON backup / restore ─────────────────────────────────────────────────────

export function exportRecordsJson(records: RfqRecord[]): void {
  const json = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records }, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `AE_RFQ_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importRecordsJson(jsonStr: string): RfqRecord[] {
  const parsed = JSON.parse(jsonStr) as { records?: RfqRecord[] } | RfqRecord[];
  if (Array.isArray(parsed)) return parsed;
  if (parsed.records) return parsed.records;
  throw new Error("올바른 RFQ 백업 파일이 아닙니다.");
}

// ── localStorage helpers ──────────────────────────────────────────────────────

const STORAGE_KEY = "ae_rfq_records";

export function loadRecords(): RfqRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RfqRecord[]) : [];
  } catch { return []; }
}

export function saveRecords(records: RfqRecord[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function createRecord(customer: CustomerInfo, spec: SmpsSpec, comment = "최초 작성"): RfqRecord {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    revisions: [{ rev: 0, savedAt: new Date().toISOString(), customer, spec, comment }],
  };
}

export function addRevision(record: RfqRecord, customer: CustomerInfo, spec: SmpsSpec, comment: string): RfqRecord {
  return {
    ...record,
    revisions: [
      ...record.revisions,
      { rev: record.revisions.length, savedAt: new Date().toISOString(), customer, spec, comment },
    ],
  };
}

/** Revision 하나를 삭제하고 번호를 재정렬. 남은 revision이 없으면 null 반환 (record 전체 삭제 필요). */
export function deleteRevision(record: RfqRecord, revNum: number): RfqRecord | null {
  const remaining = record.revisions.filter((r) => r.rev !== revNum);
  if (remaining.length === 0) return null;
  return { ...record, revisions: remaining.map((r, i) => ({ ...r, rev: i })) };
}

/** Revision의 코멘트만 수정한다. */
export function updateRevisionComment(record: RfqRecord, revNum: number, comment: string): RfqRecord {
  return {
    ...record,
    revisions: record.revisions.map((r) => (r.rev === revNum ? { ...r, comment } : r)),
  };
}

// ── CSV / Excel export ────────────────────────────────────────────────────────

export function rfqToCsvRows(rev: RfqRevision): string[][] {
  const c = rev.customer;
  const s = rev.spec;
  return [
    ["SMPS 제품 규격 사양 요청표"],
    [`Rev.${rev.rev}`, `저장: ${rev.savedAt.replace("T", " ").slice(0, 16)}`],
    [],
    ["[고객/미팅 정보]"],
    ["고객사명", c.company], ["프로젝트", c.customerProject],
    ["산업 분야", c.industry], ["담당자", c.contactName],
    ["이메일", c.contactEmail], ["전화", c.contactPhone],
    ["영업 담당자", c.salesperson], ["최초 컨택일", c.contactDate],
    ["미팅일시", `${c.meetingDate} ${c.meetingTime}`],
    ["미팅 장소", c.meetingVenue], ["회신 마감일", c.responseDeadline],
    [],
    ["[영업 정보]"],
    ["경쟁사/현재 제품", c.competitor],
    ["양산 시점", c.mpqStart], ["양산 수량", c.mpqQuantity],
    ["샘플 요청", c.sampleRequested], ["샘플 수량", c.sampleQuantity],
    ["타겟 단가", s.targetPrice], ["납기 목표", s.targetDate],
    [],
    ["[입력 사양]"],
    ["입력 전압 범위", s.inputVoltageRange],
    ["입력 위상", s.inputPhase], ["입력 주파수", s.inputFrequency],
    [],
    ["[출력 사양]"],
    ["채널", "전압", "전류", "전력"],
    ...s.outputChannels.map((ch, i) => [`CH${i + 1}`, ch.voltage, ch.current, ch.power]),
    ["총 출력 전력", s.totalPower],
    ["전압 조정률", s.outputRegulation], ["리플/노이즈", s.rippleNoise],
    [],
    ["[기구 사양]"],
    ["폼팩터", s.formFactor], ["외형 치수", s.dimensions],
    ["무게", s.weight], ["냉각 방식", s.cooling],
    [],
    ["[기능/보호/인증]"],
    ["특수 기능", s.features.join(" / ")],
    ["보호 회로", s.protections.join(" / ")],
    ["요구 인증", s.certifications.join(" / ")],
    ["최종 용도", s.application],
    [],
    ["[비고]"], [c.notes],
    [],
    ["[미팅 메모]"], [c.meetingMemo],
  ];
}

export function downloadCsv(rev: RfqRevision, filename: string): void {
  const rows = rfqToCsvRows(rev);
  const bom = "\uFEFF";
  const csv = bom + rows.map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Excel (HTML → .xls) export ───────────────────────────────────────────────
// Excel이 HTML 테이블을 직접 열 수 있는 방식으로 서식 있는 .xls 파일 생성

export function downloadXls(rev: RfqRevision, filename: string): void {
  const c = rev.customer;
  const s = rev.spec;

  const cell = (val: string, isLabel = false) =>
    `<td style="border:1px solid #d4d4d8;padding:4px 8px;white-space:nowrap;${isLabel ? "background:#f4f4f5;font-weight:bold;min-width:100px;" : ""}">${esc(val)}</td>`;
  const header = (title: string, cols = 4) =>
    `<tr><th colspan="${cols}" style="background:#3f3f46;color:#fff;padding:5px 10px;text-align:left;font-size:11pt;letter-spacing:0.1em;">${esc(title)}</th></tr>`;
  const row2 = (l1: string, v1: string, l2 = "", v2 = "") =>
    `<tr>${cell(l1, true)}${cell(v1)}${l2 ? cell(l2, true) : `<td colspan="2"></td>`}${l2 ? cell(v2) : ""}</tr>`;

  function esc(s: string): string {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  const docHeader = `
  <tr>
    <td colspan="4" style="padding:8pt 12pt;background:#fff;border-bottom:2px solid #3f3f46;">
      <table style="width:100%;border-collapse:collapse;margin:0;">
        <tr>
          <td style="font-size:9pt;font-weight:bold;color:#000;padding:0;white-space:nowrap;">
            Advanced Energy Industries
          </td>
          <td style="text-align:center;font-size:14pt;font-weight:bold;letter-spacing:0.08em;color:#000;padding:0;white-space:nowrap;">
            SMPS Product Specification Request
          </td>
          <td style="text-align:right;font-size:9pt;font-weight:bold;color:#000;white-space:nowrap;padding:0;vertical-align:middle;">
            SEMIGATE
          </td>
        </tr>
        <tr>
          <td colspan="3" style="padding:2pt 0 0 0;font-size:7.5pt;color:#666;letter-spacing:0.1em;">
            Sales Engineering — Specification Request Form
          </td>
        </tr>
      </table>
    </td>
  </tr>`;

  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8">
<style>
  body { font-family: Arial, "Malgun Gothic", sans-serif; font-size: 10pt; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 10pt; }
</style>
</head><body>
<table>
  ${docHeader}
  ${row2("문서번호", `RFQ-${rev.rev}`, "저장일시", rev.savedAt.replace("T", " ").slice(0, 16))}
  ${row2("고객사", c.company, "프로젝트명", c.customerProject)}
  ${row2("담당자", c.contactName, "이메일", c.contactEmail)}
  ${row2("전화", c.contactPhone, "산업 분야", c.industry)}
  ${row2("미팅일시", `${c.meetingDate} ${c.meetingTime}`, "미팅 장소", c.meetingVenue)}
  ${row2("영업 담당자", c.salesperson, "최초 컨택일", c.contactDate)}
  ${row2("회신 마감일", c.responseDeadline, "비고", c.notes)}
</table>

<table>
  ${header("영업 정보")}
  ${row2("경쟁사/현재 제품", c.competitor, "타겟 단가", s.targetPrice)}
  ${row2("양산 시점", c.mpqStart, "양산 수량", c.mpqQuantity)}
  ${row2("샘플 요청", c.sampleRequested, "샘플 수량", c.sampleQuantity)}
  ${row2("납기 목표", s.targetDate, "최종 용도", s.application)}
</table>

<table>
  ${header("입력 사양")}
  ${row2("입력 전압 범위", s.inputVoltageRange, "입력 위상", s.inputPhase)}
  ${row2("입력 주파수", s.inputFrequency)}
</table>

<table>
  <tr>
    ${cell("채널", true)}${cell("출력 전압", true)}${cell("출력 전류", true)}${cell("출력 전력", true)}
  </tr>
  ${s.outputChannels.map((ch, i) => `<tr>${cell("CH" + (i + 1), true)}${cell(ch.voltage)}${cell(ch.current)}${cell(ch.power)}</tr>`).join("")}
  ${row2("총 출력 전력", s.totalPower, "전압 조정률", s.outputRegulation)}
  ${row2("리플/노이즈", s.rippleNoise)}
</table>

<table>
  ${header("기구 사양")}
  ${row2("폼팩터", s.formFactor, "냉각 방식", s.cooling)}
  ${row2("외형 치수 (mm)", s.dimensions, "무게", s.weight)}
</table>

<table>
  ${header("기능 / 보호 / 인증", 2)}
  <tr>${cell("특수 기능", true)}${cell(s.features.join(" / "))}</tr>
  <tr>${cell("보호 회로", true)}${cell(s.protections.join(" / "))}</tr>
  <tr>${cell("요구 인증", true)}${cell(s.certifications.join(" / "))}</tr>
</table>

<table>
  ${header("미팅 메모 / 자유 기록", 2)}
  <tr><td colspan="2" style="border:1px solid #d4d4d8;padding:6px 8px;white-space:pre-wrap;">${esc(c.meetingMemo)}</td></tr>
</table>
</body></html>`;

  const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── mailto builder ────────────────────────────────────────────────────────────

export function buildMailto(rev: RfqRevision): string {
  const c = rev.customer;
  const s = rev.spec;
  const subject = encodeURIComponent(`[사양 요청] ${c.company} SMPS Rev.${rev.rev}`);
  const body = encodeURIComponent([
    `안녕하세요, ${c.contactName} 담당자님.`,
    "",
    `Advanced Energy 영업: ${c.salesperson || "(담당자)"}`,
    "",
    "=== SMPS 요청 사양 요약 ===",
    `고객사: ${c.company}  /  프로젝트: ${c.customerProject}`,
    `산업: ${c.industry}`,
    `경쟁사: ${c.competitor}`,
    "",
    `[입력] ${s.inputVoltageRange} / ${s.inputPhase} / ${s.inputFrequency}`,
    ...s.outputChannels.map((ch, i) => `[CH${i + 1}] ${ch.voltage} / ${ch.current} / ${ch.power}`),
    `총 출력: ${s.totalPower}`,
    `폼팩터: ${s.formFactor}`,
    `인증: ${s.certifications.join(", ")}`,
    `최종용도: ${s.application}`,
    `양산수량: ${c.mpqQuantity}  /  양산시점: ${c.mpqStart}`,
    `타겟단가: ${s.targetPrice}  /  회신마감: ${c.responseDeadline}`,
    "",
    "상세 사양서를 첨부 파일로 전달 드립니다.",
    "",
    "감사합니다.",
  ].join("\n"));
  return `mailto:${c.contactEmail}?subject=${subject}&body=${body}`;
}
