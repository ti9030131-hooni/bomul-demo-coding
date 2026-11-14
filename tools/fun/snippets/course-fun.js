/* ═════════════════ 재미 더하기: 숨은 보물 · 보물 도감 · 배지 · 탁본 엽서 ═════════════════
   · 숨은 보물: 코스의 비석 가운데 한 곳 근처(45m)에 숨은 비석이 하나 더 있어요. 현장에서만 탐지기가 움직이고,
     가까워질수록 「차가워요 → 뜨거워요」로 바뀌며 진동합니다. 찾으면 금빛 비석을 문질러 숨은 조각을 얻어요(+100P, 코스마다 한 번).
     어느 비석인지는 코스 아이디로 정해져 모두에게 같아요. 다른 곳에 숨기려면 ar/data/hidden.js 에 좌표를 적으세요(직접 가서 확인한 안전한 곳만).
   · 보물 도감: 모든 코스의 보물을 지역 세트로 모아 봐요. 세트를 다 모으면 「○○ 수호자」 배지, 모두 현장 탁본이면 +200P.
   · 배지: 첫 탁본, 새벽·야행·비 오는 날 탐험가(현장에서만), 현장파, 완주 1·5·10코스, 숨은 보물 사냥꾼, 이야기꾼(엽서 공유), 지역 수호자.
   · 탁본 엽서: 뜬 탁본으로 1080×1350 엽서 이미지를 만들어 공유하거나 저장하고, 초대 링크(?ref=)를 함께 보내요.
   기록은 이 기기(localStorage)에만 저장돼요. 포인트·배지를 상품과 묶으려면 서버 인증을 먼저 붙이세요. */
const FUN = { lb: -1, hiddenBand: "", sim: null, rubbing: false };
const FKEY = { badges: "bomul-badges-v1", hidden: "bomul-hidden-v1", ref: "bomul-ref-code", from: "bomul-ref-from" };
const fload = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
const fsave = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const SITE = /vercel\.app$|^localhost$|^127\.0\.0\.1$|bomul/i.test(location.hostname) ? location.origin : "https://bomul-demo-vercel.vercel.app";
const hash32 = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

document.head.insertAdjacentHTML("beforeend", `<style>
.hid-card{margin:4px 16px 14px;padding:14px 16px;border-radius:6px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--line);display:grid;grid-template-columns:52px 1fr;gap:12px;align-items:center}
.hid-ring{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;font-family:var(--serif);font-weight:900;font-size:22px;color:#fff;background:var(--stone);position:relative}
.hid-ring::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:2px solid currentColor;opacity:0;color:inherit}
.hid-card[data-band="cold"] .hid-ring{background:#5B7A9A}.hid-card[data-band="cool"] .hid-ring{background:#7E9AA8}
.hid-card[data-band="warm"] .hid-ring{background:#C49A4A}.hid-card[data-band="hot"] .hid-ring{background:#C2552F}
.hid-card[data-band="here"] .hid-ring{background:var(--seal)}
.hid-card[data-band="warm"] .hid-ring::after,.hid-card[data-band="hot"] .hid-ring::after,.hid-card[data-band="here"] .hid-ring::after{animation:hidPulse 1.4s ease-out infinite;border-color:#C2552F}
@keyframes hidPulse{0%{opacity:.8;transform:scale(.9)}100%{opacity:0;transform:scale(1.35)}}
.hid-card b{display:block;font-family:var(--serif);font-size:16px;font-weight:900}
.hid-card p{margin:3px 0 0;font-family:var(--sans);font-size:13.5px;line-height:1.55;color:var(--ink-2)}
.hid-card .btn{grid-column:1/-1;min-height:46px;margin-top:4px}
.hid-sim{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap;font-family:var(--sans);font-size:12px;color:var(--ink-2)}
.hid-sim button{padding:5px 10px;border-radius:999px;box-shadow:inset 0 0 0 1px var(--line);font-size:12px}
.dex-tabs{display:flex;gap:8px;margin:16px 0 12px}.dex-tabs button{flex:1;padding:10px 0;border-radius:4px;font-weight:700;box-shadow:inset 0 0 0 1.5px var(--line);color:var(--ink-2)}
.dex-tabs button[aria-pressed="true"]{background:var(--ink);color:var(--bg);box-shadow:none}
.dex-sum{font-family:var(--sans);font-size:14px;color:var(--ink-2);margin:0 0 12px;line-height:1.6}
.dex-sets{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin:0 -2px 12px;scrollbar-width:none}
.dex-sets button{flex:none;padding:7px 12px;border-radius:999px;font-family:var(--sans);font-size:13px;box-shadow:inset 0 0 0 1px var(--line);white-space:nowrap}
.dex-sets button[aria-pressed="true"]{background:var(--gold-soft);color:#1E2233;box-shadow:none;font-weight:600}
.set-bar{margin:0 0 16px;padding:12px 14px;border-radius:6px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--line);font-family:var(--sans);font-size:13px;color:var(--ink-2)}
.set-bar .meter{height:6px;border-radius:3px;background:var(--surface-2);margin:8px 0 6px;overflow:hidden}.set-bar .meter i{display:block;height:100%;background:var(--gold-soft)}
.dex-course{margin:18px 0 8px;display:flex;justify-content:space-between;align-items:baseline;font-weight:700;font-size:15px}
.dex-course small{font-family:var(--sans);font-weight:400;font-size:12px;color:var(--ink-2)}
.dex-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.dex-cell{display:flex;flex-direction:column;gap:5px;text-align:left}
.dex-cell .pic{aspect-ratio:5/7;border-radius:3px;overflow:hidden;background:var(--surface-2);display:grid;place-items:center;position:relative}
.dex-cell .pic img{width:100%;height:100%;object-fit:cover}
.dex-cell .pic .q{font-family:var(--serif);font-weight:900;font-size:26px;color:var(--line);display:flex;flex-direction:column;align-items:center;line-height:1.05}
.dex-cell .rar{position:absolute;left:5px;top:5px;padding:1px 6px;border-radius:999px;font-family:var(--sans);font-size:10.5px;font-weight:600;background:rgba(30,34,51,.72);color:#fff}
.dex-cell .rar.r-legend{background:#8E6A22}.dex-cell .rar.r-rare{background:#3F5E7A}.dex-cell .rar.r-hidden{background:var(--seal)}
.dex-cell .nm{font-size:12.5px;font-weight:700;line-height:1.35}.dex-cell .nm small{display:block;font-family:var(--sans);font-weight:400;font-size:11px;color:var(--ink-2)}
.dex-cell.off .nm{color:var(--ink-2)}
.badges{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.badge{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:12px 6px;border-radius:6px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--line)}
.badge .seal{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;font-family:var(--serif);font-weight:900;font-size:24px;color:#F6F1E4;background:var(--seal);transform:rotate(-6deg)}
.badge.off .seal{background:var(--surface-2);color:var(--line)}
.badge b{font-size:13px;line-height:1.3}.badge small{font-family:var(--sans);font-size:11px;color:var(--ink-2);line-height:1.4}
.fun-toast{position:fixed;left:50%;top:calc(14px + env(safe-area-inset-top,0px));transform:translate(-50%,-140%);z-index:90;display:flex;gap:10px;align-items:center;padding:10px 16px 10px 10px;border-radius:999px;background:#1E2233;color:#F6F1E4;font-family:var(--sans);font-size:14px;box-shadow:0 10px 30px rgba(0,0,0,.3);transition:transform .35s cubic-bezier(.2,1.4,.4,1);max-width:calc(100% - 24px)}
.fun-toast.on{transform:translate(-50%,0)}.fun-toast .seal{width:34px;height:34px;border-radius:50%;flex:none;display:grid;place-items:center;background:var(--seal);font-family:var(--serif);font-weight:900}
.scratch{position:relative;width:100%;max-width:300px;margin:6px auto 14px;aspect-ratio:3/4;border-radius:4px;overflow:hidden;touch-action:none;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.scratch canvas{position:absolute;inset:0;width:100%;height:100%}
.sc-st{font-family:var(--sans);font-weight:600;font-size:14px;color:var(--gold);min-height:1.4em;margin:0 0 12px}
.pc-prev{display:block;width:100%;max-width:300px;margin:4px auto 14px;border-radius:4px;box-shadow:0 8px 24px rgba(0,0,0,.2)}
.lb-card{margin:10px auto 0;padding:10px 18px;border-radius:999px;background:#F6F1E4;color:#1E2233;font-family:var(--sans);font-weight:600;font-size:14px}
</style>`);

/* ── 초대 링크 ── */
function myRefCode(){
  let c = fload(FKEY.ref, "");
  if (!c) { c = Math.random().toString(36).slice(2, 8).toUpperCase(); fsave(FKEY.ref, c); }
  return c;
}
const inviteUrl = (courseId) => `${SITE}/ar/course.html?id=${encodeURIComponent(courseId || C.id)}&ref=${myRefCode()}`;
(function catchRef(){
  try {
    const r = new URLSearchParams(location.search).get("ref");
    if (r && /^[A-Z0-9]{4,12}$/.test(r) && r !== fload(FKEY.ref, "") && !fload(FKEY.from, null)) {
      fsave(FKEY.from, { code: r, course: C.id, at: Date.now() });
      setTimeout(() => funToast("친", "친구 초대로 오셨네요! 첫 보물은 무료로 체험할 수 있어요."), 900);
    }
  } catch (e) {}
})();

/* ── 배지 ── */
const SETS = [
  ["서울", ["서울"]], ["경기·인천", ["경기도", "인천"]], ["강원", ["강원도"]], ["충청", ["충청도", "대전", "세종"]],
  ["전라", ["전라", "광주"]], ["경상", ["경상도", "부산", "대구", "울산"]], ["제주", ["제주"]], ["옛이야기", ["전래"]],
];
const setOf = region => (SETS.find(([, rs]) => rs.includes(region)) || [region])[0];
const BADGES = [
  { id: "first", seal: "첫", name: "첫 탁본", desc: "처음으로 탁본을 떴어요" },
  { id: "dawn", seal: "새", name: "새벽 탐험가", desc: "새벽 5~7시에 현장에서 탁본" },
  { id: "night", seal: "밤", name: "야행 탐험가", desc: "해 진 뒤 현장에서 탁본" },
  { id: "rain", seal: "비", name: "비 오는 날 탐험가", desc: "비·눈 오는 날 현장에서 탁본" },
  { id: "onsite", seal: "현", name: "현장파", desc: "한 코스를 모두 현장에서 탁본" },
  { id: "c1", seal: "완", name: "첫 완주", desc: "코스 1곳 완주" },
  { id: "c5", seal: "오", name: "다섯 코스 완주", desc: "코스 5곳 완주" },
  { id: "c10", seal: "십", name: "열 코스 완주", desc: "코스 10곳 완주" },
  { id: "hidden", seal: "숨", name: "숨은 보물 사냥꾼", desc: "숨은 비석을 찾았어요" },
  { id: "share", seal: "엽", name: "이야기꾼", desc: "탁본 엽서를 처음 공유" },
  ...SETS.map(([nm]) => ({ id: `set-${nm}`, seal: nm[0], name: `${nm} 수호자`, desc: `${nm} 보물을 모두 모음` })),
];
const myBadges = () => fload(FKEY.badges, {});
let toastQ = Promise.resolve();
function funToast(seal, msg){
  toastQ = toastQ.then(() => new Promise(done => {
    const t = document.createElement("div"); t.className = "fun-toast"; t.setAttribute("role", "status");
    t.innerHTML = `<span class="seal">${esc(seal)}</span><span>${esc(msg)}</span>`;
    document.body.appendChild(t); requestAnimationFrame(() => t.classList.add("on"));
    if (navigator.vibrate) navigator.vibrate([18, 40, 18]);
    setTimeout(() => { t.classList.remove("on"); setTimeout(() => { t.remove(); done(); }, 380); }, 2800);
  }));
}
function award(id, extra){
  const all = myBadges(); if (all[id]) return false;
  const b = BADGES.find(x => x.id === id); if (!b) return false;
  all[id] = Object.assign({ at: Date.now(), course: C.id }, extra || {}); fsave(FKEY.badges, all);
  funToast(b.seal, `배지 획득 · ${b.name}`);
  return true;
}
// 해 지는 시각(한국 대략값, 월별 시:분 → 시간)
const SUNSET = [17.7, 18.2, 18.6, 19.0, 19.4, 19.8, 19.9, 19.6, 19.0, 18.3, 17.6, 17.3];
function timeBadges(at){
  const d = new Date(at), h = d.getHours() + d.getMinutes() / 60;
  if (h >= 5 && h < 7) award("dawn");
  if (h >= SUNSET[d.getMonth()] || h < 4) award("night");
}
async function rainBadge(){
  if (geo.state !== "ok" || myBadges().rain) return;
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 3500);
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${geo.lat.toFixed(3)}&longitude=${geo.lng.toFixed(3)}&current=precipitation,weather_code`, { signal: ctl.signal });
    const j = await r.json(); const c = j.current || {};
    const wet = (c.precipitation || 0) > 0 || [51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99].includes(c.weather_code);
    if (wet) award("rain");
  } catch (e) {} finally { clearTimeout(tm); }
}

/* ── 모든 코스의 기록 읽기(도감·완주 수) ── */
function courseDone(c){
  if (c.id === C.id) return save.done || {};
  try { return (JSON.parse(localStorage.getItem(c.storageKey)) || {}).done || {}; } catch (e) { return {}; }
}
const ALL_COURSES = () => { const m = Object.assign({}, REG); m[C.id] = C; return Object.values(m).filter(c => c && Array.isArray(c.stops) && c.stops.length); };
function rarity(c, i){
  if (i === c.stops.length - 1) return ["legend", "전설"];
  return hash32(`${c.id}:${c.stops[i].id}`) % 4 === 0 ? ["rare", "희귀"] : ["common", "보통"];
}
function collectionStats(){
  const courses = ALL_COURSES(), hid = fload(FKEY.hidden, {});
  let total = 0, got = 0, done = 0, fullOnsite = 0;
  const sets = {};
  for (const c of courses) {
    const d = courseDone(c), set = setOf(c.region);
    const s = sets[set] || (sets[set] = { total: 0, got: 0, onsite: 0 });
    c.stops.forEach(st => { total++; s.total++; if (d[st.id]) { got++; s.got++; if (d[st.id].onsite) s.onsite++; } });
    if (c.stops.every(st => d[st.id])) done++;
    if (c.stops.every(st => d[st.id] && d[st.id].onsite)) fullOnsite++;
  }
  return { courses, total, got, done, fullOnsite, sets, hidden: Object.keys(hid).length };
}
function checkCollection(){
  const st = collectionStats();
  if (st.got >= 1) award("first");
  if (st.fullOnsite >= 1) award("onsite");
  if (st.done >= 1) award("c1"); if (st.done >= 5) award("c5"); if (st.done >= 10) award("c10");
  for (const [nm, s] of Object.entries(st.sets)) {
    if (s.total && s.got === s.total && award(`set-${nm}`) && s.onsite === s.total) {
      wallet.points = (wallet.points || 0) + 200;
      wallet.history = (wallet.history || []).concat([{ type: "earn", name: `${nm} 세트 보너스`, points: 200, at: Date.now() }]);
      persistWallet();
      funToast(nm[0], `${nm} 세트 보너스 +200P`);
    }
  }
}
// 탁본을 뜬 직후(answerRight)
function funAfterRub(s){
  const d = save.done[s.id]; if (!d) return;
  award("first");
  if (d.onsite) { timeBadges(d.at || Date.now()); rainBadge(); }
  if (STOPS.every(x => save.done[x.id] && save.done[x.id].onsite)) award("onsite");
  checkCollection();
  renderHidden();
}

/* ── 숨은 보물 ── */
function hiddenSpot(){
  const custom = (window.BOMUL_HIDDEN || {})[C.id];
  if (custom && custom.lat != null) return { lat: custom.lat, lng: custom.lng, r: custom.radius || 45, near: custom.hint || "코스 근처 어딘가" };
  const withGeo = STOPS.map((s, i) => [s, i]).filter(([s]) => s.lat != null);
  if (!withGeo.length) return null;
  const [s] = withGeo[hash32(`${C.id}:hidden`) % withGeo.length];
  return { lat: s.lat, lng: s.lng, r: 45, near: "코스의 비석 가운데 한 곳 근처", stopId: s.id };
}
const hiddenName = () => `${C.final.name}의 숨은 조각`;
const isHiddenFound = () => !!fload(FKEY.hidden, {})[C.id];
function band(m){
  if (m == null) return ["", "?", "위치를 켜면 탐지기가 움직여요."];
  if (m <= 45) return ["here", "!", "뜨거워요! 바로 이 근처예요. 숨은 비석을 찾았어요."];
  if (m <= 150) return ["hot", "뜨", "따뜻해요… 아니, 뜨거워지고 있어요!"];
  if (m <= 400) return ["warm", "따", "미지근해요. 이쪽이 맞는 것 같아요."];
  if (m <= 1000) return ["cool", "차", "차가워요. 다른 비석 쪽으로 가 보세요."];
  return ["cold", "얼", "얼음장이에요. 코스 안으로 들어가 보세요."];
}
function renderHidden(){
  const sec = $("#v-map"); if (!sec) return;
  let card = $("#hidCard");
  const spot = hiddenSpot();
  if (!spot) { if (card) card.remove(); return; }
  if (!card) { card = document.createElement("div"); card.className = "hid-card"; card.id = "hidCard"; $("#geoLine").after(card); }
  const sim = window.BOMUL_PREVIEW ? `<div class="hid-sim">미리보기 거리 흉내:<button data-sim="1500">멀리</button><button data-sim="600">조금 멀리</button><button data-sim="250">가까이</button><button data-sim="90">아주 가까이</button><button data-sim="10">도착</button></div>` : "";
  if (isHiddenFound()) {
    card.dataset.band = "here";
    card.innerHTML = `<span class="hid-ring">숨</span><div><b>숨은 비석을 찾았어요</b><p>「${esc(hiddenName())}」${jo(hiddenName(),"이","가")} 도감에 들어 있어요.</p></div><button class="btn line" data-go="v-dex">도감에서 보기</button>`;
    return;
  }
  const m = FUN.sim != null ? FUN.sim : (geo.state === "ok" ? haversine(geo.lat, geo.lng, spot.lat, spot.lng) : null);
  const onsiteOk = FUN.sim != null || (m != null && STOPS.some(s => { const d = distTo(s); return d != null && d <= Math.max(ONSITE_M || 120, 1500); }));
  const [bd, glyph, msg] = onsiteOk ? band(m) : ["", "?", geo.state === "ok" ? "코스 근처(현장)에서만 탐지기가 움직여요." : "위치를 켜면 탐지기가 움직여요. 숨은 비석은 현장에서만 찾을 수 있어요."];
  if (bd && FUN.hiddenBand && bd !== FUN.hiddenBand && navigator.vibrate) navigator.vibrate(bd === "here" ? [60, 40, 60, 40, 120] : bd === "hot" ? [40, 30, 40] : [25]);
  FUN.hiddenBand = bd;
  card.dataset.band = bd;
  card.innerHTML = `<span class="hid-ring">${glyph}</span><div><b>숨은 보물 탐지기</b><p>${esc(spot.near)}에 숨은 비석이 하나 더 있어요. ${esc(msg)}</p></div>
    ${bd === "here" ? `<button class="btn gold" id="hidOpen">숨은 비석 문지르기</button>` : ""}${sim}`;
}
function openHiddenRub(){
  openModal(`<h3>금빛 비석이 나타났어요</h3><p>손가락으로 한지를 문질러 숨은 글자를 드러내세요.</p>
    <div class="scratch" id="scratch"><canvas id="scBase"></canvas><canvas id="scTop"></canvas></div>
    <p class="sc-st" id="scSt" role="status"></p><button class="btn line" id="mNo">나중에</button>`);
  $("#mNo").addEventListener("click", closeModal);
  const box = $("#scratch"), base = $("#scBase"), top = $("#scTop");
  const W2 = box.clientWidth, H2 = box.clientHeight, k = Math.min(2, window.devicePixelRatio || 1);
  [base, top].forEach(cv => { cv.width = W2 * k; cv.height = H2 * k; cv.getContext("2d").setTransform(k, 0, 0, k, 0, 0); });
  const g = base.getContext("2d");
  const grd = g.createLinearGradient(0, 0, W2, H2); grd.addColorStop(0, "#8E6A22"); grd.addColorStop(.5, "#E3C27A"); grd.addColorStop(1, "#8E6A22");
  g.fillStyle = grd; g.fillRect(0, 0, W2, H2);
  g.strokeStyle = "rgba(60,40,10,.55)"; g.lineWidth = 3; g.strokeRect(14, 14, W2 - 28, H2 - 28);
  g.fillStyle = "#3A2808"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `900 ${Math.round(W2 * .32)}px "Noto Serif KR", serif`; g.fillText("隱", W2 / 2, H2 * .38);
  g.font = `700 ${Math.round(W2 * .062)}px "Noto Serif KR", serif`;
  const nm = hiddenName(); const mid = Math.ceil(nm.length / 2);
  g.fillText(nm.length > 10 ? nm.slice(0, mid) : nm, W2 / 2, H2 * .7); if (nm.length > 10) g.fillText(nm.slice(mid), W2 / 2, H2 * .7 + W2 * .08);
  const t = top.getContext("2d");
  t.fillStyle = "#E9E1CC"; t.fillRect(0, 0, W2, H2);
  for (let i = 0; i < 900; i++) { t.fillStyle = `rgba(120,100,60,${Math.random() * .08})`; t.fillRect(Math.random() * W2, Math.random() * H2, 2, 2); }
  t.globalCompositeOperation = "destination-out";
  let last = null, checks = 0, done = false;
  const pt = e => { const r = top.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const rub = (x, y) => { t.beginPath(); t.lineCap = "round"; t.lineWidth = W2 * .13; t.moveTo(last ? last[0] : x, last ? last[1] : y); t.lineTo(x, y); t.stroke(); last = [x, y]; };
  const measure = () => {
    const px = t.getImageData(0, 0, top.width, top.height).data; let clear = 0, n = 0;
    for (let i = 3; i < px.length; i += 64) { n++; if (px[i] < 40) clear++; }
    return clear / n;
  };
  top.addEventListener("pointerdown", e => { top.setPointerCapture(e.pointerId); last = null; rub(...pt(e)); });
  top.addEventListener("pointermove", e => {
    if (!e.buttons && e.pointerType === "mouse") return;
    rub(...pt(e));
    if (!done && ++checks % 12 === 0 && measure() > .55) { done = true; foundHidden(); }
  });
  top.addEventListener("pointerup", () => { last = null; });
}
function foundHidden(){
  const all = fload(FKEY.hidden, {});
  if (all[C.id]) return;
  all[C.id] = { at: Date.now(), name: hiddenName() }; fsave(FKEY.hidden, all);
  const top = $("#scTop"); if (top) { top.style.transition = "opacity .6s"; top.style.opacity = "0"; }
  wallet.points = (wallet.points || 0) + 100;
  wallet.history = (wallet.history || []).concat([{ type: "earn", name: `${C.title} 숨은 비석`, points: 100, at: Date.now() }]);
  persistWallet();
  if (navigator.vibrate) navigator.vibrate([30, 40, 30, 40, 160]);
  const st = $("#scSt"); if (st) st.textContent = `「${hiddenName()}」${jo(hiddenName(),"을","를")} 찾았어요! +100P`;
  const no = $("#mNo"); if (no) { no.textContent = "도감에서 보기"; no.className = "btn"; no.replaceWith(no.cloneNode(true)); $("#mNo").addEventListener("click", () => { closeModal(); show("v-dex"); }); }
  award("hidden"); renderHidden();
}
function funOnGeo(){ if (current === "v-map") renderHidden(); }

/* ── 보물 도감 · 배지 화면 ── */
const DEX = { tab: "dex", set: "" };
(function makeDexView(){
  const sec = document.createElement("section");
  sec.id = "v-dex"; sec.className = "view"; sec.setAttribute("aria-label", "보물 도감");
  sec.innerHTML = `<div class="bar"><strong>보물 도감</strong><span></span></div><div class="pad" id="dexBody"></div>`;
  $("#v-shop").before(sec);
  const nav = $("#tabs"); const b = document.createElement("button"); b.dataset.go = "v-dex"; b.textContent = "도감"; nav.appendChild(b);
  const lb = $("#lightbox .lb-rub");
  if (lb) { const btn = document.createElement("button"); btn.className = "lb-card"; btn.type = "button"; btn.textContent = "탁본 엽서로 공유하기"; btn.addEventListener("click", () => { if (FUN.lb >= 0) { const i = FUN.lb; closeLightbox(); makePostcardFor(C, STOPS[i].id); } }); lb.after(btn); }
})();
function renderDex(){
  checkCollection();
  const st = collectionStats(), hid = fload(FKEY.hidden, {}), mine = myBadges();
  const tabs = `<div class="dex-tabs"><button data-dtab="dex" aria-pressed="${DEX.tab === "dex"}">도감 ${st.got}/${st.total}</button><button data-dtab="badge" aria-pressed="${DEX.tab === "badge"}">배지 ${Object.keys(mine).length}/${BADGES.length}</button></div>`;
  if (DEX.tab === "badge") {
    $("#dexBody").innerHTML = tabs + `<p class="dex-sum">현장에서 탁본하면 시간·날씨에 따라 특별한 배지를 받을 수 있어요.</p>
      <div class="badges">${BADGES.map(b => { const m = mine[b.id]; return `<div class="badge${m ? "" : " off"}"><span class="seal">${esc(b.seal)}</span><b>${esc(b.name)}</b><small>${m ? new Date(m.at).toLocaleDateString("ko-KR") : esc(b.desc)}</small></div>`; }).join("")}</div>`;
    return;
  }
  const setNames = SETS.map(([nm]) => nm).filter(nm => st.sets[nm]);
  const cur = DEX.set && st.sets[DEX.set] ? DEX.set : "";
  const courses = st.courses.filter(c => !cur || setOf(c.region) === cur);
  const s = cur ? st.sets[cur] : null;
  $("#dexBody").innerHTML = tabs + `
    <p class="dex-sum">${st.courses.length}개 코스 · 보물 ${st.total}개 가운데 <b>${st.got}개</b>를 모았어요. 숨은 조각 ${st.hidden}/${st.courses.filter(c => c.stops.some(x => x.lat != null)).length}.</p>
    ${window.BOMUL_PREVIEW && !st.got ? `<button class="btn line" id="dexSample" style="margin:0 0 14px">미리보기: 예시 탁본 채워 보기</button>` : ""}
    <div class="dex-sets"><button data-set="" aria-pressed="${!cur}">전체</button>${setNames.map(nm => `<button data-set="${esc(nm)}" aria-pressed="${cur === nm}">${esc(nm)} ${st.sets[nm].got}/${st.sets[nm].total}</button>`).join("")}</div>
    ${s ? `<div class="set-bar"><b>${esc(cur)} 세트</b> ${s.got}/${s.total}<div class="meter"><i style="width:${Math.round(s.got / s.total * 100)}%"></i></div>모두 모으면 「${esc(cur)} 수호자」 배지, 모두 현장 탁본이면 +200P (현장 ${s.onsite}/${s.total})</div>` : ""}
    ${courses.map(c => {
      const d = courseDone(c), n = c.stops.filter(x => d[x.id]).length, h = hid[c.id];
      const cells = c.stops.map((x, i) => {
        const got = d[x.id], [rk, rl] = rarity(c, i);
        return `<button class="dex-cell${got ? "" : " off"}" data-dc="${esc(c.id)}" data-ds="${esc(x.id)}"><span class="pic">${got ? `<img src="${got.img}" alt="${esc(x.piece)} 탁본" loading="lazy">` : `<span class="q">${[...String(x.name).replace(/\s|·|\(.*\)/g, "")].slice(0, 3).map(ch => `<span>${esc(ch)}</span>`).join("")}</span>`}<span class="rar r-${rk}">${rl}</span></span>
          <span class="nm">${got ? esc(x.piece) : "???"}<small>${esc(x.name)}</small></span></button>`;
      }).join("") + (c.stops.some(x => x.lat != null) ? `<button class="dex-cell${h ? "" : " off"}" data-dc="${esc(c.id)}" data-ds="__hidden"><span class="pic">${h ? `<span class="q" style="color:var(--gold)">隱</span>` : `<span class="q">?</span>`}<span class="rar r-hidden">숨은</span></span><span class="nm">${h ? esc(h.name) : "숨은 조각"}<small>현장에서만</small></span></button>` : "");
      return `<div class="dex-course">${esc(c.title)}<small>${esc(c.region)} · ${n}/${c.stops.length}</small></div><div class="dex-grid">${cells}</div>`;
    }).join("")}`;
}
document.addEventListener("click", e => {
  const t = e.target.closest("[data-dtab],[data-set],[data-dc],[data-sim],#hidOpen,#dexSample"); if (!t) return;
  if (t.dataset.dtab) { DEX.tab = t.dataset.dtab; renderDex(); return; }
  if (t.dataset.set != null && t.closest("#dexBody")) { DEX.set = t.dataset.set; renderDex(); return; }
  if (t.dataset.sim) { FUN.sim = +t.dataset.sim; renderHidden(); return; }
  if (t.id === "hidOpen") { openHiddenRub(); return; }
  if (t.id === "dexSample") { fillSample(); return; }
  if (t.dataset.dc) dexDetail(t.dataset.dc, t.dataset.ds);
});
function dexDetail(cid, sid){
  const c = ALL_COURSES().find(x => x.id === cid); if (!c) return;
  const goHere = cid === C.id ? "" : `<a class="btn line" href="?id=${encodeURIComponent(cid)}" style="text-decoration:none">이 코스로 가기</a>`;
  if (sid === "__hidden") {
    const h = fload(FKEY.hidden, {})[cid];
    openModal(h ? `<h3>「${esc(h.name)}」</h3><p>${esc(c.title)}의 숨은 비석에서 찾았어요 · ${new Date(h.at).toLocaleDateString("ko-KR")}</p><button class="btn" id="mNo">닫기</button>`
      : `<h3>숨은 조각</h3><p>${esc(c.title)} 코스의 비석 가운데 한 곳 근처에 숨은 비석이 있어요. 현장에서 지도 화면의 「숨은 보물 탐지기」를 따라가 보세요.</p>${goHere}<button class="btn line" id="mNo">닫기</button>`);
    $("#mNo").addEventListener("click", closeModal); return;
  }
  const i = c.stops.findIndex(x => x.id === sid), x = c.stops[i], d = courseDone(c)[sid], [, rl] = rarity(c, i);
  if (!d) {
    openModal(`<h3>아직 못 찾은 보물</h3><p>${esc(c.title)} · ${i + 1}번째 장소 「${esc(x.name)}」에서 탁본을 뜨면 도감에 들어와요. (${rl})</p>${goHere}<button class="btn line" id="mNo">닫기</button>`);
    $("#mNo").addEventListener("click", closeModal); return;
  }
  openModal(`<h3>「${esc(x.piece)}」</h3><p>${esc(c.title)} · ${esc(x.name)}<br>${rl} · ${d.onsite ? "현장 탁본" : "데모 모드"}${d.at ? ` · ${new Date(d.at).toLocaleDateString("ko-KR")}` : ""}</p>
    <img class="pc-prev" src="${d.img}" alt="${esc(x.name)} 탁본">
    ${cid === C.id ? `<button class="btn line" id="dx3d">3D로 보기</button>` : ""}<button class="btn" id="dxCard">탁본 엽서로 공유하기</button><button class="btn line" id="mNo">닫기</button>`);
  $("#mNo").addEventListener("click", closeModal);
  $("#dxCard").addEventListener("click", () => makePostcardFor(c, sid));
  const v = $("#dx3d"); if (v) v.addEventListener("click", () => { closeModal(); openLightbox(i); });
}

// 미리보기 전용: 몇 코스에 예시 탁본을 채워 도감·배지·엽서를 바로 볼 수 있게 함
function fillSample(){
  const mk = (t) => { const c = document.createElement("canvas"); c.width = 360; c.height = 500; const g = c.getContext("2d");
    g.fillStyle = "#D9CFB5"; g.fillRect(0, 0, 360, 500); g.fillStyle = "#24242a";
    for (let i = 0; i < 2600; i++) { g.globalAlpha = Math.random() * .55; g.fillRect(Math.random() * 360, Math.random() * 500, 3, 3); }
    g.globalAlpha = 1; g.fillStyle = "#E9E1CC"; g.font = `900 150px "Noto Serif KR", serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t, 180, 240);
    return c.toDataURL("image/jpeg", .8); };
  const pick = ALL_COURSES().filter(c => c.region === "서울").slice(0, 3);
  pick.forEach((c, k) => {
    const done = {}; c.stops.slice(0, k === 0 ? c.stops.length : 2).forEach((x, i) => { done[x.id] = { img: mk(String(x.name)[0]), onsite: k !== 1, at: Date.now() - i * 3600e3 }; });
    if (c.id === C.id) { save.done = Object.assign(save.done || {}, done); persist(); }
    else { const old = (() => { try { return JSON.parse(localStorage.getItem(c.storageKey)) || {}; } catch (e) { return {}; } })(); old.done = Object.assign(old.done || {}, done); fsave(c.storageKey, old); }
  });
  renderDex(); renderDots(); renderIntro();
}

/* ── 탁본 엽서 ── */
function loadImg(src){ return new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = src; }); }
async function postcardBlob(c, sid){
  const x = c.stops.find(s => s.id === sid), d = courseDone(c)[sid]; if (!x || !d) return null;
  try { await fontsReady(); } catch (e) {}
  const W3 = 1080, H3 = 1350, cv = document.createElement("canvas"); cv.width = W3; cv.height = H3;
  const g = cv.getContext("2d");
  g.fillStyle = "#EDE6D4"; g.fillRect(0, 0, W3, H3);
  for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(110,90,50,${Math.random() * .06})`; g.fillRect(Math.random() * W3, Math.random() * H3, 2, 3); }
  g.strokeStyle = "#1E2233"; g.lineWidth = 4; g.strokeRect(40, 40, W3 - 80, H3 - 80); g.lineWidth = 1.5; g.strokeRect(54, 54, W3 - 108, H3 - 108);
  g.fillStyle = "#1E2233"; g.textAlign = "center"; g.textBaseline = "alphabetic";
  g.font = `700 30px "IBM Plex Sans KR", sans-serif`; g.fillText("보물 여행 · 탁본 엽서", W3 / 2, 128);
  g.font = `900 52px "Noto Serif KR", serif`; g.fillText(c.title.length > 18 ? c.title.slice(0, 17) + "…" : c.title, W3 / 2, 196);
  const im = await loadImg(d.img).catch(() => null);
  const bw = 640, bh = im ? Math.min(760, Math.round(bw * im.height / im.width)) : 760, bx = (W3 - bw) / 2, by = 240;
  g.save(); g.shadowColor = "rgba(0,0,0,.25)"; g.shadowBlur = 30; g.shadowOffsetY = 12; g.fillStyle = "#D9CFB5"; g.fillRect(bx, by, bw, bh); g.restore();
  if (im) g.drawImage(im, bx, by, bw, bh);
  const ty = by + bh + 86;
  g.fillStyle = "#1E2233"; g.font = `900 58px "Noto Serif KR", serif`; g.fillText(`「${x.piece}」`, W3 / 2, ty);
  g.font = `400 30px "IBM Plex Sans KR", sans-serif`; g.fillStyle = "#4F5263";
  g.fillText(`${x.name} · ${d.onsite ? "현장 탁본" : "데모 탁본"} · ${new Date(d.at || Date.now()).toLocaleDateString("ko-KR")}`, W3 / 2, ty + 54);
  g.fillStyle = "#8E6A22"; g.font = `600 28px "IBM Plex Sans KR", sans-serif`;
  g.fillText(`나도 탁본 뜨러 가기 → ${SITE.replace(/^https?:\/\//, "")}`, W3 / 2, H3 - 92);
  g.save(); g.translate(W3 - 170, H3 - 250); g.rotate(-.1);
  g.fillStyle = "rgba(179,55,42,.92)"; g.fillRect(-62, -62, 124, 124); g.fillStyle = "#F1E8D6";
  g.font = `900 84px "Noto Serif KR", serif`; g.textBaseline = "middle"; g.fillText("寶", 0, 4); g.restore();
  return new Promise(ok => cv.toBlob(ok, "image/png"));
}
async function makePostcardFor(c, sid){
  openModal(`<h3>엽서를 만들고 있어요</h3><p>잠시만 기다려 주세요.</p>`);
  const blob = await postcardBlob(c, sid);
  if (!blob) { openModal(`<h3>엽서를 만들지 못했어요</h3><button class="btn" id="mNo">닫기</button>`); $("#mNo").addEventListener("click", closeModal); return; }
  const url = URL.createObjectURL(blob), link = inviteUrl(c.id), file = new File([blob], `bomul-postcard-${c.id}.png`, { type: "image/png" });
  const canFile = navigator.canShare && navigator.canShare({ files: [file] });
  openModal(`<h3>탁본 엽서가 완성됐어요</h3><img class="pc-prev" src="${url}" alt="탁본 엽서">
    <p>친구가 아래 링크로 들어오면 첫 보물을 무료로 체험할 수 있어요.</p>
    ${window.BOMUL_PREVIEW ? `<p style="font-size:13px">미리보기 화면에서는 저장·공유가 막혀 있어요. 실제 사이트에서는 바로 저장하거나 공유할 수 있어요.</p>` : ""}
    ${navigator.share ? `<button class="btn" id="pcShare">공유하기</button>` : ""}
    <a class="btn line" id="pcSave" href="${url}" download="bomul-postcard-${esc(c.id)}.png" style="text-decoration:none">이미지 저장</a>
    <button class="btn line" id="pcCopy">초대 링크 복사</button><button class="btn line" id="mNo">닫기</button>`);
  $("#mNo").addEventListener("click", () => { closeModal(); URL.revokeObjectURL(url); });
  $("#pcSave").addEventListener("click", () => award("share"));
  $("#pcCopy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(link); $("#pcCopy").textContent = "복사했어요"; } catch (e) { prompt("초대 링크", link); }
  });
  const sh = $("#pcShare");
  if (sh) sh.addEventListener("click", async () => {
    try {
      await navigator.share(canFile ? { files: [file], title: "보물 여행 탁본 엽서", text: `「${c.title}」에서 탁본을 떴어요!`, url: link } : { title: "보물 여행", text: `「${c.title}」에서 탁본을 떴어요!`, url: link });
      award("share");
    } catch (e) {}
  });
}

