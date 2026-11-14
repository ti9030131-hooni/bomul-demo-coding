/**
 * 결제·도전권 구매 킬 스위치.
 * - PAYMENTS_ENABLED=0|false|off → 차단
 * - PAYMENTS_ENABLED=1|true|on → 허용
 * - 미설정: NODE_ENV=production 이면 차단, 그 외(로컬)는 허용
 * 테스트: test/payments-gate.test.mjs
 */

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export const PAYMENTS_DISABLED_MESSAGE = '결제 준비 중입니다. 실연동 승인 후 이용할 수 있습니다.';

export function paymentsEnabled(env = process.env) {
  const flag = String(env.PAYMENTS_ENABLED ?? '').trim().toLowerCase();
  if (['0', 'false', 'off', 'no'].includes(flag)) return false;
  if (['1', 'true', 'on', 'yes'].includes(flag)) return true;
  return env.NODE_ENV !== 'production';
}

export function assertPaymentsEnabled(env = process.env) {
  if (!paymentsEnabled(env)) throw httpError(503, PAYMENTS_DISABLED_MESSAGE);
}

export function paymentStatus(env = process.env) {
  const enabled = paymentsEnabled(env);
  return {
    enabled,
    message: enabled ? '결제를 이용할 수 있습니다.' : PAYMENTS_DISABLED_MESSAGE,
  };
}
