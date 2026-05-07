"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
}

export default function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [creating, setCreating] = useState(false);
  const [resetId, setResetId] = useState("");
  const [resetPw, setResetPw] = useState("");
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) router.replace("/");
  }, [loading, isAdmin, router]);

  useEffect(() => {
    if (!loading && isAdmin) loadUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAdmin]);

  async function loadUsers() {
    setFetching(true);
    try {
      const data = await apiFetch<UserRow[]>("/admin/users");
      setUsers(data);
    } catch {
      setMsg({ text: "사용자 목록 로드 실패", ok: false });
    } finally {
      setFetching(false);
    }
  }

  function flash(text: string, ok: boolean) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail || !newPw) return;
    setCreating(true);
    try {
      await apiFetch("/admin/users", {
        method: "POST",
        body: JSON.stringify({ email: newEmail, password: newPw }),
      });
      flash(`${newEmail} 생성 완료`, true);
      setNewEmail("");
      setNewPw("");
      await loadUsers();
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "생성 실패", false);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(user: UserRow) {
    if (!confirm(`${user.email} 계정을 삭제하시겠습니까?`)) return;
    try {
      await apiFetch(`/admin/users/${user.id}`, { method: "DELETE" });
      flash(`${user.email} 삭제 완료`, true);
      await loadUsers();
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "삭제 실패", false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetId || !resetPw) return;
    setResetting(true);
    try {
      await apiFetch(`/admin/users/${resetId}/password`, {
        method: "PUT",
        body: JSON.stringify({ password: resetPw }),
      });
      flash("비밀번호 변경 완료", true);
      setResetId("");
      setResetPw("");
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "변경 실패", false);
    } finally {
      setResetting(false);
    }
  }

  async function handleToggleAdmin(user: UserRow) {
    const action = user.is_admin ? "관리자 권한 제거" : "관리자 권한 부여";
    if (!confirm(`${user.email}의 ${action}?`)) return;
    try {
      await apiFetch(`/admin/users/${user.id}/admin`, { method: "PUT" });
      flash(`${action} 완료`, true);
      await loadUsers();
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "변경 실패", false);
    }
  }

  if (loading || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">관리자 페이지</h1>
          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-medium">ADMIN</span>
        </div>

        {msg && (
          <div className={`px-4 py-2.5 rounded text-sm font-medium ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {msg.text}
          </div>
        )}

        {/* User list */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-gray-700">사용자 목록</h2>
            <button onClick={loadUsers} className="text-xs text-gray-400 hover:text-gray-600">새로고침</button>
          </div>
          {fetching ? (
            <div className="px-5 py-8 text-sm text-gray-400 text-center">로딩 중...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">이메일</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">생성일</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">마지막 로그인</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">권한</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-800">{u.email}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString("ko-KR")}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("ko-KR") : "없음"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleAdmin(u)}
                        className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
                          u.is_admin
                            ? "bg-red-100 text-red-700 hover:bg-red-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {u.is_admin ? "관리자" : "일반"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setResetId(u.id)}
                        className="text-xs text-blue-500 hover:text-blue-700 mr-3"
                      >
                        비번변경
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Create user */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-sm text-gray-700 mb-4">새 사용자 추가</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">이메일</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">초기 비밀번호</label>
                <input
                  type="password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="8자 이상"
                  required
                  minLength={8}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>
              <button
                type="submit"
                disabled={creating}
                className="w-full py-2 text-sm font-medium bg-black text-white rounded-lg hover:bg-black/80 disabled:opacity-50 transition-colors"
              >
                {creating ? "생성 중..." : "사용자 추가"}
              </button>
            </form>
          </div>

          {/* Reset password */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-sm text-gray-700 mb-4">비밀번호 변경</h2>
            {resetId && (
              <p className="text-xs text-blue-600 mb-3 truncate">
                대상: {users.find(u => u.id === resetId)?.email}
                <button onClick={() => setResetId("")} className="ml-2 text-gray-400 hover:text-gray-600">×</button>
              </p>
            )}
            <form onSubmit={handleReset} className="space-y-3">
              {!resetId && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">사용자 선택</label>
                  <select
                    value={resetId}
                    onChange={e => setResetId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10"
                  >
                    <option value="">선택하세요</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.email}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">새 비밀번호</label>
                <input
                  type="password"
                  value={resetPw}
                  onChange={e => setResetPw(e.target.value)}
                  placeholder="8자 이상"
                  required
                  minLength={8}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>
              <button
                type="submit"
                disabled={resetting || !resetId}
                className="w-full py-2 text-sm font-medium bg-black text-white rounded-lg hover:bg-black/80 disabled:opacity-50 transition-colors"
              >
                {resetting ? "변경 중..." : "비밀번호 변경"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
