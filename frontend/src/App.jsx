import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
} from "react-router-dom";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  Crown,
  Home,
  BookOpen,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Coins,
} from "lucide-react";

import { auth, db, firebaseConfigured } from "./firebase/firebase";
import { api } from "./services/api";
import Admin from "./pages/Admin";
import "./styles.css";
import "./admin.css";

function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      if (!firebaseConfigured) {
        throw new Error("Firebase 설정을 먼저 완료해라.");
      }

      if (mode === "register") {
        if (!nickname.trim() || !inviteCode.trim()) {
          throw new Error("닉네임과 초대 코드를 입력해라.");
        }

        const validation = await api.post("/api/invites/validate", {
          code: inviteCode.trim(),
        });

        if (!validation.valid) {
          throw new Error("초대 코드가 유효하지 않거나 만료됐다.");
        }

        const credential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

        const user = credential.user;

        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          nickname: nickname.trim(),
          role: "member",
          status: "pending",
          inviteConsumed: false,
          createdAt: new Date().toISOString(),
        });

        try {
          await api.post("/api/invites/consume", {
            code: inviteCode.trim(),
          });
        } catch (consumeError) {
          await signOut(auth);
          throw new Error(
            "계정은 생성됐지만 초대 코드 처리가 실패했다. 관리자에게 문의해라."
          );
        }

        await sendEmailVerification(user);

        setError(
          "가입 신청 완료! 이메일 인증을 마치고 관리자의 승인을 기다려라."
        );
        return;
      }

      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(err.message || "요청을 처리하지 못했다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="brand-mark">
          <Crown size={30} />
        </div>

        <p className="eyebrow">INVITATION ONLY</p>
        <h1>BANGKKU TOONGKU</h1>
        <p className="auth-subtitle">
          특별한 작품을 위한 프리미엄 웹툰 공간
        </p>

        <div className="auth-tabs">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            로그인
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => {
              setMode("register");
              setError("");
            }}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <>
              <label>닉네임</label>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={24}
                placeholder="사용할 닉네임"
                required
              />

              <label>초대 코드</label>
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="초대받은 코드를 입력"
                required
              />
            </>
          )}

          <label>이메일</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label>비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            minLength={6}
            required
          />

          {error && <p className="auth-message">{error}</p>}

          <button className="auth-submit" disabled={busy}>
            {busy
              ? "처리 중..."
              : mode === "login"
                ? "로그인"
                : "가입 신청"}
          </button>
        </form>

        <p className="auth-footer">
          PRIVATE · ORIGINAL · PREMIUM
        </p>
      </div>
    </main>
  );
}

function ApprovalPending({ user, profile }) {
  async function handleLogout() {
    await signOut(auth);
  }

  return (
    <main className="pending-page">
      <div className="pending-card">
        <ShieldCheck size={42} />
        <h1>승인을 기다리는 중</h1>
        <p>
          {profile?.nickname || user.email} 님, 가입 신청이 접수됐다.
        </p>
        <p>이메일 인증을 완료하고 관리자 승인을 기다려라.</p>
        <button className="auth-submit" onClick={handleLogout}>
          로그아웃
        </button>
      </div>
    </main>
  );
}

function Shell({ user, profile, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  async function logout() {
    await signOut(auth);
    navigate("/");
  }

  const isAdmin = profile?.role === "admin";

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="site-brand" to="/">
          <Crown size={25} />
          <span>BANGKKU <b>TOONGKU</b></span>
        </Link>

        <button
          className="mobile-menu-button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="메뉴 열기"
        >
          {menuOpen ? <X /> : <Menu />}
        </button>

        <nav className={menuOpen ? "site-nav open" : "site-nav"}>
          <Link to="/" onClick={() => setMenuOpen(false)}>
            <Home size={17} /> 홈
          </Link>

          <Link to="/browse" onClick={() => setMenuOpen(false)}>
            <BookOpen size={17} /> 작품 둘러보기
          </Link>

          <Link to="/wallet" onClick={() => setMenuOpen(false)}>
            <Coins size={17} /> 내 지갑
          </Link>

          {isAdmin && (
            <Link to="/admin" onClick={() => setMenuOpen(false)}>
              <ShieldCheck size={17} /> 관리자
            </Link>
          )}

          <button onClick={logout}>
            <LogOut size={17} /> 로그아웃
          </button>
        </nav>
      </header>

      <div className="welcome-strip">
        <span>WELCOME BACK</span>
        <strong>{profile?.nickname || user.email}</strong>
        <span className="member-tag">
          {isAdmin ? "ADMIN" : "MEMBER"}
        </span>
      </div>

      {children}

      <footer className="site-footer">
        BANGKKU TOONGKU · ORIGINAL WEBTOON PLATFORM
      </footer>
    </div>
  );
}

function HomePage() {
  return (
    <main className="content-page">
      <section className="hero-panel">
        <p className="eyebrow">YOUR PRIVATE WEBTOON CLUB</p>
        <h1>
          이야기를 읽는 새로운 방식,
          <br />
          <span>방꾸툰</span>
        </h1>
        <p>
          이곳에서 새로운 작품을 발견하고 나만의 독서 목록을 만들어라.
        </p>
        <Link className="gold-button" to="/browse">
          작품 둘러보기
        </Link>
      </section>

      <section className="section-heading">
        <div>
          <p className="eyebrow">DISCOVER</p>
          <h2>새로운 이야기가 기다린다</h2>
        </div>
      </section>

      <div className="empty-library">
        <BookOpen size={36} />
        <h3>작품을 준비 중이다</h3>
        <p>웹툰 등록 기능을 연결하면 여기에 작품이 표시된다.</p>
      </div>
    </main>
  );
}

function BrowsePage() {
  return (
    <main className="content-page">
      <p className="eyebrow">LIBRARY</p>
      <h1>작품 둘러보기</h1>
      <div className="empty-library">
        <BookOpen size={36} />
        <h3>아직 등록된 작품이 없다</h3>
        <p>관리자 작품 등록 기능은 다음 단계에서 연결하면 된다.</p>
      </div>
    </main>
  );
}

function WalletPage() {
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    api.get("/api/wallet")
      .then((result) => {
        if (active) setWallet(result.wallet || result);
      })
      .catch((err) => {
        if (active) setError(err.message || "지갑을 불러오지 못했다.");
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="content-page">
      <p className="eyebrow">MY ACCOUNT</p>
      <h1>내 지갑</h1>

      <div className="wallet-card">
        <Coins size={32} />
        <span>보유 코인</span>
        <strong>
          {wallet
            ? Number(wallet.balance ?? wallet.coins ?? 0).toLocaleString(
                "ko-KR"
              )
            : error
              ? "불러오기 실패"
              : "불러오는 중..."}
        </strong>
        {error && <p>{error}</p>}
        <p>코인은 테스트용 가상 재화다.</p>
      </div>
    </main>
  );
}

function ProtectedApp({ user, profile }) {
  if (profile?.status !== "approved") {
    return <ApprovalPending user={user} profile={profile} />;
  }

  return (
    <Shell user={user} profile={profile}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/wallet" element={<WalletPage />} />

        <Route
          path="/admin"
          element={
            profile.role === "admin" ? (
              <Admin />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

function AppContent() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setProfile(null);
      setProfileError("");

      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const profileSnapshot = await getDoc(
          doc(db, "users", currentUser.uid)
        );

        if (profileSnapshot.exists()) {
          setProfile(profileSnapshot.data());
        } else {
          setProfileError("회원 프로필이 없다. 관리자에게 문의해라.");
        }
      } catch (error) {
        setProfileError(error.message || "회원 정보를 불러오지 못했다.");
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  if (!firebaseConfigured) {
    return (
      <main className="pending-page">
        <div className="pending-card">
          <Crown size={40} />
          <h1>BANGKKU TOONGKU</h1>
          <p>Firebase 설정을 완료하면 로그인 화면이 열린다.</p>
          <p>환경변수 VITE_FIREBASE_* 값을 확인해라.</p>
        </div>
      </main>
    );
  }

  if (loading) {
    return <div className="app-loading">BANGKKU TOONGKU 로딩 중...</div>;
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (profileError) {
    return (
      <main className="pending-page">
        <div className="pending-card">
          <h1>회원 정보를 불러올 수 없다</h1>
          <p>{profileError}</p>
          <button onClick={() => signOut(auth)}>로그아웃</button>
        </div>
      </main>
    );
  }

  if (!profile) {
    return <div className="app-loading">회원 정보 확인 중...</div>;
  }

  return <ProtectedApp user={user} profile={profile} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
