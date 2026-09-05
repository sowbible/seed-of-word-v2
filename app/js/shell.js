/* =========================================================
   SOW Shell v2 — 4개 모듈 전부 "트랙"을 갖는 구조를 인식하는 공용 엔진
   (SOW_구조설계.md v3.0 기준: content/{moduleId}/{trackId}/...)

   각 걸음 페이지는 아래처럼 SOW_CONTEXT만 정의하고 이 파일을 불러오면 끝:
     window.SOW_CONTEXT = { book: "john", step: 1, basePath: "" };

   trackId는 지정하지 않으면 각 모듈의 트랙 레지스트리에서
   status:"active"인 트랙(현재는 전부 "elementary")을 자동으로 쓴다.
   ========================================================= */
(function(){
  const ctx = window.SOW_CONTEXT || {};
  const BOOK = ctx.book;
  const STEP = ctx.step || ctx.chapter; // v1.x 호환
  const BASE = ctx.basePath || '';

  if(!BOOK || !STEP){
    console.error('[SOW Shell] window.SOW_CONTEXT.book / step 이 필요합니다.');
    return;
  }

  const state = {
    interfaceLocale: (ctx.interfaceLocale) || localStorage.getItem('sow.interfaceLocale') || 'ko',
    activeModule: null,
    activeTrack: {},      // moduleId -> trackId
    activeSub: {},         // moduleId -> submoduleId ('meditation'은 'steps' | 'group' 하위탭)
    moduleRegistry: null,
    trackRegistryCache: {},
    subRegistryCache: {},
    dataCache: {}
  };

  const t = {
    ko: { required: '필수 기록', loading: '불러오는 중…', empty: '아직 콘텐츠가 채워지지 않았어요', comingSoon: '(실 데이터는 준비 중이에요 — 가족 계정 연동 후 표시됩니다)' },
    en: { required: 'Required', loading: 'Loading…', empty: 'Content not filled in yet', comingSoon: '(Coming soon — needs group account setup)' }
  };
  const L = () => t[state.interfaceLocale] || t.ko;

  /* ---------- 유틸: fetch + 캐시 ---------- */
  async function fetchJSON(path){
    if(state.dataCache[path]) return state.dataCache[path];
    const res = await fetch(BASE + path);
    if(!res.ok) throw new Error('fetch 실패: ' + path);
    const json = await res.json();
    state.dataCache[path] = json;
    return json;
  }

  function voiceAttrs(input){
    if(!input || !input.voiceInput) return '';
    return `data-voice="1" data-voice-lang="${input.lang || 'ko-KR'}"`;
  }

  function persistAttr(key){
    return `data-persist-key="${key}"`;
  }

  /* ---------- 그룹 공유 토글 — shareable:true인 프롬프트에만 붙는다 ---------- */
  function shareToggleHtml(shareKey){
    return `<label class="sow-share-toggle"><input type="checkbox" data-share-key="${shareKey}"> ✨ 이 답변, 그룹에 공유하기</label>`;
  }
  function wireShareToggles(container){
    container.querySelectorAll('[data-share-key]').forEach(cb => {
      const key = 'sow.share.' + cb.dataset.shareKey;
      try{ cb.checked = localStorage.getItem(key) === '1'; }catch(_){}
      cb.addEventListener('change', () => {
        try{ localStorage.setItem(key, cb.checked ? '1' : '0'); }catch(_){}
      });
    });
  }

  function pickLabel(labelObj){
    if(!labelObj) return '';
    return labelObj[state.interfaceLocale] || labelObj.ko || '';
  }

  /* ---------- 트랙 레지스트리 (4개 모듈 공통 패턴) ---------- */
  async function getTrackRegistry(moduleId){
    if(state.trackRegistryCache[moduleId]) return state.trackRegistryCache[moduleId];
    const reg = await fetchJSON(`/content/${moduleId}/_track-registry.json`);
    const tracks = reg.tracks.sort((a,b)=>a.order-b.order);
    state.trackRegistryCache[moduleId] = tracks;
    return tracks;
  }
  function resolveActiveTrackId(tracks){
    const active = tracks.find(tr => tr.status === 'active') || tracks[0];
    return active.id;
  }
  function needsTrackSelection(tracks){ return tracks.length > 1; }

  /* ---------- 코스(트랙) 선택 화면 — 트랙이 2개 이상인 모듈에서만 자동 노출 ---------- */
  function renderTrackSelector(main, moduleId, tracks){
    main.innerHTML = '';
    const body = document.createElement('div');
    main.appendChild(body);
    body.innerHTML = `<h2 class="sow-section-title serif">어떤 코스로 걸을까요?</h2>
      <div class="sow-track-grid">` +
      tracks.map(tr => `<button class="sow-track-card ${tr.status!=='active' ? 'soon' : ''}" data-track="${tr.id}">
          <div class="sow-track-icon">${tr.icon || '📖'}</div>
          <div class="sow-track-label">${pickLabel(tr.label)}</div>
          <div class="sow-track-subtitle">${pickLabel(tr.subtitle)}</div>
          <div class="sow-track-desc">${pickLabel(tr.description)}</div>
          <div class="sow-track-cta">${tr.status==='active' ? '시작하기 →' : '준비중 · 미리보기'}</div>
        </button>`).join('') +
      `</div>`;
    main.appendChild(body);
    main.querySelectorAll('[data-track]').forEach(btn => {
      btn.onclick = () => {
        const trackId = btn.dataset.track;
        state.activeTrack[moduleId] = trackId;
        try{ localStorage.setItem(`sow.track.${moduleId}`, trackId); }catch(_){}
        renderModulePanel(main);
      };
    });
  }

  function renderTrackChangeLink(main, moduleId){
    const bar = document.createElement('div');
    bar.className = 'sow-track-change-bar';
    bar.innerHTML = `<button type="button" class="sow-track-change-btn">↺ 코스 변경</button>`;
    bar.querySelector('button').onclick = () => {
      state.activeTrack[moduleId] = null;
      try{ localStorage.removeItem(`sow.track.${moduleId}`); }catch(_){}
      renderModulePanel(main);
    };
    main.prepend(bar);
  }

  /* ---------- followsTrackOf 모듈용 안내 배지 — "성경묵상 코스를 따라가고 있어요" ---------- */
  async function renderFollowBadge(main, parentModuleId, trackMeta, real){
    let rangeText = '';
    if(real){
      let shortKo = real.book;
      try{
        const library = await fetchJSON('/content/bible/_library.json');
        const all = [...library.oldTestament.books, ...library.newTestament.books];
        const book = all.find(b => b.id === real.book);
        if(book) shortKo = book.shortKo;
      }catch(_){}
      rangeText = ` · <b>${shortKo} ${real.chapter}장</b>`;
    }
    const bar = document.createElement('div');
    bar.className = 'sow-follow-badge';
    bar.innerHTML = `<span>📖 지금 코스: <b>${pickLabel(trackMeta.label)}</b>${rangeText}</span><span class="sow-follow-hint">성경묵상 탭에서 바꿀 수 있어요</span>`;
    main.appendChild(bar);
  }

  /* ---------- 아직 콘텐츠 없는 코스(예: 1장 코스, 1년1독) 준비중 화면 ---------- */
  async function renderTrackComingSoon(container, moduleId, trackId, trackMeta){
    let desc = pickLabel(trackMeta.description);
    try{
      const meta = await fetchJSON(`/content/${moduleId}/${trackId}/meta.json`);
      if(meta.description) desc = pickLabel(meta.description);
    }catch(_){ /* meta 없으면 레지스트리 설명으로 대체 */ }
    container.innerHTML = `<div class="sow-card">
      <div class="sow-track-icon" style="font-size:32px;">${trackMeta.icon || '📖'}</div>
      <h4 style="margin:10px 0 6px;">${pickLabel(trackMeta.label)} — 준비중이에요</h4>
      <p style="font-size:13.5px;color:var(--forest-soft);line-height:1.6;">${desc}</p>
    </div>`;
  }

  /* ---------- 걸음 이전/다음 이동 — 코스(트랙) 공통, 어느 모듈 탭에서든 노출 ---------- */
  async function renderStepNavBar(main, trackId){
    let total = null;
    try{
      const meta = await fetchJSON(`/content/meditation/${trackId}/meta.json`);
      total = meta.totalSteps || null;
    }catch(_){ /* 무시 */ }
    const bar = document.createElement('div');
    bar.className = 'sow-step-nav-bar';
    const prevDisabled = STEP <= 1;
    const nextDisabled = total ? STEP >= total : false;
    bar.innerHTML = `
      <button type="button" class="sow-step-nav-btn" data-dir="prev" ${prevDisabled ? 'disabled' : ''}>◀ 이전 걸음</button>
      <span class="sow-step-nav-count">${STEP}${total ? ' / ' + total + '걸음' : '걸음'}</span>
      <button type="button" class="sow-step-nav-btn" data-dir="next" ${nextDisabled ? 'disabled' : ''}>다음 걸음 ▶</button>`;
    bar.querySelectorAll('[data-dir]').forEach(btn => {
      btn.onclick = () => {
        const delta = btn.dataset.dir === 'prev' ? -1 : 1;
        const target = STEP + delta;
        location.href = `${BASE}/sow/read/index.html?book=${encodeURIComponent(BOOK)}&step=${target}&module=${encodeURIComponent(state.activeModule)}`;
      };
    });
    main.appendChild(bar);
  }

  /* ---------- 성경묵상: 오늘의 말씀(steps) ---------- */
  async function renderMeditationSteps(container, trackId){
    const data = await fetchJSON(`/content/meditation/${trackId}/steps/${BOOK}/${STEP}.json`);
    let html = `<div class="sow-passage-ref">📖 오늘의 본문 · ${data.passageRef}</div>
      <div id="sow-bible-widget-slot"></div>
      <h2 class="sow-section-title serif">말씀을 천천히 읽고 내 마음에 남는 것을 찾아보세요</h2>`;
    data.prompts.forEach(p => {
      const shareKey = `meditation:${trackId}:${BOOK}:${STEP}:${p.id}`;
      html += `<div class="sow-card sow-prompt">
        <div class="icon-row"><span class="emoji">${p.icon}</span><h4>${p.title}</h4>${p.required ? `<span class="sow-required">${L().required}</span>` : ''}</div>
        <p>${p.guide}</p>
        <div><textarea rows="2" placeholder="여기에 적거나 음성으로 말해보세요" ${voiceAttrs(p.input)} ${persistAttr(shareKey)}></textarea></div>
        ${p.shareable ? shareToggleHtml(shareKey) : ''}
      </div>`;
    });
    container.innerHTML = html;
    wireShareToggles(container);
    window.SOWReadingMap?.setCurrentChapters({ book: data.book || BOOK, chapter: data.chapter || 1 });
    const slot = container.querySelector('#sow-bible-widget-slot');
    if(slot && window.SOWBibleLink){
      window.SOWBibleLink.render(slot, { book: data.book || BOOK, chapter: data.chapter || 1, basePath: BASE, locale: state.interfaceLocale });
    }
  }

  /* ---------- 성경묵상: 자유코스 — 본문을 직접 골라서 공용 4문항으로 묵상 ---------- */
  /* ---------- 공용: 구약/신약 탭이 맨 앞에 오는 "본문 바로 가기" 컴포넌트 ---------- */
  function renderChapterJumper(container, opts){
    const library = opts.library;
    let expanded = false;
    let testament = library.oldTestament.books.some(b => b.id === opts.initialBookId) ? 'ot' : 'nt';
    let bookId = opts.initialBookId;
    let chapter = opts.initialChapter || 1;

    function books(){ return testament === 'ot' ? library.oldTestament.books : library.newTestament.books; }
    function currentBookLabel(){
      const all = [...library.oldTestament.books, ...library.newTestament.books];
      const b = all.find(x => x.id === bookId);
      return b ? `${b.shortKo} ${chapter}장` : '';
    }

    function draw(){
      if(!expanded){
        container.innerHTML = `<button type="button" class="sow-jumper-toggle">🔎 본문 바로 가기 <span class="sow-jumper-toggle-current">${currentBookLabel()}</span></button>`;
        container.querySelector('.sow-jumper-toggle').onclick = () => { expanded = true; draw(); };
        return;
      }
      if(!books().some(b => b.id === bookId)) bookId = books()[0].id;
      const book = books().find(b => b.id === bookId);
      if(chapter > book.chapters) chapter = book.chapters;
      container.innerHTML = `<div class="sow-jumper">
        <div class="sow-jumper-head">
          <label>${opts.label}</label>
          <button type="button" class="sow-jumper-collapse">접기 ▲</button>
        </div>
        <div class="sow-jumper-testament">
          <button type="button" data-t="ot" class="${testament==='ot'?'active':''}">구약</button>
          <button type="button" data-t="nt" class="${testament==='nt'?'active':''}">신약</button>
        </div>
        <div class="sow-jumper-row">
          <select class="sow-jumper-book">${books().map(b => `<option value="${b.id}" ${b.id===bookId?'selected':''}>${b.shortKo}</option>`).join('')}</select>
          <select class="sow-jumper-chapter">${Array.from({length: book.chapters}, (_, i) => i+1).map(n => `<option value="${n}" ${n===chapter?'selected':''}>${n}장</option>`).join('')}</select>
        </div>
      </div>`;
      container.querySelector('.sow-jumper-collapse').onclick = () => { expanded = false; draw(); };
      container.querySelectorAll('[data-t]').forEach(btn => {
        btn.onclick = () => { testament = btn.dataset.t; draw(); };
      });
      container.querySelector('.sow-jumper-book').onchange = (e) => { bookId = e.target.value; chapter = 1; draw(); opts.onChange(bookId, chapter); };
      container.querySelector('.sow-jumper-chapter').onchange = (e) => { chapter = Number(e.target.value); opts.onChange(bookId, chapter); };
    }
    draw();
  }

  /* 걸음(STEP) ↔ 실제 책/장 상호 변환 — 하루한장/1년1독에서 "이 장으로 바로 가기"에 사용 */
  function flatChapterIndex(library, bookId, chapter){
    const allBooks = [...library.oldTestament.books, ...library.newTestament.books];
    let idx = 0;
    for(const b of allBooks){
      if(b.id === bookId) return idx + chapter;
      idx += b.chapters;
    }
    return idx || 1;
  }
  function navigateToStep(newStep, moduleId){
    const url = new URL(location.href);
    url.searchParams.set('step', newStep);
    url.searchParams.set('module', moduleId || state.activeModule || 'meditation');
    location.href = url.toString();
  }

  /* "🔎 본문 바로 가기"를 성경묵상뿐 아니라 국어/언어/성경관련 지식 화면 위에도 똑같이 보여준다.
     실제 장 개념이 있는 코스(하루한장/1년1독)에서만 뜬다 — 어린이 코스(고정 걸음)나 자유코스
     (자기 안에서 이미 고르는 UI가 따로 있음)는 대상이 아니다. 어떤 모듈에서 눌러도 지금 보고 있는
     모듈(국어면 국어) 그대로 유지한 채 장만 이동한다(navigateToStep이 state.activeModule을 따라감). */
  async function renderSharedChapterJumper(main, trackId, trackMeta){
    if(!(trackMeta.generated || trackMeta.yearPlan)) return;
    let real;
    try{ real = await resolveRealChapter(trackId); }catch(_){ return; }
    const library = await fetchJSON('/content/bible/_library.json');
    const jumperSlot = document.createElement('div');
    main.appendChild(jumperSlot);
    renderChapterJumper(jumperSlot, {
      library, initialBookId: real.book, initialChapter: real.chapter,
      label: '이 장으로 바로 가기',
      onChange: (newBook, newChapter) => {
        const flatIdx = flatChapterIndex(library, newBook, newChapter);
        const targetStep = trackMeta.yearPlan ? yearPlanDayForFlatIndex(flatIdx) : flatIdx;
        navigateToStep(targetStep);
      }
    });
  }

  async function renderMeditationFree(container){
    const [library, template] = await Promise.all([
      fetchJSON('/content/bible/_library.json'),
      fetchJSON('/content/meditation/_prompt-template.json')
    ]);
    const allBooks = [...library.oldTestament.books, ...library.newTestament.books];

    let saved = null;
    try{ saved = JSON.parse(localStorage.getItem('sow.free.passage') || 'null'); }catch(_){}
    const bookId = (saved && allBooks.some(b => b.id === saved.book)) ? saved.book : BOOK;
    const currentBook = allBooks.find(b => b.id === bookId) || allBooks[0];
    const chapter = Math.min(saved?.chapter || 1, currentBook.chapters);

    let html = `<div id="sow-free-jumper-slot"></div>
    <div id="sow-free-bible-widget-slot"></div>
    <h2 class="sow-section-title serif">말씀을 천천히 읽고 내 마음에 남는 것을 찾아보세요</h2>`;

    template.prompts.forEach(p => {
      const shareKey = `meditation:free:${bookId}:${chapter}:${p.id}`;
      html += `<div class="sow-card sow-prompt">
        <div class="icon-row"><span class="emoji">${p.icon}</span><h4>${p.title}</h4>${p.required ? `<span class="sow-required">${L().required}</span>` : ''}</div>
        <p>${p.guide}</p>
        <div><textarea rows="2" placeholder="여기에 적거나 음성으로 말해보세요" ${voiceAttrs(p.input)} ${persistAttr(shareKey)}></textarea></div>
        ${p.shareable ? shareToggleHtml(shareKey) : ''}
      </div>`;
    });

    container.innerHTML = html;
    wireShareToggles(container);
    window.SOWReadingMap?.setCurrentChapters({ book: bookId, chapter });

    renderChapterJumper(container.querySelector('#sow-free-jumper-slot'), {
      library, initialBookId: bookId, initialChapter: chapter,
      label: '오늘 묵상할 본문을 직접 골라보세요',
      onChange: (newBook, newChapter) => {
        try{ localStorage.setItem('sow.free.passage', JSON.stringify({ book: newBook, chapter: newChapter })); }catch(_){}
        renderMeditationFree(container);
      }
    });

    const slot = container.querySelector('#sow-free-bible-widget-slot');
    if(slot && window.SOWBibleLink){
      window.SOWBibleLink.render(slot, { book: bookId, chapter, basePath: BASE, locale: state.interfaceLocale });
    }

    window.SOWVoiceInput?.scan(container); window.SOWPersist?.scan(container);
  }

  /* ---------- 성경묵상: 하루한장 코스 — 걸음 번호를 성경 전체 장 순서에 자동 매핑 ---------- */
  function resolveDailyChapterPassage(library, step){
    const allBooks = [...library.oldTestament.books, ...library.newTestament.books];
    let remaining = Math.max(1, step);
    for(const b of allBooks){
      if(remaining <= b.chapters) return { book: b, chapter: remaining };
      remaining -= b.chapters;
    }
    const last = allBooks[allBooks.length - 1];
    return { book: last, chapter: last.chapters }; // 성경 끝(계시록 22장)에 도달하면 거기서 멈춤
  }

  async function renderMeditationDailyChapter(container, trackId){
    const [library, template] = await Promise.all([
      fetchJSON('/content/bible/_library.json'),
      fetchJSON('/content/meditation/_prompt-template.json')
    ]);
    const { book, chapter } = resolveDailyChapterPassage(library, STEP);

    let html = `<div class="sow-passage-ref">📖 오늘의 본문 · ${book.shortKo} ${chapter}장 · (${STEP}/1189걸음)</div>
      <div id="sow-daily-bible-widget-slot"></div>
      <h2 class="sow-section-title serif">말씀을 천천히 읽고 내 마음에 남는 것을 찾아보세요</h2>`;

    template.prompts.forEach(p => {
      const shareKey = `meditation:${trackId}:${book.id}:${chapter}:${p.id}`;
      html += `<div class="sow-card sow-prompt">
        <div class="icon-row"><span class="emoji">${p.icon}</span><h4>${p.title}</h4>${p.required ? `<span class="sow-required">${L().required}</span>` : ''}</div>
        <p>${p.guide}</p>
        <div><textarea rows="2" placeholder="여기에 적거나 음성으로 말해보세요" ${voiceAttrs(p.input)} ${persistAttr(shareKey)}></textarea></div>
        ${p.shareable ? shareToggleHtml(shareKey) : ''}
      </div>`;
    });

    container.innerHTML = html;
    wireShareToggles(container);
    window.SOWReadingMap?.setCurrentChapters({ book: book.id, chapter });

    const slot = container.querySelector('#sow-daily-bible-widget-slot');
    if(slot && window.SOWBibleLink){
      window.SOWBibleLink.render(slot, { book: book.id, chapter, basePath: BASE, locale: state.interfaceLocale });
    }
  }

  /* ---------- 성경묵상: 1년1독 코스 — 1189장을 365일로 균등 분배(하루 3~4장) ---------- */
  const YEAR_PLAN_TOTAL_CHAPTERS = 1189;
  const YEAR_PLAN_TOTAL_DAYS = 365;

  function resolveYearPlanRange(day){
    const d = Math.min(Math.max(1, day), YEAR_PLAN_TOTAL_DAYS);
    const start = Math.floor((d - 1) * YEAR_PLAN_TOTAL_CHAPTERS / YEAR_PLAN_TOTAL_DAYS) + 1;
    const end = Math.floor(d * YEAR_PLAN_TOTAL_CHAPTERS / YEAR_PLAN_TOTAL_DAYS);
    return { start, end };
  }

  /* 오늘 몫(3~4장)을 책 단위로 묶어서 "창세기 1~3장" 같은 표시용 그룹으로 만든다 */
  function groupYearPlanPassages(library, start, end){
    const groups = [];
    for(let idx = start; idx <= end; idx++){
      const { book, chapter } = resolveDailyChapterPassage(library, idx);
      const last = groups[groups.length - 1];
      if(last && last.book.id === book.id && chapter === last.toChapter + 1){
        last.toChapter = chapter;
      } else {
        groups.push({ book, fromChapter: chapter, toChapter: chapter });
      }
    }
    return groups;
  }

  function formatYearPlanRef(groups){
    return groups.map(g => g.fromChapter === g.toChapter
      ? `${g.book.shortKo} ${g.fromChapter}장`
      : `${g.book.shortKo} ${g.fromChapter}~${g.toChapter}장`
    ).join(' · ');
  }

  function yearPlanDayForFlatIndex(flatIndex){
    for(let d = 1; d <= YEAR_PLAN_TOTAL_DAYS; d++){
      if(resolveYearPlanRange(d).end >= flatIndex) return d;
    }
    return YEAR_PLAN_TOTAL_DAYS;
  }

  async function renderMeditationYearPlan(container, trackId){
    const [library, template] = await Promise.all([
      fetchJSON('/content/bible/_library.json'),
      fetchJSON('/content/meditation/_prompt-template.json')
    ]);
    const { start, end } = resolveYearPlanRange(STEP);
    const groups = groupYearPlanPassages(library, start, end);
    const firstBook = groups[0].book;
    const firstChapter = groups[0].fromChapter;

    let html = `<div class="sow-passage-ref">🗓️ ${STEP}일차 · (${STEP}/365일)</div>
      <h2 class="sow-section-title serif">${formatYearPlanRef(groups)}</h2>
      <div class="sow-year-plan-list">` +
      groups.map(g => `<div class="sow-year-plan-chip">📖 ${g.book.shortKo} ${g.fromChapter === g.toChapter ? `${g.fromChapter}장` : `${g.fromChapter}~${g.toChapter}장`}</div>`).join('') +
      `</div>
      <div id="sow-year-bible-widget-slot"></div>
      <h2 class="sow-section-title serif">말씀을 천천히 읽고 내 마음에 남는 것을 찾아보세요</h2>`;

    template.prompts.forEach(p => {
      const shareKey = `meditation:${trackId}:${firstBook.id}:${firstChapter}:${p.id}`;
      html += `<div class="sow-card sow-prompt">
        <div class="icon-row"><span class="emoji">${p.icon}</span><h4>${p.title}</h4>${p.required ? `<span class="sow-required">${L().required}</span>` : ''}</div>
        <p>${p.guide}</p>
        <div><textarea rows="2" placeholder="여기에 적거나 음성으로 말해보세요" ${voiceAttrs(p.input)} ${persistAttr(shareKey)}></textarea></div>
        ${p.shareable ? shareToggleHtml(shareKey) : ''}
      </div>`;
    });

    container.innerHTML = html;
    wireShareToggles(container);
    window.SOWReadingMap?.setCurrentChapters(
      groups.flatMap(g => {
        const list = [];
        for(let c = g.fromChapter; c <= g.toChapter; c++) list.push({ book: g.book.id, chapter: c });
        return list;
      })
    );

    const slot = container.querySelector('#sow-year-bible-widget-slot');
    if(slot && window.SOWBibleLink){
      window.SOWBibleLink.render(slot, { book: firstBook.id, chapter: firstChapter, basePath: BASE, locale: state.interfaceLocale });
    }
  }

  /* ---------- 성경묵상: 그룹 (정적 UI 문구만 — 실 데이터는 Supabase 연동 후) ---------- */
  const GROUP_TABS = [
    { id: 'overview', icon: '🗺️' },
    { id: 'found-god', icon: '💛' },
    { id: 'blessing', icon: '🙏' },
    { id: 'manage', icon: '⚙️' }
  ];
  async function renderGroup(container, trackId, subId){
    const copy = await fetchJSON(`/content/meditation/${trackId}/group/_ui-copy.json`);
    const c = copy[subId];
    if(!c){ container.innerHTML = `<div class="sow-empty-note">${L().empty}</div>`; return; }

    let html = `<div class="sow-subtabs">` + GROUP_TABS.map(f =>
      `<button class="${f.id===subId?'active':''}" data-group-tab="${f.id}">${f.icon} ${pickLabel(copy[f.id]?.title)}</button>`
    ).join('') + `</div>`;

    if(subId === 'manage'){
      html += `<div class="sow-card">
        <h4>${pickLabel(c.createTitle)}</h4>
        <div class="sow-group-form-row">
          <input type="text" placeholder="${pickLabel(c.groupNamePlaceholder)}" disabled>
          <button type="button" class="sow-bible-view-btn" disabled>${pickLabel(c.createButton)}</button>
        </div>
      </div>
      <div class="sow-card">
        <h4>${pickLabel(c.inviteTitle)}</h4>
        <div class="sow-group-form-row">
          <input type="email" placeholder="${pickLabel(c.inviteEmailPlaceholder)}" disabled>
          <button type="button" class="sow-bible-view-btn" disabled>${pickLabel(c.inviteButton)}</button>
        </div>
        <p style="font-size:11.5px;color:#9A8F6E;margin-top:10px;">${L().comingSoon}</p>
      </div>`;
    } else if(subId === 'overview'){
      html += `<div class="sow-card"><h4>${pickLabel(c.title)}</h4>`;
      if(c.toneBadge) html += `<span class="sow-required" style="border-color:var(--sprout);color:var(--sprout);">${pickLabel(c.toneBadge)}</span>`;
      if(c.intro) html += `<p>${pickLabel(c.intro)}</p>`;
      if(c.previewNote) html += `<p style="font-size:12px;color:var(--ink-soft);font-weight:600;margin-top:14px;">${pickLabel(c.previewNote)}</p>`;
      if(Array.isArray(c.sampleMembers)){
        html += `<div class="sow-board-preview">` + c.sampleMembers.map(m => `
          <div class="sow-board-row">
            <span class="sow-board-name">${m.name}</span>
            <span class="sow-board-course">${m.course}</span>
            <span class="sow-board-progress">${m.progress}</span>
          </div>`).join('') + `</div>`;
      }
      html += `<p style="font-size:11.5px;color:#9A8F6E;margin-top:12px;">${L().comingSoon}</p></div>`;
    } else {
      html += `<div class="sow-card"><h4>${pickLabel(c.title)}</h4>`;
      if(c.toneBadge) html += `<span class="sow-required" style="border-color:var(--sprout);color:var(--sprout);">${pickLabel(c.toneBadge)}</span>`;
      if(c.intro) html += `<p>${pickLabel(c.intro)}</p>`;
      if(c.shareHint) html += `<p style="font-size:12px;color:var(--sprout);font-weight:600;">${pickLabel(c.shareHint)}</p>`;
      if(c.emptyState) html += `<div class="sow-empty-note" style="margin-top:10px;">${pickLabel(c.emptyState)}</div>`;
      html += `<p style="font-size:11.5px;color:#9A8F6E;margin-top:10px;">${L().comingSoon}</p></div>`;
    }

    container.innerHTML = html;
    container.querySelectorAll('[data-group-tab]').forEach(btn => {
      btn.onclick = () => { state.activeSub.meditation = btn.dataset.groupTab; renderModulePanel(document.getElementById('sow-main')); };
    });
  }

  /* ---------- 국어: 어휘 ---------- */
  async function renderKoreanVocab(container, real){
    const data = await fetchJSON(`/content/korean/vocab/${real.book}/${real.chapter}.json`);
    container.innerHTML = `<h2 class="sow-section-title serif">오늘의 어휘</h2>
      <div class="sow-word-list">` +
      data.relatedWords.map(w => `<div class="sow-word-row">
          <span class="e">${w.icon}</span>
          <span class="w"><mark>${w.word}</mark>${w.hanja ? `<span class="hanja">(${w.hanja})</span>` : ''}</span>
          <span class="d">${w.shortDesc}</span>
        </div>`).join('') +
      `</div>
      <div id="sow-vocab-quiz-slot"></div>`;
    renderVocabQuizToggle(container.querySelector('#sow-vocab-quiz-slot'), data.relatedWords);
  }

  /* ---------- 낱말 퀴즈 — 새 콘텐츠 없이 오늘의 어휘 5개를 그대로 재활용 ----------
     새 단어(정답) + 같은 날 다른 단어 중 2개(오답)를 섞어서 3지선다를 만든다.
     점수/등수는 안 보여준다 — "비교보다 기록"(1절 원칙 5)과 같은 이유로,
     맞았는지 틀렸는지 그 자리에서만 확인하고 넘어가는 가벼운 복습용이다. */
  function renderVocabQuizToggle(container, words){
    if(!words || words.length < 2){ return; } // 오답을 만들 단어가 부족하면 조용히 생략
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'sow-quiz-toggle';
    toggle.textContent = '🎯 낱말 퀴즈로 복습하기';
    container.appendChild(toggle);

    const quizWrap = document.createElement('div');
    quizWrap.hidden = true;
    container.appendChild(quizWrap);

    toggle.onclick = () => {
      toggle.hidden = true;
      quizWrap.hidden = false;
      runVocabQuiz(quizWrap, words);
    };
  }

  function runVocabQuiz(container, words){
    let idx = 0;
    function shuffle(arr){ return arr.map(v => [Math.random(), v]).sort((a,b)=>a[0]-b[0]).map(v=>v[1]); }

    function drawQuestion(){
      if(idx >= words.length){
        container.innerHTML = `<div class="sow-quiz-done">🌱 오늘 어휘 ${words.length}개 다 풀어봤어요!</div>`;
        return;
      }
      const correct = words[idx];
      const distractors = shuffle(words.filter(w => w.word !== correct.word)).slice(0, 2);
      const options = shuffle([correct, ...distractors]);

      container.innerHTML = `<div class="sow-quiz-card">
        <div class="sow-quiz-progress">${idx+1} / ${words.length}</div>
        <p class="sow-quiz-question">${correct.shortDesc}</p>
        <div class="sow-quiz-options">${options.map(o => `<button type="button" class="sow-quiz-opt" data-word="${o.word}">${o.word}</button>`).join('')}</div>
        <div class="sow-quiz-feedback"></div>
      </div>`;

      const feedback = container.querySelector('.sow-quiz-feedback');
      container.querySelectorAll('.sow-quiz-opt').forEach(btn => {
        btn.onclick = () => {
          if(btn.disabled) return;
          container.querySelectorAll('.sow-quiz-opt').forEach(b => b.disabled = true);
          const isCorrect = btn.dataset.word === correct.word;
          btn.classList.add(isCorrect ? 'correct' : 'wrong');
          if(!isCorrect){
            container.querySelector(`[data-word="${correct.word}"]`)?.classList.add('correct');
          }
          feedback.innerHTML = `${isCorrect ? '💛 맞아요!' : '괜찮아요, 정답은 <b>'+correct.word+'</b>예요'}
            <button type="button" class="sow-quiz-next">다음 →</button>`;
          feedback.querySelector('.sow-quiz-next').onclick = () => { idx++; drawQuestion(); };
        };
      });
    }
    drawQuestion();
  }

  async function renderKoreanHanja(container, real){
    const data = await fetchJSON(`/content/korean/hanja/${real.book}/${real.chapter}.json`);
    const h = data.hanja;
    container.innerHTML = `<h2 class="sow-section-title serif">오늘의 한자</h2>
      <div class="sow-card sow-hanja-card">
        <div id="sow-hanja-header-target" class="sow-hanja-char-big"><span class="sow-hanja-char-fallback">${h.character}</span></div>
        <div>
          <div class="sow-hanja-reading">${h.reading}</div>
          <div class="sow-hanja-tags">${h.meaningTags.join(' · ')}</div>
          ${h.radical || h.strokeCount ? `<div class="sow-hanja-meta">${h.radical ? `부수: ${h.radical}` : ''}${h.radical && h.strokeCount ? ' · ' : ''}${h.strokeCount ? `총 ${h.strokeCount}획` : ''}</div>` : ''}
          <p>${h.explanation}</p>
          ${h.origin ? `<p class="origin">🌱 <b>유래</b> — ${h.origin}</p>` : ''}
          <p class="bible-note">📖 ${h.bibleNote}</p>
        </div>
      </div>
      <div class="sow-hanzi-row">
        ${h.hasAnimation ? `<div class="sow-card sow-hanzi-writer-card">
          <h4>🖊️ 획순 보기</h4>
          <div id="sow-hanzi-anim-target" class="sow-hanzi-canvas"></div>
          <button type="button" class="sow-hanzi-btn" id="sow-hanzi-replay">↺ 다시보기</button>
        </div>` : ''}
        ${h.hasWritingPractice ? `<div class="sow-card sow-hanzi-writer-card">
          <h4>✍️ 써보기</h4>
          <div id="sow-hanzi-quiz-target" class="sow-hanzi-canvas"></div>
          <button type="button" class="sow-hanzi-btn" id="sow-hanzi-retry">↺ 다시 쓰기</button>
          <p class="sow-hanzi-quiz-msg"></p>
        </div>` : ''}
      </div>
      ${h.relatedWords && h.relatedWords.length ? `<div class="sow-card sow-hanja-related">
        <h4>📖 "${h.character}"이(가) 들어간 낱말</h4>
        <div class="sow-word-list">${h.relatedWords.map(w => `<div class="sow-word-row">
            <span class="w"><mark>${w.word}</mark><span class="hanja">(${w.hanja})</span></span>
            <span class="d">${w.meaning}</span>
          </div>`).join('')}</div>
      </div>` : ''}`;

    if(window.HanziWriter){
      // 상단 큰 한자도 애니메이션과 완전히 같은 렌더링 방식(HanziWriter)으로 그려서 글자체를 통일한다.
      const headerTarget = container.querySelector('#sow-hanja-header-target');
      headerTarget.innerHTML = '';
      try{
        const headerWriter = HanziWriter.create(headerTarget, h.character, {
          width: 208, height: 208, padding: 6, showOutline: true
        });
        headerWriter.showCharacter();
      }catch(_){ headerTarget.innerHTML = `<span class="sow-hanja-char-fallback">${h.character}</span>`; }

      if(h.hasAnimation){
        const animWriter = HanziWriter.create('sow-hanzi-anim-target', h.character, {
          width: 180, height: 180, padding: 8, showOutline: true,
          strokeAnimationSpeed: 1, delayBetweenStrokes: 300
        });
        animWriter.animateCharacter();
        container.querySelector('#sow-hanzi-replay').onclick = () => animWriter.animateCharacter();
      }
      if(h.hasWritingPractice){
        const msg = container.querySelector('.sow-hanzi-quiz-msg');
        function startQuiz(){
          msg.textContent = '';
          const quizWriter = HanziWriter.create('sow-hanzi-quiz-target', h.character, {
            width: 180, height: 180, padding: 8, showOutline: true
          });
          quizWriter.quiz({
            onComplete: () => { msg.textContent = `참 잘 썼어요, ${h.character}! 🈶`; }
          });
        }
        startQuiz();
        container.querySelector('#sow-hanzi-retry').onclick = () => {
          container.querySelector('#sow-hanzi-quiz-target').innerHTML = '';
          startQuiz();
        };
      }
    }
  }

  /* 나눔(글쓰기&토론) 카드 하나만 그리는 공용 함수 — "글쓰기&토론" 탭과 "어휘" 탭 맨 아래에서 둘 다 쓴다.
     콘텐츠 파일은 하나(content/korean/writing/...)뿐이라, 어디서 보든 같은 질문/같은 저장 키를 쓴다
     (같은 사람이 어휘 탭에서 쓰든 글쓰기&토론 탭에서 쓰든 하나의 답으로 이어진다).
     질문 3개는 라디오 버튼처럼 하나만 고를 수 있고, 답 입력칸은 질문 개수와 무관하게 하나뿐이다 —
     아이가 세 질문을 다 채울 필요 없이 마음에 드는 것 하나만 골라 자유롭게 쓰면 된다. */
  async function renderKoreanWritingCard(container, real){
    const data = await fetchJSON(`/content/korean/writing/${real.book}/${real.chapter}.json`);
    const questions = data.discussionQuestions;
    if(!questions || !questions.length){ container.innerHTML = `<div class="sow-empty-note" style="margin-top:20px;">${L().empty}</div>`; return; }
    container.innerHTML = `<div class="sow-card sow-prompt" style="margin-top:20px;">
        <div class="icon-row"><span class="emoji">✏️</span><h4>${pickLabel({ko:'이 중에서 마음에 드는 질문을 하나 골라보세요', en:'Pick a question you like'})}</h4>${data.required ? `<span class="sow-required">${L().required}</span>` : ''}</div>
        <div class="sow-discussion-list">${questions.map((q, i) => `<label class="sow-discussion-item">
            <input type="radio" name="sow-discussion-${real.book}-${real.chapter}" value="${i}">
            <span>${q.text}</span>
          </label>`).join('')}</div>
        <p class="sow-discussion-guide">${data.writingGuide || ''}</p>
        <div><textarea rows="6" class="sow-writing-textarea" placeholder="여기에 적거나 음성으로 말해보세요" ${voiceAttrs(data.input)} ${persistAttr(`korean:${real.book}:${real.chapter}:writing`)}></textarea></div>
      </div>`;
    container.querySelectorAll('.sow-discussion-item input[type="radio"]').forEach(input => {
      input.addEventListener('change', () => {
        container.querySelectorAll('.sow-discussion-item').forEach(item => item.classList.remove('active'));
        input.closest('.sow-discussion-item').classList.add('active');
      });
    });
  }

  async function renderKoreanWriting(container, real){
    container.innerHTML = `<h2 class="sow-section-title serif">글쓰기 & 토론</h2><div id="sow-writing-tab-slot"></div>`;
    await renderKoreanWritingCard(container.querySelector('#sow-writing-tab-slot'), real);
  }

  /* ---------- 언어 ---------- */
  async function renderWorldLanguages(container, trackId, langId, real){
    const data = await fetchJSON(`/content/world-languages/${langId}/${real.book}/${real.chapter}.json`);
    let html = '';
    (data.levels || []).forEach(lv => {
      const list = (lv.sentences && lv.sentences.length)
        ? `<ul class="sow-sentence-list">${lv.sentences.map(s => `<li>${typeof s === 'string' ? s : s.text}</li>`).join('')}</ul>`
        : `<div class="sow-empty-note">${L().empty}</div>`;
      html += `<div class="sow-level-block"><div class="sow-level-label">${lv.icon} ${lv.label}</div>${list}</div>`;
    });
    if(data._note){ html += `<div class="sow-empty-note" style="margin-top:8px;">📝 ${data._note}</div>`; }
    container.innerHTML = html;
  }

  /* ---------- 성경관련 지식 ---------- */
  async function renderExplore(container, real, subId){
    const data = await fetchJSON(`/content/explore/${subId}/${real.book}/${real.chapter}.json`);
    let html = '';
    if(subId === 'map'){
      html += `<div class="sow-empty-note" style="border-style:solid;font-style:normal;">🗺️ ${data.mapNote || ''}</div>`;
      html += (data.locations || []).map(l => `<div class="sow-card sow-item-card"><div class="e">📍</div><div><h4>${l.name || l.title}</h4><p>${l.desc}</p></div></div>`).join('');
    } else {
      html += (data.items || []).map(item => `<div class="sow-card sow-item-card"><div class="e">${item.icon}</div><div><h4>${item.title}</h4><div class="sub">${item.subtitle}</div><p>${item.desc}</p></div></div>`).join('');
    }
    container.innerHTML = html;
  }

  /* ---------- 지금 실제로 읽고 있는 책/장 계산 (트랙 종류 무관) ----------
     국어/언어/성경관련 지식은 이걸로 콘텐츠를 찾는다 — 그래야 어떤 성경묵상
     코스를 고르든(자유코스/하루한장/1년1독/어린이) 항상 실제 장 기준으로
     맞는 콘텐츠를 보여줄 수 있다(25-4절). */
  async function resolveRealChapter(trackId){
    if(trackId === 'elementary'){
      try{
        const data = await fetchJSON(`/content/meditation/elementary/steps/${BOOK}/${STEP}.json`);
        return { book: data.book || BOOK, chapter: data.chapter || 1 };
      }catch(_){
        return { book: BOOK, chapter: 1 };
      }
    }
    if(trackId === 'free'){
      try{
        const saved = JSON.parse(localStorage.getItem('sow.free.passage') || 'null');
        if(saved && saved.book) return { book: saved.book, chapter: saved.chapter || 1 };
      }catch(_){}
      return { book: BOOK, chapter: STEP || 1 };
    }
    // daily-chapter, bible-in-a-year 둘 다 성경 전체 장 순서를 계산해서 쓰는 코스라 같은 라이브러리가 필요
    const library = await fetchJSON('/content/bible/_library.json');
    if(trackId === 'bible-in-a-year'){
      const { start } = resolveYearPlanRange(STEP);
      const groups = groupYearPlanPassages(library, start, start);
      return { book: groups[0].book.id, chapter: groups[0].fromChapter };
    }
    // daily-chapter (기본값)
    const { book, chapter } = resolveDailyChapterPassage(library, STEP);
    return { book: book.id, chapter };
  }

  /* ---------- 서브탭 + 모듈 오케스트레이션 ---------- */
  async function getSubRegistry(moduleId, trackId){
    // 국어/언어/성경관련 지식은 어떤 성경묵상 코스를 따라가든(자유코스든 하루한장이든)
    // 서브탭 구성 자체(어휘/한자/나눔 등)는 항상 같다 — 트랙별로 안 나뉜다(25-4절).
    const key = moduleId + '/' + trackId;
    if(state.subRegistryCache[key]) return state.subRegistryCache[key];
    const reg = await fetchJSON(`/content/${moduleId}/_registry.json`);
    state.subRegistryCache[key] = reg.submodules;
    return reg.submodules;
  }

  const SUB_RENDERERS = {
    korean: { vocab: renderKoreanVocab, hanja: renderKoreanHanja, writing: renderKoreanWriting },
    'world-languages': null, // 언어 코드 자체가 submodule id라 동적으로 처리
    explore: { era: (c,real) => renderExplore(c,real,'era'), people: (c,real) => renderExplore(c,real,'people'), map: (c,real) => renderExplore(c,real,'map') }
  };

  async function renderModulePanel(main){
    main.innerHTML = `<div class="sow-loading">${L().loading}</div>`;
    const moduleId = state.activeModule;
    const modMeta = state.moduleRegistry.find(m => m.id === moduleId);

    /* "나의 성경읽기" 전용 화면 — 코스 선택/진행 상태와 완전히 무관한 독립 화면.
       nav의 "📅 나의 성경읽기" 바로가기가 goTo('meditation','myReading')로 여기로 보낸다. */
    if(moduleId === 'meditation' && state.activeSub.meditation === 'myReading'){
      main.innerHTML = '';
      window.SOWSessionToolbar?.render(main);
      return;
    }

    let tracks, trackId, trackMeta;

    if(modMeta && modMeta.followsTrackOf){
      // 국어/언어/성경관련 지식: 자체 코스 선택 화면 없음 — 성경묵상이 지금 고른 코스를 그대로 따라간다
      const parentId = modMeta.followsTrackOf;
      tracks = await getTrackRegistry(parentId);
      trackId = state.activeTrack[parentId];
      if(trackId === undefined){
        try{ trackId = localStorage.getItem(`sow.track.${parentId}`); }catch(_){ trackId = null; }
      }
      if(!trackId) trackId = resolveActiveTrackId(tracks); // 아직 안 골랐으면 조용히 기본값 — 선택화면 강제 안 함
      trackMeta = tracks.find(tr => tr.id === trackId) || tracks[0];
      main.innerHTML = '';
      // 성경묵상처럼 "지금 실제로 몇 장을 보고 있는지"를 배지에 같이 보여준다.
      let followReal = null;
      try{ followReal = await resolveRealChapter(trackId); }catch(_){}
      await renderFollowBadge(main, parentId, trackMeta, followReal);
    } else {
      tracks = await getTrackRegistry(moduleId);
      trackId = state.activeTrack[moduleId];
      if(trackId === undefined){
        try{ trackId = localStorage.getItem(`sow.track.${moduleId}`); }catch(_){ trackId = null; }
      }
      if(!trackId){
        if(needsTrackSelection(tracks)){
          renderTrackSelector(main, moduleId, tracks);
          return;
        }
        trackId = resolveActiveTrackId(tracks);
      }
      state.activeTrack[moduleId] = trackId;
      trackMeta = tracks.find(tr => tr.id === trackId) || tracks[0];
      main.innerHTML = '';
      if(needsTrackSelection(tracks)) renderTrackChangeLink(main, moduleId);
    }

    if(trackMeta.status !== 'active'){
      const body = document.createElement('div');
      main.appendChild(body);
      await renderTrackComingSoon(body, moduleId, trackId, trackMeta);
      return;
    }

    if(!trackMeta.stepless) await renderStepNavBar(main, trackId);
    await renderSharedChapterJumper(main, trackId, trackMeta);

    if(moduleId === 'meditation'){
      const bodyWrap = document.createElement('div');
      main.appendChild(bodyWrap);
      const activeSub = state.activeSub.meditation || 'steps';
      state.activeSub.meditation = activeSub;
      if(activeSub === 'steps'){
        try{
          if(trackMeta.stepless){
            await renderMeditationFree(bodyWrap);
          } else if(trackMeta.yearPlan){
            await renderMeditationYearPlan(bodyWrap, trackId);
          } else if(trackMeta.generated){
            await renderMeditationDailyChapter(bodyWrap, trackId);
          } else {
            await renderMeditationSteps(bodyWrap, trackId);
          }
          const linkRow = document.createElement('div');
          linkRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;';
          bodyWrap.appendChild(linkRow);

          const groupLink = document.createElement('button');
          groupLink.className = 'sow-voice-btn';
          groupLink.style.cssText = 'background:var(--sprout);';
          groupLink.textContent = '🌳 우리 그룹 보러가기';
          groupLink.onclick = () => { state.activeSub.meditation = 'overview'; renderModulePanel(main); };
          linkRow.appendChild(groupLink);

          // 지금 보고 있는 책/장을 그대로 유지한 채, 국어/언어 화면으로 바로 넘어간다.
          [
            { id: 'korean', icon: '🔥', label: '국어' },
            { id: 'world-languages', icon: '🌍', label: '언어' }
          ].forEach(m => {
            const meta = state.moduleRegistry.find(x => x.id === m.id);
            if(!meta) return;
            const btn = document.createElement('button');
            btn.className = 'sow-voice-btn';
            btn.style.cssText = 'background:var(--clay);';
            btn.textContent = `${m.icon} ${m.label} 보러가기`;
            btn.onclick = () => {
              state.activeModule = m.id;
              const url = new URL(location.href);
              url.searchParams.set('module', m.id);
              history.replaceState(null, '', url);
              window.SOWRenderNav?.();
              renderModulePanel(main);
            };
            linkRow.appendChild(btn);
          });
        }catch(_){
          renderStepNotReady(bodyWrap);
        }
      } else {
        await renderGroup(bodyWrap, trackId, activeSub);
      }
      window.SOWVoiceInput?.scan(main); window.SOWPersist?.scan(main);
      return;
    }

    // 국어 / 언어 / 성경관련 지식 — 전부 같은 패턴: 트랙 안 서브모듈 탭
    const submodules = await getSubRegistry(moduleId, trackId);
    const activeSub = state.activeSub[moduleId] || submodules[0].id;
    state.activeSub[moduleId] = activeSub;

    const subtabs = document.createElement('div');
    subtabs.className = 'sow-subtabs';
    submodules.forEach(s => {
      const btn = document.createElement('button');
      btn.className = s.id === activeSub ? 'active' : '';
      btn.innerHTML = `${s.icon || ''} ${pickLabel(s.label)}`;
      btn.onclick = () => { state.activeSub[moduleId] = s.id; renderModulePanel(main); };
      subtabs.appendChild(btn);
    });

    const body = document.createElement('div');
    main.appendChild(subtabs);
    main.appendChild(body);

    try{
      // 지금 실제로 읽고 있는 책/장(트랙 종류 무관) — 국어가 이걸 기준으로 콘텐츠를 찾는다(25-4절)
      const real = await resolveRealChapter(trackId);
      if(moduleId === 'world-languages'){
        await renderWorldLanguages(body, trackId, activeSub, real);
      } else if(moduleId === 'korean'){
        await SUB_RENDERERS.korean[activeSub](body, real);
      } else {
        await SUB_RENDERERS[moduleId][activeSub](body, real);
      }
    }catch(_){
      renderStepNotReady(body);
    }
    window.SOWVoiceInput?.scan(main); window.SOWPersist?.scan(main);
  }

  /* ---------- 아직 콘텐츠가 채워지지 않은 걸음으로 이동했을 때(쿼리로 임의 걸음 접근 가능해졌으므로) ---------- */
  function renderStepNotReady(container){
    container.innerHTML = `<div class="sow-card" style="text-align:center;">
      <div style="font-size:26px;">🌱</div>
      <h4 style="margin:8px 0 4px;">이 걸음은 아직 준비되지 않았어요</h4>
      <p style="font-size:13px;color:var(--forest-soft);">콘텐츠가 채워지는 대로 볼 수 있어요. "이전 걸음"으로 돌아가 보세요.</p>
    </div>`;
  }

  /* ---------- 상단 네비 겸 드로어(모바일)/사이드바(데스크톱) ---------- */
  async function init(){
    const nav = document.getElementById('sow-nav');
    const main = document.getElementById('sow-main');
    if(!nav || !main){ console.error('[SOW Shell] #sow-nav / #sow-main 요소가 필요합니다.'); return; }

    function closeDrawer(){ document.body.classList.remove('sow-drawer-open'); }
    document.getElementById('sow-hamburger')?.addEventListener('click', () => {
      document.body.classList.toggle('sow-drawer-open');
    });
    document.getElementById('sow-drawer-overlay')?.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeDrawer(); });

    const registry = await fetchJSON('/content/_module-registry.json');
    state.moduleRegistry = registry.modules.sort((a,b)=>a.order-b.order);
    const urlModule = new URLSearchParams(location.search).get('module');
    state.activeModule = (urlModule && state.moduleRegistry.some(m => m.id === urlModule))
      ? urlModule
      : state.moduleRegistry[0].id;

    function goTo(moduleId, activeSub){
      state.activeModule = moduleId;
      if(activeSub !== undefined) state.activeSub[moduleId] = activeSub;
      const url = new URL(location.href);
      url.searchParams.set('module', moduleId);
      history.replaceState(null, '', url);
      renderNav();
      renderModulePanel(main);
      closeDrawer();
    }

    /* 메뉴 안에서 "성경묵상" 옆 화살표를 누르면 그 아래 코스 목록(자유코스/하루한장/1년1독/어린이 코스)을
       바로 펼쳐서 보여준다 — 코스 선택 화면(main 영역)까지 안 가도 메뉴에서 바로 고를 수 있게. */
    async function renderCourseSublist(sublistEl, moduleId){
      const tracks = await getTrackRegistry(moduleId);
      let currentTrackId = state.activeTrack[moduleId];
      if(currentTrackId === undefined){
        try{ currentTrackId = localStorage.getItem(`sow.track.${moduleId}`); }catch(_){ currentTrackId = null; }
      }
      sublistEl.innerHTML = tracks.map(tr => `<button type="button" class="sow-nav-sub-btn ${tr.id===currentTrackId?'active':''}" data-track="${tr.id}">
          <span>${tr.icon || '📖'}</span><span>${pickLabel(tr.label)}</span>
        </button>`).join('');
      sublistEl.querySelectorAll('[data-track]').forEach(b => {
        b.onclick = (e) => {
          e.stopPropagation();
          const trackId = b.dataset.track;
          state.activeTrack[moduleId] = trackId;
          try{ localStorage.setItem(`sow.track.${moduleId}`, trackId); }catch(_){}
          goTo(moduleId, moduleId === 'meditation' ? 'steps' : undefined);
        };
      });
    }

    /* 국어/언어/성경관련 지식처럼 자체 코스는 없지만 서브탭(어휘/한자/나눔 등)이 있는
       모듈은, 그 서브탭 목록을 메뉴에서 바로 펼쳐볼 수 있게 한다. */
    async function renderSubmoduleSublist(sublistEl, moduleId){
      let trackId = state.activeTrack[moduleId];
      if(trackId === undefined){
        try{ trackId = localStorage.getItem(`sow.track.${moduleId}`); }catch(_){ trackId = null; }
      }
      if(!trackId) trackId = 'elementary'; // 아직 코스를 안 골랐으면 기본값으로 미리보기
      const submodules = await getSubRegistry(moduleId, trackId);
      const currentSub = state.activeSub[moduleId];
      sublistEl.innerHTML = submodules.map(s => `<button type="button" class="sow-nav-sub-btn ${s.id===currentSub && moduleId===state.activeModule?'active':''}" data-sub="${s.id}">
          <span>${s.icon || '📖'}</span><span>${pickLabel(s.label)}</span>
        </button>`).join('');
      sublistEl.querySelectorAll('[data-sub]').forEach(b => {
        b.onclick = (e) => {
          e.stopPropagation();
          goTo(moduleId, b.dataset.sub);
        };
      });
    }

    function renderNav(){
      nav.innerHTML = '';

      state.moduleRegistry.forEach(m => {
        const row = document.createElement('div');
        row.className = 'sow-nav-item';

        const btnRow = document.createElement('div');
        btnRow.className = 'sow-nav-btn-row';

        const btn = document.createElement('button');
        btn.className = 'sow-nav-btn' + (m.id === state.activeModule ? ' active' : '');
        btn.innerHTML = `<span>${m.icon}</span><span>${pickLabel(m.label)}</span>`;
        btn.onclick = () => goTo(m.id, m.id === 'meditation' ? 'steps' : undefined);
        btnRow.appendChild(btn);

        let sublist = null;
        const accordionKind = m.hasTracks ? 'tracks' : (m.followsTrackOf ? 'submodules' : null);
        if(accordionKind){
          const isOpen = m.id === state.activeModule; // 지금 보고 있는 모듈이면 목록을 기본으로 펼쳐둔다
          const chevron = document.createElement('button');
          chevron.type = 'button';
          chevron.className = 'sow-nav-chevron';
          chevron.setAttribute('aria-label', '목록 펼치기/접기');
          chevron.textContent = isOpen ? '▾' : '▸';
          btnRow.appendChild(chevron);

          sublist = document.createElement('div');
          sublist.className = 'sow-nav-sublist';
          sublist.hidden = !isOpen;
          const fillSublist = () => accordionKind === 'tracks'
            ? renderCourseSublist(sublist, m.id)
            : renderSubmoduleSublist(sublist, m.id);
          if(isOpen) fillSublist();

          chevron.onclick = (e) => {
            e.stopPropagation();
            const willOpen = sublist.hidden;
            sublist.hidden = !willOpen;
            chevron.textContent = willOpen ? '▾' : '▸';
            if(willOpen) fillSublist();
          };
        }

        row.appendChild(btnRow);
        if(sublist) row.appendChild(sublist);
        nav.appendChild(row);
      });

      const divider = document.createElement('div');
      divider.className = 'sow-nav-divider';
      nav.appendChild(divider);

      // "나의 성경읽기"는 이제 전용 화면이 있다(달력/지도 + 오늘의 활동 요약) —
      // 코스 카드나 묵상 질문 없이 이것만 딱 보여주는 화면으로 이동한다.
      const myReadingBtn = document.createElement('button');
      myReadingBtn.className = 'sow-nav-btn';
      myReadingBtn.innerHTML = `<span>📅</span><span>나의 성경읽기</span>`;
      myReadingBtn.onclick = () => goTo('meditation', 'myReading');
      nav.appendChild(myReadingBtn);

      const groupBtn = document.createElement('button');
      groupBtn.className = 'sow-nav-btn';
      groupBtn.innerHTML = `<span>🗺️</span><span>우리의 성경읽기</span>`;
      groupBtn.onclick = () => goTo('meditation', 'overview');
      nav.appendChild(groupBtn);

      const authWrap = document.createElement('div');
      authWrap.id = 'sow-auth';
      nav.appendChild(authWrap);
      window.SOWAuthWidget?.render(authWrap);
    }

    window.SOWRenderNav = renderNav; // renderModulePanel(다른 스코프)에서도 메뉴 활성 표시를 갱신할 수 있게

    renderNav();
    await renderModulePanel(main);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
