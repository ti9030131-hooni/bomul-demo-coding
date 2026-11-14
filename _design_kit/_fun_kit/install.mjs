#!/usr/bin/env node
// 보물 여행 「재미 더하기」 키트 설치 — 저장소 맨 위에서:  node _fun_kit/install.mjs   (--dry: 확인만)
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const KIT = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry');
if (!existsSync('client/public/ar/course.html')) { console.error('저장소 맨 위(client/ 가 있는 폴더)에서 실행해 주세요.'); process.exit(1); }
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
for (const src of walk(join(KIT, 'files'))) {
  const rel = relative(join(KIT, 'files'), src);
  if (existsSync(rel) && readFileSync(rel).equals(readFileSync(src))) continue;
  // hidden.js 는 운영자가 좌표를 적는 파일이라 이미 있으면 덮어쓰지 않습니다
  if (existsSync(rel) && rel.endsWith('data/hidden.js')) { console.log(`그대로 둠(이미 있음): ${rel}`); continue; }
  console.log(`${existsSync(rel) ? '바꿈(백업 .before-fun)' : '새 파일'}: ${rel}`);
  if (DRY) continue;
  if (existsSync(rel)) copyFileSync(rel, `${rel}.before-fun`);
  mkdirSync(dirname(rel), { recursive: true }); cpSync(src, rel);
}
const r = spawnSync(process.execPath, [join(DRY ? join(KIT, 'files') : '.', 'tools/fun/patch.mjs'), ...(DRY ? ['--check'] : [])], { stdio: 'inherit' });
console.log('\n다음: node _fun_kit/check.mjs  →  CURSOR-PROMPTS-fun.md 의 F-1 부터');
process.exit(r.status ?? 0);
