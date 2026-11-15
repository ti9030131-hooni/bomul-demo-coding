// 실행: cd server && node --test test/arOnsite.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeOnsiteCheckin, isCourseOnsiteComplete, sumPrizePoints, completionRewardPoints } from '../src/services/arOnsite.js';

const GYEONGBOK = { id: 's1', lat: 37.5796, lng: 126.977 };
const CHANGUI = { id: 's2', lat: 37.5926, lng: 126.966 };

function sample(overrides = {}) {
  return {
    lat: GYEONGBOK.lat,
    lng: GYEONGBOK.lng,
    accuracy: 12,
    at: Date.UTC(2026, 10, 14, 3, 0, 0),
    ...overrides,
  };
}

test('장소 반경 안이고 GPS 정확도가 충분하면 현장 인증이다', () => {
  const result = judgeOnsiteCheckin({ stop: GYEONGBOK, sample: sample(), onsiteRadius: 120 });
  assert.equal(result.ok, true);
  assert.ok(result.distanceM < 20);
});

test('장소에서 멀리 떨어지면 현장 인증이 아니다', () => {
  const result = judgeOnsiteCheckin({
    stop: GYEONGBOK,
    sample: sample({ lat: 37.55, lng: 126.99 }),
    onsiteRadius: 120,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'far');
});

test('GPS 정확도가 80m보다 크면 현장 인증이 아니다', () => {
  const result = judgeOnsiteCheckin({
    stop: GYEONGBOK,
    sample: sample({ accuracy: 120 }),
    onsiteRadius: 120,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'accuracy');
});

test('이전 장소 인증 후 1분 안에 다음 장소를 보내면 거절한다', () => {
  const at = Date.UTC(2026, 10, 14, 3, 0, 30);
  const result = judgeOnsiteCheckin({
    stop: CHANGUI,
    sample: sample({ lat: CHANGUI.lat, lng: CHANGUI.lng, at }),
    previous: { stopId: 's1', lat: GYEONGBOK.lat, lng: GYEONGBOK.lng, at: at - 20_000 },
    onsiteRadius: 120,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'too-fast');
});

test('이전 장소에서 시속 150km가 넘게 이동하면 거절한다', () => {
  const at = Date.UTC(2026, 10, 14, 3, 2, 0);
  const result = judgeOnsiteCheckin({
    stop: { id: 'busan', lat: 35.1796, lng: 129.0756 },
    sample: sample({ lat: 35.1796, lng: 129.0756, at }),
    previous: { stopId: 's1', lat: GYEONGBOK.lat, lng: GYEONGBOK.lng, at: at - 5 * 60_000 },
    onsiteRadius: 120,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'teleport');
});

test('좌표가 없는 장소는 현장 인증할 수 없다', () => {
  const result = judgeOnsiteCheckin({
    stop: { id: 's1', lat: null, lng: null },
    sample: sample(),
    onsiteRadius: 120,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no-coords');
});

test('모든 장소를 현장에서 찍어야 완주이다', () => {
  assert.equal(isCourseOnsiteComplete(['s1', 's2'], [{ stopId: 's1' }, { stopId: 's2' }]), true);
  assert.equal(isCourseOnsiteComplete(['s1', 's2'], [{ stopId: 's1' }]), false);
  assert.equal(isCourseOnsiteComplete([], []), false);
});

test('완주 적립금은 상품의 points만 합친다', () => {
  assert.equal(sumPrizePoints([{ points: 100000 }, { title: '증명서' }, { points: 0 }]), 100000);
});

test('짧은 코스 완주 적립금은 500P이다', () => {
  assert.equal(completionRewardPoints({ title: '한양 도성 반나절', stops: [{}, {}, {}] }), 500);
  assert.equal(completionRewardPoints({ title: '제주 신화 기행', stops: [{}, {}, {}] }), 500);
  assert.equal(completionRewardPoints({ title: '경복궁 AR', stops: [{}, {}, {}, {}, {}], duration: '약 90분' }), 500);
});

test('긴 코스 완주 적립금도 500P이다', () => {
  assert.equal(completionRewardPoints({ title: '한양 도성 보물길', stops: [{}, {}, {}, {}, {}, {}] }), 500);
  assert.equal(completionRewardPoints({ title: '정조의 효심, 화성 보물길', stops: [{}, {}, {}, {}, {}] }), 500);
});
