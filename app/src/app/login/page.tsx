"use client";
import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase";

// ── 비밀번호 재설정 요청 폼 ───────────────────────────────────────────────────
function ResetRequestForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail]     = useState("");
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const sb = createClient();
    const { error: err } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/login",
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  }

  if (sent) return (
    <div className="flex flex-col gap-4 text-center">
      <p className="text-sm text-black/70">
        <span className="font-medium">{email}</span>으로 재설정 링크를 보냈습니다.<br />
        이메일을 확인해주세요.
      </p>
      <button onClick={onBack} className="text-[12px] text-blue-600 underline">로그인으로 돌아가기</button>
    </div>
  );

  return (
    <form onSubmit={handleReset} className="flex flex-col gap-4">
      <p className="text-[12px] text-black/60">가입한 이메일을 입력하면 재설정 링크를 보내드립니다.</p>
      <input
        type="email" value={email} onChange={e => setEmail(e.target.value)}
        required autoComplete="email"
        className="h-9 rounded-lg border border-black/15 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        placeholder="you@advancedenergy.com"
      />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}
      <button type="submit" disabled={loading}
        className="h-9 rounded-lg bg-blue-600 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50">
        {loading ? "전송 중…" : "재설정 링크 보내기"}
      </button>
      <button type="button" onClick={onBack} className="text-[12px] text-black/40 hover:text-black/70">
        ← 로그인으로 돌아가기
      </button>
    </form>
  );
}

// ── 새 비밀번호 설정 폼 (이메일 링크 클릭 후) ────────────────────────────────
function NewPasswordForm() {
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [error, setError]         = useState("");
  const [done, setDone]           = useState(false);
  const [loading, setLoading]     = useState(false);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("비밀번호가 일치하지 않습니다."); return; }
    if (password.length < 6)  { setError("비밀번호는 6자 이상이어야 합니다."); return; }
    setError(""); setLoading(true);
    const sb = createClient();
    const { error: err } = await sb.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => { window.location.replace("/login"); }, 2000);
  }

  if (done) return (
    <p className="text-center text-sm text-green-600">비밀번호가 변경되었습니다. 로그인 페이지로 이동합니다…</p>
  );

  return (
    <form onSubmit={handleUpdate} className="flex flex-col gap-4">
      <p className="text-[13px] font-medium text-black/70">새 비밀번호 설정</p>
      <input
        type="password" value={password} onChange={e => setPassword(e.target.value)}
        required minLength={6} placeholder="새 비밀번호 (6자 이상)"
        className="h-9 rounded-lg border border-black/15 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      <input
        type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
        required placeholder="비밀번호 확인"
        className="h-9 rounded-lg border border-black/15 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}
      <button type="submit" disabled={loading}
        className="h-9 rounded-lg bg-blue-600 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50">
        {loading ? "저장 중…" : "비밀번호 변경"}
      </button>
    </form>
  );
}

// ── 일반 로그인 폼 ────────────────────────────────────────────────────────────
function LoginForm() {
  const { signIn } = useAuth();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showReset, setShowReset] = useState(false);

  // Detect recovery token in URL hash (#type=recovery or #access_token=...&type=recovery)
  const [isRecovery, setIsRecovery] = useState(false);
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("type=signup")) {
      setIsRecovery(true);
    }
  }, []);

  if (isRecovery) return <NewPasswordForm />;
  if (showReset)  return <ResetRequestForm onBack={() => setShowReset(false)} />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const { error: err } = await signIn(email, password);
    setLoading(false);
    if (err) { setError(err); } else { window.location.replace(next); }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-medium text-black/60">Email</label>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          required autoComplete="email"
          className="h-9 rounded-lg border border-black/15 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="you@advancedenergy.com"
        />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-[12px] font-medium text-black/60">Password</label>
          <button type="button" onClick={() => setShowReset(true)}
            className="text-[11px] text-blue-500 hover:text-blue-700">
            비밀번호를 잊으셨나요?
          </button>
        </div>
        <input
          type="password" value={password} onChange={e => setPassword(e.target.value)}
          required autoComplete="current-password"
          className="h-9 rounded-lg border border-black/15 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="••••••••"
        />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}
      <button type="submit" disabled={loading}
        className="mt-1 h-9 rounded-lg bg-blue-600 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50">
        {loading ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-black/10 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <p className="text-sm text-black/50">Internal Tools · Sign in</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
