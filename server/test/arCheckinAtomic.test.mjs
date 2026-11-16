import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendCheckinAtomic,
  createMemoryProgressRepo,
} from '../src/services/arCheckin.js';
import { isCourseOnsiteComplete, completionRewardPoints } from '../src/services/arOnsite.js';

const userId = 'user-1';
const courseId = 'seoul-gyeongbok-ar';
const stopIds = ['gwanghwa', 'geunjeong', 'gyeonghoe', 'amisan', 'hyangwon'];

function entry(stopId, at = Date.now()) {
  return { stopId, lat: 37.58, lng: 126.977, accuracy: 15, at: new Date(at) };
}

test('같은 장소 반복 checkin은 한 번만 기록되고 already=true', async () => {
  const repo = createMemoryProgressRepo();
  const first = await appendCheckinAtomic(repo, {
    userId,
    courseId,
    stopId: 'gwanghwa',
    entry: entry('gwanghwa', 1),
  });
  const second = await appendCheckinAtomic(repo, {
    userId,
    courseId,
    stopId: 'gwanghwa',
    entry: entry('gwanghwa', 2),
  });
  assert.equal(first.already, false);
  assert.equal(second.already, true);
  assert.equal(first.progress.checkins.filter((c) => c.stopId === 'gwanghwa').length, 1);
  assert.equal(second.progress.checkins.filter((c) => c.stopId === 'gwanghwa').length, 1);
});

test('같은 장소 동시 checkin은 중복 없이 1건만 남는다', async () => {
  const repo = createMemoryProgressRepo({ concurrent: true });
  const results = await Promise.all([
    appendCheckinAtomic(repo, { userId, courseId, stopId: 'gwanghwa', entry: entry('gwanghwa', 10) }),
    appendCheckinAtomic(repo, { userId, courseId, stopId: 'gwanghwa', entry: entry('gwanghwa', 11) }),
    appendCheckinAtomic(repo, { userId, courseId, stopId: 'gwanghwa', entry: entry('gwanghwa', 12) }),
  ]);
  const doc = await repo.findOne({ user: userId, courseId });
  assert.equal(doc.checkins.filter((c) => c.stopId === 'gwanghwa').length, 1);
  assert.equal(results.filter((r) => !r.already).length, 1);
  assert.equal(results.filter((r) => r.already).length, 2);
});

test('5개 장소 순차 인증 후 완주이며 데모(빈 checkins)는 미완주', async () => {
  const repo = createMemoryProgressRepo();
  assert.equal(isCourseOnsiteComplete(stopIds, []), false);
  for (const [i, stopId] of stopIds.entries()) {
    const result = await appendCheckinAtomic(repo, {
      userId,
      courseId,
      stopId,
      entry: entry(stopId, i + 1),
    });
    assert.equal(result.already, false);
  }
  const doc = await repo.findOne({ user: userId, courseId });
  assert.equal(isCourseOnsiteComplete(stopIds, doc.checkins), true);
  assert.equal(completionRewardPoints({ title: '경복궁 AR', stops: stopIds.map(() => ({})), duration: '약 90분' }), 500);
});

test('500P 지급 필터는 코스당 한 번만 통과한다(재시도·연속 요청)', () => {
  const course = 'seoul-gyeongbok-ar';
  function tryPay(wallet) {
    if ((wallet.completions || []).some((c) => c.courseId === course)) {
      return { awarded: false, points: wallet.points };
    }
    return {
      awarded: true,
      points: wallet.points + 500,
      completions: [...(wallet.completions || []), { courseId: course, earned: 500 }],
    };
  }
  let wallet = { points: 0, completions: [] };
  const a = tryPay(wallet);
  wallet = { points: a.points, completions: a.completions };
  const b = tryPay(wallet);
  assert.equal(a.awarded, true);
  assert.equal(b.awarded, false);
  assert.equal(wallet.points, 500);
});
