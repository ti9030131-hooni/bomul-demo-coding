// 실행: cd server && node --test test/payments-gate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAYMENTS_DISABLED_MESSAGE,
  assertPaymentsEnabled,
  paymentStatus,
  paymentsEnabled,
} from '../src/services/payments.js';
import {
  clearTestIntents,
  prepareTestIntent,
  verifyPortOnePayment,
  portoneMode,
} from '../src/services/portone.js';

test('PAYMENTS_ENABLED=0 이면 결제를 차단한다', () => {
  assert.equal(paymentsEnabled({ PAYMENTS_ENABLED: '0' }), false);
  assert.equal(paymentsEnabled({ PAYMENTS_ENABLED: 'off' }), false);
  assert.equal(paymentsEnabled({ PAYMENTS_ENABLED: '1' }), true);
});

test('PORTONE_MODE=off 이면 결제 플래그가 켜져도 차단한다', () => {
  assert.equal(paymentsEnabled({ PAYMENTS_ENABLED: '1', PORTONE_MODE: 'off' }), false);
});

test('test 모드는 ALLOW_TEST_PAY=1 일 때 운영에서도 허용한다', () => {
  assert.equal(portoneMode({ PORTONE_MODE: 'test', NODE_ENV: 'production' }), 'off');
  assert.equal(portoneMode({ PORTONE_MODE: 'test', NODE_ENV: 'production', ALLOW_TEST_PAY: '1' }), 'test');
  assert.equal(
    paymentsEnabled({
      PAYMENTS_ENABLED: '1',
      PORTONE_MODE: 'test',
      NODE_ENV: 'production',
      ALLOW_TEST_PAY: '1',
      PORTONE_IMP_CODE: 'imp_test',
      PORTONE_CHANNEL_KEY: 'channel-test',
    }),
    true,
  );
});

test('status 에 테스트 설정(portone)을 내려준다', () => {
  const status = paymentStatus({
    PAYMENTS_ENABLED: '1',
    PORTONE_MODE: 'test',
    ALLOW_TEST_PAY: '1',
    NODE_ENV: 'production',
    PORTONE_IMP_CODE: 'imp_test',
    PORTONE_CHANNEL_KEY: 'channel-test',
  });
  assert.equal(status.enabled, true);
  assert.equal(status.mode, 'test');
  assert.equal(status.portone.impCode, 'imp_test');
  assert.equal(status.portone.channelKey, 'channel-test');
});

test('test 모드 prepare 인텐트로 금액·주문번호를 검증한다', async () => {
  clearTestIntents();
  const env = { PORTONE_MODE: 'test', ALLOW_TEST_PAY: '1', NODE_ENV: 'production' };
  prepareTestIntent({ merchant_uid: 'bomul-t1', amount: 4000, userId: 'u1' }, env);
  const payment = await verifyPortOnePayment(
    { imp_uid: 'imp_test_1', merchant_uid: 'bomul-t1', expectedAmount: 4000 },
    { env },
  );
  assert.equal(payment.status, 'paid');
  assert.equal(payment.amount, 4000);
  await assert.rejects(
    () => verifyPortOnePayment(
      { imp_uid: 'imp_test_2', merchant_uid: 'bomul-t1', expectedAmount: 4000 },
      { env },
    ),
    (error) => error.status === 400,
  );
});

test('차단 시 assert 는 503', () => {
  assert.throws(
    () => assertPaymentsEnabled({ PAYMENTS_ENABLED: '0' }),
    (error) => error.status === 503 && error.message === PAYMENTS_DISABLED_MESSAGE,
  );
});

test('미설정 시 운영은 차단, 로컬은 허용', () => {
  assert.equal(paymentsEnabled({ NODE_ENV: 'production' }), false);
  assert.equal(paymentsEnabled({}), true);
});
