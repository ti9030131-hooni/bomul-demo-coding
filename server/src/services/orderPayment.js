/**
 * 주문 결제 확정용 순수 규칙 (DB·HTTP 없음). 테스트: test/orders-payment.test.mjs
 */

export function paymentIdsOf(body) {
  const impUid = typeof body?.imp_uid === 'string' ? body.imp_uid.trim() : '';
  const merchantUid = typeof body?.merchant_uid === 'string' ? body.merchant_uid.trim() : '';
  if (!impUid) {
    const error = new Error('결제번호가 필요합니다.');
    error.status = 400;
    throw error;
  }
  if (!merchantUid) {
    const error = new Error('주문번호가 필요합니다.');
    error.status = 400;
    throw error;
  }
  return { imp_uid: impUid, merchant_uid: merchantUid };
}

export function isSamePayer(orderUserId, requestUserId) {
  return String(orderUserId) === String(requestUserId);
}

export function duplicatePaymentResult(existing, requestUser, isAdmin) {
  if (!existing) return null;
  if (!isAdmin && !isSamePayer(existing.user, requestUser._id)) {
    const error = new Error('이미 처리된 결제입니다.');
    error.status = 409;
    throw error;
  }
  return { status: 200, order: existing, event: 'duplicate_payment_ignored' };
}

export function confirmedOrderFields({ userId, buyer, items, travel, paymentMethod, totalPrice, payment }) {
  return {
    user: userId,
    buyer,
    items,
    departure_date: travel.departure_date,
    departure_time: travel.departure_time,
    departure_place: travel.departure_place,
    people: travel.people,
    payment_method: paymentMethod,
    total_price: totalPrice,
    imp_uid: payment.imp_uid,
    merchant_uid: payment.merchant_uid,
    paid_amount: payment.amount,
    pg_status: payment.status,
    status: '결제완료',
  };
}

export function reviewOrderFields(fields, reason) {
  return {
    ...fields,
    status: '결제확인필요',
    payment_note: reason,
  };
}
