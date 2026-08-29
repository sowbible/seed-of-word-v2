/* =========================================================
   SOW Session Toolbar — "나의 성경읽기" (달력 · 성경지도) + 💾 저장 · ↺ 새로고침
   성경묵상 화면(어떤 코스든)에 공통으로 붙는 개인 기록 영역.

   v3(2026-08-29): "📅 달력" 하나뿐이던 것을 "📅 달력 / 🗺️ 성경지도" 두 뷰로
   확장했다. 성경지도는 실제로 읽은 성경 장(章)에 도장을 찍듯 표시한다 —
   읽은 장 데이터는 reading-map.js가 관리(sow.read.chapters).

   활동 기록(sow.activity.dates)은 이 파일이 아니라 persist.js가 채운다
   (입력이 저장될 때마다 markToday(detail) 호출) — 이 파일은 그 로그를
   읽어서 보여주고, 클릭했을 때 이동시키는 쪽만 담당한다.
   ========================================================= */
(function(){
  const ACTIVITY_KEY = 'sow.activity.dates';
  const WEEKDAYS = ['일','월','화','수','목','금','토'];

  function pad2(n){ return String(n).padStart(2,'0'); }
  function dateKey(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
  function base(){ return (window.SOW_CONTEXT && window.SOW_CONTEXT.basePath) || ''; }

  function readActivity(){
    try{ return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '{}'); }catch(_){ return {}; }
  }
  /* detail = { trackId, book, step } — 성경묵상 기록일 때만 넘어온다.
     detail이 없으면(국어 등 다른 모듈 기록) 그냥 true로만 표시 — 클릭 이동은 안 됨. */
  function markToday(detail){
    try{
      const log = readActivity();
      const key = dateKey(new Date());
      const existing = log[key];
      if(detail){
        log[key] = { done: true, ...detail };
      } else if(!existing){
        log[key] = true;
      }
      localStorage.setItem(ACTIVITY_KEY, JSON.stringify(log));
    }catch(_){}
  }
  window.SOWActivityLog = { readActivity, markToday, dateKey };

  /* ---------- 📅 달력 ---------- */
  function buildMonthHtml(viewDate, activity){
    const y = viewDate.getFullYear(), m = viewDate.getMonth();
    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const todayStr = dateKey(new Date());
    let cells = '';
    for(let i=0;i<first.getDay();i++) cells += `<div class="sow-cal-cell empty"></div>`;
    for(let d=1; d<=daysInMonth; d++){
      const str = `${y}-${pad2(m+1)}-${pad2(d)}`;
      const entry = activity[str];
      const done = !!entry;
      const clickable = done && typeof entry === 'object' && entry.book && entry.step;
      const isToday = str === todayStr;
      cells += `<div class="sow-cal-cell${done?' done':''}${clickable?' clickable':''}${isToday?' today':''}" data-date="${str}">${d}${done?'<span class="sow-cal-dot"></span>':''}</div>`;
    }
    return `
      <div class="sow-cal-head">
        <button type="button" class="sow-cal-nav" data-nav="-1" aria-label="이전 달">‹</button>
        <span>${y}년 ${m+1}월</span>
        <button type="button" class="sow-cal-nav" data-nav="1" aria-label="다음 달">›</button>
      </div>
      <div class="sow-cal-weekdays">${WEEKDAYS.map(w => `<span>${w}</span>`).join('')}</div>
      <div class="sow-cal-grid">${cells}</div>
      <p class="sow-cal-legend"><span class="sow-cal-dot"></span> 기록을 남긴 날 · 눌러서 그날 묵상 보기</p>`;
  }

  /* 기록된 날짜를 눌렀을 때 그날의 걸음(책/장)으로 이동 */
  function navigateToEntry(entry){
    if(!entry || typeof entry !== 'object' || !entry.book || !entry.step) return;
    try{
      if(entry.trackId){
        localStorage.setItem('sow.track.meditation', entry.trackId);
        if(entry.trackId === 'free'){
          localStorage.setItem('sow.free.passage', JSON.stringify({ book: entry.book, chapter: Number(entry.step) }));
        }
      }
    }catch(_){}
    const url = new URL(location.href);
    url.searchParams.set('book', entry.book);
    url.searchParams.set('step', entry.step);
    url.searchParams.set('module', 'meditation');
    location.href = url.toString();
  }

  function buildInlineCalendar(container){
    const activity = readActivity();
    let view = new Date();
    function draw(){
      container.innerHTML = buildMonthHtml(view, activity);
      container.querySelectorAll('[data-nav]').forEach(btn => {
        btn.onclick = () => { view = new Date(view.getFullYear(), view.getMonth() + Number(btn.dataset.nav), 1); draw(); };
      });
      container.querySelectorAll('.sow-cal-cell.clickable').forEach(cell => {
        cell.onclick = () => navigateToEntry(activity[cell.dataset.date]);
      });
    }
    draw();
    return { refresh: () => { Object.assign(activity, readActivity()); draw(); } };
  }

  /* ---------- 🗺️ 성경지도 ---------- */
  async function fetchLibrary(){
    const res = await fetch(base() + '/content/bible/_library.json');
    return res.json();
  }
  function flatChapterIndex(library, bookId, chapter){
    const allBooks = [...library.oldTestament.books, ...library.newTestament.books];
    let idx = 0;
    for(const b of allBooks){
      if(b.id === bookId) return idx + chapter;
      idx += b.chapters;
    }
    return idx || 1;
  }
  function navigateToChapter(library, bookId, chapter){
    try{ localStorage.setItem('sow.track.meditation', 'daily-chapter'); }catch(_){}
    const url = new URL(location.href);
    url.searchParams.set('step', flatChapterIndex(library, bookId, chapter));
    url.searchParams.set('module', 'meditation');
    location.href = url.toString();
  }

  function bookMapHtml(book, readChapters){
    const readSet = new Set(readChapters || []);
    const cells = Array.from({length: book.chapters}, (_, i) => i+1).map(c =>
      `<span class="sow-map-cell${readSet.has(c) ? ' read' : ''}" data-book="${book.id}" data-chapter="${c}" title="${book.shortKo} ${c}장"></span>`
    ).join('');
    return `<div class="sow-map-book">
      <div class="sow-map-book-head"><span>${book.shortKo}</span><span class="sow-map-book-count">${readSet.size}/${book.chapters}</span></div>
      <div class="sow-map-cells">${cells}</div>
    </div>`;
  }

  function buildInlineMap(container, library){
    const readMap = window.SOWReadingMap?.readMap() || {};
    let totalRead = 0, totalChapters = 0;
    [...library.oldTestament.books, ...library.newTestament.books].forEach(b => {
      totalChapters += b.chapters;
      totalRead += (readMap[b.id] || []).length;
    });
    container.innerHTML = `
      <p class="sow-map-summary">📖 전체 ${totalChapters}장 중 <b>${totalRead}장</b> 읽음</p>
      <div class="sow-map-section"><h5>구약</h5><div class="sow-map-grid">${library.oldTestament.books.map(b => bookMapHtml(b, readMap[b.id])).join('')}</div></div>
      <div class="sow-map-section"><h5>신약</h5><div class="sow-map-grid">${library.newTestament.books.map(b => bookMapHtml(b, readMap[b.id])).join('')}</div></div>
      <p class="sow-cal-legend"><span class="sow-map-cell read" style="position:static;width:10px;height:10px;"></span> 읽은 장 · 눌러서 그 장으로 이동</p>`;
    container.querySelectorAll('.sow-map-cell').forEach(cell => {
      cell.onclick = () => navigateToChapter(library, cell.dataset.book, Number(cell.dataset.chapter));
    });
  }

  function showToast(msg){
    const t = document.createElement('div');
    t.className = 'sow-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 1800);
  }

  function render(container){
    const wrap = document.createElement('div');
    wrap.className = 'sow-my-reading';
    wrap.innerHTML = `<div class="sow-my-reading-head">📖 나의 성경읽기</div>`;
    container.appendChild(wrap);

    const bar = document.createElement('div');
    bar.className = 'sow-session-toolbar';
    bar.innerHTML = `
      <button type="button" class="sow-toolbar-btn" data-act="save">💾 저장</button>
      <button type="button" class="sow-toolbar-btn" data-act="refresh">↺ 새로고침</button>`;
    wrap.appendChild(bar);

    const viewTabs = document.createElement('div');
    viewTabs.className = 'sow-record-tabs';
    viewTabs.innerHTML = `
      <button type="button" data-view="calendar" class="active">📅 달력</button>
      <button type="button" data-view="map">🗺️ 성경지도</button>`;
    wrap.appendChild(viewTabs);

    const viewWrap = document.createElement('div');
    viewWrap.className = 'sow-cal-inline';
    wrap.appendChild(viewWrap);

    let cal = buildInlineCalendar(viewWrap);
    let library = null;
    let currentView = 'calendar';

    viewTabs.querySelectorAll('[data-view]').forEach(btn => {
      btn.onclick = async () => {
        currentView = btn.dataset.view;
        viewTabs.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b === btn));
        if(currentView === 'calendar'){
          cal = buildInlineCalendar(viewWrap);
        } else {
          viewWrap.innerHTML = `<p class="sow-loading">${'불러오는 중…'}</p>`;
          if(!library) library = await fetchLibrary();
          buildInlineMap(viewWrap, library);
        }
      };
    });

    bar.querySelector('[data-act="save"]').onclick = async () => {
      const n = window.SOWPersist?.flush ? window.SOWPersist.flush() : 0;
      showToast(n > 0 ? `오늘 기록 ${n}개를 저장했어요 💾` : '아직 저장할 내용이 없어요');
      if(n > 0){
        if(currentView === 'calendar'){ cal.refresh(); }
        else if(library){ buildInlineMap(viewWrap, library); }
      }
    };
    bar.querySelector('[data-act="refresh"]').onclick = () => location.reload();
  }

  window.SOWSessionToolbar = { render };
})();
