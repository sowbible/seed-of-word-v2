/* =========================================================
   SOW Persist — 입력창 자동 저장 + 초기화 + 즉시 저장(flush)
   콘텐츠 JSON은 손대지 않고, 렌더러가 붙여준 data-persist-key
   속성만 보고 동작한다 (voice-text-input.js와 같은 방식).

   v2(2026-08-29): "💾 저장" 버튼(session-toolbar.js)이 즉시 저장을
   요청할 수 있도록 flush()를 추가. 저장이 실제로 일어날 때마다
   window.SOWActivityLog.markToday()를 호출해서 달력에 반영한다.

   v3: 저장 키가 어떤 "종류"(묵상/글쓰기)인지 구분해서 markToday에
   함께 넘기도록 확장 — 달력에서 종류별 아이콘을 보여주기 위함.
   글쓰기(korean:{book}:{step}:writing)도 이제 Supabase entries에
   동기화된다 — 예전엔 묵상(5토막 키)만 대상이라 빠져 있었다.
   ========================================================= */
(function(){
  const registry = [];

  function debounce(fn, wait){
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };
  }

  function statusText(savedAt){
    const d = new Date(savedAt);
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    return `💾 저장됨 · ${hh}:${mm}`;
  }

  function readSaved(storeKey){
    try{
      const raw = localStorage.getItem(storeKey);
      return raw ? JSON.parse(raw) : null;
    }catch(_){ return null; }
  }

  /* 저장 키를 보고 "이게 뭔지"(종류 + Supabase에 보낼 때 쓸 parts)를 판단한다.
     - 묵상: meditation:{trackId}:{book}:{step}:{promptId} (5토막)
     - 글쓰기: korean:{book}:{step}:writing (4토막, 마지막이 'writing') */
  function classifyKey(key){
    const parts = key.split(':');
    if(parts[0] === 'meditation' && parts.length >= 5){
      return { type: 'meditation', trackId: parts[1], book: parts[2], step: parts[3], syncParts: parts };
    }
    if(parts[0] === 'korean' && parts.length === 4 && parts[3] === 'writing'){
      return { type: 'writing', trackId: null, book: parts[1], step: parts[2], syncParts: ['korean', 'writing', parts[1], parts[2], 'writing'] };
    }
    return { type: null, trackId: null, book: null, step: null, syncParts: null };
  }

  function enhance(el){
    if(!el || el.dataset.sowPersistEnhanced === '1') return;
    const key = el.dataset.persistKey;
    if(!key) return;
    el.dataset.sowPersistEnhanced = '1';
    const storeKey = 'sow.field.' + key;
    const info = classifyKey(key);

    const saved = readSaved(storeKey);
    if(saved && saved.value && !el.value) el.value = saved.value;

    const bar = document.createElement('div');
    bar.className = 'sow-persist-bar';
    const status = document.createElement('span');
    status.className = 'sow-persist-status';
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'sow-persist-reset';
    resetBtn.textContent = '↺ 초기화';
    bar.appendChild(status);
    bar.appendChild(resetBtn);

    const anchor = el.closest('.sow-voice-field-wrap') || el;
    anchor.insertAdjacentElement('afterend', bar);

    function refresh(){
      const s = readSaved(storeKey);
      status.textContent = (s && s.value) ? statusText(s.savedAt) : '';
    }
    refresh();

    function writeNow(){
      try{
        localStorage.setItem(storeKey, JSON.stringify({ value: el.value, savedAt: Date.now() }));
      }catch(_){}
      refresh();
      if(el.value && el.value.trim()){
        // 로컬 달력용 활동 로그 — 묵상/글쓰기 둘 다 종류(type)를 같이 남긴다.
        // book/step이 있으면(묵상/글쓰기 둘 다 있음) 달력에서 그 걸음으로 이동 가능.
        if(info.type){
          window.SOWActivityLog?.markToday({ type: info.type, trackId: info.trackId, book: info.book, step: info.step });
        } else {
          window.SOWActivityLog?.markToday();
        }
        // 성경지도(reading-map.js)가 "지금 화면에 뜬 실제 장이 방금 저장됐다"는 걸 알 수 있게 신호만 보낸다.
        document.dispatchEvent(new CustomEvent('sow:saved'));
        // 로그인 상태면 Supabase(entries)에도 같이 저장 — 묵상 + 글쓰기 둘 다.
        // 로그인 안 했으면 SOWSyncEntry 내부에서 조용히 스킵.
        if(info.syncParts && window.SOWSyncEntry){
          let shareable = false;
          try{ shareable = localStorage.getItem('sow.share.' + key) === '1'; }catch(_){}
          window.SOWSyncEntry(info.syncParts, el.value, shareable);
        }
      }
    }
    const debouncedWrite = debounce(writeNow, 500);
    el.addEventListener('input', debouncedWrite);

    resetBtn.addEventListener('click', () => {
      el.value = '';
      try{ localStorage.removeItem(storeKey); }catch(_){}
      refresh();
      el.dispatchEvent(new Event('input', { bubbles: true }));
      try{ el.focus(); }catch(_){}
    });

    registry.push({ el, writeNow });
  }

  function scan(root = document){
    root.querySelectorAll?.('[data-persist-key]').forEach(enhance);
  }

  /* 지금 화면의 모든 입력을 디바운스 없이 즉시 저장. 저장된 개수를 반환한다. */
  function flush(){
    let count = 0;
    registry.forEach(item => {
      if(document.contains(item.el) && item.el.value && item.el.value.trim()){
        item.writeNow();
        count++;
      }
    });
    if(count > 0) window.SOWActivityLog?.markToday();
    return count;
  }

  document.addEventListener('DOMContentLoaded', () => scan());
  if(document.readyState !== 'loading'){ scan(); }

  window.SOWPersist = { scan, flush };
})();
