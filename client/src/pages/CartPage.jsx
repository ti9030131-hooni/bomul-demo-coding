import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../apiBase.js';

function storedToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

function CartItem({ item, token, onUpdated, onError }) {
  const course = item.course && typeof item.course === 'object' ? item.course : null;
  const courseId = course?._id || item.course;
  const [quantity, setQuantity] = useState(item.quantity);
  const [busy, setBusy] = useState(false);

  async function changeQuantity() {
    const next = Number(quantity);
    if (!Number.isInteger(next) || next < 1) {
      onError('수량은 1 이상이어야 합니다.');
      return;
    }

    setBusy(true);
    onError('');
    try {
      const response = await fetch(`${API_BASE}/api/carts/${courseId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantity: next }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        onError(body.message || '수량을 바꾸지 못했습니다.');
        return;
      }
      onUpdated(body);
      window.dispatchEvent(new Event('cart-updated'));
    } catch {
      onError('서버에 연결하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function removeItem() {
    setBusy(true);
    onError('');
    try {
      const response = await fetch(`${API_BASE}/api/carts/${courseId}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        onError(body.message || '코스를 빼지 못했습니다.');
        return;
      }
      onUpdated(body);
      window.dispatchEvent(new Event('cart-updated'));
    } catch {
      onError('서버에 연결하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li>
      {course?.image ? <img src={course.image} alt="" /> : <span className="cart-thumb" />}
      <div className="cart-info">
        <strong>{course?.name || '코스'}</strong>
        <p>{course ? `${Number(course.price).toLocaleString('ko-KR')}원` : ''} · {item.quantity}개</p>
      </div>
      <div className="cart-actions">
        <input
          className="cart-qty"
          type="number"
          min="1"
          aria-label={`${course?.name || '코스'} 수량`}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
        <button className="btn btn-ghost btn-sm" type="button" onClick={changeQuantity} disabled={busy}>
          수정
        </button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={removeItem} disabled={busy}>
          삭제
        </button>
      </div>
    </li>
  );
}

function moreCoursesHref(membership) {
  if (membership?.active) return '/bomul.html#courses';
  const paid = Array.isArray(membership?.courses)
    ? membership.courses.filter((id) => typeof id === 'string' && id.trim())
    : [];
  if (paid.length === 1) return `/bomul.html#course-${encodeURIComponent(paid[0])}`;
  if (paid.length > 1) return `/bomul.html#course-${encodeURIComponent(paid[0])}`;
  return '/bomul.html#courses';
}

function CartPage() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [membership, setMembership] = useState(null);
  const token = storedToken();

  useEffect(() => {
    const saved = storedToken();
    if (!saved) {
      setStatus('guest');
      return undefined;
    }

    let ignore = false;
    const headers = { authorization: `Bearer ${saved}` };
    Promise.all([
      fetch(`${API_BASE}/api/carts`, { headers }),
      fetch(`${API_BASE}/api/me`, { headers }),
    ])
      .then(async ([cartResponse, meResponse]) => {
        if (ignore) return;
        if (meResponse.ok) {
          const me = await meResponse.json().catch(() => ({}));
          setMembership(me.membership || null);
        }
        if (!cartResponse.ok) {
          setStatus('error');
          return;
        }
        const cart = await cartResponse.json();
        setItems(Array.isArray(cart.items) ? cart.items : []);
        setStatus('ready');
      })
      .catch(() => {
        if (!ignore) setStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, []);

  const count = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const total = items.reduce((sum, item) => {
    const course = item.course && typeof item.course === 'object' ? item.course : null;
    return sum + (Number(course?.price) || 0) * (Number(item.quantity) || 0);
  }, 0);

  return (
    <section className="cart-page">
      <div className="wrap">
        <div className="sec-head">
          <div className="sec-kicker">장바구니</div>
          <h2>담은 유료 코스</h2>
          <p>{status === 'ready' ? `${count}개` : '로그인한 뒤 담은 코스를 보여 줍니다.'}</p>
        </div>
        {status === 'guest' ? (
          <p className="course-status">
            장바구니는 로그인 후 볼 수 있습니다. <Link to="/login">로그인</Link>
          </p>
        ) : null}
        {status === 'error' ? <p className="course-status">장바구니를 불러오지 못했습니다.</p> : null}
        {status === 'loading' ? <p className="course-status">장바구니를 불러오는 중</p> : null}
        {status === 'ready' && items.length === 0 ? <p className="course-status">장바구니가 비어 있습니다.</p> : null}
        {message ? <p className="course-status">{message}</p> : null}
        {status === 'ready' && items.length > 0 ? (
          <ul className="cart-list">
            {items.map((item) => {
              const course = item.course && typeof item.course === 'object' ? item.course : null;
              const courseId = course?._id || item.course;
              return (
                <CartItem
                  key={courseId}
                  item={item}
                  token={token}
                  onUpdated={(cart) => setItems(Array.isArray(cart.items) ? cart.items : [])}
                  onError={setMessage}
                />
              );
            })}
          </ul>
        ) : null}
        {status === 'ready' ? (
          <div className="cart-pay">
            {items.length > 0 ? <strong>합계 {total.toLocaleString('ko-KR')}원</strong> : null}
            <a className="btn btn-ghost" href={moreCoursesHref(membership)}>
              코스 더 보기
            </a>
            {items.length > 0 ? (
              <Link className="btn btn-primary" to="/order?pay=1">
                주문하기
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default CartPage;
