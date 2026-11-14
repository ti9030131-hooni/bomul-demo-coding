// 완주 보상 추첨 규칙 (Express·DB를 모르는 순수 함수) — 테스트: test/draw.test.mjs
import { randomInt } from 'node:crypto';
import DRAW from '../data/draw.json' with { type: 'json' };

export const drawConfig = DRAW;

export const totalPrize = (cfg = DRAW) => cfg.prizes.reduce((t, p) => t + p.amount * p.winners, 0);
export const totalWinners = (cfg = DRAW) => cfg.prizes.reduce((t, p) => t + p.winners, 0);

// 회사가 세금을 대신 내면 상금 ÷ (1 - 세율). 원 단위 올림
export function prizeCost(cfg = DRAW) {
  const sum = totalPrize(cfg);
  return cfg.taxPaidByCompany ? Math.ceil(sum / (1 - (cfg.taxRate ?? 0.22))) : sum;
}

export const isOpen = (cfg = DRAW, now = new Date()) => !cfg.entryClosesAt || now <= new Date(cfg.entryClosesAt);

// 결제 매출에서 부가세(10%)를 뺀 금액과 상금 비용을 견줍니다
export function budgetSummary({ paidAmount = 0, paidCount = 0, entries = 0 } = {}, cfg = DRAW) {
  const cost = prizeCost(cfg);
  const netRevenue = Math.round(paidAmount / 1.1);
  return {
    totalPrize: totalPrize(cfg),
    prizeCost: cost,
    budget: cfg.budget ?? null,
    overBudget: cfg.budget != null && cost > cfg.budget,
    paidCount, paidAmount, netRevenue,
    prizeToRevenue: netRevenue ? Math.round((cost / netRevenue) * 1000) / 10 : null,   // %
    entries,
  };
}

// 공정한 추첨: 응모 목록을 암호학적 난수로 섞은 뒤 1등부터 차례로 뽑습니다(한 사람은 한 번만 당첨)
export function pickWinners(entries, cfg = DRAW, rand = randomInt) {
  const pool = entries.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = rand(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const winners = [];
  let k = 0;
  for (const p of [...cfg.prizes].sort((a, b) => a.rank - b.rank)) {
    for (let n = 0; n < p.winners && k < pool.length; n += 1) winners.push({ entry: pool[k++], rank: p.rank, label: p.label, amount: p.amount });
  }
  return winners;
}

export function publicDraw(cfg = DRAW) {
  return {
    season: cfg.season, title: cfg.title, entryRule: cfg.entryRule, freeEntry: cfg.freeEntry !== false,
    prizes: cfg.prizes.map(({ rank, label, amount, winners }) => ({ rank, label, amount, winners })),
    totalPrize: totalPrize(cfg), entryClosesAt: cfg.entryClosesAt, drawAt: cfg.drawAt, open: isOpen(cfg),
  };
}
