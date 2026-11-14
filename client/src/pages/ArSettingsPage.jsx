import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './admin.css';
import { API_BASE } from '../apiBase.js';

// AR 탁본 공통 설정: 보물 상자 완주 상품 + 1~5등 포인트 상품
const PRIZE_ICONS = [
  { value: 'cert', label: '증명서' },
  { value: 'point', label: '적립금' },
  { value: 'draw', label: '추첨·기타' },
];
const PRIZE_GO = [
  { value: '', label: '버튼 없음' },
  { value: 'cert', label: '증명서 보기' },
  { value: 'shop', label: '포인트 상품 고르기' },
];
const SHOP_ICONS = [
  { value: 'crown', label: '왕관(1등)' },
  { value: 'gift', label: '선물' },
  { value: 'voucher', label: '상품권' },
  { value: 'coffee', label: '커피' },
  { value: 'ticket', label: '쿠폰' },
];

function storedToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

const won = (n) => `${Number(n || 0).toLocaleString('ko-KR')}P`;

function ArSettingsPage() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);
  const [prizes, setPrizes] = useState([]);
  const [shop, setShop] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const token = storedToken();
    if (!token) {
      navigate('/', { replace: true });
      return undefined;
    }
    let ignore = false;
    fetch(`${API_BASE}/api/me`, { headers: { authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (ignore) return;
        const user = response.ok ? await response.json() : null;
        if (user?.user_type !== 'admin') {
          navigate('/', { replace: true });
          return;
        }
        setAllowed(true);
        const res = await fetch(`${API_BASE}/api/ar/settings`, { cache: 'no-store' });
        const body = res.ok ? await res.json() : null;
        if (ignore) return;
        if (!body) {
          setError('AR 설정을 불러오지 못했습니다. 서버에 /api/ar 경로가 배포됐는지 확인해 주세요.');
          return;
        }
        setPrizes(body.prizes || []);
        setShop(body.pointShop || []);
      })
      .catch(() => {
        if (!ignore) navigate('/', { replace: true });
      });
    return () => {
      ignore = true;
    };
  }, [navigate]);

  function editPrize(index, name, value) {
    setPrizes((list) => list.map((item, i) => (i === index ? { ...item, [name]: value } : item)));
  }
  function editShop(index, name, value) {
    setShop((list) => list.map((item, i) => (i === index ? { ...item, [name]: value } : item)));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setPending(true);
    try {
      const response = await fetch(`${API_BASE}/api/ar/settings`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${storedToken()}` },
        body: JSON.stringify({
          prizes: prizes.map((p) => ({ ...p, points: Number(p.points) || 0 })),
          pointShop: shop.map((g, i) => ({ ...g, rank: Number(g.rank) || i + 1, points: Number(g.points) || 0 })),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.message || '저장하지 못했습니다.');
        return;
      }
      setPrizes(body.prizes || []);
      setShop(body.pointShop || []);
      setNotice('저장했습니다. 모든 코스의 AR 화면에 1분 안에 반영됩니다.');
    } catch {
      setError('서버에 연결하지 못했습니다.');
    } finally {
      setPending(false);
    }
  }

  if (!allowed) return null;

  return (
    <div className="admin-app">
      <header className="admin-top">
        <div className="admin-brand">
          <Link to="/">보물 여행</Link>
          <span>ADMIN</span>
        </div>
        <Link to="/admin">대시보드로 돌아가기</Link>
      </header>

      <main className="admin-main admin-form-page">
        <h1>AR 상품 설정</h1>
        <p className="admin-lead">
          모든 코스가 함께 쓰는 보물 상자 완주 상품과 포인트 상품입니다. 완주 적립금은 &lsquo;적립금&rsquo; 상품의 포인트만큼 코스마다 한 번 지급됩니다.
        </p>

        <form className="admin-form" onSubmit={onSubmit}>
          <fieldset className="legend-ar-course">
            <legend>보물 상자를 열면 나오는 완주 상품</legend>
            {prizes.map((p, i) => (
              <div className="ar-row" key={i}>
                <select value={p.icon} onChange={(e) => editPrize(i, 'icon', e.target.value)} aria-label="종류">
                  {PRIZE_ICONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input value={p.title} onChange={(e) => editPrize(i, 'title', e.target.value)} placeholder="상품 이름" aria-label="상품 이름" />
                <input
                  inputMode="numeric"
                  value={p.points ?? 0}
                  onChange={(e) => editPrize(i, 'points', e.target.value)}
                  placeholder="지급 포인트"
                  aria-label="지급 포인트"
                  disabled={p.icon !== 'point'}
                />
                <select value={p.go || ''} onChange={(e) => editPrize(i, 'go', e.target.value)} aria-label="버튼">
                  {PRIZE_GO.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input className="wide" value={p.desc} onChange={(e) => editPrize(i, 'desc', e.target.value)} placeholder="설명" aria-label="설명" />
                <input value={p.action || ''} onChange={(e) => editPrize(i, 'action', e.target.value)} placeholder="버튼 글자" aria-label="버튼 글자" />
                <button type="button" onClick={() => setPrizes((list) => list.filter((_, k) => k !== i))}>삭제</button>
              </div>
            ))}
            <button className="legend-add" type="button" onClick={() => setPrizes((list) => [...list, { icon: 'draw', title: '', desc: '', points: 0, action: '', go: '' }])}>
              완주 상품 추가
            </button>
          </fieldset>

          <fieldset className="legend-ar-course">
            <legend>포인트로 교환하는 상품 (1~5등)</legend>
            {shop.map((g, i) => (
              <div className="ar-row shop" key={i}>
                <input inputMode="numeric" value={g.rank ?? i + 1} onChange={(e) => editShop(i, 'rank', e.target.value)} aria-label="등수" />
                <select value={g.icon} onChange={(e) => editShop(i, 'icon', e.target.value)} aria-label="아이콘">
                  {SHOP_ICONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input value={g.name} onChange={(e) => editShop(i, 'name', e.target.value)} placeholder="상품 이름" aria-label="상품 이름" />
                <input inputMode="numeric" value={g.points} onChange={(e) => editShop(i, 'points', e.target.value)} placeholder="필요 포인트" aria-label="필요 포인트" />
                <input className="wide" value={g.desc} onChange={(e) => editShop(i, 'desc', e.target.value)} placeholder="설명" aria-label="설명" />
                <input value={g.id} onChange={(e) => editShop(i, 'id', e.target.value)} placeholder="아이디(영문)" aria-label="아이디" />
                <span className="ar-tail">
                  <span className="ar-points">{won(g.points)}</span>
                  <button type="button" onClick={() => setShop((list) => list.filter((_, k) => k !== i))}>삭제</button>
                </span>
              </div>
            ))}
            <button
              className="legend-add"
              type="button"
              onClick={() => setShop((list) => [...list, { id: `rank${list.length + 1}`, rank: list.length + 1, icon: 'gift', name: '', points: 10000, desc: '' }])}
            >
              포인트 상품 추가
            </button>
            <p className="legend-hint">아이디는 교환 내역과 연결되니, 이미 교환이 있는 상품의 아이디는 바꾸지 마세요.</p>
          </fieldset>

          {error ? <p className="admin-form-error" role="alert">{error}</p> : null}
          {notice ? <p className="legend-notice">{notice}</p> : null}
          <button className="admin-submit" type="submit" disabled={pending}>{pending ? '저장 중' : '저장하기'}</button>
        </form>
      </main>
    </div>
  );
}

export default ArSettingsPage;
