// 실행: cd server && node --test test/portone.test.mjs
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearMockPayments,
  clearPortoneTokenCache,
  portoneMode,
  seedMockPayment,
  verifyPortOnePayment,
  fetchPortOnePayment,
} from '../src/services/portone.js';

beforeEach(() => {
  clearMockPayments();
  clearPortoneTokenCache();
});

test('키가 없으면 mock, 있으면 live(명시 mock 제외)', () => {
  assert.equal(portoneMode({}), 'mock');
  assert.equal(portoneMode({ PORTONE_MODE: 'mock', PORTONE_IMP_KEY: 'k', PORTONE_IMP_SECRET: 's' }), 'mock');
  assert.equal(portoneMode({ PORTONE_IMP_KEY: 'k', PORTONE_IMP_SECRET: 's' }), 'live');
  assert.equal(portoneMode({ PORTONE_MODE: 'live', PORTONE_IMP_KEY: 'k', PORTONE_IMP_SECRET: 's' }), 'live');
  assert.equal(portoneMode({ PORTONE_MODE: 'off' }), 'off');
  assert.equal(portoneMode({ NODE_ENV: 'production' }), 'off');
  assert.equal(portoneMode({ PORTONE_MODE: 'mock', NODE_ENV: 'production' }), 'off');
  assert.equal(portoneMode({ PORTONE_MODE: 'mock', NODE_ENV: 'production', ALLOW_MOCK_PAY: '1' }), 'mock');
  assert.throws(
    () => portoneMode({ PORTONE_MODE: 'live' }),
    (error) => error.status === 500,
  );
});

test('운영에서 mock 이 off 이면 검증을 거부한다', async () => {
  await assert.rejects(
    () => verifyPortOnePayment(
      { imp_uid: 'mock_x', merchant_uid: 'm', expectedAmount: 1000 },
      { env: { NODE_ENV: 'production', PORTONE_MODE: 'mock' } },
    ),
    (error) => error.status === 503,
  );
});

test('모의 결제: 금액·주문번호·paid 상태가 맞으면 통과한다', async () => {
  seedMockPayment({
    imp_uid: 'imp_mock_ok',
    merchant_uid: 'bomul-order-1',
    amount: 8000,
    status: 'paid',
  });
  const payment = await verifyPortOnePayment(
    { imp_uid: 'imp_mock_ok', merchant_uid: 'bomul-order-1', expectedAmount: 8000 },
    { env: { PORTONE_MODE: 'mock' } },
  );
  assert.equal(payment.status, 'paid');
  assert.equal(payment.amount, 8000);
  assert.equal(payment.merchant_uid, 'bomul-order-1');
});

test('모의 결제: 금액이 다르면 거절한다', async () => {
  seedMockPayment({
    imp_uid: 'imp_mock_amt',
    merchant_uid: 'bomul-order-2',
    amount: 4000,
    status: 'paid',
  });
  await assert.rejects(
    () => verifyPortOnePayment(
      { imp_uid: 'imp_mock_amt', merchant_uid: 'bomul-order-2', expectedAmount: 8000 },
      { env: { PORTONE_MODE: 'mock' } },
    ),
    (error) => error.status === 400 && /금액/.test(error.message),
  );
});

test('모의 결제: 주문번호가 다르면 거절한다', async () => {
  seedMockPayment({
    imp_uid: 'imp_mock_muid',
    merchant_uid: 'bomul-a',
    amount: 4000,
    status: 'paid',
  });
  await assert.rejects(
    () => verifyPortOnePayment(
      { imp_uid: 'imp_mock_muid', merchant_uid: 'bomul-b', expectedAmount: 4000 },
      { env: { PORTONE_MODE: 'mock' } },
    ),
    (error) => error.status === 400 && /주문번호/.test(error.message),
  );
});

test('모의 결제: paid 가 아니면 거절한다', async () => {
  seedMockPayment({
    imp_uid: 'imp_mock_ready',
    merchant_uid: 'bomul-order-3',
    amount: 4000,
    status: 'ready',
  });
  await assert.rejects(
    () => verifyPortOnePayment(
      { imp_uid: 'imp_mock_ready', merchant_uid: 'bomul-order-3', expectedAmount: 4000 },
      { env: { PORTONE_MODE: 'mock' } },
    ),
    (error) => error.status === 400 && /완료/.test(error.message),
  );
});

test('mock_ 접두 결제번호는 등록 없이 서버 기대 금액으로 검증한다', async () => {
  const payment = await verifyPortOnePayment(
    { imp_uid: 'mock_demo_1', merchant_uid: 'bomul-demo', expectedAmount: 12000 },
    { env: { PORTONE_MODE: 'mock' } },
  );
  assert.equal(payment.imp_uid, 'mock_demo_1');
  assert.equal(payment.amount, 12000);
  assert.equal(payment.status, 'paid');
});

test('등록되지 않은 모의 결제는 404', async () => {
  await assert.rejects(
    () => fetchPortOnePayment('imp_unknown', {
      env: { PORTONE_MODE: 'mock' },
      merchantUid: 'x',
      expectedAmount: 1,
    }),
    (error) => error.status === 404,
  );
});

test('live 모드는 토큰·단건 조회로 금액·주문번호·상태를 검증한다', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    if (String(url).includes('/users/getToken')) {
      return {
        ok: true,
        async json() {
          return { code: 0, response: { access_token: 'tok_test' } };
        },
      };
    }
    if (String(url).includes('/payments/imp_live_1')) {
      assert.equal(init.headers.Authorization, 'tok_test');
      return {
        ok: true,
        async json() {
          return {
            code: 0,
            response: {
              imp_uid: 'imp_live_1',
              merchant_uid: 'bomul-live',
              amount: 4000,
              status: 'paid',
              pay_method: 'card',
            },
          };
        },
      };
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  const payment = await verifyPortOnePayment(
    { imp_uid: 'imp_live_1', merchant_uid: 'bomul-live', expectedAmount: 4000 },
    {
      env: {
        PORTONE_MODE: 'live',
        PORTONE_IMP_KEY: 'key',
        PORTONE_IMP_SECRET: 'secret',
      },
      fetchImpl,
    },
  );
  assert.equal(payment.status, 'paid');
  assert.equal(payment.amount, 4000);
  assert.equal(calls.length, 2);
});

test('live 모드에서 결제사 금액이 다르면 거절한다', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('/users/getToken')) {
      return {
        ok: true,
        async json() {
          return { code: 0, response: { access_token: 'tok' } };
        },
      };
    }
    return {
      ok: true,
      async json() {
        return {
          code: 0,
          response: {
            imp_uid: 'imp_live_2',
            merchant_uid: 'bomul-live-2',
            amount: 1,
            status: 'paid',
          },
        };
      },
    };
  };

  await assert.rejects(
    () => verifyPortOnePayment(
      { imp_uid: 'imp_live_2', merchant_uid: 'bomul-live-2', expectedAmount: 4000 },
      {
        env: { PORTONE_MODE: 'live', PORTONE_IMP_KEY: 'k', PORTONE_IMP_SECRET: 's' },
        fetchImpl,
      },
    ),
    (error) => error.status === 400 && /금액/.test(error.message),
  );
});
