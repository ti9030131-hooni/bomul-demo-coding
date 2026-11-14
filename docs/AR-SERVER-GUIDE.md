# AR 탁본 × 관리자 페이지 연동 (서버 작업) 안내

관리자 페이지에서 코스를 고치면 **AR 탁본 화면(/ar/course.html)에도 바로 반영**되도록 만든 작업입니다.
Cursor에서 이 파일과 `.cursor/rules/bomul-ar.mdc`를 함께 열어 두고 작업하면 됩니다.

---

## 1. 무엇이 바뀌나

| 전 | 후 |
| --- | --- |
| AR 화면은 `bomul.html`에서 미리 뽑아 둔 정적 파일(`ar/data/courses.js`)만 읽음 | AR 화면이 서버 `GET /api/ar/courses/:id`를 먼저 읽고, 서버가 안 되면 정적 파일로 진행 |
| 관리자 코스 편집에 좌표·AR 항목 없음 | 경유지마다 위도·경도, 수수께끼·보기·정답·해설·미션·증명서 문구·참고 사진·3D 모델 입력 |
| 완주 상품·포인트 상품은 코드에 고정 | 관리자 **AR 상품 설정** 화면(`/admin/ar-settings`)에서 수정 |
| 관리자가 새로 만든 코스는 AR 없음 | 새 코스도 경유지만 있으면 자동으로 AR 코스가 됨 |

수수께끼 등 AR 항목은 **비워 두면 서버가 이야기(설명)로 자동 생성**합니다. 필요한 곳만 직접 다듬으면 됩니다.

---

## 2. 바뀐 파일

### 서버 (`server/`)
| 파일 | 내용 |
| --- | --- |
| `src/models/LegendCourse.js` | 경유지 `lat`, `lng`, `ar{…}` / 코스 `ar{…}` / `arSyncVersion` 추가 |
| `src/models/ArSettings.js` | **새 파일**. 완주 상품(prizes)·포인트 상품(pointShop) |
| `src/controllers/legendCourses.js` | 좌표·AR 항목 저장, **예전 관리자 화면으로 저장해도 좌표·AR 값 보존**, 비파괴 이전(`migrateArFields`) |
| `src/controllers/ar.js` | **새 파일**. AR 코스·설정 API |
| `src/routes/ar.js` | **새 파일**. `/api/ar/*` 경로 |
| `src/services/arCourse.js` | **새 파일**. 코스(DB) → AR 데이터 변환(순수 함수) |
| `src/app.js` | `app.use('/api/ar', arRouter)` 한 줄 추가 |
| `src/data/legendCourses.json` | 시드에 좌표 163곳, 코스별 `ar.place`, 경복궁 AR 코스 추가 |
| `src/data/arDefaults.json` | **새 파일**. 상품 기본값(관리자가 저장하기 전까지 사용) |
| `test/*.test.mjs`, `package.json` | **새 테스트** + `"test": "node --test"` |

### 클라이언트 (`client/`)
| 파일 | 내용 |
| --- | --- |
| `src/pages/LegendCoursesPage.jsx` | 경유지 좌표·AR 설정, 경유지 순서 이동·삭제, 코스 AR 설정, AR 미리보기 링크 |
| `src/pages/ArSettingsPage.jsx` | **새 파일**. AR 상품 설정 화면 |
| `src/pages/AdminPage.jsx` | 대시보드에 'AR 상품 설정' 버튼 |
| `src/App.jsx` | `/admin/ar-settings` 경로 |
| `src/pages/admin.css` | AR 설정 화면 스타일(파일 끝에 추가) |
| `public/ar/course.html` | 서버 데이터 우선 읽기, 관리자 글 HTML 이스케이프 |
| `public/ar/*`, `public/bomul.html`, `public/img/route-seoul-gyeongbok-ar.jpg` | 전체 코스 AR 적용본(아래 6-1 참고) |

### 도구 (`tools/ar-courses/`)
| 파일 | 내용 |
| --- | --- |
| `make-seed.cjs` | `bomul.html` → 서버 시드에 좌표·AR 정보 채우기(이미 실행해 둠) |
| `build.cjs` | 서버가 꺼졌을 때 쓰는 정적 AR 데이터 생성 |
| `places.json` | 코스별 짧은 지역 이름(두 스크립트가 함께 씀) |

---

## 3. API

| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/api/ar/courses` | 모두 | AR 코스 목록 `[{id, region, title, stops}]` |
| GET | `/api/ar/courses/:slug` | 모두 | AR 화면용 데이터 전체(수수께끼·좌표·상품 포함) |
| GET | `/api/ar/settings` | 모두 | `{prizes, pointShop}` |
| PATCH | `/api/ar/settings` | 관리자 | `{prizes?, pointShop?}` 저장 |
| PATCH | `/api/legend-courses/:slug` | 관리자 | 기존과 같음 + `stops[].lat/lng/ar`, `ar` |

응답에 `Cache-Control: max-age=30, s-maxage=60`을 붙였습니다. **수정 후 반영까지 최대 1~2분** 걸릴 수 있습니다.

### 저장 데이터 모양(요약)
```js
// LegendCourse
{
  slug, region, theme, title, summary, thumb, hero, map, info, stories,
  stops: [{
    where, name, desc, addr,
    lat, lng,                               // 없으면 null → 데모 모드만 가능
    ar: { key, label, piece, q, qctx, opts: [], a, explain, look, cert, photo, model }  // 비우면 자동
  }],
  ar: { enabled, place, unit, finalName, sealShort, h1, story: [], deed, allDone,
        duration, nextSeason, storageKey, onsiteRadius, insideRadius, finalModel },
  syncVersion, arSyncVersion
}
```

---

## 4. 적용 순서 (Cursor)

1. 새 브랜치를 만듭니다. `git checkout -b feature/ar-admin`
2. 압축 파일을 저장소 맨 위 폴더에 풀어 덮어씁니다.
3. 서버 테스트
   ```bash
   cd server
   npm install
   npm test            # 10개 통과해야 함
   ```
4. 로컬 실행
   ```bash
   # 터미널 1
   cd server && npm run dev        # http://localhost:4000 (server/.env 필요)
   # 터미널 2
   cd client && npm install && npm run dev   # http://localhost:5173
   ```
5. 확인 체크리스트
   - [ ] 서버 로그에 `MongoDB 연결됨`이 뜨고 오류가 없다 (처음 연결 때 AR 이전이 한 번 실행됨)
   - [ ] http://localhost:4000/api/ar/courses 에 37개 코스가 나온다
   - [ ] http://localhost:4000/api/ar/courses/seoul 에 `stops[].lat`가 채워져 있다
   - [ ] 관리자 로그인 → 전체 코스 등록 → '한양 도성 보물길' → 2번 경유지 'AR 탁본 설정'에 수수께끼 입력 → 저장
   - [ ] http://localhost:5173/ar/course.html?id=seoul 에서 그 수수께끼가 나온다 (최대 1분)
   - [ ] 관리자 → AR 상품 설정 → 4등 포인트를 바꾸고 저장 → AR 화면 포인트 상품에 반영
   - [ ] 관리자가 새 코스를 만들고(좌표 입력) 저장 → `/ar/course.html?id=legend-…` 로 체험 가능
6. 배포는 **서버 먼저, 클라이언트 나중**입니다(아래 5).

---

## 5. 배포 순서

1. **서버(Heroku)** 를 먼저 배포합니다. 첫 요청 때 DB 이전(`migrateArFields`)이 자동으로 한 번 실행됩니다.
   - 기존 36개 코스: 비어 있는 좌표·`ar.place`만 채움(관리자 수정분은 그대로)
   - 경복궁 AR 코스: DB에 없으면 한 번 추가
2. **클라이언트(Vercel)** 를 배포합니다. `client/vercel.json`이 `/api/*`를 Heroku로 넘기므로 AR 화면은 같은 주소의 `/api/ar/...`를 씁니다.
3. 배포 뒤 `https://bomul-demo-vercel.vercel.app/api/ar/courses` 가 응답하는지 확인합니다.

> 클라이언트를 먼저 올려도 AR 화면은 정적 파일로 동작하므로 깨지지는 않습니다. 다만 관리자 'AR 상품 설정' 화면은 서버가 올라가야 열립니다.

---

## 6. 문제가 될 수 있는 부분 (꼭 읽어 주세요)

### 6-1. 올려 주신 파일은 '전체 코스 적용' 이전 버전입니다
`bomul-ar-update (3).zip`에는 `ar/course.html`, `ar/data/courses.js`, `ar/data/common.js`가 없고, `bomul.html`도 코스 상세의 AR 버튼이 없는 버전입니다. 이번 묶음에 **최신 전체 코스 버전을 함께 넣었습니다.** 지금 사이트의 `/ar/gyeongbok.html` 주소는 새 `course.html`로 자동 이동합니다.

### 6-2. `SEED_VERSION`을 올리면 관리자 수정분이 사라집니다 (기존 코드의 위험)
`seedLegendCourses()`는 `syncVersion < SEED_VERSION`인 코스를 **시드 내용으로 통째로 덮어씁니다.** 그래서 이번 작업은 `SEED_VERSION`을 건드리지 않고, 빈 칸만 채우는 `AR_SYNC_VERSION`을 따로 만들었습니다. 앞으로도 새 항목을 추가할 때는 `AR_SYNC_VERSION`처럼 비파괴 방식으로 하세요.

### 6-3. 예전 관리자 화면으로 저장해도 좌표가 지워지지 않게 했습니다
기존 `PATCH`는 보낸 값으로 경유지를 통째로 바꿔서, 좌표·AR 칸이 없는 예전 화면으로 저장하면 새 값이 지워질 뻔했습니다. 서버에서 **보내지 않은 칸은 같은 장소(장소+이야기 이름)의 기존 값을 유지**하도록 막았습니다(테스트 포함). 그래도 배포 순서는 서버 먼저가 안전합니다.

### 6-4. 경유지 순서·진행 기록 키를 바꾸면 사용자 기록이 끊길 수 있습니다
탁본 진행 기록은 사용자의 브라우저에 경유지 키(`s1`, `s2`… 또는 직접 정한 키)로 저장됩니다. 운영 중인 코스의 경유지 순서를 바꾸거나 키를 바꾸면, 이미 탁본한 사람의 기록이 다른 장소로 보이거나 사라질 수 있습니다. 관리자 화면에 경고 문구를 넣어 두었습니다.

### 6-5. 적립금(포인트)이 아직 브라우저에만 저장됩니다 — 고가 상품 전에 반드시 서버로
지금 적립금·교환 내역은 `localStorage`(`bomul-wallet-v1`)에 있어서
- 개발자 도구로 **포인트를 마음대로 바꿀 수 있고**,
- 기기·브라우저를 바꾸면 사라지며,
- 교환 신청이 운영자에게 전달되지 않습니다.

1등(80만~100만 원) 같은 상품을 실제로 걸기 전에 **서버 지갑**(회원 계정에 적립·교환 기록, 완주 검증, 관리자 교환 승인)이 꼭 필요합니다. `docs/CURSOR-PROMPTS.md`의 '다음 작업 1'에 Cursor용 작업 지시를 써 두었습니다.

### 6-6. 메인 페이지 일부는 아직 정적입니다
`bomul.html`의 구글 지도 좌표(`MAPGEO`), 이야기 원문(`STORIES`), 상세 자료(`DETAILS`), 맛집(`EATS`)은 여전히 파일에 있습니다. 관리자 수정이 반영되는 것은 코스 기본 정보·경유지·이야기 목록과 **AR 화면 전체**입니다. 메인 상세 페이지의 구글 지도도 서버 좌표를 쓰게 하려면 `renderDetail()`에서 `c.stops[].lat/lng`를 우선 쓰도록 바꾸면 됩니다(다음 작업 2).

### 6-7. 서버가 꺼지면 새 코스는 AR이 안 됩니다
서버 응답이 3.5초 안에 없으면 AR 화면은 정적 파일(`ar/data/courses.js`)로 진행합니다. 관리자가 **새로 만든 코스는 정적 파일에 없으므로** 그때는 첫 코스(경복궁)가 열립니다. 정적 파일을 최신으로 유지하려면 `node tools/ar-courses/build.cjs`를 가끔 실행하세요.

### 6-8. 관리자 글은 HTML로 들어가지 않습니다
보안을 위해 관리자가 입력한 글은 모두 글자 그대로 표시됩니다(줄바꿈만 반영). 굵게·링크 같은 서식은 쓸 수 없습니다.

### 6-9. 이번에 실제로 확인한 범위
- 확인함: 서버 변환·저장 로직 단위 테스트 10개, 가짜 API 서버로 AR 화면이 관리자 수정분(수수께끼·새 코스·상품)을 읽는 것, 관리자 화면 렌더링과 저장 데이터 모양, 37개 코스 정적 동작.
- 확인 못 함: 실제 MongoDB 연결과 이전 실행, Heroku·Vercel 배포. **로컬 체크리스트(4-5)를 꼭 한 번 돌려 주세요.**
