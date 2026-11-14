# Cursor 작업 지시

이 기능을 처음 넣을 때 쓴 단계별 프롬프트는 AR 키트(`_ar_kit/CURSOR-PROMPTS.md`)에 있습니다.
적용이 끝난 뒤 이어서 할 작업은 아래를 Cursor(Agent)에 붙여 넣으세요. 먼저 `.cursor/rules/bomul-ar.mdc`와 `docs/AR-SERVER-GUIDE.md`를 읽게 합니다.

## 다음 작업 1 — 적립금(포인트)을 서버 회원 계정에 저장

```
.cursor/rules/bomul-ar.mdc와 docs/AR-SERVER-GUIDE.md 6-5를 읽고, AR 적립금을 서버로 옮겨 줘.
- server/src/models/ArWallet.js: user(ObjectId, unique), points, history[{type: earn|use, courseId, itemId, name, points, code, status: requested|approved|rejected|sent, at}], completed[courseId]
- server/src/routes/ar.js에 로그인 사용자 전용 API(requireUser): GET /api/ar/wallet, POST /api/ar/complete {courseId, stops:[{id, at, onsite}]}(경유지 수가 맞을 때만, 코스당 한 번 적립), POST /api/ar/exchange {itemId}(조건부 차감 findOneAndUpdate({points: {$gte: 필요포인트}}), 교환 번호 발급)
- 관리자: GET /api/ar/exchanges, PATCH /api/ar/exchanges/:code {status}, 관리자 대시보드에 '포인트 교환 신청' 화면
- client/public/ar/course.html: 로그인 토큰(localStorage 'token')이 있으면 서버 지갑, 없으면 브라우저 지갑 + '로그인하면 적립금이 계정에 저장돼요' 안내
- 브라우저 지갑 값은 서버로 그대로 옮기지 말 것(조작 위험)
- server/test에 적립 중복, 잔액 부족, 동시 교환 테스트
```

## 다음 작업 2 — 메인 상세 페이지 구글 지도도 서버 좌표 쓰기

```
client/public/bomul.html의 renderDetail()에서 gmapDir()에 넘기는 좌표를 MAPGEO[c.id] 대신 c.stops[].lat/lng가 있으면 그것으로 쓰고, 없을 때만 MAPGEO를 쓰게 바꿔 줘.
applyRemoteCourses()의 overlayCourse()가 stops의 lat/lng를 잃지 않는지도 확인해 줘.
```

## 다음 작업 3 — 주소로 좌표 찾기

```
LegendCoursesPage.jsx의 경유지 좌표 칸 옆에 '주소로 좌표 찾기' 버튼을 만들어 줘.
server에 GET /api/geocode?q= (관리자 전용)를 만들어 카카오 로컬 또는 네이버 지도 API로 주소→좌표를 바꾸고, API 키는 server/.env에만 둬.
```
