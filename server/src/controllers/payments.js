import { assertPaymentsEnabled, paymentStatus } from '../services/payments.js';
import { prepareTestIntent, portoneClientConfig } from '../services/portone.js';

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function getPaymentStatus(req, res) {
  res.json(paymentStatus());
}

/** 결제창 열기 전 금액·주문번호 확정 (테스트/실연동 공통) */
export async function preparePayment(req, res) {
  assertPaymentsEnabled();
  const client = portoneClientConfig();
  if (!client) {
    throw httpError(503, '포트원 테스트 설정이 없습니다. PORTONE_IMP_CODE와 PORTONE_PG 또는 PORTONE_CHANNEL_KEY를 확인하세요.');
  }

  const merchantUid = text(req.body?.merchant_uid);
  const amount = Number(req.body?.amount);
  const intent = prepareTestIntent({
    merchant_uid: merchantUid,
    amount,
    userId: req.user?._id || req.user?.id,
  });

  res.status(201).json({
    merchant_uid: intent.merchant_uid,
    amount: intent.amount,
    portone: client,
  });
}
