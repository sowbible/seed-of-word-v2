# SOW 페이지 셸 프로토타입

> 📍 **문서가 여러 개라 헷갈리면 `PROJECT_MAP.md`부터 보세요** — 뭘 고치려면 어느 파일만 보면 되는지 정리돼 있어요.

`SOW_구조설계.md` 설계를 실제로 동작하는 코드로 만든 프로토타입입니다.

> **v4.6 업데이트**: **`SUPABASE_SETUP.md`** 신규 — 실제로 서버에 기록을 남기고 싶으면 이 문서대로 Supabase 프로젝트를 만들고 SQL을 실행하세요(실행 가능한 SQL 전체 포함: entries/groups/group_members/group_shared_answers/group_blessings + RLS 정책). 프로젝트 URL과 anon key를 알려주시면 이어서 실제 코드 연동을 진행합니다.

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
