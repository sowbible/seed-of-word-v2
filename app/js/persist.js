/* =========================================================
   SOW Persist — 입력창 자동 저장 + 초기화 + 즉시 저장(flush)
   콘텐츠 JSON은 손대지 않고, 렌더러가 붙여준 data-persist-key
   속성만 보고 동작한다 (voice-text-input.js와 같은 방식).

   v2(2026-08-29): "💾 저장" 버튼(session-toolbar.js)이 즉시 저장을
   요청할 수 있도록 flush()를 추가. 저장이 실제로 일어날 때마다
   window.SOWActivityLog.markToday()를 호출해서 달력에 반영한다.
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

  function enhance(el){
    if(!el || el.dataset.sowPersistEnhanced === '1') return;
    const key = el.dataset.persistKey;
    if(!key) return;
    el.dataset.sowPersistEnhanced = '1';
    const storeKey = 'sow.field.' + key;

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
        // key 형식: {moduleId}:{trackId}:{book}:{step}:{fieldId} — 성경묵상 기록이면
        // 그날 걸음(책/장/코스)까지 활동 로그에 남겨서, 달력에서 그 날짜를 누르면
        // 바로 그 걸음으로 이동할 수 있게 한다.
        const parts = key.split(':');
        if(parts.length >= 4 && parts[0] === 'meditation'){
          window.SOWActivityLog?.markToday({ trackId: parts[1], book: parts[2], step: parts[3] });
        } else {
          window.SOWActivityLog?.markToday();
        }
        // 성경지도(reading-map.js)가 "지금 화면에 뜬 실제 장이 방금 저장됐다"는 걸 알 수 있게 신호만 보낸다.
        // 어떤 장인지는 각 렌더러가 미리 SOWReadingMap.setCurrentChapters()로 등록해둔다.
        document.dispatchEvent(new CustomEvent('sow:saved'));
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
