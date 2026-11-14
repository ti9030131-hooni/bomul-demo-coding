// 실행: cd server && node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import seed from '../src/data/legendCourses.json' with { type: 'json' };
import defaults from '../src/data/arDefaults.json' with { type: 'json' };
import { buildArCourse, piecePool, escapeHtml } from '../src/services/arCourse.js';

const asPublic = (c) => ({ ...c, id: c.id });
const pool = piecePool(seed);

test('모든 시드 코스가 AR 코스로 변환된다', () => {
  for (const c of seed) {
    const ar = buildArCourse(asPublic(c), { pool, settings: defaults });
    assert.ok(ar, c.id);
    assert.equal(ar.stops.length, c.stops.length, c.id);
    for (const s of ar.stops) {
      assert.ok(s.opts.length >= 2, `${c.id} 보기 수`);
      assert.ok(s.a >= 0 && s.a < s.opts.length, `${c.id} 정답 번호`);
      assert.equal(new Set(s.opts).size, s.opts.length, `${c.id} 보기 중복`);
      assert.ok(s.name && s.piece && s.mark, `${c.id} 이름`);
    }
    assert.ok(ar.final.prizes.length && ar.pointShop.length, `${c.id} 상품`);
  }
});

test('경복궁 코스는 손질한 문항·아이디·저장 키를 그대로 쓴다', () => {
  const g = seed.find((c) => c.id === 'seoul-gyeongbok-ar');
  const ar = buildArCourse(asPublic(g), { pool, settings: defaults });
  assert.equal(ar.storageKey, 'bomul-gbg-v1');
  assert.deepEqual(ar.stops.map((s) => s.id), ['gwanghwa', 'geunjeong', 'gyeonghoe', 'amisan', 'hyangwon']);
  assert.equal(ar.stops[0].opts[ar.stops[0].a], '해치');
  assert.match(ar.stops[0].restore, /gwanghwa-before/);
  assert.equal(ar.stops[0].restoreYear, '1592년 이전');
  assert.match(ar.stops[4].restore, /hyangwon-1887/);
  assert.equal(ar.stops[4].restoreYear, '1887');
  assert.equal(ar.final.name, '진화부');
  assert.equal(ar.text.h1, '경복궁, 불을 막는<br>다섯 부적');
  assert.equal(ar.text.unit, '부적');
  assert.equal(ar.final.prizes.find((p) => p.icon === 'point')?.points, 5000);
});

test('긴 코스 완주 적립금은 1만 원으로 표시된다', () => {
  const ar = buildArCourse(asPublic(seed.find((c) => c.id === 'seoul')), { pool, settings: defaults });
  assert.equal(ar.final.prizes.find((p) => p.icon === 'point')?.points, 10000);
});

test('관리자가 넣은 수수께끼가 자동 문항보다 우선한다', () => {
  const c = structuredClone(seed.find((x) => x.id === 'seoul'));
  c.stops[1].ar = { q: '세검정에서 칼을 씻은 사건은?', opts: ['인조반정', '임진왜란', '병자호란'], a: 0, cert: '직접 쓴 증명서 문구' };
  const ar = buildArCourse(c, { pool });
  assert.equal(ar.stops[1].q, '세검정에서 칼을 씻은 사건은?');
  assert.deepEqual(ar.stops[1].opts, ['인조반정', '임진왜란', '병자호란']);
  assert.equal(ar.stops[1].a, 0);
  assert.equal(ar.stops[1].cert, '직접 쓴 증명서 문구');
});

test('정답 번호가 잘못된 수수께끼는 무시하고 자동 문항으로 돌아간다', () => {
  const c = structuredClone(seed.find((x) => x.id === 'seoul'));
  c.stops[0].ar = { q: '틀린 설정', opts: ['가', '나'], a: 5 };
  const ar = buildArCourse(c, { pool });
  assert.notEqual(ar.stops[0].q, '틀린 설정');
  assert.equal(ar.stops[0].opts[ar.stops[0].a], ar.stops[0].piece);
});

test('좌표가 없어도(전래동화) 데모용으로 변환되고 이름이 겹치지 않는다', () => {
  const ar = buildArCourse(asPublic(seed.find((x) => x.id === 'fairy')), { pool });
  assert.equal(ar.center, null);
  assert.equal(new Set(ar.stops.map((s) => s.name)).size, ar.stops.length);
  assert.ok(ar.stops.every((s) => s.name !== s.piece), '비석 이름에 정답이 드러나면 안 됨');
});

test('관리자 글의 HTML은 그대로 실행되지 않는다', () => {
  const c = structuredClone(seed.find((x) => x.id === 'seoul'));
  c.summary = '<img src=x onerror=alert(1)>';
  c.ar = { ...c.ar, h1: '<script>x</script>' };
  const ar = buildArCourse(c, { pool });
  assert.ok(!ar.text.h1.includes('<script>'));
  assert.ok(!ar.text.story[0].includes('<img'));
  assert.equal(escapeHtml('<b>'), '&lt;b&gt;');
});

test('경유지가 하나도 없으면 null', () => {
  assert.equal(buildArCourse({ id: 'x', title: 'x', region: 'x', stops: [] }), null);
});
