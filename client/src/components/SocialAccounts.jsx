import { API_BASE } from '../apiBase.js';

function NaverMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#03C75A" d="M4 4h5.1l5.8 8.6V4H20v16h-5.1l-5.8-8.6V20H4V4z" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35.1 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.2-4.1 5.5l.1.1 6.3 5.3C39.2 35.7 44 30.4 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

function startSocial(provider) {
  const remember = document.querySelector('input[name="remember"]')?.checked === true;
  sessionStorage.setItem('social_remember', remember ? '1' : '0');
  window.location.assign(`${API_BASE}/api/login/${provider}`);
}

function SocialAccounts({ mode }) {
  const joining = mode === 'signup';
  const label = joining ? '외부 계정으로 가입하기' : '외부 계정으로 로그인하기';

  return (
    <div className="social-accounts">
      <p className="social-accounts-label">{label}</p>
      <div className="social-accounts-buttons">
        <button type="button" className="social-btn" aria-label={joining ? '네이버로 가입' : '네이버로 로그인'} onClick={() => startSocial('naver')}>
          <NaverMark />
        </button>
        <button type="button" className="social-btn" aria-label={joining ? 'Google로 가입' : 'Google로 로그인'} onClick={() => startSocial('google')}>
          <GoogleMark />
        </button>
      </div>
    </div>
  );
}

export default SocialAccounts;
