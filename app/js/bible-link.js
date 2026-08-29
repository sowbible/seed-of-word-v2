/* =========================================================
   SOW Bible Link Widget — "성경 보기(godpia 연동)" + 직접 범위 입력
   레거시(sow-platform.js)의 BIBLE_LIBRARY/GODPIA_VOL/역본 select를
   새 구조(content/bible/_library.json, _versions.json)로 재구현.

   v2(2026-08-29): 66권 그리드로 고르는 피커를 없애고, "직접 입력" 한 줄로
   단순화했다 — 항상 보이는 입력창에 "로마서 3장"처럼 쓰면 바로 godpia로 간다.

   사용법: window.SOWBibleLink.render(containerEl, { book:'john', chapter:1, basePath:'' })
   - 직접 입력으로 다른 책/장을 봐도 위젯 상단 표시나 앱의 현재 걸음은 안 바뀐다
     (그냥 godpia 새 탭 열람만 하는 것).
   ========================================================= */
(function(){
  const dataCache = {};
  async function fetchJSON(basePath, path){
    const key = basePath + path;
    if(dataCache[key]) return dataCache[key];
    const res = await fetch(basePath + path);
    if(!res.ok) throw new Error('fetch 실패: ' + path);
    const json = await res.json();
    dataCache[key] = json;
    return json;
  }

  function buildUrl(provider, versionId, godpiaVol, chapter){
    return provider.urlPattern
      .replace('{baseUrl}', provider.baseUrl)
      .replace('{versionCode}', encodeURIComponent(versionId))
      .replace('{godpiaVol}', encodeURIComponent(godpiaVol))
      .replace('{chapter}', encodeURIComponent(chapter));
  }

  function findBook(library, bookId){
    const all = [...library.oldTestament.books, ...library.newTestament.books];
    return all.find(b => b.id === bookId) || null;
  }

  /* "로마서 3장", "로마서 3:1-4:25" 같은 직접 입력에서 책 이름 + 장 번호를 추출 */
  function parseFreeRange(text, library){
    const raw = (text || '').trim();
    if(!raw) return null;
    const chapterMatch = raw.match(/(\d+)/);
    const chapter = chapterMatch ? Number(chapterMatch[1]) : 1;
    const namePart = raw.replace(/[0-9].*$/, '').trim();
    if(!namePart) return null;
    const all = [...library.oldTestament.books, ...library.newTestament.books];
    let book = all.find(b => b.shortKo === namePart || b.id === namePart);
    if(!book) book = all.find(b => namePart.includes(b.shortKo));
    if(!book) book = all.find(b => b.shortKo.includes(namePart));
    return book ? { bookId: book.id, chapter } : null;
  }

  async function render(container, opts){
    const basePath = opts.basePath || '';
    const locale = opts.locale || 'ko';
    const [library, versions] = await Promise.all([
      fetchJSON(basePath, '/content/bible/_library.json'),
      fetchJSON(basePath, '/content/bible/_versions.json')
    ]);

    const state = {
      bookId: opts.book,
      chapter: opts.chapter || 1,
      versionId: (versions.versions.find(v => v.default) || versions.versions[0]).id
    };

    function label(obj){ return (obj && (obj[locale] || obj.ko)) || ''; }
    function currentBook(){ return findBook(library, state.bookId) || { shortKo: state.bookId, godpiaVol: 'jhn' }; }

    function openReading(bookId, chapter){
      const b = findBook(library, bookId) || currentBook();
      const url = buildUrl(versions.provider, state.versionId, b.godpiaVol, chapter);
      window.open(url, '_blank', 'noopener,noreferrer');
    }

    function draw(){
      const book = currentBook();
      container.innerHTML = `
        <div class="sow-bible-widget">
          <div class="sow-bible-widget-row">
            <span class="sow-bible-current">📖 <b>${book.shortKo} ${state.chapter}장</b></span>
            <select class="sow-version-select" aria-label="성경 역본 선택">
              ${versions.versions.map(v => `<option value="${v.id}" ${v.id===state.versionId?'selected':''}>${label(v.label)}</option>`).join('')}
            </select>
            <button type="button" class="sow-bible-view-btn">성경 보기 ↗</button>
          </div>
          <div class="sow-bible-free-range">
            <input type="text" class="sow-free-range-input" placeholder="다른 본문 직접 입력 · 예: 로마서 3장">
            <button type="button" class="sow-free-range-go">이동 →</button>
          </div>
          <div class="sow-free-range-msg"></div>
        </div>`;

      container.querySelector('.sow-version-select').onchange = (e) => { state.versionId = e.target.value; };
      container.querySelector('.sow-bible-view-btn').onclick = () => openReading(state.bookId, state.chapter);

      const freeInput = container.querySelector('.sow-free-range-input');
      const freeGoBtn = container.querySelector('.sow-free-range-go');
      const freeMsg = container.querySelector('.sow-free-range-msg');
      const submitFreeRange = () => {
        const parsed = parseFreeRange(freeInput.value, library);
        if(!parsed){
          freeMsg.textContent = '책 이름을 찾을 수 없어요. 예: "로마서 3장"처럼 입력해 보세요.';
          return;
        }
        freeMsg.textContent = '';
        openReading(parsed.bookId, parsed.chapter);
      };
      freeGoBtn.onclick = submitFreeRange;
      freeInput.onkeydown = (e) => { if(e.key === 'Enter'){ e.preventDefault(); submitFreeRange(); } };
    }

    draw();
  }

  window.SOWBibleLink = { render };
})();
