/*
 * 보물 여행 — 메인 사이트(bomul.html)의 모든 코스를 AR 탁본 코스로 변환합니다.
 *   node tools/ar-courses/build.cjs
 * 결과: client/public/ar/data/courses.js
 *
 * bomul.html의 코스(경유지·이야기·좌표)를 고치면 이 스크립트를 다시 돌려 주세요.
 * 경복궁 특별 코스(seoul-gyeongbok-ar)는 손으로 다듬은 data/gyeongbok.js를 씁니다.
 */
const fs = require("fs"), path = require("path");
const extract = require("./extract.cjs");
const ROOT = path.join(__dirname, "../../client/public");
const d = extract(path.join(ROOT, "bomul.html"));

// 비석 머리·표지에 쓰는 짧은 지역 이름 (서버 시드와 함께 씁니다)
const PLACE = require("./places.json");
const MODELS = ["models/haechi-horn.glb", "models/deume-mirror.glb", "models/dragon-pearl.glb", "models/amisan-chimney.glb", "models/mulbul-ember.glb"];
const ORDW = ["첫째","둘째","셋째","넷째","다섯째","여섯째","일곱째","여덟째","아홉째","열째"];

function hash(str){ let h = 2166136261; for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function shuffle(arr, seed){ const a = arr.slice(); let s = seed || 1; for (let i = a.length - 1; i > 0; i--) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const hasJong = w => { const c = (w || "").trim().slice(-1).charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 > 0 : false; };
const firstSentence = t => { const m = t.match(/^(.+?[.!?。])(\s|$)/); return (m ? m[1] : t).trim(); };
const clip = (t, n) => t.length > n ? t.slice(0, n - 1).trim() + "…" : t;
function haversine(a, b){ const R = 6371000, r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lng - a.lng) * r;
  const x = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }

const allPieces = d.COURSES.filter(c => c.id !== "seoul-gyeongbok-ar").flatMap(c => c.stops.map(s => ({ region: c.region, piece: s.name })));
const out = {};

for (const c of d.COURSES) {
  if (c.id === "seoul-gyeongbok-ar") continue;
  const geo = d.MAPGEO[c.id] || [];
  const place = PLACE[c.id] || c.region;
  const photo = "../" + String(d.PHOTOS[c.id] || c.hero || d.IMAGES[c.id] || c.thumb || "img/seoul-poster.jpg").replace(/\?.*$/, "");
  const wheres = c.stops.map(s => String(s.where || "").replace(/^보물\s*\d+\s*·\s*/, "").trim());
  const dup = new Set(wheres.filter((w, i) => wheres.indexOf(w) !== i));
  const stops = c.stops.map((s, i) => {
    const [storyRaw, missionRaw] = String(s.desc || "").split("[미션]");
    const story = storyRaw.trim(), look = (missionRaw || "").trim() || "현장 안내판과 주변을 둘러보며 이야기의 흔적을 찾아보세요.";
    const name = !wheres[i] ? `${place} ${i + 1}` : dup.has(wheres[i]) ? `${wheres[i]} ${i + 1}` : wheres[i];
    // 수수께끼: 이야기를 읽고 이 장소에 깃든 보물(전설)의 이름을 고릅니다.
    const own = c.stops.filter((_, k) => k !== i).map(x => x.name);
    let pool = shuffle(own, hash(c.id + i)).slice(0, 3);
    if (pool.length < 3) {
      const extra = shuffle(allPieces.filter(p => p.piece !== s.name && !own.includes(p.piece) && p.region === c.region).map(p => p.piece), hash(c.id + "x" + i));
      const more = extra.length >= 3 - pool.length ? extra : extra.concat(shuffle(allPieces.map(p => p.piece).filter(p => p !== s.name && !own.includes(p)), hash(c.id + "y" + i)));
      pool = pool.concat([...new Set(more)].slice(0, 3 - pool.length));
    }
    const opts = shuffle([s.name, ...pool], hash(c.id + "o" + i));
    const g = geo[i];
    return {
      id: `s${i + 1}`, name, mark: `${ORDW[i] || (i + 1) + "째"} 보물`,
      lat: g ? g.lat : null, lng: g ? g.lng : null,
      photo, photoAlt: `${c.title} 참고 이미지`, addr: s.addr || "",
      model: MODELS[i % MODELS.length], piece: s.name,
      story, look,
      qctx: clip(firstSentence(story), 90),
      q: "탁본에 새겨진 이야기를 읽고, 이곳에 잠든 보물의 이름을 골라 보세요.",
      opts, a: opts.indexOf(s.name),
      explain: `${story} 자세한 이야기는 보물 여행 코스 상세 페이지에서 더 볼 수 있어요.`,
      cert: clip(firstSentence(story), 64) + ` 「${s.name}」${hasJong(s.name) ? "을" : "를"} 찾음.`,
    };
  });
  const pts = stops.filter(s => s.lat != null);
  const center = pts.length ? { lat: pts.reduce((t, s) => t + s.lat, 0) / pts.length, lng: pts.reduce((t, s) => t + s.lng, 0) / pts.length } : null;
  const spread = center ? Math.max(...pts.map(s => haversine(center, s))) : 0;
  const N = stops.length, NUMW = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열"][N] || String(N);
  const det = d.DETAILS[c.id];
  const info = Object.assign({}, c.info, d.INFOX[c.id] || {});
  const finalName = `${place} 보물 인장`;
  out[c.id] = {
    id: c.id, title: c.title, region: c.region, storageKey: `bomul-ar-${c.id}`,
    siteUrl: `../bomul.html#course-${c.id}`,
    center, insideRadius: Math.round(spread + 500), onsiteRadius: spread > 20000 ? 250 : 120,
    text: {
      place, side: `보물 여행 ${place} 편`, h1: c.title,
      story: [
        (det && det.intro) || c.summary,
        `코스 곳곳의 비석에는 이야기를 품은 보물이 하나씩 잠들어 있습니다. ${NUMW} 곳의 비석을 모두 탁본으로 떠서 「${finalName}」${hasJong(finalName) ? "을" : "를"} 완성하세요.`,
      ],
      duration: info["소요시간"] || "",
      unit: "보물", sealShort: "보물",
      deed: "이야기가 깃든 보물을 탁본으로 되찾아",
      allDone: `${NUMW} 곳의 보물을 모두 모았어요. 보물 상자가 나타났습니다.`,
    },
    final: { name: finalName, model: "models/jinhwabu.glb", nextSeason: "다른 지역 코스에서도 새로운 보물이 기다립니다. 보물 여행 전체 코스를 둘러보세요." },
    stops,
  };
}

const js = `/* 자동 생성 파일입니다. 직접 고치지 말고 tools/ar-courses/build.cjs를 다시 실행하세요. (${Object.keys(out).length}개 코스) */
window.BOMUL_COURSES = Object.assign(window.BOMUL_COURSES || {}, ${JSON.stringify(out, null, 1)});
`;
fs.writeFileSync(path.join(ROOT, "ar/data/courses.js"), js);
console.log(`ar/data/courses.js: ${Object.keys(out).length}개 코스, ${(js.length / 1024).toFixed(0)} KB`);
