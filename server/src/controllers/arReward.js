import LegendCourse from '../models/LegendCourse.js';
import ArProgress from '../models/ArProgress.js';
import ArWallet from '../models/ArWallet.js';
import User from '../models/User.js';
import { toPublic } from './legendCourses.js';
import { readSettings } from './ar.js';
import { buildArCourse } from '../services/arCourse.js';
import { elapsedFromCheckins, rankWeekly, seoulWeekRange } from '../services/arLeaderboard.js';
import { completionRewardPoints, couponCode, isCourseOnsiteComplete, judgeOnsiteCheckin } from '../services/arOnsite.js';
import { appendCheckinAtomic } from '../services/arCheckin.js';

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const text = (value) => (typeof value === 'string' ? value.trim() : '');

async function loadArCourse(slug) {
  const course = await LegendCourse.findOne({ slug });
  if (!course || course.ar?.enabled === false) throw httpError(404, 'AR 코스를 찾을 수 없습니다.');
  const built = buildArCourse(toPublic(course), { pool: [], settings: {} });
  if (!built) throw httpError(404, '경유지가 없는 코스입니다.');
  return built;
}

function presentHistory(item) {
  return {
    type: item.type,
    courseId: item.courseId || '',
    itemId: item.itemId || '',
    name: item.name || '',
    points: item.points,
    code: item.code || '',
    at: item.at ? new Date(item.at).toISOString() : null,
  };
}

function presentWallet(wallet, extra = {}) {
  const completions = wallet.completions || [];
  return {
    points: wallet.points || 0,
    history: (wallet.history || []).map(presentHistory),
    completions: completions.map((item) => ({
      courseId: item.courseId,
      earned: item.earned,
      at: item.at ? new Date(item.at).toISOString() : null,
    })),
    eligible: completions.length > 0,
    ...extra,
  };
}

async function loadWallet(userId) {
  const existing = await ArWallet.findOne({ user: userId });
  return existing || new ArWallet({ user: userId, points: 0, history: [], completions: [] });
}

/** 지갑 문서가 없으면 빈 지갑을 만들고, 이미 있으면 그대로 둡니다. */
async function ensureWallet(userId) {
  const existing = await ArWallet.findOne({ user: userId }).select('_id').lean();
  if (existing) return;
  try {
    await ArWallet.updateOne(
      { user: userId },
      { $setOnInsert: { user: userId, points: 0, history: [], completions: [] } },
      { upsert: true },
    );
  } catch (err) {
    // 동시 요청 upsert가 unique(user)에서 충돌해도 다른 요청이 이미 만든 지갑이므로 통과
    if (err && (err.code === 11000 || err.code === 11001)) return;
    throw err;
  }
}

function readSample(body) {
  return {
    lat: Number(body?.lat),
    lng: Number(body?.lng),
    accuracy: Number(body?.accuracy),
    at: body?.at != null ? Number(body.at) : Date.now(),
  };
}

/** POST /api/ar/checkin — 현장 GPS 인증. 통과한 장소만 계정에 남긴다. */
export async function postCheckin(req, res) {
  const courseId = text(req.body?.courseId);
  const stopId = text(req.body?.stopId);
  if (!courseId || !stopId) throw httpError(400, '코스와 장소를 확인해 주세요.');

  const built = await loadArCourse(courseId);
  const stop = built.stops.find((item) => item.id === stopId);
  if (!stop) throw httpError(404, '장소를 찾을 수 없습니다.');

  const progress = await ArProgress.findOne({ user: req.user._id, courseId });
  if (progress?.checkins?.some((item) => item.stopId === stopId)) {
    res.json({
      onsite: true,
      already: true,
      stopId,
      complete: isCourseOnsiteComplete(built.stops.map((item) => item.id), progress.checkins),
    });
    return;
  }

  const previousDoc = (progress?.checkins || []).slice().sort((a, b) => new Date(a.at) - new Date(b.at)).at(-1);
  const judged = judgeOnsiteCheckin({
    stop: { id: stop.id, lat: stop.lat, lng: stop.lng },
    sample: readSample(req.body),
    previous: previousDoc
      ? {
        stopId: previousDoc.stopId,
        lat: previousDoc.lat,
        lng: previousDoc.lng,
        at: new Date(previousDoc.at).getTime(),
      }
      : null,
    onsiteRadius: built.onsiteRadius || 120,
  });
  if (!judged.ok) throw httpError(403, judged.message);

  const sample = readSample(req.body);
  const entry = {
    stopId,
    lat: sample.lat,
    lng: sample.lng,
    accuracy: sample.accuracy,
    at: new Date(sample.at),
  };
  const saved = await appendCheckinAtomic(ArProgress, {
    userId: req.user._id,
    courseId,
    stopId,
    entry,
  });
  res.json({
    onsite: true,
    already: saved.already,
    stopId,
    complete: isCourseOnsiteComplete(built.stops.map((item) => item.id), saved.progress?.checkins || []),
  });
}

/** POST /api/ar/complete — 현장 완주 시 적립금 지급(코스당 한 번) */
export async function postComplete(req, res) {
  const courseId = text(req.body?.courseId);
  if (!courseId) throw httpError(400, '코스를 확인해 주세요.');
  const built = await loadArCourse(courseId);
  const progress = await ArProgress.findOne({ user: req.user._id, courseId });
  if (!progress || !isCourseOnsiteComplete(built.stops.map((item) => item.id), progress.checkins)) {
    throw httpError(403, '현장 인증으로 코스를 모두 완주해야 적립금과 상품·상금을 받을 수 있습니다.');
  }

  const earned = completionRewardPoints({
    title: built.title,
    duration: built.text?.duration,
    stops: built.stops,
  });
  const now = new Date();
  await ensureWallet(req.user._id);

  // 코스당 1회만 적립: completions에 courseId가 없을 때만 원자적으로 반영 (동시 요청 중복 방지)
  const update = {
    $push: {
      completions: { courseId, earned, at: now },
    },
  };
  if (earned) {
    update.$inc = { points: earned };
    update.$push.history = {
      type: 'earn',
      courseId,
      name: `${built.title} 완주 적립금`,
      points: earned,
      at: now,
    };
  }

  const awarded = await ArWallet.findOneAndUpdate(
    { user: req.user._id, 'completions.courseId': { $ne: courseId } },
    update,
    { new: true },
  );
  if (!awarded) {
    const wallet = await ArWallet.findOne({ user: req.user._id }).lean();
    res.json(presentWallet(wallet || { points: 0, history: [], completions: [] }, { earned: 0, already: true, courseId }));
    return;
  }
  res.json(presentWallet(awarded, { earned, already: false, courseId }));
}

/** GET /api/ar/leaderboard/:courseId — 이번 주 현장 완주, 소요 시간이 짧은 순 */
export async function getLeaderboard(req, res) {
  const courseId = text(req.params.courseId);
  if (!courseId) throw httpError(400, '코스를 확인해 주세요.');
  const built = await loadArCourse(courseId);
  const week = seoulWeekRange(new Date());
  const wallets = await ArWallet.find({
    completions: { $elemMatch: { courseId, at: { $gte: week.start, $lt: week.end } } },
  }).select('user completions').lean();

  const userIds = wallets.map((wallet) => wallet.user);
  const [users, progresses] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select('nickname').lean(),
    ArProgress.find({ user: { $in: userIds }, courseId }).select('user checkins').lean(),
  ]);
  const nicknames = new Map(users.map((user) => [String(user._id), user.nickname]));
  const checkins = new Map(progresses.map((item) => [String(item.user), item.checkins]));

  const rows = [];
  for (const wallet of wallets) {
    const done = (wallet.completions || []).find((item) => item.courseId === courseId && item.at >= week.start && item.at < week.end);
    if (!done) continue;
    const elapsedMs = elapsedFromCheckins(checkins.get(String(wallet.user)), done.at);
    if (elapsedMs == null) continue;
    const nickname = (nicknames.get(String(wallet.user)) || '').trim() || '완주자';
    rows.push({
      nickname,
      elapsedMs,
      finishedAt: new Date(done.at).toISOString(),
    });
  }

  res.json({
    courseId,
    title: built.title,
    week: { start: week.start.toISOString(), end: week.end.toISOString(), label: week.label },
    rows: rankWeekly(rows).slice(0, 20).map(({ rank, nickname, elapsedMs, finishedAt }) => ({
      rank,
      nickname,
      elapsedMs,
      finishedAt,
    })),
  });
}

/** GET /api/ar/wallet */
export async function getWallet(req, res) {
  const wallet = await ArWallet.findOne({ user: req.user._id });
  res.json(presentWallet(wallet || { points: 0, history: [], completions: [] }));
}

/** POST /api/ar/redeem — 현장 완주 이력이 있는 계정만 상품 교환 */
export async function postRedeem(req, res) {
  const itemId = text(req.body?.itemId);
  if (!itemId) throw httpError(400, '상품을 확인해 주세요.');
  const wallet = await loadWallet(req.user._id);
  if (!wallet.completions.length) {
    throw httpError(403, '현장 인증으로 코스를 완주한 뒤에만 상품을 교환할 수 있습니다.');
  }
  const settings = await readSettings();
  const item = (settings.pointShop || []).find((entry) => entry.id === itemId);
  if (!item) throw httpError(404, '상품을 찾을 수 없습니다.');
  if ((wallet.points || 0) < item.points) throw httpError(400, '적립금이 부족합니다.');

  wallet.points -= item.points;
  const code = couponCode('BMP');
  wallet.history.push({
    type: 'use',
    itemId: item.id,
    name: item.name,
    points: item.points,
    code,
    at: new Date(),
  });
  await wallet.save();
  res.json({
    ...presentWallet(wallet),
    code,
    item: { id: item.id, name: item.name, points: item.points },
  });
}
