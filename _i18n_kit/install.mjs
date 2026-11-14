#!/usr/bin/env node
/*
 * 다국어 키트 파일 복사 (설치할 패키지 없음)
 *   node _i18n_kit/install.mjs          → 미리보기
 *   node _i18n_kit/install.mjs --apply  → 복사 (바뀌는 파일은 _i18n_kit/backup/<시각>/ 에 보관)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const KIT = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(KIT, '..');
const APPLY = process.argv.includes('--apply');
for (const must of ['client/public/bomul.html', 'client/public/ar/course.html', 'server/src/services/arCourse.js', 'tools/ar-courses/extract.cjs']) {
  if (!fs.existsSync(path.join(ROOT, must))) {
    console.error(`[중단] ${must} 이(가) 없습니다. AR 키트(_ar_kit)를 먼저 적용했는지, _i18n_kit 를 저장소 맨 위에 두었는지 확인하세요.`);
    process.exit(1);
  }
}
const SRC = path.join(KIT, 'files');
const list = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : list.push(path.relative(SRC, p)); } })(SRC);
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
let n = { new: 0, same: 0, replace: 0 };
for (const rel of list.sort()) {
  const from = path.join(SRC, rel), to = path.join(ROOT, rel);
  const a = fs.readFileSync(from);
  if (!fs.existsSync(to)) { n.new++; console.log('새 파일  ', rel); if (APPLY) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, a); } continue; }
  const b = fs.readFileSync(to);
  if (a.equals(b)) { n.same++; continue; }
  n.replace++; console.log('교체     ', rel);
  if (APPLY) { const bk = path.join(KIT, 'backup', stamp, rel); fs.mkdirSync(path.dirname(bk), { recursive: true }); fs.copyFileSync(to, bk); fs.writeFileSync(to, a); }
}
console.log(`\n새 파일 ${n.new} · 교체 ${n.replace} · 같음 ${n.same}${APPLY ? '' : '\n(미리보기입니다. 복사하려면 --apply)'}`);
