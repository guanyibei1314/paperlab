// 用法: node shot.mjs <outprefix> <w>x<h> [js-steps-file]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import fs from 'fs';
import path from 'path';
const [,, out, size = '1600x900', stepsFile] = process.argv;
const [W, H] = size.split('x').map(Number);
const html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync('dist/index.html', 'utf8') + '</body></html>';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => logs.push('pageerror: ' + e.message));
await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', async (route) => {
  const u = new URL(route.request().url());
  const p = path.join('node_modules/three', u.pathname.replace('/npm/three@0.170.0/', ''));
  try { await route.fulfill({ body: fs.readFileSync(p), contentType: 'application/javascript' }); } catch (e) { await route.abort(); }
});
await page.route('https://fonts.googleapis.com/**', r => r.abort());
await page.route('http://local/**', r => r.fulfill({ body: html, contentType: 'text/html' }));
const hash = process.env.HASH || '';
await page.goto('http://local/index.html' + hash);
await page.waitForTimeout(+(process.env.WAIT || 3500));
let steps = [];
if (stepsFile) steps = JSON.parse(fs.readFileSync(stepsFile, 'utf8'));
let k = 0;
await page.screenshot({ path: `${out}_0.png` });
for (const s of steps) {
  k++;
  if (s.eval) { const r = await page.evaluate(s.eval); if (r !== undefined) console.log('eval:', JSON.stringify(r)); }
  if (s.click) await page.mouse.click(s.click[0], s.click[1]);
  if (s.clickPage) { const [px, py] = await page.evaluate((a) => window.__app.screenOf(a[0], a[1], a[2]), s.clickPage); console.log('click at', px, py); await page.mouse.click(px, py); }
  if (s.after) { const r = await page.evaluate(s.after); if (r !== undefined) console.log('after:', JSON.stringify(r)); }
  if (s.drag) { const [x0, y0, x1, y1, n = 10, dt = 16] = s.drag; await page.mouse.move(x0, y0); await page.mouse.down(); for (let i = 1; i <= n; i++) { await page.mouse.move(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); await page.waitForTimeout(dt); } await page.mouse.up(); }
  if (s.key) await page.keyboard.press(s.key);
  await page.waitForTimeout(s.wait || 1500);
  if (s.shot !== false) await page.screenshot({ path: `${out}_${k}.png` });
}
console.log(logs.slice(0, 30).join('\n') || 'no console errors');
await browser.close();
