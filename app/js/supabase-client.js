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
})();
