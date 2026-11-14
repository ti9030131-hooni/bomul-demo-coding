# Cursor 프롬프트 — 새 메인 디자인 + 새 코스 지도

한 번에 하나씩 붙여 넣고, Cursor가 끝났다고 보고하면 다음으로 넘어가세요. (Agent 모드)

---

## 1. 미리보기 (아무것도 바꾸지 않음)

```
저장소 맨 위에 _design_kit 폴더가 있어. _design_kit/START-HERE.md 를 읽고,
터미널에서 node _design_kit/apply.mjs 를 실행해서 결과를 그대로 보여 줘.
아직 파일을 바꾸지 마. git status 도 보여 줘.
```
✔ `client/public/bomul.html` 이 **교체** 또는 **자동병합** 이면 정상입니다. **충돌**이면 3번을 쓰게 됩니다.

## 2. 적용

```
node _design_kit/apply.mjs --apply 를 실행해 줘. 커밋하지 않은 변경이 있다고 멈추면, 그 변경을 먼저 커밋할지 나에게 물어봐.
끝나면 node _design_kit/verify.mjs 결과를 보여 줘. 파일 내용은 직접 고치지 마.
```

## 3. 충돌 해결 (2번에서 '충돌'이 나온 경우에만)

```
_design_kit 적용에서 충돌이 났어. 충돌 파일 옆에 <파일>.design-merge(충돌 표시 병합본)와 <파일>.design-new(키트 새 버전)가 있어.
규칙:
- 새 디자인(키트 쪽)을 기준으로 하되, 내가 직접 넣은 기능·문구(예: 다국어 data-i18n, 내가 고친 코스 데이터 COURSES/STORIES 등)는 살려.
- <style> 끝의 '프로모션형 디자인' 블록, <div id="view-home"> 전체, 맨 아래 SEASON2_OPEN_AT·startCountdown·watchHomeTabs 코드는 키트 버전 그대로.
- 예전 <section class="coming"> (COMING SOON) 은 홈 안 '다음 시즌' 구역으로 옮겨졌으니 남기지 마.
- 충돌 표시(<<<<<<< ======= >>>>>>>)를 모두 없앤 결과를 원래 파일에 저장하고, .design-merge / .design-new 두 파일은 지워.
끝나면 node _design_kit/verify.mjs 결과를 보여 줘.
```

## 4. 카운트다운 날짜

```
client/public/bomul.html 에서 const SEASON2_OPEN_AT = "2027-03-01T00:00:00+09:00"; 을 찾아
유럽 편 공개 날짜를 "[여기에 날짜, 예: 2027-04-01]" 한국 시간 자정으로 바꿔 줘. 다른 곳은 바꾸지 마.
```

## 5. 화면 확인 (로컬)

```
client 폴더에서 개발 서버(npm run dev)를 켜고 /bomul.html 을 열어서 아래를 확인하고 결과를 보고해 줘. 고칠 게 있으면 고치기 전에 먼저 알려 줘.
1) 맨 위 주황 띠, 히어로 "보물을 찾아라"와 보물 상자, 별이 움직이는 배경
2) 히어로 바로 아래 AR 탁본 체험(영상) → 회색 바로가기 탭(누르면 해당 구역으로 이동, 스크롤하면 탭 밑줄이 따라감)
3) 총 완주 보상 티켓 3장, 빨간 '한눈에 보기', 사진 배너, 추천 코스 카드 3개(서버 코스가 있으면 서버 내용)
4) 다음 시즌: 카운트다운이 그리스 신화 사진 위에 있고 1초마다 줄어듦
5) 휴대폰 너비(390px)에서 가로 스크롤이 생기지 않음, 탭이 옆으로 밀림
6) #courses 와 #course-seoul, #course-seoul-half, #course-gyeongju 에서 '코스 지도'가 새 지도(연한 회색 바탕)로 나옴
7) 로그인·장바구니·신청 보내기 버튼이 예전처럼 동작
```

## 6. 커밋 · 배포

```
_design_kit 폴더와 백업은 커밋에서 빼고(.gitignore 에 _design_kit/ 추가해도 됨) 아래로 커밋해 줘.
git add client/public/bomul.html client/public/img tools/route-maps
git commit -m "feat: 메인 페이지 새 디자인(보물을 찾아라) · 코스 지도 실제 지리 기반으로 교체"
배포는 클라이언트(Vercel)만 하면 돼. 서버는 바뀐 게 없어.
```

---

## (선택) 코스 좌표를 고친 뒤 지도 다시 만들기

```
tools/route-maps/build.mjs 맨 위 설명대로 준비해 줘(npm i -D d3-geo d3-shape, pip install playwright pillow, playwright install chromium).
그다음 node tools/route-maps/build.mjs <코스id> 와 python3 tools/route-maps/render.py <코스id> 로 그 코스 지도만 다시 만들어 줘.
한글 글꼴(Noto Sans CJK KR, Noto Serif CJK KR)이 없으면 설치 방법을 알려 줘.
```

## 문제가 생겼을 때

```
아래 오류가 났어. 원인을 먼저 설명하고, 고칠 파일과 줄을 보여 준 다음 고쳐 줘. 새 디자인과 기존 기능(코스·상세·신청·로그인)은 둘 다 유지해야 해.
[오류 내용]
```

| 증상 | 해결 |
| --- | --- |
| 지도 이미지가 예전 그대로 | 브라우저 캐시. 강력 새로고침(Ctrl+Shift+R) 또는 배포 후 몇 분 |
| 큰 제목 글꼴이 얇게 나옴 | 구글 폰트(Black Han Sans, Anton) 차단 여부 확인 |
| 탭이 메뉴 아래로 숨음 | `--nav-h` 값(상단 메뉴 높이)을 setNavHeight()가 넣는지 확인 |
| 별 배경이 안 보임 | `startStarfield();` 호출과 `<canvas id="starfield">` 존재 확인 |
