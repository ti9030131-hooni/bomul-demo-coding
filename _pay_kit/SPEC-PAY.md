# 결제(코스 도전권) 설계

## 1. 흐름

```
회원가입·로그인 ─▶ 코스 상세 「도전권 구매 · 4,000원부터」 또는 AR 화면 두 번째 보물에서 「도전권 구매하기」
                    │
                    ▼
            /pay.html?course=<코스아이디>
   1 상품 정보 · 2 결제 금액(4,000 / 9,900) · 3 결제 수단 · 4 약관 동의 및 결제 진행
                    │  POST /api/pay/orders  (서버가 금액을 정하고, 서명값을 넣은 이니시스 결제창 값을 돌려줌)
                    ▼
     KG이니시스 결제창 — PC: 웹표준(INIStdPay.pay) 레이어 / 모바일: mobile.inicis.com 으로 이동
                    │ 인증 결과를 브라우저가 서버로 form POST
                    │   PC   → /api/pay/inicis/return        (resultCode, authToken, authUrl, idc_name …)
                    │   모바일 → /api/pay/inicis/mobile-return (P_STATUS, P_TID, P_REQ_URL, P_NOTI …)
                    ▼
   서버: 이니시스 주소인지 확인 → 승인 요청 → 금액·주문번호 확인 → CourseTicket 발급
        (금액이 다르면 PC 는 망취소, 모바일은 INIAPI 취소)
                    ▼
   /pay.html?result=success&orderId=… ─▶ 「결제가 완료됐어요」 ─▶ AR 탁본 시작하기
```

## 2. 상품 (`server/src/data/payProducts.json`)

| id | 이름 | 가격 | 범위 | 기간 |
|---|---|---|---|---|
| `single` | 1코스 도전권 | 4,000원 | 고른 코스 1곳 | 30일 |
| `all` | 전체 코스 패스 (추천) | 9,900원 | 모든 코스 | 30일 |

- 결제 수단 (KG이니시스, 토스페이 없음)

| id | 화면 | PC `gopaymethod` / `acceptmethod` | 모바일 `P_INI_PAYMENT` / `P_RESERVED` |
|---|---|---|---|
| card | 신용·체크카드 | `Card` | `CARD` |
| kakaopay | 카카오페이 | `onlykakaopay` / `cardonly` | `CARD` / `d_kakaopay=Y` |
| naverpay | 네이버페이 | `onlynaverpay` / `cardonly` | `CARD` / `d_npay=Y` |
| transfer | 계좌이체 | `DirectBank` | `BANK` |
| phone | 휴대폰 | `HPP` (+ `HPP(1)` 컨텐츠) | `MOBILE` (+ `P_HPP_METHOD=1`) |

  - 공통 `acceptmethod`: `HPP(1):centerCd(Y)`, 공통 `P_RESERVED`: `centerCd=Y&apprun_check=Y`.
  - 카카오페이·네이버페이 바로 열기는 이니시스에 「간편결제 직접호출」 설정을 받아야 합니다. 없으면 V105 오류가 납니다. 설정 전이면 두 줄을 지우세요(일반 카드 결제창 안에서 간편결제를 고를 수 있음).
  - 계약에 없는 수단은 `methods` 에서 지우면 화면에서도 사라집니다.
- 필수 약관 4개: 주문 확인, 전자금융거래, 개인정보 수집·이용, 제3자 제공.
  - 동의한 항목과 `termsVersion` 을 주문에 저장합니다.
- `freeTrialStops: 1`: 결제 전에 앞에서부터 몇 곳을 무료로 탁본할 수 있는지 정합니다.

## 3. 동작 모드 (`PAYMENTS_MODE`)

| 값 | 동작 |
|---|---|
| `off` (기본) | 결제 없이 모두 무료. 구매 버튼은 숨기고, AR 화면도 막지 않습니다. pay.html 은 「지금은 결제 없이 도전할 수 있어요」를 보여 줍니다. |
| `mock` | 개발용입니다. 결제창 없이 서버가 바로 도전권을 발급합니다. 운영(`NODE_ENV=production`)에서는 `ALLOW_MOCK_PAY=1` 이 없으면 `off` 로 바뀝니다. |
| `inicis` | KG이니시스 결제창을 씁니다. |

`inicis` 세부 규칙
- `INICIS_ENV=prod`: `INICIS_MID`, `INICIS_SIGNKEY` 가 둘 다 있어야 켜지고, 없으면 `off` 입니다.
- `INICIS_ENV` 가 없거나 `test`: 이니시스 공개 테스트 상점(`INIpayTest`)과 스테이징 결제창을 씁니다. 돈이 나가지 않으며, 결제 화면에 「테스트 결제예요」가 뜹니다.
- 운영 서버(`NODE_ENV=production`)에서 테스트 결제는 `ALLOW_TEST_PAY=1` 이 있을 때만 켜집니다. 돈이 안 나가는데 도전권이 생기기 때문입니다.
- 취소(환불) 자동화에는 `INICIS_API_KEY`(INIAPI Key)와 `INICIS_CLIENT_IP`(이니시스에 등록한 서버 IP)가 필요합니다.

서버에 닿지 않으면 pay.html 은 「미리보기」로 화면만 보여 주고, 실제 결제는 하지 않습니다.

## 4. API

| 메서드 · 경로 | 권한 | 하는 일 |
|---|---|---|
| `GET /api/pay/config` | 공개 | 모드, PG 이름, 테스트 여부, PC 결제창 JS 주소, 상품, 결제 수단, 약관, 무료 체험 수. 서명키(signKey)·INIAPI 키는 절대 내보내지 않습니다. |
| `GET /api/pay/access/:courseId` | 회원 | `{ allowed, reason: free/admin/ticket/need_ticket, expiresAt }`. 관리자는 항상 허용합니다. |
| `GET /api/pay/tickets` | 회원 | 내 도전권과 결제 내역 |
| `POST /api/pay/orders` | 회원 | 주문을 만들고 이니시스 결제창 값을 돌려줍니다. 아래 참고. |
| `POST /api/pay/mock-confirm` | 회원 | `mock` 모드에서만 씁니다. |
| `POST /api/pay/inicis/return` | 이니시스(form) | PC 인증 결과 → 승인 → 결과 화면으로 이동하는 HTML |
| `GET /api/pay/inicis/close` | 공개 | PC 결제창 닫기(INIStdPay_close.js) |
| `POST /api/pay/inicis/mobile-return` | 이니시스(form) | 모바일 인증 결과 → 승인 → 결과 화면으로 이동하는 HTML |
| `GET /api/pay/my-orders/:orderId` | 회원 | 결제 결과 화면용 내 주문과 도전권 |
| `GET /api/pay/orders?status=` | 관리자 | 결제 목록(최근 200건) |
| `POST /api/pay/orders/:orderId/cancel` | 관리자 | `{ reason, manual }` 를 받습니다. INIAPI v2 취소(`https://iniapi.inicis.com/v2/pg/refund`)를 부르고, 도전권은 `refunded` 로 바꿉니다. `manual: true` 는 가맹점관리자에서 이미 취소했을 때 기록만 바꿉니다. |

`POST /api/pay/orders` 요청값
- `{ productId, courseId, methodId, agreed[], device: pc|mobile, phone?, apiBase, clientBase }`
- 금액은 서버가 정하고, 화면이 보낸 금액은 무시합니다.
- `apiBase`(결제창이 돌아올 서버)와 `clientBase`(결과 화면)는 허락한 주소만 받습니다: localhost, `*.vercel.app`, `CLIENT_ORIGIN`·`PUBLIC_API_BASE`.
- 회원 정보에 휴대폰 번호가 없으면 400 `PHONE_REQUIRED` 를 돌려주고, 화면이 번호 칸을 보여 줍니다. PC 결제창은 `buyertel` 이 필수입니다.
- 이미 그 코스를 할 수 있는 도전권이 있으면 409 `ALREADY_COVERED` 입니다.

오류 응답은 `{ message, code }` 입니다. 예: `TERMS_REQUIRED`, `PHONE_REQUIRED`, `ALREADY_COVERED`, `NO_INIAPI_KEY`, `INICIS_<코드>`. 결제창 실패는 `/pay.html?result=fail&code=…&message=…` 로 보여 줍니다.

## 5. 데이터

- **PayOrder:** orderId(`BM-YYYYMMDD-무작위`, 24자 · 이니시스 oid 40byte 이하), user, productId·name, scope, courseId·title, amount, days, methodId, status(`ready`·`paid`·`failed`·`canceled`), mode(`inicis`·`mock`), device(`pc`·`mobile`), returnTo, agreed, termsVersion, paymentKey(이니시스 TID), method, approvedAt, receiptUrl, 실패·취소 정보.
- **CourseTicket:** user, orderId(고유값), scope(`course`·`all`), courseId, startsAt, expiresAt, status(`active`·`refunded`).

## 6. 화면이 막는 곳과 서버가 막아야 할 곳

- **AR 화면:** `freeTrialStops` 곳 뒤의 보물을 열 때 `/api/pay/access` 를 확인합니다.
  - 로그인하지 않았으면 로그인·회원가입 창을 띄웁니다.
  - 도전권이 없으면 구매 창을 띄웁니다.
  - 확인할 수 없으면 「다시 시도」 창을 띄웁니다.
  - 이미 탁본한 보물은 언제든 다시 볼 수 있습니다.
- 화면에서 막는 것만으로는 우회할 수 있습니다. 완주 인증·적립금처럼 **돈이 되는 처리**는 서버에서 확인해야 합니다. 서버 완주 인증(SPEC-COMPLETION)을 만들 때 아래처럼 넣으세요(P-4).
  ```js
  import { hasAccess } from './pay.js';
  const a = await hasAccess(req.user, courseId);
  if (!a.allowed) throw httpError(402, '도전권이 필요해요.');
  ```

## 7. 보안 점검표

- 서명키(`INICIS_SIGNKEY`)와 INIAPI 키는 서버 환경변수에만 둡니다. pay.html·config 응답·git 어디에도 넣지 않습니다. 결제창에는 해시값(signature·verification·mKey)만 보냅니다.
- 결제창 결과는 로그인 토큰 없이 들어오므로, 주문번호로 주문을 찾고 이니시스 승인 결과로만 결제를 확정합니다.
- 승인 요청은 이니시스 주소로만 보냅니다(PC: `https://{fc|ks|stg}stdpay.inicis.com/api/payAuth` 와 `idc_name` 일치, 모바일: `fcmobile`·`ksmobile`·`stgmobile.inicis.com`). 운영에서는 `stg` 결과를 받지 않습니다.
- 금액은 서버가 정하고, 승인할 때 주문 금액과 다시 비교합니다.
- 주문은 만든 회원만 승인하거나 실패 처리할 수 있습니다. 남의 주문이면 404 입니다.
- 승인은 여러 번 와도 한 번만 처리합니다. 이미 `paid` 이면 승인 요청 없이 결과 화면으로 보냅니다.
- 승인 금액·주문번호가 다르면 PC 는 망취소(10분 안), 모바일은 INIAPI 취소 후 주문을 `failed` 로 둡니다.
- 운영에서 `mock` 은 자동으로 꺼집니다.
- 코스 아이디는 `^[a-z0-9-]{1,60}$` 만 받습니다.

## 8. 시험

- `cd server && node --test test/payments.test.mjs test/inicis.test.mjs test/draw.test.mjs`
  - 결제 규칙: 가격, 모드(테스트·운영), 결제수단, 주문번호, 약관, 도전권 기간·범위
  - 이니시스 규칙(`test/inicis.test.mjs`): 공식 샘플과 같은 해시, PC·모바일 결제창 값, 승인 주소 검증, 응답 읽기, 승인 시각, INIAPI 취소 해시, 돌아갈 주소
  - 추첨 규칙: 상금 비용(세금 포함), 예산, 마감, 공정 추첨
- `node --import ./tools/pay/test/register.mjs --test tools/pay/test/flow.test.mjs`: DB 없이 전체 흐름을 시험합니다.
  - 결제 전 차단 → 4,000원 결제 → 그 코스만 허용 → 중복 구매 막기
  - 9,900원 패스 → 전부 허용 → 관리자 취소 → 다시 차단
  - 이니시스 PC: 승인 → 도전권, 중복 결과 1번만 승인, 금액 불일치 망취소, 가짜 승인 주소 거부, 사용자 취소
  - 이니시스 모바일: 승인 → 도전권, 취소, 휴대폰 번호 요청, 허락하지 않은 주소 거절
  - 관리자 취소: INIAPI 키 없으면 수동 처리, 있으면 v2 취소 호출 · 서명키 미노출
  - 추첨 1인 1회, 완주 응모는 도전권 필요·무료 응모는 누구나, 추첨은 한 번만, 응모 경로별 집계

## 9. 완주 보상 추첨 (시즌마다 1인 1회 · 무료 응모 가능)

**원칙**
- 도전권 가격은 콘텐츠(AR 코스) 값으로 정하고, 상금과 연결하지 않습니다.
- 추첨은 시즌마다 한 사람당 1회입니다. 돈을 더 내거나 코스를 더 돌아도 당첨 확률은 늘지 않습니다.
- 상금은 마케팅 예산(`draw.json` 의 `budget`)으로 따로 관리합니다. 시즌 1은 1·2·3등 150·100·50만 원(합계 300만 원, 세금 포함 3,846,154원, 예산 385만 원)입니다.
- **무료 응모 경로(구매 없이 응모):** 회원이면 결제하지 않아도 첫 보물 무료 체험 뒤 AR 화면에서 무료로 응모할 수 있습니다. 결제한 사람과 똑같이 1인 1회입니다. 추첨을 결제와 떼어 놓아 「돈을 모아 우연으로 득실을 정하는」 구조에서 멀어지게 하려는 장치입니다.
- 유료 참가와 우연한 추첨이 연결되는 구조는 「사행행위 등 규제 및 처벌 특례법」과 관련이 있을 수 있습니다. 운영 전에 법률 검토를 받으세요.

**설정** `server/src/data/draw.json`
- season, title, entryRule, freeEntry(무료 응모 허용, 기본 true)
- prizes: rank · label · amount · winners
- taxPaidByCompany, taxRate(0.22), budget
- entryClosesAt, drawAt

**API**

| 메서드 · 경로 | 권한 | 하는 일 |
|---|---|---|
| `GET /api/draw` | 공개 | 시즌, 상금, 응모 규칙, 마감, 진행 중 여부 |
| `GET /api/draw/me` | 회원 | 내 응모(처음 응모한 코스, 당첨 등수) |
| `POST /api/draw/entries` | 회원 | `{ courseId, source }` 로 응모합니다. `source` 는 `completion`(완주 응모, 도전권 필요) 또는 `free`(무료 응모, 회원이면 누구나). 아래 표 참고. |
| `GET /api/draw/summary` | 관리자 | 응모 수(`bySource`: 완주·무료), 결제 건수·매출(부가세 제외), 상금 비용(세금 포함), 예산 초과 여부, 매출 대비 상금 %, 당첨자 |
| `POST /api/draw/pick` | 관리자 | 아래 「추첨 방식」 참고 |

`POST /api/draw/entries` 의 응답

| 상황 | 응답 |
|---|---|
| 처음 응모 | 201 |
| 이미 응모함 | 200 `already: true` + 처음 응모한 코스 |
| 완주 응모인데 그 코스의 도전권이 없음 | 402 `NEED_TICKET` (결제 off 면 허용) |
| 무료 응모인데 `freeEntry: false` | 403 `FREE_ENTRY_OFF` |
| 마감 뒤 | 409 `DRAW_CLOSED` |

**추첨 방식** (`POST /api/draw/pick`)
- 응모 목록을 `crypto.randomInt` 로 섞은 뒤(Fisher–Yates) 1등부터 뽑습니다.
- 한 사람은 한 번만 당첨되고, 추첨은 한 번만 할 수 있습니다.
- 마감 전에는 `{ force: true }` 가 있어야 합니다.

**데이터:** DrawEntry { season, user, courseId, courseTitle, source(completion·free), prizeRank, drawnAt }. `(season, user)` 조합이 고유합니다.

**AR 화면**
- 보물 상자 화면을 열면 `syncDraw()` 가 응모하고, 결과를 추첨 상품 아래에 금색 글씨로 보여 줍니다.
- 무료 응모 버튼은 결제가 켜져 있고 도전권이 없을 때 두 곳에 나옵니다.
  - 첫 보물(무료 체험)을 탁본한 직후의 결과 창: 「추첨에 무료 응모하기」
  - 두 번째 보물에서 뜨는 「도전권이 필요해요」 창: 「추첨에만 무료 응모하기」
- 로그인하지 않았으면 「로그인하고 무료 응모하기」로 바뀝니다.
- 무료 응모 경로는 결제 페이지, 메인 유의사항, 도전권·로그인 안내 창에도 같은 문장으로 알립니다.
- 로그인하지 않았으면 「로그인하면 추첨에 응모돼요」와 로그인 버튼을 보여 줍니다.
- 서버에 추첨 기능이 없으면 설명만 보여 줍니다.

**지금의 한계**
- 서버는 아직 「완주했는지」를 모릅니다. 지금은 도전권이 있는지만 확인합니다.
- 서버 완주 인증을 만들면 `enterDraw` 의 TODO 자리에서 완주 여부를 확인하세요(P-4).

## 10. 적립금·교환표

**기준:** 1P ≈ 1원. 완주 적립은 도전권 가격의 10~15% 수준으로 맞췄습니다.

**적립**
- 현장 모드로 모든 보물을 탁본해 완주한 코스마다 한 번 500P 입니다.
- 데모 모드 완주는 0P 이고, 「현장 완주 때 +500P」로 안내합니다.
- 한 사람 최대 18,500P (37코스) 입니다.

**교환표**

| 등수 | 상품 | 포인트 | 현장 완주 코스 수 |
|---|---|---|---|
| 1 | 외식 모바일 상품권 1만 5천 원 | 15,000P | 30 |
| 2 | 문화상품권 1만 원 | 10,000P | 20 |
| 3 | 스타벅스 아메리카노 Tall | 5,000P | 10 |
| 4 | 편의점 모바일 상품권 3천 원 | 3,000P | 6 |
| 5 | 편의점 모바일 상품권 1천 원 | 1,000P | 2 |

**예전 포인트 옮기기:** 지갑에 `pv`(포인트 규칙 버전)가 없으면 잔액과 내역을 1/200 로 바꿉니다(100,000P → 500P). 열어 둔 보물 상자의 `earned` 도 같은 비율로 바꿉니다.

**설정 위치**
- `client/public/ar/data/common.js`, `server/src/data/arDefaults.json` (관리자 「AR 상품 설정」에 저장한 값이 우선)
- 현장 완주만 적립할지는 `ar/course.html` 의 `POINTS_ONSITE_ONLY` 로 정합니다.

**남은 위험:** 포인트가 브라우저에만 저장됩니다. 실제 교환 전에 서버 지갑과 서버 완주 인증(현장 여부 포함)이 필요합니다(P-4).

## 11. KG이니시스 확인할 것 (계약·연동 전)

- 가맹점관리자 ▶ 상점정보 ▶ 계약정보 ▶ KEY 정보 에서 **웹결제 Sign Key**, **INIAPI Key** 를 받습니다.
- INIAPI 를 부르는 서버 IP 를 이니시스에 등록하고 `INICIS_CLIENT_IP` 에 넣습니다. Heroku 는 IP 가 바뀔 수 있어, 고정 IP 애드온이 필요할 수 있습니다. 어렵다면 취소는 가맹점관리자에서 하고 「수동 처리」로 기록합니다.
- INIAPI v2 `hashData` 의 `data` 직렬화(`JSON.stringify({ tid, msg })`)는 매뉴얼에 예시가 없어, 테스트 상점에서 취소 1건으로 꼭 확인하세요.
- 휴대폰 결제 취소는 결제한 달 안에만 됩니다(통신사 정책). 넘기면 가맹점관리자에서 처리합니다.
- 카카오페이·네이버페이 바로 열기는 「간편결제 직접호출」 설정이 필요합니다.
- 모바일 결제창은 `accept-charset="EUC-KR"` 로 보내고, 결과는 `P_CHARSET=utf8` 로 받습니다.
- 참고: 공식 매뉴얼 https://manual.inicis.com/pay/stdpay_pc.html · https://manual.inicis.com/pay/stdpay_m.html · https://manual.inicis.com/pay/cancel.html
