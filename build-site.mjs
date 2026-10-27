// 生产构建：输出到 site/ —— 纯静态文件，不依赖任何外部 CDN，可直接上传到任何静态托管
import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const OUT = 'site';
const A = path.join(OUT, 'assets');
fs.mkdirSync(A, { recursive: true });
for (const f of fs.readdirSync(A)) if (/^(app|style)-.*\.(js|css)$/.test(f)) fs.unlinkSync(path.join(A, f));

const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

// 1. JS：把 three.js 一起打包（不走 CDN）
const r = await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', write: false, minify: true, target: 'es2020', charset: 'utf8', legalComments: 'eof' });
const js = r.outputFiles[0].text;
const jsName = `app-${hash(js)}.js`;
fs.writeFileSync(path.join(A, jsName), js);

// 2. CSS
const cssR = await build({ entryPoints: ['src/style.css'], bundle: true, write: false, minify: true, loader: { '.css': 'css' } });
const css = cssR.outputFiles[0].text;
const cssName = `style-${hash(css)}.css`;
fs.writeFileSync(path.join(A, cssName), css);

// 3. 字体（由 fonts.py --files site/assets/fonts 生成）
const fontsCss = fs.readFileSync('dist/fonts-files.css', 'utf8');
const fontFiles = fs.readdirSync(path.join(A, 'fonts')).filter(f => f.endsWith('.woff2')).map(f => `assets/fonts/${f}`);
const chars = fs.readFileSync('dist/chars.txt', 'utf8');

// 4. 页面主体：取模板里 #app 那一段
const tpl = fs.readFileSync('src/template.html', 'utf8');
const body = tpl.slice(tpl.indexOf('<div id="app">'), tpl.indexOf('<script type="importmap">'));
const SITE_TITLE = '运动的理由 · 纸上实验室';
const DESC = '一本摊在书桌上的 3D 立体物理书：8 个可以亲手做的实验，读懂牛顿三大定律。对应人教版八年级下册《运动和力》与高中物理必修第一册。';
const version = hash(js + css + fontsCss);

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${SITE_TITLE}</title>
<meta name="description" content="${DESC}">
<meta name="theme-color" content="#2f4470">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="assets/icon.svg" type="image/svg+xml">
<link rel="icon" href="assets/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="assets/icon-180.png">
<link rel="manifest" href="manifest.webmanifest">
<meta property="og:type" content="website">
<meta property="og:title" content="${SITE_TITLE}">
<meta property="og:description" content="${DESC}">
<meta property="og:image" content="assets/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="assets/${jsName}" as="script">
${fontFiles.filter(f => /notoserifsc-400|notoserifsc-700/.test(f)).map(f => `<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>`).join('\n')}
<style>${fontsCss}</style>
<link rel="stylesheet" href="assets/${cssName}">
</head>
<body>
${body}
<noscript><p style="padding:24px;font-size:16px">这个网站需要开启 JavaScript 才能显示立体书。</p></noscript>
<script>window.__ALLCHARS=${JSON.stringify(chars)};</script>
<script src="assets/${jsName}" defer></script>
<script>
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.writeFileSync(path.join(OUT, '404.html'), html);

// 5. 离线缓存
const precache = ['./', 'index.html', `assets/${jsName}`, `assets/${cssName}`, ...fontFiles, 'assets/icon.svg', 'assets/icon-192.png', 'manifest.webmanifest'];
const sw = `// 纸上实验室 离线缓存（版本 ${version}）
const CACHE = 'paperlab-${version}';
const PRECACHE = ${JSON.stringify(precache)};
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
`;
fs.writeFileSync(path.join(OUT, 'sw.js'), sw);

const manifest = {
  name: '运动的理由 · 纸上实验室', short_name: '纸上实验室', lang: 'zh-CN', start_url: './', scope: './', display: 'standalone',
  background_color: '#d8d1c4', theme_color: '#2f4470', description: DESC,
  icons: [{ src: 'assets/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'assets/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'assets/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
};
fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nAllow: /\n');
// 字体许可证（SIL OFL 1.1）随站点一起发布
if (!fs.existsSync(path.join(A, 'fonts', 'LICENSE-fonts.txt'))) console.warn('missing font license file');

const size = (p) => fs.statSync(p).size;
const total = fs.readdirSync(A, { recursive: true }).map(f => path.join(A, f)).filter(p => fs.statSync(p).isFile()).reduce((s, p) => s + size(p), 0) + size(path.join(OUT, 'index.html'));
console.log(`site built: ${jsName} ${(js.length / 1024).toFixed(0)} KB, ${cssName}, ${fontFiles.length} fonts, total ${(total / 1024).toFixed(0)} KB, version ${version}`);
