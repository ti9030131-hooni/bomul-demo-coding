// 실행: cd server && node --test test/payments-gate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAYMENTS_DISABLED_MESSAGE,
  assertPaymentsEnabled,
  paymentStatus,
  paymentsEnabled,
} from '../src/services/payments.js';

test('PAYMENTS_ENABLED=0 이면 결제를 차단한다', () => {
  assert.equal(paymentsEnabled({ PAYMENTS_ENABLED: '0' }), false);
  assert.equal(paymentsEnabled({ PAYMENTS_ENABLED: 'off' }), false);
  assert.equal(paymentsEnabled({ PAYMENTS_ENABLED: '1' }), true);
  assert.equal(paymentsEnabled({ PAYMENTS_ENABLED: 'on' }), true);
});

test('PORTONE_MODE=off 이면 결제 플래그가 켜져도 차단한다', () => {
  assert.equal(paymentsEnabled({ PAYMENTS_ENABLED: '1', PORTONE_MODE: 'off' }), false);
  assert.equal(
    paymentsEnabled({ NODE_ENV: 'production', PAYMENTS_ENABLED: '1' }),
    false,
  );
  assert.equal(
    paymentsEnabled({
      NODE_ENV: 'production',
      PAYMENTS_ENABLED: '1',
      PORTONE_MODE: 'mock',
      ALLOW_MOCK_PAY: '1',
    }),
    true,
  );
});

test('미설정 시 운영은 차단, 로컬은 허용', () => {
  assert.equal(paymentsEnabled({ NODE_ENV: 'production' }), false);
  assert.equal(paymentsEnabled({}), true);
  assert.equal(paymentsEnabled({ NODE_ENV: 'development' }), true);
});

test('차단 시 assert 는 503', () => {
  assert.throws(
    () => assertPaymentsEnabled({ PAYMENTS_ENABLED: '0' }),
    (error) => error.status === 503 && error.message === PAYMENTS_DISABLED_MESSAGE,
  );
  assert.doesNotThrow(() => assertPaymentsEnabled({ PAYMENTS_ENABLED: '1' }));
});

test('status 응답에 enabled 와 안내 문구가 있다', () => {
  const off = paymentStatus({ PAYMENTS_ENABLED: '0' });
  assert.equal(off.enabled, false);
  assert.equal(off.message, PAYMENTS_DISABLED_MESSAGE);
  const on = paymentStatus({ PAYMENTS_ENABLED: '1' });
  assert.equal(on.enabled, true);
});
