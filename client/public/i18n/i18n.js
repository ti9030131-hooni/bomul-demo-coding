/*
 * 보물 여행 다국어 도우미 (한국어 · English · 中文)
 *   <script src="/i18n/i18n.js"></script>  (bomul.html)
 *   <script src="../i18n/i18n.js"></script> (ar/course.html)
 *
 * 언어 고르기: ?lang=en|zh|ko → localStorage 'bomul-lang' → 기본 ko
 * 번역 묶음은 고른 언어일 때만 불러옵니다.
 *   content.<언어>.js : 메인 페이지 코스·이야기·상세·맛집 (tools/i18n/build.cjs 가 만듦)
 *   ar.<언어>.js      : AR 화면 사전 (한국어 원문 지문 → 번역)
 * 화면 문구(UI)는 페이지가 BomulI18n.addUI(언어, {키: 문구}) 로 등록하고 t(키, 값) 로 씁니다.
 *   문구 안의 {이름} 은 값으로 바뀌고, 문구가 함수이면 함수(값)를 부릅니다(한국어 조사 처리 등).
 *
 * 원칙: 번역이 없거나, 관리자가 한국어를 고쳐서 지문이 맞지 않으면 한국어를 그대로 보여 줍니다.
 */
(function () {
  "use strict";
  const LANGS = [
    { code: "ko", tab: "한국어", name: "한국어", html: "ko" },
    { code: "en", tab: "영어", name: "English", html: "en" },
    { code: "zh", tab: "중국어", name: "中文(简体)", html: "zh-Hans" },
  ];
  const CODES = LANGS.map((l) => l.code);
  const KEY = "bomul-lang";
  const me = document.currentScript;
  const BASE = me && me.src ? me.src.replace(/[^/]*(\?.*)?$/, "") : "/i18n/";

  function fnv(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  const hash = (s) => fnv(String(s == null ? "" : s).trim()).toString(36);

  function pick() {
    let q = null;
    try { q = new URLSearchParams(location.search).get("lang"); } catch (e) {}
    if (q && CODES.includes(q)) { try { localStorage.setItem(KEY, q); } catch (e) {} return q; }
    try { const s = localStorage.getItem(KEY); if (s && CODES.includes(s)) return s; } catch (e) {}
    return "ko";
  }
  let lang = pick();
  const UI = {};
  const loaded = {};

  function addUI(code, dict) { UI[code] = Object.assign(UI[code] || {}, dict); }
  function t(key, vars) {
    let v = UI[lang] && UI[lang][key];
    if (v == null) v = UI.ko && UI.ko[key];
    if (v == null) return key;
    if (typeof v === "function") return v(vars || {});
    return String(v).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? vars[k] : ""));
  }
  // 받침 있으면 a, 없으면 b (한국어 문구 함수에서 씁니다)
  function jo(w, a, b) { const c = String(w || "").trim().slice(-1).charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 > 0 ? a : b; }

  function loadScript(name) {
    if (lang === "ko") return Promise.resolve(null);
    const id = `${name}.${lang}`;
    if (!loaded[id]) {
      loaded[id] = new Promise((resolve) => {
        const s = document.createElement("script");
        s.src = `${BASE}${id}.js`;
        s.onload = () => resolve(true);
        s.onerror = () => { console.warn("[i18n] 불러오지 못함:", s.src); resolve(false); };
        document.head.appendChild(s);
      });
    }
    return loaded[id];
  }
  const content = () => (window.BOMUL_I18N_CONTENT || {})[lang] || null;
  const arPack = () => (window.BOMUL_I18N_AR || {})[lang] || null;

  /* ── 메인 페이지(bomul.html) ── */
  // 지문이 맞을 때만 번역, 아니면 보조 사전(textDict) → 한국어
  function pickText(ko, tr, sig, C) {
    if (ko == null || ko === "") return ko;
    if (tr != null && tr !== "" && sig != null && sig === hash(ko)) return tr;
    const alt = C && C.textDict && C.textDict[hash(ko)];
    return alt != null ? alt : ko;
  }
  function course(c) {
    const C = content();
    if (!C || !c) return c;
    const tr = C.courses[c.id], sg = C.sig[c.id];
    if (!tr || !sg) return c;
    const out = Object.assign({}, c);
    for (const f of ["region", "theme", "title", "summary"]) out[f] = pickText(c[f], tr[f], sg[f], C);
    if (c.info) {
      out.info = {};
      for (const [k, v] of Object.entries(c.info)) out.info[k] = pickText(v, (tr.info || {})[k], (sg.info || {})[k], C);
    }
    out.stops = (c.stops || []).map((s, i) => {
      const ts = (tr.stops || [])[i] || {}, ss = (sg.stops || [])[i] || {};
      return Object.assign({}, s, { where: pickText(s.where, ts.where, ss.where, C), name: pickText(s.name, ts.name, ss.name, C), desc: pickText(s.desc, ts.desc, ss.desc, C) });
    });
    return out;
  }
  // 이야기: { title, text } (제목은 한국어 키)
  function story(koTitle, koText) {
    const C = content();
    const tr = C && C.stories[koTitle];
    if (!tr) return { title: koTitle, text: koText };
    const ok = C.storySig[koTitle] === hash(koText || "");
    return { title: tr.t || koTitle, text: ok && tr.x ? tr.x : koText };
  }
  function details(courseId, ko) {
    const C = content();
    if (!C || !ko) return ko;
    const k = C.detailIds[courseId];
    return (k && C.details[k]) || ko;
  }
  function eats(courseId, ko) {
    const C = content();
    const tr = C && C.eats[courseId];
    if (!tr || !ko || tr.length !== ko.length) return ko;
    return ko.map((e, i) => Object.assign({}, e, { seg: tr[i].seg || e.seg, rate: tr[i].rate || e.rate, d: tr[i].d || e.d }));
  }
  // 타임라인 문구: "도보 5분", "버스+도보 30분", "차량 1시간", "60분"
  const MOVE = { en: { 도보: "Walk", 버스: "Bus", 지하철: "Subway", 차량: "Car", 등산: "Hike", 배: "Boat" }, zh: { 도보: "步行", 버스: "巴士", 지하철: "地铁", 차량: "开车", 등산: "登山", 배: "乘船" } };
  function duration(text) {
    if (lang === "ko" || !text) return text;
    const M = MOVE[lang] || {};
    let s = String(text).replace(/(도보|버스|지하철|차량|등산|배)/g, (w) => M[w] || w).replace(/·/g, lang === "zh" ? "·" : " · ");
    s = s.replace(/(\d+)\s*시간/g, lang === "zh" ? "$1小时" : "$1 h").replace(/(\d+)\s*분/g, lang === "zh" ? "$1分钟" : "$1 min");
    return s.replace(/\s+/g, " ").trim();
  }

  /* ── AR 화면(ar/course.html) ── 사전에 있는 문자열만 바꿉니다(제자리 수정) */
  function arText(ko) {
    const P = arPack();
    if (!P || typeof ko !== "string" || !ko) return ko;
    const v = P.dict[hash(ko)];
    return v != null ? v : ko;
  }
  function localizeAr(c) {
    if (!arPack() || !c) return c;
    c.title = arText(c.title); c.region = arText(c.region);
    if (c.text) {
      for (const k of ["place", "side", "h1", "duration", "unit", "sealShort", "deed", "allDone"]) c.text[k] = arText(c.text[k]);
      if (Array.isArray(c.text.story)) c.text.story = c.text.story.map(arText);
    }
    if (c.final) {
      c.final.name = arText(c.final.name); c.final.nextSeason = arText(c.final.nextSeason);
      if (Array.isArray(c.final.prizes)) c.final.prizes = c.final.prizes.map((p) => Object.assign({}, p, { title: arText(p.title), desc: arText(p.desc), action: arText(p.action) }));
    }
    if (Array.isArray(c.pointShop)) c.pointShop = c.pointShop.map((g) => Object.assign({}, g, { name: arText(g.name), desc: arText(g.desc) }));
    if (c.map && c.map.base) c.map = Object.assign({}, c.map, { base: arText(c.map.base) });
    (c.stops || []).forEach((s) => {
      for (const k of ["name", "mark", "photoAlt", "piece", "story", "look", "qctx", "q", "explain", "cert", "restoreYear", "restoreCaption"]) s[k] = arText(s[k]);
      if (Array.isArray(s.opts)) s.opts = s.opts.map(arText);
    });
    return c;
  }

  /* ── 화면 공통 ── */
  // data-i18n="키" → 글자, data-i18n-html="키" → HTML, data-i18n-attr="placeholder:키;aria-label:키"
  function apply(root) {
    const r = root || document;
    r.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    r.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    r.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.dataset.i18nAttr.split(";").forEach((pair) => { const [a, k] = pair.split(":").map((x) => x.trim()); if (a && k) el.setAttribute(a, t(k)); });
    });
    const info = LANGS.find((l) => l.code === lang);
    document.documentElement.lang = info ? info.html : "ko";
    document.documentElement.dataset.lang = lang;
  }
  function tabsHtml() {
    return LANGS.map((l) => `<button type="button" class="lang-tab" data-lang="${l.code}" aria-pressed="${l.code === lang}" lang="${l.html}" title="${l.name}">${l.tab}</button>`).join("");
  }
  // 중국어 글꼴(간체)을 필요할 때만 불러옵니다.
  function fonts() {
    if (lang !== "zh" || document.getElementById("bomul-font-zh")) return;
    const link = document.createElement("link");
    link.id = "bomul-font-zh"; link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@400;700;900&display=swap";
    document.head.appendChild(link);
  }
  // 언어 바꾸기: 저장 → (필요하면) 묶음 불러오기 → 'bomul:lang' 이벤트
  async function setLang(code, opts) {
    if (!CODES.includes(code)) return;
    lang = code;
    try { localStorage.setItem(KEY, code); } catch (e) {}
    try { const u = new URL(location.href); if (u.searchParams.has("lang")) { u.searchParams.set("lang", code); history.replaceState(null, "", u); } } catch (e) {}
    if (opts && opts.reload) { location.reload(); return; }
    fonts();
    await Promise.all(((opts && opts.packs) || []).map(loadScript));
    apply();
    document.dispatchEvent(new CustomEvent("bomul:lang", { detail: { lang } }));
  }
  function ready(packs) { fonts(); return Promise.all((packs || []).map(loadScript)); }
  const locale = () => ({ ko: "ko-KR", en: "en-US", zh: "zh-CN" })[lang] || "ko-KR";

  window.BomulI18n = {
    LANGS, get lang() { return lang; }, locale, hash, t, jo, addUI, apply, tabsHtml, setLang, ready, load: loadScript,
    course, story, details, eats, duration, arText, localizeAr,
  };
})();
