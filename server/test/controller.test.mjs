import { test } from 'node:test';
import assert from 'node:assert/strict';
import { _internal } from '../src/controllers/legendCourses.js';
const { readBody, keepMissing, stripFlags } = _internal;
const current = {
  ar: { enabled: true, place: '한양 도성', finalName: '직접 정한 인장' },
  stops: [
    { where: '보물 1 · 경복궁', name: '경회루의 용', desc: 'a', addr: '', lat: 37.5, lng: 127, ar: { q: 'Q', opts: ['가','나'], a: 1 } },
    { where: '보물 2 · 숭례문', name: '세로 현판', desc: 'b', addr: '', lat: 37.56, lng: 126.97, ar: {} },
  ],
};
const base = { region: '서울', theme: 't', title: 'T', summary: 's' };

test('예전 관리자 화면(좌표·AR 없음)으로 저장해도 기존 좌표와 AR 설정이 남는다', () => {
  const body = { ...base, stops: [
    { where: '보물 2 · 숭례문', name: '세로 현판', desc: 'b2', addr: '' },   // 순서를 바꿈
    { where: '보물 1 · 경복궁', name: '경회루의 용', desc: 'a2', addr: '' },
    { where: '보물 3 · 새 장소', name: '새 이야기', desc: 'c', addr: '' },
  ] };
  const next = stripFlags(keepMissing(readBody(body), current));
  assert.equal(next.stops[0].lat, 37.56);
  assert.equal(next.stops[1].lat, 37.5);
  assert.deepEqual(next.stops[1].ar.opts, ['가','나']);
  assert.equal(next.stops[2].lat, null);
  assert.equal(next.ar.finalName, '직접 정한 인장');
  assert.ok(!('_hasGeo' in next.stops[0]) && !('_hasAr' in next));
});

test('새 관리자 화면이 보낸 좌표·AR 값은 그대로 저장된다(비우기 포함)', () => {
  const body = { ...base, ar: { place: '서울', onsiteRadius: '150' }, stops: [
    { where: '보물 1 · 경복궁', name: '경회루의 용', desc: 'a', lat: '', lng: '', ar: { q: '', opts: [] } },
  ] };
  const next = stripFlags(keepMissing(readBody(body), current));
  assert.equal(next.stops[0].lat, null);
  assert.deepEqual(next.stops[0].ar.opts, []);
  assert.equal(next.ar.place, '서울');
  assert.equal(next.ar.onsiteRadius, 150);
});

test('잘못된 값은 400 오류', () => {
  assert.throws(() => readBody({ ...base, stops: [{ where: 'x', lat: 200 }] }), /숫자 범위/);
  assert.throws(() => readBody({ ...base, stops: [{ where: 'x', ar: { q: 'q', opts: ['a','b'], a: 3 } }] }), /정답 번호/);
});
