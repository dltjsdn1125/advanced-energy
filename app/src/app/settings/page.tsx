"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/api";

interface Config {
  openaiKey: string;
  telegramToken: string;
  telegramChatId: string;
  dailyStartTime: string;
  dailyEndTime: string;
  imapHost: string;
  imapPort: string;
  imapSsl: boolean;
  imapUser: string;
  imapPass: string;
  smtpHost: string;
  smtpPort: string;
  smtpSsl: boolean;
  popHost: string;
  popPort: string;
  popSsl: boolean;
  popUser: string;
  popPass: string;
  popLeaveOnServer: boolean;
}

interface ApiSettings {
  openai_key: string;
  telegram_token: string;
  telegram_chat_id: string;
  daily_start_time: string;
  daily_end_time: string;
  imap_host: string;
  imap_port: string;
  imap_ssl: boolean;
  imap_user: string;
  imap_pass: string;
  smtp_host: string;
  smtp_port: string;
  smtp_ssl: boolean;
  pop_host: string;
  pop_port: string;
  pop_ssl: boolean;
  pop_user: string;
  pop_pass: string;
  pop_leave_on_server: boolean;
}

const DEFAULTS: Config = {
  openaiKey: "",
  dailyStartTime: "09:00",
  dailyEndTime: "18:00",
  telegramToken: "",
  telegramChatId: "",
  imapHost: "",
  imapPort: "993",
  imapSsl: true,
  imapUser: "",
  imapPass: "",
  smtpHost: "",
  smtpPort: "587",
  smtpSsl: true,
  popHost: "",
  popPort: "995",
  popSsl: true,
  popUser: "",
  popPass: "",
  popLeaveOnServer: true,
};

const LS_KEY = "ae_settings_v1";

function toApi(c: Config): ApiSettings {
  return {
    openai_key: c.openaiKey,
    telegram_token: c.telegramToken,
    telegram_chat_id: c.telegramChatId,
    daily_start_time: c.dailyStartTime,
    daily_end_time: c.dailyEndTime,
    imap_host: c.imapHost,
    imap_port: c.imapPort,
    imap_ssl: c.imapSsl,
    imap_user: c.imapUser,
    imap_pass: c.imapPass,
    smtp_host: c.smtpHost,
    smtp_port: c.smtpPort,
    smtp_ssl: c.smtpSsl,
    pop_host: c.popHost,
    pop_port: c.popPort,
    pop_ssl: c.popSsl,
    pop_user: c.popUser,
    pop_pass: c.popPass,
    pop_leave_on_server: c.popLeaveOnServer,
  };
}

function fromApi(a: ApiSettings): Config {
  return {
    openaiKey: a.openai_key ?? "",
    telegramToken: a.telegram_token ?? "",
    telegramChatId: a.telegram_chat_id ?? "",
    dailyStartTime: a.daily_start_time ?? "09:00",
    dailyEndTime: a.daily_end_time ?? "18:00",
    imapHost: a.imap_host ?? "",
    imapPort: a.imap_port ?? "993",
    imapSsl: a.imap_ssl ?? true,
    imapUser: a.imap_user ?? "",
    imapPass: a.imap_pass ?? "",
    smtpHost: a.smtp_host ?? "",
    smtpPort: a.smtp_port ?? "587",
    smtpSsl: a.smtp_ssl ?? true,
    popHost: a.pop_host ?? "",
    popPort: a.pop_port ?? "995",
    popSsl: a.pop_ssl ?? true,
    popUser: a.pop_user ?? "",
    popPass: a.pop_pass ?? "",
    popLeaveOnServer: a.pop_leave_on_server ?? true,
  };
}

function loadLocal(): Config {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

function saveLocal(cfg: Config) {
  localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  localStorage.setItem("ae_openai_key", cfg.openaiKey);
  localStorage.setItem("ae_telegram_token", cfg.telegramToken);
  localStorage.setItem("ae_telegram_chat_id", cfg.telegramChatId);
  localStorage.setItem("ae_daily_start", cfg.dailyStartTime);
  localStorage.setItem("ae_daily_end", cfg.dailyEndTime);
}

// ── Shared sub-components defined OUTSIDE parent to prevent remount on re-render ──

function Field({
  label, value, onChange, type = "text", placeholder = "", hint = "",
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-semibold text-ink-700">{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoComplete="off"
        className="w-full rounded border border-ink-200 px-3 py-2 text-[13px] focus:border-[#0078d4] focus:outline-none focus:ring-2 focus:ring-[#0078d4]/20"
      />
      {hint && <p className="mt-0.5 text-[11px] text-ink-400">{hint}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-[#0078d4]" : "bg-ink-200"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}/>
      </button>
      <span className="text-[12px] text-ink-700">{label}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-sm space-y-4">
      <h2 className="text-[14px] font-bold text-ink-900 border-b border-ink-100 pb-2">{title}</h2>
      {children}
    </div>
  );
}

const HAS_API = true; // Next.js /api/settings route always available

export default function SettingsPage() {
  const [cfg, setCfg] = useState<Config>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [testStatus, setTestStatus] = useState<Record<string, string>>({});
  const [cloudSync, setCloudSync] = useState(false);

  useEffect(() => {
    const local = loadLocal();
    setCfg(local);
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch("/api/settings", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json() as ApiSettings;
        // Merge: DB values override local ONLY for non-empty strings and booleans.
        // Prevents an empty DB row ({}) from wiping out locally saved values.
        const apiData = fromApi(data);
        const merged: Config = { ...local };
        for (const key of Object.keys(merged) as Array<keyof Config>) {
          const v = apiData[key];
          if (typeof v === "boolean") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (merged as any)[key] = v;
          } else if (typeof v === "string" && v !== "") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (merged as any)[key] = v;
          }
        }
        setCfg(merged);
        setCloudSync(true);
      } catch {
        // local fallback already applied above
      }
    })();
  }, []);

  function set<K extends keyof Config>(k: K, v: Config[K]) {
    setCfg(prev => ({ ...prev, [k]: v }));
  }

  async function save() {
    setSaveError("");
    saveLocal(cfg);
    try {
      const token = await getToken();
      if (!token) throw new Error("로그인이 필요합니다");
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(toApi(cfg)),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      setCloudSync(true);
    } catch (e: unknown) {
      setSaveError("Cloud save failed: " + String(e));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function testTelegram() {
    setTestStatus(s => ({ ...s, telegram: "전송 중…" }));
    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: cfg.telegramToken,
          chatId: cfg.telegramChatId,
          text: "AE Mail — Telegram 연결 테스트 성공!",
        }),
      });
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      setTestStatus(s => ({ ...s, telegram: "✓ 전송 완료" }));
    } catch (e: unknown) {
      setTestStatus(s => ({ ...s, telegram: "✗ " + String(e) }));
    }
  }

  async function testOpenAI() {
    setTestStatus(s => ({ ...s, openai: "확인 중…" }));
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${cfg.openaiKey}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTestStatus(s => ({ ...s, openai: "✓ 유효한 키" }));
    } catch (e: unknown) {
      setTestStatus(s => ({ ...s, openai: "✗ " + String(e) }));
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8] px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold text-ink-900">Settings</h1>
            <p className="text-[13px] text-ink-500">
              {cloudSync ? "☁ Cloud synced — saved to Supabase" : "☁ Syncing with cloud…"}
            </p>
          </div>
          <button
            onClick={save}
            className={`rounded-lg px-5 py-2.5 text-[13px] font-semibold transition whitespace-nowrap ${
              saved
                ? "bg-green-500 text-white"
                : "bg-[#0078d4] text-white hover:bg-[#005fa3]"
            }`}>
            {saved ? "✓ Saved" : "Save All"}
          </button>
        </div>

        {saveError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[12px] text-red-600">{saveError}</div>
        )}

        {/* AI */}
        <Section title="AI — OpenAI">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[12px] text-blue-800">
            AI 기능(초안 생성, 요약, 번역, 레포트)에 사용됩니다. GPT-4o 모델이 사용됩니다.
          </div>
          <Field
            label="OpenAI API Key"
            value={cfg.openaiKey}
            onChange={v => set("openaiKey", v)}
            type="password"
            placeholder="sk-…"
            hint={HAS_API ? "Supabase에 암호화 저장됩니다." : "키는 브라우저 localStorage에만 저장됩니다."}
          />
          <div className="flex items-center gap-3">
            <button onClick={testOpenAI}
              className="rounded border border-ink-200 px-3 py-1.5 text-[12px] text-ink-600 hover:border-[#0078d4] hover:text-[#0078d4] transition">
              연결 테스트
            </button>
            {testStatus.openai && (
              <span className={`text-[12px] font-medium ${testStatus.openai.startsWith("✓") ? "text-green-600" : testStatus.openai.includes("중") ? "text-ink-400" : "text-red-500"}`}>
                {testStatus.openai}
              </span>
            )}
          </div>
        </Section>

        {/* Report time range */}
        <Section title="Report — Daily 기준 시간">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[12px] text-blue-800">
            Daily Report는 아래 시간 범위 내에 수신/발신된 이메일만 분석합니다.<br/>
            예: 업무 시간(09:00 ~ 18:00)으로 설정하면 퇴근 후 메일은 제외됩니다.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-ink-700">시작 시간</label>
              <input
                type="time" value={cfg.dailyStartTime}
                onChange={e => set("dailyStartTime", e.target.value)}
                className="w-full rounded border border-ink-200 px-3 py-2 text-[13px] focus:border-[#0078d4] focus:outline-none focus:ring-2 focus:ring-[#0078d4]/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-ink-700">종료 시간</label>
              <input
                type="time" value={cfg.dailyEndTime}
                onChange={e => set("dailyEndTime", e.target.value)}
                className="w-full rounded border border-ink-200 px-3 py-2 text-[13px] focus:border-[#0078d4] focus:outline-none focus:ring-2 focus:ring-[#0078d4]/20"
              />
            </div>
          </div>
          <p className="text-[11px] text-ink-500">
            현재 설정: <span className="font-semibold">{cfg.dailyStartTime}</span> ~ <span className="font-semibold">{cfg.dailyEndTime}</span> 사이의 이메일을 Daily 분석 대상으로 포함
          </p>
        </Section>

        {/* Telegram */}
        <Section title="Telegram 알림">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[12px] text-blue-800">
            레포트를 Telegram으로 발송합니다.{" "}
            <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="underline font-medium">@BotFather</a>에서 봇을 만들고, <code className="bg-blue-100 px-1 rounded text-[11px]">/start</code>를 보낸 후{" "}
            <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="underline font-medium">@userinfobot</a>에서 Chat ID를 확인하세요.
          </div>
          <Field
            label="Bot Token"
            value={cfg.telegramToken}
            onChange={v => set("telegramToken", v)}
            type="password"
            placeholder="1234567890:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
            hint="BotFather에서 발급받은 토큰"
          />
          <Field
            label="Chat ID"
            value={cfg.telegramChatId}
            onChange={v => set("telegramChatId", v)}
            placeholder="123456789 또는 -100123456789 (그룹)"
            hint="개인 채팅: 양수 / 그룹: -100으로 시작하는 음수"
          />
          <div className="flex items-center gap-3">
            <button onClick={testTelegram}
              disabled={!cfg.telegramToken || !cfg.telegramChatId}
              className="rounded border border-ink-200 px-3 py-1.5 text-[12px] text-ink-600 hover:border-[#0078d4] hover:text-[#0078d4] transition disabled:opacity-40 disabled:cursor-not-allowed">
              테스트 메시지 전송
            </button>
            {testStatus.telegram && (
              <span className={`text-[12px] font-medium ${testStatus.telegram.startsWith("✓") ? "text-green-600" : testStatus.telegram.includes("중") ? "text-ink-400" : "text-red-500"}`}>
                {testStatus.telegram}
              </span>
            )}
          </div>
        </Section>

        {/* IMAP */}
        <Section title="IMAP — 받기">
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-[12px] text-amber-800">
            IMAP 설정은 웹 메일 연결(별도 탭)에 사용됩니다. 로컬 Outlook 연동에는 불필요합니다.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="IMAP Host" value={cfg.imapHost} onChange={v => set("imapHost", v)} placeholder="imap.gmail.com"/>
            <Field label="Port" value={cfg.imapPort} onChange={v => set("imapPort", v)} placeholder="993"/>
          </div>
          <Toggle label="SSL/TLS 사용" checked={cfg.imapSsl} onChange={v => set("imapSsl", v)}/>
          <Field label="이메일" value={cfg.imapUser} onChange={v => set("imapUser", v)} placeholder="you@example.com"/>
          <Field label="비밀번호 / 앱 비밀번호" value={cfg.imapPass} onChange={v => set("imapPass", v)} type="password" hint="Gmail: 앱 비밀번호 사용 권장"/>
        </Section>

        {/* POP3 */}
        <Section title="POP3 — 받기 (레거시)">
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-[12px] text-amber-800">
            POP3는 메일을 서버에서 다운로드합니다. IMAP을 지원하지 않는 서버에 사용하세요.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="POP3 Host" value={cfg.popHost} onChange={v => set("popHost", v)} placeholder="pop.gmail.com"/>
            <Field label="Port" value={cfg.popPort} onChange={v => set("popPort", v)} placeholder="995"/>
          </div>
          <Toggle label="SSL/TLS 사용" checked={cfg.popSsl} onChange={v => set("popSsl", v)}/>
          <Field label="이메일" value={cfg.popUser} onChange={v => set("popUser", v)} placeholder="you@example.com"/>
          <Field label="비밀번호 / 앱 비밀번호" value={cfg.popPass} onChange={v => set("popPass", v)} type="password" hint="Gmail: 앱 비밀번호 사용 권장"/>
          <Toggle label="서버에 메일 보관 (받은 후 삭제 안 함)" checked={cfg.popLeaveOnServer} onChange={v => set("popLeaveOnServer", v)}/>
        </Section>

        {/* SMTP */}
        <Section title="SMTP — 보내기">
          <div className="grid grid-cols-2 gap-3">
            <Field label="SMTP Host" value={cfg.smtpHost} onChange={v => set("smtpHost", v)} placeholder="smtp.gmail.com"/>
            <Field label="Port" value={cfg.smtpPort} onChange={v => set("smtpPort", v)} placeholder="587"/>
          </div>
          <Toggle label="STARTTLS / SSL 사용" checked={cfg.smtpSsl} onChange={v => set("smtpSsl", v)}/>
        </Section>

        <div className="pb-6 flex justify-end">
          <button
            onClick={save}
            className={`rounded-lg px-6 py-2.5 text-[13px] font-semibold transition whitespace-nowrap ${
              saved ? "bg-green-500 text-white" : "bg-[#0078d4] text-white hover:bg-[#005fa3]"
            }`}>
            {saved ? "✓ Saved" : "Save All"}
          </button>
        </div>
      </div>
    </div>
  );
}
