# Netlify 배포 가이드

GitHub 저장소는 **Private로 그대로 유지**하면서, Netlify가 그 저장소를 읽어가서 무료로 웹사이트를 만들어줘요. `DEPLOY.md`(GitHub Pages 방식) 대신 이 문서대로 하시면 됩니다 — 둘 중 하나만 하시면 돼요.

## 왜 Netlify인가

- **Private 저장소도 무료로 배포 가능** — GitHub Pages와 다르게 Public으로 안 바꿔도 돼요
- **HTTPS 자동 적용** — PWA(홈 화면 설치 기능)가 완전하게 동작하려면 HTTPS가 필요한데, Netlify는 이걸 자동으로 해줘요(Let's Encrypt 인증서, 설정 필요 없음)
- **자동 재배포** — 이후 GitHub에 새 커밋을 Push할 때마다 Netlify가 자동으로 감지해서 몇 초 안에 사이트를 새로 고쳐줘요. GitHub Pages처럼 Settings에서 매번 확인 안 해도 돼요
- **빌드 과정 없음** — 우리 사이트는 순수 HTML/CSS/JS라 별도 빌드가 필요 없어서 설정이 아주 단순해요

---

## 1단계. Netlify 가입

1. https://www.netlify.com 접속
2. 오른쪽 위 **"Sign up"** 클릭
3. **"GitHub"** 로 가입 선택 (지금 쓰시는 `sowbible` 계정으로)
4. GitHub 인증 화면 → **"Authorize netlify"** 클릭

## 2단계. 사이트 만들기 (저장소 연결)

1. Netlify 대시보드에서 **"Add new site"** 버튼 클릭 → 드롭다운에서 **"Import an existing project"** 선택
2. **"Deploy with GitHub"** 클릭
3. 저장소 접근 권한 요청 화면이 뜨면:
   - **"Only select repositories"** 선택 → 검색창에 `seed-of-word-v2` 입력 → 체크
   - (또는 "All repositories" 선택해도 되지만, 필요한 것만 주는 게 더 안전해요)
   - **"Install"** 또는 **"Save"** 클릭
4. 저장소 목록이 뜨면 **`sowbible/seed-of-word-v2`** 클릭

## 3단계. 배포 설정 (그대로 두면 됨)

설정 화면이 뜨는데, 우리 사이트는 빌드 과정이 없는 순수 정적 사이트라 아래처럼만 확인하세요:

- **Branch to deploy**: `main` (기본값 그대로)
- **Base directory**: 비워두기 (기본값 그대로)
- **Build command**: 비워두기 (아무것도 입력 안 함)
- **Publish directory**: `.` 또는 비워두기 (저장소 루트를 그대로 배포)

다 확인했으면 **"Deploy [저장소명]"** (파란색/초록색 버튼) 클릭

## 4단계. 배포 완료 확인

1. 1~2분 정도 "Building" → "Deploying" 상태가 진행돼요
2. "Published" 로 바뀌면 완료
3. 화면 위쪽에 **랜덤 주소**가 하나 생겨요 (예: `https://cheerful-druid-abc123.netlify.app`) — 클릭해서 열어보세요
4. 자동으로 성경묵상 화면이 뜨면 성공이에요! (루트 `index.html`이 `sow/read/index.html`로 이동시켜줌)

## 5단계. 사이트 이름 예쁘게 바꾸기 (선택)

랜덤 주소 대신 `seedofword.netlify.app` 같은 이름으로 바꿀 수 있어요:

1. Netlify 대시보드 → 방금 만든 사이트 클릭
2. **Site configuration → Site details** (또는 **"Change site name"** 버튼)
3. 원하는 이름 입력 (예: `seedofword`) → Save

## 6단계. 나중에 커스텀 도메인(seedofword.org) 연결하기

지금 당장 안 하셔도 되고, 준비되면:

1. Netlify 사이트 화면 → **Domain management** (또는 **"Add a domain"**)
2. **"Add a domain"** → `seedofword.org` 입력
3. 안내에 따라 도메인 등록업체(가비아 등)의 DNS 설정에 Netlify가 알려주는 레코드 추가
   - 보통 `A` 레코드를 Netlify의 로드밸런서 IP로, 또는 Netlify 네임서버로 통째로 위임하는 방식 중 선택 가능
4. DNS 반영까지 몇 시간 걸릴 수 있음, 완료되면 HTTPS도 자동으로 붙음

---

## 이후 업데이트하는 법 — 이제는 아무것도 안 해도 됨

`GITHUB_CONNECT.md`의 "이후 업데이트하는 법"대로 GitHub에 새 커밋을 **Push**하기만 하면 끝이에요. Netlify가 자동으로 감지해서 몇 초~1분 안에 사이트를 새로 고쳐줘요. GitHub Pages처럼 Settings에 따로 들어갈 필요가 없어요.

## 참고 — 무료 요금제 한도

월 100GB 트래픽, 월 300분 빌드 시간(우리는 빌드가 없어서 거의 안 씀) — 개인/가족/소그룹 규모엔 충분히 넉넉해요.
