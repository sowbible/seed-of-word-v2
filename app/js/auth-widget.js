/* =========================================================
   SOW Auth Widget — 이메일 매직링크 로그인 UI
   상단 네비 바로 아래에 붙는다. 로그인 전엔 이메일 입력창,
   로그인 후엔 "OO님 · 로그아웃"으로 바뀐다.
   ========================================================= */
(function(){
  function render(container){
    async function draw(){
      const session = window.SOWAuth ? await window.SOWAuth.getSession() : null;
      if(session && session.user){
        container.innerHTML = `<div class="sow-auth-bar">
          <span class="sow-auth-user">👤 ${session.user.email}</span>
          <button type="button" class="sow-auth-btn" data-act="logout">로그아웃</button>
        </div>`;
        container.querySelector('[data-act="logout"]').onclick = () => window.SOWAuth.signOut();
      } else {
        container.innerHTML = `<div class="sow-auth-bar">
          <input type="email" class="sow-auth-email" placeholder="이메일로 로그인 (기록을 서버에 저장하려면)">
          <button type="button" class="sow-auth-btn" data-act="login">로그인 링크 받기</button>
          <span class="sow-auth-msg"></span>
        </div>`;
        const emailInput = container.querySelector('.sow-auth-email');
        const msg = container.querySelector('.sow-auth-msg');
        const submit = async () => {
          const email = emailInput.value.trim();
          if(!email){ msg.textContent = '이메일을 입력해주세요'; return; }
          if(!window.SOWAuth){ msg.textContent = '로그인 기능을 불러오지 못했어요'; return; }
          msg.textContent = '보내는 중…';
          const { error } = await window.SOWAuth.signInWithEmail(email);
          msg.textContent = error ? ('오류: ' + error.message) : '메일함을 확인해주세요 📩 (스팸함도 확인)';
        };
        container.querySelector('[data-act="login"]').onclick = submit;
        emailInput.onkeydown = (e) => { if(e.key === 'Enter'){ e.preventDefault(); submit(); } };
      }
    }
    draw();
    document.addEventListener('sow:auth-changed', draw);
  }

  window.SOWAuthWidget = { render };
})();
