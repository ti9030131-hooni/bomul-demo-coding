#!/usr/bin/env node
// 결제 키트가 제대로 들어갔는지 확인 — 저장소 맨 위에서:  node _pay_kit/check.mjs
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ok = [], bad = [];
const has = (f, s, label) => { const t = existsSync(f) ? readFileSync(f, 'utf8') : ''; (t.includes(s) ? ok : bad).push(label); };
for (const f of ['server/src/data/payProducts.json', 'server/src/models/PayOrder.js', 'server/src/models/CourseTicket.js', 'server/src/services/payments.js',
  'server/src/controllers/pay.js', 'server/src/routes/pay.js', 'client/public/pay.html', 'tools/pay/patch.mjs',
  'server/src/services/inicis.js', 'server/src/data/draw.json', 'server/src/models/DrawEntry.js', 'server/src/services/draw.js', 'server/src/controllers/draw.js', 'server/src/routes/draw.js']) (existsSync(f) ? ok : bad).push(`파일 ${f}`);
has('server/src/app.js', "app.use('/api/pay', payRouter)", 'app.js 에 /api/pay 연결');
has('server/src/app.js', "typeof err.code === 'string'", 'app.js 오류 응답에 code');
has('client/public/ar/course.html', 'function passGate(i)', 'AR 화면 도전권 확인');
has('client/public/ar/course.html', 'if (needsPass(i)) { passGate(i); return; }', 'AR 열기 전 확인 연결');
has('client/public/bomul.html', '/* 코스 도전권(결제) */', 'bomul.html 도전권 구매 버튼');
has('server/src/app.js', "app.use('/api/draw', drawRouter)", 'app.js 에 /api/draw 연결');
has('client/public/ar/course.html', 'async function syncDraw()', 'AR 보물 상자에서 추첨 응모(1인 1회)');
has('client/public/ar/course.html', 'async function enterFreeDraw()', 'AR 무료 응모 경로(첫 보물 뒤)');
has('client/public/ar/data/common.js', '1등 150만 원', '상금 150·100·50만 원 (정적 데이터)');
has('server/src/data/arDefaults.json', '1등 150만 원', '상금 150·100·50만 원 (서버 기본값)');
has('server/src/data/draw.json', '"freeEntry": true', '무료 응모 허용 (draw.json)');
has('client/public/ar/data/common.js', '시즌마다 한 사람당 한 번', '추첨 설명 1인 1회 (정적 데이터)');
has('server/src/data/arDefaults.json', '시즌마다 한 사람당 한 번', '추첨 설명 1인 1회 (서버 기본값)');
has('client/public/ar/course.html', 'const POINTS_ONSITE_ONLY', '적립금: 현장 완주만 500P · 예전 포인트 1/200');
has('client/public/ar/data/common.js', 'points: 500,', '적립금 500P · 교환표 (정적 데이터)');
has('server/src/data/arDefaults.json', '"points": 500,', '적립금 500P · 교환표 (서버 기본값)');
has('client/public/pay.html', 'INIStdPay.pay(', 'pay.html KG이니시스 결제창(PC·모바일)');
has('client/public/pay.html', '궁·유적지 입장료는 별도예요', 'pay.html 입장료 별도 안내');
try { const j = JSON.parse(readFileSync('server/src/data/payProducts.json', 'utf8')); (j.products.map((p) => p.price).join(',') === '4000,9900' ? ok : bad).push(`가격 ${j.products.map((p) => p.price).join(' / ')}원`); } catch { bad.push('payProducts.json 읽기'); }

const run = (label, args, cwd) => { const r = spawnSync(process.execPath, args, { cwd, encoding: 'utf8' }); const m = (r.stdout + r.stderr).match(/# pass (\d+)[\s\S]*# fail (\d+)/); (r.status === 0 ? ok : bad).push(`${label}${m ? ` (통과 ${m[1]} · 실패 ${m[2]})` : ''}`); if (r.status) console.log((r.stdout + r.stderr).split('\n').filter((l) => /not ok|Error|assert/i.test(l)).slice(0, 12).join('\n')); };
run('규칙 시험 server/test/payments · inicis · draw', ['--test', 'test/payments.test.mjs', 'test/inicis.test.mjs', 'test/draw.test.mjs'], 'server');
run('흐름 시험(DB 없이) tools/pay/test/flow.test.mjs', ['--import', './tools/pay/test/register.mjs', '--test', 'tools/pay/test/flow.test.mjs'], '.');

console.log(ok.map((x) => `✓ ${x}`).join('\n'));
if (bad.length) console.log(bad.map((x) => `✗ ${x}`).join('\n'));
console.log(`\n${bad.length ? `확인 필요 ${bad.length}건` : '모두 통과'} — 통과 ${ok.length}`);
process.exit(bad.length ? 1 : 0);
