// 완주 보상 추첨 — 시즌마다 1인 1회 응모 (결제 직연동 없음 · PortOne 미의존)
import DrawEntry from '../models/DrawEntry.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import LegendCourse from '../models/LegendCourse.js';
import legendSeed from '../data/legendCourses.json' with { type: 'json' };
import { budgetSummary, drawConfig, isOpen, pickWinners, publicDraw } from '../services/draw.js';

function httpError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

const validCourseId = (id) => typeof id === 'string' && /^[a-z0-9-]{1,60}$/.test(id);

const publicEntry = (e) =>
  e && {
    season: e.season,
    courseId: e.courseId,
    courseTitle: e.courseTitle,
    source: e.source || 'completion',
    createdAt: e.createdAt,
    prizeRank: e.prizeRank,
  };

async function courseTitle(slug) {
  const doc = await LegendCourse.findOne({ slug }).select('title').lean();
  if (doc) return doc.title;
  const seed = legendSeed.find((c) => c.id === slug);
  return seed ? seed.title : null;
}

/** 기존 멤버십만 확인 (CourseTicket/이니시스 미사용) */
function hasMembershipAccess(user, courseId) {
  if (!user) return false;
  if (user.user_type === 'admin') return true;
  if (user.membership?.active) return true;
  const courses = Array.isArray(user.membership?.courses) ? user.membership.courses : [];
  return courses.includes(courseId);
}

/** GET /api/draw — 이번 시즌 추첨 안내(공개) */
export function getDraw(req, res) {
  res.json(publicDraw());
}

/** GET /api/draw/me — 내 응모 */
export async function getMyEntry(req, res) {
  const entry = await DrawEntry.findOne({ season: drawConfig.season, user: req.user._id }).lean();
  res.json({ season: drawConfig.season, entered: !!entry, entry: publicEntry(entry) });
}

/** POST /api/draw/entries — { courseId, source: completion|free } */
export async function enterDraw(req, res) {
  if (!isOpen()) throw httpError(409, '이번 시즌 추첨 응모가 끝났어요.', 'DRAW_CLOSED');
  const source = req.body.source === 'free' ? 'free' : 'completion';
  if (source === 'free' && drawConfig.freeEntry === false) {
    throw httpError(403, '무료 응모를 받지 않는 시즌이에요.', 'FREE_ENTRY_OFF');
  }
  const courseId = typeof req.body.courseId === 'string' ? req.body.courseId.trim() : '';
  if (!validCourseId(courseId)) throw httpError(400, '코스를 찾을 수 없습니다.');

  const existing = await DrawEntry.findOne({ season: drawConfig.season, user: req.user._id }).lean();
  if (existing) {
    return res.json({
      entered: true,
      already: true,
      entry: publicEntry(existing),
      rule: drawConfig.entryRule,
    });
  }

  const title = await courseTitle(courseId);
  if (!title) throw httpError(400, '코스를 찾을 수 없습니다.');

  if (source === 'completion') {
    const user = await User.findById(req.user._id).lean();
    if (!hasMembershipAccess(user, courseId)) {
      throw httpError(402, '도전권이 없으면 「무료 응모」로 응모할 수 있어요.', 'NEED_TICKET');
    }
  }

  try {
    const entry = await DrawEntry.create({
      season: drawConfig.season,
      user: req.user._id,
      courseId,
      courseTitle: title,
      source,
    });
    return res.status(201).json({
      entered: true,
      already: false,
      entry: publicEntry(entry),
      rule: drawConfig.entryRule,
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
    const again = await DrawEntry.findOne({ season: drawConfig.season, user: req.user._id }).lean();
    return res.json({
      entered: true,
      already: true,
      entry: publicEntry(again),
      rule: drawConfig.entryRule,
    });
  }
}

async function paidStats() {
  // 기존 Order(포트원) 매출만 집계. PayOrder(이니시스 키트)는 사용하지 않음.
  const orders = await Order.find({ status: '결제완료' }).select('total_price paid_amount').lean();
  return {
    paidCount: orders.length,
    paidAmount: orders.reduce((t, o) => t + Number(o.paid_amount ?? o.total_price ?? 0), 0),
  };
}

/** GET /api/draw/summary — 관리자 */
export async function adminDrawSummary(req, res) {
  const entries = await DrawEntry.find({ season: drawConfig.season }).lean();
  const winners = entries.filter((e) => e.prizeRank != null);
  res.json({
    ...publicDraw(),
    ...budgetSummary({ ...(await paidStats()), entries: entries.length }),
    bySource: {
      completion: entries.filter((e) => (e.source || 'completion') === 'completion').length,
      free: entries.filter((e) => e.source === 'free').length,
    },
    drawn: winners.length > 0,
    winners: winners
      .sort((a, b) => a.prizeRank - b.prizeRank)
      .map((e) => ({
        prizeRank: e.prizeRank,
        user: String(e.user),
        courseId: e.courseId,
        source: e.source || 'completion',
        drawnAt: e.drawnAt,
      })),
  });
}

/** POST /api/draw/pick — 관리자 추첨 */
export async function adminPickWinners(req, res) {
  if (isOpen() && req.body?.force !== true) {
    throw httpError(409, '응모 마감 뒤에 추첨할 수 있어요.', 'DRAW_STILL_OPEN');
  }
  const entries = await DrawEntry.find({ season: drawConfig.season }).lean();
  if (entries.some((e) => e.prizeRank != null)) throw httpError(409, '이미 추첨했어요.', 'ALREADY_DRAWN');
  if (!entries.length) throw httpError(409, '응모자가 없어요.', 'NO_ENTRIES');
  const now = new Date();
  const picked = pickWinners(entries);
  for (const w of picked) {
    await DrawEntry.updateOne({ _id: w.entry._id }, { $set: { prizeRank: w.rank, drawnAt: now } });
  }
  res.json({
    season: drawConfig.season,
    entries: entries.length,
    winners: picked.map((w) => ({
      prizeRank: w.rank,
      label: w.label,
      amount: w.amount,
      user: String(w.entry.user),
      courseId: w.entry.courseId,
    })),
  });
}
