# Cursor 프롬프트 — 다국어(English · 中文) + 서버 완주 인증

**순서:** 0 → I-1 … I-6 (다국어) → C-1 … C-6 (서버 완주 인증) → Z (확인·배포)
각 블록을 Cursor 채팅(**Agent 모드**)에 그대로 붙여 넣고, Cursor가 끝났다고 보고하면 다음으로 넘어가세요.
먼저 AR 키트(`_ar_kit`) 적용이 끝나 있어야 합니다. 새 브랜치에서 하세요: `git checkout -b feat/i18n-complete`

> 번역문(코스 37개·이야기 159개·상세 35개·맛집, 약 4.9만 자 분량)은 **이미 만들어져 키트에 들어 있습니다.**
> Cursor에게 코스 내용을 다시 번역시키지 마세요. Cursor는 "연결"과 "화면 문구(UI)"만 합니다.

---

## 0. 파일 넣기

```
저장소 맨 위에 _i18n_kit 폴더가 있어. 아래를 순서대로 해 줘. 파일 내용은 고치지 마.
1) _i18n_kit/START-HERE.md, _i18n_kit/SPEC-I18N.md, _i18n_kit/SPEC-COMPLETION.md 를 끝까지 읽어.
2) 터미널에서 node _i18n_kit/install.mjs 실행 결과를 보여 주고, 문제가 없으면 node _i18n_kit/install.mjs --apply
3) node tools/i18n/build.cjs 를 실행해서 마지막 줄들을 그대로 보여 줘. "정적 AR 2800/2800 · 서버 AR 2795/2795"처럼 앞뒤 숫자가 같아야 정상이야.
   숫자가 다르면 "확인할 것" 목록을 보여 주고 멈춰.
4) 아직 다른 파일은 바꾸지 마. 끝나면 git status 를 보여 줘.
```

---

## I-1. bomul.html — i18n.js 연결과 네비바 언어 탭

```
_i18n_kit/SPEC-I18N.md 6절 'bomul.html' 1·2·7·9번을 해 줘.
- client/public/bomul.html <head> 에 <script src="/i18n/i18n.js"></script> 를 메인 <script> 보다 앞에 넣어.
- 네비바 .nav-bar 안에서 브랜드(.brand)와 ☰ 버튼(.nav-toggle) 사이에 <div class="lang-tabs" role="group" aria-label="언어 선택"></div> 를 두고,
  스크립트에서 BomulI18n.tabsHtml() 로 KO / EN / 中文 버튼을 채워. 모바일(768px 이하)에서도 접히는 메뉴 밖에 항상 보여야 해.
  스타일: 작은 알약 모양 버튼 3개, 높이 28px, 글자 .78rem, 선택된 것(aria-pressed="true")은 금색 배경. 모바일에서 브랜드 글자가 줄어들어도 탭은 한 줄.
- 탭 클릭 → BomulI18n.setLang(code, { packs: ['content'] }) → document 의 'bomul:lang' 이벤트에서 탭 aria-pressed 갱신 + refreshCourseViews() + BomulI18n.apply().
- 맨 아래 초기 렌더를 BomulI18n.ready(['content']).then(() => { BomulI18n.apply(); refreshCourseViews(); }) 가 한 번 더 돌게 해 줘(기존 renderHome/route 호출은 그대로 둠).
- 중국어 글꼴: html[data-lang="zh"] 에서 기존 글꼴 CSS 변수(--display, --body 등 :root 에 있는 것)를 "Noto Serif SC"/"Noto Sans SC" 를 앞에 둔 목록으로 덮어써. 한국어 글꼴은 뒤에 남겨.
- 아직 문구 번역은 하지 마. 브라우저에서 /bomul.html?lang=en 을 열면 탭이 EN 으로 눌려 있는지만 확인해.
```

## I-2. bomul.html — 화면 문구 사전(ko·en·zh)과 data-i18n

```
_i18n_kit/SPEC-I18N.md 5절 용어집과 6절 3·4번을 따라 bomul.html 의 화면 문구를 사전으로 옮겨 줘.
1) client/public/i18n/ui-site.js 를 새로 만들어 BomulI18n.addUI('ko', {...}); addUI('en', {...}); addUI('zh', {...}) 로 키를 등록해.
   키 이름: nav.*, home.*, ar.*, featured.*, expand.*, reward.*, courses.*, detail.*, apply.*, coming.*, footer.*, region.<한국어 지역명>, info.거리 등.
   ko 값은 지금 화면의 한국어를 글자 하나 바꾸지 말고 그대로 옮겨. en/zh 는 용어집으로 번역(zh 는 간체). <br>·<span class="hl"> 이 있는 문구는 HTML 값으로.
   {name} 같은 자리표시를 쓰고, 한국어 조사가 바뀌는 문구는 ko 값을 함수로 (BomulI18n.jo 사용).
   이 파일을 i18n.js 바로 다음에 불러와.
2) 정적 마크업: 문구가 있는 요소에 data-i18n / data-i18n-html / data-i18n-attr("alt:키;placeholder:키;aria-label:키") 를 달아. 대상:
   네비 링크 전부(장바구니는 글자만 <span data-i18n> 으로 감싸고 #cartCount 는 그대로), 브랜드 글자, 히어로, '무엇을 하나요' 구역, 미리보기 6개 카드(h4·p·img alt·재생 버튼 aria-label),
   AR 탁본 구역, 추천 코스 구역, 확장 계획, 완주 보상 상품 내역, 전체 코스 머리말, '← 코스 목록으로', 신청·문의 화면(라벨·placeholder·버튼·복사), COMING SOON 구역, 푸터와 하단 링크, <title>, meta description(스크립트로 갱신).
3) JS 가 만드는 문구를 모두 BomulI18n.t('키', 값) 로 바꿔: thumbMarkup, loginRequiredHtml(호출하는 곳의 안내문 포함), courseCard '코스 보기 · AR 체험 →',
   renderCourses(지역 칩 글자는 t('region.'+r), data-region 은 한국어 그대로, '코스를 확인하고 있습니다.', '{region} 코스는 준비 중입니다.'),
   infoCell 라벨(거리/소요시간/난이도/집결지)과 '입력 예정', addrLink '네이버 지도 ↗', renderDetail 안의 모든 문구, 신청 폼 토스트 5개, 복사 버튼 '복사/복사됨/선택됨',
   ☰ aria-label '메뉴 열기/닫기', loadAccount 의 '관리자'·'내 정보'.
4) 바뀐 줄 말고는 손대지 마. 끝나면 grep 으로 bomul.html <script> 안에 남은 한국어 문자열(주석·COURSES 등 데이터 객체 제외)을 보여 줘.
```

## I-3. bomul.html — 코스 데이터 번역 적용

```
_i18n_kit/SPEC-I18N.md 6절 5번을 해 줘. 데이터 객체(COURSES/STORIES/DETAILS/EATS/TIMELINES)는 절대 고치지 마.
- courseCard(c) 첫 줄에 const L = BomulI18n.course(c); 를 두고 region/theme/title/summary 를 L 에서 읽어. (data-course 는 c.id 그대로)
- renderDetail(id): c 를 찾은 뒤 const L = BomulI18n.course(c); 로 화면에 쓰는 region/theme/title/summary/info/stops 를 L 에서 읽어.
  info 는 Object.assign({}, c.info, INFOX[c.id]||{}) 를 만든 다음 BomulI18n.course({...c, info}) 로 번역되게 해.
  stops 의 addr 은 한국어 그대로(지도 검색용).
- 이야기: const S = BomulI18n.story(t, STORIES[t]); summary 에 S.title, 본문에 S.text.
- 상세 자료: const dd = BomulI18n.details(c.id, DETAILS[c.id]);
- 맛집: const eats = BomulI18n.eats(c.id, EATS[c.id]); (가게 이름 e.name 과 EAT_PID 연결은 그대로)
- 타임라인: seg.stay / seg.move 는 BomulI18n.duration(...) 으로, 장소 이름은 번역된 where 에서 /^(보물|Treasure|宝物)\s*\d+\s*·\s*/ 를 떼서.
- '총 소요시간 · ' 뒤 값도 번역된 info 의 소요시간.
- AR 링크 arUrl(c) 는 그대로.
확인: 브라우저로 /bomul.html?lang=en#courses 와 #course-seoul, ?lang=zh#course-gyeongju 를 열어 한국어가 남은 곳(주소 제외)을 목록으로 보고해.
```

## I-4. ar/course.html — 연결과 데이터 번역

```
_i18n_kit/SPEC-I18N.md 6절 'ar/course.html' 1·2·3·7·8번을 해 줘.
- <script src="../i18n/i18n.js"></script> 와 화면 문구 파일 <script src="../i18n/ui-ar.js"></script>(다음 단계에서 채움, 지금은 빈 addUI 3개) 를 data/common.js 보다 앞에.
- (async () => { 바로 다음 줄에 await BomulI18n.ready(['ar']);
- const C = ... 가 정해지고 C.pointShop / C.final.prizes 기본값을 넣은 바로 다음 줄에 BomulI18n.localizeAr(C);
  (STOPS, T 는 C 에서 다시 읽히므로 localizeAr 가 그보다 앞서야 해. 필요하면 const STOPS... 줄을 localizeAr 아래로 옮겨)
- fillIntro() 의 코스 고르기 목록: 제목·지역을 BomulI18n.arText() 로.
- 표지 상단 .top-link 에 <span class="lang-tabs"></span> + BomulI18n.tabsHtml(). 클릭하면 BomulI18n.setLang(code, { reload: true }).
- 확인: /ar/course.html?id=seoul&lang=en, ?id=seoul-gyeongbok-ar&lang=zh 표지·지도·장소 화면의 코스 내용(이야기·보물 이름·미션)이 번역됐는지. 화면 고정 문구는 다음 단계라 한국어여도 됨.
```

## I-5. ar/course.html — 화면 문구 사전과 언어별 표기

```
_i18n_kit/SPEC-I18N.md 6절 'ar/course.html' 4·5·6번을 해 줘.
1) client/public/i18n/ui-ar.js 에 addUI('ko'|'en'|'zh', {...}) 로 course.html 의 모든 화면 문구를 키로 등록(ko 는 지금 문구 그대로, 조사가 바뀌는 문구는 함수 값).
   대상: 정적 마크업(표지 안내·단계 3개·버튼, 지도/탁본첩/AR/보물 상자/포인트 상품/증명서 화면의 막대 제목·버튼·aria-label·placeholder, 탭, 라이트박스),
   geoText() 4가지, renderMap 목록 부제, openStop 전부, renderStopGeo 3가지·버튼 3가지, renderAlbum 전부(confirm 포함), sealSVG aria-label,
   renderIntro 버튼 3가지, fillIntro 안내문·'← 코스 소개로', 카메라·센서 토스트 3개, setState 힌트 5개·'한지 붙이기', offHint 4방향(보물/비석), measure '탁본 {n}%',
   openQuiz·오답 안내, showResult 전부, openReward/renderPrizes/openChestFx 안내, renderShop 전부·교환 모달 2개, renderCert 전부(증서 문장·'탐험 기록'·통계 4칸·발급·하단 문구), 인쇄 alert, document.title.
2) 숫자·순서 말: ko 는 기존 NUMW/ORD 그대로, en 은 숫자와 서수(1st, 2nd…), zh 는 숫자(第1). 사전 함수로 처리해.
3) 날짜: toLocaleDateString / toLocaleTimeString 은 BomulI18n.locale(). ymd() 는 언어별(ko '2026년 11월 14일', en 'November 14, 2026', zh '2026年11月14日'). 포인트 표기 fmtP 의 toLocaleString 도 locale.
4) 비석 그림 drawDesign: BomulI18n.lang === 'en' 이면 이름을 단어마다 한 줄 가로쓰기(가장 긴 단어가 비석 안쪽 폭의 86%가 되게 글자 크기), 머리 T.place 도 한 줄로, mark 는 그대로 아래.
   ko/zh 는 지금처럼 세로쓰기. sealSVG 가운데 T.sealShort 가 3글자 이상이면 한 줄(작은 글씨)로.
   글꼴 문자열은 '"Noto Serif KR","Noto Serif SC",serif' 로.
5) 브랜드 도장(여·보·행·물, 탁본 도장 '보')은 바꾸지 마.
6) 증명서 cs-en 'CERTIFICATE OF COMPLETION' 은 모든 언어에서 그대로, 제목(완주 증명서)만 번역.
확인: ?lang=en / ?lang=zh 로 지도→장소→데모 탁본→수수께끼→보물→탁본첩→(시연: 모두 완료)→보물 상자→포인트 상품→A4 증명서까지 눌러 보고, 한국어가 남은 곳을 보고해.
   A4 증명서는 en 에서 글자가 넘치지 않는지(특히 cs-desc, cs-place) 확인하고 넘치면 html[data-lang="en"] 에서만 글자 크기를 줄여.
```

## I-6. 다국어 마무리 확인

```
1) node _i18n_kit/check.mjs 를 실행하고 실패 항목을 고쳐.
2) 브라우저에서 /i18n/selftest.html?lang=en, ?lang=zh 를 열어 결과를 보여 줘. mainStopsKorean 이 0/166(zh 는 1/166 까지 정상), arKoreanLeft 가 0(zh 는 2 까지 정상)이어야 해.
3) 언어를 EN 으로 고른 뒤 메인 → 코스 상세 → 'AR 탁본 시작하기' 로 넘어갔을 때 AR 화면도 영어인지(같은 localStorage 'bomul-lang').
4) KO 로 돌아가면 예전 화면과 글자 하나 다르지 않은지 git diff 로 ko 사전 값과 원래 문구를 비교해 줘.
5) 커밋: git add client/public tools/i18n && git commit -m "feat: 다국어(영어·중국어) — 코스 데이터 구조 유지, 언어별 문구 추가, 네비바 언어 탭"
```

---

## C-1. 서버 — 모델과 순수 함수

```
_i18n_kit/SPEC-COMPLETION.md 1·2절을 읽고 서버 모델과 순수 함수를 만들어 줘. 기존 파일은 ArSettings.js 만 고쳐.
- server/src/models/ArCheckin.js, ArCompletion.js, ArWallet.js (명세의 필드·인덱스 그대로, timestamps: true)
- server/src/models/ArSettings.js 에 completionPolicy { pointsRequireOnsite:false, minOnsite:0, minMinutes:0 } 추가 (기존 문서와 호환되게 default)
- server/src/services/arComplete.js (DB·Express 모름, export):
  haversine(a,b), onsiteCheck({distance, acc, radius}) → boolean, maskName(name), makeCertNo(courseId, date, rand5), validIds(courseId, stopId),
  evaluateCompletion({ stopIds, checkins, policy, prizes }) → { ok, missing:[], onsiteCount, firstAt, completedAt, earn, reason }
- server/test/arComplete.test.mjs 에 경계값 테스트(명세 5절의 순수 함수 부분). cd server && npm test 결과를 보여 줘.
```

## C-2. 서버 — API

```
_i18n_kit/SPEC-COMPLETION.md 3절대로 API 를 만들어 줘.
- server/src/controllers/arComplete.js: postCheckin, getProgress, postComplete, getCertificate, getWallet, postExchange, listCompletions, patchCompletion, listExchanges, patchExchange
  · 코스·경유지는 controllers/ar.js 의 getArCourse 와 같은 방식으로 DB(LegendCourse)+buildArCourse 로 만든 결과에서 읽어(stopId, 좌표, onsiteRadius). 공통 부분은 함수로 빼서 같이 써.
  · 적립은 명세의 원자적 findOneAndUpdate, ArCompletion unique(11000) 처리, 증서 번호 충돌 재시도.
  · 공개 GET /certificates/:certNo 는 Cache-Control: no-store, 이름은 maskName.
- server/src/routes/ar.js 에 경로 추가 (requireUser / requireAdmin, 기존 경로 순서 유지)
- 간단한 요청 제한(사용자당 분당 30회) 미들웨어를 이 라우터의 POST 에만.
- 응답 오류 메시지는 한국어로(기존과 같게). 
- controller.test.mjs 처럼 가짜 모델로 postComplete 중복·동시 요청, postExchange 잔액 부족·동시 교환 테스트를 추가하고 npm test 결과를 보여 줘.
```

## C-3. AR 화면 — 서버 모드

```
_i18n_kit/SPEC-COMPLETION.md 4절 'ar/course.html' 을 해 줘. 다국어(t 키)도 같이 등록해(ui-ar.js 의 ko/en/zh).
- storedToken() = localStorage 또는 sessionStorage 'token'. 있으면 GET /api/me 로 확인 후 서버 모드.
- answerRight(): POST /api/ar/checkins {courseId:C.id, stopId:s.id, lat, lng, acc} (geo 상태가 ok 일 때만 위치). 응답 onsite 로 save.done[s.id].onsite 를 덮고 save.done[s.id].server = true.
  실패하면 save.pending 에 넣고, 다음에 화면을 열 때(fillIntro 뒤) 다시 보냄.
- 상자를 열 때(grantReward 자리) 서버 모드면 POST /api/ar/complete {courseId, name: wallet.name, lang: BomulI18n.lang} → 409(빠진 경유지)면 빠진 장소 이름을 안내하고 그 장소 탁본을 다시 하게.
  성공하면 save.certNo = 응답 certNo, save.serverCert = true, 적립금·내역은 GET /api/ar/wallet 값으로 표시(브라우저 지갑과 섞지 않음).
- 포인트 상품: 서버 모드면 POST /api/ar/exchange, 내역 상태(신청됨/승인/거절/보냄) 표시.
- 비로그인: 지금처럼 브라우저 저장. 표지·탁본첩·증서에 '로그인하면 완주가 서버에 기록되고 확인 가능한 증서를 받아요' + /login?next=<지금 주소> 링크. 증서 번호 앞에 LOCAL-, '브라우저 기록 · 서버 미인증' 표시.
- 서버 증서: '서버 인증' 배지 + 확인 주소 https://bomul-demo-vercel.vercel.app/ar/verify.html?no=<certNo> 를 증서 하단에 (QR 은 외부 라이브러리 없이 넣을 수 있으면 넣고, 아니면 주소만).
- 로컬 서버(4000) 없이도 화면이 멈추지 않게 모든 요청에 타임아웃(3.5초)과 실패 처리.
```

## C-4. 증서 확인 페이지

```
client/public/ar/verify.html 을 새로 만들어 줘(정적 HTML, course.html 과 같은 색·글꼴, i18n.js + ui-ar.js 사용, 언어 탭 포함).
- ?no= 가 있으면 바로 GET /api/ar/certificates/:no 조회, 없으면 입력 칸.
- 결과: 유효(초록) / 취소됨(빨강, 사유 없음) / 찾을 수 없음. 코스 이름(BomulI18n.arText 로 번역), 지역, 가린 이름, 완주일(locale), 현장 인증 n/전체, 증서 번호.
- API_BASE 는 course.html 과 같은 규칙. client/vercel.json 의 /api 넘김이 이 페이지에도 적용되는지 확인.
```

## C-5. 관리자 화면

```
_i18n_kit/SPEC-COMPLETION.md 4절 '관리자' 를 해 줘. 기존 관리자 화면(ArSettingsPage.jsx, LegendCoursesPage.jsx)의 모양·클래스(admin.css)를 그대로 따라.
- client/src/pages/ArCompletionsPage.jsx: /api/ar/completions 목록(코스·검색·쪽), 증서 번호 눌러 verify 페이지 새 창, 취소/복구(사유 입력)
- client/src/pages/ArExchangesPage.jsx: /api/ar/exchanges 목록, 상태 바꾸기(승인/거절/보냄), 거절 시 포인트 환불됨 안내
- App.jsx 경로 /admin/ar-completions, /admin/ar-exchanges, AdminPage.jsx ACTIONS 에 '완주 인증', '포인트 교환 신청'
- ArSettingsPage.jsx 에 완주 정책 3칸(현장 탁본만 적립, 최소 현장 수, 최소 소요 분)
- npm run build(client) 가 통과하는지 확인.
```

## C-6. 서버 완주 인증 확인

```
1) cd server && npm test, 그리고 node _i18n_kit/check.mjs --server 실패 항목 고치기.
2) 로컬: 테스트용 DB 로 서버(npm run dev) + 클라이언트를 켜고, 회원가입·로그인 → /ar/course.html?id=seoul-gyeongbok-ar 에서 데모 모드로 5곳 탁본 → 상자 열기 →
   응답 certNo 확인 → /ar/verify.html?no=<번호> 유효 → 관리자에서 취소 → verify 가 '취소됨' → 같은 코스 다시 완주 요청해도 적립이 늘지 않음.
3) 운영 DB 에 바로 붙이지 마. 새 컬렉션(archeckins, arcompletions, arwallets)만 생기고 기존 데이터는 바뀌지 않는지 확인.
4) 커밋: git commit -m "feat: 서버 완주 인증(체크인·증서 발급·진위 확인·서버 지갑)"
```

---

## Z. 배포

```
배포 순서를 지켜 줘: 서버(Heroku) 먼저 → 클라이언트(Vercel) 나중.
- 서버 배포 후 https://bomul-backend-ee5313fb7ed6.herokuapp.com/api/ar/certificates/NOPE 가 404 {valid:false} 인지
- 클라이언트 배포 후 /bomul.html?lang=en, /bomul.html?lang=zh, /ar/course.html?id=seoul&lang=en, /i18n/selftest.html?lang=zh
- 문제가 있으면 클라이언트만 이전 배포로 되돌려도 서버는 그대로 둬도 됨(새 API 는 예전 화면이 안 씀).
```

## T. 문제가 생겼을 때 (오류를 붙여 넣으세요)

```
아래 오류가 났어. _i18n_kit/SPEC-I18N.md, SPEC-COMPLETION.md 원칙(데이터 구조는 그대로, 번역 파일은 tools/i18n/build.cjs 로만 생성, 클라이언트 값은 믿지 않기)을 지키면서
원인을 먼저 설명하고, 고칠 파일과 바꿀 줄을 보여 준 다음 고쳐 줘.
[오류 내용]
```

### 자주 나는 문제
| 증상 | 원인·해결 |
| --- | --- |
| 영어인데 어떤 코스만 한국어 | 관리자가 그 코스를 고쳐 지문이 달라짐(정상). 번역도 바꾸려면 `tools/i18n/lang/en/courses.json` 수정 → `node tools/i18n/build.cjs` |
| `build.cjs`에서 "경유지 수가 다릅니다" | bomul.html 코스의 경유지를 늘리거나 줄였음 → 번역 JSON 의 stops 도 같은 순서로 맞추기 |
| AR 화면 일부 한국어 | 관리자가 직접 넣은 수수께끼/상품 문구(번역 없음, 정상) 또는 localizeAr 가 STOPS/T 를 읽은 뒤에 호출됨 |
| 중국어 글자가 들쭉날쭉 | Noto Sans/Serif SC 글꼴 CSS 변수 순서 확인 |
| 완주 409 | 서버 체크인이 빠진 경유지가 있음(오프라인으로 뜬 탁본) → 그 장소 탁본 다시, 또는 save.pending 재전송 확인 |
