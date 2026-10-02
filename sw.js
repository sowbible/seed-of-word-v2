/* =========================================================
   SOW Service Worker — PWA 오프라인/설치 지원
   전략:
   - 앱 껍데기(CSS/JS/아이콘/manifest): 캐시 우선 (Cache First)
     → 자주 안 바뀌는 파일이라 빠르게 뜨는 게 중요
   - 페이지(HTML)와 콘텐츠(JSON, 성경 본문/퀴즈 등): 네트워크 우선 (Network First)
     → 항상 최신 콘텐츠를 보여주되, 인터넷이 안 될 때는
       마지막으로 봤던 캐시를 보여줘서 완전히 먹통은 되지 않게 함

   버전(CACHE_NAME)을 바꾸면 예전 캐시를 정리하고 새로 채운다 —
   shell.css/js를 크게 고친 뒤에는 이 버전 문자열을 한 번씩 올려주면
   사용자들이 예전 캐시에 갇히지 않는다.
   ========================================================= */
const CACHE_VERSION = 'sow-v2';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const CONTENT_CACHE = `${CACHE_VERSION}-content`;

const SHELL_ASSETS = [
  '/app/css/shell.css',
  '/app/js/shell.js',
  '/app/js/persist.js',
  '/app/js/session-toolbar.js',
  '/app/js/supapase-client.js',
  '/app/js/auth-widget.js',
  '/app/js/bible-link.js',
  '/app/js/reading-map.js',
  '/app/js/voice-text-input.js',
  '/manifest.json',
  '/app/icons/icon-192.png',
  '/app/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // 하나라도 404면 전체 설치가 실패하지 않도록, 개별로 시도한다
      Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('sow-') && key !== SHELL_CACHE && key !== CONTENT_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function isShellAsset(url){
  return SHELL_ASSETS.some((p) => url.pathname === p);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if(request.method !== 'GET') return; // POST 등은 그냥 통과
  const url = new URL(request.url);
  if(url.origin !== location.origin) return; // 외부 요청(CDN 등)은 건드리지 않음

  if(isShellAsset(url)){
    // 캐시 우선 — 없으면 네트워크에서 가져와서 캐시에 채워둔다
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
      )
    );
    return;
  }

  // 나머지(페이지 HTML, /content/ 아래 JSON 등) — 네트워크 우선, 실패하면 캐시
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CONTENT_CACHE).then((cache) => cache.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request))
  );
});
