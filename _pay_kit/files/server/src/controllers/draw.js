// 완주 보상 추첨 — 시즌마다 1인 1회 응모
import DrawEntry from '../models/DrawEntry.js';
import PayOrder from '../models/PayOrder.js';
import LegendCourse from '../models/LegendCourse.js';
import legendSeed from '../data/legendCourses.json' with { type: 'json' };
import { hasAccess } from './pay.js';
import { validCourseId } from '../services/payments.js';
import { budgetSummary, drawConfig, isOpen, pickWinners, publicDraw } from '../services/draw.js';

function httpError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}
const publicEntry = (e) => e && ({ season: e.season, courseId: e.courseId, courseTitle: e.courseTitle, source: e.source || 'completion', createdAt: e.createdAt, prizeRank: e.prizeRank });

async function courseTitle(slug) {
  const doc = await LegendCourse.findOne({ slug }).select('title').lean();
  if (doc) return doc.title;
  const seed = legendSeed.find((c) => c.id === slug);
  return seed ? seed.title : null;
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

/** POST /api/draw/entries — 응모 { courseId, source: completion|free }. 이미 응모했으면 그대로 돌려줍니다(1인 1회).
 *  completion: 완주하면 응모(도전권 필요) · free: 무료 응모 — 결제 없이 회원이면 누구나(첫 보물 무료 체험 뒤 AR 화면에서) */
export async function enterDraw(req, res) {
  if (!isOpen()) throw httpError(409, '이번 시즌 추첨 응모가 끝났어요.', 'DRAW_CLOSED');
  const source = req.body.source === 'free' ? 'free' : 'completion';
  if (source === 'free' && drawConfig.freeEntry === false) throw httpError(403, '무료 응모를 받지 않는 시즌이에요.', 'FREE_ENTRY_OFF');
  const courseId = typeof req.body.courseId === 'string' ? req.body.courseId.trim() : '';
  if (!validCourseId(courseId)) throw httpError(400, '코스를 찾을 수 없습니다.');
  const existing = await DrawEntry.findOne({ season: drawConfig.season, user: req.user._id }).lean();
  if (existing) return res.json({ entered: true, already: true, entry: publicEntry(existing), rule: drawConfig.entryRule });

  const title = await courseTitle(courseId);
  if (!title) throw httpError(400, '코스를 찾을 수 없습니다.');
  if (source === 'completion') {
    const access = await hasAccess(req.user, courseId);
    if (!access.allowed) throw httpError(402, '도전권이 없으면 「무료 응모」로 응모할 수 있어요.', 'NEED_TICKET');
  }
  // TODO(서버 완주 인증을 만든 뒤): 이 코스를 실제로 완주했는지 확인 — SPEC-PAY.md 6장, CURSOR-PROMPTS-pay.md P-4

  try {
    const entry = await DrawEntry.create({ season: drawConfig.season, user: req.user._id, courseId, courseTitle: title, source });
    return res.status(201).json({ entered: true, already: false, entry: publicEntry(entry), rule: drawConfig.entryRule });
  } catch (err) {
    if (err.code !== 11000) throw err;                                  // 거의 동시에 두 번 눌렀을 때
    const again = await DrawEntry.findOne({ season: drawConfig.season, user: req.user._id }).lean();
    return res.json({ entered: true, already: true, entry: publicEntry(again), rule: drawConfig.entryRule });
  }
}

async function paidStats() {
  const orders = await PayOrder.find({ status: 'paid' }).select('amount').lean();
  return { paidCount: orders.length, paidAmount: orders.reduce((t, o) => t + o.amount, 0) };
}

/** GET /api/draw/summary — 관리자: 응모 수, 결제 매출 대비 상금 비용, 예산 */
export async function adminDrawSummary(req, res) {
  const entries = await DrawEntry.find({ season: drawConfig.season }).lean();
  const winners = entries.filter((e) => e.prizeRank != null);
  res.json({
    ...publicDraw(),
    ...budgetSummary({ ...(await paidStats()), entries: entries.length }),
    bySource: { completion: entries.filter((e) => (e.source || 'completion') === 'completion').length, free: entries.filter((e) => e.source === 'free').length },
    drawn: winners.length > 0,
    winners: winners.sort((a, b) => a.prizeRank - b.prizeRank).map((e) => ({ prizeRank: e.prizeRank, user: String(e.user), courseId: e.courseId, source: e.source || 'completion', drawnAt: e.drawnAt })),
  });
}

/** POST /api/draw/pick — 관리자: 추첨하기 { force } (응모 마감 전에는 force 가 있어야 함, 한 번만) */
export async function adminPickWinners(req, res) {
  if (isOpen() && req.body?.force !== true) throw httpError(409, '응모 마감 뒤에 추첨할 수 있어요.', 'DRAW_STILL_OPEN');
  const entries = await DrawEntry.find({ season: drawConfig.season }).lean();
  if (entries.some((e) => e.prizeRank != null)) throw httpError(409, '이미 추첨했어요.', 'ALREADY_DRAWN');
  if (!entries.length) throw httpError(409, '응모자가 없어요.', 'NO_ENTRIES');
  const now = new Date();
  const picked = pickWinners(entries);
  for (const w of picked) await DrawEntry.updateOne({ _id: w.entry._id }, { $set: { prizeRank: w.rank, drawnAt: now } });
  res.json({ season: drawConfig.season, entries: entries.length, winners: picked.map((w) => ({ prizeRank: w.rank, label: w.label, amount: w.amount, user: String(w.entry.user), courseId: w.entry.courseId })) });
}
