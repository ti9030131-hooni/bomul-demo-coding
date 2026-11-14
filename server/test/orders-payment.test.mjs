// 실행: cd server && node --test test/orders-payment.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  confirmedOrderFields,
  duplicatePaymentResult,
  paymentIdsOf,
  reviewOrderFields,
} from '../src/services/orderPayment.js';
import { seedMockPayment, clearMockPayments, verifyPortOnePayment } from '../src/services/portone.js';

test('결제·주문번호가 없으면 400', () => {
  assert.throws(() => paymentIdsOf({}), (error) => error.status === 400);
  assert.throws(() => paymentIdsOf({ imp_uid: 'x' }), (error) => error.status === 400 && /주문번호/.test(error.message));
  assert.throws(() => paymentIdsOf({ merchant_uid: 'y' }), (error) => error.status === 400 && /결제번호/.test(error.message));
  assert.deepEqual(paymentIdsOf({ imp_uid: '  a  ', merchant_uid: '  b  ' }), {
    imp_uid: 'a',
    merchant_uid: 'b',
  });
});

test('동일 결제 식별자면 기존 주문을 재사용한다', () => {
  const existing = { _id: 'o1', user: 'u1', imp_uid: 'imp1' };
  const result = duplicatePaymentResult(existing, { _id: 'u1' }, false);
  assert.equal(result.status, 200);
  assert.equal(result.order, existing);
  assert.equal(result.event, 'duplicate_payment_ignored');
});

test('다른 사용자의 동일 결제는 409', () => {
  const existing = { _id: 'o1', user: 'u1', imp_uid: 'imp1' };
  assert.throws(
    () => duplicatePaymentResult(existing, { _id: 'u2' }, false),
    (error) => error.status === 409,
  );
});

test('확정 주문 필드에 결제 식별자와 paid 금액이 들어간다', () => {
  const fields = confirmedOrderFields({
    userId: 'u1',
    buyer: { name: '홍', phone: '010', email: 'a@b.c' },
    items: [{ course: 'c1', name: '코스', price: 4000, quantity: 2 }],
    travel: {
      departure_date: new Date('2026-11-15'),
      departure_time: '09:00',
      departure_place: '현장 집합',
      people: 1,
    },
    paymentMethod: '신용카드',
    totalPrice: 8000,
    payment: {
      imp_uid: 'imp_x',
      merchant_uid: 'bomul-x',
      amount: 8000,
      status: 'paid',
    },
  });
  assert.equal(fields.status, '결제완료');
  assert.equal(fields.imp_uid, 'imp_x');
  assert.equal(fields.merchant_uid, 'bomul-x');
  assert.equal(fields.paid_amount, 8000);
  assert.equal(fields.pg_status, 'paid');
  assert.equal(fields.total_price, 8000);
});

test('저장 실패 시 결제확인필요 필드와 메모를 만든다', () => {
  const base = confirmedOrderFields({
    userId: 'u1',
    buyer: { name: '홍', phone: '010', email: 'a@b.c' },
    items: [{ course: 'c1', name: '코스', price: 4000, quantity: 1 }],
    travel: {
      departure_date: new Date('2026-11-15'),
      departure_time: '09:00',
      departure_place: '현장 집합',
      people: 1,
    },
    paymentMethod: '신용카드',
    totalPrice: 4000,
    payment: { imp_uid: 'imp_y', merchant_uid: 'bomul-y', amount: 4000, status: 'paid' },
  });
  const review = reviewOrderFields(base, '관리자 확인이 필요합니다.');
  assert.equal(review.status, '결제확인필요');
  assert.equal(review.payment_note, '관리자 확인이 필요합니다.');
  assert.equal(review.imp_uid, 'imp_y');
});

test('서버 금액과 모의 결제 금액을 맞춰 검증한다(실결제 없음)', async () => {
  clearMockPayments();
  seedMockPayment({
    imp_uid: 'imp_cart_total',
    merchant_uid: 'bomul-cart-1',
    amount: 8000,
    status: 'paid',
  });
  const itemsTotal = 4000 * 2;
  const payment = await verifyPortOnePayment(
    {
      imp_uid: 'imp_cart_total',
      merchant_uid: 'bomul-cart-1',
      expectedAmount: itemsTotal,
    },
    { env: { PORTONE_MODE: 'mock' } },
  );
  assert.equal(payment.amount, itemsTotal);
  assert.equal(payment.status, 'paid');
});
