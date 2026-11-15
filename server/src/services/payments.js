/**
 * 결제·도전권 구매 킬 스위치 + 클라이언트 공개 설정.
 * - PAYMENTS_ENABLED=0 → 차단
 * - PORTONE_MODE=off → 차단
 * - PORTONE_MODE=test + ALLOW_TEST_PAY=1 → 테스트 결제 허용 (실결제 live 아님)
 * 테스트: test/payments-gate.test.mjs
 */
import { portoneClientConfig, portoneMode } from './portone.js';

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export const PAYMENTS_DISABLED_MESSAGE = '결제 준비 중입니다. 실연동 승인 후 이용할 수 있습니다.';

export function paymentsEnabled(env = process.env) {
  const flag = String(env.PAYMENTS_ENABLED ?? '').trim().toLowerCase();
  if (['0', 'false', 'off', 'no'].includes(flag)) return false;
  let flagOn;
  if (['1', 'true', 'on', 'yes'].includes(flag)) flagOn = true;
  else flagOn = env.NODE_ENV !== 'production';
  if (!flagOn) return false;
  try {
    if (portoneMode(env) === 'off') return false;
  } catch {
    return false;
  }
  return true;
}

export function assertPaymentsEnabled(env = process.env) {
  if (!paymentsEnabled(env)) throw httpError(503, PAYMENTS_DISABLED_MESSAGE);
}

export function paymentStatus(env = process.env) {
  const enabled = paymentsEnabled(env);
  const mode = (() => {
    try {
      return portoneMode(env);
    } catch {
      return 'off';
    }
  })();
  const client = enabled ? portoneClientConfig(env) : null;
  return {
    enabled,
    mode,
    message: enabled
      ? (mode === 'test' ? '포트원 테스트 결제를 이용할 수 있습니다.' : '결제를 이용할 수 있습니다.')
      : PAYMENTS_DISABLED_MESSAGE,
    portone: client,
  };
}
