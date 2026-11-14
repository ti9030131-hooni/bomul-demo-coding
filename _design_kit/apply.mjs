#!/usr/bin/env node
/*
 * 보물 여행 디자인 키트 적용 스크립트 (새 메인 디자인 + 새 코스 지도) (설치할 패키지 없음, Node 18 이상)
 *
 *   node _design_kit/apply.mjs            → 미리보기(아무 파일도 바꾸지 않음)
 *   node _design_kit/apply.mjs --apply    → 실제 적용
 *   node _design_kit/apply.mjs --apply --force   → git 변경사항이 남아 있어도 적용
 *
 * 파일마다 이렇게 처리합니다.
 *   1) 지금 파일이 새 버전과 같으면            → 건너뜀(이미 적용됨)
 *   2) 지금 파일이 AR 키트 적용본과 같으면 → 새 버전으로 교체 (지도 이미지는 늘 교체, 바꾸기 전 파일은 백업)
 *   3) 파일이 없으면                            → 새로 만듦
 *   4) 직접 고친 흔적이 있으면                  → git merge-file로 3방향 자동 병합
 *        - 겹치는 곳이 없으면 자동 병합 결과로 저장
 *        - 겹치면 원래 파일은 그대로 두고 <파일>.design-merge(충돌 표시), <파일>.design-new(새 버전)를 옆에 만듦
 * 줄바꿈(CRLF/LF)과 BOM 차이는 무시하고 비교하며, 저장할 때는 원래 파일의 줄바꿈을 지킵니다.
 * 바꾸기 전 파일은 _design_kit/backup/<시각>/ 에 보관합니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const KIT = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(KIT, '..');
const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const FORCE = args.has('--force');
const manifest = JSON.parse(fs.readFileSync(path.join(KIT, 'manifest.json'), 'utf8'));

const paint = (code) => (s) => (process.env.NO_COLOR || !process.stdout.isTTY ? s : `\x1b[${code}m${s}\x1b[0m`);
const C = { g: paint(32), y: paint(33), r: paint(31), b: paint(1) };

function die(msg) {
  console.error(C.r(`\n[중단] ${msg}\n`));
  process.exit(1);
}

// ── 저장소 확인 ──
for (const must of ['client/public/bomul.html', 'client/public/img']) {
  if (!fs.existsSync(path.join(ROOT, must))) {
    die(`${must} 이(가) 없습니다. _design_kit 폴더를 저장소 맨 위(server, client 폴더가 있는 곳)에 두었는지 확인하세요.\n지금 위치: ${ROOT}`);
  }
}

let hasGit = true;
try {
  execFileSync('git', ['--version'], { stdio: 'ignore' });
} catch {
  hasGit = false;
}

if (APPLY && hasGit && !FORCE) {
  try {
    const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: ROOT, encoding: 'utf8' }).trim();
    if (dirty) die('커밋하지 않은 변경이 있습니다. 먼저 커밋하거나 새 브랜치에서 진행하세요.\n그래도 진행하려면 --force 를 붙이세요.\n' + dirty);
  } catch {
    /* git 저장소가 아니면 넘어감 */
  }
}

// ── 비교 도구 ──
const isBin = (entry) => entry.binary;
const readBuf = (p) => (fs.existsSync(p) ? fs.readFileSync(p) : null);
function norm(buf) {
  let s = buf.toString('utf8');
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s.replace(/\r\n/g, '\n').replace(/\r$/, '');
}
function sameContent(a, b, binary) {
  if (!a || !b) return false;
  return binary ? a.equals(b) : norm(a) === norm(b);
}
function eolOf(buf) {
  const s = buf.toString('utf8');
  return /\r\n/.test(s) ? '\r\n' : '\n';
}
function bomOf(buf) {
  return buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
}
function restore(text, likeBuf) {
  let out = likeBuf && eolOf(likeBuf) === '\r\n' ? text.replace(/\n/g, '\r\n') : text;
  if (likeBuf && bomOf(likeBuf)) out = '﻿' + out;
  return Buffer.from(out, 'utf8');
}
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'design-kit-'));
function merge3(curBuf, baseBuf, newBuf) {
  const a = path.join(TMP, 'cur'), b = path.join(TMP, 'base'), c = path.join(TMP, 'new');
  fs.writeFileSync(a, norm(curBuf));
  fs.writeFileSync(b, norm(baseBuf));
  fs.writeFileSync(c, norm(newBuf));
  let out;
  let conflicts = 0;
  try {
    out = execFileSync('git', ['merge-file', '-p', '-L', '지금 파일', '-L', '키트 기준(AR 적용본)', '-L', '디자인 키트 새 버전', a, b, c], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    // 종료 코드 = 충돌 개수
    if (typeof error.status === 'number' && error.status > 0 && error.stdout) {
      out = error.stdout.toString();
      conflicts = error.status;
    } else throw error;
  }
  return { text: out, conflicts };
}

// ── 처리 ──
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const BACKUP = path.join(KIT, 'backup', stamp);
const rows = [];
function backup(rel) {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) return;
  const dst = path.join(BACKUP, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}
function write(rel, buf) {
  const dst = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, buf);
}

for (const entry of manifest.files) {
  const rel = entry.path;
  const target = path.join(ROOT, rel);
  const cur = readBuf(target);
  const next = readBuf(path.join(KIT, 'new', rel));
  const bases = entry.bases.map((name) => ({ name, buf: readBuf(path.join(KIT, 'base', name, rel)) })).filter((b) => b.buf);
  const binary = isBin(entry);

  if (!cur) {
    rows.push({ rel, status: 'new', note: '새로 만듦' });
    if (APPLY) write(rel, next);
    continue;
  }
  if (sameContent(cur, next, binary)) {
    rows.push({ rel, status: 'skip', note: '이미 적용됨' });
    continue;
  }
  const exactBase = bases.find((b) => sameContent(cur, b.buf, binary));
  if (exactBase) {
    rows.push({ rel, status: 'replace', note: exactBase.name === 'ar' ? 'AR 키트 적용본 → 새 디자인' : '예전 버전 → 새 버전' });
    if (APPLY) {
      backup(rel);
      write(rel, binary ? next : restore(norm(next), cur));
    }
    continue;
  }
  if (binary) {
    rows.push({ rel, status: 'replace', note: '모델·이미지 파일 교체(직접 바꾼 파일이면 백업에서 되돌리세요)' });
    if (APPLY) {
      backup(rel);
      write(rel, next);
    }
    continue;
  }
  if (!hasGit || !bases.length) {
    rows.push({ rel, status: 'conflict', note: !hasGit ? 'git이 없어 자동 병합 불가' : '같은 이름의 다른 파일이 있음' });
    if (APPLY) write(rel + '.design-new', restore(norm(next), cur));
    continue;
  }
  let best = null;
  for (const b of bases) {
    const m = merge3(cur, b.buf, next);
    if (!best || m.conflicts < best.conflicts) best = { ...m, base: b.name };
  }
  if (best.conflicts === 0) {
    rows.push({ rel, status: 'merged', note: `직접 고친 부분을 살려 자동 병합(기준: ${best.base})` });
    if (APPLY) {
      backup(rel);
      write(rel, restore(best.text, cur));
    }
  } else {
    rows.push({ rel, status: 'conflict', note: `겹치는 수정 ${best.conflicts}곳 → .design-merge 확인 필요(기준: ${best.base})` });
    if (APPLY) {
      write(rel + '.design-merge', restore(best.text, cur));
      write(rel + '.design-new', restore(norm(next), cur));
    }
  }
}
fs.rmSync(TMP, { recursive: true, force: true });

// ── 보고 ──
const LABEL = { new: C.g('새 파일'), skip: '건너뜀 ', replace: C.g('교체   '), merged: C.y('자동병합'), conflict: C.r('충돌   ') };
console.log(C.b(`\n보물 여행 디자인 키트 ${APPLY ? '적용 결과' : '미리보기 (아직 아무것도 바꾸지 않았습니다)'}`));
console.log(`저장소: ${ROOT}\n`);
for (const r of rows) console.log(`${LABEL[r.status]}  ${r.rel}  ${r.note}`);
const count = (s) => rows.filter((r) => r.status === s).length;
const conflicts = rows.filter((r) => r.status === 'conflict');
console.log(`\n새 파일 ${count('new')} · 교체 ${count('replace')} · 자동병합 ${count('merged')} · 충돌 ${count('conflict')} · 건너뜀 ${count('skip')}`);
if (APPLY && rows.some((r) => ['replace', 'merged'].includes(r.status))) console.log(`바꾸기 전 파일: ${path.relative(ROOT, BACKUP)}`);

const report = [
  `# 디자인 키트 ${APPLY ? '적용' : '미리보기'} 결과 (${new Date().toLocaleString('ko-KR')})`,
  '',
  '| 상태 | 파일 | 설명 |',
  '| --- | --- | --- |',
  ...rows.map((r) => `| ${r.status} | \`${r.rel}\` | ${r.note} |`),
  '',
  conflicts.length
    ? `## 충돌 ${conflicts.length}개\n각 파일 옆의 \`.design-merge\`(충돌 표시가 들어간 병합본)와 \`.design-new\`(키트 새 버전)를 보고 원래 파일에 합친 뒤 두 보조 파일을 지우세요. 규칙은 _design_kit/CURSOR-PROMPTS.md 의 '3. 충돌 해결'.`
    : '충돌 없음.',
].join('\n');
fs.writeFileSync(path.join(KIT, APPLY ? 'apply-report.md' : 'check-report.md'), report + '\n');

if (!APPLY) console.log(C.b('\n실제로 적용하려면: node _design_kit/apply.mjs --apply'));
else if (conflicts.length) console.log(C.y('\n충돌 파일을 해결한 뒤: node _design_kit/verify.mjs'));
else console.log(C.g('\n다음 단계: node _design_kit/verify.mjs'));
