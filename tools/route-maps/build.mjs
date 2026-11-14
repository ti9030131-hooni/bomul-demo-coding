/*
 * 보물 여행 — 코스 보물 지도(img/route-<코스>.jpg)를 실제 지리 자료로 다시 그립니다.
 *   node tools/route-maps/build.mjs            → tools/route-maps/out/*.svg
 *   python3 tools/route-maps/render.py         → client/public/img/route-<코스>.jpg (Chromium으로 그림)
 * 준비: npm i -D d3-geo d3-shape (저장소 맨 위) · pip install playwright pillow && playwright install chromium
 *       글꼴 Noto Sans CJK KR / Noto Serif CJK KR 이 설치되어 있어야 한글이 똑같이 나옵니다.
 *
 * 자료
 *  - 경유지 좌표: bomul.html 의 MAPGEO (코스 경유지 순서)
 *  - 해안선·시군구·읍면동 경계: 통계청(KOSTAT) 2018 경계, southkorea/southkorea-maps 변환본 (data/*.json)
 *  - 한강: 한강을 사이에 둔 시군구 경계(강 가운데 선)에서 뽑아냄 / 그 밖의 큰 강: Natural Earth 10m
 * 경복궁 궁궐 안 코스(seoul-gyeongbok-ar)는 손으로 그린 궁궐 배치도를 그대로 씁니다.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// d3-geo, d3-shape: 저장소에 설치되어 있으면 그것을, 아니면 D3_DIR(폴더)에서 찾습니다.  npm i -D d3-geo d3-shape
const D3 = process.env.D3_DIR || "/opt/npm-tools/node_modules";
const load = async (name) => { try { return await import(name); } catch { return import(path.join(D3, name, "src/index.js")); } };
const d3 = await load("d3-geo");
const shape = await load("d3-shape");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const require = createRequire(import.meta.url);
const extract = require(path.join(ROOT, "tools/ar-courses/extract.cjs"));
const site = extract(path.join(ROOT, "client/public/bomul.html"));
const PLACE = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/ar-courses/places.json"), "utf8"));
const OUT = path.join(HERE, "out");
fs.mkdirSync(OUT, { recursive: true });

const W = 1600, H = 1120;                       // 그림 크기(렌더할 때 1.5배 → 2400×1680)
const SKIP = new Set(["seoul-gyeongbok-ar", "fairy"]);
const only = process.argv.slice(2);

/* ── TopoJSON 읽기 (외부 라이브러리 없이) ── */
function loadTopo(file) {
  const t = JSON.parse(fs.readFileSync(path.join(HERE, "data", file), "utf8"));
  const [sx, sy] = t.transform.scale, [tx, ty] = t.transform.translate;
  const arcs = t.arcs.map((arc) => { let x = 0, y = 0; return arc.map(([dx, dy]) => [(x += dx) * sx + tx, (y += dy) * sy + ty]); });
  const geoms = Object.values(t.objects)[0].geometries;
  const arcCoords = (i) => (i < 0 ? arcs[~i].slice().reverse() : arcs[i]);
  const ring = (idx) => { const pts = []; idx.forEach((i, k) => { const c = arcCoords(i); pts.push(...(k ? c.slice(1) : c)); }); return pts; };
  const users = new Map();
  const features = geoms.map((g, gi) => {
    const polys = g.type === "Polygon" ? [g.arcs] : g.type === "MultiPolygon" ? g.arcs : [];
    polys.flat(2).forEach((i) => { const a = i < 0 ? ~i : i; if (!users.has(a)) users.set(a, new Set()); users.get(a).add(gi); });
    const coordinates = polys.map((p) => p.map(ring));
    return { type: "Feature", properties: g.properties, geometry: { type: "MultiPolygon", coordinates } };
  });
  features.forEach((f) => { f.bounds = d3.geoBounds(f); });
  // 두 지역이 함께 쓰는 경계선(filter(a,b)) 또는 한 지역만 쓰는 선(해안선·국경)
  const mesh = (filter) => {
    const lines = [];
    users.forEach((set, a) => { const u = [...set]; if (filter(u.map((i) => features[i]))) lines.push(arcs[a]); });
    return { type: "MultiLineString", coordinates: lines };
  };
  return { features, mesh };
}
const PROV = loadTopo("skorea-provinces-2018-topo.json");
const MUNI = loadTopo("skorea-municipalities-2018-topo.json");
const DONG = loadTopo("skorea-submunicipalities-2018-topo.json");
const INSET = loadTopo("skorea-provinces-2018-topo-simple.json");
const WATER = JSON.parse(fs.readFileSync(path.join(HERE, "data/ne-korea-water.json"), "utf8"));

// 한강: 북쪽 시군구와 남쪽 시군구가 맞닿은 선 = 강 한가운데
const HAN_N = new Set(["광진구", "성동구", "용산구", "마포구", "고양시덕양구", "고양시일산동구", "고양시일산서구", "구리시", "남양주시", "파주시"]);
const HAN_S = new Set(["강동구", "송파구", "강남구", "서초구", "동작구", "영등포구", "강서구", "김포시", "하남시"]);
const HAN = MUNI.mesh((fs2) => fs2.length === 2 && ((HAN_N.has(fs2[0].properties.name) && HAN_S.has(fs2[1].properties.name)) || (HAN_S.has(fs2[0].properties.name) && HAN_N.has(fs2[1].properties.name))));
const COAST = MUNI.mesh((fs2) => fs2.length === 1);
const MUNI_LINES = MUNI.mesh((fs2) => fs2.length === 2);
const DONG_LINES = DONG.mesh((fs2) => fs2.length === 2);
const PROV_LINES = PROV.mesh((fs2) => fs2.length === 2);

/* ── 도우미 ── */
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const textW = (s, size) => [...String(s)].reduce((w, ch) => w + (/[ᄀ-￿]/.test(ch) ? 1 : /[\s·.,()]/.test(ch) ? 0.34 : 0.56), 0) * size;
const hav = (a, b) => { const R = 6371, r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lng - a.lng) * r; const x = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const shortName = (n) => n.replace(/^(.+?시)(.+[구])$/, "$2");
const overlap = (a, b, pad = 4) => !(a.x + a.w + pad < b.x || b.x + b.w + pad < a.x || a.y + a.h + pad < b.y || b.y + b.h + pad < a.y);
const inView = (bx, view) => !(bx[1][0] < view[0][0] || bx[0][0] > view[1][0] || bx[1][1] < view[0][1] || bx[0][1] > view[1][1]);
const niceDist = (km) => { const c = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100]; return c.reduce((b, v) => (v <= km ? v : b), c[0]); };
const fmtDist = (km) => (km < 1 ? `${Math.round(km * 1000)}m` : `${+km.toFixed(1)}km`);

function build(course) {
  const geo = site.MAPGEO[course.id];
  const stops = course.stops.map((s, i) => ({ ...s, lat: geo[i]?.lat, lng: geo[i]?.lng, label: String(s.where || "").replace(/^보물\s*\d+\s*·\s*/, "").trim() || s.name }));
  const pts = stops.filter((s) => s.lat != null);
  // 지도 범위: 경유지 + 여백. 너무 좁으면 최소 폭을 둡니다.
  const proj = d3.geoMercator();
  const inner = [[270, 235], [W - 260, H - 250]];
  proj.fitExtent(inner, { type: "MultiPoint", coordinates: pts.map((s) => [s.lng, s.lat]) });
  const kmPerPx = () => { const a = proj.invert([0, H / 2]), b = proj.invert([W, H / 2]); return hav({ lat: a[1], lng: a[0] }, { lat: b[1], lng: b[0] }) / W; };
  const MIN_W_KM = 2.4;
  if (kmPerPx() * W < MIN_W_KM) {
    const c = proj.invert([(inner[0][0] + inner[1][0]) / 2, (inner[0][1] + inner[1][1]) / 2]);
    proj.scale(proj.scale() * (kmPerPx() * W) / MIN_W_KM).center(c).translate([W / 2, (inner[0][1] + inner[1][1]) / 2]);
    proj.rotate([0, 0]);
    const p = proj(c); proj.translate([proj.translate()[0] + (W / 2 - p[0]), proj.translate()[1] + ((inner[0][1] + inner[1][1]) / 2 - p[1])]);
  }
  proj.clipExtent([[-20, -20], [W + 20, H + 20]]);
  const pathGen = d3.geoPath(proj);
  const tl = proj.invert([0, 0]), br = proj.invert([W, H]);
  const view = [[tl[0], br[1]], [br[0], tl[1]]];
  const spanKm = kmPerPx() * W;
  const level = spanKm < 16 ? "dong" : spanKm < 110 ? "muni" : "prov";
  const pxPerKm = 1 / kmPerPx();
  const showDong = level === "dong" || (level === "muni" && spanKm < 45);

  const land = (level === "dong" ? DONG : MUNI).features.filter((f) => inView(f.bounds, view));
  const parts = [];
  // 바다·종이
  parts.push(`<rect width="${W}" height="${H}" fill="url(#sea)"/>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#waves)" opacity=".5"/>`);
  // 경위도선
  const step = spanKm < 4 ? 0.01 : spanKm < 12 ? 0.02 : spanKm < 40 ? 0.05 : spanKm < 120 ? 0.2 : 0.5;
  parts.push(`<path d="${pathGen(d3.geoGraticule().step([step, step]).extent([[view[0][0] - step, view[0][1] - step], [view[1][0] + step, view[1][1] + step]])())}" class="grat"/>`);
  // 땅
  parts.push(`<g class="land">${land.map((f) => `<path d="${pathGen(f)}"/>`).join("")}</g>`);
  parts.push(`<g filter="url(#inner)" opacity=".9"><path d="${land.map((f) => pathGen(f)).join("")}" fill="url(#landTex)"/></g>`);
  // 경계
  if (showDong) parts.push(`<path d="${pathGen(DONG_LINES)}" class="${level === "dong" ? "b-dong" : "b-dong2"}"/>`);
  if (level !== "prov") parts.push(`<path d="${pathGen(MUNI_LINES)}" class="b-muni"/>`);
  parts.push(`<path d="${pathGen(PROV_LINES)}" class="b-prov"/>`);
  // 해안선
  parts.push(`<path d="${pathGen(COAST)}" class="coast-glow"/><path d="${pathGen(COAST)}" class="coast"/>`);
  // 강
  const hanW = Math.max(3, Math.min(70, 0.8 * pxPerKm));   // 한강 폭 약 0.8km
  const hanD = pathGen(HAN);
  if (hanD) parts.push(`<path d="${hanD}" class="river" stroke-width="${hanW.toFixed(1)}"/><path d="${hanD}" class="river-hi" stroke-width="${Math.max(1, hanW * 0.18).toFixed(1)}"/>`);
  if (spanKm > 18) for (const f of WATER.features) {
    if (f.properties.name === "Han" && hanD) continue;
    const d = pathGen(f); if (d) parts.push(`<path d="${d}" class="river" stroke-width="3.5"/>`);
  }

  // 경유지 위치와 이름표 배치
  const P = stops.map((s) => (s.lat != null ? proj([s.lng, s.lat]) : null));
  const boxes = [];
  const reserved = [{ x: W / 2 - 360, y: 22, w: 720, h: 118 }, { x: 24, y: H - 190, w: 470, h: 168 }, { x: W - 330, y: H - 140, w: 306, h: 118 }, { x: W - 170, y: 30, w: 140, h: 150 }, { x: 30, y: 30, w: 210, h: 190 }];
  const pinBoxes = P.filter(Boolean).map(([x, y]) => ({ x: x - 24, y: y - 58, w: 48, h: 64 }));
  const nPts = P.filter(Boolean).length;
  const ordOf = (i) => P.slice(0, i + 1).filter(Boolean).length;
  const tagOf = (i) => (ordOf(i) === 1 ? { t: "출발", w: 58, c: "tag-start" } : ordOf(i) === nPts ? { t: "완주 보상", w: 92, c: "tag-end" } : null);
  const labels = stops.map((s, i) => {
    if (!P[i]) return null;
    const [x, y] = P[i];
    const t1 = s.label, t2 = s.name;
    const tag = tagOf(i);
    const w = Math.max(textW(t1, 25) + (tag ? tag.w + 12 : 0), textW(t2, 15.5)) + 30 + 34, h = 64;
    const cands = [[30, -22 - h / 2], [-30 - w, -22 - h / 2], [-w / 2, 16], [-w / 2, -66 - h], [28, -4], [-28 - w, -4], [28, -h - 40], [-28 - w, -h - 40], [-w / 2, 52], [-w / 2, -h - 100], [60, 30], [-60 - w, 30], [60, -h - 70], [-60 - w, -h - 70], [90, -22 - h / 2], [-90 - w, -22 - h / 2], [-w / 2, 110], [-w / 2, -h - 150]];
    let best = null, bestScore = Infinity;
    for (const [dx, dy] of cands) {
      const b = { x: x + dx, y: y + dy, w, h };
      let score = 0;
      if (b.x < 26 || b.y < 26 || b.x + b.w > W - 26 || b.y + b.h > H - 26) score += 1000;
      for (const o of boxes) if (overlap(b, o, 6)) score += 500;
      for (const o of reserved) if (overlap(b, o)) score += 300;
      pinBoxes.forEach((o) => { if (Math.abs(o.x + 24 - x) < 0.5 && Math.abs(o.y + 58 - y) < 0.5) return; if (overlap(b, o, 2)) score += 150; });
      if (P.some((q, j) => q && j !== i && Math.hypot(q[0] - (b.x + b.w / 2), q[1] - (b.y + b.h / 2)) < 30)) score += 60;
      score += Math.abs(dx) / 200 + (dy > 0 ? 0.2 : 0);
      if (score < bestScore) { bestScore = score; best = b; }
    }
    boxes.push(best);
    return { ...best, t1, t2, tag, px: x, py: y };
  });

  // 지명(동·구·시) — 이름표와 겹치지 않는 것만
  const areaFont = level === "dong" ? 15 : 14;
  const areaFeats = level === "dong" ? [...DONG.features.filter((f) => inView(f.bounds, view)), ...MUNI.features.filter((f) => inView(f.bounds, view))] : level === "muni" ? [...(showDong ? DONG.features.filter((f) => inView(f.bounds, view)) : []), ...MUNI.features.filter((f) => inView(f.bounds, view))] : [...PROV.features, ...MUNI.features].filter((f) => inView(f.bounds, view));
  const areaLabels = [];
  for (const f of areaFeats) {
    const isMajor = level === "prov" ? PROV.features.includes(f) : MUNI.features.includes(f);
    const a = pathGen.area(f);
    if (a < (isMajor ? 9000 : 5200)) continue;
    const c = pathGen.centroid(f);
    if (!c || !isFinite(c[0]) || c[0] < 60 || c[0] > W - 60 || c[1] < 60 || c[1] > H - 60) continue;
    const name = isMajor && level === "dong" ? shortName(f.properties.name) : shortName(f.properties.name);
    const size = isMajor ? (level === "dong" ? 23 : 21) : areaFont;
    const w = textW(name, size) * (isMajor ? 1.35 : 1.15), b = { x: c[0] - w / 2, y: c[1] - size, w, h: size * 1.4 };
    if ([...boxes, ...reserved, ...areaLabels.map((l) => l.b)].some((o) => overlap(b, o, 8)) || pinBoxes.some((o) => overlap(b, o, 4))) continue;
    areaLabels.push({ b, name, size, major: isMajor, c });
  }
  areaLabels.sort((a, b) => a.major - b.major);
  parts.push(areaLabels.map((l) => `<text x="${l.c[0].toFixed(1)}" y="${l.c[1].toFixed(1)}" class="${l.major ? "area-major" : "area"}" font-size="${l.size}">${esc(l.name)}</text>`).join(""));
  // 한강 이름
  if (hanD) {
    const seg = HAN.coordinates.flat().map((p) => proj(p)).filter((p) => p && p[0] > 120 && p[0] < W - 120 && p[1] > 160 && p[1] < H - 200);
    for (let k = Math.floor(seg.length / 2); k < seg.length - 4; k += 3) {
      const [a, b] = [seg[k], seg[k + 4]];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      const bx = { x: a[0] - 50, y: a[1] - 22, w: 100, h: 44 };
      if ([...boxes, ...reserved].some((o) => overlap(bx, o))) continue;
      parts.push(`<text transform="translate(${a[0].toFixed(1)} ${a[1].toFixed(1)}) rotate(${(Math.abs(ang) > 90 ? ang + 180 : ang).toFixed(1)})" class="river-name" dy="${(hanW / 2 + 22).toFixed(0)}">한 강</text>`);
      break;
    }
  }

  // 경로
  const routePts = P.filter(Boolean);
  const line = shape.line().curve(shape.curveCatmullRom.alpha(0.6));
  if (routePts.length > 1) {
    const d = line(routePts);
    parts.push(`<path d="${d}" class="route-glow"/><path d="${d}" class="route-base"/><path d="${d}" class="route"/>`);
  }
  // 이름표
  labels.forEach((l, i) => {
    if (!l) return;
    // 핀과 이름표를 잇는 가는 선
    const hy = l.py - 34, cx = Math.max(l.x, Math.min(l.px, l.x + l.w)), cy = Math.max(l.y, Math.min(hy, l.y + l.h));
    parts.push(`<line x1="${l.px}" y1="${hy}" x2="${cx}" y2="${cy}" class="leader"/>`);
    parts.push(`<g transform="translate(${l.x.toFixed(1)} ${l.y.toFixed(1)})"><rect width="${l.w.toFixed(1)}" height="${l.h}" rx="7" class="plate"/>
      <circle cx="26" cy="32" r="14" class="num-c"/><text x="26" y="38" class="num-t">${i + 1}</text>
      <text x="49" y="29" class="lab1">${esc(l.t1)}</text><text x="49" y="51" class="lab2">${esc(l.t2)}</text>
      ${l.tag ? `<g transform="translate(${(49 + textW(l.t1, 25) + 12).toFixed(1)} 9)"><rect width="${l.tag.w}" height="24" rx="12" class="${l.tag.c}"/><text x="${l.tag.w / 2}" y="17" class="tag">${l.tag.t}</text></g>` : ""}</g>`);
  });
  // 핀
  const n = routePts.length;
  let k = 0;
  stops.forEach((s, i) => {
    if (!P[i]) return;
    const [x, y] = P[i]; k++;
    const tag = "";
    parts.push(`<g transform="translate(${x.toFixed(1)} ${(y - 22).toFixed(1)})"><ellipse cy="22" rx="13" ry="4.5" fill="rgba(0,0,0,.45)"/>
      <path d="M0 22 C-6 12 -20 4 -20 -12 A20 20 0 1 1 20 -12 C20 4 6 12 0 22Z" fill="url(#pin)" stroke="#fff3c4" stroke-width="1.6"/>
      <circle cy="-12" r="13" fill="#1a2440"/><text y="-6.5" class="pin-n">${i + 1}</text></g>${tag}`);
  });

  // 제목
  const place = PLACE[course.id] || course.region;
  parts.push(`<g transform="translate(${W / 2} 34)"><rect x="-340" width="680" height="96" rx="6" class="cart"/><rect x="-332" y="8" width="664" height="80" rx="3" class="cart-in"/>
    <text y="52" class="title">${esc(course.title)}</text><text y="78" class="subtitle">${esc(place)} 보물 지도 · 실제 위치 기준</text></g>`);
  // 나침반
  parts.push(`<g transform="translate(${W - 98} 104)"><circle r="54" class="comp-ring"/><circle r="44" class="comp-ring2"/>
    <path d="M0 -48 L9 0 L0 48 L-9 0Z" fill="#c9a24e"/><path d="M0 -48 L9 0 L-9 0Z" fill="#f6dc8f"/><path d="M-48 0 L0 -6 L48 0 L0 6Z" fill="#7d6530"/>
    <text y="-62" class="comp-n">N</text></g>`);
  // 축척
  const sk = niceDist(spanKm / 5), sw = sk * pxPerKm;
  parts.push(`<g transform="translate(${(W - 52 - sw).toFixed(1)} ${H - 92})"><rect x="-20" y="-38" width="${(sw + 44).toFixed(0)}" height="74" rx="5" class="box"/>
    <text x="0" y="-12" class="small">축척</text>
    <rect x="0" y="4" width="${(sw / 2).toFixed(1)}" height="8" fill="#f2d78c"/><rect x="${(sw / 2).toFixed(1)}" y="4" width="${(sw / 2).toFixed(1)}" height="8" fill="none" stroke="#f2d78c"/>
    <text x="0" y="30" class="small">0</text><text x="${sw.toFixed(1)}" y="30" class="small" text-anchor="end">${fmtDist(sk)}</text></g>`);
  // 위치 안내도 (한반도 남쪽)
  const ip = d3.geoMercator().fitExtent([[44, 44], [226, 206]], { type: "FeatureCollection", features: INSET.features });
  const ig = d3.geoPath(ip);
  const a = ip([view[0][0], view[1][1]]), b = ip([view[1][0], view[0][1]]);
  const rw = Math.max(5, b[0] - a[0]), rh = Math.max(5, b[1] - a[1]);
  parts.push(`<g><rect x="30" y="30" width="210" height="190" rx="5" class="box"/>${INSET.features.map((f) => `<path d="${ig(f)}" class="inset"/>`).join("")}
    <rect x="${(a[0] + (b[0] - a[0] - rw) / 2).toFixed(1)}" y="${(a[1] + (b[1] - a[1] - rh) / 2).toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" class="inset-at"/>
    <text x="135" y="212" class="small" text-anchor="middle">위치</text></g>`);
  // 범례
  let dist = 0; for (let i = 1; i < pts.length; i++) dist += hav(pts[i - 1], pts[i]);
  const order = stops.map((s, i) => `${i + 1} ${s.label}`);
  const rows = []; let cur = "";
  order.forEach((o, i) => { const piece = (i ? " → " : "") + o; if (textW(cur + piece, 15) > 420) { rows.push(cur); cur = o; } else cur += piece; });
  rows.push(cur);
  parts.push(`<g transform="translate(24 ${H - 190})"><rect width="470" height="168" rx="6" class="box"/>
    <text x="22" y="36" class="leg-h">보물찾기 경로</text>
    <text x="22" y="62" class="small">보물 1 → ${stops.length} 순서대로 · 장소 사이 직선거리 합 약 ${fmtDist(dist)}</text>
    ${rows.slice(0, 3).map((r, i) => `<text x="22" y="${92 + i * 24}" class="leg">${esc(r)}</text>`).join("")}
    <text x="22" y="156" class="tiny">경계·해안선: 통계청 2018 · 하천: Natural Earth</text></g>`);

  const css = `
    .grat{fill:none;stroke:rgba(90,98,110,.10);stroke-width:1}
    .land path{fill:#f2f3f4;stroke:none}
    .b-dong{fill:none;stroke:rgba(90,98,110,.30);stroke-width:.9;stroke-dasharray:3 4}
    .b-dong2{fill:none;stroke:rgba(90,98,110,.20);stroke-width:.8;stroke-dasharray:2 4}
    .b-muni{fill:none;stroke:rgba(80,88,100,.50);stroke-width:1.5;stroke-dasharray:9 5}
    .b-prov{fill:none;stroke:rgba(70,76,86,.62);stroke-width:2.2}
    .coast{fill:none;stroke:#8fa3b6;stroke-width:1.6;stroke-linejoin:round}
    .coast-glow{fill:none;stroke:rgba(150,175,198,.35);stroke-width:9;stroke-linejoin:round}
    .river{fill:none;stroke:#b7cadb;stroke-linecap:round;stroke-linejoin:round}
    .river-hi{fill:none;stroke:rgba(255,255,255,.65);stroke-linecap:round;stroke-linejoin:round}
    .river-name{font:600 22px "Noto Serif CJK KR",serif;fill:#6f8aa3;letter-spacing:.4em;text-anchor:middle}
    .area{font-family:"Noto Sans CJK KR",sans-serif;font-weight:500;fill:rgba(70,76,86,.55);text-anchor:middle;letter-spacing:.06em}
    .area-major{font-family:"Noto Serif CJK KR",serif;font-weight:700;fill:rgba(55,60,70,.70);text-anchor:middle;letter-spacing:.28em}
    .route-glow{fill:none;stroke:rgba(214,160,60,.30);stroke-width:16;stroke-linecap:round;filter:url(#blur)}
    .route-base{fill:none;stroke:rgba(20,26,46,.80);stroke-width:7;stroke-linecap:round}
    .route{fill:none;stroke:#ffd77a;stroke-width:4;stroke-linecap:round;stroke-dasharray:2 11}
    .leader{stroke:rgba(20,26,46,.55);stroke-width:1.3}
    .plate{fill:rgba(10,16,34,.92);stroke:rgba(222,186,104,.8);stroke-width:1.3}
    .lab1{font:700 25px "Noto Serif CJK KR",serif;fill:#fff3d2}
    .lab2{font:500 15.5px "Noto Sans CJK KR",sans-serif;fill:#e3bf6c}
    .num-c{fill:#e2ad3f;stroke:#fff3c4;stroke-width:1.2}
    .num-t{font:800 16px "Noto Sans CJK KR",sans-serif;fill:#1a2440;text-anchor:middle}
    .pin-n{font:800 17px "Noto Sans CJK KR",sans-serif;fill:#ffe39a;text-anchor:middle}
    .tag{font:800 13px "Noto Sans CJK KR",sans-serif;fill:#fff;text-anchor:middle}
    .tag-start{fill:#2c7a5b;stroke:#bff0d6;stroke-width:1}
    .tag-end{fill:#b8322a;stroke:#ffd0c4;stroke-width:1}
    .cart{fill:#0c1530;stroke:#c9a24e;stroke-width:2}
    .cart-in{fill:none;stroke:rgba(201,162,78,.5);stroke-width:1}
    .title{font:700 38px "Noto Serif CJK KR",serif;fill:#f4d88e;text-anchor:middle;letter-spacing:.04em}
    .subtitle{font:500 14px "Noto Sans CJK KR",sans-serif;fill:#c9b07a;text-anchor:middle;letter-spacing:.32em}
    .comp-ring{fill:rgba(10,16,34,.9);stroke:#c9a24e;stroke-width:2}
    .comp-ring2{fill:none;stroke:rgba(201,162,78,.45);stroke-width:1;stroke-dasharray:2 5}
    .comp-n{font:700 22px "Noto Serif CJK KR",serif;fill:#3a3f47;text-anchor:middle}
    .box{fill:rgba(10,16,34,.92);stroke:#c9a24e;stroke-width:1.4}
    .small{font:500 14px "Noto Sans CJK KR",sans-serif;fill:#d8c290}
    .tiny{font:400 11.5px "Noto Sans CJK KR",sans-serif;fill:rgba(216,194,144,.6)}
    .leg-h{font:700 20px "Noto Serif CJK KR",serif;fill:#f4d88e}
    .leg{font:500 15px "Noto Sans CJK KR",sans-serif;fill:#efe2c0}
    .inset{fill:#22335e;stroke:rgba(201,162,78,.55);stroke-width:.6}
    .inset-at{fill:rgba(255,90,60,.25);stroke:#ff6a4d;stroke-width:2}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <radialGradient id="sea" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#e6e9ec"/><stop offset="1" stop-color="#d9dde1"/></radialGradient>
  <pattern id="waves" width="46" height="24" patternUnits="userSpaceOnUse"><path d="M0 12 Q11.5 4 23 12 T46 12" fill="none" stroke="rgba(130,150,170,.16)" stroke-width="1.2"/></pattern>
  <pattern id="landTex" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".6" fill="rgba(120,126,134,.06)"/></pattern>
  <linearGradient id="pin" x1="0" y1="-32" x2="0" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffe9a8"/><stop offset=".55" stop-color="#e2ad3f"/><stop offset="1" stop-color="#9c6a17"/></linearGradient>
  <filter id="blur"><feGaussianBlur stdDeviation="4"/></filter>
  <filter id="inner"><feGaussianBlur stdDeviation="0"/></filter>
  <filter id="shadow" x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity=".14"/></filter>
</defs>
<style>${css}</style>
${parts.join("\n")}
<rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="none" stroke="#c9a24e" stroke-width="3"/><rect x="18" y="18" width="${W - 36}" height="${H - 36}" fill="none" stroke="rgba(201,162,78,.45)" stroke-width="1"/>
</svg>`;
}

let made = 0;
for (const c of site.COURSES) {
  if (SKIP.has(c.id) || !site.MAPGEO[c.id]) continue;
  if (only.length && !only.includes(c.id)) continue;
  fs.writeFileSync(path.join(OUT, `route-${c.id}.svg`), build(c));
  made++;
}
console.log(`${made}개 지도 SVG → ${path.relative(ROOT, OUT)}`);
