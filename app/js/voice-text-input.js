/* =========================================================
   SOW VoiceTextInput — 공용 음성 입력 컴포넌트
   기존 SEED-OF-WORD-main v107c의 검증된 로직(자동 스캔 + Web
   Speech API + MutationObserver)을 그대로 가져오되, 하드코딩된
   CSS 셀렉터 목록 대신 콘텐츠 스키마의 input.voiceInput=true
   플래그로 렌더링된 data-voice="1" 속성을 기준으로 동작하도록
   일반화했다. (SOW_구조설계.md 5절 참고)

   사용법:
   1) 렌더러가 프롬프트를 그릴 때, input.voiceInput===true인
      필드에 data-voice="1"을 붙여서 <textarea>/<input>을 만든다.
   2) 이 스크립트를 셸에 한 번 로드하면 끝. 별도 초기화 호출 불요
      (DOMContentLoaded + MutationObserver가 알아서 스캔한다).
   3) 동적으로 새 패널을 그린 직후 확실히 하고 싶다면
      window.SOWVoiceInput.scan(root) 을 수동 호출해도 된다.
   ========================================================= */
(function(){
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let activeRecognition = null;
  let activeButton = null;
  let starting = false;

  function eligible(el){
    if(!el || el.dataset.sowVoiceEnhanced === '1') return false;
    return el.dataset.voice === '1';
  }

  function setBtnIdle(btn, used){
    if(!btn) return;
    btn.classList.remove('listening');
    btn.textContent = used ? '🎙️ 다시 말하기' : '🎙️ 말하기';
  }

  function stopActive(){
    if(activeRecognition){
      try{
        activeRecognition.onend = null;
        activeRecognition.onerror = null;
        activeRecognition.onresult = null;
        activeRecognition.stop();
      }catch(e){}
      activeRecognition = null;
    }
    if(activeButton){ setBtnIdle(activeButton, true); activeButton = null; }
  }

  function enhance(el){
    if(!eligible(el)) return;
    el.dataset.sowVoiceEnhanced = '1';

    const wrap = document.createElement('div');
    wrap.className = 'sow-voice-field-wrap';
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(el);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sow-voice-btn';
    btn.textContent = '🎙️ 말하기';
    wrap.appendChild(btn);

    if(!SpeechRecognition){
      btn.disabled = true;
      btn.textContent = '🎙️ 미지원';
      const note = document.createElement('div');
      note.className = 'sow-voice-unsupported';
      note.textContent = '이 브라우저는 음성 입력을 지원하지 않아요. Chrome 등 지원 브라우저를 사용해 주세요.';
      wrap.appendChild(note);
      return;
    }

    btn.addEventListener('click', () => {
      if(starting) return;
      if(activeRecognition){
        const same = activeButton === btn;
        stopActive();
        if(same) return;
      }
      starting = true;
      const rec = new SpeechRecognition();
      activeRecognition = rec;
      activeButton = btn;
      rec.lang = el.dataset.voiceLang || 'ko-KR';
      rec.interimResults = true;
      rec.continuous = false;

      const original = el.value;
      const base = original.replace(/\s+$/, '');
      btn.classList.add('listening');
      btn.textContent = '듣는 중…';

      rec.onresult = (e) => {
        let finalText = '', interim = '';
        for(let i = e.resultIndex; i < e.results.length; i++){
          const text = e.results[i][0].transcript;
          if(e.results[i].isFinal) finalText += text; else interim += text;
        }
        const spoken = (finalText || interim).trim();
        if(!spoken) return;
        el.value = base ? (base + (/[\s\n]$/.test(base) ? '' : ' ') + spoken) : spoken;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };

      rec.onerror = (ev) => {
        if(ev.error === 'not-allowed' || ev.error === 'service-not-allowed'){
          let note = wrap.querySelector('.sow-voice-unsupported');
          if(!note){
            note = document.createElement('div');
            note.className = 'sow-voice-unsupported';
            wrap.appendChild(note);
          }
          note.textContent = '마이크 사용이 허용되지 않았어요. 브라우저 설정에서 마이크를 허용해 주세요.';
        }
      };

      rec.onend = () => {
        setBtnIdle(btn, true);
        if(activeRecognition === rec){ activeRecognition = null; activeButton = null; }
        starting = false;
        try{ el.focus(); }catch(e){}
      };

      try{ rec.start(); }
      catch(e){ starting = false; setBtnIdle(btn, false); activeRecognition = null; activeButton = null; }
      starting = false;
    });
  }

  function scan(root = document){
    root.querySelectorAll?.('textarea[data-voice="1"], input[data-voice="1"]').forEach(enhance);
  }

  document.addEventListener('DOMContentLoaded', () => {
    scan();
    new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(n => {
      if(n.nodeType !== 1) return;
      if(n.matches?.('textarea[data-voice="1"], input[data-voice="1"]')) enhance(n);
      scan(n);
    }))).observe(document.body, { childList: true, subtree: true });
  });
  if(document.readyState !== 'loading'){ scan(); }

  window.SOWVoiceInput = { scan, stopActive };
})();
