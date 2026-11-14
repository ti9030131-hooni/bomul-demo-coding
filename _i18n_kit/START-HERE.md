# 다국어(English · 中文) + 서버 완주 인증 키트

## 들어 있는 것
- `files/` : 저장소에 그대로 복사할 파일 (`install.mjs`가 복사)
  - **번역 완성본**: 코스 37개·이야기 159개·상세 자료 35개·맛집·AR 경복궁 손질본·완주 상품 — 영어, 중국어(간체)
  - `tools/i18n/build.cjs` : 번역 원본 → 화면용 파일 생성·검사 (현재 AR 칸 2800/2800, 서버 2795/2795 번역)
  - `client/public/i18n/i18n.js` : 다국어 도우미 완성본 (언어 고르기, 지문 확인, 코스·AR 번역 적용)
  - `client/public/i18n/selftest.html` : 빠진 번역 확인 페이지
- `CURSOR-PROMPTS.md` : Cursor 에 붙여 넣을 프롬프트 (0 → I-1~6 → C-1~6 → Z)
- `SPEC-I18N.md` · `SPEC-COMPLETION.md` : Cursor 가 읽을 설계서
- `install.mjs` · `check.mjs` : 복사·확인 스크립트 (설치할 패키지 없음, Node 20 이상)

## 순서
1. AR 키트(`_ar_kit`) 적용이 끝난 저장소에서 새 브랜치: `git checkout -b feat/i18n-complete`
2. 이 압축을 풀어 나온 `_i18n_kit` 폴더를 저장소 맨 위(server, client 폴더 옆)에 둡니다.
3. Cursor Agent 모드로 `CURSOR-PROMPTS.md` 를 0번부터 차례로.
4. 다 끝나면 `_i18n_kit` 폴더는 커밋하지 말고 지우세요.

## 핵심 원칙 (Cursor 에게도 프롬프트로 알려 줌)
- 한국어 코스 데이터(bomul.html·DB)는 **구조도 내용도 그대로**. 번역은 별도 파일.
- 관리자가 한국어를 고치면 그 칸은 고친 한국어로 보임(낡은 번역이 나오지 않음).
- 서버 완주 인증은 클라이언트가 보낸 현장 여부·시각·포인트를 믿지 않고 서버가 정함.
