import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function NaverCallbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [result] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    return {
      token: params.get('token'),
      error: params.get('error'),
      remember: sessionStorage.getItem('social_remember') === '1' || sessionStorage.getItem('naver_remember') === '1',
    };
  });

  useEffect(() => {
    sessionStorage.removeItem('social_remember');
    sessionStorage.removeItem('naver_remember');
    const isGoogle = location.pathname.includes('/google');
    const fallback = isGoogle ? '구글 로그인에 실패했습니다.' : '네이버 로그인에 실패했습니다.';
    if (result.token) {
      const storage = result.remember ? localStorage : sessionStorage;
      const other = result.remember ? sessionStorage : localStorage;
      storage.setItem('token', result.token);
      other.removeItem('token');
      navigate('/', { replace: true });
      return;
    }
    navigate('/login', { replace: true, state: { error: result.error || fallback } });
  }, [navigate, result, location.pathname]);

  return (
    <section className="login-page">
      <p className="login-notice">로그인 중입니다.</p>
    </section>
  );
}

export default NaverCallbackPage;
