#!/usr/bin/env node
// 보물 여행 결제(코스 도전권) 키트 설치 — 저장소 맨 위에서:  node _pay_kit/install.mjs
//   1) files/ 안의 새 파일을 저장소에 복사(같은 이름의 다른 파일이 있으면 *.before-pay 로 백업 후 덮어씀)
//   2) tools/pay/patch.mjs 로 app.js · ar/course.html · bomul.html 에 연결 코드를 넣음
//   --dry : 무엇을 할지 보여 주기만 함
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const KIT = dirname(fileURLToPath(import.meta.url));
const ROOT = process.cwd();
const DRY = process.argv.includes('--dry');
if (!existsSync(join(ROOT, 'server/src/app.js')) || !existsSync(join(ROOT, 'client/public'))) {
  console.error('저장소 맨 위(server/ 와 client/ 가 있는 폴더)에서 실행해 주세요.'); process.exit(1);
}
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
let added = 0, same = 0, replaced = 0;
for (const src of walk(join(KIT, 'files'))) {
  const rel = relative(join(KIT, 'files'), src);
  const dst = join(ROOT, rel);
  if (existsSync(dst)) {
    if (readFileSync(dst).equals(readFileSync(src))) { same += 1; continue; }
    console.log(`바꿈(백업 .before-pay): ${rel}`); replaced += 1;
    if (!DRY) copyFileSync(dst, `${dst}.before-pay`);
  } else { console.log(`새 파일: ${rel}`); added += 1; }
  if (!DRY) { mkdirSync(dirname(dst), { recursive: true }); cpSync(src, dst); }
}
console.log(`\n파일: 새로 ${added} · 바꿈 ${replaced} · 같음 ${same}${DRY ? ' (--dry: 실제로는 바꾸지 않음)' : ''}\n`);
const r = spawnSync(process.execPath, [join(DRY ? KIT + '/files' : ROOT, 'tools/pay/patch.mjs'), ...(DRY ? ['--check'] : [])], { stdio: 'inherit', cwd: ROOT });
console.log(`\n다음: node _pay_kit/check.mjs  →  CURSOR-PROMPTS-pay.md 의 P-1 부터`);
process.exit(r.status ?? 0);
