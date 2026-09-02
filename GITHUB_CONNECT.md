# GitHub 연결 방법

지금까지 만든 파일(구조 문서, content 폴더 등)을 이미 갖고 계신 GitHub 저장소에 합치는 방법이에요. 두 가지 방법 중 편한 쪽을 고르세요.

> **참고**: GitHub에 올리지 않아도, 받은 파일 폴더 안에서 `python3 -m http.server 8000` 실행 후 `http://localhost:8000/sow/read/index.html?book=john&step=1`을 열면 바로 미리 볼 수 있어요(`README.md` 참고). GitHub 연결은 "다른 사람도 볼 수 있게 인터넷에 공개"하는 단계예요.

- **방법 A. GitHub Desktop** — 개발 경험 없어도 클릭만으로 가능. 콘텐츠 담당자도 쓸 수 있어요.
- **방법 B. 터미널(git 명령어)** — 개발자용. 더 빠르고 세밀하게 제어 가능.

두 방법 다 같은 순서를 따라요: **① 기존 저장소 받아오기 → ② 새 파일 넣기 → ③ 커밋 → ④ 올리기(push) → ⑤ main에 병합.**

---

## 준비물

1. GitHub 계정 (기존 저장소에 접근 권한 있는 계정)
2. 기존 저장소 주소 — GitHub 저장소 페이지에서 초록색 **`<> Code`** 버튼을 누르면 나오는 주소
   - 이번 프로젝트 주소: `https://github.com/sowbible/seed-of-word-v2.git`
3. (방법 B를 쓴다면) 컴퓨터에 Git 설치 여부 확인: 터미널에 `git --version` 입력해서 버전이 뜨는지 확인. 안 뜨면 https://git-scm.com/downloads 에서 설치.

> **저장소가 완전히 비어있다면(파일이 하나도 없는 상태)** — GitHub 저장소 페이지를 열었을 때 "Quick setup" 파란 박스가 보이고 그 안에 **"Set up in Desktop"** 버튼이 있어요. 아래 방법 A의 2단계(Clone repository) 대신 **이 버튼을 바로 클릭**하면 GitHub Desktop이 열리면서 clone 대상이 이미 채워진 채로 뜨고, "Clone" 버튼만 누르면 돼요 — 훨씬 빨라요. 나머지 3~8단계는 그대로 따라 하시면 됩니다. (저장소에 이미 파일이 있다면 이 지름길 대신 아래 2단계부터 그대로 진행하세요.)

---

## 방법 A. GitHub Desktop (추천 — 비개발자용) — 클릭 단위 상세 안내

### 준비: 지금 받은 zip 먼저 압축 풀어두기

`sow-app-v4.6.zip`(또는 가장 최근 버전) 다운로드 → 오른쪽 클릭 → "압축 풀기". **압축 푼 폴더를 열어보면, 폴더가 한 겹 더 있지 않고 바로 `SOW_구조설계.md`, `content`, `app`, `sow` 같은 파일/폴더가 보여야 정상이에요** (v3.5부터 구조가 이렇게 바뀌었어요). 이 폴더 창은 잠시 그대로 열어두세요 — 곧 여기서 파일을 복사할 거예요.

### 1단계. GitHub Desktop 설치 & 로그인

1. https://desktop.github.com 접속 → 다운로드 → 설치 후 실행
2. 처음 열리면 로그인 화면이 뜸 → **"Sign in to GitHub.com"** 클릭 → 브라우저가 열리면서 GitHub 로그인 → 권한 허용(Authorize) → GitHub Desktop으로 자동 복귀

### 2단계. 저장소 Clone(내려받기)

> 저장소가 비어있어서 위 "준비물"에서 안내한 **"Set up in Desktop" 버튼을 이미 누르셨다면 이 단계는 건너뛰고 3단계로 가세요.**

1. 상단 메뉴바에서 **File → Clone repository...** 클릭 (윈도우는 Ctrl+Shift+O, 맥은 Cmd+Shift+O로도 열려요)
2. 창이 뜨면 위에 탭 3개(GitHub.com / URL / Local)가 보여요 — **"GitHub.com"** 탭 선택
3. 목록에서 **`sowbible/seed-of-word-v2`** 를 찾아서 클릭 (검색창에 `seed-of-word-v2` 쳐도 됨)
   - 안 보이면 URL 탭으로 바꿔서 `https://github.com/sowbible/seed-of-word-v2.git` 직접 붙여넣기
4. 창 아래쪽 **"Local Path"** 항목에 이 저장소가 저장될 컴퓨터 위치가 나와요(기본값 그대로 둬도 됨) — 바꾸고 싶으면 **"Choose..."** 버튼으로 원하는 폴더 선택
5. 오른쪽 아래 **파란색 "Clone"** 버튼 클릭
6. 진행바가 다 채워질 때까지 몇 초~몇십 초 대기

### 3단계. 방금 받은 저장소 폴더 열기

1. Clone이 끝나면 GitHub Desktop 화면 상단에 저장소 이름(`seed-of-word-v2`)이 보여요
2. 메뉴바 **Repository → Show in Explorer**(윈도우) 또는 **Show in Finder**(맥) 클릭
   → 이 저장소가 실제로 저장된 폴더가 새 창으로 열려요
3. 열어보면 안에 레거시 파일들(`sow/`, `scripts/` 등 기존 것들)이 이미 들어있을 거예요 — 그대로 두세요, 지금 지우는 거 아니에요

### 4단계. 파일 복사해서 덮어쓰기 (이 단계가 핵심!)

지금 두 개의 창이 열려 있어야 해요:
- **창 A**: 아까 압축 풀어둔 폴더 (`sow-app-v4.6` 등)
- **창 B**: 방금 3단계에서 연 저장소 폴더 (`seed-of-word-v2`)

1. **창 A**(압축 푼 폴더)로 가서, 안의 내용을 전체 선택: 폴더 안 빈 곳을 한 번 클릭한 뒤 **Ctrl+A**(윈도우) / **Cmd+A**(맥) — `SOW_구조설계.md`, `content`, `app`, `sow`, `README.md` 등 전부 파란색으로 선택됨
2. 그 상태에서 **Ctrl+C**(윈도우) / **Cmd+C**(맥) — 복사
3. **창 B**(저장소 폴더)로 이동해서, 폴더 안 빈 곳을 클릭한 뒤 **Ctrl+V**(윈도우) / **Cmd+V**(맥) — 붙여넣기
4. **"이미 있는 파일을 바꾸시겠습니까?"** 같은 확인 창이 뜨면(저장소가 비어있었다면 이 창 자체가 안 뜨고 바로 복사돼요 — 정상입니다):
   - 윈도우: **"파일 및 폴더 바꾸기"** 또는 **"두 폴더의 내용 병합"** 선택
   - 맥: **"Replace"** 또는 **"Merge"** 선택
   - 둘 다 선택 가능하면 **"모두 적용"/"Apply to all"** 체크박스도 함께 체크해서 한 번에 처리
5. 복사가 끝날 때까지 기다리기 (파일 개수가 꽤 있어서 몇 초 걸려요)

> 💡 이렇게 하면 `SOW_구조설계.md`처럼 이름이 같은 파일은 새 내용으로 바뀌고, `content/`, `app/`, `sow/`처럼 새로 생긴 폴더는 그대로 추가돼요. 기존에 있던 레거시 파일(겹치지 않는 것들)은 안 건드려지고 그대로 남아요.

### 5단계. GitHub Desktop으로 돌아가서 확인

1. GitHub Desktop 창으로 다시 전환 (Alt+Tab 또는 Dock에서 클릭)
2. 왼쪽에 **"Changes"** 탭에 방금 복사한 파일들이 쭉 나열되는 걸 확인 — 파일 개수가 꽤 많을 거예요(수십 개), 정상이에요
3. 하나씩 눌러보면 오른쪽에 어떤 내용이 바뀌었는지(초록색=추가, 빨간색=삭제) 미리 볼 수 있어요 — 안 눌러봐도 괜찮아요

### 6단계. 커밋(저장)

1. 왼쪽 아래 **"Summary (required)"** 칸에 짧은 설명 입력 — 예: `SOW v4.6 - 나의/우리의 성경읽기 + Supabase 가이드 추가`
2. 그 아래 **"Description"** 칸은 비워둬도 됨
3. 파란색 **"Commit to main"** 버튼 클릭

### 7단계. 업로드(Push)

1. 커밋 후 상단 중앙에 **"Push origin"** 버튼이 나타남 (숫자가 같이 표시될 수도 있음, 예: "Push origin 1")
2. 클릭 → 업로드 진행 → 완료

### 8단계. 확인

브라우저에서 `https://github.com/sowbible/seed-of-word-v2` 접속 후 새로고침 — `SOW_구조설계.md` 같은 파일들이 저장소에 올라가 있으면 성공이에요.

---

## 방법 B. 터미널 (git 명령어)

```bash
# 1. 기존 저장소를 원하는 위치에 내려받기
git clone https://github.com/sowbible/seed-of-word-v2.git
cd seed-of-word-v2

# 2. main에 바로 올리지 않고 작업 브랜치 만들기 (DEPLOY.md 5절 규칙)
git checkout -b sow-structure-v2

# 3. 지금까지 받은 sow-app 폴더 내용을 이 저장소 폴더 안으로 복사
#    (예: 다운로드 폴더에 있는 sow-app을 복사하는 경우)
cp -r ~/Downloads/sow-app/* .

# 4. 바뀐 내용 확인
git status

# 5. 커밋
git add .
git commit -m "SOW 구조 v2.0 + CONTENT_GUIDE/DEPLOY 문서 추가"

# 6. GitHub로 올리기
git push origin sow-structure-v2
```

이후 GitHub 웹사이트에서 방금 올라간 브랜치로 **Pull Request(PR)** 를 열고, 내용을 확인한 뒤 `main`에 병합(Merge)한다. `main`에 병합되는 순간 `DEPLOY.md`에서 설정한 GitHub Pages가 자동으로 재배포된다.

---

## 주의사항 — 레거시 파일과 겹칠 때

기존 저장소에 `SEED-OF-WORD-main` 구조(예: `sow/john/1/index.html` 같은 레거시 통짜 페이지)가 이미 들어있다면, 새 파일을 그냥 덮어쓰지 말고:

1. 새 폴더/파일(`content/`, `app/`, `SOW_구조설계.md`, `CONTENT_GUIDE.md`, `DEPLOY.md`)은 저장소 루트에 그대로 추가
2. 기존 레거시 `sow/` 폴더 안의 예전 페이지들(`sow/john/...`)은 지우지 말고 그대로 둔 채, `DEPLOY.md` 1절에서 제안한 대로 **별도 브랜치(`legacy-archive`)로 옮겨서 보관**하는 걸 권장 — 실수로 새 구조와 뒤섞이는 걸 막아줌
   - 참고: 우리 새 구조의 `sow/read/index.html`은 레거시의 `sow/john/...`과 **같은 `sow/` 폴더 밑이지만 다른 하위 폴더(`read/`)**라서, 4단계에서 복사해도 파일이 겹쳐 덮어써지는 일은 없어요. 다만 둘 다 `sow/` 폴더 안에 섞여 있는 게 헷갈리면, 위 권장대로 레거시는 별도 브랜치로 옮기는 걸 추천해요.
3. 확실하지 않으면 일단 다 커밋해서 PR로 올린 뒤, PR 화면에서 무엇이 바뀌는지 눈으로 확인하고 병합하는 게 안전하다 (되돌리기도 쉬움)

---

## 이후 업데이트하는 법 (파일이 바뀔 때마다)

처음엔 저장소가 비어있어서 "Clone"부터 했지만, **한 번 clone해두면 그 다음부터는 훨씬 짧아요.** 새 버전 zip을 받을 때마다 이 순서만 반복하시면 돼요.

1. 새 zip 파일(예: `sow-app-v5.0.zip`) 다운로드 → 압축 풀기
2. GitHub Desktop 실행 → 왼쪽 위 저장소 이름이 `seed-of-word-v2`인지 확인
3. 메뉴바 **Repository → Show in Explorer**(윈도우) / **Show in Finder**(맥) 클릭 → 예전에 clone했던 그 폴더가 열림 (이번엔 안이 비어있지 않고 지난번에 올린 파일들이 이미 들어있을 거예요)
4. **창 2개 나란히 놓기**: 방금 연 저장소 폴더(창 B) + 새로 압축 푼 폴더(창 A)
5. 창 A에서 전체 선택(Ctrl+A) → 복사(Ctrl+C)
6. 창 B(저장소 폴더)에 붙여넣기(Ctrl+V)
7. 이번엔 **"이미 있는 파일을 바꾸시겠습니까?"** 확인창이 뜰 거예요 (지난번과 달리 이번엔 파일이 이미 있어서) → **"파일 및 폴더 바꾸기"**(윈도우) / **"Replace"**(맥) 선택, 가능하면 "모두 적용" 체크
8. GitHub Desktop으로 돌아오면 왼쪽 **"Changes"** 탭에 **바뀐 파일만** 나열됨 (예: `app/js/supabase-client.js` 같은 신규 파일, `SOW_구조설계.md` 같은 수정된 파일) — 안 바뀐 파일은 목록에 안 뜨는 게 정상이에요
9. **Summary** 칸에 메시지 입력 — 예: `SOW v5.0 - Supabase 연동 (로그인, entries 저장)`
10. **"Commit to main"** 클릭
11. 이번엔 버튼이 "Publish branch"가 아니라 **"Push origin"**으로 뜰 거예요 (이미 한 번 올렸던 저장소라서) → 클릭
12. `https://github.com/sowbible/seed-of-word-v2` 새로고침해서 확인 — 왼쪽 "N Commits" 숫자가 늘어나 있으면 성공

> 💾 참고: 압축 풀어둔 예전 버전 폴더(`sow-app-v4.6` 등)는 이제 지우셔도 돼요 — GitHub에 커밋 이력으로 다 남아있어서, git에 익숙해지면 나중에 언제든 "그때 버전"으로 되돌아볼 수 있어요.

---

## 다음 단계

- [x] 저장소 주소 확정: `sowbible/seed-of-word-v2`
- [ ] 저장소에 올린 뒤 `DEPLOY.md`대로 GitHub Pages + `seedofword.org` 도메인 연결 진행
