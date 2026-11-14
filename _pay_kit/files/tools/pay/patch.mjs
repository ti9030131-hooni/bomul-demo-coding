#!/usr/bin/env node
// 결제(코스 도전권) 연결 패치 — 여러 번 실행해도 한 번만 들어갑니다. 원본은 *.before-pay 로 백업.
//   node tools/pay/patch.mjs            (저장소 맨 위에서)
//   node tools/pay/patch.mjs --check    (바꾸지 않고 들어갈 자리만 확인)
// 바꾸는 곳
//   server/src/app.js                 : /api/pay · /api/draw 연결, 오류 응답에 code 포함
//   client/public/ar/course.html      : 첫 보물 무료 체험 뒤 도전권 확인 · 보물 상자에서 추첨 응모(1인 1회)
//   client/public/bomul.html          : 코스 상세 「도전권 구매 · 4,000원부터」 버튼 · (새 디자인이면) 1인 1회 응모 안내
//   ar/data/common.js · arDefaults.json · tools/i18n/lang/* : 추첨 1인 1회 설명, 적립금 500P(현장 완주만)·교환표 조정
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECK = process.argv.includes('--check');
const COURSE_BLOCK = readFileSync(join(HERE, 'snippets/course-pass.js'), 'utf8');
const DRAW_BLOCK = readFileSync(join(HERE, 'snippets/course-draw.js'), 'utf8');
const POINTS_BLOCK = readFileSync(join(HERE, 'snippets/course-points.js'), 'utf8');
const FREE_BLOCK = readFileSync(join(HERE, 'snippets/course-free-draw.js'), 'utf8');

const APP = [
  ['라우터 import', "import ordersRouter from './routes/orders.js';", "import ordersRouter from './routes/orders.js';\nimport payRouter from './routes/pay.js';"],
  ['라우터 연결', "app.use('/api/ar', arRouter);", "app.use('/api/ar', arRouter);\napp.use('/api/pay', payRouter);"],
  ['오류 code', "res.status(status).json({ message: status < 500 ? err.message : '서버 오류가 발생했습니다.' });",
    "res.status(status).json({\n    message: status < 500 ? err.message : '서버 오류가 발생했습니다.',\n    ...(status < 500 && typeof err.code === 'string' ? { code: err.code } : {}),\n  });"],
];
const COURSE = [
  ['도전권 함수', 'function openStop(i){', () => COURSE_BLOCK + 'function openStop(i){'],
  ['안내 문구 자리', '    <p class="geo-status" id="stopGeo"></p>\n    <button class="btn" id="goAR"></button>',
    '    <p class="geo-status" id="stopGeo"></p>\n    <p class="geo-status" id="passNote" hidden></p>\n    <button class="btn" id="goAR"></button>'],
  ['AR 열기 전 확인', '  renderStopGeo();\n  $("#goAR").addEventListener("click", () => openAR(i));',
    '  renderStopGeo();\n  passNote(i);\n  $("#goAR").addEventListener("click", async () => {\n    if (PASS.loading) await PASS.p;                // 확인 중이면 잠깐 기다립니다\n    if (needsPass(i)) { passGate(i); return; }\n    openAR(i);\n  });'],
];
const BOMUL = [
  ['CSS', '.ar-cta-box .btn{white-space:nowrap}',
    `.ar-cta-box .btn{white-space:nowrap}
.ar-cta-btns{display:flex;flex-wrap:wrap;gap:10px}
.pay-slot:empty{display:none}`],
  ['함수', 'function arUrl(c){ return c.ar || `/ar/course.html?id=${encodeURIComponent(c.id)}`; }',
    `function arUrl(c){ return c.ar || \`/ar/course.html?id=\${encodeURIComponent(c.id)}\`; }
/* 코스 도전권(결제) */
/* 서버 /api/pay/config 의 mode 가 inicis·mock 일 때만 「도전권 구매」 버튼을 보입니다(off 면 지금처럼 숨김). */
let PAY_CFG=null;
function payCtaHtml(id){
  if(!PAY_CFG || (PAY_CFG.mode!=="inicis" && PAY_CFG.mode!=="mock")) return "";
  const min=Math.min(...(PAY_CFG.products||[]).map(p=>p.price));
  return \`<a class="btn btn-ghost pay-cta" href="/pay.html?course=\${encodeURIComponent(id)}">도전권 구매 · \${Number(min).toLocaleString("ko-KR")}원부터</a>\`;
}
function payCta(c){ return \`<span class="pay-slot" data-pay-slot="\${c.id}">\${payCtaHtml(c.id)}</span>\`; }
function fillPayCtas(){ document.querySelectorAll("[data-pay-slot]").forEach(el=>{ el.innerHTML=payCtaHtml(el.dataset.paySlot); }); }
fetch(API_BASE+"/api/pay/config").then(r=>r.ok?r.json():null).then(cfg=>{ if(cfg){ PAY_CFG=cfg; fillPayCtas(); } }).catch(()=>{});`],
  ['상단 버튼', '<a class="btn btn-primary" href="${arUrl(c)}">AR 탁본 시작하기</a></div>',
    '<div class="ar-cta-btns"><a class="btn btn-primary" href="${arUrl(c)}">AR 탁본 시작하기</a>${payCta(c)}</div></div>'],
  ['하단 버튼', '<a class="btn btn-primary" href="${arUrl(c)}">AR 탁본 시작하기</a>\n      <button',
    '<a class="btn btn-primary" href="${arUrl(c)}">AR 탁본 시작하기</a>${payCta(c)}\n      <button'],
];

const APP_DRAW = [
  ['추첨 import', "import payRouter from './routes/pay.js';", "import payRouter from './routes/pay.js';\nimport drawRouter from './routes/draw.js';"],
  ['추첨 연결', "app.use('/api/pay', payRouter);", "app.use('/api/pay', payRouter);\napp.use('/api/draw', drawRouter);"],
];
const COURSE_DRAW = [
  ['추첨 함수', 'function openReward(){', () => DRAW_BLOCK + 'function openReward(){'],
  ['추첨 안내 자리', '${p.action ? `<button class="act" data-act="${p.go||""}">${esc(p.action)}</button>` : ""}</div>',
    '${p.icon === "draw" ? `<p class="draw-st" data-draw-st hidden></p>` : ""}\n        ${p.action ? `<button class="act" data-act="${p.go||""}">${esc(p.action)}</button>` : ""}</div>'],
  ['상자 열면 응모', 'const list = $("#prizeList"); list.classList.remove("go"); void list.offsetWidth; list.classList.add("go");',
    'const list = $("#prizeList"); list.classList.remove("go"); void list.offsetWidth; list.classList.add("go");\n  syncDraw();'],
  ['로그인·도전권 버튼', '  if (b.dataset.act === "shop") { show("v-shop"); return; }',
    '  if (b.dataset.act === "login") { location.href = `/login?next=${encodeURIComponent(`/ar/course.html?id=${encodeURIComponent(C.id)}`)}`; return; }\n  if (b.dataset.act === "pay") { location.href = `/pay.html?course=${encodeURIComponent(C.id)}`; return; }\n  if (b.dataset.act === "shop") { show("v-shop"); return; }'],
];
const KO_OLD = '1등 300만 원, 2등 200만 원, 3등 100만 원 추첨에 자동으로 응모되었어요.';
const KO_MID = '1등 300만 원, 2등 200만 원, 3등 100만 원 추첨에 응모돼요. 추첨은 시즌마다 한 사람당 한 번이라, 여러 코스를 완주해도 당첨 기회는 같아요.';
const KO_NEW = '1등 150만 원, 2등 100만 원, 3등 50만 원 추첨에 응모돼요. 추첨은 시즌마다 한 사람당 한 번이라, 여러 코스를 완주해도 당첨 기회는 같아요. 결제하지 않아도 첫 보물 무료 체험 뒤 무료로 응모할 수 있어요.';
const PRIZE_MID = [['추첨 설명(상금 절반·무료 응모)', KO_MID, KO_NEW]];
const PRIZE_TEXT = [['추첨 설명', KO_OLD, KO_NEW]];
const EN = ['You have been automatically entered in the draw: 1st prize ₩3,000,000, 2nd ₩2,000,000, 3rd ₩1,000,000.',
  "You're entered in the draw: 1st prize ₩3,000,000, 2nd ₩2,000,000, 3rd ₩1,000,000. Each person is entered once per season, so completing more courses doesn't change your odds.",
  "You're entered in the draw: 1st prize ₩1,500,000, 2nd ₩1,000,000, 3rd ₩500,000. Each person is entered once per season, so completing more courses doesn't change your odds. You can also enter for free, without paying, after the free trial of the first treasure."];
const ZH = ['已自动参与抽奖：一等奖300万韩元，二等奖200万韩元，三等奖100万韩元。',
  '已参与抽奖：一等奖300万韩元，二等奖200万韩元，三等奖100万韩元。每个赛季每人只参与一次，完成多条路线，中奖机会也相同。',
  '已参与抽奖：一等奖150万韩元，二等奖100万韩元，三等奖50万韩元。每个赛季每人只参与一次，完成多条路线，中奖机会也相同。不付费也可在完成第一件宝物的免费体验后免费参与。'];
const I18N_TEXT = [['영어', EN[0], EN[2]], ['중국어', ZH[0], ZH[2]]];
const I18N_MID = [['영어(상금 절반·무료 응모)', EN[1], EN[2]], ['중국어(상금 절반·무료 응모)', ZH[1], ZH[2]]];
const LEAD = ['<p class="bf-lead">코스를 완주하면 완주 증명서와 함께 추첨에 응모됩니다.</p>',
  '<p class="bf-lead">코스를 완주하면 완주 증명서와 함께 추첨에 응모됩니다. 추첨은 시즌마다 한 사람당 1회예요.</p>',
  '<p class="bf-lead">코스를 완주하면 완주 증명서와 함께 추첨에 응모됩니다. 추첨은 시즌마다 한 사람당 1회이고, 결제 없이 첫 보물 무료 체험만 해도 응모할 수 있어요.</p>'];
const NOTICE_DRAW = ['<li>완주 보상 추첨은 시즌마다 한 사람당 1회 응모되며, 여러 코스를 완주해도 당첨 기회는 같습니다.</li>',
  '<li>완주 보상 추첨은 시즌마다 한 사람당 1회 응모되며, 여러 코스를 완주해도 당첨 기회는 같습니다. 결제하지 않아도 회원가입 후 첫 보물 무료 체험을 마치면 무료로 응모할 수 있습니다(구매 없이 응모 가능).</li>'];
const BOMUL_DRAW = [
  ['완주 보상 안내', LEAD[0], LEAD[2]],
  ['유의사항', '<li>완주 보상 상품 구성과 받는 방법은 운영 안내에 따라 달라질 수 있습니다.</li>',
    '<li>완주 보상 상품 구성과 받는 방법은 운영 안내에 따라 달라질 수 있습니다.</li>\n            ' + NOTICE_DRAW[1]],
];
const BOMUL_DRAW_MID = [['완주 보상 안내(무료 응모)', LEAD[1], LEAD[2]], ['유의사항(무료 응모)', NOTICE_DRAW[0], NOTICE_DRAW[1]]];
const TICKETS = [300, 200, 100].map((v, i) => [`${i + 1}등 상금`, `<b>${i + 1}등</b><strong>${v}<span>만 원</span></strong>`, `<b>${i + 1}등</b><strong>${[150, 100, 50][i]}<span>만 원</span></strong>`]);
const PRIZE_LIST = [['1등', '300만 원과 완주 증명서', '150만 원과 완주 증명서'], ['2등', '200만 원과 완주 증명서', '100만 원과 완주 증명서'], ['3등', '100만 원과 완주 증명서', '50만 원과 완주 증명서']]
  .map(([r, a, b]) => [`상금 목록 ${r}`, `<li><b>${r}</b><span>${a}</span></li>`, `<li><b>${r}</b><span>${b}</span></li>`]);
const PRIZE_LIST_NOTE = [['무료 응모 안내', '<h3>완주 보상 상품 내역</h3>', '<h3>완주 보상 상품 내역</h3>\n            <p style="margin:6px 0 10px;font-size:.9em;opacity:.85">시즌마다 1인 1회 추첨 · 결제 없이 첫 보물 무료 체험만 해도 응모할 수 있어요.</p>']];
const COURSE_FREE = [
  ['무료 응모 함수', 'function openReward(){', () => FREE_BLOCK + 'function openReward(){'],
  ['도전권 창에 무료 응모', '<button class="btn" id="pgBuy">도전권 구매하기</button><button class="btn line" id="pgNo">나중에</button>`);\n    $("#pgBuy").addEventListener("click", () => go(`/pay.html?course=${encodeURIComponent(C.id)}`));',
    '<button class="btn" id="pgBuy">도전권 구매하기</button>${freeDrawBtn()}<button class="btn line" id="pgNo">나중에</button>`);\n    $("#pgBuy").addEventListener("click", () => go(`/pay.html?course=${encodeURIComponent(C.id)}`));\n    bindFreeDraw();'],
  ['무료 체험 뒤 안내', '      <p>${esc(s.explain)}</p>\n      ${all ?', '      <p>${esc(s.explain)}</p>\n      ${freeDrawNote(AR.idx)}\n      ${all ?'],
  ['무료 응모 버튼 연결', '  sh.hidden = false;\n  $("#gAlbum")', '  sh.hidden = false;\n  bindFreeDraw();\n  $("#gAlbum")'],
  ['로그인 창 안내', '번째 보물부터는 로그인하고 도전권을 준비하면 이어서 탁본할 수 있어요.</p>', '번째 보물부터는 로그인하고 도전권을 준비하면 이어서 탁본할 수 있어요. 결제하지 않아도 로그인하면 완주 보상 추첨에는 무료로 응모할 수 있어요.</p>'],
  ['도전권 창 안내', '도전권이 있으면 남은 보물을 모두 탁본하고 완주 보상을 받을 수 있어요.</p>', '도전권이 있으면 남은 보물을 모두 탁본하고 완주 보상을 받을 수 있어요. 도전권 없이도 첫 보물 무료 체험 뒤 완주 보상 추첨에는 무료로 응모할 수 있어요.</p>'],
];


/* ── 적립금·교환표 조정: 완주 500P(현장 모드만), 1P ≈ 1원 ── */
const PT = {
  prize: '현장에서 모든 보물을 탁본해 완주한 코스마다 한 번 500P가 쌓여요(1P는 약 1원). 모은 포인트로 상품을 골라 교환할 수 있어요.',
  shop: [
    ['rank1', 1, 'crown', '외식 모바일 상품권 1만 5천 원', 15000, '치킨·피자 같은 외식 브랜드 모바일 상품권 가운데 하나를 골라 받을 수 있어요. 현장 완주 30코스면 모여요.'],
    ['rank2', 2, 'gift', '문화상품권 1만 원', 10000, '모바일 문화상품권으로 보내 드려요. 현장 완주 20코스면 모여요.'],
    ['rank3', 3, 'coffee', '스타벅스 아메리카노 Tall', 5000, '모바일 쿠폰으로 보내 드려요. 현장 완주 10코스면 모여요.'],
    ['rank4', 4, 'voucher', '편의점 모바일 상품권 3천 원', 3000, '모바일 상품권으로 보내 드려요. 현장 완주 6코스면 모여요.'],
    ['rank5', 5, 'ticket', '편의점 모바일 상품권 1천 원', 1000, '모바일 상품권으로 보내 드려요. 현장 완주 2코스면 모여요.'],
  ],
  tr: {
    en: { prize: 'Each course you complete on site, rubbing every treasure in person, earns 500P once (1P ≈ ₩1). Use your points to choose and exchange rewards.',
      shop: [['Dining mobile gift card ₩15,000', 'Choose one mobile gift card from dining brands such as chicken or pizza. Collected by completing 30 courses on site.'],
        ['Culture gift card ₩10,000', 'Sent to you as a mobile culture gift card. Collected by completing 20 courses on site.'],
        ['Starbucks Caffè Americano (Tall)', 'Sent to you as a mobile coupon. Collected by completing 10 courses on site.'],
        ['Convenience store mobile gift card ₩3,000', 'Sent to you as a mobile gift card. Collected by completing 6 courses on site.'],
        ['Convenience store mobile gift card ₩1,000', 'Sent to you as a mobile gift card. Collected by completing 2 courses on site.']] },
    zh: { prize: '每条在现场亲手拓印全部宝物完成的路线，可获得一次500P（1P约合1韩元）。可用攒下的积分挑选并兑换商品。',
      shop: [['餐饮手机礼券1万5千韩元', '可从炸鸡、披萨等餐饮品牌的手机礼券中任选一张。现场完成30条路线即可集齐。'],
        ['文化商品券1万韩元', '以手机文化商品券形式发送给您。现场完成20条路线即可集齐。'],
        ['星巴克美式咖啡（中杯）', '以手机优惠券形式发送给您。现场完成10条路线即可集齐。'],
        ['便利店手机礼券3千韩元', '以手机礼券形式发送给您。现场完成6条路线即可集齐。'],
        ['便利店手机礼券1千韩元', '以手机礼券形式发送给您。现场完成2条路线即可集齐。']] },
  },
};
const OLD_SHOP = [
  ['rank1', 1, 'crown', '80만~100만 원 상당 상품', 1000000, '80만~100만 원 상당의 상품 가운데 하나를 골라 받을 수 있어요.'],
  ['rank2', 2, 'gift', '50만 원 상당 상품', 500000, '50만 원 상당의 상품 가운데 하나를 골라 받을 수 있어요.'],
  ['rank3', 3, 'voucher', '백화점 상품권 10만 원', 200000, '모바일 백화점 상품권으로 보내 드려요.'],
  ['rank4', 4, 'coffee', '스타벅스 커피 쿠폰', 50000, '모바일 쿠폰으로 보내 드려요.'],
  ['rank5', 5, 'ticket', '편의점 모바일 상품권 5천 원', 20000, '모바일 상품권으로 보내 드려요.'],
];
const OLD_PRIZE = '적립금이 포인트로 지급되었어요. 모은 포인트로 원하는 상품을 골라 교환할 수 있어요.';
// ar/data/common.js 한 줄 모양
const jsShop = ([id, rank, icon, name, points, desc]) => `    { id: "${id}", rank: ${rank}, icon: ${JSON.stringify(icon)},${' '.repeat(Math.max(1, 9 - icon.length))}name: ${JSON.stringify(name)},${' '.repeat(Math.max(1, 26 - name.length))}points: ${points},${' '.repeat(Math.max(1, 8 - String(points).length))}desc: ${JSON.stringify(desc)} }`;
const jsonShop = ([id, rank, icon, name, points, desc]) => `    { "id": "${id}", "rank": ${rank}, "icon": "${icon}", "name": ${JSON.stringify(name)}, "points": ${points}, "desc": ${JSON.stringify(desc)} }`;
const POINTS_COMMON = [
  ['적립금 500P', `{ icon: "point", title: "보물 적립금", points: 100000, desc: "${OLD_PRIZE}"`, `{ icon: "point", title: "보물 적립금", points: 500, desc: "${PT.prize}"`],
];
// 교환표 줄은 줄 전체를 바꿉니다(공백 정렬이 달라도 찾을 수 있게 이름으로 줄을 찾음)
function replaceShopLines(s, mk) {
  const lines = s.split('\n');
  OLD_SHOP.forEach((o, i) => {
    const at = lines.findIndex((l) => l.includes(`"${o[0]}"`) && l.includes(JSON.stringify(o[3])));
    if (at >= 0) lines[at] = mk(PT.shop[i]) + (lines[at].trimEnd().endsWith(',') ? ',' : '');
  });
  return lines.join('\n');
}
const shopFound = (s) => OLD_SHOP.every((o) => s.split('\n').some((l) => l.includes(`"${o[0]}"`) && l.includes(JSON.stringify(o[3]))));
const COURSE_POINTS = [
  ['적립 규칙', 'persistWallet(); persist();\nconst doneCount = ', () => POINTS_BLOCK + 'persistWallet(); persist();\nconst doneCount = '],
  ['현장 완주만 적립', '  const earn = wallet.granted[C.id] ? 0 : C.final.prizes.reduce((t,p) => t + (p.points || 0), 0);\n  save.reward = { openedAt: Date.now(), earned: earn };',
    '  const demo = POINTS_ONSITE_ONLY && !onsiteAll();                       // 데모 모드 완주는 적립금 없음\n  const earn = (demo || wallet.granted[C.id]) ? 0 : C.final.prizes.reduce((t,p) => t + (p.points || 0), 0);\n  save.reward = { openedAt: Date.now(), earned: earn, demo, pv: POINTS_VERSION };'],
  ['데모 완주 안내', '${p.points ? `<span class="pts">+${fmtP(p.points)}</span>` : ""}',
    '${p.points ? (save.reward && save.reward.demo ? `<span class="pts off">현장 완주 때 +${fmtP(p.points)}</span><p class="pts-note">데모 모드로 완주해서 이번에는 적립금이 없어요. 현장에서 모든 보물을 탁본하면 받을 수 있어요.</p>` : `<span class="pts">+${fmtP(p.points)}</span>`) : ""}'],
  ['지갑 안내', '<p>코스를 완주할 때마다 적립금이 쌓여요. 원하는 상품을 골라 교환하세요.</p>', '<p>현장 모드로 완주한 코스마다 500P가 쌓여요(데모 모드 제외). 원하는 상품을 골라 교환하세요.</p>'],
];
const I18N_POINTS = (s) => {
  const j = JSON.parse(s);
  for (const lang of ['en', 'zh']) {
    if (!j[lang]) continue;
    j[lang].prizes[1].desc = PT.tr[lang].prize;
    j[lang].pointShop = PT.tr[lang].shop.map(([name, desc]) => ({ name, desc }));
  }
  const indent = (s.match(/\n( +)"/) || [, '  '])[1].length;            // 원래 들여쓰기 유지
  return JSON.stringify(j, null, indent) + (s.endsWith('\n') ? '\n' : '');
};
const DETAIL_KO = ['A4로 인쇄할 수 있는 완주 증명서와 보물 적립금 100,000P를 받고, 적립금은 1~5등 포인트 상품으로 교환할 수 있습니다.',
  'A4로 인쇄할 수 있는 완주 증명서를 받고, 현장에서 완주하면 보물 적립금 500P가 쌓여 1~5등 포인트 상품으로 교환할 수 있습니다.'];
const DETAIL_EN = ['You receive a completion certificate you can print on A4 and 100,000P in treasure points, which can be exchanged for 1st–5th prize point rewards.',
  'You receive a completion certificate you can print on A4, and completing on site earns 500P in treasure points, which can be exchanged for 1st–5th prize point rewards.'];
const DETAIL_ZH = ['你将获得可用A4纸打印的完成证书和100,000P宝物积分，积分可兑换1~5等积分奖品。',
  '你将获得可用A4纸打印的完成证书；在现场完成还可获得500P宝物积分，积分可兑换1~5等积分奖品。'];
const BOMUL_PT_TEXT = ['적립금은 모든 코스에서 함께 쌓여 1~5등 포인트 상품으로 바꿀 수 있습니다. 현장 밖에서도 데모 모드로 체험할 수 있어요.',
  '적립금은 현장에서 완주한 코스마다 500P씩 함께 쌓여 1~5등 포인트 상품으로 바꿀 수 있습니다. 현장 밖에서도 데모 모드로 체험할 수 있어요(데모 모드는 적립금 없음).'];
const BOMUL_PT_CARD = ['<h3>적립금 100,000P</h3><p>완주하면 1~5등 포인트 상품으로 교환</p>', '<h3>적립금 500P</h3><p>현장 완주마다 적립 · 1~5등 상품으로 교환</p>'];
const BOMUL_PT_NOTICE = ['<li>적립금은 모든 코스에서 함께 쌓이며 코스마다 한 번만 지급됩니다.</li>',
  '<li>적립금은 현장 모드로 완주한 코스마다 한 번 500P가 지급되며(데모 모드 제외), 모든 코스에서 함께 쌓입니다.</li>'];

// optional: 자리가 없으면 실패가 아니라 건너뜀(예: 예전 화면에는 추첨 안내 문구가 없음)
const TARGETS = [
  { file: 'server/src/app.js', marker: "app.use('/api/pay'", steps: APP },
  { file: 'server/src/app.js', marker: "app.use('/api/draw'", steps: APP_DRAW },
  { file: 'client/public/ar/course.html', marker: '/* ═════════════════ 도전권(결제)', steps: COURSE },
  { file: 'client/public/ar/course.html', marker: '/* ═════════════════ 완주 보상 추첨', steps: COURSE_DRAW },
  { file: 'client/public/ar/data/common.js', marker: KO_NEW, steps: PRIZE_MID, optional: true },
  { file: 'client/public/ar/data/common.js', marker: KO_NEW, steps: PRIZE_TEXT },
  { file: 'server/src/data/arDefaults.json', marker: KO_NEW, steps: PRIZE_MID, optional: true },
  { file: 'server/src/data/arDefaults.json', marker: KO_NEW, steps: PRIZE_TEXT },
  { file: 'tools/i18n/lang/common.json', marker: EN[2], steps: I18N_MID, optional: true, after: 'node tools/i18n/build.cjs 로 번역 사전을 다시 만드세요.' },
  { file: 'tools/i18n/lang/common.json', marker: EN[2], steps: I18N_TEXT, optional: true, after: 'node tools/i18n/build.cjs 로 번역 사전을 다시 만드세요.' },
  { file: 'client/public/bomul.html', marker: '/* 코스 도전권(결제) */', steps: BOMUL },
  { file: 'client/public/bomul.html', marker: LEAD[2], steps: BOMUL_DRAW_MID, optional: true },
  { file: 'client/public/bomul.html', marker: LEAD[2], steps: BOMUL_DRAW, optional: true },
  // 상금 절반(150·100·50만 원) · 무료 응모 경로
  { file: 'client/public/ar/course.html', marker: 'async function enterFreeDraw', steps: COURSE_FREE },
  { file: 'client/public/bomul.html', marker: TICKETS[0][2], steps: TICKETS, optional: true },
  { file: 'client/public/bomul.html', marker: PRIZE_LIST[0][2], steps: [...PRIZE_LIST, ...PRIZE_LIST_NOTE], optional: true },
  // 예전 키트(토스)로 설치했던 곳: 결제 모드 이름을 inicis 로
  { file: 'client/public/ar/course.html', marker: '(cfg.mode !== "inicis" && cfg.mode !== "mock")', steps: [['결제 모드 이름(inicis)', '(cfg.mode !== "toss" && cfg.mode !== "mock")', '(cfg.mode !== "inicis" && cfg.mode !== "mock")']], optional: true },
  { file: 'client/public/bomul.html', marker: '(PAY_CFG.mode!=="inicis" && PAY_CFG.mode!=="mock")', steps: [['결제 모드 이름(inicis)', '(PAY_CFG.mode!=="toss" && PAY_CFG.mode!=="mock")', '(PAY_CFG.mode!=="inicis" && PAY_CFG.mode!=="mock")']], optional: true },
  // 적립금·교환표
  { file: 'client/public/ar/course.html', marker: 'const POINTS_ONSITE_ONLY', steps: COURSE_POINTS },
  { file: 'client/public/ar/data/common.js', marker: 'points: 500,', steps: [POINTS_COMMON[0]], shop: jsShop },
  { file: 'server/src/data/arDefaults.json', marker: '"points": 500,', steps: [['적립금 500P', `"points": 100000, "desc": "${OLD_PRIZE}"`, `"points": 500, "desc": "${PT.prize}"`]], shop: jsonShop },
  { file: 'tools/i18n/lang/common.json', marker: 'Collected by completing 30 courses on site', transform: I18N_POINTS, optional: true, after: 'node tools/i18n/build.cjs 로 번역 사전을 다시 만드세요.' },
  { file: 'tools/i18n/lang/en/details.json', marker: DETAIL_EN[1], steps: [['경복궁 상세(영어)', DETAIL_EN[0], DETAIL_EN[1]]], optional: true, after: 'node tools/i18n/build.cjs 로 번역 사전을 다시 만드세요.' },
  { file: 'tools/i18n/lang/zh/details.json', marker: DETAIL_ZH[1], steps: [['경복궁 상세(중국어)', DETAIL_ZH[0], DETAIL_ZH[1]]], optional: true, after: 'node tools/i18n/build.cjs 로 번역 사전을 다시 만드세요.' },
  { file: 'client/public/bomul.html', marker: DETAIL_KO[1], steps: [['경복궁 상세 적립금', DETAIL_KO[0], DETAIL_KO[1]]], optional: true },
  { file: 'client/public/bomul.html', marker: BOMUL_PT_TEXT[1], steps: [['AR 소개 적립금', ...BOMUL_PT_TEXT]], optional: true },
  { file: 'client/public/bomul.html', marker: BOMUL_PT_CARD[1], steps: [['혜택 카드 적립금', ...BOMUL_PT_CARD]], optional: true },
  { file: 'client/public/bomul.html', marker: BOMUL_PT_NOTICE[1], steps: [['유의사항 적립금', ...BOMUL_PT_NOTICE]], optional: true },
];

let bad = 0;
const notes = [];
for (const { file, marker, steps = [], optional, after, transform, shop } of TARGETS) {
  if (!existsSync(file)) { console.log(`- 없음(건너뜀): ${file}`); continue; }
  let s = readFileSync(file, 'utf8');
  const bom = s.startsWith('\uFEFF') ? '\uFEFF' : '';
  if (bom) s = s.slice(1);
  const crlf = s.includes('\r\n');
  if (crlf) s = s.replace(/\r\n/g, '\n');
  const what = [...steps.map(([n]) => n), ...(shop ? ['교환표 1~5등'] : []), ...(transform ? ['번역'] : [])].join(' · ');
  if (s.includes(marker)) { console.log(`✓ 이미 들어 있음: ${file} (${what})`); continue; }
  const miss = steps.filter(([, a]) => s.split(a).length !== 2).map(([n, a]) => `${n}(${s.split(a).length - 1}곳)`);
  if (shop && !shopFound(s)) miss.push('교환표(예전 1~5등 줄)');
  if (transform) { try { transform(s); } catch { miss.push('JSON 읽기'); } }
  if (miss.length) {
    if (optional) { console.log(`- 해당 없음(건너뜀): ${file} — ${miss.join(', ')}`); continue; }
    bad += 1; console.log(`✗ 자리를 찾지 못해 그대로 둠: ${file} — ${miss.join(', ')}`); continue;
  }
  if (CHECK) { console.log(`○ 넣을 수 있음: ${file} (${what})`); continue; }
  for (const [, a, b] of steps) s = s.replace(a, typeof b === 'function' ? b : () => b);
  if (shop) s = replaceShopLines(s, shop);
  if (transform) s = transform(s);
  if (!existsSync(`${file}.before-pay`)) copyFileSync(file, `${file}.before-pay`);
  if (crlf) s = s.replace(/\n/g, '\r\n');
  writeFileSync(file, bom + s);
  console.log(`✓ 넣었습니다: ${file} (${what})`);
  if (after) notes.push(after);
}
if (notes.length) console.log(`\n할 일: ${[...new Set(notes)].join(' / ')}`);
if (bad) { console.log('\n자리를 못 찾은 파일은 CURSOR-PROMPTS-pay.md 의 「P-수동」 프롬프트로 Cursor 에게 맡기세요.'); process.exit(2); }
