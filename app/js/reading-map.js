/* =========================================================
   SOW Reading Map — "나의 성경읽기 > 성경지도"가 쓰는 데이터 레이어
   실제로 읽은 성경 장(章)을 book별로 누적 기록한다.

   동작 방식:
   1) 각 묵상 렌더러(자유코스/하루한장/1년1독/어린이 코스)는 화면을 그릴 때마다
      "지금 이 화면이 다루는 실제 책/장이 뭔지"를 setCurrentChapters()로 등록해둔다.
   2) persist.js가 뭔가를 저장할 때마다 'sow:saved' 이벤트를 쏜다.
   3) 이 파일이 그 이벤트를 듣고, 등록해둔 책/장을 "읽음"으로 localStorage에 남긴다.

   이렇게 나눈 이유: persist.js는 저장 키(book/step)만 알고, step이 실제
   성경 장과 항상 같지는 않다(예: 어린이 코스는 걸음 번호 ≠ 실제 장 번호).
   그래서 "진짜 몇 장인지"는 각 렌더러가 콘텐츠를 읽고 나서 직접 알려주는 게
   가장 정확하다.
   ========================================================= */
(function(){
  const KEY = 'sow.read.chapters';
  let currentEntries = null; // [{book, chapter}, ...] — 지금 화면이 다루는 실제 장들

  function readMap(){
    try{ return JSON.parse(localStorage.getItem(KEY) || '{}'); }catch(_){ return {}; }
  }
  function writeMap(map){
    try{ localStorage.setItem(KEY, JSON.stringify(map)); }catch(_){}
  }

  /* entries: 단일 {book, chapter} 또는 배열. 1년1독처럼 하루에 여러 장을 다루는
     화면은 배열로 넘긴다. */
  function setCurrentChapters(entries){
    currentEntries = Array.isArray(entries) ? entries : [entries];
  }

  function markCurrentAsRead(){
    if(!currentEntries || !currentEntries.length) return;
    const map = readMap();
    currentEntries.forEach(({ book, chapter }) => {
      if(!book || !chapter) return;
      const set = new Set(map[book] || []);
      set.add(Number(chapter));
      map[book] = Array.from(set).sort((a, b) => a - b);
    });
    writeMap(map);
  }

  document.addEventListener('sow:saved', markCurrentAsRead);

  window.SOWReadingMap = { setCurrentChapters, readMap };
})();
