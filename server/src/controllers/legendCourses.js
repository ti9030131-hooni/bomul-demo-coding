import LegendCourse from '../models/LegendCourse.js';
import legendSeed from '../data/legendCourses.json' with { type: 'json' };

// 주의: SEED_VERSION을 올리면 해당 코스 전체가 시드 내용으로 덮어쓰여 관리자 수정분이 사라집니다.
// AR 필드처럼 새 항목을 넣을 때는 SEED_VERSION 대신 아래 AR_SYNC_VERSION(빈 칸만 채움)을 올리세요.
const SEED_VERSION = 2;
const AR_SYNC_VERSION = 4;
const LEGEND_SEED = legendSeed;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function emptyToNull(value) {
  const trimmed = text(value);
  return trimmed || null;
}

function numberOrNull(value, min, max) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) throw httpError(400, `숫자 범위를 확인해 주세요. (${min}~${max})`);
  return n;
}

function textList(value, max = 20) {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean).slice(0, max) : [];
}

// 경유지 AR 설정 읽기
function readStopAr(ar = {}) {
  const opts = textList(ar.opts, 6);
  let a = ar.a === '' || ar.a === null || ar.a === undefined ? null : Number(ar.a);
  if (a !== null && (!Number.isInteger(a) || a < 0 || a >= opts.length)) {
    throw httpError(400, '수수께끼 정답 번호가 보기 범위를 벗어났습니다.');
  }
  if (text(ar.q) && opts.length && opts.length < 2) throw httpError(400, '수수께끼 보기는 2개 이상 넣어 주세요.');
  return {
    key: text(ar.key).replace(/[^\w-]/g, '').slice(0, 40),
    label: text(ar.label),
    piece: text(ar.piece),
    q: text(ar.q),
    qctx: text(ar.qctx),
    opts,
    a,
    explain: text(ar.explain),
    look: text(ar.look),
    cert: text(ar.cert),
    photo: text(ar.photo),
    restore: text(ar.restore),
    restoreYear: text(ar.restoreYear).slice(0, 40),
    restoreCaption: text(ar.restoreCaption).slice(0, 80),
    model: text(ar.model),
  };
}

// 코스 AR 설정 읽기
function readCourseAr(ar = {}) {
  return {
    enabled: ar.enabled !== false,
    place: text(ar.place).slice(0, 8),
    unit: text(ar.unit).slice(0, 4),
    finalName: text(ar.finalName),
    sealShort: text(ar.sealShort).slice(0, 2),
    h1: text(ar.h1),
    story: textList(ar.story, 4),
    deed: text(ar.deed),
    allDone: text(ar.allDone),
    duration: text(ar.duration),
    nextSeason: text(ar.nextSeason),
    storageKey: text(ar.storageKey).replace(/[^\w-]/g, '').slice(0, 60),
    onsiteRadius: numberOrNull(ar.onsiteRadius, 10, 5000),
    insideRadius: numberOrNull(ar.insideRadius, 50, 500000),
    finalModel: text(ar.finalModel),
  };
}

function publicStop(stop) {
  const plain = typeof stop.toObject === 'function' ? stop.toObject() : stop;
  return {
    where: plain.where || '',
    name: plain.name || '',
    desc: plain.desc || '',
    addr: plain.addr || '',
    lat: typeof plain.lat === 'number' ? plain.lat : null,
    lng: typeof plain.lng === 'number' ? plain.lng : null,
    ar: plain.ar || {},
  };
}

function toPublic(course) {
  return {
    id: course.slug,
    region: course.region,
    theme: course.theme,
    title: course.title,
    summary: course.summary,
    thumb: emptyToNull(course.thumb),
    hero: emptyToNull(course.hero),
    map: emptyToNull(course.map),
    info: {
      거리: emptyToNull(course.info?.거리),
      소요시간: emptyToNull(course.info?.소요시간),
      난이도: emptyToNull(course.info?.난이도),
      집결지: emptyToNull(course.info?.집결지),
    },
    stops: (course.stops ?? []).map(publicStop),
    stories: course.stories ?? [],
    ar: (typeof course.ar?.toObject === 'function' ? course.ar.toObject() : course.ar) || { enabled: true },
    updatedAt: course.updatedAt || null,
  };
}

export { toPublic };

function readBody(body) {
  const region = text(body.region);
  const theme = text(body.theme);
  const title = text(body.title);
  const summary = text(body.summary);
  if (!region || !theme || !title || !summary) {
    throw httpError(400, '지역, 테마, 제목, 설명을 입력해 주세요.');
  }

  const stops = Array.isArray(body.stops)
    ? body.stops
        .map((stop) => ({
          where: text(stop?.where),
          name: text(stop?.name),
          desc: text(stop?.desc),
          addr: text(stop?.addr),
          lat: numberOrNull(stop?.lat, -90, 90),
          lng: numberOrNull(stop?.lng, -180, 180),
          ar: readStopAr(stop?.ar),
          // 예전 관리자 화면처럼 좌표·AR 칸을 아예 보내지 않은 경우를 구분합니다(기존 값 보존용).
          _hasGeo: stop?.lat !== undefined || stop?.lng !== undefined,
          _hasAr: stop?.ar !== undefined,
        }))
        .filter((stop) => stop.where || stop.name || stop.desc || stop.addr)
    : [];
  const stories = Array.isArray(body.stories) ? body.stories.map((item) => text(item)).filter(Boolean) : [];

  return {
    region,
    theme,
    title,
    summary,
    thumb: text(body.thumb),
    hero: text(body.hero),
    map: text(body.map),
    info: {
      거리: text(body.info?.거리),
      소요시간: text(body.info?.소요시간),
      난이도: text(body.info?.난이도),
      집결지: text(body.info?.집결지),
    },
    stops,
    stories,
    ar: readCourseAr(body.ar),
    _hasAr: body.ar !== undefined,
  };
}

function stripFlags(data) {
  const rest = { ...data };
  delete rest._hasAr;
  rest.stops = rest.stops.map((stop) => {
    const clean = { ...stop };
    delete clean._hasGeo;
    delete clean._hasAr;
    return clean;
  });
  return rest;
}

// 보내지 않은 좌표·AR 칸은 기존 값을 그대로 둡니다(같은 장소 이름으로 찾음).
function keepMissing(next, current) {
  const old = (current.stops || []).map((stop) => (stop.toObject ? stop.toObject() : stop));
  const used = new Set();
  next.stops = next.stops.map((stop) => {
    const index = old.findIndex((item, k) => !used.has(k) && text(item.where) === stop.where && text(item.name) === stop.name);
    const match = index >= 0 ? old[index] : null;
    if (index >= 0) used.add(index);
    if (!match) return stop;
    return {
      ...stop,
      lat: stop._hasGeo ? stop.lat : match.lat ?? null,
      lng: stop._hasGeo ? stop.lng : match.lng ?? null,
      ar: stop._hasAr ? stop.ar : match.ar || {},
    };
  });
  if (!next._hasAr) next.ar = current.ar?.toObject ? current.ar.toObject() : current.ar || {};
  return next;
}

function seedDoc(course) {
  return {
    slug: course.id,
    region: course.region,
    theme: course.theme,
    title: course.title,
    summary: course.summary,
    thumb: course.thumb || '',
    hero: course.hero || '',
    map: course.map || '',
    info: {
      거리: course.info?.거리 || '',
      소요시간: course.info?.소요시간 || '',
      난이도: course.info?.난이도 || '',
      집결지: course.info?.집결지 || '',
    },
    stops: course.stops ?? [],
    stories: course.stories ?? [],
    ar: course.ar ?? {},
    syncVersion: SEED_VERSION,
    arSyncVersion: AR_SYNC_VERSION,
  };
}

// AR 필드 비파괴 이전: 관리자가 고친 내용은 그대로 두고, 비어 있는 좌표·AR 칸만 시드로 채웁니다.
async function migrateArFields() {
  // 필드가 아예 없는 예전 문서도 잡도록 $exists 조건을 함께 씁니다($lt만 쓰면 빠짐).
  const pending = await LegendCourse.find({ $or: [{ arSyncVersion: { $exists: false } }, { arSyncVersion: { $lt: AR_SYNC_VERSION } }] });
  if (!pending.length) return;
  // 이번 이전에서 새로 생긴 시드 코스(arSince가 현재 버전)는 한 번만 넣습니다.
  // 이전이 끝난 뒤 관리자가 지우면 다시 생기지 않습니다.
  for (const course of LEGEND_SEED.filter((item) => item.arSince === AR_SYNC_VERSION)) {
    if (await LegendCourse.exists({ slug: course.id })) continue;
    try {
      await LegendCourse.create(seedDoc(course));
    } catch (error) {
      // 서버 여러 대(Vercel 등)가 동시에 넣으려 하면 한쪽은 중복 오류가 납니다. 이미 들어갔으니 무시합니다.
      if (error?.code !== 11000) throw error;
    }
  }
  const seedById = new Map(LEGEND_SEED.map((course) => [course.id, course]));
  for (const doc of pending) {
    const seed = seedById.get(doc.slug);
    if (seed) {
      doc.stops.forEach((stop, index) => {
        const seedStop = seed.stops?.[index];
        // 같은 자리에 같은 장소일 때만 좌표를 채웁니다(관리자가 순서를 바꿨으면 건너뜀).
        if (!seedStop || text(seedStop.where) !== text(stop.where)) return;
        if (stop.lat == null && typeof seedStop.lat === 'number') stop.lat = seedStop.lat;
        if (stop.lng == null && typeof seedStop.lng === 'number') stop.lng = seedStop.lng;
        if (seedStop.ar) {
          const current = stop.ar?.toObject ? stop.ar.toObject() : stop.ar || {};
          const merged = { ...current };
          for (const [key, value] of Object.entries(seedStop.ar)) {
            const empty = merged[key] === undefined || merged[key] === null || merged[key] === '' || (Array.isArray(merged[key]) && !merged[key].length);
            if (empty) merged[key] = value;
          }
          stop.ar = merged;
        }
      });
      const currentAr = doc.ar?.toObject ? doc.ar.toObject() : doc.ar || {};
      const mergedAr = { ...currentAr };
      for (const [key, value] of Object.entries(seed.ar || {})) {
        const empty = mergedAr[key] === undefined || mergedAr[key] === null || mergedAr[key] === '' || (Array.isArray(mergedAr[key]) && !mergedAr[key].length);
        if (empty) mergedAr[key] = value;
      }
      doc.ar = mergedAr;
      doc.markModified('stops');
    }
    doc.arSyncVersion = AR_SYNC_VERSION;
    await doc.save();
  }
}

async function removeDuplicateLegendCourses() {
  const docs = await LegendCourse.find().select('slug syncVersion').lean();
  const groups = new Map();
  for (const doc of docs) {
    const list = groups.get(doc.slug) || [];
    list.push(doc);
    groups.set(doc.slug, list);
  }
  const stale = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => (b.syncVersion || 0) - (a.syncVersion || 0));
    stale.push(...list.slice(1).map((doc) => doc._id));
  }
  if (stale.length) await LegendCourse.deleteMany({ _id: { $in: stale } });
  await LegendCourse.syncIndexes();
}

export async function seedLegendCourses() {
  await removeDuplicateLegendCourses();
  const alreadySeeded = await LegendCourse.exists({ syncVersion: { $gte: SEED_VERSION } });
  for (const course of LEGEND_SEED) {
    const current = await LegendCourse.findOne({ slug: course.id });
    if (!current) {
      if (!alreadySeeded) await LegendCourse.create(seedDoc(course));
      continue;
    }
    if ((current.syncVersion || 0) < SEED_VERSION) {
      await LegendCourse.updateOne({ slug: course.id }, seedDoc(course));
    }
  }
  await migrateArFields();
}

export async function listLegendCourses(req, res) {
  const courses = await LegendCourse.find();
  const order = new Map(LEGEND_SEED.map((course, index) => [course.id, index]));
  courses.sort((a, b) => {
    const left = order.has(a.slug) ? order.get(a.slug) : 1000;
    const right = order.has(b.slug) ? order.get(b.slug) : 1000;
    return left - right || a.title.localeCompare(b.title, 'ko');
  });
  res.json(courses.map(toPublic));
}

export async function getLegendCourse(req, res) {
  const course = await LegendCourse.findOne({ slug: req.params.slug });
  if (!course) throw httpError(404, '코스를 찾을 수 없습니다.');
  res.json(toPublic(course));
}

export async function createLegendCourse(req, res) {
  const course = await LegendCourse.create({
    slug: `legend-${Date.now().toString(36)}`,
    ...stripFlags(readBody(req.body)),
    arSyncVersion: AR_SYNC_VERSION,
  });
  res.status(201).json(toPublic(course));
}

export async function updateLegendCourse(req, res) {
  const current = await LegendCourse.findOne({ slug: req.params.slug });
  if (!current) throw httpError(404, '코스를 찾을 수 없습니다.');
  const next = stripFlags(keepMissing(readBody(req.body), current));
  const course = await LegendCourse.findOneAndUpdate({ slug: req.params.slug }, next, {
    new: true,
    runValidators: true,
  });
  res.json(toPublic(course));
}

export async function deleteLegendCourse(req, res) {
  const course = await LegendCourse.findOneAndDelete({ slug: req.params.slug });
  if (!course) throw httpError(404, '코스를 찾을 수 없습니다.');
  res.json({ message: '코스를 삭제했습니다.' });
}

// 테스트용(서버 동작에는 쓰이지 않음)
export const _internal = { readBody, keepMissing, stripFlags, readStopAr };
