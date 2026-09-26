/* =========================================================
   SOW Supabase Client — 프로젝트 연결 + 로그인 상태 관리
   (SUPABASE_SETUP.md 참고)

   이 파일은 supabase-js(CDN)가 먼저 로드된 뒤에 실행돼야 한다.
   로그인은 이메일 매직링크 방식 — 비밀번호 없이 메일의 링크만 누르면 로그인된다.
   ========================================================= */
(function(){
  const SUPABASE_URL = 'https://hzjfwqawdncdjtezcooa.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_pL4PTpJrSLn8D9RuHhoUDA_CR7nFEIO';

  if(!window.supabase || !window.supabase.createClient){
    console.error('[SOW] supabase-js 라이브러리가 로드되지 않았습니다. index.html의 CDN 스크립트 태그를 확인하세요.');
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  window.SOWSupabase = client;

  // 로그인/로그아웃이 일어날 때마다 화면(auth-widget.js 등)에 알려준다.
  client.auth.onAuthStateChange((_event, session) => {
    document.dispatchEvent(new CustomEvent('sow:auth-changed', { detail: { session } }));
  });

  window.SOWAuth = {
    getSession: async () => (await client.auth.getSession()).data.session,
    /* 이메일 매직링크 발송. 링크를 누르면 지금 이 페이지로 돌아오면서 자동 로그인된다. */
    signInWithEmail: (email) => client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin + location.pathname }
    }),
    /* 구글 로그인 — 클릭하면 구글 로그인 화면으로 이동했다가, 승인하면 이 페이지로 돌아오면서 자동 로그인된다.
       이메일 발송이 없어서 매직링크의 "시간당 발송 제한"과 전혀 무관하다. */
    signInWithGoogle: () => client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname }
    }),
    signOut: () => client.auth.signOut()
  };

  /* 묵상 기록 하나를 서버에 저장(upsert) — 로그인 상태일 때만 동작.
     parts: [moduleId, trackId, book, step, promptId] (persist.js의 저장 키를 그대로 쪼갠 것) */
  window.SOWSyncEntry = async function(parts, value, shareable){
    try{
      const session = await window.SOWAuth.getSession();
      if(!session || !session.user) return; // 로그인 안 했으면 조용히 스킵 (로컬 저장은 이미 됨)
      const [moduleId, trackId, book, step, promptId] = parts;
      const { error } = await client.from('entries').upsert({
        user_id: session.user.id,
        module: moduleId,
        track_id: trackId,
        book,
        step,
        prompt_id: promptId,
        value,
        shareable: !!shareable,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,module,track_id,book,step,prompt_id' });
      if(error) console.error('[SOW] Supabase 저장 실패:', error.message);
    }catch(e){
      console.error('[SOW] Supabase 동기화 중 오류:', e);
    }
  };

  /* ---------- 활동 로그: 어휘/한자/언어/글쓰기 "완료" 이벤트 하나 남기기 ----------
     묵상처럼 텍스트 전문이 필요 없는, "오늘 이 활동을 했다"는 사실만 기록한다.
     하루에 같은 type은 한 줄만 남도록 (user_id, date, type) 유니크 제약으로 upsert —
     여러 번 다시 풀어도 그날 이모지가 중복되지 않는다.
     type: 'vocab' | 'hanja' | 'language' | 'writing' */
  window.SOWLogActivity = async function(type, book, step){
    try{
      const session = await window.SOWAuth.getSession();
      if(!session || !session.user) return; // 로그인 안 했으면 조용히 스킵
      const today = new Date().toISOString().slice(0, 10); // 기기 로컬 기준 YYYY-MM-DD
      const { error } = await client.from('activity_log').upsert({
        user_id: session.user.id,
        date: today,
        type,
        book: book || null,
        step: (step === undefined || step === null) ? null : step
      }, { onConflict: 'user_id,date,type' });
      if(error) console.error('[SOW] 활동 로그 저장 실패:', error.message);
    }catch(e){
      console.error('[SOW] 활동 로그 기록 중 오류:', e);
    }
  };

  /* ---------- 달력 화면용: 이번 달(또는 지정 범위) 기록을 한 번에 불러오기 ----------
     묵상(entries, value가 있는 것)과 활동 로그(activity_log)를 합쳐서
     날짜별로 묶어 돌려준다. SOWSessionToolbar 같은 달력 렌더러가 이걸 불러 쓰면 된다.
     반환 형태: { "2026-09-20": { journalEntries: [...], activities: ["vocab","hanja"] }, ... } */
  window.SOWFetchCalendarData = async function(startDate, endDate){
    const session = await window.SOWAuth.getSession();
    if(!session || !session.user) return {};

    const [{ data: entries, error: e1 }, { data: acts, error: e2 }] = await Promise.all([
      client.from('entries')
        .select('book, step, prompt_id, value, created_at')
        .eq('user_id', session.user.id)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('value', 'is', null),
      client.from('activity_log')
        .select('date, type, book, step')
        .eq('user_id', session.user.id)
        .gte('date', startDate)
        .lte('date', endDate)
    ]);
    if(e1) console.error('[SOW] entries 조회 실패:', e1.message);
    if(e2) console.error('[SOW] activity_log 조회 실패:', e2.message);

    const byDate = {};
    function bucket(dateStr){
      if(!byDate[dateStr]) byDate[dateStr] = { journalEntries: [], activities: [] };
      return byDate[dateStr];
    }
    (entries || []).forEach(row => {
      const d = row.created_at.slice(0, 10);
      bucket(d).journalEntries.push(row);
    });
    (acts || []).forEach(row => {
      bucket(row.date).activities.push(row.type);
    });
    return byDate;
  };
})();
