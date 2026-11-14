# 다국어(English · 中文) 명세 — Cursor 참고용

**원칙: 코스 데이터 구조는 그대로 두고, 언어별 문구만 따로 추가합니다.**
`bomul.html`의 `COURSES / STORIES / DETAILS / EATS / TIMELINES` 와 서버 DB(LegendCourse)는 한국어 그대로입니다.
번역은 `client/public/i18n/` 의 별도 파일에 있고, 고른 언어일 때만 불러옵니다.

## 1. 이미 만들어 둔 것 (키트 `files/` → 저장소에 복사)

| 파일 | 내용 |
| --- | --- |
| `tools/i18n/lang/en/*.json`, `tools/i18n/lang/zh/*.json` | **번역 원본**. 코스 37개·이야기 159개·상세 자료 35개·맛집 36코스 (한국어 약 4.9만 자 분량) |
| `tools/i18n/lang/gyeongbok.json` · `places.json` · `common.json` · `alt.json` · `detailIds.json` | AR 경복궁 손질본·지역 이름·완주 상품/포인트 상품·서버 시드에만 있는 문구 번역 |
| `tools/i18n/templates.cjs` | AR 화면에 자동으로 만들어지는 문구의 언어별 틀 (ko 틀은 서버·정적 변환과 똑같음) |
| `tools/i18n/build.cjs` | 번역 원본 → 아래 4개 파일 생성 + 구조 검사 + AR 칸 커버리지 보고 |
| `client/public/i18n/content.en.js`, `content.zh.js` | 메인 페이지용 번역 묶음 (생성 파일) |
| `client/public/i18n/ar.en.js`, `ar.zh.js` | AR 화면용 사전: 한국어 원문 지문 → 번역 (생성 파일) |
| `client/public/i18n/i18n.js` | 언어 고르기·불러오기·`t()`·코스/이야기/상세/맛집/AR 번역 적용 도우미 (**완성본, 그대로 사용**) |
| `client/public/i18n/selftest.html` | `?lang=en` / `?lang=zh` 로 열면 빠진 번역 칸 수를 보여 줌 |

`node tools/i18n/build.cjs` 실행 결과(현재): `en/zh 사전 1407개 · 정적 AR 2800/2800 · 서버 AR 2795/2795` (빠진 칸 0)

## 2. 번역 원본 모양 (= 한국어 데이터 구조 그대로)

```jsonc
// tools/i18n/lang/en/courses.json
{ "seoul": { "region": "Seoul", "theme": "...", "title": "...", "summary": "...",
    "info": { "거리": "About 9 km", "소요시간": "About 6 hours", "난이도": "Moderate", "집결지": "..." },  // 키는 한국어 그대로
    "stops": [ { "where": "Treasure 1 · Gyeongbokgung", "name": "...", "desc": "... [Mission] ..." } ] } }
// stories.json : { "한국어 이야기 제목": { "t": "번역 제목", "x": "번역 본문" } }
// details.json : { "d0": { "intro", "points":[{h,d}], "visit":[{k,v}] } }  + detailIds.json { 코스id: "d0" }
// eats.json    : { 코스id: [ { "seg", "rate", "d" } ] }   ← 가게 이름(name)은 번역하지 않음
```
- 미션 표시: 한국어 `[미션]` → 영어 `[Mission]`, 중국어 `[任务]` (AR 변환이 이 표시로 이야기/현장 미션을 나눔)
- 주소(addr)는 지도 검색용이라 번역하지 않음

## 3. 지문(sig) — 관리자가 한국어를 고치면?

`content.*.js` 에는 번역과 함께 **한국어 원문의 지문**(FNV-1a 해시, base36)이 들어 있습니다.
`BomulI18n.course(c)` 는 칸마다 `hash(지금 한국어) === sig` 일 때만 번역을 쓰고, 다르면 `textDict`(alt.json) → 한국어 순으로 보여 줍니다.
→ 관리자 페이지에서 고친 코스는 **고친 한국어가 그대로** 보입니다(낡은 번역이 보이는 일 없음). 번역을 고치려면 `tools/i18n/lang/*` 수정 → `node tools/i18n/build.cjs`.

AR 화면도 같습니다. `ar.*.js` 사전은 “한국어 문자열 지문 → 번역”이라, 서버가 준 AR JSON의 문자열이 사전에 있으면 바꾸고 없으면 한국어로 둡니다.
(관리자가 직접 넣은 수수께끼·보기·상품 문구는 번역되지 않고 한국어로 나옵니다 — 알려진 한계)

## 4. `i18n.js` API (완성본)

```js
BomulI18n.lang                    // 'ko' | 'en' | 'zh'  (?lang= → localStorage 'bomul-lang' → 'ko')
await BomulI18n.ready(['content']) // bomul.html: 번역 묶음 불러오기 (ko면 즉시)
await BomulI18n.ready(['ar'])      // course.html
BomulI18n.addUI('en', { 'nav.home': 'Home', ... })  // 화면 문구 등록 (ko 도 등록해야 함)
BomulI18n.t('key', { n: 3 })       // '{n}' 치환, 값이 함수면 함수(vars) — 한국어 조사: BomulI18n.jo(w,'을','를')
BomulI18n.apply()                  // [data-i18n] / [data-i18n-html] / [data-i18n-attr="placeholder:키;aria-label:키"] 적용 + <html lang>
BomulI18n.tabsHtml()               // <button class="lang-tab" data-lang="ko|en|zh" aria-pressed>KO / EN / 中文</button>
await BomulI18n.setLang('en', { packs: ['content'] })  // 바로 바꾸고 'bomul:lang' 이벤트 (AR 화면은 { reload: true })
BomulI18n.course(c)  BomulI18n.story(제목, 본문)  BomulI18n.details(id, DETAILS[id])  BomulI18n.eats(id, EATS[id])
BomulI18n.duration('버스+도보 30분')  // 'Bus+Walk 30 min' / '巴士+步行 30分钟' (타임라인 stay/move)
BomulI18n.localizeAr(course)       // AR 코스 JSON을 제자리에서 번역 (title,text.*,final.*,prizes,pointShop,map.base,stops[].*)
BomulI18n.locale()                 // 'ko-KR' | 'en-US' | 'zh-CN' (날짜·숫자 표기)
```

## 5. 화면 문구(UI) 용어집 — 번역을 이것으로 통일

| 한국어 | English | 中文 |
| --- | --- | --- |
| 보물 여행 (브랜드) | Bomul Travel | 宝物旅行 |
| 코스 / 전체 코스 | course / All Courses | 路线 / 全部路线 |
| 신청·문의 | Apply & Contact | 报名·咨询 |
| AR 탁본 체험 | AR Rubbing | AR拓本体验 |
| 탁본 / 탁본 뜨기 | rubbing / take a rubbing | 拓本 / 拓印 |
| 탁본첩 | Rubbing Album | 拓本册 |
| 비석 / 한지 / 먹 | stone tablet / hanji paper / ink | 石碑 / 韩纸 / 墨 |
| 수수께끼 | riddle | 谜题 |
| 보물 / 보물 상자 | treasure / treasure chest | 宝物 / 宝箱 |
| 적립금(포인트) / 포인트 상품 | points / point rewards | 积分 / 积分商品 |
| 완주 / 완주 증명서 | completion / Completion Certificate | 完成 / 完成证书 |
| 현장 모드·현장 인증 / 데모 모드 | On-site mode·On-site verified / Demo mode | 现场模式·现场认证 / 演示模式 |
| 서버 인증 증명서 / 증서 번호 | Server-verified certificate / Certificate No. | 服务器认证证书 / 证书编号 |
| 경유지 / 이야기 / 상세 자료 / 중간 쉼터·맛집 | Stops / Stories / Details / Rest stops & eats | 途经地 / 故事 / 详细资料 / 休息站·美食 |
| 거리 / 소요시간 / 난이도 / 집결지 | Distance / Duration / Difficulty / Meeting point | 距离 / 所需时间 / 难度 / 集合地点 |
| 지역 필터: 서울 경기도 인천 강원도 충청도 경상도 전라 제주 전래 부산 대구 대전 울산 광주 세종 | Seoul, Gyeonggi, Incheon, Gangwon, Chungcheong, Gyeongsang, Jeolla, Jeju, Folktales, Busan, Daegu, Daejeon, Ulsan, Gwangju, Sejong | 首尔、京畿道、仁川、江原道、忠清道、庆尚道、全罗、济州、民间故事、釜山、大邱、大田、蔚山、光州、世宗 (전체 = All / 全部) |

## 6. 화면별로 해야 할 일 (Cursor가 할 일)

### bomul.html
1. `<head>`에 `<script src="/i18n/i18n.js"></script>` (메인 스크립트보다 먼저)
2. 네비바 `.nav-bar` 안, 브랜드와 ☰ 사이에 `<div class="lang-tabs" role="group" aria-label="언어">` + `BomulI18n.tabsHtml()` — **모바일에서도 접히는 메뉴 밖에 항상 보이게** (작게: 높이 28px, KO/EN/中文)
3. 정적 문구 전부 `data-i18n` 키 (`nav.*`, `home.*`, `courses.*`, `detail.*`, `apply.*`, `coming.*`, `footer.*`, 이미지 alt는 `data-i18n-attr="alt:키"`), `<title>`·`meta description` 포함
4. JS가 만드는 문구 전부 `t()` (courseCard, renderCourses 지역 칩·안내, infoCell 라벨·'입력 예정', addrLink '네이버 지도 ↗', renderDetail 전부(타임라인 '체류'·'이동'·'완주 보상'·'총 소요시간', 블록 제목, AR 안내 상자, 버튼), 신청 폼 안내·토스트, 복사 버튼, ☰ aria-label, 로그인 링크의 '관리자'/'내 정보')
5. 데이터 번역: `courseCard(c)`·`renderDetail` 에서 `const L = BomulI18n.course(c)` 로 바꾼 값 사용. 이야기 `BomulI18n.story(t, STORIES[t])`, 상세 `BomulI18n.details(c.id, DETAILS[c.id])`, 맛집 `BomulI18n.eats(c.id, EATS[c.id])`, 타임라인 `BomulI18n.duration(seg.stay/move)`. 타임라인 장소 이름은 번역된 where에서 `/^(보물|Treasure|宝物)\s*\d+\s*·\s*/` 를 뗌. 지역 칩은 `data-region`에 한국어 값 유지(필터는 한국어로 비교), 글자만 번역
6. 시작: `BomulI18n.ready(['content']).then(()=>{ BomulI18n.apply(); renderHome(); route(); })` 순서로 (첫 렌더가 번역 전에 한 번 돌아도 됨, 다시 그림)
7. 언어 탭 클릭 → `BomulI18n.setLang(code,{packs:['content']})` → `bomul:lang` 이벤트에서 `refreshCourseViews()` + 탭 `aria-pressed` 갱신
8. AR 링크(`arUrl`)는 그대로. AR 화면이 같은 localStorage 값을 읽음. (언어를 확실히 넘기려면 `&lang=` 붙여도 됨)
9. 중국어일 때 글꼴: `html[data-lang="zh"]{ --display: "Noto Serif SC", serif; --body: "Noto Sans SC", sans-serif }` 처럼 기존 CSS 변수 덮어쓰기 (i18n.js가 zh일 때 구글 폰트를 불러옴)

### ar/course.html
1. `<script src="../i18n/i18n.js"></script>` 를 data 스크립트들 앞에
2. 메인 async 함수 맨 앞에서 `await BomulI18n.ready(['ar'])`
3. 코스 C가 정해지고 `C.pointShop`/`C.final.prizes` 기본값을 넣은 **직후** `BomulI18n.localizeAr(C)` (서버 데이터든 정적 데이터든). 코스 고르기 목록의 제목·지역도 `BomulI18n.arText()`
4. 화면 문구 전부 `t()`·`data-i18n` (표지, 지도, 위치 안내 geoText, 장소, AR 안내(setState 힌트·토스트·offHint '←비석은 왼쪽'), 수수께끼, 보물 획득, 탁본첩, 보물 상자, 포인트 상품, 모달, A4 증명서, 라이트박스, 탭, confirm/alert)
   - 한국어 문구의 조사(`jo(...)`)는 ko 사전의 함수 값으로 옮김. en/zh 문구에는 조사 없음
   - `NUMW`(한/두/세…)·`ORD`(첫/두…)는 ko 전용 → en은 숫자/서수(1st…), zh는 숫자(第1)
   - 날짜: `toLocaleDateString(BomulI18n.locale(), …)`, `ymd()`는 en `November 14, 2026`, zh `2026年11月14日`
5. 비석 그림(drawDesign): 한글·한자처럼 세로쓰기는 ko/zh만. **en은 단어마다 한 줄 가로쓰기**(글자 크기를 폭에 맞춤). 머리 글자(T.place)도 en은 한 줄. 인장 가운데 `T.sealShort`가 3글자 이상이면 한 줄 작은 글씨
6. 브랜드 인장(여·보·행·물 도장, 탁본 도장 '보')은 디자인 요소라 그대로 둠
7. 표지 상단(← 홈 옆)에 같은 언어 탭. 누르면 `setLang(code,{reload:true})`
8. `document.title` 도 `t()`

### 그대로 한국어인 곳 (알려진 한계 — 사용자에게 안내)
- React 관리자·로그인·장바구니·게시판 화면 (`client/src`) — 운영자용이라 이번 범위 밖
- 서버 오류 메시지(`body.message`)
- 관리자가 직접 쓴 AR 수수께끼·보기·상품 문구, 관리자가 고친 코스 문구(한국어로 보임)
