# SOW 작업 히스토리 (과거 기록 보관용)

`SOW_구조설계.md`는 "지금 유효한 구조"만 담고, 지나간 진단·측정 기록은 여기로 옮겨서 본문을 간결하게 유지한다.

---

## 기존 코드(SEED-OF-WORD-main) 진단 — 2026-08-16

**검토 대상** 업로드된 `SEED-OF-WORD-main.zip` (31MB)

### 핵심 문제 — 페이지 단위 전체 복제
- `sow/john/{1..42}/index.html`이 각각 독립 파일로 존재, 파일당 460~576KB
- 챕터1과 챕터2 파일 유사도 98.95% — 사실상 동일한 셸이 챕터마다 복사돼 있음
- 페이지 1개마다 인라인 `<script>` ~211KB + 인라인 `<style>` ~160KB가 반복
- `john` 폴더 하나가 24MB (전체 저장소 31MB의 대부분)

### 유지보수 방식의 위험 신호
- `sow/scripts/apply_fix_*.py` 패치 스크립트 20개 — 이미 구워진 HTML/JS 문자열을 직접 치환하는 1회성 패치
- `V56`~`V113` UPLOAD_FIRST.txt 39개, 개별 `.sql` 12개 — 통합 스키마 없이 버전별 증분 SQL만 존재
- 위 두 가지가 결합되면 42개 복제 페이지 중 일부에만 패치가 누락되는 drift 위험이 실재함

### 재사용 가능한 자산
- `sow/data/*.js` — 한자·스토리·어휘 콘텐츠가 `window.SOW_JOHN_HANJA = {...}` 형태로 이미 구조화. `window.X =` 래퍼만 벗기면 JSON으로 이관 가능
- `sow-platform.js` / `sow-online.js` / `sow-family-course.js` — 이미 공용 파일로 분리되어 각 페이지가 로드 중
- **음성 녹음 기능(v107c)** — `eligible()` 함수로 대상 입력창 선별, `MutationObserver`로 동적 입력창 자동 감지, Web Speech API(`ko-KR`, `interimResults`)로 실시간 텍스트 입력. → `VoiceTextInput` 공통 컴포넌트로 승격 완료(`app/js/voice-text-input.js`)
- **가족 기도정원 / 축복의 말 / 가족 현황** — 기능 개념 자체는 우수. → `SOW_구조설계.md` "우리 가족" 절로 승격 완료

### 권장 방향 (실행 완료)
1. 페이지 셸 복제 구조 위에 패치를 쌓지 않는다
2. `sow/data/*.js` 콘텐츠, 음성 인식 로직, 가족 기능은 "요구사항 기록"으로 보고 새 구조로 이관
3. 페이지 셸을 단일 템플릿 + 데이터 바인딩 구조로 전환

---

## 페이지 셸 프로토타입 구현 결과 — 2026-08-16

산출물: `app/css/shell.css`, `app/js/shell.js`, `app/js/voice-text-input.js`, `sow/john/1/index.html`

| | 기존 | 신규 |
|---|---|---|
| 챕터 1 페이지 크기 | 581,188 bytes | 676 bytes (**99.88% 절감**) |
| 42챕터 전체 예상 용량 | 약 23.3MB | 약 48KB (공용 셸 1벌 + 페이지 42개) |

- `shell.js`: 모듈 레지스트리를 읽어 상단 탭을 그리고, 클릭 시에만 해당 모듈 JSON을 지연 로딩(fetch)
- `voice-text-input.js`: v107c 로직 승격. 콘텐츠 JSON의 `input.voiceInput === true`로 렌더링된 `data-voice="1"` 속성을 자동 스캔
- 새 챕터 추가 시 셸 코드는 건드리지 않고 `SOW_CONTEXT`만 다른 20줄짜리 페이지를 만들면 됨

**주의**: 이 수치와 `shell.js`는 "성경묵상 = 단일 최상위 모듈, 챕터 축 하나만 존재"하던 v1.x 구조 기준이다. v2.0의 트랙 구조(성경묵상 › 초등학생 › 걸음)에서는 `shell.js`의 fetch 경로를 트랙 단위로 한 단계 더 파고들도록 고쳐야 한다 — `SOW_구조설계.md` 7절 다음 단계 참고.

---
