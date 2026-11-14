# 서버 완주 인증 명세 — Cursor 참고용

지금은 탁본 기록·완주·적립금·증서 번호가 **브라우저(localStorage)** 에만 있어 누구나 고칠 수 있고, 증서가 진짜인지 확인할 방법이 없습니다.
이 작업으로 **로그인한 사용자의 탁본·완주를 서버가 기록하고, 서버가 증서 번호를 발급하며, 누구나 증서 번호로 진위를 확인**할 수 있게 합니다.
적립금(포인트)도 서버 지갑으로 옮깁니다(완주 적립을 서버가 하므로 함께 해야 안전).

## 1. 신뢰 원칙
- 클라이언트가 보내는 `onsite`, `at`, `points`, `certNo` 는 **믿지 않습니다.** 서버가 시각(`Date.now()`)·거리·적립금·번호를 정합니다.
- 현장 여부는 서버가 계산: 탁본 순간 보낸 위치(lat, lng, accuracy)와 **DB 코스의 경유지 좌표**(buildArCourse 결과의 stops[].lat/lng, onsiteRadius)로
  `distance <= onsiteRadius + min(accuracy, 50)` 이고 `accuracy <= 150` 이면 `onsite = true`.
  (GPS 위조까지 막지는 못합니다. 고가 상품은 관리자 승인 단계로 막습니다 — 아래 교환 상태)
- 브라우저 지갑의 포인트는 서버로 **옮기지 않습니다**(조작 위험). 로그인 후 새로 완주한 것만 서버 적립.

## 2. 모델 (server/src/models)
```js
// ArCheckin.js — 경유지 탁본 기록
{ user: ObjectId(ref User, index), courseId: String, stopId: String,
  at: Date(서버 시각), lat: Number|null, lng: Number|null, acc: Number|null,
  distance: Number|null(m), onsite: Boolean, ua: String(80자) }
// unique index { user:1, courseId:1, stopId:1 }  — 다시 뜨면: 처음 기록은 유지, 이번이 onsite면 onsite·distance·at만 갱신

// ArCompletion.js — 완주 증서
{ certNo: String(unique), user: ObjectId(index), courseId: String, courseTitle: String, region: String,
  explorerName: String(1~20자), firstAt: Date, completedAt: Date, totalStops: Number, onsiteCount: Number,
  points: Number, lang: 'ko'|'en'|'zh', revoked: Boolean(default false), revokedReason: String }
// unique index { user:1, courseId:1 }  — 코스당 한 번

// ArWallet.js — 서버 지갑
{ user: ObjectId(unique), points: Number(min 0),
  history: [{ type:'earn'|'use', courseId, itemId, name, points, code, status:'done'|'requested'|'approved'|'rejected'|'sent', at }],
  completed: [String] }   // 적립한 코스 id
```
ArSettings 에 `completionPolicy: { pointsRequireOnsite: Boolean(default false), minOnsite: Number(default 0), minMinutes: Number(default 0) }` 추가
(관리자 'AR 상품 설정' 화면에 체크박스·숫자 칸 추가). 기본값은 지금처럼 데모 모드도 적립.

## 3. API (server/src/routes/ar.js, controllers/arComplete.js)
| 메서드 | 경로 | 권한 | 동작 |
| --- | --- | --- | --- |
| POST | `/api/ar/checkins` | requireUser | `{courseId, stopId, lat?, lng?, acc?}` → 코스·경유지 존재 확인(LegendCourse + buildArCourse), 서버 거리 계산, upsert. 같은 경유지 3초 안 재요청은 무시. 응답 `{stopId, onsite, distance, at}` |
| GET | `/api/ar/progress/:courseId` | requireUser | 내 체크인 목록 + 완주 여부(`completion` 또는 null) |
| POST | `/api/ar/complete` | requireUser | `{courseId, name, lang}` → **지금 코스의 모든 stopId에 체크인이 있어야** 함(없으면 409 + 빠진 목록). 정책 검사. 증서 번호 발급, 적립(아래 원자적 처리). 이미 완주면 기존 증서를 그대로 돌려줌(200, 중복 적립 없음) |
| GET | `/api/ar/certificates/:certNo` | 공개 | `{valid, certNo, courseTitle, region, explorerName(가운데 가림: 홍*동 / J*** K**), completedAt, totalStops, onsiteCount, revoked}` · `Cache-Control: no-store` · 없으면 404 `{valid:false}` |
| GET | `/api/ar/wallet` | requireUser | `{points, history, completed}` (없으면 빈 지갑 만들어 돌려줌) |
| POST | `/api/ar/exchange` | requireUser | `{itemId}` → 설정의 pointShop에서 필요 포인트 찾기 → `findOneAndUpdate({user, points:{$gte:p}}, {$inc:{points:-p}, $push:{history:{type:'use', status:'requested', code}}})` (실패하면 409 잔액 부족) |
| GET | `/api/ar/completions` | requireAdmin | `?courseId=&q=&page=` 완주 목록 |
| PATCH | `/api/ar/completions/:certNo` | requireAdmin | `{revoked, reason}` 증서 취소/복구 |
| GET | `/api/ar/exchanges` · PATCH `/api/ar/exchanges/:code` | requireAdmin | 교환 신청 목록, 상태 변경(approved/rejected/sent). rejected면 포인트 되돌림(한 번만) |

- 증서 번호: `BM-<코스id 앞 3글자 대문자>-<YYYYMMDD(KST)>-<crypto.randomInt 5자리>` , unique 충돌 시 다시 생성(최대 5회)
- **적립 원자 처리**: `ArWallet.findOneAndUpdate({user, completed:{$ne:courseId}}, {$addToSet:{completed:courseId}, $inc:{points:earn}, $push:{history:{type:'earn',...}}}, {upsert:false})` — 지갑이 없으면 먼저 `updateOne({user},{$setOnInsert:{points:0}},{upsert:true})`. ArCompletion 은 unique index 로 동시 요청을 막고 11000 이면 기존 문서를 읽어 돌려줌.
- earn = 설정 prizes 의 points 합계 (정책상 적립 불가면 0, 증서는 발급)
- 요청 본문 길이·형식 검사(courseId/stopId 는 `^[a-z0-9-]{1,60}$`, 이름 20자, lat/lng 범위)
- 체크인·완주 요청 제한: 사용자당 분당 30회(간단한 메모리 카운터면 충분)

## 4. 화면
### ar/course.html
- `storedToken()`(localStorage 또는 sessionStorage 'token') 이 있으면 **서버 모드**
  - 표지·탁본첩에 `서버 인증 중 · 아이디` 표시. 없으면 `로그인하면 완주가 서버에 기록되고 진짜 증서를 받아요` + 로그인 링크(`/login?next=` 현재 주소)
  - `answerRight()` 에서 `POST /api/ar/checkins` (위치는 geo.lat/lng/acc, 없으면 null). 응답 `onsite`를 `save.done[id].onsite` 로 덮어씀(서버 판정 우선). 실패하면 로컬로 진행하고 다음 열 때 다시 보냄(`save.pending`)
  - 다섯(전부) 모으고 상자를 열 때 `POST /api/ar/complete` → 받은 `certNo`·`points`로 화면 표시, `save.certNo = 서버 번호`, 지갑은 `GET /api/ar/wallet` 값으로 표시
  - 포인트 상품 교환은 `POST /api/ar/exchange` (교환 번호=서버 code, 상태 '신청됨')
- 토큰이 없으면 지금처럼 브라우저 저장(증서에 `브라우저 기록 · 서버 미인증` 표시, 증서 번호 앞에 `LOCAL-`)
- A4 증서: 서버 증서면 `서버 인증` 배지 + 확인 주소 `https://<사이트>/ar/verify.html?no=<certNo>` 와 QR(의존성 없이 작은 QR 생성 코드 넣거나, 주소 글자만이라도)
### ar/verify.html (새, 공개)
- `?no=` 입력·조회 → `GET /api/ar/certificates/:no` → 유효/취소/없음 표시. 다국어(i18n.js) 적용
### 관리자 (client/src)
- `AdminPage.jsx` ACTIONS에 '완주 인증' → `/admin/ar-completions` (목록, 검색, 취소), '포인트 교환 신청' → `/admin/ar-exchanges`
- `ArSettingsPage.jsx` 에 완주 정책 칸

## 5. 테스트 (server/test, node --test, DB 없이 순수 함수 위주)
- `onsiteCheck(distance, acc, radius)` 경계값, `maskName()`, `makeCertNo()` 형식
- complete: 체크인 빠짐 → 409, 같은 코스 두 번 → 같은 증서·적립 1회, 동시 두 요청 → 적립 1회 (모델은 가짜 객체로)
- exchange: 잔액 부족 409, 동시 교환 두 번 → 하나만 성공
