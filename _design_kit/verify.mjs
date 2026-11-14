#!/usr/bin/env node
/* 새 메인 디자인 · 새 코스 지도 적용 확인  —  node _design_kit/verify.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const KIT = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(KIT, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(KIT, 'manifest.json'), 'utf8'));
const read = (r) => { const p = path.join(ROOT, r); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; };
const res = []; const ok = (n, p, h = '') => res.push({ n, p: !!p, h });
const html = read('client/public/bomul.html');
const missing = manifest.files.filter((f) => !fs.existsSync(path.join(ROOT, f.path))).map((f) => f.path);
ok('키트 파일이 모두 있음', !missing.length, missing.join(', '));
const left = manifest.files.flatMap((f) => ['.design-new', '.design-merge'].map((x) => f.path + x)).filter((p) => fs.existsSync(path.join(ROOT, p)));
ok('충돌 보조 파일이 남아 있지 않음', !left.length, left.join(', '));
ok('충돌 표시(<<<<<<< ======= >>>>>>>)가 없음', !/^(<{7}|>{7}|={7})( |$)/m.test(html));
ok('맨 위 띠 · 히어로 "보물을 찾아라"', html.includes('class="promo-bar"') && html.includes('보물을 찾아라') && html.includes('img/hero-chest.webp'));
ok('히어로 바로 아래 AR 탁본 → 바로가기 탭 순서', (() => { const i = ['class="bf-hero"', 'id="ar-takbon"', 'class="bf-tabs"', 'id="bf-reward"'].map((x) => html.indexOf(x)); return i.every((v) => v > 0) && i.join() === [...i].sort((a, b) => a - b).join(); })());
ok('총 완주 보상 · 한눈에 보기 · 다음 시즌(카운트다운+그리스 신화)', html.includes('총 <em>완주 보상</em>') && html.includes('id="bf-glance"') && html.indexOf('id="countdown"') > html.indexOf('id="bf-next"'));
ok('별 배경(starfield) 켜짐', html.includes('startStarfield();') && !html.includes('.starfield{display:none}'));
ok('카운트다운 날짜 상수', /const SEASON2_OPEN_AT = "[^"]+"/.test(html), '예시 날짜이면 실제 공개일로 바꾸세요');
ok('기존 기능 유지(코스 목록·상세·신청·로그인 연결)', ['id="view-courses"', 'id="view-course"', 'id="applyForm"', 'function renderDetail', 'function applyRemoteCourses', 'id="featured"'].every((x) => html.includes(x)));
ok('반나절 코스가 자기 지도를 씀', html.includes('"seoul-half":"img/route-seoul-half.jpg"') && html.includes('"seoul-gangdong-half":"img/route-seoul-gangdong-half.jpg"'));
const imgs = (html.match(/img\/route-[a-z0-9-]+\.jpg/g) || []);
const noImg = [...new Set(imgs)].filter((p) => !fs.existsSync(path.join(ROOT, 'client/public', p)));
ok('지도 이미지 파일이 모두 있음', !noImg.length, noImg.join(', '));
let f = 0; console.log('\n새 메인 디자인 · 새 코스 지도 확인\n');
for (const r of res) { if (!r.p) f++; console.log(`${r.p ? '통과' : '실패'}  ${r.n}${!r.p && r.h ? `\n      → ${r.h}` : ''}`); }
console.log(`\n${res.length - f}/${res.length} 통과`); process.exit(f ? 1 : 0);
