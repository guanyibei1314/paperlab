// 纸上实验室 离线缓存（版本 d7a01e6f68）
const CACHE = 'paperlab-d7a01e6f68';
const PRECACHE = ["./","index.html","assets/app-dd187fc568.js","assets/style-114ab5d91b.css","assets/fonts/caveat-500-normal-66778c2170.woff2","assets/fonts/caveat-600-normal-f10245c5e2.woff2","assets/fonts/ebgaramond-500-italic-f91925d3f8.woff2","assets/fonts/ebgaramond-500-normal-97b481de92.woff2","assets/fonts/longcang-400-normal-d4f7e3e5b7.woff2","assets/fonts/notoserifsc-400-normal-a30f44f47a.woff2","assets/fonts/notoserifsc-700-normal-1147e2e7c3.woff2","assets/fonts/notoserifsc-900-normal-cecfeaefe0.woff2","assets/icon.svg","assets/icon-192.png","manifest.webmanifest"];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('paperlab-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // 页面：先联网取最新，断网时用缓存
    e.respondWith(fetch(req).then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put('index.html', cp)); return res; }).catch(() => caches.match('index.html')));
    return;
  }
  // 静态资源（文件名带指纹）：缓存优先
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return res; })));
});
