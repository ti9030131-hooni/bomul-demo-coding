#!/usr/bin/env node
// 「재미 더하기」가 제대로 들어갔는지 확인 — 저장소 맨 위에서:  node _fun_kit/check.mjs
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const F = 'client/public/ar/course.html';
const t = existsSync(F) ? readFileSync(F, 'utf8') : '';
const ok = [], bad = [];
const has = (s, label) => (t.includes(s) ? ok : bad).push(label);
has('<script src="data/hidden.js"></script>', '숨은 비석 데이터 불러오기');
has('function renderHidden()', '숨은 보물 탐지기');
has('function openHiddenRub()', '금빛 비석 문지르기');
has('function renderDex()', '보물 도감');
has('"v-shop","v-dex"]', '도감 탭 표시');
has('const BADGES = [', '배지');
has('funAfterRub(s);', '탁본 뒤 배지 확인');
has('async function makePostcardFor(', '탁본 엽서');
has('id="gCard"', '결과 창 엽서 버튼');
has('FUN.lb = i;', '크게 보기 엽서 버튼');
(existsSync('client/public/ar/data/hidden.js') ? ok : bad).push('파일 ar/data/hidden.js');
// AR 화면 스크립트 문법 확인
const m = t.match(/<script>\n\(async \(\) => \{[\s\S]*?\n\}\)\(\);\n<\/script>/);
if (m) {
  const dir = mkdtempSync(join(tmpdir(), 'fun-')), f = join(dir, 'ar.js');
  writeFileSync(f, m[0].replace(/^<script>|<\/script>$/g, ''));
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  (r.status === 0 ? ok : bad).push('AR 화면 스크립트 문법');
  if (r.status) console.log(r.stderr.split('\n').slice(0, 6).join('\n'));
} else bad.push('AR 화면 스크립트를 찾지 못함');
console.log(ok.map((x) => `✓ ${x}`).join('\n'));
if (bad.length) console.log(bad.map((x) => `✗ ${x}`).join('\n'));
console.log(`\n${bad.length ? `확인 필요 ${bad.length}건` : '모두 통과'} — 통과 ${ok.length}`);
process.exit(bad.length ? 1 : 0);
