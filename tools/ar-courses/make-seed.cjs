/*
 * 서버 시드(server/src/data/legendCourses.json)에 AR 정보를 채웁니다.
 *   node tools/ar-courses/make-seed.cjs
 *  - 각 경유지에 좌표(lat/lng): bomul.html의 MAPGEO
 *  - 각 코스에 ar.place(비석·표지에 쓰는 짧은 지역 이름)
 *  - 경복궁 AR 특별 코스(seoul-gyeongbok-ar)를 손으로 다듬은 문항과 함께 맨 앞에 추가
 * 한 번 만들어 커밋하면 됩니다. 이미 DB에 있는 코스는 서버의 비파괴 이전(migrateArFields)이 빈 칸만 채웁니다.
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const extract = require("./extract.cjs");
const ROOT = path.join(__dirname, "../..");
const SEED = path.join(ROOT, "server/src/data/legendCourses.json");
const d = extract(path.join(ROOT, "client/public/bomul.html"));
const seed = JSON.parse(fs.readFileSync(SEED, "utf8")).filter((c) => c.id !== "seoul-gyeongbok-ar");
const PLACE = require("./places.json");

for (const c of seed) {
  const geo = d.MAPGEO[c.id] || [];
  c.stops = c.stops.map((s, i) => ({ ...s, lat: geo[i] ? geo[i].lat : null, lng: geo[i] ? geo[i].lng : null }));
  c.ar = { ...(c.ar || {}), enabled: true, place: PLACE[c.id] || c.region };
}

// 경복궁 특별 코스: 사이트 코스 정보 + AR 손질본
const site = d.COURSES.find((c) => c.id === "seoul-gyeongbok-ar");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "client/public/ar/data/gyeongbok.js"), "utf8"), sandbox);
const g = sandbox.window.BOMUL_COURSES["seoul-gyeongbok-ar"];
const abs = (p) => String(p || "").replace(/^\.\.\//, "/");
const gyeongbok = {
  arSince: 1, // 서버 AR_SYNC_VERSION 1에서 새로 넣는 코스
  id: site.id, region: site.region, theme: site.theme, title: site.title, summary: site.summary,
  thumb: "/" + site.thumb, hero: "/" + site.hero, map: "/" + site.map, info: site.info,
  stops: site.stops.map((s, i) => {
    const a = g.stops[i];
    return {
      ...s, lat: a.lat, lng: a.lng,
      ar: { key: a.id, label: a.name, piece: a.piece, q: a.q, opts: a.opts, a: a.a, explain: a.explain, look: a.look, cert: a.cert, photo: abs(a.photo), model: a.model },
    };
  }),
  stories: site.stories,
  ar: {
    enabled: true, place: g.text.place, unit: g.text.unit, finalName: g.final.name, sealShort: g.text.sealShort,
    h1: g.text.h1.replace(/<br>/g, "\n"), story: g.text.story, deed: g.text.deed, allDone: g.text.allDone,
    duration: g.text.duration, nextSeason: g.final.nextSeason, storageKey: g.storageKey,
    onsiteRadius: g.onsiteRadius, insideRadius: g.insideRadius,
  },
};
const out = [gyeongbok, ...seed];
fs.writeFileSync(SEED, JSON.stringify(out, null, 2) + "\n");
console.log(`legendCourses.json: ${out.length}개 코스 (좌표 ${out.reduce((t, c) => t + c.stops.filter((s) => s.lat != null).length, 0)}곳)`);
