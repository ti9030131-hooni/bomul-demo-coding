import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  TEST_MID, TEST_SIGNKEY, allowedBase, inicisConfig, kstDate, kstStamp, mobileApprove, mobileFields, parseNvp,
  pcApprove, pcAuthUrl, pcFields, redirectHtml, refundRequest, validMobileReqUrl, validPcReturn,
} from '../src/services/inicis.js';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const cfg = inicisConfig({});
const order = { orderId: 'BM-20261114-abcDEF123456', amount: 4000, orderName: '보물 여행 1코스 도전권 · 「경복궁」' };
const buyer = { name: '김보물', tel: '010-1234-5678', email: 'a@b.co' };
const urls = { pcReturn: 'https://x.vercel.app/api/pay/inicis/return', pcClose: 'https://x.vercel.app/api/pay/inicis/close', mobileReturn: 'https://x.vercel.app/api/pay/inicis/mobile-return' };

test('테스트 설정: 공개 테스트 상점 · 스테이징 JS, 운영은 키 없으면 비어 있음', () => {
  assert.equal(cfg.mid, TEST_MID); assert.equal(cfg.signKey, TEST_SIGNKEY);
  assert.equal(cfg.jsUrl, 'https://stgstdpay.inicis.com/stdjs/INIStdPay.js');
  const prod = inicisConfig({ INICIS_ENV: 'prod' });
  assert.equal(prod.mid, ''); assert.equal(prod.jsUrl, 'https://stdpay.inicis.com/stdjs/INIStdPay.js');
});

test('PC 결제창 값: 공식 샘플과 같은 해시 문자열', () => {
  const f = pcFields({ order, method: { pc: { gopaymethod: 'onlykakaopay', acceptmethod: 'cardonly' } }, buyer, urls }, cfg, 1763100000000);
  assert.equal(f.signature, sha256(`oid=${order.orderId}&price=4000&timestamp=1763100000000`));
  assert.equal(f.verification, sha256(`oid=${order.orderId}&price=4000&signKey=${TEST_SIGNKEY}&timestamp=1763100000000`));
  assert.equal(f.mKey, sha256(TEST_SIGNKEY));
  assert.equal(f.acceptmethod, 'HPP(1):centerCd(Y):cardonly');
  assert.equal(f.gopaymethod, 'onlykakaopay'); assert.equal(f.use_chkfake, 'Y'); assert.equal(f.currency, 'WON');
  assert.ok(!/[<>"']/.test(f.goodname) && f.goodname.length <= 40);
  assert.equal(f.buyertel, '010-1234-5678');
});

test('모바일 결제창 값: 간편결제 바로 열기, 휴대폰 컨텐츠, 주문번호를 P_NOTI 로', () => {
  const f = mobileFields({ order, method: { mobile: { P_INI_PAYMENT: 'CARD', P_RESERVED: 'd_npay=Y' } }, buyer, urls }, cfg);
  assert.equal(f.P_RESERVED, 'centerCd=Y&apprun_check=Y&d_npay=Y');
  assert.equal(f.P_NOTI, order.orderId); assert.equal(f.P_HPP_METHOD, '1'); assert.equal(f.P_CHARSET, 'utf8');
  assert.equal(f.P_NEXT_URL, urls.mobileReturn);
});

test('승인 주소 검증: 이니시스 주소만, 운영에서는 스테이징 거부', () => {
  assert.equal(validPcReturn({ idc_name: 'stg', authUrl: 'https://stgstdpay.inicis.com/api/payAuth' }, cfg), true);
  assert.equal(validPcReturn({ idc_name: 'fc', authUrl: 'https://evil.example/api/payAuth' }, cfg), false);
  assert.equal(validPcReturn({ idc_name: 'zz', authUrl: pcAuthUrl('fc') }, cfg), false);
  assert.equal(validPcReturn({ idc_name: 'stg', authUrl: pcAuthUrl('stg') }, { prod: true }), false);
  assert.equal(validMobileReqUrl('https://ksmobile.inicis.com/smart/payReq.ini', cfg), true);
  assert.equal(validMobileReqUrl('https://ksmobile.inicis.com.evil.io/x', cfg), false);
  assert.equal(validMobileReqUrl('http://fcmobile.inicis.com/x', cfg), false);
});

test('PC 승인 요청: authToken 해시와 금액을 보내고 JSON 결과를 읽음', async () => {
  let seen;
  const fake = async (url, init) => { seen = { url, body: new URLSearchParams(init.body) }; return { text: async () => JSON.stringify({ resultCode: '0000', tid: 'T1', TotPrice: '4000' }) }; };
  const { data } = await pcApprove({ authUrl: pcAuthUrl('stg'), authToken: 'AT', price: 4000 }, cfg, fake, 1700000000000);
  assert.equal(data.tid, 'T1');
  assert.equal(seen.body.get('signature'), sha256('authToken=AT&timestamp=1700000000000'));
  assert.equal(seen.body.get('verification'), sha256(`authToken=AT&signKey=${TEST_SIGNKEY}&timestamp=1700000000000`));
  assert.equal(seen.body.get('format'), 'JSON'); assert.equal(seen.body.get('price'), '4000'); assert.equal(seen.body.get('mid'), TEST_MID);
});

test('모바일 승인 응답(P_STATUS=00&...) 읽기', async () => {
  assert.deepEqual(parseNvp('P_STATUS=00&P_TID=abc&P_RMESG1=정상처리&P_AMT=9900'), { P_STATUS: '00', P_TID: 'abc', P_RMESG1: '정상처리', P_AMT: '9900' });
  const fake = async (url, init) => { assert.equal(new URLSearchParams(init.body).get('P_TID'), 'TID9'); return { text: async () => 'P_STATUS=00&P_AMT=9900' }; };
  assert.equal((await mobileApprove({ reqUrl: 'https://fcmobile.inicis.com/smart/payReq.ini', tid: 'TID9' }, cfg, fake)).P_AMT, '9900');
});

test('시각 변환과 INIAPI 취소 해시', () => {
  assert.equal(kstDate('20261114', '203015').toISOString(), '2026-11-14T11:30:15.000Z');
  assert.equal(kstStamp(new Date('2026-11-14T11:30:15Z')), '20261114203015');
  const c = { ...cfg, apiKey: 'APIKEY' };
  const r = refundRequest({ tid: 'T1', msg: '고객 요청' }, c, new Date('2026-11-14T11:30:15Z'));
  const expected = createHash('sha512').update('APIKEY' + TEST_MID + 'refund' + '20261114203015' + JSON.stringify({ tid: 'T1', msg: '고객 요청' })).digest('hex');
  assert.equal(r.hashData, expected); assert.equal(r.type, 'refund');
});

test('돌아갈 주소는 허락한 사이트만, 이동 HTML 은 주소를 안전하게', () => {
  assert.equal(allowedBase('https://bomul-demo-vercel.vercel.app/', {}), true);
  assert.equal(allowedBase('http://localhost:4000/', {}), true);
  assert.equal(allowedBase('https://evil.example/', {}), false);
  assert.equal(allowedBase('https://bomul.kr/', { CLIENT_ORIGIN: 'https://bomul.kr' }), true);
  assert.equal(allowedBase('https://x.vercel.app/path', {}), false);
  assert.ok(!redirectHtml('/pay.html?x="><script>').includes('"><script>'));
});
