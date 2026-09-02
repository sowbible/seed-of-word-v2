<img src="app/icons/sow-logo-official.png" alt="SOW · Seed of Word" width="120">

# SOW 페이지 셸 프로토타입

> 📍 **문서가 여러 개라 헷갈리면 `PROJECT_MAP.md`부터 보세요** — 뭘 고치려면 어느 파일만 보면 되는지 정리돼 있어요.

`SOW_구조설계.md` 설계를 실제로 동작하는 코드로 만든 프로토타입입니다.

> **v5.3 업데이트**: 직접 그렸던 잎사귀 아이콘을 **공식 SOW 로고**로 교체했습니다(파랑/주황/빨강 "SOW" + 새싹). favicon부터 홈 화면 아이콘, README 배너까지 전부 반영. 상세는 `SOW_구조설계.md` 22-2절 참고.

> **v5.4 업데이트**: **`NETLIFY_SETUP.md`** 신규 — GitHub 저장소를 Public으로 안 바꿔도 무료로 배포할 수 있는 방법이에요(Private 유지). HTTPS도 자동으로 붙어서 PWA(홈 화면 설치)가 완전하게 동작해요. `DEPLOY.md`(GitHub Pages)의 대안입니다.

> **v5.5 업데이트**: "나의 성경읽기"(달력/성경지도)가 이제 성경묵상 탭에 들어가자마자 바로 보여요 — 예전엔 코스를 먼저 골라야만 보였어요. 그리고 실제 배포 후 발견된 Supabase 프로젝트 URL 오타를 고쳐서 로그인이 정상 동작합니다("Failed to fetch" 오류 해결).

> **v5.6 업데이트**: **웹과 모바일 레이아웃을 분리**했어요. 넓은 화면(1024px 이상)에서는 상단 가로 탭 대신 **왼쪽 세로 사이드바**로 바뀌고 본문도 760px→900px로 넓어져서, 예전처럼 양옆에 텅 빈 여백이 크게 남지 않아요. 모바일(640px 이하)은 기존 하단 탭바 그대로예요. HTML/JS는 안 건드리고 CSS만 바꿔서 콘텐츠·기능은 화면 크기와 무관하게 완전히 동일합니다. 상세는 `SOW_구조설계.md` 23절 참고.

## 로컬에서 바로 미리보기

Windows에서 클릭 단위로 따라 하는 자세한 방법은 **`WINDOWS_PREVIEW.md`**를 보세요.

(요약) 이 폴더 안에서:
```bash
python3 -m http.server 8000   # Windows는 python3 대신 py 또는 python 사용 — WINDOWS_PREVIEW.md 참고
```
브라우저에서 `http://localhost:8000/sow/read/index.html?book=john&step=1` 을 열면 바로 확인할 수 있어요. GitHub에 올리지 않아도 됩니다 — `fetch()`가 `file://`로는 안 열려서 반드시 이렇게 로컬 웹서버로 띄워서 봐야 해요.

## 구조

```
/content/_module-registry.json    # 최상위 4개 모듈(성경묵상/국어/언어/성경관련 지식)
/content/meditation/...           # 성경묵상 — 코스별(_track-registry.json), 걸음별 콘텐츠
/content/korean|world-languages|explore/...  # 성경묵상 코스를 자동으로 따라감 (SOW_구조설계.md 13절)
/content/bible/...                 # 66권 라이브러리 + 역본 정보 (godpia 연동용)
/app/css/shell.css                 # 공용 스타일 — 모든 페이지가 1벌만 공유
/app/js/shell.js                   # 공용 렌더링 엔진 — 레지스트리 읽어서 탭/콘텐츠 그림
/app/js/voice-text-input.js        # 음성 입력 컴포넌트
/app/js/persist.js                 # 입력 자동저장/초기화
/app/js/session-toolbar.js         # 오늘의 기록 툴바(달력/저장/새로고침)
/app/js/bible-link.js              # 성경 보기 위젯(역본 선택 + godpia)
/sow/read/index.html               # 모든 걸음이 함께 쓰는 단일 페이지 (?book=&step=&module= 로 지정)
```
전체 폴더 구조와 각 파일의 역할은 `SOW_구조설계.md`, 뭘 고치려면 어느 파일을 보면 되는지는 `PROJECT_MAP.md`에 정리돼 있습니다.

## 검증된 수치 (v1.x 초기 측정, 지금도 유효한 방향성)

| | 기존 (`SEED-OF-WORD-main`) | 신규 |
|---|---|---|
| 걸음 1개 페이지 크기 | 581,188 bytes | 페이지 자체가 아예 없음(단일 템플릿, v3.5) |
| 42걸음 전체 예상 용량 | 약 23.3MB | 공용 셸 1벌 + 콘텐츠 JSON만 |

## 새 걸음(예: 요한복음 2걸음) 추가하는 법

**페이지 파일은 안 만들어도 됩니다** (v3.5부터, `SOW_구조설계.md` 12절). `CONTENT_GUIDE.md` 템플릿대로 콘텐츠 JSON만 채우면 끝:

1. `content/meditation/elementary/steps/john/2.json` 등 필요한 콘텐츠 채우기
2. 저장하면 바로 `sow/read/index.html?book=john&step=2`로 접근 가능

셸 코드(`shell.js`, `shell.css`, 그 외 `app/js/*.js`)는 전혀 건드리지 않습니다.

## 배포 시 주의

- 지금은 `/content`, `/app`을 사이트 루트 기준 절대경로로 fetch합니다.
- 사이트를 `/sow/` 하위 경로에 두고 싶다면, `sow/read/index.html`의 `SOW_CONTEXT`에 `basePath: "/sow"`를 추가하면 됩니다 — `shell.js`가 이미 이 옵션을 지원합니다.

## 아직 안 한 것 (다음 단계)

- **그룹(기도정원/축복의 말/그룹 관리) Supabase 연동** — 지금은 UI만 있고 실제 저장은 안 됨. 설계는 `GROUP_SHARING_DESIGN.md`
- 이메일 매직링크 로그인 연동
- 국어/언어의 나머지 언어(중국어/일본어) 실제 문장 콘텐츠 채우기
- 요한복음 2~42걸음 데이터 채우기 (`CONTENT_GUIDE.md` 참고)
- 퀴즈(word/sentence quiz) 렌더러 — 콘텐츠 스키마에 자리만 있고 셸에는 아직 없음
