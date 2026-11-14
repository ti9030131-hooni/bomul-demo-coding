#!/usr/bin/env node
// 재미 더하기(숨은 보물 · 보물 도감 · 배지 · 탁본 엽서)를 AR 화면에 넣습니다. 여러 번 실행해도 한 번만 들어갑니다.
//   node tools/fun/patch.mjs            (저장소 맨 위에서)
//   node tools/fun/patch.mjs --check    (바꾸지 않고 들어갈 자리만 확인)
// 바꾸는 곳: client/public/ar/course.html (원본은 course.html.before-fun 으로 백업)
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECK = process.argv.includes('--check');
const FILE = 'client/public/ar/course.html';
const BLOCK = readFileSync(join(HERE, 'snippets/course-fun.js'), 'utf8');
const MARKER = '/* ═════════════════ 재미 더하기';

const STEPS = [
  ['숨은 비석 데이터', '<script src="data/gyeongbok.js"></script>', '<script src="data/gyeongbok.js"></script>\n<script src="data/hidden.js"></script>'],
  ['재미 기능 코드', '/* ───────── 시작 ───────── */', () => BLOCK + '/* ───────── 시작 ───────── */'],
  ['도감 탭', '  tabs.hidden = !["v-map","v-album","v-stop","v-shop"].includes(id);', '  tabs.hidden = !["v-map","v-album","v-stop","v-shop","v-dex"].includes(id);'],
  ['도감 그리기', '  if (id === "v-shop") renderShop();', '  if (id === "v-shop") renderShop();\n  if (id === "v-dex") renderDex();'],
  ['지도에 탐지기', '  if (id === "v-map") renderMap();', '  if (id === "v-map") { renderMap(); renderHidden(); }'],
  ['위치가 바뀌면 탐지기', 'function onGeo(){ if (current === "v-map") renderMap(); if (current === "v-stop") renderStopGeo(); }',
    'function onGeo(){ if (current === "v-map") renderMap(); if (current === "v-stop") renderStopGeo(); funOnGeo(); }'],
  ['탁본 뒤 배지', '  save.done[s.id] = { img: exportRub(true), onsite: AR.onsite, at: Date.now() };\n  persist(); renderIntro();',
    '  save.done[s.id] = { img: exportRub(true), onsite: AR.onsite, at: Date.now() };\n  persist(); renderIntro(); funAfterRub(s);'],
  ['결과 창 엽서 버튼', '탁본첩 보기 (${n}/${N})</button>`}\n    </div>`;',
    '탁본첩 보기 (${n}/${N})</button>`}\n      <button class="btn line" id="gCard">탁본 엽서로 공유하기</button>\n    </div>`;'],
  ['엽서 버튼 연결', '  $("#gAlbum").addEventListener("click", () => { leaveAR(); show("v-album"); });',
    '  $("#gAlbum").addEventListener("click", () => { leaveAR(); show("v-album"); });\n  const gcd = $("#gCard"); if (gcd) { const sid = STOPS[AR.idx].id; gcd.addEventListener("click", () => makePostcardFor(C, sid)); }'],
  ['크게 보기 엽서', 'const s = STOPS[i], d = save.done[s.id]; if (!d) return;', 'const s = STOPS[i], d = save.done[s.id]; if (!d) return;\n  FUN.lb = i;'],
];

if (!existsSync(FILE)) { console.error(`없음: ${FILE} — 저장소 맨 위에서 실행해 주세요.`); process.exit(1); }
let s = readFileSync(FILE, 'utf8');
const bom = s.startsWith('﻿') ? '﻿' : '';
if (bom) s = s.slice(1);
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
if (s.includes(MARKER)) { console.log(`✓ 이미 들어 있음: ${FILE}`); process.exit(0); }
const miss = STEPS.filter(([, a]) => s.split(a).length !== 2).map(([n, a]) => `${n}(${s.split(a).length - 1}곳)`);
if (miss.length) {
  console.log(`✗ 자리를 찾지 못해 그대로 둠: ${FILE} — ${miss.join(', ')}\nCURSOR-PROMPTS-fun.md 의 「F-수동」 프롬프트로 Cursor 에게 맡기세요.`);
  process.exit(2);
}
if (CHECK) { console.log(`○ 넣을 수 있음: ${FILE} (${STEPS.map(([n]) => n).join(' · ')})`); process.exit(0); }
for (const [, a, b] of STEPS) s = s.replace(a, typeof b === 'function' ? b : () => b);
if (!existsSync(`${FILE}.before-fun`)) copyFileSync(FILE, `${FILE}.before-fun`);
if (crlf) s = s.replace(/\n/g, '\r\n');
writeFileSync(FILE, bom + s);
console.log(`✓ 넣었습니다: ${FILE} (${STEPS.map(([n]) => n).join(' · ')})`);
