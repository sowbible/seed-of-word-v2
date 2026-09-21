/* =========================================================
   SOW Session Toolbar — "나의 성경읽기" (달력 · 성경지도) + 💾 저장 · ↺ 새로고침
   성경묵상 화면(어떤 코스든)에 공통으로 붙는 개인 기록 영역.

   v3(2026-08-29): "📅 달력" 하나뿐이던 것을 "📅 달력 / 🗺️ 성경지도" 두 뷰로
   확장했다. 성경지도는 실제로 읽은 성경 장(章)에 도장을 찍듯 표시한다.

   v4: 달력이 활동 종류(묵상/글쓰기/어휘/한자/언어)를 이모지로 구분해서
   보여주고, 로그인 상태면 Supabase에서 그 달 기록을 불러와 묵상/글쓰기
   전문을 모달로 보여준다. 로그인 안 했으면 예전처럼 로컬(localStorage)
   기록만으로 "완료 표시 + 클릭 시 그 걸음으로 이동"까지만 동작한다.
   ========================================================= */
(function(){
  const ACTIVITY_KEY = 'sow.activity.dates';
  const WEEKDAYS = ['일','월','화','수','목','금','토'];
  const TYPE_EMOJI = { meditation:'📝', writing:'✏️', vocab:'📖', hanja:'🈶', language:'🌍' };
  const TYPE_LABEL = { meditation:'묵상', writing:'글쓰기', vocab:'어휘', hanja:'한자', language:'언어' };

  function pad2(n){ return String(n).padStart(2,'0'); }
  function dateKey(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
  function base(){ return (window.SOW_CONTEXT && window.SOW_CONTEXT.basePath) || ''; }
  function uniq(arr){ return [...new Set(arr)]; }

  function readActivity(){
    try{ return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '{}'); }catch(_){ return {}; }
  }

  /* detail = { type, trackId, book, step } — type이 있으면 그 종류로 태깅해서 쌓는다.
     같은 날 여러 종류를 하면(예: 묵상도 쓰고 어휘도 풀고) types 배열에 같이 모인다.
     detail이 없으면(옛날 형식과의 호환용) 그냥 표시만 되는 항목으로 남는다. */
  function markToday(detail){
    try{
      const log = readActivity();
      const key = dateKey(new Date());
      const existing = normalizeEntry(log[key]);
      if(detail && detail.type){
        log[key] = {
          types: uniq([...(existing?.types || []), detail.type]),
          trackId: detail.trackId || existing?.trackId || null,
          book: detail.book || existing?.book || null,
          step: detail.step || existing?.step || null
        };
      } else if(!existing){
        log[key] = { types: [], trackId: null, book: null, step: null }; // "뭔가 했다"만 표시, 아이콘은 없음
      }
      localStorage.setItem(ACTIVITY_KEY, JSON.stringify(log));
    }catch(_){}
  }

  /* 예전 저장 형식(boolean true, 또는 {done,trackId,book,step})도 새 형식으로 읽어준다 */
  function normalizeEntry(raw){
    if(!raw) return null;
    if(raw.types) return raw; // 이미 새 형식
    if(raw === true) return { types: [], trackId: null, book: null, step: null };
    if(typeof raw === 'object'){
      // 예전엔 묵상만 detail을 남겼으니, book/step이 있으면 묵상으로 간주
      return { types: raw.book ? ['meditation'] : [], trackId: raw.trackId || null, book: raw.book || null, step: raw.step || null };
    }
    return null;
  }

  window.SOWActivityLog = { readActivity, markToday, dateKey };

  /* ---------- 📅 달력 ---------- */
  /* dataMap: { 'YYYY-MM-DD': { types:[...], book, step, trackId, journalEntries?:[...] } }
     journalEntries가 있으면(=Supabase에서 불러온 경우) 날짜를 눌렀을 때 상세 모달을 띄운다. */
  function buildMonthHtml(viewDate, dataMap){
    const y = viewDate.getFullYear(), m = viewDate.getMonth();
    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const todayStr = dateKey(new Date());
    let cells = '';
    for(let i=0;i<first.getDay();i++) cells += `<div class="sow-cal-cell empty"></div>`;
    for(let d=1; d<=daysInMonth; d++){
      const str = `${y}-${pad2(m+1)}-${pad2(d)}`;
      const entry = dataMap[str];
      const isToday = str === todayStr;
      if(!entry){
        cells += `<div class="sow-cal-cell${isToday?' today':''}"><span class="sow-cal-daynum">${d}</span></div>`;
        continue;
      }
      const types = entry.types || [];
      const hasJournal = !!(entry.journalEntries && entry.journalEntries.length) || types.includes('meditation') || types.includes('writing');
      const clickable = !!(entry.journalEntries) || (entry.book && entry.step);
      const badgeIcons = types.slice(0,3).map(t => `<span class="sow-cal-badge">${TYPE_EMOJI[t] || '•'}</span>`).join('');
      const more = types.length > 3 ? `<span class="sow-cal-badge-more">+${types.length-3}</span>` : '';
      cells += `<div class="sow-cal-cell done${clickable?' clickable':''}${isToday?' today':''}" data-date="${str}">
        ${hasJournal ? `<span class="sow-cal-journal-mark">📝</span>` : ''}
        <span class="sow-cal-daynum">${d}</span>
        <div class="sow-cal-badges">${badgeIcons}${more}</div>
      </div>`;
    }
    return `
      <div class="sow-cal-head">
        <button type="button" class="sow-cal-nav" data-nav="-1" aria-label="이전 달">‹</button>
        <span>${y}년 ${m+1}월</span>
        <button type="button" class="sow-cal-nav" data-nav="1" aria-label="다음 달">›</button>
      </div>
      <div class="sow-cal-weekdays">${WEEKDAYS.map(w => `<span>${w}</span>`).join('')}</div>
      <div class="sow-cal-grid">${cells}</div>
      <div class="sow-cal-legend-row">
        <span class="sow-cal-legend">📝 묵상</span>
        <span class="sow-cal-legend">✏️ 글쓰기</span>
        <span class="sow-cal-legend">📖 어휘</span>
        <span class="sow-cal-legend">🈶 한자</span>
        <span class="sow-cal-legend">🌍 언어</span>
      </div>`;
  }

  /* 기록된 날짜를 눌렀을 때 그날의 걸음(책/장)으로 이동 */
  function navigateToEntry(entry){
    if(!entry || !entry.book || !entry.step) return;
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

  /* 날짜 상세 모달 — 그날 묵상/글쓰기 전문 + 나머지 활동 아이콘 목록.
     journalEntries가 없는(=로그인 안 해서 로컬 데이터만 있는) 경우엔 모달 대신 바로 이동시킨다. */
  function openDayModal(dateStr, entry){
    const overlay = document.createElement('div');
    overlay.className = 'sow-modal-overlay';

    const journalEntries = entry.journalEntries || [];
    const journalHtml = journalEntries.length
      ? journalEntries.map(e => `
          <div class="sow-day-modal-journal">
            <div class="sow-day-modal-journal-label">${e.prompt_id === 'writing' ? '✏️ 글쓰기' : '📝 묵상'} — ${e.book || ''} ${e.step || ''}장</div>
            <div class="sow-day-modal-journal-text">${(e.value || '').replace(/</g,'&lt;')}</div>
          </div>`).join('')
      : `<div class="sow-day-modal-empty">이 날은 남긴 글이 없어요</div>`;

    const otherTypes = (entry.types || []).filter(t => t !== 'meditation' && t !== 'writing');
    const activityHtml = otherTypes.length
      ? otherTypes.map(t => `<div class="sow-day-modal-activity"><span class="e">${TYPE_EMOJI[t] || '•'}</span> ${TYPE_LABEL[t] || t} 완료</div>`).join('')
      : '';

    const goBtn = (entry.book && entry.step)
      ? `<button type="button" class="sow-bible-view-btn" data-goto style="margin-top:12px;width:100%;">그날 본문으로 가기</button>`
      : '';

    overlay.innerHTML = `<div class="sow-modal-card">
      <div class="sow-modal-head">${dateStr}<button type="button" data-close>✕</button></div>
      <div class="sow-day-modal-activities">${activityHtml}</div>
      ${journalHtml}
      ${goBtn}
    </div>`;
    overlay.querySelector('[data-close]').onclick = () => overlay.remove();
    overlay.querySelector('[data-goto]')?.addEventListener('click', () => navigateToEntry(entry));
    overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
  }

  function buildInlineCalendar(container){
    let view = new Date();
    let dataMap = {};       // 로컬 기준(항상 있음) — 비로그인 폴백
    let supaMap = null;     // Supabase 기준(로그인 시에만, 달 바뀔 때마다 다시 불러옴)
    let loadingMonth = null;

    function localDataForMonth(){
      const activity = readActivity();
      const out = {};
      Object.keys(activity).forEach(k => {
        const n = normalizeEntry(activity[k]);
        if(n) out[k] = n;
      });
      return out;
    }

    async function loadSupabaseForView(){
      if(!window.SOWAuth || !window.SOWFetchCalendarData) return null;
      const session = await window.SOWAuth.getSession();
      if(!session || !session.user) return null;
      const y = view.getFullYear(), m = view.getMonth() + 1;
      const start = `${y}-${pad2(m)}-01`;
      const end = `${y}-${pad2(m)}-${pad2(new Date(y, m, 0).getDate())}`;
      const monthTag = start;
      loadingMonth = monthTag;
      const byDate = await window.SOWFetchCalendarData(start, end);
      if(loadingMonth !== monthTag) return null; // 그 사이 달이 또 바뀌었으면 이 결과는 버린다
      // 로컬 log와 같은 모양으로 변환: journalEntries는 그대로 들고, types는 journalEntries + activities에서 뽑는다
      const merged = {};
      Object.keys(byDate).forEach(dateStr => {
        const row = byDate[dateStr];
        const types = uniq([
          ...row.journalEntries.map(e => e.prompt_id === 'writing' ? 'writing' : 'meditation'),
          ...row.activities
        ]);
        const last = row.journalEntries[row.journalEntries.length - 1];
        merged[dateStr] = {
          types,
          book: last?.book || null,
          step: last?.step || null,
          trackId: null,
          journalEntries: row.journalEntries
        };
      });
      return merged;
    }

    async function draw(){
      dataMap = localDataForMonth();
      container.innerHTML = buildMonthHtml(view, dataMap);
      wireCellHandlers();

      // Supabase 데이터가 있으면(로그인 상태) 덮어써서 다시 그린다 — 전문 보기가 가능해짐
      const fresh = await loadSupabaseForView();
      if(fresh){
        supaMap = fresh;
        // 로컬에만 있고 Supabase엔 없는 날짜(동기화 전 항목 등)는 로컬 값을 그대로 살려둔다
        const combined = { ...dataMap, ...supaMap };
        container.innerHTML = buildMonthHtml(view, combined);
        dataMap = combined;
        wireCellHandlers();
      }
    }

    function wireCellHandlers(){
      container.querySelectorAll('[data-nav]').forEach(btn => {
        btn.onclick = () => { view = new Date(view.getFullYear(), view.getMonth() + Number(btn.dataset.nav), 1); draw(); };
      });
      container.querySelectorAll('.sow-cal-cell.clickable').forEach(cell => {
        cell.onclick = () => {
          const entry = dataMap[cell.dataset.date];
          if(!entry) return;
          if(entry.journalEntries){
            openDayModal(cell.dataset.date, entry); // Supabase 데이터 있음 — 전문 모달
          } else {
            navigateToEntry(entry); // 로컬 폴백 — 바로 그 걸음으로 이동
          }
        };
      });
    }

    draw();
    return { refresh: () => draw() };
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

  /* ---------- 오늘의 활동 요약 (통계 카드) ---------- */
  function computeStats(){
    const activity = readActivity();
    const dateKeys = Object.keys(activity).sort();
    const todayStr = dateKey(new Date());
    const todayDone = !!activity[todayStr];

    // 연속 기록일(streak) — 오늘(또는 어제까지)부터 거꾸로 며칠 연속인지
    let streak = 0;
    let cursor = new Date();
    if(!todayDone) cursor.setDate(cursor.getDate() - 1); // 오늘 아직이면 어제부터 세기 시작
    while(activity[dateKey(cursor)]){
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    // 이번 달 기록일수
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${pad2(now.getMonth()+1)}`;
    const thisMonthCount = dateKeys.filter(k => k.startsWith(monthPrefix)).length;

    // 전체 읽은 장 수 (성경지도 데이터에서 합산)
    const readMap = window.SOWReadingMap?.readMap() || {};
    const totalChaptersRead = Object.values(readMap).reduce((sum, arr) => sum + arr.length, 0);

    return { todayDone, streak, thisMonthCount, totalChaptersRead };
  }

  function buildStatsHtml(){
    const s = computeStats();
    return `<div class="sow-stats-grid">
      <div class="sow-stat-card ${s.todayDone ? 'sow-stat-good' : 'sow-stat-warn'}">
        <span class="sow-stat-icon">${s.todayDone ? '✅' : '⏳'}</span>
        <span class="sow-stat-num">${s.todayDone ? '완료' : '아직'}</span>
        <span class="sow-stat-label">오늘 기록</span>
      </div>
      <div class="sow-stat-card sow-stat-sprout">
        <span class="sow-stat-icon">🔥</span>
        <span class="sow-stat-num">${s.streak}일</span>
        <span class="sow-stat-label">연속 기록</span>
      </div>
      <div class="sow-stat-card sow-stat-amber">
        <span class="sow-stat-icon">🗓️</span>
        <span class="sow-stat-num">${s.thisMonthCount}일</span>
        <span class="sow-stat-label">이번 달 기록</span>
      </div>
      <div class="sow-stat-card sow-stat-clay">
        <span class="sow-stat-icon">📖</span>
        <span class="sow-stat-num">${s.totalChaptersRead}장</span>
        <span class="sow-stat-label">전체 읽은 장</span>
      </div>
    </div>`;
  }

  function render(container){
    const wrap = document.createElement('div');
    wrap.className = 'sow-my-reading';
    wrap.innerHTML = `
      <div class="sow-my-reading-head">📖 나의 성경읽기</div>
      <p class="sow-my-reading-greeting">오늘도 씨앗 하나 심으러 오셨네요 🌱</p>`;
    container.appendChild(wrap);

    const statsWrap = document.createElement('div');
    statsWrap.innerHTML = buildStatsHtml();
    wrap.appendChild(statsWrap);

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
        statsWrap.innerHTML = buildStatsHtml();
        if(currentView === 'calendar'){ cal.refresh(); }
        else if(library){ buildInlineMap(viewWrap, library); }
      }
    };
    bar.querySelector('[data-act="refresh"]').onclick = () => location.reload();
  }

  window.SOWSessionToolbar = { render };
})();
