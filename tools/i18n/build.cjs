/*
 * 보물 여행 다국어(영어·일본어·중국어) 파일 만들기
 *   node tools/i18n/build.cjs
 *
 * 입력
 *  - tools/i18n/lang/alt.json : 서버 시드에만 있는(bomul.html과 다른) 한국어 문구의 번역 { 언어: { 한국어: 번역 } }
 *  - client/public/bomul.html            : 한국어 원문 (COURSES·STORIES·DETAILS·EATS …)
 *  - tools/i18n/lang/<언어>/*.json       : 코스 데이터 구조 그대로 언어별 문구만 담은 번역
 *      courses.json  { 코스id: { region, theme, title, summary, info{거리·소요시간·난이도·집결지}, stops[{where,name,desc}] } }
 *      stories.json  { 한국어 이야기 제목: { t: 번역 제목, x: 번역 본문 } }
 *      details.json  { d0…: { intro, points[{h,d}], visit[{k,v}] } }   (detailIds.json 이 코스id → d0… 연결)
 *      eats.json     { 코스id: [{ seg, rate, d }] }   (가게 이름은 그대로 둡니다)
 *  - tools/i18n/lang/gyeongbok.json, places.json, common.json : AR 화면용 손질 번역
 *  - tools/i18n/templates.cjs : AR 화면에 자동으로 만들어지는 문구의 언어별 틀
 *
 * 출력
 *  - client/public/i18n/content.<언어>.js : 메인(bomul.html)용 번역 + 원문 지문(sig)
 *  - client/public/i18n/ar.<언어>.js      : AR 화면(ar/course.html)용 "원문 지문 → 번역" 사전
 *
 * 지문(sig): 한국어 원문을 줄인 값입니다. 관리자가 한국어를 고치면 지문이 달라지므로
 *            그 칸은 (낡은 번역 대신) 고친 한국어를 그대로 보여 줍니다.
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const { pathToFileURL } = require("url");
const { T, clip } = require("./templates.cjs");

const ROOT = path.join(__dirname, "../..");
const PUB = path.join(ROOT, "client/public");
const LANG_DIR = path.join(__dirname, "lang");
const LANGS = ["en", "zh"];   // 일본어를 더하려면 lang/ja/ 를 만들고 여기에 "ja" 추가
const MISSION_RE = /\[(?:미션|Mission|ミッション|任务)\]/;

function fnv(str){ let h = 2166136261; for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const H = (s) => fnv(String(s == null ? "" : s).trim()).toString(36);
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const textHtml = (v) => escapeHtml(v).replace(/\n/g, "<br>");

// ── 한국어 원문 (bomul.html) ──
const html = fs.readFileSync(path.join(PUB, "bomul.html"), "utf8");
const a = html.indexOf("const COURSES="), b = html.indexOf("function gmapEmbed");
const KO = vm.runInNewContext(html.slice(a, b) + "\n;({COURSES,STORIES,DETAILS,EATS,INFOX,TIMELINES})", {});
const detailKey = new Map(), detailIds = {}, koDetails = {};
for (const [id, obj] of Object.entries(KO.DETAILS)) {
  if (!detailKey.has(obj)) { const k = "d" + detailKey.size; detailKey.set(obj, k); koDetails[k] = obj; }
  detailIds[id] = detailKey.get(obj);
}
const koInfo = (c) => Object.assign({}, c.info, KO.INFOX[c.id] || {});
const seedInfo = (c) => c.info || {};

// ── 한국어 AR 데이터: 정적 파일 + 서버 변환 결과 ──
const sandbox = { window: {} };
for (const f of ["common.js", "courses.js", "gyeongbok.js"]) vm.runInNewContext(fs.readFileSync(path.join(PUB, "ar/data", f), "utf8"), sandbox);
const STATIC = sandbox.window.BOMUL_COURSES, COMMON = sandbox.window.BOMUL_AR_COMMON;
const GB_KO = STATIC["seoul-gyeongbok-ar"];

const ALT = readJson(path.join(LANG_DIR, "alt.json"));
const problems = [];
const warn = (m) => { problems.push(m); };

function checkStructure(lang, tr){
  const err = (m) => { throw new Error(`[${lang}] ${m}`); };
  for (const c of KO.COURSES) {
    const t = tr.courses[c.id];
    if (!t) { warn(`[${lang}] 코스 번역 없음: ${c.id}`); continue; }
    if ((t.stops || []).length !== c.stops.length) err(`${c.id} 경유지 수가 다릅니다 (${t.stops.length} ≠ ${c.stops.length})`);
    c.stops.forEach((s, i) => { if (MISSION_RE.test(s.desc) !== MISSION_RE.test(t.stops[i].desc || "")) err(`${c.id} ${i + 1}번 경유지 [미션] 표시가 맞지 않습니다`); });
  }
  for (const [k, d] of Object.entries(koDetails)) {
    const t = tr.details[k]; if (!t) { warn(`[${lang}] 상세 자료 번역 없음: ${k}`); continue; }
    if (t.points.length !== d.points.length || t.visit.length !== d.visit.length) err(`상세 자료 ${k} 항목 수가 다릅니다`);
  }
  for (const [id, list] of Object.entries(KO.EATS)) {
    const t = tr.eats[id]; if (t && t.length !== list.length) err(`맛집 ${id} 개수가 다릅니다`);
  }
}

// ── 메인 페이지용 번역 묶음 ──
function buildContent(lang, tr){
  const sig = {};
  for (const c of KO.COURSES) {
    const info = koInfo(c);
    sig[c.id] = {
      region: H(c.region), theme: H(c.theme), title: H(c.title), summary: H(c.summary),
      info: Object.fromEntries(Object.entries(info).filter(([, v]) => v != null).map(([k, v]) => [k, H(v)])),
      stops: c.stops.map((s) => ({ where: H(s.where), name: H(s.name), desc: H(s.desc) })),
    };
  }
  const storySig = {};
  for (const t of Object.keys(tr.stories)) storySig[t] = H(KO.STORIES[t] || "");
  // 서버(DB) 문구가 bomul.html 과 다를 때 쓰는 보조 사전: 지문 → 번역
  const textDict = Object.fromEntries(Object.entries(ALT[lang] || {}).map(([ko, t]) => [H(ko), t]));
  return { lang, courses: tr.courses, sig, stories: tr.stories, storySig, details: tr.details, detailIds, eats: tr.eats, textDict };
}

// ── AR 화면용 사전 ──
function buildArDict(lang, tr, SERVER){
  const L = T[lang], K = T.ko;
  const dict = {}, stat = { ok: 0, skip: 0, conflict: 0 };
  const add = (ko, t, where) => {
    if (ko == null || t == null || ko === "" || t === "") return;
    if (Array.isArray(ko)) { ko.forEach((x, i) => add(x, t[i], where)); return; }
    const key = H(ko);
    if (dict[key] != null && dict[key] !== t) { stat.conflict++; return; }
    dict[key] = t; stat.ok++;
  };
  // 실제 한국어가 틀로 만든 한국어와 같을 때만 번역을 넣습니다.
  const chk = (actual, expected, t, where) => {
    if (actual == null || actual === "") return;
    if (actual === expected) add(actual, t, where);
    else { stat.skip++; warn(`[${lang}] 틀과 다른 한국어(번역 생략): ${where} = ${String(actual).slice(0, 60)}`); }
  };
  const places = readJson(path.join(LANG_DIR, "places.json"))[lang];
  const hand = readJson(path.join(LANG_DIR, "gyeongbok.json"))[lang];
  const common = readJson(path.join(LANG_DIR, "common.json"))[lang];

  // 보기에 쓰는 보물 이름: 같은 코스 → 전체 코스 순으로 찾습니다.
  const globalPiece = new Map();
  for (const c of KO.COURSES) { const t = tr.courses[c.id]; if (!t) continue; c.stops.forEach((s, i) => { if (!globalPiece.has(s.name)) globalPiece.set(s.name, t.stops[i].name); }); }

  function derive(ko, variant, seedCourse){
    const site = KO.COURSES.find((c) => c.id === ko.id), tc = tr.courses[ko.id];
    const src = seedCourse || site;   // 서버 결과는 시드 문구에서, 정적 결과는 bomul.html 문구에서 만들어집니다.
    if (!site || !src || !tc) { warn(`[${lang}] ${variant} ${ko.id}: 번역할 코스 없음`); return; }
    const isGb = ko.id === "seoul-gyeongbok-ar";
    const hk = isGb ? GB_KO : null, ht = isGb ? hand : null;
    const viaHand = (actual, koHand, tHand) => { if (hk && actual != null && actual === koHand) { add(actual, tHand); return true; } return false; };
    const wrap = variant === "server" ? textHtml : (x) => x;
    const N = ko.stops.length;
    const koPlace = ko.text.place, trPlace = (ht && koPlace === hk.text.place) ? ht.text.place : places[koPlace];
    if (!trPlace) warn(`[${lang}] 지역 이름 번역 없음: ${koPlace}`);
    add(koPlace, trPlace);
    add(ko.title, tc.title);
    add(src.region, tc.region);
    if (!viaHand(ko.text.h1, hk && hk.text.h1, ht && ht.text.h1)) chk(ko.text.h1, wrap(src.title), wrap(tc.title), `${ko.id}.h1`);
    if (!viaHand(ko.text.side, hk && hk.text.side, ht && ht.text.side)) chk(ko.text.side, K.side(koPlace), L.side(trPlace), `${ko.id}.side`);
    const koFinal = ko.final.name;
    const trFinal = (ht && koFinal === hk.final.name) ? ht.final.name : L.finalName(trPlace);
    if (!viaHand(koFinal, hk && hk.final.name, ht && ht.final.name)) chk(koFinal, K.finalName(koPlace), trFinal, `${ko.id}.final`);
    if (!viaHand(ko.final.nextSeason, hk && hk.final.nextSeason, ht && ht.final.nextSeason)) chk(ko.final.nextSeason, K.nextSeason, L.nextSeason, `${ko.id}.next`);
    // 표지 소개글
    ko.text.story.forEach((s, i) => {
      if (hk && hk.text.story[i] && (s === hk.text.story[i] || s === textHtml(hk.text.story[i]))) { add(s, s === hk.text.story[i] ? ht.text.story[i] : textHtml(ht.text.story[i])); return; }
      if (i === 0) {
        const det = variant === "static" ? KO.DETAILS[ko.id] : null;
        const tdet = det ? tr.details[detailIds[ko.id]] : null;
        chk(s, wrap(det ? det.intro : src.summary), wrap(tdet ? tdet.intro : tc.summary), `${ko.id}.story0`);
      } else chk(s, wrap(K.story2(N, koFinal)), wrap(L.story2(N, trFinal)), `${ko.id}.story1`);
    });
    const koInf = seedCourse ? seedInfo(src) : koInfo(src);
    if (!viaHand(ko.text.duration, hk && hk.text.duration, ht && ht.text.duration)) chk(ko.text.duration, koInf["소요시간"] || "", (tc.info || {})["소요시간"], `${ko.id}.duration`);
    const unit = ko.text.unit;
    if (!viaHand(unit, hk && hk.text.unit, ht && ht.text.unit)) chk(unit, K.unit, L.unit, `${ko.id}.unit`);
    if (!viaHand(ko.text.sealShort, hk && hk.text.sealShort, ht && ht.text.sealShort)) chk(ko.text.sealShort, K.sealShort, L.sealShort, `${ko.id}.seal`);
    if (!viaHand(ko.text.deed, hk && hk.text.deed, ht && ht.text.deed)) chk(ko.text.deed, K.deed, L.deed, `${ko.id}.deed`);
    if (!viaHand(ko.text.allDone, hk && hk.text.allDone, ht && ht.text.allDone)) chk(ko.text.allDone, K.allDone(N, unit), L.allDone(N, unit), `${ko.id}.allDone`);
    // 손으로 그린 약도의 이름표
    if (ko.map && ko.map.base && ht) add(ko.map.base, ko.map.base.replace(/>([^<>]+)<\/text>/g, (m, w) => `>${ht.map[w] || w}</text>`));

    const koW = src.stops.map((s) => String(s.where || "").replace(K.stripWhere, "").trim());
    const dup = new Set(koW.filter((w, i) => w && koW.indexOf(w) !== i));
    const trW = tc.stops.map((s) => String(s.where || "").replace(L.stripWhere, "").trim());
    const ownPiece = new Map(src.stops.map((s, i) => [s.name, tc.stops[i].name]));
    ko.stops.forEach((ks, i) => {
      const ss = src.stops[i], t0 = tc.stops[i], bs = site.stops[i];
      if (!ss || !t0 || !bs) return;
      // 시드 문구가 bomul.html 과 다르면 alt.json 번역을 씁니다.
      const ts = ss.desc === bs.desc ? t0 : { ...t0, desc: (ALT[lang] || {})[ss.desc] || "" };
      const hs = hk && hk.stops[i], htS = ht && ht.stops[i];
      const [koStoryRaw, koMis] = String(ss.desc || "").split("[미션]");
      const [trStoryRaw, trMis] = String(ts.desc || "").split(MISSION_RE);
      const koStory = koStoryRaw.trim(), trStory = trStoryRaw.trim();
      const pre = `${ko.id}.${i + 1}`;
      // 이름(비석 글자)
      if (!viaHand(ks.name, hs && hs.name, htS && htS.name)) {
        const lab = (w, place, k) => (!w ? `${place} ${k + 1}` : dup.has(koW[k]) ? `${w} ${k + 1}` : w);
        chk(ks.name, lab(koW[i], koPlace, i), lab(trW[i] || ts.name, trPlace, i), `${pre}.name`);
      }
      if (!viaHand(ks.mark, hs && hs.mark, htS && htS.mark)) chk(ks.mark, K.mark(i, unit), L.mark(i), `${pre}.mark`);
      if (!viaHand(ks.photoAlt, hs && hs.photoAlt, htS && htS.photoAlt)) chk(ks.photoAlt, K.photoAlt(ko.title), L.photoAlt(tc.title), `${pre}.photoAlt`);
      chk(ks.piece, ss.name, ts.name, `${pre}.piece`);
      if (!viaHand(ks.story, hs && hs.story, htS && htS.story)) chk(ks.story, koStory, trStory, `${pre}.story`);
      if (!viaHand(ks.look, hs && hs.look, htS && htS.look)) chk(ks.look, (koMis || "").trim() || K.look, (trMis || "").trim() || L.look, `${pre}.look`);
      if (ks.qctx) chk(ks.qctx, clip(K.first(koStory), K.qctxLen), clip(L.first(trStory), L.qctxLen), `${pre}.qctx`);
      if (!viaHand(ks.q, hs && hs.q, htS && htS.q)) chk(ks.q, K.q, L.q, `${pre}.q`);
      if (hs && JSON.stringify(ks.opts) === JSON.stringify(hs.opts)) add(ks.opts, htS.opts);
      else (ks.opts || []).forEach((o) => { const t = ownPiece.get(o) || globalPiece.get(o); if (t) add(o, t); else warn(`[${lang}] 보기 번역 없음: ${pre} ${o}`); });
      if (!viaHand(ks.explain, hs && hs.explain, htS && htS.explain)) chk(ks.explain, K.explain(koStory), L.explain(trStory), `${pre}.explain`);
      if (!viaHand(ks.cert, hs && hs.cert, htS && htS.cert)) chk(ks.cert, K.cert(koStory, ss.name), L.cert(trStory, ts.name), `${pre}.cert`);
      for (const rk of ["restoreYear", "restoreCaption"]) {
        if (!ks[rk] || !/[가-힣]/.test(ks[rk])) continue;
        if (htS && htS[rk]) add(ks[rk], htS[rk]);
        else warn(`[${lang}] 복원 그림 번역 없음: ${pre}.${rk}`);
      }
    });
  }
  for (const c of Object.values(STATIC)) derive(c, "static");
  for (const c of SERVER.courses) derive(c, "server", SERVER.seedById[c.id]);
  // 완주 상품 · 포인트 상품 (정적 기본값 + 서버 기본값)
  for (const set of [COMMON, SERVER.settings]) {
    set.prizes.forEach((p, i) => { const t = common.prizes[i]; if (!t) return; add(p.title, t.title); add(p.desc, t.desc); add(p.action, t.action); });
    set.pointShop.forEach((g, i) => { const t = common.pointShop[i]; if (!t) return; add(g.name, t.name); add(g.desc, t.desc); });
  }
  return { dict, stat };
}

// 지원하는 모든 문자열 칸이 사전에 있는지 셉니다.
function coverage(dict, courses){
  let total = 0, hit = 0; const miss = [];
  const see = (v, where) => { if (typeof v !== "string" || !v) return; total++; if (dict[H(v)] != null) hit++; else miss.push(`${where}: ${v.slice(0, 50)}`); };
  for (const c of courses) {
    see(c.title, c.id + ".title");
    for (const k of ["place", "side", "h1", "duration", "unit", "sealShort", "deed", "allDone"]) see(c.text[k], `${c.id}.${k}`);
    c.text.story.forEach((s, i) => see(s, `${c.id}.story${i}`));
    see(c.final.name, c.id + ".final"); see(c.final.nextSeason, c.id + ".next");
    c.stops.forEach((s, i) => { for (const k of ["name", "mark", "photoAlt", "piece", "story", "look", "qctx", "q", "explain", "cert"]) see(s[k], `${c.id}.${i + 1}.${k}`); (s.opts || []).forEach((o) => see(o, `${c.id}.${i + 1}.opt`)); });
  }
  return { total, hit, miss };
}

async function main(){
  const { buildArCourse, piecePool } = await import(pathToFileURL(path.join(ROOT, "server/src/services/arCourse.js")).href);
  const seed = readJson(path.join(ROOT, "server/src/data/legendCourses.json"));
  const settings = readJson(path.join(ROOT, "server/src/data/arDefaults.json"));
  const pool = piecePool(seed);
  const SERVER = { settings, seedById: Object.fromEntries(seed.map((c) => [c.id, c])), courses: seed.filter((c) => !c.ar || c.ar.enabled !== false).map((c) => buildArCourse(c, { pool, settings })).filter(Boolean) };
  const outDir = path.join(PUB, "i18n");
  fs.mkdirSync(outDir, { recursive: true });
  const ids = readJson(path.join(LANG_DIR, "detailIds.json"));
  for (const [k, v] of Object.entries(detailIds)) if (ids[k] !== v) throw new Error(`detailIds.json 이 bomul.html 과 다릅니다: ${k}`);
  const report = [];
  for (const lang of LANGS) {
    const tr = Object.fromEntries(["courses", "stories", "details", "eats"].map((n) => [n, readJson(path.join(LANG_DIR, lang, `${n}.json`))]));
    checkStructure(lang, tr);
    const content = buildContent(lang, tr);
    fs.writeFileSync(path.join(outDir, `content.${lang}.js`),
      `/* 자동 생성 파일입니다. tools/i18n/lang/${lang}/*.json 을 고친 뒤 node tools/i18n/build.cjs 를 실행하세요. */\n` +
      `window.BOMUL_I18N_CONTENT=window.BOMUL_I18N_CONTENT||{};window.BOMUL_I18N_CONTENT[${JSON.stringify(lang)}]=${JSON.stringify(content)};\n`);
    const { dict, stat } = buildArDict(lang, tr, SERVER);
    fs.writeFileSync(path.join(outDir, `ar.${lang}.js`),
      `/* 자동 생성 파일입니다. node tools/i18n/build.cjs 로 다시 만드세요. (한국어 원문 지문 → ${lang} 번역) */\n` +
      `window.BOMUL_I18N_AR=window.BOMUL_I18N_AR||{};window.BOMUL_I18N_AR[${JSON.stringify(lang)}]=${JSON.stringify({ lang, dict })};\n`);
    const cs = coverage(dict, Object.values(STATIC)), cv = coverage(dict, SERVER.courses);
    report.push(`${lang}: 사전 ${Object.keys(dict).length}개 (생략 ${stat.skip}, 겹침 ${stat.conflict}) · 정적 AR ${cs.hit}/${cs.total} · 서버 AR ${cv.hit}/${cv.total}`);
    if (cs.miss.length || cv.miss.length) report.push("  빠진 칸: " + [...cs.miss, ...cv.miss].slice(0, 12).join(" | "));
  }
  console.log(report.join("\n"));
  if (problems.length) console.log(`\n확인할 것 ${problems.length}개:\n- ` + [...new Set(problems)].slice(0, 40).join("\n- "));
}
main().catch((e) => { console.error(e); process.exit(1); });
