import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../apiBase.js';
const PAYMENT_METHODS = ['신용카드', '계좌이체', '네이버페이'];
const PORTONE_PAY_METHOD = { 신용카드: 'card', 계좌이체: 'trans', 네이버페이: 'card' };
const PENDING_PAY_KEY = 'bomul-portone-order';
const finishingPayments = new Set();

function storedToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

function todayValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function money(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`;
}

function courseOf(item) {
  return item.course && typeof item.course === 'object' ? item.course : null;
}

function merchantUid() {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `bomul-${id}`;
}

function orderName(items) {
  const names = items.map((item) => courseOf(item)?.name || '코스');
  if (names.length > 1) return `${names[0]} 외 ${names.length - 1}건`;
  return names[0] || '보물 여행';
}

function paymentAccepted(response) {
  if (!response || response.success === false || response.error_code != null) return false;
  if (response.status === 'failed' || response.status === 'ready') return false;
  return response.success === true || response.status === 'paid';
}

function rememberPendingPay(uid, payload) {
  sessionStorage.setItem(PENDING_PAY_KEY, JSON.stringify({ merchantUid: uid, payload }));
}

function readPendingPay() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PENDING_PAY_KEY) || 'null');
    if (!saved || typeof saved.merchantUid !== 'string' || !saved.payload) return null;
    return saved;
  } catch {
    return null;
  }
}

async function postOrder(token, payload) {
  const response = await fetch(`${API_BASE}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || (response.status === 401 ? '로그인이 필요합니다.' : '주문을 저장하지 못했습니다.'));
    error.status = response.status;
    throw error;
  }
  try {
    await fetch(`${API_BASE}/api/carts`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
  } catch {
    // 결제는 끝났으므로 장바구니 삭제 실패만으로 주문을 되돌리지 않습니다.
  }
  return body;
}

function orderPayloadWithPayment(payload, impUid, merchantUid) {
  return {
    ...payload,
    imp_uid: impUid,
    merchant_uid: merchantUid,
  };
}

function OrderPage() {
  const token = storedToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const autoPay = searchParams.get('pay') === '1';
  const autoPayStarted = useRef(false);
  const [status, setStatus] = useState(token ? 'loading' : 'guest');
  const [items, setItems] = useState([]);
  const [buyer, setBuyer] = useState({ name: '', phone: '', email: '' });
  const [payment, setPayment] = useState('신용카드');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [order, setOrder] = useState(null);
  const [impUid, setImpUid] = useState('');
  const [paymentsEnabled, setPaymentsEnabled] = useState(null);
  const [paymentsMessage, setPaymentsMessage] = useState('');
  const [portone, setPortone] = useState(null);

  useEffect(() => {
    let ignore = false;
    fetch(`${API_BASE}/api/payments/status`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (ignore) return;
        const enabled = body.enabled === true;
        const cfg = body.portone && body.portone.impCode && body.portone.channelKey ? body.portone : null;
        setPaymentsEnabled(enabled);
        setPortone(cfg);
        setPaymentsMessage(
          typeof body.message === 'string' && body.message
            ? body.message
            : '결제 준비 중입니다. 실연동 승인 후 이용할 수 있습니다.',
        );
        if (enabled && cfg && window.IMP?.init) window.IMP.init(cfg.impCode);
      })
      .catch(() => {
        if (!ignore) {
          setPaymentsEnabled(false);
          setPortone(null);
          setPaymentsMessage('결제 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paidMerchantUid = params.get('merchant_uid') || '';
    const paidImpUid = params.get('imp_uid') || '';
    const errorCode = params.get('error_code');
    const errorMsg = params.get('error_msg');
    const impSuccess = params.get('imp_success');
    const returned = Boolean(paidMerchantUid || paidImpUid || errorMsg || errorCode || impSuccess);
    if (!returned) return undefined;

    window.history.replaceState({}, '', '/order');
    const failed = impSuccess === 'false' || Boolean(errorCode);
    if (failed || !paidImpUid) {
      sessionStorage.removeItem(PENDING_PAY_KEY);
      setMessage(errorMsg || '결제가 취소되었습니다.');
      return undefined;
    }

    const saved = readPendingPay();
    if (!saved || saved.merchantUid !== paidMerchantUid) {
      setMessage('결제 정보를 확인하지 못했습니다.');
      return undefined;
    }
    if (finishingPayments.has(paidMerchantUid)) return undefined;
    finishingPayments.add(paidMerchantUid);
    setPending(true);
    const auth = storedToken();
    if (!auth) {
      finishingPayments.delete(paidMerchantUid);
      setPending(false);
      setStatus('guest');
      setMessage(`결제는 완료되었습니다. 로그인 후 다시 확인해 주세요. 결제번호 ${paidImpUid}`);
      return undefined;
    }
    postOrder(auth, orderPayloadWithPayment(saved.payload, paidImpUid, paidMerchantUid))
      .then((body) => {
        sessionStorage.removeItem(PENDING_PAY_KEY);
        window.dispatchEvent(new Event('cart-updated'));
        setImpUid(paidImpUid || body.imp_uid || '');
        setOrder(body);
        setStatus('done');
        if (body.status === '결제확인필요') {
          setMessage(`결제는 확인됐지만 주문 확정에 문제가 있습니다. 관리자 확인이 필요합니다. 결제번호 ${paidImpUid}`);
        }
      })
      .catch((error) => {
        finishingPayments.delete(paidMerchantUid);
        if (error.status === 401) setStatus('guest');
        const reason = error instanceof Error ? error.message : '주문을 저장하지 못했습니다.';
        setMessage(`결제는 완료되었습니다. ${reason} 결제번호 ${paidImpUid}`);
      })
      .finally(() => setPending(false));
    return undefined;
  }, []);

  useEffect(() => {
    if (!token) return undefined;

    let ignore = false;
    const headers = { authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API_BASE}/api/carts`, { headers }),
      fetch(`${API_BASE}/api/me`, { headers }),
    ])
      .then(async ([cartResponse, meResponse]) => {
        if (ignore) return;
        if (cartResponse.status === 401 || meResponse.status === 401) {
          setStatus((current) => (current === 'done' ? current : 'guest'));
          return;
        }
        if (!cartResponse.ok) {
          setStatus((current) => (current === 'done' ? current : 'error'));
          return;
        }
        const cart = await cartResponse.json();
        const me = meResponse.ok ? await meResponse.json() : null;
        setItems(Array.isArray(cart.items) ? cart.items : []);
        if (me) {
          setBuyer((current) => (
            current.name || current.phone || current.email
              ? current
              : { name: me.name ?? '', phone: me.phone ?? '', email: me.email ?? '' }
          ));
        }
        setStatus((current) => (current === 'done' ? current : 'ready'));
      })
      .catch(() => {
        if (!ignore) setStatus((current) => (current === 'done' ? current : 'error'));
      });

    return () => {
      ignore = true;
    };
  }, [token]);

  const total = items.reduce((sum, item) => {
    const course = courseOf(item);
    return sum + (Number(course?.price) || 0) * (Number(item.quantity) || 0);
  }, 0);

  async function startPayment(nextPayment = payment) {
    if (pending) return;
    if (paymentsEnabled === false) {
      setMessage(paymentsMessage || '결제 준비 중입니다. 실연동 승인 후 이용할 수 있습니다.');
      return;
    }
    if (!portone?.impCode || !portone?.channelKey) {
      setMessage('결제 설정이 없습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    if (!buyer.name.trim() || !buyer.phone.trim() || !buyer.email.trim()) {
      setMessage('이름, 연락처, 이메일을 입력해 주세요.');
      return;
    }
    if (!Number.isFinite(total) || total <= 0) {
      setMessage('결제할 금액이 없습니다.');
      return;
    }
    if (!window.IMP?.request_pay) {
      setMessage('결제 모듈을 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.');
      return;
    }

    const auth = storedToken();
    if (!auth) {
      setStatus('guest');
      setMessage('로그인이 필요합니다.');
      return;
    }

    const departure = todayValue();
    const payload = {
      items: items.map((item) => ({
        course: courseOf(item)?._id || item.course,
        quantity: Number(item.quantity) || 1,
      })),
      departure_date: departure,
      departure_time: '09:00',
      departure_place: '현장 집합',
      people: 1,
      payment_method: nextPayment,
      buyer: {
        name: buyer.name.trim(),
        phone: buyer.phone.trim(),
        email: buyer.email.trim(),
      },
    };
    const uid = merchantUid();
    const amount = Math.round(total);

    setPending(true);
    setMessage('');
    try {
      const prepareResponse = await fetch(`${API_BASE}/api/payments/prepare`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${auth}` },
        body: JSON.stringify({ merchant_uid: uid, amount }),
      });
      const prepareBody = await prepareResponse.json().catch(() => ({}));
      if (!prepareResponse.ok) {
        throw new Error(prepareBody.message || '결제 준비에 실패했습니다.');
      }
      const channelKey = prepareBody.portone?.channelKey || portone.channelKey;
      const impCode = prepareBody.portone?.impCode || portone.impCode;

      rememberPendingPay(uid, payload);
      window.IMP.init(impCode);
      window.IMP.request_pay(
        {
          channelKey,
          pay_method: PORTONE_PAY_METHOD[nextPayment],
          merchant_uid: uid,
          name: orderName(items),
          amount,
          buyer_email: payload.buyer.email,
          buyer_name: payload.buyer.name,
          buyer_tel: payload.buyer.phone,
          m_redirect_url: `${window.location.origin}/order`,
        },
        async (response) => {
          try {
            if (!paymentAccepted(response)) {
              sessionStorage.removeItem(PENDING_PAY_KEY);
              setMessage(response?.error_msg || '결제가 취소되었습니다.');
              return;
            }
            if (finishingPayments.has(uid)) return;
            finishingPayments.add(uid);
            const paidImp = response.imp_uid || '';
            const paidMerchant = response.merchant_uid || uid;
            const body = await postOrder(auth, orderPayloadWithPayment(payload, paidImp, paidMerchant));
            sessionStorage.removeItem(PENDING_PAY_KEY);
            window.dispatchEvent(new Event('cart-updated'));
            setImpUid(paidImp || body.imp_uid || '');
            setOrder(body);
            setStatus('done');
            if (body.status === '결제확인필요') {
              setMessage(`결제는 확인됐지만 주문 확정에 문제가 있습니다. 관리자 확인이 필요합니다. 결제번호 ${paidImp || uid}`);
            }
          } catch (error) {
            finishingPayments.delete(uid);
            if (error.status === 401) setStatus('guest');
            const reason = error instanceof Error ? error.message : '서버에 연결하지 못했습니다.';
            const paidId = response?.imp_uid || uid;
            setMessage(paymentAccepted(response) ? `결제는 완료되었습니다. ${reason} 결제번호 ${paidId}` : reason);
          } finally {
            setPending(false);
          }
        },
      );
    } catch (error) {
      setPending(false);
      setMessage(error instanceof Error ? error.message : '결제 준비에 실패했습니다.');
    }
  }

  useEffect(() => {
    if (!autoPay || status !== 'ready' || items.length === 0 || pending || order) return;
    if (paymentsEnabled !== true || !portone?.channelKey) return;
    if (autoPayStarted.current) return;
    if (!buyer.name.trim() || !buyer.phone.trim() || !buyer.email.trim()) return;
    if (!Number.isFinite(total) || total <= 0) return;
    autoPayStarted.current = true;
    setSearchParams({}, { replace: true });
    startPayment(payment);
    // 장바구니에서 넘어온 직후 한 번만 결제창을 엽니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPay, status, items, buyer, total, payment, pending, order, paymentsEnabled, portone]);

  function submit(event) {
    event.preventDefault();
    startPayment(payment);
  }

  if (status === 'done' && order) {
    const needsReview = order.status === '결제확인필요';
    return (
      <section className="order-page">
        <div className="wrap order-done">
          <p>주문번호 ORD-{String(order._id).slice(-6).toUpperCase()}</p>
          <h1>{needsReview ? '결제 확인이 필요합니다' : '결제가 완료되었습니다'}</h1>
          <p>
            {order.payment_method} · {money(order.total_price)}
          </p>
          {impUid || order.imp_uid ? <p>결제번호 {impUid || order.imp_uid}</p> : null}
          {order.merchant_uid ? <p>주문번호 {order.merchant_uid}</p> : null}
          {needsReview ? (
            <p className="course-status">
              {message || '결제는 확인됐지만 주문 확정에 문제가 있습니다. 관리자에게 문의해 주세요.'}
            </p>
          ) : null}
          <div className="order-done-actions">
            <Link className="btn btn-primary" to="/">
              메인으로
            </Link>
            <Link className="btn btn-ghost" to="/bomul.html#courses">
              다른 코스 보기
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="order-page">
      <div className="wrap">
        <Link className="back" to="/cart">
          ← 장바구니
        </Link>
        <div className="order-head">
          <h1>주문하기</h1>
          <p>결제 수단을 고른 뒤 결제를 진행합니다.</p>
        </div>

        {status === 'guest' ? (
          <p className="course-status">
            {message ? `${message} ` : '주문은 로그인 후 할 수 있습니다. '}
            <Link to="/login">로그인</Link>
          </p>
        ) : null}
        {status === 'error' ? <p className="course-status">장바구니를 불러오지 못했습니다.</p> : null}
        {status === 'loading' ? <p className="course-status">주문 정보를 불러오는 중</p> : null}
        {status === 'ready' && items.length === 0 ? (
          <p className="course-status">
            주문할 코스가 없습니다. <Link to="/bomul.html#courses">코스 보기</Link>
          </p>
        ) : null}

        {status === 'ready' && items.length > 0 ? (
          <form className="order-layout" onSubmit={submit} noValidate>
            <div className="order-fields">
              <h2>예약자</h2>
              <div className="field">
                <label htmlFor="order-name">이름</label>
                <input
                  id="order-name"
                  value={buyer.name}
                  autoComplete="name"
                  onChange={(event) => setBuyer({ ...buyer, name: event.target.value })}
                  required
                />
              </div>
              <div className="two">
                <div className="field">
                  <label htmlFor="order-phone">연락처</label>
                  <input
                    id="order-phone"
                    inputMode="tel"
                    autoComplete="tel"
                    value={buyer.phone}
                    onChange={(event) => setBuyer({ ...buyer, phone: event.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="order-email">이메일</label>
                  <input
                    id="order-email"
                    type="email"
                    autoComplete="email"
                    value={buyer.email}
                    onChange={(event) => setBuyer({ ...buyer, email: event.target.value })}
                    required
                  />
                </div>
              </div>
              {paymentsEnabled === false ? (
                <p className="course-status">{paymentsMessage}</p>
              ) : null}
              {message ? <p className="course-status">{message}</p> : null}
            </div>

            <aside className="order-ticket">
              <h2>결제 코스</h2>
              <ul>
                {items.map((item) => {
                  const course = courseOf(item);
                  const courseId = course?._id || item.course;
                  const line = (Number(course?.price) || 0) * (Number(item.quantity) || 0);
                  return (
                    <li key={courseId}>
                      <div className="order-course">
                        {course?.image ? <img src={course.image} alt="" /> : <span className="order-thumb" />}
                        <strong>{course?.name || '코스'}</strong>
                      </div>
                      <div className="order-course-row">
                        <span>상품 수량</span>
                        <b>{item.quantity}개</b>
                      </div>
                      <div className="order-course-row">
                        <span>결제금액</span>
                        <b>{money(line)}</b>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="order-total">
                <span>합계</span>
                <strong>{money(total)}</strong>
              </div>
            </aside>

            <fieldset className="order-pay">
              <legend>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M3 10h18" fill="none" stroke="currentColor" strokeWidth="1.8" />
                </svg>
                결제 정보
              </legend>
              <div className="order-pay-list">
                {PAYMENT_METHODS.map((method) => (
                  <label key={method} className={method === '네이버페이' ? 'is-naver' : undefined}>
                    <input
                      type="radio"
                      name="payment"
                      value={method}
                      checked={payment === method}
                      onChange={() => setPayment(method)}
                    />
                    {method}
                  </label>
                ))}
              </div>
              <button className="btn btn-primary" type="submit" disabled={pending || paymentsEnabled === false}>
                {pending ? '결제 중' : paymentsEnabled === false ? '결제 준비 중' : '결제하기'}
              </button>
              <p className="order-agree">주문 완료 시 개인정보처리방침 및 이용약관에 동의한 것으로 간주됩니다.</p>
            </fieldset>
          </form>
        ) : null}
      </div>
    </section>
  );
}

export default OrderPage;
