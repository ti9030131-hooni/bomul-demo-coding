// 결제 흐름 시험(DB 없이): 저장소 맨 위에서
//   node --import ./tools/pay/test/register.mjs --test tools/pay/test/flow.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.PAYMENTS_MODE = 'mock';
const pay = await import('../../../server/src/controllers/pay.js');
const PayOrder = (await import('../../../server/src/models/PayOrder.js')).default;
const CourseTicket = (await import('../../../server/src/models/CourseTicket.js')).default;
const user = { _id: 'u'.repeat(24), user_id: 'tester', name: '테스터', email: 'a@b.c', user_type: 'user' };
function call(fn, { body = {}, params = {}, query = {}, u = user } = {}) {
  return new Promise((resolve, reject) => {
    const res = { statusCode: 200, setHeader() {}, type() { return this; }, status(c) { this.statusCode = c; return this; },
      json(b) { resolve({ status: this.statusCode, body: b }); }, send(b) { resolve({ status: this.statusCode, html: String(b) }); } };
    Promise.resolve(fn({ body, params, query, user: u }, res)).catch(reject);
  });
}
const AG = ['purchase', 'efinance', 'privacy', 'thirdparty'];

test('결제 전에는 도전 불가 → 4,000원 결제 → 그 코스만 도전 가능', async () => {
  let r = await call(pay.getAccess, { params: { courseId: 'seoul-half' } });
  assert.equal(r.body.allowed, false);
  await assert.rejects(call(pay.createPayOrder, { body: { productId: 'single', courseId: 'seoul-half', methodId: 'card', agreed: ['purchase'] } }), /필수 약관/);
  await assert.rejects(call(pay.createPayOrder, { body: { productId: 'single', courseId: 'no-such', methodId: 'card', agreed: AG } }), /코스를 찾을 수 없/);
  r = await call(pay.createPayOrder, { body: { productId: 'single', courseId: 'seoul-half', methodId: 'kakaopay', agreed: AG, amount: 1 } });
  assert.equal(r.status, 201); assert.equal(r.body.amount, 4000); assert.equal(r.body.inicis, null);   // 가짜 결제는 결제창 없음
  const orderId = r.body.orderId;
  r = await call(pay.mockConfirmPayOrder, { body: { orderId } });
  assert.equal(r.body.order.status, 'paid'); assert.equal(r.body.ticket.scope, 'course');
  r = await call(pay.mockConfirmPayOrder, { body: { orderId } });                      // 두 번 눌러도
  assert.equal(CourseTicket.rows.length, 1);                                             // 도전권은 하나
  assert.equal((await call(pay.getAccess, { params: { courseId: 'seoul-half' } })).body.allowed, true);
  assert.equal((await call(pay.getAccess, { params: { courseId: 'seoul-gyeongbok-ar' } })).body.allowed, false);
  await assert.rejects(call(pay.createPayOrder, { body: { productId: 'single', courseId: 'seoul-half', methodId: 'card', agreed: AG } }), /이미/);
});

test('9,900원 전체 패스 → 모든 코스 도전 가능, 다른 사람 주문은 못 건드림, 관리자 취소하면 다시 막힘', async () => {
  let r = await call(pay.createPayOrder, { body: { productId: 'all', courseId: 'seoul-gyeongbok-ar', methodId: 'transfer', agreed: AG } });
  assert.equal(r.body.amount, 9900);
  const orderId = r.body.orderId;
  await assert.rejects(call(pay.mockConfirmPayOrder, { body: { orderId }, u: { ...user, _id: 'x'.repeat(24) } }), /주문을 찾을 수 없/);
  await call(pay.mockConfirmPayOrder, { body: { orderId } });
  assert.equal((await call(pay.getAccess, { params: { courseId: 'seoul-gyeongbok-ar' } })).body.allowed, true);
  r = await call(pay.listMyTickets);
  assert.equal(r.body.tickets.length, 2);
  await call(pay.adminCancelPayOrder, { params: { orderId }, body: { reason: '테스트' }, u: { ...user, user_type: 'admin' } });
  assert.equal((await call(pay.getAccess, { params: { courseId: 'seoul-gyeongbok-ar' } })).body.allowed, false);
  assert.equal((await call(pay.getAccess, { params: { courseId: 'seoul-gyeongbok-ar' }, u: { ...user, user_type: 'admin' } })).body.allowed, true);
});

test('설정 응답에는 서명키가 없고, 결제를 끄면 모두 무료', async () => {
  process.env.PAYMENTS_MODE = 'inicis'; process.env.INICIS_SIGNKEY = 'SECRET_SIGN_KEY_X'; process.env.INICIS_MID = 'INIpayTest';
  const r = await call(pay.getPayConfig);
  assert.equal(r.body.mode, 'inicis'); assert.equal(r.body.pg, 'KG이니시스'); assert.equal(r.body.test, true);
  assert.ok(!JSON.stringify(r.body).includes('SECRET_SIGN_KEY_X'));
  assert.ok(!r.body.methods.some((m) => m.id === 'tosspay'));
  delete process.env.INICIS_SIGNKEY; delete process.env.INICIS_MID;
  process.env.PAYMENTS_MODE = 'off';
  assert.equal((await call(pay.getAccess, { params: { courseId: 'busan' } })).body.allowed, true);
});

const BASES = { apiBase: 'https://bomul-demo-vercel.vercel.app', clientBase: 'https://bomul-demo-vercel.vercel.app' };
const realFetch = globalThis.fetch;
function fakeInicis(handler) { const calls = []; globalThis.fetch = async (url, init) => { calls.push({ url, body: init.body }); return handler(url, init); }; return calls; }
const asText = (obj) => ({ ok: true, text: async () => (typeof obj === 'string' ? obj : JSON.stringify(obj)), json: async () => obj });

test('이니시스 주문: 휴대폰 번호가 없으면 물어보고, 허락하지 않은 주소는 거절, PC·모바일 결제창 값을 돌려줌', async () => {
  process.env.PAYMENTS_MODE = 'inicis';
  const u = { ...user, _id: 'p'.repeat(24), phone: '' };
  await assert.rejects(call(pay.createPayOrder, { body: { productId: 'single', courseId: 'seoul-half', methodId: 'card', agreed: AG, ...BASES }, u }), (e) => e.code === 'PHONE_REQUIRED');
  await assert.rejects(call(pay.createPayOrder, { body: { productId: 'single', courseId: 'seoul-half', methodId: 'card', agreed: AG, phone: '010-1111-2222', apiBase: 'https://evil.example', clientBase: BASES.clientBase }, u }), /주소/);
  let r = await call(pay.createPayOrder, { body: { productId: 'single', courseId: 'seoul-half', methodId: 'naverpay', agreed: AG, phone: '010-1111-2222', device: 'pc', ...BASES }, u });
  assert.equal(r.body.inicis.device, 'pc'); assert.equal(r.body.inicis.fields.gopaymethod, 'onlynaverpay'); assert.equal(r.body.inicis.fields.price, '4000');
  assert.equal(r.body.inicis.fields.returnUrl, 'https://bomul-demo-vercel.vercel.app/api/pay/inicis/return');
  assert.ok(!JSON.stringify(r.body).includes('SU5JTElURV9UUklQTEVERVNfS0VZU1RS'));             // 서명키 자체는 보내지 않음
  PayOrder.rows.find((o) => o.orderId === r.body.orderId).status = 'failed';                   // 다음 시험을 위해 닫음
  r = await call(pay.createPayOrder, { body: { productId: 'single', courseId: 'seoul-half', methodId: 'phone', agreed: AG, phone: '01011112222', device: 'mobile', ...BASES }, u });
  assert.equal(r.body.inicis.device, 'mobile'); assert.equal(r.body.inicis.fields.P_INI_PAYMENT, 'MOBILE'); assert.equal(r.body.inicis.fields.P_AMT, '4000');
});

test('이니시스 PC: 인증 성공 → 승인 → 도전권, 다시 와도 한 번만, 금액이 다르면 망취소', async () => {
  process.env.PAYMENTS_MODE = 'inicis';
  const u = { ...user, _id: 'r'.repeat(24), phone: '010-3333-4444' };
  const o = await call(pay.createPayOrder, { body: { productId: 'all', methodId: 'card', agreed: AG, device: 'pc', ...BASES }, u });
  assert.equal(o.body.amount, 9900);
  const ret = { resultCode: '0000', mid: 'INIpayTest', orderNumber: o.body.orderId, authToken: 'AT', idc_name: 'stg', authUrl: 'https://stgstdpay.inicis.com/api/payAuth', netCancelUrl: 'https://stgstdpay.inicis.com/api/netCancel' };
  try {
    let calls = fakeInicis(() => asText({ resultCode: '0000', tid: 'StdpayCARDINIpayTest20261114', MOID: o.body.orderId, TotPrice: '9900', payMethod: 'Card', applDate: '20261114', applTime: '203000' }));
    let r = await call(pay.inicisPcReturn, { body: ret, u: null });
    assert.match(r.html, /result=success/); assert.match(r.html, new RegExp(o.body.orderId));
    assert.equal(calls.length, 1); assert.equal(calls[0].url, 'https://stgstdpay.inicis.com/api/payAuth');
    const paid = PayOrder.rows.find((x) => x.orderId === o.body.orderId);
    assert.equal(paid.status, 'paid'); assert.equal(paid.method, '신용카드'); assert.equal(paid.paymentKey, 'StdpayCARDINIpayTest20261114');
    r = await call(pay.inicisPcReturn, { body: ret, u: null });                                 // 같은 결과가 또 와도
    assert.match(r.html, /result=success/); assert.equal(calls.length, 1);                      // 승인은 한 번만
    assert.equal((await call(pay.getAccess, { params: { courseId: 'busan' }, u })).body.allowed, true);
    const mine = await call(pay.getMyOrder, { params: { orderId: o.body.orderId }, u });
    assert.equal(mine.body.order.status, 'paid'); assert.equal(mine.body.ticket.scope, 'all');

    // 금액이 다른 승인 → 망취소 후 실패
    const u2 = { ...user, _id: 's'.repeat(24), phone: '010-3333-4444' };
    const o2 = await call(pay.createPayOrder, { body: { productId: 'single', courseId: 'seoul-half', methodId: 'card', agreed: AG, device: 'pc', ...BASES }, u: u2 });
    calls = fakeInicis((url) => asText(url.endsWith('payAuth') ? { resultCode: '0000', tid: 'T2', MOID: o2.body.orderId, TotPrice: '100' } : { resultCode: '0000' }));
    r = await call(pay.inicisPcReturn, { body: { ...ret, orderNumber: o2.body.orderId }, u: null });
    assert.match(r.html, /AMOUNT_MISMATCH/);
    assert.deepEqual(calls.map((c) => c.url), ['https://stgstdpay.inicis.com/api/payAuth', 'https://stgstdpay.inicis.com/api/netCancel']);
    assert.equal(PayOrder.rows.find((x) => x.orderId === o2.body.orderId).status, 'failed');

    // 이니시스가 아닌 승인 주소 → 승인 요청 자체를 하지 않음
    const o3 = await call(pay.createPayOrder, { body: { productId: 'single', courseId: 'seoul-half', methodId: 'card', agreed: AG, device: 'pc', ...BASES }, u: u2 });
    calls = fakeInicis(() => asText({}));
    r = await call(pay.inicisPcReturn, { body: { ...ret, orderNumber: o3.body.orderId, authUrl: 'https://evil.example/api/payAuth' }, u: null });
    assert.match(r.html, /BAD_RETURN/); assert.equal(calls.length, 0);

    // 사용자가 결제창에서 취소
    const o4 = await call(pay.createPayOrder, { body: { productId: 'single', courseId: 'seoul-half', methodId: 'card', agreed: AG, device: 'pc', ...BASES }, u: u2 });
    r = await call(pay.inicisPcReturn, { body: { resultCode: 'V801', resultMsg: '사용자 취소', orderNumber: o4.body.orderId }, u: null });
    assert.match(r.html, /result=fail/);
  } finally { globalThis.fetch = realFetch; }
});

test('이니시스 모바일: 인증 → 승인 → 도전권, 취소하면 실패 화면', async () => {
  process.env.PAYMENTS_MODE = 'inicis';
  const u = { ...user, _id: 't'.repeat(24), phone: '010-5555-6666' };
  const o = await call(pay.createPayOrder, { body: { productId: 'single', courseId: 'seoul-half', methodId: 'kakaopay', agreed: AG, device: 'mobile', ...BASES }, u });
  assert.equal(o.body.inicis.fields.P_RESERVED, 'centerCd=Y&apprun_check=Y&d_kakaopay=Y');
  try {
    const calls = fakeInicis(() => asText(`P_STATUS=00&P_TID=INIMX_CARDINIpayTest2026&P_AMT=4000&P_OID=${o.body.orderId}&P_TYPE=CARD&P_AUTH_DT=20261114203000&P_RMESG1=정상`));
    const r = await call(pay.inicisMobileReturn, { body: { P_STATUS: '00', P_TID: 'INIMX_AUTH1', P_AMT: '4000', P_NOTI: o.body.orderId, P_REQ_URL: 'https://stgmobile.inicis.com/smart/payReq.ini', idc_name: 'stg' }, u: null });
    assert.match(r.html, /result=success/); assert.equal(calls.length, 1);
    assert.equal(new URLSearchParams(calls[0].body).get('P_MID'), 'INIpayTest');
    const paid = PayOrder.rows.find((x) => x.orderId === o.body.orderId);
    assert.equal(paid.status, 'paid'); assert.equal(paid.method, '신용카드');
    assert.equal(paid.approvedAt.toISOString(), '2026-11-14T11:30:00.000Z');
  } finally { globalThis.fetch = realFetch; }
  const u2 = { ...user, _id: 'v'.repeat(24), phone: '010-5555-6666' };
  const o2 = await call(pay.createPayOrder, { body: { productId: 'single', courseId: 'seoul-half', methodId: 'card', agreed: AG, device: 'mobile', ...BASES }, u: u2 });
  const r2 = await call(pay.inicisMobileReturn, { body: { P_STATUS: '01', P_RMESG1: '사용자 취소', P_NOTI: o2.body.orderId }, u: null });
  assert.match(r2.html, /result=fail/);
  assert.equal(PayOrder.rows.find((x) => x.orderId === o2.body.orderId).status, 'failed');
});

test('관리자 취소: INIAPI 키가 없으면 수동 처리만, 있으면 이니시스 취소 API 호출', async () => {
  const admin = { ...user, user_type: 'admin' };
  const paid = PayOrder.rows.filter((x) => x.mode === 'inicis' && x.status === 'paid');
  await assert.rejects(call(pay.adminCancelPayOrder, { params: { orderId: paid[0].orderId }, body: {}, u: admin }), (e) => e.code === 'NO_INIAPI_KEY');
  let r = await call(pay.adminCancelPayOrder, { params: { orderId: paid[0].orderId }, body: { manual: true, reason: '콘솔에서 취소함' }, u: admin });
  assert.equal(r.body.order.status, 'canceled');
  process.env.INICIS_API_KEY = 'APIKEY';
  try {
    const calls = fakeInicis(() => ({ ok: true, json: async () => ({ resultCode: '00', resultMsg: '정상' }) }));
    r = await call(pay.adminCancelPayOrder, { params: { orderId: paid[1].orderId }, body: { reason: '고객 요청' }, u: admin });
    assert.equal(r.body.order.status, 'canceled');
    assert.equal(calls[0].url, 'https://iniapi.inicis.com/v2/pg/refund');
    const sent = JSON.parse(calls[0].body);
    assert.equal(sent.type, 'refund'); assert.equal(sent.data.tid, paid[1].paymentKey); assert.equal(sent.hashData.length, 128);
  } finally { globalThis.fetch = realFetch; delete process.env.INICIS_API_KEY; }
});

test('완주 보상 추첨: 시즌마다 1인 1회, 완주 응모는 도전권 필요·무료 응모는 누구나, 관리자 추첨은 한 번만', async () => {
  const draw = await import('../../../server/src/controllers/draw.js');
  process.env.PAYMENTS_MODE = 'mock';
  const a = { ...user, _id: 'd'.repeat(24) };
  const b = { ...user, _id: 'e'.repeat(24) };
  await assert.rejects(call(draw.enterDraw, { body: { courseId: 'seoul-half' }, u: a }), (e) => e.code === 'NEED_TICKET');
  // 무료 응모: 도전권 없이도 1인 1회
  const f = { ...user, _id: 'f'.repeat(24) };
  let fr = await call(draw.enterDraw, { body: { courseId: 'seoul-half', source: 'free' }, u: f });
  assert.equal(fr.status, 201); assert.equal(fr.body.entry.source, 'free');
  fr = await call(draw.enterDraw, { body: { courseId: 'seoul-half', source: 'free' }, u: f });
  assert.equal(fr.body.already, true);
  const o = await call(pay.createPayOrder, { body: { productId: 'all', methodId: 'card', agreed: AG }, u: a });
  await call(pay.mockConfirmPayOrder, { body: { orderId: o.body.orderId }, u: a });
  let r = await call(draw.enterDraw, { body: { courseId: 'seoul-half' }, u: a });
  assert.equal(r.status, 201); assert.equal(r.body.already, false); assert.equal(r.body.entry.courseTitle.length > 0, true);
  r = await call(draw.enterDraw, { body: { courseId: 'seoul-gyeongbok-ar' }, u: a });       // 다른 코스를 또 완주해도
  assert.equal(r.body.already, true); assert.equal(r.body.entry.courseId, 'seoul-half');      // 응모는 그대로 1건
  r = await call(draw.getMyEntry, { u: a });
  assert.equal(r.body.entered, true);
  process.env.PAYMENTS_MODE = 'off';                                                       // 무료 운영 중에는 로그인만 하면 응모
  r = await call(draw.enterDraw, { body: { courseId: 'seoul-half' }, u: b });
  assert.equal(r.status, 201);
  const admin = { ...user, user_type: 'admin' };
  await assert.rejects(call(draw.adminPickWinners, { body: {}, u: admin }), (e) => e.code === 'DRAW_STILL_OPEN');
  r = await call(draw.adminPickWinners, { body: { force: true }, u: admin });
  assert.equal(r.body.entries, 3); assert.deepEqual(r.body.winners.map((w) => w.prizeRank), [1, 2, 3]);
  await assert.rejects(call(draw.adminPickWinners, { body: { force: true }, u: admin }), (e) => e.code === 'ALREADY_DRAWN');
  r = await call(draw.adminDrawSummary, { u: admin });
  assert.equal(r.body.entries, 3); assert.equal(r.body.drawn, true); assert.equal(r.body.prizeCost, 3846154);
  assert.deepEqual(r.body.bySource, { completion: 2, free: 1 });
  assert.ok(r.body.paidAmount >= 9900);
});
