/**
 * 포트원(아임포트) REST API v1 결제 조회·검증.
 * PORTONE_MODE=
 *   off  — 결제 끔
 *   mock — 개발용 mock_ / seedMockPayment (운영은 ALLOW_MOCK_PAY=1 필요)
 *   test — 포트원 테스트 채널 (REST 키 있으면 API 검증, 없으면 prepare 인텐트 검증)
 *   live — 실결제 (키 필수, 별도 승인 후)
 */

const MOCK_STORE = new Map();
const TEST_INTENTS = new Map();
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
  const production = env.NODE_ENV === 'production';
  const allowMock = env.ALLOW_MOCK_PAY === '1';
  const allowTest = env.ALLOW_TEST_PAY === '1';

  if (mode === 'off') return 'off';
  if (mode === 'live') {
    if (!env.PORTONE_IMP_KEY || !env.PORTONE_IMP_SECRET) {
      throw httpError(500, '포트원 REST API 키가 없습니다.');
    }
    return 'live';
  }
  if (mode === 'test') {
    if (production && !allowTest) return 'off';
    return 'test';
  }
  if (mode === 'mock') {
    if (production && !allowMock) return 'off';
    return 'mock';
  }
  if (env.PORTONE_IMP_KEY && env.PORTONE_IMP_SECRET) return 'live';
  if (production && !allowMock && !allowTest) return 'off';
  return 'mock';
}

export function portoneClientConfig(env = process.env) {
  const impCode = text(env.PORTONE_IMP_CODE);
  const channelKey = text(env.PORTONE_CHANNEL_KEY);
  if (!impCode || !channelKey) return null;
  return { impCode, channelKey };
}

export function clearMockPayments() {
  MOCK_STORE.clear();
}

export function clearTestIntents() {
  TEST_INTENTS.clear();
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

/** 테스트 결제 창 열기 전 서버가 금액·주문번호를 확정합니다. */
export function prepareTestIntent({ merchant_uid, amount, userId }, env = process.env) {
  const merchantUid = text(merchant_uid);
  const expected = Number(amount);
  if (!merchantUid) throw httpError(400, '주문번호가 필요합니다.');
  if (!Number.isFinite(expected) || expected <= 0) throw httpError(400, '결제 금액이 올바르지 않습니다.');
  if (portoneMode(env) === 'off') throw httpError(503, '결제 준비 중입니다. 실연동 승인 후 이용할 수 있습니다.');

  const entry = {
    merchant_uid: merchantUid,
    amount: expected,
    userId: userId ? String(userId) : '',
    createdAt: Date.now(),
    consumed: false,
  };
  TEST_INTENTS.set(merchantUid, entry);
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

function testIntentPaymentOf(impUid, { merchantUid, expectedAmount }) {
  const intent = TEST_INTENTS.get(merchantUid);
  if (!intent || intent.consumed) throw httpError(400, '결제 준비 정보가 없습니다. 다시 시도해 주세요.');
  if (Number(intent.amount) !== Number(expectedAmount)) {
    throw httpError(400, '결제 금액이 주문 금액과 일치하지 않습니다.');
  }
  if (!text(impUid)) throw httpError(400, '결제번호가 필요합니다.');
  intent.consumed = true;
  return {
    imp_uid: impUid,
    merchant_uid: merchantUid,
    amount: Number(intent.amount),
    status: 'paid',
    pay_method: 'card',
    test_intent: true,
  };
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

export function clearPortoneTokenCache() {
  cachedToken = null;
}

async function fetchLivePayment(uid, env, fetchImpl) {
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

export async function fetchPortOnePayment(impUid, options = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const merchantUid = text(options.merchantUid);
  const expectedAmount = Number(options.expectedAmount);
  const uid = text(impUid);
  if (!uid) throw httpError(400, '결제번호가 필요합니다.');

  const mode = portoneMode(env);
  if (mode === 'off') {
    throw httpError(503, '결제 준비 중입니다. 실연동 승인 후 이용할 수 있습니다.');
  }
  if (mode === 'mock') {
    return mockPaymentOf(uid, { merchantUid, expectedAmount });
  }
  if (mode === 'test') {
    if (env.PORTONE_IMP_KEY && env.PORTONE_IMP_SECRET) {
      return fetchLivePayment(uid, env, fetchImpl);
    }
    return testIntentPaymentOf(uid, { merchantUid, expectedAmount });
  }
  return fetchLivePayment(uid, env, fetchImpl);
}

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
