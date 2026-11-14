/**
 * 포트원(아임포트) REST API v1 결제 조회·검증.
 * PORTONE_MODE=mock | live (미설정 시 키가 있으면 live, 없으면 mock)
 * 모의: seedMockPayment 로 등록하거나 imp_uid 가 mock_ 로 시작하면 서버 기대 금액으로 paid 응답.
 */

const MOCK_STORE = new Map();
const TOKEN_TTL_MS = 25 * 60 * 1000;
let cachedToken = null;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function portoneMode(env = process.env) {
  const mode = String(env.PORTONE_MODE || '').toLowerCase();
  if (mode === 'mock') return 'mock';
  if (mode === 'live') {
    if (!env.PORTONE_IMP_KEY || !env.PORTONE_IMP_SECRET) {
      throw httpError(500, '포트원 REST API 키가 없습니다.');
    }
    return 'live';
  }
  if (env.PORTONE_IMP_KEY && env.PORTONE_IMP_SECRET) return 'live';
  return 'mock';
}

export function clearMockPayments() {
  MOCK_STORE.clear();
}

export function seedMockPayment(payment) {
  const impUid = text(payment?.imp_uid);
  const merchantUid = text(payment?.merchant_uid);
  if (!impUid || !merchantUid) throw new Error('mock payment 에 imp_uid, merchant_uid 가 필요합니다.');
  const entry = {
    imp_uid: impUid,
    merchant_uid: merchantUid,
    amount: Number(payment.amount),
    status: text(payment.status) || 'paid',
    pay_method: text(payment.pay_method) || 'card',
  };
  MOCK_STORE.set(impUid, entry);
  return entry;
}

function mockPaymentOf(impUid, { merchantUid, expectedAmount }) {
  const stored = MOCK_STORE.get(impUid);
  if (stored) return { ...stored };
  if (impUid.startsWith('mock_')) {
    return {
      imp_uid: impUid,
      merchant_uid: merchantUid,
      amount: Number(expectedAmount),
      status: 'paid',
      pay_method: 'card',
    };
  }
  throw httpError(404, '결제 정보를 찾을 수 없습니다.');
}

async function getAccessToken(env, fetchImpl) {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.accessToken;

  const response = await fetchImpl('https://api.iamport.kr/users/getToken', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      imp_key: env.PORTONE_IMP_KEY,
      imp_secret: env.PORTONE_IMP_SECRET,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.code !== 0 || !body.response?.access_token) {
    throw httpError(502, '포트원 인증에 실패했습니다.');
  }
  cachedToken = {
    accessToken: body.response.access_token,
    expiresAt: now + TOKEN_TTL_MS,
  };
  return cachedToken.accessToken;
}

/** 테스트에서 토큰 캐시를 비울 때 사용합니다. */
export function clearPortoneTokenCache() {
  cachedToken = null;
}

export async function fetchPortOnePayment(impUid, options = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const merchantUid = text(options.merchantUid);
  const expectedAmount = Number(options.expectedAmount);
  const uid = text(impUid);
  if (!uid) throw httpError(400, '결제번호가 필요합니다.');

  if (portoneMode(env) === 'mock') {
    return mockPaymentOf(uid, { merchantUid, expectedAmount });
  }

  const token = await getAccessToken(env, fetchImpl);
  const response = await fetchImpl(`https://api.iamport.kr/payments/${encodeURIComponent(uid)}`, {
    headers: { Authorization: token },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.code !== 0 || !body.response) {
    throw httpError(502, body.message || '결제 정보를 조회하지 못했습니다.');
  }
  const payment = body.response;
  return {
    imp_uid: payment.imp_uid,
    merchant_uid: payment.merchant_uid,
    amount: Number(payment.amount),
    status: payment.status,
    pay_method: payment.pay_method,
  };
}

/**
 * 결제사 응답의 금액·주문번호·상태가 서버 기대값과 일치하는지 검사합니다.
 * @returns {Promise<{ imp_uid: string, merchant_uid: string, amount: number, status: string, pay_method?: string }>}
 */
export async function verifyPortOnePayment({ imp_uid, merchant_uid, expectedAmount }, options = {}) {
  const impUid = text(imp_uid);
  const merchantUid = text(merchant_uid);
  const amount = Number(expectedAmount);

  if (!impUid) throw httpError(400, '결제번호가 필요합니다.');
  if (!merchantUid) throw httpError(400, '주문번호가 필요합니다.');
  if (!Number.isFinite(amount) || amount < 0) throw httpError(400, '결제 금액이 올바르지 않습니다.');

  const payment = await fetchPortOnePayment(impUid, {
    ...options,
    merchantUid,
    expectedAmount: amount,
  });

  if (text(payment.merchant_uid) !== merchantUid) {
    throw httpError(400, '주문번호가 결제 내역과 일치하지 않습니다.');
  }
  if (Number(payment.amount) !== amount) {
    throw httpError(400, '결제 금액이 주문 금액과 일치하지 않습니다.');
  }
  if (payment.status !== 'paid') {
    throw httpError(400, '결제가 완료되지 않았습니다.');
  }

  return payment;
}
