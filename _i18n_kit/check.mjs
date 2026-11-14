#!/usr/bin/env node
/*
 * 다국어 · 서버 완주 인증 적용 확인
 *   node _i18n_kit/check.mjs           → 파일·연결 확인 + 번역 파일 다시 만들기(tools/i18n/build.cjs)
 *   node _i18n_kit/check.mjs --server  → 서버 완주 인증 연결까지 확인
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = process.argv.includes('--server');
const read = (r) => { const p = path.join(ROOT, r); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; };
const has = (r, ...xs) => { const s = read(r); return !!s && xs.every((x) => (x instanceof RegExp ? x.test(s) : s.includes(x))); };
const res = [];
const ok = (name, pass, hint = '') => res.push({ name, pass: !!pass, hint });

ok('번역 원본(en·zh)', ['en', 'zh'].every((l) => ['courses', 'stories', 'details', 'eats'].every((n) => fs.existsSync(path.join(ROOT, `tools/i18n/lang/${l}/${n}.json`)))));
const b = spawnSync(process.execPath, ['tools/i18n/build.cjs'], { cwd: ROOT, encoding: 'utf8' });
const out = (b.stdout || '') + (b.stderr || '');
ok('번역 파일 만들기(build.cjs)', b.status === 0, out.split('\n').slice(0, 6).join('\n'));
const cov = [...out.matchAll(/(정적|서버) AR (\d+)\/(\d+)/g)];
ok('AR 칸이 모두 번역됨', cov.length && cov.every((m) => m[2] === m[3]), cov.map((m) => m[0]).join(', '));
if (b.status === 0) console.log(out.split('\n').filter((l) => /사전/.test(l)).join('\n'));
ok('i18n.js', has('client/public/i18n/i18n.js', 'window.BomulI18n', 'localizeAr'));
ok('bomul.html: i18n.js 불러옴', has('client/public/bomul.html', '/i18n/i18n.js'));
ok('bomul.html: 네비바 언어 탭', has('client/public/bomul.html', 'lang-tabs', 'tabsHtml') || has('client/public/bomul.html', 'lang-tabs', 'data-lang="en"'));
ok('bomul.html: 코스·이야기·상세·맛집 번역 적용', has('client/public/bomul.html', 'BomulI18n.course(', 'BomulI18n.story(', 'BomulI18n.details(', 'BomulI18n.eats('));
ok('bomul.html: 화면 문구 키(data-i18n) 사용', (read('client/public/bomul.html').match(/data-i18n/g) || []).length >= 40, `개수 ${(read('client/public/bomul.html').match(/data-i18n/g) || []).length}`);
ok('bomul.html: 영어·중국어 화면 문구 등록', has('client/public/bomul.html', "addUI('en'") || has('client/public/bomul.html', 'addUI("en"') || has('client/public/i18n/ui-site.js', "addUI('en'") || has('client/public/i18n/ui-site.js', 'addUI("en"'));
ok('course.html: i18n.js 불러옴', has('client/public/ar/course.html', '../i18n/i18n.js'));
ok('course.html: AR 데이터 번역(localizeAr)', has('client/public/ar/course.html', 'BomulI18n.localizeAr('));
ok('course.html: 언어 탭', has('client/public/ar/course.html', 'tabsHtml') || has('client/public/ar/course.html', 'data-lang="en"'));
const leftover = (read('client/public/ar/course.html').split('<script>').slice(-1)[0] || '').split('\n').filter((l) => /[가-힣]/.test(l) && !/^\s*(\/\/|\/\*|\*)/.test(l) && !/addUI\(|ko\s*:|['"]ko['"]/.test(l)).length;
ok('course.html: 스크립트 안 한국어 줄이 거의 없음(주석·ko 사전 제외)', leftover < 25, `남은 줄 ${leftover} (ko 사전 객체 안이면 괜찮음)`);
if (SERVER) {
  ok('모델 ArCheckin·ArCompletion·ArWallet', ['ArCheckin', 'ArCompletion', 'ArWallet'].every((m) => fs.existsSync(path.join(ROOT, `server/src/models/${m}.js`))));
  ok('API 경로', has('server/src/routes/ar.js', "'/checkins'", "'/complete'", "'/certificates/:certNo'", "'/wallet'", "'/exchange'"));
  ok('공개 확인 페이지 ar/verify.html', fs.existsSync(path.join(ROOT, 'client/public/ar/verify.html')));
  ok('course.html이 서버 완주 API를 씀', has('client/public/ar/course.html', '/api/ar/checkins', '/api/ar/complete'));
  ok('관리자 완주 인증 화면', has('client/src/App.jsx', 'ar-completions'));
  const t = fs.existsSync(path.join(ROOT, 'server/node_modules/mongoose')) ? spawnSync(process.execPath, ['--test'], { cwd: path.join(ROOT, 'server'), encoding: 'utf8' }) : null;
  ok('server 테스트', t ? t.status === 0 : false, t ? (t.stdout.match(/# (pass|fail) \d+/g) || []).join(' ') : '먼저 cd server && npm install');
}
let f = 0;
console.log('\n다국어 · 완주 인증 확인\n');
for (const r of res) { if (!r.pass) f++; console.log(`${r.pass ? '통과' : '실패'}  ${r.name}${!r.pass && r.hint ? `\n      → ${r.hint}` : ''}`); }
console.log(`\n${res.length - f}/${res.length} 통과`);
process.exit(f ? 1 : 0);
