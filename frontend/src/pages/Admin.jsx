// frontend/src/pages/Admin.jsx

import { useEffect, useState } from "react";
import { api } from "../services/api";
import {
  ShieldCheck,
  Users,
  BookOpen,
  Coins,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Copy,
} from "lucide-react";

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [inviteCount, setInviteCount] = useState(5);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingUid, setWorkingUid] = useState("");
  const [message, setMessage] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setMessage("");

    try {
      const [statsResult, usersResult] = await Promise.all([
        api.get("/api/admin/stats"),
        api.get("/api/admin/pending-users"),
      ]);

      setStats(statsResult.stats);
      setPendingUsers(usersResult.users || []);
    } catch (error) {
      setMessage(
        error?.message ||
          "관리자 정보를 불러오지 못했습니다. 로그인과 관리자 권한을 확인하세요."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function approveUser(uid) {
    if (!window.confirm("이 회원을 승인하고 초기 코인 1,000개를 지급할까요?")) {
      return;
    }

    setWorkingUid(uid);
    setMessage("");

    try {
      await api.post(`/api/admin/users/${encodeURIComponent(uid)}/approve`);

      setMessage("회원 승인 처리가 완료됐습니다.");
      await loadDashboard();
    } catch (error) {
      setMessage(error?.message || "회원 승인에 실패했습니다.");
    } finally {
      setWorkingUid("");
    }
  }

  async function createInvites() {
    if (!Number.isInteger(inviteCount) || inviteCount < 1 || inviteCount > 50) {
      setMessage("초대 코드는 한 번에 1~50개까지 발급할 수 있습니다.");
      return;
    }

    setMessage("");

    try {
      const result = await api.post("/api/invites/create", {
        count: inviteCount,
      });

      const created = result.invites || result.codes || [];

      setInvites((old) => [...created, ...old]);
      setMessage(
        created.length
          ? `초대 코드 ${created.length}개를 발급했습니다.`
          : result.message || "요청은 처리됐지만 응답에 코드가 없습니다."
      );
    } catch (error) {
      setMessage(
        error?.message ||
          "초대 코드 발급에 실패했습니다. 백엔드 API를 확인하세요."
      );
    }
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      setMessage("초대 코드를 복사했습니다.");
    } catch {
      setMessage("복사에 실패했습니다. 코드를 직접 선택해서 복사하세요.");
    }
  }

  const cards = [
    {
      title: "전체 회원",
      value: stats?.totalUsers ?? 0,
      icon: Users,
    },
    {
      title: "승인 대기",
      value: stats?.pendingUsers ?? 0,
      icon: ShieldCheck,
    },
    {
      title: "웹툰",
      value: stats?.totalWebtoons ?? 0,
      icon: BookOpen,
    },
    {
      title: "회차 구매",
      value: stats?.totalPurchases ?? 0,
      icon: Coins,
    },
  ];

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <div className="admin-eyebrow">
            <ShieldCheck size={15} />
            BANGKKU TOONGKU · ADMIN
          </div>

          <h1>관리자 대시보드</h1>

          <p>회원 승인과 초대 코드 발급을 관리한다.</p>
        </div>

        <button
          className="admin-refresh"
          onClick={loadDashboard}
          disabled={loading}
        >
          <RefreshCw size={16} />
          새로고침
        </button>
      </header>

      {message && (
        <div className="admin-message" role="status">
          <AlertCircle size={18} />
          <span>{message}</span>
        </div>
      )}

      {loading ? (
        <div className="admin-loading">데이터 불러오는 중...</div>
      ) : (
        <>
          <section className="admin-stats">
            {cards.map(({ title, value, icon: Icon }) => (
              <article className="admin-stat" key={title}>
                <div className="admin-stat-icon">
                  <Icon size={21} />
                </div>
                <span>{title}</span>
                <strong>{value.toLocaleString("ko-KR")}</strong>
              </article>
            ))}
          </section>

          <section className="admin-panel">
            <div className="admin-section-title">
              <div>
                <h2>승인 대기 회원</h2>
                <p>승인하면 가상 코인 1,000개를 최초 지급한다.</p>
              </div>

              <span className="admin-count">
                {pendingUsers.length}명
              </span>
            </div>

            {pendingUsers.length === 0 ? (
              <div className="admin-empty">
                <CheckCircle size={24} />
                <p>현재 승인 대기 회원이 없다.</p>
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>닉네임</th>
                      <th>이메일</th>
                      <th>초대 코드 사용</th>
                      <th>관리</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pendingUsers.map((user) => (
                      <tr key={user.uid}>
                        <td>{user.nickname || "닉네임 없음"}</td>
                        <td>{user.email || "이메일 없음"}</td>
                        <td>
                          {user.inviteConsumed ? "사용 완료" : "미확인"}
                        </td>
                        <td>
                          <button
                            className="admin-approve"
                            disabled={workingUid === user.uid}
                            onClick={() => approveUser(user.uid)}
                          >
                            {workingUid === user.uid
                              ? "처리 중..."
                              : "회원 승인"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="admin-panel">
            <div className="admin-section-title">
              <div>
                <h2>초대 코드 발급</h2>
                <p>발급한 코드는 허가된 사용자에게만 전달해라.</p>
              </div>
            </div>

            <div className="admin-invite-controls">
              <label htmlFor="invite-count">발급 개수</label>

              <input
                id="invite-count"
                type="number"
                min="1"
                max="50"
                value={inviteCount}
                onChange={(event) =>
                  setInviteCount(Number(event.target.value))
                }
              />

              <button
                className="admin-primary"
                onClick={createInvites}
              >
                초대 코드 발급
              </button>
            </div>

            {invites.length > 0 && (
              <div className="admin-invite-list">
                {invites.map((item, index) => {
                  const code =
                    typeof item === "string"
                      ? item
                      : item.code || item.inviteCode || "";

                  return (
                    <div className="admin-invite-item" key={`${code}-${index}`}>
                      <code>{code || "코드 응답 형식 확인 필요"}</code>

                      {code && (
                        <button
                          aria-label="초대 코드 복사"
                          onClick={() => copyCode(code)}
                        >
                          <Copy size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
