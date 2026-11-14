// 실행: cd server && node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import seed from '../src/data/legendCourses.json' with { type: 'json' };
import defaults from '../src/data/arDefaults.json' with { type: 'json' };
import { buildArCourse, piecePool, escapeHtml } from '../src/services/arCourse.js';

function asPublic(c, label = 'course') {
  assert.ok(c && typeof c === 'object', `${label} 시드/픽스처가 없습니다`);
  assert.equal(typeof c.id, 'string', `${label} id가 없습니다`);
  return { ...c, id: c.id };
}

function requireSeed(id) {
  const found = seed.find((c) => c.id === id);
  assert.ok(found, `시드에 ${id} 코스가 없습니다`);
  return found;
}

const pool = piecePool(seed);

test('시드에 삭제된 전래(fairy) 코스가 없고 id가 모두 있다', () => {
  assert.equal(seed.some((c) => c.id === 'fairy' || c.region === '전래'), false);
  for (const c of seed) {
    assert.equal(typeof c.id, 'string');
    assert.ok(c.id.length > 0, '빈 id');
  }
  assert.equal(new Set(seed.map((c) => c.id)).size, seed.length, '시드 id 중복');
});

test('모든 시드 코스가 AR 코스로 변환된다', () => {
  for (const c of seed) {
    const ar = buildArCourse(asPublic(c, c.id), { pool, settings: defaults });
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
  const g = requireSeed('seoul-gyeongbok-ar');
  const ar = buildArCourse(asPublic(g, 'seoul-gyeongbok-ar'), { pool, settings: defaults });
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
  const ar = buildArCourse(asPublic(requireSeed('seoul'), 'seoul'), { pool, settings: defaults });
  assert.equal(ar.final.prizes.find((p) => p.icon === 'point')?.points, 10000);
});

test('관리자가 넣은 수수께끼가 자동 문항보다 우선한다', () => {
  const c = structuredClone(requireSeed('seoul'));
  c.stops[1].ar = { q: '세검정에서 칼을 씻은 사건은?', opts: ['인조반정', '임진왜란', '병자호란'], a: 0, cert: '직접 쓴 증명서 문구' };
  const ar = buildArCourse(c, { pool });
  assert.equal(ar.stops[1].q, '세검정에서 칼을 씻은 사건은?');
  assert.deepEqual(ar.stops[1].opts, ['인조반정', '임진왜란', '병자호란']);
  assert.equal(ar.stops[1].a, 0);
  assert.equal(ar.stops[1].cert, '직접 쓴 증명서 문구');
});

test('정답 번호가 잘못된 수수께끼는 무시하고 자동 문항으로 돌아간다', () => {
  const c = structuredClone(requireSeed('seoul'));
  c.stops[0].ar = { q: '틀린 설정', opts: ['가', '나'], a: 5 };
  const ar = buildArCourse(c, { pool });
  assert.notEqual(ar.stops[0].q, '틀린 설정');
  assert.equal(ar.stops[0].opts[ar.stops[0].a], ar.stops[0].piece);
});

test('좌표가 없어도 데모용으로 변환되고 이름이 겹치지 않는다', () => {
  // 전래(fairy) 시드는 사이트에서 삭제됐으므로, 좌표 없는 픽스처로 같은 규칙을 검증한다.
  const fixture = {
    id: 'no-coords-demo',
    region: '기타',
    theme: '데모',
    title: '좌표 없는 데모 코스',
    summary: '현장 좌표 없이 데모로만 도는 코스',
    stops: [
      { where: '첫째 마당', name: '호랑이', desc: '산에서 나온 호랑이 이야기.' },
      { where: '둘째 마당', name: '토끼', desc: '지혜로운 토끼 이야기.' },
      { where: '셋째 마당', name: '도깨비', desc: '방망이를 든 도깨비 이야기.' },
    ],
  };
  const ar = buildArCourse(asPublic(fixture, 'no-coords-demo'), { pool });
  assert.ok(ar);
  assert.equal(ar.center, null);
  assert.equal(new Set(ar.stops.map((s) => s.name)).size, ar.stops.length);
  assert.ok(ar.stops.every((s) => s.name !== s.piece), '비석 이름에 정답이 드러나면 안 됨');
});

test('관리자 글의 HTML은 그대로 실행되지 않는다', () => {
  const c = structuredClone(requireSeed('seoul'));
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
