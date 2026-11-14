import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetSummary, drawConfig, isOpen, pickWinners, prizeCost, totalPrize, totalWinners } from '../src/services/draw.js';

test('상금 합계와 세금을 회사가 낼 때의 실제 비용', () => {
  assert.equal(totalPrize(), 3000000);                                     // 1·2·3등 150·100·50만 원
  assert.equal(totalWinners(), 3);
  assert.equal(prizeCost(), Math.ceil(3000000 / 0.78));                   // 3,846,154원
  assert.equal(prizeCost({ ...drawConfig, taxPaidByCompany: false }), 3000000);
  assert.equal(drawConfig.freeEntry, true);                                 // 무료 응모 경로
  assert.ok(prizeCost() <= drawConfig.budget, '기본 예산 안에 들어와야 함');
});

test('예산 요약: 부가세를 뺀 매출 대비 상금 비율, 예산 초과 경고', () => {
  const s = budgetSummary({ paidAmount: 8800000, paidCount: 1100, entries: 900 });
  assert.equal(s.netRevenue, 8000000);
  assert.equal(s.prizeToRevenue, 48.1);
  assert.equal(s.overBudget, false);
  assert.equal(budgetSummary({}, { ...drawConfig, budget: 3000000 }).overBudget, true);
  assert.equal(budgetSummary({}).prizeToRevenue, null);
});

test('응모 마감', () => {
  assert.equal(isOpen({ entryClosesAt: '2027-02-28T23:59:59+09:00' }, new Date('2027-02-28T14:00:00Z')), true);
  assert.equal(isOpen({ entryClosesAt: '2027-02-28T23:59:59+09:00' }, new Date('2027-02-28T15:00:00Z')), false);
});

test('추첨: 한 사람은 한 번만 당첨, 응모가 적으면 있는 만큼만, 1등부터', () => {
  const entries = Array.from({ length: 50 }, (_, i) => ({ id: i }));
  const w = pickWinners(entries);
  assert.deepEqual(w.map((x) => x.rank), [1, 2, 3]);
  assert.equal(new Set(w.map((x) => x.entry.id)).size, 3);
  assert.equal(pickWinners([{ id: 'a' }]).length, 1);
  assert.equal(pickWinners([{ id: 'a' }])[0].rank, 1);
  // 난수가 고르게 쓰이는지: 각 응모자가 1등이 되는 횟수가 크게 치우치지 않음
  const hits = new Map();
  for (let n = 0; n < 4000; n += 1) { const id = pickWinners([{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }])[0].entry.id; hits.set(id, (hits.get(id) || 0) + 1); }
  for (const v of hits.values()) assert.ok(v > 850 && v < 1150, `치우침 ${v}`);
});
