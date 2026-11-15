/*
 * 전설 코스(DB) → AR 탁본 코스(JSON) 변환
 *
 * 관리자 페이지에서 고친 코스가 /ar/course.html 에 그대로 반영되도록,
 * 서버가 요청을 받을 때마다 이 함수로 AR 데이터를 만듭니다.
 * (예전에는 tools/ar-courses/build.cjs 가 bomul.html 에서 미리 만들어 둔 정적 파일만 썼습니다)
 *
 * 이 파일은 DB·Express에 의존하지 않는 순수 함수만 둡니다. → server/test/arCourse.test.mjs 로 검사합니다.
 */

import { completionRewardPoints } from './arOnsite.js';

export const AR_MODELS = [
  'models/haechi-horn.glb',
  'models/deume-mirror.glb',
  'models/dragon-pearl.glb',
  'models/amisan-chimney.glb',
  'models/mulbul-ember.glb',
];
export const FINAL_MODEL = 'models/jinhwabu.glb';
const ORDW = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째', '아홉째', '열째'];
const NUMW = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];

export function hasJong(word) {
  const c = String(word || '').trim().slice(-1).charCodeAt(0);
  return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 > 0 : false;
}
const eul = (w) => (hasJong(w) ? '을' : '를');

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
// 관리자가 쓴 글은 HTML로 넣지 않고, 줄바꿈만 <br>로 바꿉니다.
const textHtml = (value) => escapeHtml(value).replace(/\n/g, '<br>');

function hash(str) {
  let h = 2166136261;
  for (const ch of String(str)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function shuffle(list, seed) {
  const a = list.slice();
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const firstSentence = (t) => {
  const m = String(t).match(/^(.+?[.!?。])(\s|$)/);
  return (m ? m[1] : String(t)).trim();
};
const clip = (t, n) => (t.length > n ? `${t.slice(0, n - 1).trim()}…` : t);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v) => (typeof v === 'string' ? v.trim() : '');

function haversine(a, b) {
  const R = 6371000;
  const r = Math.PI / 180;
  const dl = (b.lat - a.lat) * r;
  const dn = (b.lng - a.lng) * r;
  const x = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function withCourseReward(prizes, course) {
  if (!prizes?.length) return prizes;
  const points = completionRewardPoints(course);
  const won = points.toLocaleString('ko-KR');
  return prizes.map((prize) => (
    prize?.icon === 'point'
      ? { ...prize, points, desc: `현장 완주 적립금 ${won}P입니다. 데모 모드 완주는 적립되지 않아요.` }
      : prize
  ));
}

/** 다른 코스의 보물 이름 목록(보기 수가 모자랄 때 섞어 씁니다) */
export function piecePool(courses) {
  return courses.flatMap((c) => (c.stops || []).map((s) => ({ region: c.region, piece: str(s.ar?.piece) || str(s.name) })));
}

/**
 * @param course  toPublic() 결과와 같은 모양 { id, region, title, summary, hero, thumb, info, stops[], ar }
 * @param options { pool: piecePool(전체 코스), settings: { prizes, pointShop } }
 */
export function buildArCourse(course, { pool = [], settings = {} } = {}) {
  const ar = course.ar || {};
  const stopsIn = (course.stops || []).filter((s) => str(s.where) || str(s.name));
  const N = stopsIn.length;
  if (!N) return null;
  const place = str(ar.place) || course.region || course.title;
  const unit = str(ar.unit) || '보물';
  const finalName = str(ar.finalName) || `${place} 보물 인장`;
  const numw = NUMW[N] || String(N);
  const coursePhoto = str(course.hero) || str(course.thumb) || '/img/seoul-poster.jpg';

  const wheres = stopsIn.map((s) => str(s.where).replace(/^보물\s*\d+\s*·\s*/, ''));
  const dup = new Set(wheres.filter((w, i) => w && wheres.indexOf(w) !== i));
  const pieces = stopsIn.map((s) => str(s.ar?.piece) || str(s.name) || `보물 ${N}`);

  const stops = stopsIn.map((s, i) => {
    const o = s.ar || {};
    const [storyRaw, missionRaw] = str(s.desc).split('[미션]');
    const story = str(storyRaw);
    const piece = pieces[i];
    const label = str(o.label) || (!wheres[i] ? `${place} ${i + 1}` : dup.has(wheres[i]) ? `${wheres[i]} ${i + 1}` : wheres[i]);

    // 관리자가 수수께끼를 직접 넣었으면 그대로, 아니면 이야기로 자동 생성
    let q;
    let opts;
    let a;
    const customOpts = Array.isArray(o.opts) ? o.opts.map(str).filter(Boolean) : [];
    if (str(o.q) && customOpts.length >= 2 && Number.isInteger(o.a) && o.a >= 0 && o.a < customOpts.length) {
      q = str(o.q);
      opts = customOpts;
      a = o.a;
    } else {
      const own = pieces.filter((_, k) => k !== i);
      let picks = shuffle(own, hash(`${course.id}${i}`)).slice(0, 3);
      if (picks.length < 3) {
        const sameRegion = pool.filter((p) => p.region === course.region).map((p) => p.piece);
        const extra = [...new Set([...shuffle(sameRegion, hash(`${course.id}x${i}`)), ...shuffle(pool.map((p) => p.piece), hash(`${course.id}y${i}`))])]
          .filter((p) => p && p !== piece && !own.includes(p));
        picks = picks.concat(extra.slice(0, 3 - picks.length));
      }
      opts = shuffle([piece, ...picks], hash(`${course.id}o${i}`));
      a = opts.indexOf(piece);
      q = '탁본에 새겨진 이야기를 읽고, 이곳에 잠든 보물의 이름을 골라 보세요.';
    }
    const qctx = str(o.qctx) || (str(o.q) ? '' : clip(firstSentence(story), 90));

    return {
      id: str(o.key) || `s${i + 1}`,
      name: label,
      mark: unit === '보물' ? `${ORDW[i] || `${i + 1}째`} 보물` : `${ORDW[i] || `${i + 1}째`} ${unit}`,
      lat: num(s.lat),
      lng: num(s.lng),
      photo: str(o.photo) || coursePhoto,
      photoAlt: `${course.title} 참고 이미지`,
      restore: str(o.restore),
      restoreYear: str(o.restoreYear),
      restoreCaption: str(o.restoreCaption),
      addr: str(s.addr),
      model: str(o.model) || AR_MODELS[i % AR_MODELS.length],
      piece,
      story,
      look: str(o.look) || str(missionRaw) || '현장 안내판과 주변을 둘러보며 이야기의 흔적을 찾아보세요.',
      qctx,
      q,
      opts,
      a,
      explain: str(o.explain) || `${story} 자세한 이야기는 보물 여행 코스 상세 페이지에서 더 볼 수 있어요.`,
      cert: str(o.cert) || `${clip(firstSentence(story), 64)} 「${piece}」${eul(piece)} 찾음.`,
    };
  });

  const pts = stops.filter((s) => s.lat != null && s.lng != null);
  const center = pts.length
    ? { lat: pts.reduce((t, s) => t + s.lat, 0) / pts.length, lng: pts.reduce((t, s) => t + s.lng, 0) / pts.length }
    : null;
  const spread = center ? Math.max(...pts.map((s) => haversine(center, s))) : 0;
  const story = Array.isArray(ar.story) && ar.story.length
    ? ar.story.map(textHtml)
    : [
        textHtml(course.summary),
        textHtml(`코스 곳곳의 비석에는 이야기를 품은 보물이 하나씩 잠들어 있습니다. ${numw} 곳의 비석을 모두 탁본으로 떠서 「${finalName}」${eul(finalName)} 완성하세요.`),
      ];

  return {
    id: course.id,
    title: course.title,
    region: course.region,
    source: 'server',
    storageKey: str(ar.storageKey) || `bomul-ar-${course.id}`,
    siteUrl: `../bomul.html#course-${course.id}`,
    center,
    insideRadius: num(ar.insideRadius) || Math.round(spread + 500),
    onsiteRadius: num(ar.onsiteRadius) || (spread > 20000 ? 250 : 120),
    text: {
      place,
      side: `보물 여행 ${place} 편`,
      h1: textHtml(str(ar.h1) || course.title),
      story,
      duration: str(ar.duration) || str(course.info?.소요시간),
      unit,
      sealShort: (str(ar.sealShort) || '보물').slice(0, 2),
      deed: str(ar.deed) || '이야기가 깃든 보물을 탁본으로 되찾아',
      allDone: str(ar.allDone) || `${numw} 곳의 ${unit}${eul(unit)} 모두 모았어요. 보물 상자가 나타났습니다.`,
    },
    final: {
      name: finalName,
      model: str(ar.finalModel) || FINAL_MODEL,
      nextSeason: str(ar.nextSeason) || '다른 지역 코스에서도 새로운 보물이 기다립니다. 보물 여행 전체 코스를 둘러보세요.',
      prizes: withCourseReward(settings.prizes, {
        title: course.title,
        summary: course.summary,
        duration: str(ar.duration) || str(course.info?.소요시간),
        stops,
      }),
    },
    pointShop: settings.pointShop || undefined,
    stops,
  };
}
