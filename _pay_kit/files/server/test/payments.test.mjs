import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  catalog, findProduct, isTestPay, makeOrderId, missingTerms, orderName, payMode, ticketCovers, ticketPeriod, validCourseId,
} from '../src/services/payments.js';

test('상품은 4,000원 1코스 도전권과 9,900원 전체 코스 패스 두 가지', () => {
  assert.deepEqual(catalog.products.map((p) => [p.id, p.price, p.scope]), [['single', 4000, 'course'], ['all', 9900, 'all']]);
  assert.equal(findProduct('nope'), null);
});

test('결제 방식: 이니시스는 운영 키가 있어야 운영, 테스트 결제·가짜 결제는 운영 서버에서 기본으로 꺼짐', () => {
  assert.equal(payMode({}), 'off');
  assert.equal(payMode({ PAYMENTS_MODE: 'inicis' }), 'inicis');                                   // 로컬 테스트: 공개 테스트 상점
  assert.equal(isTestPay({ PAYMENTS_MODE: 'inicis' }), true);
  assert.equal(payMode({ PAYMENTS_MODE: 'inicis', NODE_ENV: 'production' }), 'off');              // 운영 서버 + 테스트 결제 → 꺼짐
  assert.equal(payMode({ PAYMENTS_MODE: 'inicis', NODE_ENV: 'production', ALLOW_TEST_PAY: '1' }), 'inicis');
  assert.equal(payMode({ PAYMENTS_MODE: 'inicis', INICIS_ENV: 'prod' }), 'off');                  // 운영인데 키 없음
  const live = { PAYMENTS_MODE: 'inicis', INICIS_ENV: 'prod', INICIS_MID: 'bomul00001', INICIS_SIGNKEY: 'k', NODE_ENV: 'production' };
  assert.equal(payMode(live), 'inicis'); assert.equal(isTestPay(live), false);
  assert.equal(payMode({ PAYMENTS_MODE: 'toss' }), 'off');                                        // 토스는 더 이상 쓰지 않음
  assert.equal(payMode({ PAYMENTS_MODE: 'mock' }), 'mock');
  assert.equal(payMode({ PAYMENTS_MODE: 'mock', NODE_ENV: 'production' }), 'off');
  assert.equal(payMode({ PAYMENTS_MODE: 'mock', NODE_ENV: 'production', ALLOW_MOCK_PAY: '1' }), 'mock');
});

test('결제수단: 토스페이는 없고, 이니시스 PC·모바일 값이 모두 있음', () => {
  assert.deepEqual(catalog.methods.map((m) => m.id), ['card', 'kakaopay', 'naverpay', 'transfer', 'phone']);
  for (const m of catalog.methods) { assert.ok(m.pc.gopaymethod, m.id); assert.ok(m.mobile.P_INI_PAYMENT, m.id); }
  assert.ok(!JSON.stringify(catalog).toLowerCase().includes('toss'));
});

test('주문번호는 이니시스 규칙(40byte 이하, 영문·숫자·-_)을 지킨다', () => {
  for (let i = 0; i < 50; i += 1) {
    const id = makeOrderId();
    assert.match(id, /^[A-Za-z0-9_-]{6,40}$/);
  }
  assert.equal(makeOrderId(new Date('2026-11-14T16:00:00Z'), 'abc+/def'), 'BM-20261115-abcdef');   // 한국 시각 날짜
});

test('필수 약관을 빠짐없이 동의해야 한다', () => {
  assert.deepEqual(missingTerms(['purchase', 'efinance', 'privacy', 'thirdparty']), []);
  assert.ok(missingTerms(['purchase']).includes('privacy'));
  assert.equal(missingTerms('purchase').length, 4);
});

test('도전권 범위와 기간', () => {
  const now = new Date('2026-11-14T00:00:00Z');
  const { startsAt, expiresAt } = ticketPeriod(30, now);
  assert.equal((expiresAt - startsAt) / 86400000, 30);
  const one = { status: 'active', scope: 'course', courseId: 'seoul-half', startsAt, expiresAt };
  const all = { ...one, scope: 'all', courseId: '' };
  assert.equal(ticketCovers(one, 'seoul-half', now), true);
  assert.equal(ticketCovers(one, 'busan', now), false);
  assert.equal(ticketCovers(all, 'busan', now), true);
  assert.equal(ticketCovers(all, 'busan', new Date('2026-12-15T00:00:00Z')), false);     // 만료
  assert.equal(ticketCovers({ ...all, status: 'refunded' }, 'busan', now), false);       // 환불
});

test('코스 아이디 검사와 주문 이름', () => {
  assert.ok(validCourseId('seoul-gyeongbok-ar'));
  assert.ok(!validCourseId('../etc') && !validCourseId('') && !validCourseId({ $gt: '' }));
  assert.equal(orderName(findProduct('all')), '보물 여행 전체 코스 패스');
  assert.equal(orderName(findProduct('single'), '경복궁'), '보물 여행 1코스 도전권 · 경복궁');
});
