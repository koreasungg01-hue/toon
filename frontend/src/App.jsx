
import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import {
  onAuthStateChanged, signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile, sendEmailVerification
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, collection, getDocs, query, where,
  serverTimestamp
} from 'firebase/firestore';
import {
  Crown, Search, Coins, BookOpen, ShieldCheck,
  LogOut, ArrowRight, Sparkles, LockKeyhole, LoaderCircle
} from 'lucide-react';
import { auth, db, firebaseConfigured } from './firebase/firebase';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

async function request(path, options = {}) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '요청에 실패했다.');
  return data;
}

function Brand() {
  return <Link className="brand" to="/">
    <Crown size={24}/><span>BANGKKU<br/>TOONGKU</span>
  </Link>;
}

function AuthScreen({ mode, onComplete }) {
  const [signup, setSignup] = useState(mode === 'signup');
  const [fields, setFields] = useState({
    name: '', email: '', password: '', invite: ''
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function change(e) {
    setFields({ ...fields, [e.target.name]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      if (signup) {

        const validation = await request('/api/invites/validate', {
            method: 'POST',
            body: JSON.stringify({ code: fields.invite })
        });

        if (!validation.valid) {
          throw new Error('초대 코드가 유효하지 않거나 만료됐다.');
        }


        const credential = await createUserWithEmailAndPassword(
          auth, fields.email, fields.password
        );

        await updateProfile(credential.user, {
          displayName: fields.name
        });

        await setDoc(doc(db, 'users', credential.user.uid), {
          displayName: fields.name,
          email: fields.email,
          role: 'member',
          status: 'pending',
          createdAt: serverTimestamp()
        });

        await sendEmailVerification(credential.user);

        await request('/api/invites/consume', {
          method: 'POST',
          body: JSON.stringify({ code: fields.invite })
        });
      } else {
        await signInWithEmailAndPassword(
          auth, fields.email, fields.password
        );
      }

      onComplete();
    } catch (err) {
      setError(err.message || '요청을 처리하지 못했다.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-layout">
    <section className="auth-hero">
      <Brand/>
      <span className="eyebrow">A PRIVATE WEBTOON CLUB</span>
      <h1>아무나 들어올 수 없는<br/><em>특별한 이야기의 공간.</em></h1>
      <p>초대받은 회원을 위한 오리지널 웹툰 클럽.</p>
      <div className="hero-stamps">
        <span>✦ ORIGINAL STORIES</span>
        <span>✦ MEMBERS ONLY</span>
      </div>
    </section>

    <section className="auth-panel">
      <div className="auth-card">
        <div className="auth-icon"><Crown size={26}/></div>
        <span className="eyebrow">PRIVATE MEMBERSHIP</span>
        <h2>{signup ? '회원 가입' : '다시 만나 반갑다'}</h2>
        <p className="muted">
          {signup ? '초대 코드를 가진 회원만 가입할 수 있다.' : '회원 전용 공간에 입장해라.'}
        </p>

        <form onSubmit={submit}>
          {signup && <>
            <label>닉네임<input name="name" required maxLength={30}
              value={fields.name} onChange={change} placeholder="사용할 닉네임"/></label>
            <label>초대 코드<input name="invite" required
              value={fields.invite} onChange={change} placeholder="받은 초대 코드"/></label>
          </>}
          <label>이메일<input type="email" name="email" required
            autoComplete="email" value={fields.email} onChange={change}
            placeholder="you@example.com"/></label>
          <label>비밀번호<input type="password" name="password" required
            minLength={8} autoComplete={signup ? 'new-password' : 'current-password'}
            value={fields.password} onChange={change} placeholder="8자 이상"/></label>
          {error && <div className="error">{error}</div>}
          <button className="gold-button" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17}/> : null}
            {busy ? '처리 중...' : signup ? '가입 신청하기' : '로그인'}
            {!busy && <ArrowRight size={17}/>}
          </button>
        </form>

        <button className="text-button" onClick={() => {
          setSignup(!signup);
          setError('');
        }}>
          {signup ? '이미 계정이 있나? 로그인' : '초대 코드가 있나? 회원 가입'}
        </button>
        <div className="secure-note"><LockKeyhole size={13}/> 안전한 회원 인증 시스템</div>
      </div>
    </section>
  </main>;
}

function Shell({ user, profile, children }) {
  async function logout() { await signOut(auth); }

  return <div className="shell">
    <aside className="sidebar">
      <Brand/>
      <div className="side-label">MEMBERS CLUB</div>
      <nav>
        <Link to="/"><Sparkles size={17}/> 홈</Link>
        <Link to="/browse"><Search size={17}/> 작품 탐색</Link>
        <Link to="/wallet"><Coins size={17}/> 내 코인</Link>
        <Link to="/history"><BookOpen size={17}/> 구매 내역</Link>
        {profile?.role === 'admin' && <Link to="/admin"><ShieldCheck size={17}/> 관리자</Link>}
      </nav>
      <div className="sidebar-bottom">
        <span className="vip-label"><Crown size={14}/> PRIVATE CLUB</span>
        <div className="user-chip">
          <div className="avatar">{(profile?.displayName || user.displayName || '회').slice(0,1)}</div>
          <div className="user-info"><b>{profile?.displayName || '회원'}</b><small>{profile?.status === 'approved' ? '승인 완료' : '승인 대기'}</small></div>
          <button className="icon-button" onClick={logout} title="로그아웃"><LogOut size={16}/></button>
        </div>
      </div>
    </aside>
    <main className="main-content">
      <header className="topbar">
        <div className="mobile-brand"><Crown size={18}/> BANGKKU TOONGKU</div>
        <span className="membership"><span className="online-dot"/> PRIVATE MEMBERSHIP <b>VIP</b></span>
      </header>
      {children}
    </main>
  </div>;
}

function ApprovalPending({ profile }) {
  return <div className="center-page">
    <div className="auth-icon"><LockKeyhole size={25}/></div>
    <span className="eyebrow">MEMBERSHIP REVIEW</span>
    <h1>승인을 기다리고 있다.</h1>
    <p className="muted">가입 신청이 접수됐다. 관리자가 승인하면 작품을 감상할 수 있다.</p>
    <p className="muted">회원: {profile?.displayName || '회원'}</p>
    <button className="outline-button" onClick={() => signOut(auth)}>로그아웃</button>
  </div>;
}

function Home() {
  const [toons, setToons] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const q = query(
          collection(db, 'webtoons'),
          where('status', '==', 'published')
        );
        const snap = await getDocs(q);
        setToons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) { setError(err.message); }
    }
    load();
  }, []);

  return <div className="page">
    <section className="welcome-banner">
      <div className="banner-content">
        <span className="eyebrow">BANGKKU ORIGINALS · EXCLUSIVE</span>
        <h1>오늘, 새로운 세계에<br/><em>입장할 준비 됐나?</em></h1>
        <p>여기서만 만날 수 있는 오리지널 이야기를 만나봐라.</p>
        <Link className="gold-button link-button" to="/browse">작품 둘러보기 <ArrowRight size={17}/></Link>
      </div>
        <div className="banner-emblem"><Crown size={100}/><span>PRIVATE<br/>COLLECTION</span></div>
    </section>

    <div className="section-heading">
      <div><span className="eyebrow">HANDPICKED FOR YOU</span><h2>오늘의 추천 작품</h2></div>
      <Link to="/browse" className="subtle-link">전체 작품 <ArrowRight size={15}/></Link>
    </div>

    {error && <div className="error">{error}</div>}
    {toons.length ? <div className="toon-grid">
      {toons.map(toon => <Link to={`/webtoon/${toon.id}`} className="toon-card" key={toon.id}>
        <div className="toon-cover">
          {toon.coverUrl ? <img src={toon.coverUrl} alt=""/> : <div className="cover-placeholder"><Crown size={40}/><span>BANGKKU ORIGINAL</span></div>}
          <span className="genre-tag">{toon.genre || '오리지널'}</span>
        </div>
        <div className="toon-card-info"><h3>{toon.title}</h3><p>{toon.description || '새로운 이야기가 시작된다.'}</p></div>
      </Link>)}
    </div> : <div className="empty-state"><Crown size={28}/><h3>첫 번째 오리지널을 준비 중이다.</h3><p>관리자가 작품을 등록하면 이곳에 표시된다.</p></div>}
  </div>;
}

function Browse() {
  return <div className="page"><span className="eyebrow">DISCOVER ORIGINALS</span><h1>작품 탐색</h1><p className="muted">엄선한 오리지널 작품을 만나봐라.</p><Home/></div>;
}

function Placeholder({ title, text }) {
  return <div className="page"><span className="eyebrow">MEMBERS AREA</span><h1>{title}</h1><div className="empty-state"><Crown size={28}/><h3>{text}</h3><p>다음 구현 단계에서 연결할 기능이다.</p></div></div>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, async current => {
    setUser(current);
    setProfile(null);
    if (current) {
      try {
        const snap = await getDoc(doc(db, 'users', current.uid));
        if (snap.exists()) setProfile(snap.data());
      } catch (error) { console.error(error); }
    }
    setLoading(false);
  }), []);

  if (loading) return <div className="loading-screen"><Crown size={30}/><p>프리미엄 공간에 연결 중...</p></div>;

  if (!firebaseConfigured) return <div className="setup-warning">
    <Crown size={32}/><h1>Firebase 설정이 필요하다.</h1>
    <p>Vercel 환경 변수에 Firebase 웹 설정값을 입력하고 다시 배포해라.</p>
  </div>;

  if (!user) return <Routes>
    <Route path="*" element={<AuthScreen mode="login" onComplete={() => {}}/>}/>
  </Routes>;

  if (!profile || profile.status !== 'approved') {
    return <ApprovalPending profile={profile}/>;
  }

  return <Shell user={user} profile={profile}>
    <Routes>
      <Route path="/" element={<Home/>}/>
      <Route path="/browse" element={<Browse/>}/>
      <Route path="/wallet" element={<Placeholder title="내 코인" text="코인 지갑을 준비 중이다."/>}/>
      <Route path="/history" element={<Placeholder title="구매 내역" text="구매 내역을 준비 중이다."/>}/>
      <Route path="/admin" element={profile.role === 'admin' ? <Placeholder title="관리자 대시보드" text="관리자 도구를 준비 중이다."/> : <Navigate to="/"/>}/>
      <Route path="/webtoon/:id" element={<Placeholder title="작품 상세" text="작품 상세 페이지를 준비 중이다."/>}/>
      <Route path="/viewer/:webtoonId/:episodeId" element={<Placeholder title="웹툰 뷰어" text="세로 스크롤 뷰어를 준비 중이다."/>}/>
      <Route path="*" element={<Navigate to="/"/>}/>
    </Routes>
  </Shell>;
}
