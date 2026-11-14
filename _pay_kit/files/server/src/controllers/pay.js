// 코스 도전권 결제 — 토스페이먼츠 v2 결제창 + 서버 승인
import LegendCourse from '../models/LegendCourse.js';
import PayOrder from '../models/PayOrder.js';
import CourseTicket from '../models/CourseTicket.js';
import legendSeed from '../data/legendCourses.json' with { type: 'json' };
import {
  catalog, findMethod, findProduct, isTestPay, makeOrderId, missingTerms, orderName, payMode,
  ticketCovers, ticketPeriod, validCourseId,
} from '../services/payments.js';
import {
  allowedBase, cleanTel, closeHtml, inicisConfig, inicisRefund, kstDate, mobileApprove, mobileFields,
  pcApprove, pcFields, pcNetCancel, redirectHtml, validMobileReqUrl, validPcReturn,
} from '../services/inicis.js';

function httpError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}
const text = (v) => (typeof v === 'string' ? v.trim() : '');

async function findCourse(slug) {
  if (!validCourseId(slug)) return null;
  const doc = await LegendCourse.findOne({ slug }).select('slug title region').lean();
  if (doc) return { id: doc.slug, title: doc.title, region: doc.region };
  const seed = legendSeed.find((c) => c.id === slug);
  return seed ? { id: seed.id, title: seed.title, region: seed.region } : null;
}

async function activeTickets(userId, now = new Date()) {
  return CourseTicket.find({ user: userId, status: 'active', expiresAt: { $gt: now } }).sort({ expiresAt: -1 }).lean();
}

export async function hasAccess(user, courseId, now = new Date()) {
  if (payMode() === 'off') return { allowed: true, reason: 'free' };
  if (user?.user_type === 'admin') return { allowed: true, reason: 'admin' };
  const tickets = await activeTickets(user._id, now);
  const ticket = tickets.find((t) => ticketCovers(t, courseId, now));
  return ticket ? { allowed: true, reason: 'ticket', expiresAt: ticket.expiresAt, scope: ticket.scope } : { allowed: false, reason: 'need_ticket' };
}

const publicTicket = (t) => ({ orderId: t.orderId, productId: t.productId, scope: t.scope, courseId: t.courseId, startsAt: t.startsAt, expiresAt: t.expiresAt, status: t.status });
const publicOrder = (o) => ({
  orderId: o.orderId, productId: o.productId, productName: o.productName, scope: o.scope, courseId: o.courseId,
  courseTitle: o.courseTitle, amount: o.amount, methodId: o.methodId, method: o.method, status: o.status,
  approvedAt: o.approvedAt, receiptUrl: o.receiptUrl, createdAt: o.createdAt,
});

/** GET /api/pay/config — 결제 화면 설정(공개). 시크릿 키는 절대 내보내지 않습니다. */
export function getPayConfig(req, res) {
  const mode = payMode();
  res.json({
    mode,
    pg: mode === 'inicis' ? 'KG이니시스' : '',
    jsUrl: mode === 'inicis' ? inicisConfig().jsUrl : '',            // PC 결제창 스크립트(공개 주소)
    test: isTestPay(),                                   // 테스트 결제(돈이 나가지 않음)면 화면에 알림
    termsVersion: catalog.termsVersion,
    freeTrialStops: catalog.freeTrialStops ?? 1,
    products: catalog.products,
    methods: catalog.methods.map(({ id, label }) => ({ id, label })),
    terms: catalog.terms,
  });
}

/** GET /api/pay/access/:courseId — 이 코스에 도전할 수 있는가 */
export async function getAccess(req, res) {
  const courseId = text(req.params.courseId);
  if (!validCourseId(courseId)) throw httpError(400, '코스를 찾을 수 없습니다.');
  res.json({ courseId, mode: payMode(), ...(await hasAccess(req.user, courseId)) });
}

/** GET /api/pay/tickets — 내 도전권 */
export async function listMyTickets(req, res) {
  const tickets = await CourseTicket.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
  const orders = await PayOrder.find({ user: req.user._id, status: { $in: ['paid', 'canceled'] } }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ tickets: tickets.map(publicTicket), orders: orders.map(publicOrder) });
}

/** POST /api/pay/orders — 주문 만들기 { productId, courseId, methodId, agreed[], device: pc|mobile, phone?, apiBase, clientBase } */
export async function createPayOrder(req, res) {
  const mode = payMode();
  if (mode === 'off') throw httpError(409, '지금은 결제 없이 모든 코스에 도전할 수 있어요.', 'PAY_OFF');
  const product = findProduct(text(req.body.productId));
  if (!product) throw httpError(400, '상품을 골라 주세요.');
  const method = findMethod(text(req.body.methodId));
  if (!method) throw httpError(400, '결제 수단을 골라 주세요.');
  const missing = missingTerms(req.body.agreed);
  if (missing.length) throw httpError(400, '필수 약관에 동의해 주세요.', 'TERMS_REQUIRED');

  // 결제창이 돌아올 서버 주소와 결과를 보여 줄 화면 주소(허락한 사이트만)
  const apiBase = text(req.body.apiBase).replace(/\/$/, '');
  const clientBase = text(req.body.clientBase).replace(/\/$/, '');
  if (mode === 'inicis' && (!allowedBase(`${apiBase}/`) || !allowedBase(`${clientBase}/`))) throw httpError(400, '결제를 시작할 수 없는 주소예요.');
  const tel = cleanTel(req.body.phone) || cleanTel(req.user.phone);
  if (mode === 'inicis' && !/^01[016789]-?\d{3,4}-?\d{4}$/.test(tel)) throw httpError(400, '결제에 쓸 휴대폰 번호를 적어 주세요.', 'PHONE_REQUIRED');

  const courseId = text(req.body.courseId);
  const course = courseId ? await findCourse(courseId) : null;
  if (product.scope === 'course' && !course) throw httpError(400, '도전할 코스를 찾을 수 없습니다.');

  // 이미 도전권이 있으면 다시 받지 않습니다
  const now = new Date();
  const tickets = await activeTickets(req.user._id, now);
  if (tickets.some((t) => t.scope === 'all') || (product.scope === 'course' && tickets.some((t) => ticketCovers(t, course.id, now)))) {
    throw httpError(409, '이미 이 코스에 도전할 수 있는 도전권이 있어요.', 'ALREADY_COVERED');
  }

  const order = await PayOrder.create({
    orderId: makeOrderId(now),
    user: req.user._id,
    productId: product.id, productName: product.name, scope: product.scope, days: product.days,
    courseId: course?.id || '', courseTitle: course?.title || '',
    amount: product.price, methodId: method.id, mode,
    agreed: catalog.terms.map((t) => t.id).filter((id) => req.body.agreed.includes(id)),
    termsVersion: catalog.termsVersion,
    device: req.body.device === 'mobile' ? 'mobile' : 'pc',
    returnTo: clientBase,
  });
  const name = orderName(product, course?.title);
  const buyer = { name: req.user.name || req.user.nickname || req.user.user_id || '구매자', tel, email: req.user.email || '' };
  const payload = { order: { orderId: order.orderId, amount: order.amount, orderName: name }, method, buyer,
    urls: { pcReturn: `${apiBase}/api/pay/inicis/return`, pcClose: `${apiBase}/api/pay/inicis/close`, mobileReturn: `${apiBase}/api/pay/inicis/mobile-return` } };
  const cfg = inicisConfig();

  res.status(201).json({
    mode,
    orderId: order.orderId,
    orderName: name,
    amount: order.amount,
    inicis: mode !== 'inicis' ? null : order.device === 'mobile'
      ? { device: 'mobile', action: cfg.mobileUrl, fields: mobileFields(payload, cfg) }
      : { device: 'pc', jsUrl: cfg.jsUrl, fields: pcFields(payload, cfg) },
  });
}

async function issueTicket(order, payment) {
  const { startsAt, expiresAt } = ticketPeriod(order.days, payment.approvedAt || new Date());
  await CourseTicket.updateOne(
    { orderId: order.orderId },
    { $setOnInsert: { user: order.user, orderId: order.orderId, productId: order.productId, scope: order.scope, courseId: order.scope === 'course' ? order.courseId : '', startsAt, expiresAt, status: 'active' } },
    { upsert: true },
  );
}

async function loadMyOrder(req, orderId) {
  const order = await PayOrder.findOne({ orderId: text(orderId) });
  if (!order || String(order.user) !== String(req.user._id)) throw httpError(404, '주문을 찾을 수 없습니다.');
  return order;
}

async function finish(res, order) {
  const ticket = await CourseTicket.findOne({ orderId: order.orderId }).lean();
  res.json({ order: publicOrder(order), ticket: ticket ? publicTicket(ticket) : null });
}

/* ── KG이니시스 결과 수신 ──
   결제창이 브라우저에서 form POST 로 돌려보내는 곳이라 로그인 토큰이 없습니다.
   주문번호로 주문을 찾고, 이니시스 승인 API 결과(금액·주문번호)로 확인합니다. 끝나면 결제 화면으로 이동시킵니다. */
function resultUrl(order, params) {
  const base = order?.returnTo && allowedBase(`${order.returnTo}/`) ? order.returnTo : '';
  const q = new URLSearchParams({ ...params, ...(order?.courseId ? { course: order.courseId } : {}) });
  return `${base}/pay.html?${q}`;
}
async function markFailed(order, code, message) {
  if (order && order.status === 'ready') {
    order.status = 'failed'; order.failCode = String(code || '').slice(0, 60); order.failMessage = String(message || '').slice(0, 300);
    await order.save();
  }
}
async function markPaid(order, { tid, method, approvedAt, receiptUrl = '' }) {
  order.status = 'paid'; order.paymentKey = tid; order.method = method || ''; order.approvedAt = approvedAt || new Date(); order.receiptUrl = receiptUrl;
  await order.save();
  await issueTicket(order, { approvedAt: order.approvedAt });
}
const sendGo = (res, url) => res.status(200).type('html').send(redirectHtml(url));
const PAY_TYPE = { Card: '신용카드', VCard: '신용카드', DirectBank: '계좌이체', HPP: '휴대폰', CARD: '신용카드', BANK: '계좌이체', MOBILE: '휴대폰' };

/** POST /api/pay/inicis/return — PC 웹표준 결제창 인증 결과 → 승인 */
export async function inicisPcReturn(req, res) {
  const b = req.body || {};
  const order = await PayOrder.findOne({ orderId: text(b.orderNumber || b.oid) });
  if (!order) return sendGo(res, resultUrl(null, { result: 'fail', code: 'NO_ORDER', message: '주문을 찾을 수 없어요.' }));
  if (order.status === 'paid') return sendGo(res, resultUrl(order, { result: 'success', orderId: order.orderId }));
  if (order.status !== 'ready') return sendGo(res, resultUrl(order, { result: 'fail', code: 'ORDER_CLOSED', message: '이미 끝난 주문이에요.' }));
  if (b.resultCode !== '0000') {
    await markFailed(order, b.resultCode, b.resultMsg);
    return sendGo(res, resultUrl(order, { result: 'fail', code: b.resultCode || 'FAIL', message: b.resultMsg || '결제가 완료되지 않았어요.' }));
  }
  const cfg = inicisConfig();
  if (b.mid !== cfg.mid || !validPcReturn(b, cfg)) {
    await markFailed(order, 'BAD_RETURN', '이니시스 응답을 확인하지 못했어요.');
    return sendGo(res, resultUrl(order, { result: 'fail', code: 'BAD_RETURN', message: '결제 응답을 확인하지 못했어요.' }));
  }
  let approved;
  try {
    approved = await pcApprove({ authUrl: b.authUrl, authToken: b.authToken, price: order.amount }, cfg);
  } catch (err) {
    await markFailed(order, 'APPROVE_ERROR', err.message);
    return sendGo(res, resultUrl(order, { result: 'fail', code: 'APPROVE_ERROR', message: '승인 요청에 실패했어요. 결제되지 않았어요.' }));
  }
  const d = approved.data;
  if (d.resultCode !== '0000') {
    await markFailed(order, d.resultCode, d.resultMsg);
    return sendGo(res, resultUrl(order, { result: 'fail', code: d.resultCode || 'FAIL', message: d.resultMsg || '승인되지 않았어요.' }));
  }
  if (Number(d.TotPrice) !== order.amount || (d.MOID && d.MOID !== order.orderId)) {     // 금액·주문 불일치 → 망취소
    await pcNetCancel(b.idc_name, approved.params);
    await markFailed(order, 'AMOUNT_MISMATCH', `승인 금액 ${d.TotPrice} / 주문 ${order.amount}`);
    return sendGo(res, resultUrl(order, { result: 'fail', code: 'AMOUNT_MISMATCH', message: '결제 금액이 주문과 달라 취소했어요.' }));
  }
  try {
    await markPaid(order, { tid: d.tid, method: PAY_TYPE[d.payMethod] || d.payMethod, approvedAt: kstDate(d.applDate, d.applTime) });
  } catch (err) {                                                                         // 저장 실패 → 망취소(10분 안)
    await pcNetCancel(b.idc_name, approved.params);
    throw err;
  }
  return sendGo(res, resultUrl(order, { result: 'success', orderId: order.orderId }));
}

/** GET /api/pay/inicis/close — PC 결제창 닫기 */
export function inicisPcClose(req, res) {
  res.type('html').send(closeHtml());
}

/** POST /api/pay/inicis/mobile-return — 모바일 결제창 인증 결과 → 승인 */
export async function inicisMobileReturn(req, res) {
  const b = req.body || {};
  const order = await PayOrder.findOne({ orderId: text(b.P_NOTI || b.P_OID) });
  if (!order) return sendGo(res, resultUrl(null, { result: 'fail', code: 'NO_ORDER', message: '주문을 찾을 수 없어요.' }));
  if (order.status === 'paid') return sendGo(res, resultUrl(order, { result: 'success', orderId: order.orderId }));
  if (order.status !== 'ready') return sendGo(res, resultUrl(order, { result: 'fail', code: 'ORDER_CLOSED', message: '이미 끝난 주문이에요.' }));
  if (b.P_STATUS !== '00') {
    await markFailed(order, b.P_STATUS, b.P_RMESG1);
    return sendGo(res, resultUrl(order, { result: 'fail', code: b.P_STATUS || 'FAIL', message: b.P_RMESG1 || '결제가 완료되지 않았어요.' }));
  }
  const cfg = inicisConfig();
  if (!validMobileReqUrl(b.P_REQ_URL, cfg) || !b.P_TID) {
    await markFailed(order, 'BAD_RETURN', '이니시스 응답을 확인하지 못했어요.');
    return sendGo(res, resultUrl(order, { result: 'fail', code: 'BAD_RETURN', message: '결제 응답을 확인하지 못했어요.' }));
  }
  let d;
  try { d = await mobileApprove({ reqUrl: b.P_REQ_URL, tid: b.P_TID }, cfg); } catch (err) {
    await markFailed(order, 'APPROVE_ERROR', err.message);
    return sendGo(res, resultUrl(order, { result: 'fail', code: 'APPROVE_ERROR', message: '승인 요청에 실패했어요. 결제되지 않았어요.' }));
  }
  if (d.P_STATUS !== '00') {
    await markFailed(order, d.P_STATUS, d.P_RMESG1);
    return sendGo(res, resultUrl(order, { result: 'fail', code: d.P_STATUS || 'FAIL', message: d.P_RMESG1 || '승인되지 않았어요.' }));
  }
  if (Number(d.P_AMT) !== order.amount || (d.P_OID && d.P_OID !== order.orderId)) {      // 불일치 → 바로 취소(INIAPI)
    try { await inicisRefund({ tid: d.P_TID || b.P_TID, msg: '결제 금액 불일치 자동 취소' }, cfg); } catch (e) { console.error('[pay] 자동 취소 실패 — 관리자 확인 필요', order.orderId, e.message); }
    await markFailed(order, 'AMOUNT_MISMATCH', `승인 금액 ${d.P_AMT} / 주문 ${order.amount}`);
    return sendGo(res, resultUrl(order, { result: 'fail', code: 'AMOUNT_MISMATCH', message: '결제 금액이 주문과 달라 취소했어요.' }));
  }
  const at = String(d.P_AUTH_DT || '');
  await markPaid(order, { tid: d.P_TID || b.P_TID, method: PAY_TYPE[d.P_TYPE] || d.P_TYPE, approvedAt: kstDate(at.slice(0, 8), at.slice(8, 14)) });
  return sendGo(res, resultUrl(order, { result: 'success', orderId: order.orderId }));
}

/** GET /api/pay/my-orders/:orderId — 결제 결과 화면용 내 주문 */
export async function getMyOrder(req, res) {
  const order = await loadMyOrder(req, req.params.orderId);
  return finish(res, order);
}

/** POST /api/pay/mock-confirm — 개발용 가짜 결제(PAYMENTS_MODE=mock 일 때만) { orderId } */
export async function mockConfirmPayOrder(req, res) {
  if (payMode() !== 'mock') throw httpError(404, '경로를 찾을 수 없습니다.');
  const order = await loadMyOrder(req, req.body.orderId);
  if (order.status === 'paid') return finish(res, order);
  if (order.status !== 'ready') throw httpError(409, '이미 끝난 주문입니다.');
  order.status = 'paid'; order.paymentKey = `mock_${order.orderId}`; order.method = '테스트 결제'; order.approvedAt = new Date();
  await order.save();
  await issueTicket(order, { approvedAt: order.approvedAt });
  return finish(res, order);
}

/** GET /api/pay/orders — 관리자: 결제 목록 ?status=paid */
export async function adminListPayOrders(req, res) {
  const filter = {};
  if (['ready', 'paid', 'failed', 'canceled'].includes(req.query.status)) filter.status = req.query.status;
  const orders = await PayOrder.find(filter).sort({ createdAt: -1 }).limit(200).populate('user', 'user_id name email').lean();
  res.json(orders.map((o) => ({ ...publicOrder(o), mode: o.mode, user: o.user ? { id: o.user._id, user_id: o.user.user_id, name: o.user.name } : null, failMessage: o.failMessage, canceledAt: o.canceledAt, cancelReason: o.cancelReason })));
}

/** POST /api/pay/orders/:orderId/cancel — 관리자: 결제 취소(환불) { reason } */
export async function adminCancelPayOrder(req, res) {
  const order = await PayOrder.findOne({ orderId: text(req.params.orderId) });
  if (!order) throw httpError(404, '주문을 찾을 수 없습니다.');
  if (order.status !== 'paid') throw httpError(409, '결제 완료된 주문만 취소할 수 있습니다.');
  const reason = text(req.body?.reason) || '관리자 취소';
  // manual: 이니시스 가맹점관리자에서 이미 취소했을 때 기록만 바꿈
  if (order.mode === 'inicis' && req.body?.manual !== true) await inicisRefund({ tid: order.paymentKey, msg: reason });
  order.status = 'canceled'; order.canceledAt = new Date(); order.cancelReason = reason;
  await order.save();
  await CourseTicket.updateOne({ orderId: order.orderId }, { $set: { status: 'refunded' } });
  res.json({ order: publicOrder(order) });
}
