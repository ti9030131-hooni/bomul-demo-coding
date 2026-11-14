// 실행: cd server && node --test test/arLeaderboard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elapsedFromCheckins, rankWeekly, seoulWeekRange } from '../src/services/arLeaderboard.js';

test('서울 시간 이번 주는 월요일 0시부터 다음 월요일 0시 전이다', () => {
  const now = new Date('2026-11-14T03:50:00.000Z');
  const week = seoulWeekRange(now);
  assert.equal(week.start.toISOString(), '2026-11-08T15:00:00.000Z');
  assert.equal(week.end.toISOString(), '2026-11-15T15:00:00.000Z');
  assert.match(week.label, /11\/9/);
  assert.match(week.label, /11\/15/);
});

test('일요일 밤도 같은 주에 포함되고 다음 월요일 0시는 빠진다', () => {
  const sunday = seoulWeekRange(new Date('2026-11-15T14:00:00.000Z'));
  const nextMonday = seoulWeekRange(new Date('2026-11-15T15:00:00.000Z'));
  assert.equal(sunday.start.toISOString(), '2026-11-08T15:00:00.000Z');
  assert.equal(nextMonday.start.toISOString(), '2026-11-15T15:00:00.000Z');
});

test('소요 시간은 가장 이른 현장 인증부터 완주 시각까지다', () => {
  const ms = elapsedFromCheckins(
    [{ at: '2026-11-14T05:00:00.000Z' }, { at: '2026-11-14T04:00:00.000Z' }],
    '2026-11-14T06:30:00.000Z',
  );
  assert.equal(ms, 150 * 60 * 1000);
});

test('현장 인증이 없으면 순위에 넣지 않는다', () => {
  assert.equal(elapsedFromCheckins([], '2026-11-14T06:30:00.000Z'), null);
});

test('이번 주 순위는 완주 시간이 짧은 순이다', () => {
  const rows = rankWeekly([
    { nickname: '느린이', elapsedMs: 90 * 60 * 1000, finishedAt: '2026-11-14T06:00:00.000Z' },
    { nickname: '빠른이', elapsedMs: 40 * 60 * 1000, finishedAt: '2026-11-14T08:00:00.000Z' },
    { nickname: '중간', elapsedMs: 70 * 60 * 1000, finishedAt: '2026-11-14T05:00:00.000Z' },
  ]);
  assert.deepEqual(rows.map((row) => row.nickname), ['빠른이', '중간', '느린이']);
  assert.deepEqual(rows.map((row) => row.rank), [1, 2, 3]);
});

test('같은 시간이면 먼저 완주한 사람이 위다', () => {
  const rows = rankWeekly([
    { nickname: '나중', elapsedMs: 1000, finishedAt: '2026-11-14T07:00:00.000Z' },
    { nickname: '먼저', elapsedMs: 1000, finishedAt: '2026-11-14T06:00:00.000Z' },
  ]);
  assert.equal(rows[0].nickname, '먼저');
  assert.equal(rows[1].rank, 2);
});
