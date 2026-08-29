# Supabase 연동 가이드

지금까지 만든 기록(묵상 4문항, 저장 달력, 성경지도, 그룹 공유)은 전부 이 브라우저의 `localStorage`에만 있어요. 다른 기기에서 열면 안 보이고, 그룹원끼리 서로 볼 수도 없어요. **이 문서대로 하면 실제 서버(Supabase)에 기록이 남게 돼요.**

이 문서는 사용자님이 직접 하실 부분(프로젝트 만들기, SQL 실행)까지만 다뤄요. 그다음 실제 앱 코드를 서버에 연결하는 건, 여기서 나온 정보(프로젝트 URL + anon key)를 저한테 알려주시면 제가 이어서 만들어드릴게요.

---

## 왜 Supabase인가

- 무료로 시작 가능 (개인 프로젝트 규모엔 충분)
- 이메일 로그인(매직링크)이 기본 내장 — 회원가입/비밀번호 로직을 직접 안 만들어도 됨
- 데이터베이스가 그냥 PostgreSQL이라, 나중에 다른 곳으로 옮기기도 쉬움
- `GROUP_SHARING_DESIGN.md`에서 이미 이 구조를 전제로 설계해뒀음 (이메일 초대 = Supabase Auth와 정확히 맞음)

---

## 1단계. Supabase 프로젝트 만들기

1. https://supabase.com 접속 → **"Start your project"** 클릭
2. GitHub 계정으로 로그인 (이미 `sowbible` 계정으로 GitHub 쓰고 계시니 그걸로 로그인하시면 편해요)
3. **"New project"** 클릭
4. 프로젝트 이름(예: `seed-of-word`), 데이터베이스 비밀번호(자동 생성 추천, 어딘가 저장해두기), 지역(Region은 **Northeast Asia (Seoul)** 선택 — 한국에서 제일 빠름)
5. **"Create new project"** — 1~2분 정도 프로비저닝 기다리기

## 2단계. 프로젝트 URL + anon key 확인

1. 프로젝트가 만들어지면 왼쪽 메뉴에서 **Settings(⚙️) → API** 클릭
2. 여기 두 개를 복사해서 저한테 알려주세요:
   - **Project URL** (예: `https://abcdefgh.supabase.co`)
   - **anon public** key (긴 문자열, `eyJ...`로 시작)

> ⚠️ **주의**: 같은 화면에 있는 **`service_role`** 키는 **저한테도, 어디에도 절대 공유하지 마세요.** 그건 관리자 권한 키라 노출되면 위험해요. 우리가 쓸 건 `anon public` 키뿐이에요 — 이건 원래 클라이언트(브라우저)에 노출되도록 설계된 키라 괜찮아요.

## 3단계. 이메일 로그인(매직링크) 켜기

1. 왼쪽 메뉴 **Authentication → Providers**
2. **Email**이 기본으로 켜져 있는지 확인 (꺼져있으면 켜기)
3. **Authentication → URL Configuration**에서 **Site URL**을 나중에 배포할 주소(`https://seedofword.org` 등)로 설정 — 지금 로컬 테스트만 할 거면 `http://localhost:8000`도 추가해두면 편해요 (Redirect URLs에 추가)

## 4단계. 테이블 만들기 — 아래 SQL 그대로 실행

왼쪽 메뉴 **SQL Editor → New query**를 열고, 아래 전체를 붙여넣은 뒤 **Run** 누르세요.

```sql
-- ============================================
-- 1. 개인 묵상 기록 (묵상 4문항, 국어 표현하기 등 전부 이 표 하나에)
-- ============================================
create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  module text not null,               -- 'meditation' | 'korean' 등
  track_id text not null,             -- 'elementary' | 'free' | 'daily-chapter' | 'bible-in-a-year'
  book text not null,
  step text not null,                 -- 걸음 번호 / 일차 / 장 번호 (코스마다 의미가 다름)
  chapter int,                        -- 실제 성경 장 번호 — 성경지도에 쓰임 (모든 코스에서 계산 가능)
  prompt_id text not null,
  value text not null,
  shareable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, module, track_id, book, step, prompt_id)
);

alter table entries enable row level security;

create policy "본인 기록만 조회" on entries for select using (auth.uid() = user_id);
create policy "본인 기록만 작성" on entries for insert with check (auth.uid() = user_id);
create policy "본인 기록만 수정" on entries for update using (auth.uid() = user_id);
create policy "본인 기록만 삭제" on entries for delete using (auth.uid() = user_id);

-- 참고: "나의 성경읽기"(달력/성경지도)는 이 entries 표 하나로 다 계산돼요.
-- 별도 표가 필요 없어요 — 날짜별로 묶으면 달력, book+chapter로 묶으면 성경지도가 나와요.

-- ============================================
-- 2. 그룹 (가족 대신 — 여러 개 가능, 이메일 초대)
-- ============================================
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id) not null,
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade not null,
  user_id uuid references auth.users(id),
  email text not null,
  status text not null check (status in ('pending','accepted')) default 'pending',
  role text not null check (role in ('owner','member')) default 'member',
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (group_id, email)
);

alter table groups enable row level security;
alter table group_members enable row level security;

create policy "내가 속한 그룹만 조회" on groups for select using (
  owner_id = auth.uid()
  or exists (select 1 from group_members gm where gm.group_id = groups.id and gm.user_id = auth.uid() and gm.status = 'accepted')
);
create policy "그룹은 본인이 만든 것만 생성" on groups for insert with check (owner_id = auth.uid());

create policy "같은 그룹 멤버십만 조회" on group_members for select using (
  exists (select 1 from group_members gm2 where gm2.group_id = group_members.group_id and gm2.user_id = auth.uid() and gm2.status = 'accepted')
  or user_id = auth.uid()
);
create policy "그룹장만 초대 가능" on group_members for insert with check (
  exists (select 1 from groups g where g.id = group_id and g.owner_id = auth.uid())
);
create policy "본인 초대만 수락 가능" on group_members for update using (user_id = auth.uid());

-- ============================================
-- 3. 찾은 하나님 공유 (기도 제목은 공유 안 함 — GROUP_SHARING_DESIGN.md 0절)
-- ============================================
create table if not exists group_shared_answers (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade not null,
  author_id uuid references auth.users(id) not null,
  book text not null,
  step text not null,
  prompt_id text not null,
  text text not null,
  created_at timestamptz not null default now()
);

alter table group_shared_answers enable row level security;

create policy "그룹 멤버만 조회" on group_shared_answers for select using (
  exists (select 1 from group_members gm where gm.group_id = group_shared_answers.group_id and gm.user_id = auth.uid() and gm.status = 'accepted')
);
create policy "본인 글만 작성" on group_shared_answers for insert with check (author_id = auth.uid());
create policy "본인 글만 삭제(공유 취소)" on group_shared_answers for delete using (author_id = auth.uid());

-- ============================================
-- 4. 축복의 말
-- ============================================
create table if not exists group_blessings (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade not null,
  author_id uuid references auth.users(id) not null,
  target_user_id uuid references auth.users(id), -- null이면 그룹 전체
  text text not null,
  read_by jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table group_blessings enable row level security;

create policy "그룹 멤버만 조회" on group_blessings for select using (
  exists (select 1 from group_members gm where gm.group_id = group_blessings.group_id and gm.user_id = auth.uid() and gm.status = 'accepted')
);
create policy "본인 글만 작성" on group_blessings for insert with check (author_id = auth.uid());
```

실행 후 왼쪽 메뉴 **Table Editor**에서 `entries`, `groups`, `group_members`, `group_shared_answers`, `group_blessings` 5개 표가 보이면 성공이에요.

### 이 SQL이 하는 일 — 짧게 설명
- **`enable row level security` + `create policy`**: Supabase 표는 기본적으로 "만들기만 하면 아무나 다 볼 수 있는" 상태가 아니에요(RLS를 켜면 그렇게 됨) — 위 정책들이 "본인 것만 보고 쓸 수 있다", "그룹 멤버만 그룹 글을 볼 수 있다"를 강제해요. 이게 없으면 다른 사람 기록이 다 보이는 심각한 문제가 생겨요.
- **`entries` 표 하나로 달력+성경지도 다 해결**: 지금 로컬(`sow.activity.dates`, `sow.read.chapters`)에 따로따로 쌓던 걸 서버에서는 `entries` 표 하나에서 계산해서 뽑아낼 수 있어요 (별도 표 불필요).

## 5단계. 여기까지 하셨으면

**저한테 이 두 가지만 알려주세요:**
1. Project URL (`https://xxxx.supabase.co`)
2. anon public key

그러면 제가:
1. `app/js/supabase-client.js` 만들어서 앱에 연결
2. `persist.js`가 저장할 때 `localStorage`뿐 아니라 Supabase `entries` 표에도 같이 쓰도록 수정 (로그인 안 했으면 지금처럼 로컬만 — 로그인하면 서버에도 남는 방식)
3. 이메일 매직링크 로그인 화면 추가
4. "그룹 관리" 탭의 비활성화된 입력창들을 실제로 동작하게 연결

여기까지 되면 다른 기기에서 로그인해도 기록이 그대로 보이고, 그룹 초대도 실제로 작동해요.

## 참고 — 무료 요금제 한도

지금 규모(개인/가족/작은 소그룹용)엔 넉넉해요: 데이터베이스 500MB, 월간 활성 사용자 50,000명, 파일 저장 1GB. 나중에 사용자가 많이 늘어나면 그때 유료 전환을 고려하면 돼요 — 지금 단계에선 신경 안 쓰셔도 됩니다.
