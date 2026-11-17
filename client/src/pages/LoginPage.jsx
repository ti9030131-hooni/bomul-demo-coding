import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import SocialAccounts from '../components/SocialAccounts.jsx';
import { API_BASE } from '../apiBase.js';

function storedToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

function saveToken(token, remember) {
  const storage = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  storage.setItem('token', token);
  other.removeItem('token');
}

function postLoginPath(location) {
  const params = new URLSearchParams(location.search);
  const next = params.get('next') || (typeof location.state?.next === 'string' ? location.state.next : '');
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/bomul.html';
}

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    user_id: typeof location.state?.user_id === 'string' ? location.state.user_id : '',
    password: '',
    remember: true,
  });
  const [error, setError] = useState(() => location.state?.error ?? '');
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(() => Boolean(storedToken()));

  useEffect(() => {
    const token = storedToken();
    if (!token) return;

    let ignore = false;
    fetch(`${API_BASE}/api/me`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => {
        if (ignore) return;
        if (response.ok) {
          window.location.replace(postLoginPath(location));
          return;
        }
        // 만료·잘못된 토큰만 지운다. 서버 일시 오류(502/503)로 로그아웃되면 안 됨.
        if (response.status === 401) {
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
        }
        setChecking(false);
      })
      .catch(() => {
        if (!ignore) setChecking(false);
      });

    return () => {
      ignore = true;
    };
  }, [location, navigate]);

  function update(event) {
    const { name, type, checked, value } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      // 모바일 자동완성 등으로 React state가 비어 있어도 FormData로 실제 입력값을 읽는다.
      const fd = new FormData(event.currentTarget);
      const user_id = String(fd.get('user_id') || form.user_id || '').trim();
      const password = String(fd.get('password') || form.password || '');
      const remember = fd.get('remember') != null;

      const response = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_id, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || '로그인에 실패했습니다.');
        return;
      }
      saveToken(data.token, remember);
      window.location.replace(postLoginPath(location));
    } catch {
      setError('서버에 연결하지 못했습니다. 서버가 실행 중인지 확인해 주세요.');
    } finally {
      setPending(false);
    }
  }

  if (checking) return <section className="login-page" />;

  return (
    <section className="login-page">
      <div className="login-stack">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>로그인</h1>
        <p className="login-switch">
          아직 회원이 아니신가요? <Link to="/signup">회원가입</Link>
        </p>

        <div className="login-methods">
          <button type="button" className="method method-id" aria-pressed="true">
            <span className="method-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28">
                <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M6.5 18.5c1.2-2.4 3.1-3.6 5.5-3.6s4.3 1.2 5.5 3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            아이디
          </button>
        </div>

        <label className="sr-only" htmlFor="user_id">아이디</label>
        <input
          id="user_id"
          name="user_id"
          value={form.user_id}
          onChange={update}
          autoComplete="username"
          placeholder="아이디"
          required
        />

        <label className="sr-only" htmlFor="password">비밀번호</label>
        <input
          id="password"
          name="password"
          type="password"
          value={form.password}
          onChange={update}
          autoComplete="current-password"
          placeholder="비밀번호"
          required
        />

        {error ? <p className="form-error" role="alert">{error}</p> : null}

        <button className="submit-button login-submit" type="submit" disabled={pending}>
          {pending ? '로그인 중' : '로그인'}
        </button>

        <div className="login-footer">
          <label>
            <input type="checkbox" name="remember" value="1" checked={form.remember} onChange={update} />
            자동로그인
          </label>
          <Link className="find-button" to="/login/find">
            ID/비밀번호 찾기
          </Link>
        </div>
      </form>
      <SocialAccounts mode="login" />
      </div>
    </section>
  );
}

export default LoginPage;
