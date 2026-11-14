# Cursor 프롬프트 — 결제(코스 도전권)

**사용법**

- 아래 상자 안의 글을 **한 번에 하나씩** Cursor 채팅에 그대로 붙여 넣습니다. Agent 모드를 쓰세요.
- 한 단계가 끝나면 Cursor 가 보여 준 결과(✓/✗, 시험 통과 수)를 확인하고 다음으로 넘어갑니다.
- P-0 → P-1 → P-2 → P-3 은 꼭 하세요.
- P-4 는 서버 완주 인증을 만들었을 때, P-5 는 관리자 화면이 필요할 때 합니다. P-6 은 배포 단계입니다.

---

## P-0 · 설치

```
저장소 맨 위에 _pay_kit 폴더가 있어. 아래 순서로 실행하고 결과를 그대로 보여 줘.
1) node _pay_kit/install.mjs --dry
2) node _pay_kit/install.mjs
3) node _pay_kit/check.mjs
4) tools/i18n/build.cjs 가 있으면 node tools/i18n/build.cjs 도 실행해 줘. 추첨 설명의 영어·중국어 번역을 다시 만들기 위해서야.
규칙:
- _pay_kit/files 안의 파일 내용은 고치지 마.
- 「자리를 찾지 못해 그대로 둠」이 나오면 멈추고 어떤 파일의 어떤 단계인지 알려 줘. 그 경우엔 이 문서의 P-수동을 쓸 거야.
- 마지막에 git status 로 바뀐 파일 목록을 보여 줘. 커밋은 아직 하지 마.
```

## P-1 · 서버 검토와 가짜 결제(mock)로 로컬 시험

```
_pay_kit/SPEC-PAY.md 를 읽고 결제 서버 코드를 검토해 줘.
대상: server/src/controllers/pay.js, services/payments.js, models/PayOrder.js, models/CourseTicket.js, routes/pay.js, app.js 의 /api/pay 연결.

1) 우리 저장소의 기존 코드와 맞는지 확인해 줘.
   - middleware/auth.js 의 requireUser 가 req.user 에 User 문서를 넣는지
   - User 의 name·email·user_id·user_type 필드 이름
   - LegendCourse 의 slug
   맞지 않는 곳만 최소한으로 고쳐 줘.
2) server/.env 에 PAYMENTS_MODE=mock 을 추가해 줘. server/.env.pay.example 를 참고하고, .env 는 git 에 올리지 마.
3) 시험을 돌려 줘.
   - cd server && node --test
   - 저장소 맨 위에서 node --import ./tools/pay/test/register.mjs --test tools/pay/test/flow.test.mjs
4) 서버와 클라이언트를 띄우고 아래 순서로 확인해 줘. 확인 방법(주소, 눌러야 할 버튼)을 나에게 단계별로 알려 줘.
   - 로그인하지 않고 /pay.html?course=seoul-half → 「회원가입 후 코스에 도전할 수 있어요」
   - 로그인 후 같은 주소 → 4,000원 선택, 결제 수단 선택, 전체 동의, 결제 → 「결제가 완료됐어요」
   - /ar/course.html?id=seoul-half → 첫 보물은 열리고, 두 번째 보물도 열림
   - 다른 코스(/ar/course.html?id=seoul) → 두 번째 보물에서 「도전권이 필요해요」 창
   - 9,900원 전체 코스 패스 결제 → 모든 코스의 두 번째 보물이 열림
   - 적립금 확인: 데모 모드로 완주하면 「현장 완주 때 +500P」(지갑 0P). 휴대폰으로 현장에서 완주하면 +500P
   - 완주 보상 추첨 확인
     · 코스를 완주(데모 모드)하고 보물 상자를 열면 「이번 시즌 추첨에 응모되었어요」
     · 다른 코스를 또 완주하면 「이미 「○○」 완주로 응모되어 있어요」
     · 도전권 없는 계정으로 첫 보물을 탁본하면 「추첨에 무료 응모하기」가 보이고, 눌러서 응모됨
     · 같은 계정으로 또 응모하면 「이미 응모되어 있어요」
5) 관리자 계정으로 GET /api/draw/summary 를 호출해, 응모 수(완주·무료로 나눠서)와 상금 비용(3,846,154원)과 예산(3,850,000원)이 나오는지 보여 줘.
결제 금액(4,000/9,900)과 상품 이름은 바꾸지 마. 결제는 KG이니시스만 써(토스 코드를 다시 넣지 마). 상금 150·100·50만 원과 무료 응모 경로도 그대로 둬. 적립금 500P·교환표도 바꾸지 마. 추첨은 시즌마다 1인 1회 규칙을 바꾸지 마.
```

## P-2 · 로그인·회원가입 후 원래 화면으로 돌아오기 (?next=)

```
결제 페이지와 AR 화면은 로그인이 필요할 때 /login?next=<돌아갈 주소>, /signup?next=<돌아갈 주소> 로 보내.
React 쪽(client/src/pages/LoginPage.jsx, SignupPage.jsx, NaverCallbackPage.jsx)이 이 next 를 쓰도록 고쳐 줘.

- 안전한 주소만 허용해.
  - '/' 로 시작하고 '//' 나 '/\' 로 시작하지 않는 같은 사이트 경로만
  - 그 밖에는 지금처럼 '/' 로
- next 가 /pay.html, /ar/, /bomul.html 처럼 React 밖의 정적 파일이면 navigate 대신 window.location.assign(next) 를 써 줘.
- 회원가입이 끝난 뒤 로그인 화면으로 보낸다면 next 를 그대로 넘겨 줘.
- 네이버 로그인은 next 를 sessionStorage('bomul-next')에 잠깐 저장했다가 콜백에서 꺼내 써 줘.
- 로그인 화면 맨 위에 next 가 /pay.html 이면 「로그인하면 도전권 결제로 돌아가요」 한 줄을 보여 줘.
끝나면 시험 방법을 알려 줘.
```

## P-3 · KG이니시스 테스트 상점으로 시험 결제

```
KG이니시스 테스트 결제를 시험하자. _pay_kit/SPEC-PAY.md 1·2·3·11장을 먼저 읽어 줘.
1) server/.env 에 PAYMENTS_MODE=inicis 를 넣어 줘.
   - INICIS_ENV 는 비워 둬. 그러면 이니시스 공개 테스트 상점(INIpayTest)과 스테이징 결제창을 써.
   - 키 없이 시험할 수 있고, 돈은 나가지 않아.
   - 결제 화면 위에 「KG이니시스 테스트 결제예요」가 보이는지 확인해 줘.
2) 이니시스 결제창이 결과를 우리 서버로 form POST 해. 로컬에서 그대로 시험하는 방법을 알려 줘.
   - 경로: /api/pay/inicis/return, /api/pay/inicis/mobile-return
   - 결제창은 브라우저 안에서 열리니 localhost 도 될 거야. 안 되면 ngrok 같은 터널을 쓰는 방법도 알려 줘.
3) 우리 코드를 공식 규격과 다시 대조해 줘. 다른 점이 있으면 알려 주고, 고칠 때는 이유를 적어 줘.
   - 대상: server/src/services/inicis.js
   - 공식 규격: manual.inicis.com 의 PC 웹표준·모바일·INIAPI 취소 문서
   - 특히 확인할 것
     · PC 승인 URL 확인(idc_name ↔ authUrl)
     · 모바일 P_REQ_URL 호스트
     · INIAPI v2 hashData 의 data 직렬화
4) 결제 수단마다 PC 한 번, 휴대폰 한 번씩 시험하는 순서를 표로 만들어 줘.
   - 대상: 신용카드, 카카오페이, 네이버페이, 계좌이체, 휴대폰
   - 확인할 것
     · 성공하면 /pay.html?result=success&orderId=… → 「결제가 완료됐어요」
     · PC 결제창을 닫으면 결제 화면 그대로
     · 모바일에서 취소하면 「결제가 완료되지 않았어요」
     · DB: PayOrder.status=paid, paymentKey(TID), CourseTicket 생성
   - 카카오페이·네이버페이에서 V105 오류가 나면 「간편결제 직접호출」 설정이 없는 거야. 이 경우 payProducts.json 에서 두 줄을 빼는 방법도 알려 줘.
5) 관리자 결제 취소를 시험해 줘.
   - 이니시스 가맹점관리자에서 받은 INIAPI Key 를 INICIS_API_KEY 에 넣는 방법을 알려 줘.
   - INIAPI Key 가 없으면 「수동 처리(manual)」로 기록만 바꾸는 방법도 알려 줘.
   - 키 값은 내가 직접 넣을게. 너는 코드나 git 에 키를 쓰지 마.
```

## P-4 · 서버 완주 인증·적립금과 연결 (서버 완주 인증을 만든 뒤)

```
_pay_kit/SPEC-PAY.md 6장을 읽어 줘.
server/src/controllers/pay.js 의 hasAccess(user, courseId) 를 써서 아래 API가 도전권을 확인하게 해 줘.
- 대상: 서버 완주 인증(체크인 저장 /api/ar/checkins, 완주 /api/ar/complete), 적립금 적립·교환 API
규칙:
- 코스의 앞쪽 freeTrialStops 곳(payProducts.json)의 체크인은 도전권 없이도 허용해. 무료 체험과 맞추려는 거야.
- 그 밖의 체크인과 완주 처리는 도전권이 없으면 402 와 { code: 'NEED_TICKET' } 를 돌려줘.
- server/src/controllers/draw.js 의 enterDraw 에 있는 TODO 자리에서, 그 코스를 서버 기준으로 완주했는지 확인해 줘. 완주 전이면 409 NOT_COMPLETED.
- 적립금을 서버 지갑(ArWallet)으로 옮겨 줘. 규칙은 SPEC-PAY.md 10장 그대로야.
  · 현장 모드로 모든 보물을 탁본한 코스만, 코스마다 한 번 500P
  · 교환은 서버에서 잔액을 확인하고 차감
  · 이 기기에 남은 예전 포인트는 서버로 옮기지 마. 서버 지갑은 0P 에서 시작해.
- 결제 모드가 off 면 지금처럼 모두 허용해. hasAccess 가 알아서 처리해.
- 관리자는 항상 허용해.
- 시험(node:test)을 추가하고, AR 화면이 402 를 받으면 passGate 창을 띄우도록 연결해 줘.
```

## P-5 · 관리자 「결제 관리」 화면 (선택)

```
React 관리자 화면에 「결제 관리」 페이지를 추가해 줘.
- 경로 /admin/payments. AdminPage.jsx 의 메뉴 목록에 'AR 상품 설정' 옆으로 넣어 줘.
- GET /api/pay/orders?status=paid|failed|canceled|ready 로 목록을 보여 줘.
  - 열: 결제일, 주문번호, 회원(아이디·이름), 상품, 코스, 금액, 결제수단, 상태
  - 위쪽에 상태 필터와 합계 금액(paid 만)
- 「결제 취소」 버튼은 status=paid 에만 보여 줘.
  - 사유를 입력받고 확인 창을 띄운 뒤 POST /api/pay/orders/:orderId/cancel { reason }
  - 성공하면 목록을 새로고침해.
- 기존 관리자 페이지(ArSettingsPage.jsx 등)의 모양·토큰 처리 방식을 그대로 따라 줘.
- 환불 판단(발굴 시작 여부)은 사람이 해. 화면에는 「취소하면 이니시스에서 바로 환불되고 도전권이 사라져요」 안내만 넣어 줘.
- INIAPI 키가 없을 때(409 NO_INIAPI_KEY)는 「가맹점관리자에서 취소했어요(수동 처리)」 버튼을 보여 주고 { manual: true } 로 다시 보내 줘.
- 같은 페이지에 「완주 보상 추첨」 칸을 넣어 줘. GET /api/draw/summary 를 써.
  - 숫자 카드: 응모 수(완주 응모·무료 응모 따로), 결제 건수, 결제 매출(부가세 제외), 상금 비용(세금 포함), 예산, 매출 대비 상금 %
  - overBudget 이 true 면 빨간 경고
  - 「추첨하기」 버튼: POST /api/draw/pick 을 부르고, 확인 창에 응모 수와 「한 번만 할 수 있어요」를 보여 줘.
    · 마감 전이면 버튼을 끄고 마감일을 보여 줘. 시험할 때만 force 로 누를 수 있게 「마감 전 시험 추첨」 체크를 따로 둬.
  - 추첨 뒤에는 당첨자 표: 등수, 회원, 응모 코스, 응모 경로(완주·무료)
```

## P-6 · 배포

```
결제 기능을 배포하자. 아래를 순서대로 안내하고, 내가 할 일과 네가 할 일을 나눠 줘.
1) git diff 를 검토하고 커밋해 줘. 메시지: "결제: 코스 도전권(4,000/9,900원) · KG이니시스 · 추첨 1인 1회·무료 응모 · 상금 150/100/50만 · 적립금 500P"
   - _pay_kit 폴더와 *.before-pay 백업 파일은 커밋하지 마. .gitignore 에 *.before-pay 를 추가해 줘.
2) Heroku 환경변수
   - 처음에는 PAYMENTS_MODE=off 로 배포해서 사이트가 그대로인지 확인
   - 계약 전 배포 서버 시험: PAYMENTS_MODE=inicis, ALLOW_TEST_PAY=1
     · 테스트 상점이라 돈이 나가지 않으니, 시험이 끝나면 꼭 다시 off 로
   - 계약 뒤: PAYMENTS_MODE=inicis, INICIS_ENV=prod, INICIS_MID, INICIS_SIGNKEY, INICIS_API_KEY, INICIS_CLIENT_IP
     · ALLOW_TEST_PAY 는 지워
   - Heroku 는 서버 IP 가 바뀔 수 있어. INIAPI 에 등록할 고정 IP(애드온)가 필요한지도 알려 줘.
   - 명령어를 알려 주되, 키 값은 내가 직접 넣을게.
3) 배포 뒤 점검
   - https://bomul-demo-vercel.vercel.app/api/pay/config 에서 mode·test 확인, 서명키가 없는지 확인
   - /pay.html?course=seoul-half 열기
   - PC·휴대폰에서 결제 1건씩 → 관리자 결제 관리에서 취소 1건
   - Vercel 의 /api 연결로 이니시스 form POST 가 Heroku 까지 오는지 확인
4) 실제 결제(INICIS_ENV=prod)로 바꾸기 전에 확인할 것을 체크리스트로 만들어 줘.
   - KG이니시스 계약, 결제수단별 사용 설정, 간편결제 직접호출, INIAPI 서버 IP 등록
   - 약관·환불 규정 법률 검토, refund.html 시행일과 묶음 환불 상한
   - 사업자 정보 표시
```

---

## P-수동 · 설치 스크립트가 자리를 찾지 못했을 때

```
node tools/pay/patch.mjs 가 아래 파일에서 자리를 찾지 못했어: <여기에 메시지 붙여 넣기>
tools/pay/patch.mjs 의 APP / COURSE / BOMUL 배열을 읽고, 각 항목의 「찾을 글」에 해당하는 자리를 우리 파일에서 찾아 같은 뜻으로 직접 넣어 줘.
- ar/course.html: tools/pay/snippets/course-pass.js 를 openStop 함수 바로 앞에 넣어.
  - openStop 안의 #goAR 클릭 처리를 「PASS.loading 이면 기다림 → needsPass(i) 이면 passGate(i) → 아니면 openAR(i)」로 바꿔.
  - 템플릿의 #goAR 버튼 위에 <p class="geo-status" id="passNote" hidden></p> 를 넣어.
- bomul.html: 코스 상세의 「AR 탁본 시작하기」 버튼 옆에 ${payCta(c)} 를 넣고, arUrl 함수 아래에 payCta·fillPayCtas·config 불러오기 코드를 넣어.
- app.js: payRouter import, app.use('/api/pay', payRouter), 오류 응답에 code.
끝나면 node _pay_kit/check.mjs 를 돌려 줘.
```

## T · 문제 해결

| 증상 | 확인할 것 |
|---|---|
| pay.html 위에 「미리보기 화면이에요」 | `/api/pay/config` 에 닿지 않음. 로컬이면 서버(4000번)가 켜져 있는지, 배포면 Vercel `/api` 연결과 Heroku 상태 |
| 「지금은 결제 없이 도전할 수 있어요」 | 원인 중 하나: `PAYMENTS_MODE` 가 off / `INICIS_ENV=prod` 인데 MID·SIGNKEY 가 빠짐 / 운영 서버에서 테스트 결제인데 `ALLOW_TEST_PAY=1` 이 없음 |
| 결제 버튼이 눌리지 않음 | 버튼 아래 빨간 안내 확인(코스 선택, 필수 약관) |
| 결제 후 「결제 금액이 주문과 다릅니다」 | 화면에서 금액을 바꿔 보낸 경우. 정상이면 생기지 않음. PayOrder 의 amount 확인 |
| 결제창이 안 뜸(PC) | 브라우저 콘솔에서 INIStdPay.js 를 불러왔는지 확인. 광고 차단 확장을 끄고 다시 해 보기 |
| 「결제 응답을 확인하지 못했어요」 (BAD_RETURN) | MID 가 서버 설정과 다르거나, 운영(prod)인데 스테이징(stg) 결과가 옴. `INICIS_ENV`·`INICIS_MID` 확인 |
| 결제 버튼을 누르면 휴대폰 번호 칸이 나옴 | 회원 정보에 휴대폰 번호가 없어서예요. 정상입니다(PC 결제창 필수값) |
| V105 오류 | 카카오페이·네이버페이 「간편결제 직접호출」 설정이 없음. 이니시스에 신청하거나 두 수단을 빼세요 |
| 관리자 취소 실패 `NO_INIAPI_KEY` | `INICIS_API_KEY` 를 넣거나, 가맹점관리자에서 취소한 뒤 「수동 처리」 |
| 관리자 취소 실패 `INICIS_…` | INIAPI 요청 IP 미등록, 휴대폰 결제의 달 넘김 등. resultMsg 확인 |
| 로그인 뒤 홈으로만 감 | P-2 를 하지 않음 |
| AR 두 번째 보물이 결제했는데도 막힘 | 다른 계정으로 로그인했는지, 도전권 기간(30일)과 범위(1코스면 그 코스만) 확인. `/api/pay/tickets` |
| 디자인 키트 적용 뒤 구매 버튼·1인 1회 안내가 사라짐 | `node tools/pay/patch.mjs` 다시 실행 |
| 보물 상자에 응모 문구가 안 나옴 | 서버에 `/api/draw` 가 있는지, 로그인했는지. 미리보기·정적 실행에서는 설명만 보입니다 |
| 추첨 설명이 아직 「자동으로 응모되었어요」, 적립금이 아직 100,000P | 관리자 「AR 상품 설정」에 예전 값이 저장돼 있으면 그 값이 우선입니다. 거기서 적립금 500P, 교환표(SPEC-PAY.md 10장)로 고치세요 |
