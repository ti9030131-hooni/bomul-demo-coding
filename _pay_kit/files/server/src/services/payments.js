// 결제 규칙 (Express·DB를 모르는 순수 함수) — 테스트: test/payments.test.mjs
import { randomBytes } from 'node:crypto';
import CATALOG from '../data/payProducts.json' with { type: 'json' };

export const catalog = CATALOG;
export const findProduct = (id) => CATALOG.products.find((p) => p.id === id) || null;
export const findMethod = (id) => CATALOG.methods.find((m) => m.id === id) || null;
export const requiredTerms = () => CATALOG.terms.filter((t) => t.required).map((t) => t.id);

// 결제 방식: PAYMENTS_MODE=inicis (KG이니시스) | mock (개발용 가짜 결제) | 그 밖 = off(결제 없이 모두 도전 가능)
//  · inicis: INICIS_ENV=prod 면 INICIS_MID·INICIS_SIGNKEY 가 꼭 있어야 하고, 아니면(테스트) 이니시스 공개 테스트 상점으로 동작합니다.
//  · 운영 서버(NODE_ENV=production)에서 테스트 결제·가짜 결제는 ALLOW_TEST_PAY=1 / ALLOW_MOCK_PAY=1 이 없으면 꺼집니다.
//    (테스트 결제는 돈이 나가지 않는데 도전권이 생기기 때문)
export function payMode(env = process.env) {
  const mode = String(env.PAYMENTS_MODE || 'off').toLowerCase();
  const production = env.NODE_ENV === 'production';
  if (mode === 'inicis') {
    if (env.INICIS_ENV === 'prod') return env.INICIS_MID && env.INICIS_SIGNKEY ? 'inicis' : 'off';
    return production && env.ALLOW_TEST_PAY !== '1' ? 'off' : 'inicis';
  }
  if (mode === 'mock') return production && env.ALLOW_MOCK_PAY !== '1' ? 'off' : 'mock';
  return 'off';
}
export const isTestPay = (env = process.env) => payMode(env) === 'inicis' && env.INICIS_ENV !== 'prod';

export const validCourseId = (id) => typeof id === 'string' && /^[a-z0-9-]{1,60}$/.test(id);

export function makeOrderId(now = new Date(), rand = randomBytes(9).toString('base64url')) {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
  return `BM-${kst}-${rand.replace(/[^A-Za-z0-9_-]/g, '')}`.slice(0, 64);    // 토스 규칙: 6~64자, 영문·숫자·-_=
}

export function orderName(product, courseTitle) {
  return product.scope === 'all' ? `보물 여행 ${product.name}` : `보물 여행 ${product.name} · ${courseTitle || ''}`.trim().slice(0, 100);
}

export function missingTerms(agreed) {
  const set = new Set(Array.isArray(agreed) ? agreed : []);
  return requiredTerms().filter((id) => !set.has(id));
}

// 이 도전권으로 이 코스를 할 수 있는가
export function ticketCovers(ticket, courseId, now = new Date()) {
  if (!ticket || ticket.status !== 'active') return false;
  if (new Date(ticket.startsAt) > now || new Date(ticket.expiresAt) <= now) return false;
  return ticket.scope === 'all' || ticket.courseId === courseId;
}

export function ticketPeriod(days, now = new Date()) {
  return { startsAt: now, expiresAt: new Date(now.getTime() + days * 86400 * 1000) };
}
