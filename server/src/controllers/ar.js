import LegendCourse from '../models/LegendCourse.js';
import ArSettings from '../models/ArSettings.js';
import arDefaults from '../data/arDefaults.json' with { type: 'json' };
import { toPublic } from './legendCourses.js';
import { buildArCourse, piecePool } from '../services/arCourse.js';

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
const text = (value) => (typeof value === 'string' ? value.trim() : '');

export async function readSettings() {
  const doc = await ArSettings.findOne({ key: 'default' }).lean();
  return {
    prizes: doc?.prizes?.length ? doc.prizes : arDefaults.prizes,
    pointShop: doc?.pointShop?.length ? doc.pointShop : arDefaults.pointShop,
    updatedAt: doc?.updatedAt || null,
  };
}

// 짧게 캐시해 관리자 수정이 1분 안에 반영되게 합니다.
function cacheShort(res) {
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120');
}

/** GET /api/ar/courses — AR 코스 목록(코스 바꾸기 목록용) */
export async function listArCourses(req, res) {
  const courses = await LegendCourse.find({ 'ar.enabled': { $ne: false } }).select('slug region title stops.where').lean();
  cacheShort(res);
  res.json(courses.map((c) => ({ id: c.slug, region: c.region, title: c.title, stops: (c.stops || []).length })));
}

/** GET /api/ar/courses/:slug — AR 화면이 쓰는 코스 데이터 전체 */
export async function getArCourse(req, res) {
  const course = await LegendCourse.findOne({ slug: req.params.slug });
  if (!course || course.ar?.enabled === false) throw httpError(404, 'AR 코스를 찾을 수 없습니다.');
  const others = await LegendCourse.find({ slug: { $ne: course.slug } }).select('region stops.name stops.ar.piece').lean();
  const settings = await readSettings();
  const data = buildArCourse(toPublic(course), { pool: piecePool(others), settings });
  if (!data) throw httpError(404, '경유지가 없는 코스입니다.');
  cacheShort(res);
  res.json(data);
}

/** GET /api/ar/settings — 완주 상품·포인트 상품 */
export async function getArSettings(req, res) {
  cacheShort(res);
  res.json(await readSettings());
}

/** PATCH /api/ar/settings — 관리자 전용 */
export async function updateArSettings(req, res) {
  const body = req.body || {};
  const prizes = Array.isArray(body.prizes)
    ? body.prizes.map((p) => ({
        icon: ['cert', 'point', 'draw'].includes(p?.icon) ? p.icon : 'draw',
        title: text(p?.title),
        desc: text(p?.desc),
        points: Math.max(0, Math.round(Number(p?.points) || 0)),
        action: text(p?.action),
        go: ['cert', 'shop'].includes(p?.go) ? p.go : '',
      })).filter((p) => p.title)
    : undefined;
  const pointShop = Array.isArray(body.pointShop)
    ? body.pointShop.map((g, i) => ({
        id: text(g?.id) || `rank${i + 1}`,
        rank: Number.isInteger(Number(g?.rank)) && Number(g.rank) > 0 ? Number(g.rank) : i + 1,
        icon: ['crown', 'gift', 'voucher', 'coffee', 'ticket'].includes(g?.icon) ? g.icon : 'gift',
        name: text(g?.name),
        points: Math.round(Number(g?.points) || 0),
        desc: text(g?.desc),
      })).filter((g) => g.name)
    : undefined;
  if (pointShop?.some((g) => g.points < 1)) throw httpError(400, '포인트 상품의 필요 포인트는 1 이상이어야 합니다.');
  if (pointShop && new Set(pointShop.map((g) => g.id)).size !== pointShop.length) throw httpError(400, '포인트 상품 아이디가 겹칩니다.');
  const update = {};
  if (prizes) update.prizes = prizes;
  if (pointShop) update.pointShop = pointShop;
  await ArSettings.findOneAndUpdate({ key: 'default' }, { $set: update }, { upsert: true, new: true, runValidators: true });
  res.json(await readSettings());
}
