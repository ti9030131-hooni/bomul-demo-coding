// KG이니시스 결제 — 웹표준(PC) · 모바일 결제창, 승인, 망취소, INIAPI v2 취소
// 규격: https://manual.inicis.com/pay/stdpay_pc.html · https://manual.inicis.com/pay/stdpay_m.html · https://manual.inicis.com/pay/cancel.html
// 해시 문자열은 이니시스 공식 Node 샘플(INIstdpay_pc_nodejs)과 같은 모양입니다.
// 테스트: test/inicis.test.mjs
import { createHash } from 'node:crypto';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const sha512 = (s) => createHash('sha512').update(s).digest('hex');

// 이니시스 공개 테스트 상점(샘플에 들어 있는 값). 실제 돈이 오가지 않습니다.
export const TEST_MID = 'INIpayTest';
export const TEST_SIGNKEY = 'SU5JTElURV9UUklQTEVERVNfS0VZU1RS';

/** 환경변수 → 이니시스 설정. INICIS_ENV=prod 가 아니면 테스트(스테이징) */
export function inicisConfig(env = process.env) {
  const prod = env.INICIS_ENV === 'prod';
  return {
    prod,
    mid: env.INICIS_MID || (prod ? '' : TEST_MID),
    signKey: env.INICIS_SIGNKEY || (prod ? '' : TEST_SIGNKEY),
    apiKey: env.INICIS_API_KEY || '',                       // INIAPI Key(취소용). 가맹점관리자에서 발급
    clientIp: env.INICIS_CLIENT_IP || '127.0.0.1',          // INIAPI 요청 서버 IP(이니시스에 등록한 값)
    jsUrl: prod ? 'https://stdpay.inicis.com/stdjs/INIStdPay.js' : 'https://stgstdpay.inicis.com/stdjs/INIStdPay.js',
    closeJsUrl: 'https://stdpay.inicis.com/stdjs/INIStdPay_close.js',
    mobileUrl: 'https://mobile.inicis.com/smart/payment/',
    refundUrl: 'https://iniapi.inicis.com/v2/pg/refund',
  };
}

/* ── 결제창 요청값 ── */
// 상품명·이름에서 결제창이 받지 않는 문자를 빼고 길이를 줄입니다(이니시스가 바이트로 자르지만 미리 안전하게)
export const cleanText = (s, max) => String(s || '').replace(/[<>"'&\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
export const cleanTel = (s) => String(s || '').replace(/[^0-9-]/g, '').slice(0, 20);
export const cleanEmail = (s) => (/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(String(s || '')) ? String(s) : '');

/** PC 웹표준 결제창 form 값 */
export function pcFields({ order, method, buyer, urls }, cfg = inicisConfig(), now = Date.now()) {
  const oid = order.orderId;
  const price = String(order.amount);
  const timestamp = String(now);
  const accept = ['HPP(1)', 'centerCd(Y)', ...(method.pc.acceptmethod ? [method.pc.acceptmethod] : [])].join(':');
  return {
    version: '1.0',
    gopaymethod: method.pc.gopaymethod,
    mid: cfg.mid,
    oid,
    price,
    timestamp,
    use_chkfake: 'Y',
    signature: sha256(`oid=${oid}&price=${price}&timestamp=${timestamp}`),
    verification: sha256(`oid=${oid}&price=${price}&signKey=${cfg.signKey}&timestamp=${timestamp}`),
    mKey: sha256(cfg.signKey),
    currency: 'WON',
    goodname: cleanText(order.orderName, 40),
    buyername: cleanText(buyer.name, 30),
    buyertel: cleanTel(buyer.tel),
    buyeremail: cleanEmail(buyer.email),
    returnUrl: urls.pcReturn,
    closeUrl: urls.pcClose,
    acceptmethod: accept,
    charset: 'UTF-8',
  };
}

/** 모바일 결제창 form 값(accept-charset EUC-KR 로 보냄) */
export function mobileFields({ order, method, buyer, urls }, cfg = inicisConfig()) {
  const reserved = ['centerCd=Y', 'apprun_check=Y', ...(method.mobile.P_RESERVED ? [method.mobile.P_RESERVED] : [])].join('&');
  return {
    P_INI_PAYMENT: method.mobile.P_INI_PAYMENT,
    P_MID: cfg.mid,
    P_OID: order.orderId,
    P_AMT: String(order.amount),
    P_GOODS: cleanText(order.orderName, 40),
    P_UNAME: cleanText(buyer.name, 30),
    P_MOBILE: cleanTel(buyer.tel),
    P_EMAIL: cleanEmail(buyer.email),
    P_NEXT_URL: urls.mobileReturn,
    P_NOTI: order.orderId,
    P_CHARSET: 'utf8',
    P_HPP_METHOD: '1',                                      // 휴대폰결제 상품유형 1: 컨텐츠
    P_RESERVED: reserved,
  };
}

/* ── 승인 URL 검증: 이니시스가 아닌 곳으로 승인 요청을 보내지 않게 ── */
const IDC = ['fc', 'ks', 'stg'];
export function pcAuthUrl(idc) { return IDC.includes(idc) ? `https://${idc}stdpay.inicis.com/api/payAuth` : null; }
export function pcNetCancelUrl(idc) { return IDC.includes(idc) ? `https://${idc}stdpay.inicis.com/api/netCancel` : null; }
export function validPcReturn(body, cfg = inicisConfig()) {
  const idc = String(body.idc_name || '');
  if (cfg.prod && idc === 'stg') return false;               // 운영에서 스테이징 결과는 받지 않음
  return !!pcAuthUrl(idc) && body.authUrl === pcAuthUrl(idc);
}
export function validMobileReqUrl(url, cfg = inicisConfig()) {
  try {
    const u = new URL(url);
    const hosts = cfg.prod ? ['fcmobile.inicis.com', 'ksmobile.inicis.com'] : ['fcmobile.inicis.com', 'ksmobile.inicis.com', 'stgmobile.inicis.com'];
    return u.protocol === 'https:' && hosts.includes(u.hostname);
  } catch { return false; }
}

/* ── 승인 요청 ── */
async function postForm(url, params, fetchImpl) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: new URLSearchParams(params).toString(),
  });
  return res.text();
}

/** PC 승인: authUrl 로 authToken 을 보내 결제를 확정합니다 */
export async function pcApprove({ authUrl, authToken, price }, cfg = inicisConfig(), fetchImpl = fetch, now = Date.now()) {
  const timestamp = String(now);
  const params = {
    mid: cfg.mid,
    authToken,
    timestamp,
    signature: sha256(`authToken=${authToken}&timestamp=${timestamp}`),
    verification: sha256(`authToken=${authToken}&signKey=${cfg.signKey}&timestamp=${timestamp}`),
    charset: 'UTF-8',
    format: 'JSON',
    price: String(price),
  };
  const text = await postForm(authUrl, params, fetchImpl);
  let data;
  try { data = JSON.parse(text); } catch { data = { resultCode: 'PARSE', resultMsg: '승인 응답을 읽지 못했어요.' }; }
  return { data, params };
}

/** PC 망취소(승인 뒤 우리 쪽 처리에 실패했을 때만, 10분 안) */
export async function pcNetCancel(idc, params, fetchImpl = fetch) {
  const url = pcNetCancelUrl(idc);
  if (!url) return null;
  try { return JSON.parse(await postForm(url, params, fetchImpl)); } catch { return null; }
}

// "P_STATUS=00&P_TID=..." 모양의 응답을 객체로(샘플과 같이 값은 그대로 둠)
export function parseNvp(text) {
  const out = {};
  for (const part of String(text || '').split('&')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i)] = part.slice(i + 1);
  }
  return out;
}

/** 모바일 승인: P_REQ_URL 로 P_MID, P_TID 를 보냅니다 */
export async function mobileApprove({ reqUrl, tid }, cfg = inicisConfig(), fetchImpl = fetch) {
  return parseNvp(await postForm(reqUrl, { P_MID: cfg.mid, P_TID: tid }, fetchImpl));
}

// 이니시스 승인 시각(YYYYMMDD + hhmmss, 한국 시각) → Date
export function kstDate(ymd, hms) {
  const d = String(ymd || ''), t = String(hms || '000000').padEnd(6, '0');
  if (!/^\d{8}$/.test(d)) return new Date();
  return new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}+09:00`);
}

/* ── 결제 취소(환불): INIAPI v2 ── */
export function kstStamp(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().replace(/\D/g, '').slice(0, 14);   // YYYYMMDDhhmmss
}
export function refundRequest({ tid, msg }, cfg = inicisConfig(), now = new Date()) {
  const type = 'refund';
  const timestamp = kstStamp(now);
  const data = { tid, msg: cleanText(msg || '고객 요청', 80) };
  // hashData 대상: INIAPIKey + mid + type + timestamp + data (data 는 JSON 문자열)
  const hashData = sha512(cfg.apiKey + cfg.mid + type + timestamp + JSON.stringify(data));
  return { mid: cfg.mid, type, timestamp, clientIp: cfg.clientIp, hashData, data };
}
export async function inicisRefund({ tid, msg }, cfg = inicisConfig(), fetchImpl = fetch) {
  if (!cfg.apiKey) {
    const e = new Error('INICIS_API_KEY 가 없어 자동 취소를 할 수 없어요. 이니시스 가맹점관리자에서 취소한 뒤 「수동 처리」로 표시하세요.');
    e.status = 409; e.code = 'NO_INIAPI_KEY'; throw e;
  }
  const res = await fetchImpl(cfg.refundUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
    body: JSON.stringify(refundRequest({ tid, msg }, cfg)),
  });
  const data = await res.json().catch(() => ({}));
  if (data.resultCode !== '00') {
    const e = new Error(data.resultMsg || '결제 취소에 실패했어요.');
    e.status = 400; e.code = `INICIS_${data.resultCode || 'ERROR'}`; throw e;
  }
  return data;
}

/* ── 돌아갈 주소 검증: 허락한 사이트로만 ── */
export function allowedBase(url, env = process.env) {
  try {
    const u = new URL(url);
    if (u.pathname !== '/' || u.search || u.hash) return false;
    const origin = u.origin;
    if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true;
    if (u.protocol === 'https:' && (u.hostname === 'vercel.app' || u.hostname.endsWith('.vercel.app'))) return true;
    const extra = `${env.CLIENT_ORIGIN || ''},${env.PUBLIC_API_BASE || ''}`.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
    return extra.includes(origin);
  } catch { return false; }
}

/** 결제창이 돌아간 뒤 화면을 바꾸는 작은 HTML. PC 결제창 레이어 안에서 열려도 맨 위 창을 옮깁니다 */
export function redirectHtml(url) {
  const safe = String(url).replace(/[<>"']/g, '');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="1;url=${safe}"><title>결제 확인 중</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;text-align:center;color:#444">결제 결과로 이동하고 있어요… <a href="${safe}" target="_top">이동하지 않으면 누르세요</a>
<script>try{(window.top||window).location.replace(${JSON.stringify(safe)});}catch(e){location.replace(${JSON.stringify(safe)});}</script></body></html>`;
}
export function closeHtml(cfg = inicisConfig()) {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><script src="${cfg.closeJsUrl}" charset="UTF-8"></script></body></html>`;
}
