import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = 'http://localhost:8765/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const external = [], errors = [];
await ctx.route('**/*', (route) => { const u = route.request().url(); if (!u.startsWith(base)) { external.push(u); return route.abort(); } return route.continue(); });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const t0 = Date.now();
await page.goto(base);
await page.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 60000 });
console.log('loaded in', Date.now() - t0, 'ms');
const fontsOk = await page.evaluate(() => ['400 30px "Noto Serif SC"', '900 30px "Noto Serif SC"', '400 30px "Long Cang"', '500 30px "Caveat"', 'italic 500 30px "EB Garamond"'].map(f => document.fonts.check(f, '运动的理由')));
console.log('fonts check', fontsOk);
await page.waitForTimeout(3000);
const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? (r.active ? 'active' : 'installing') : 'none'; });
console.log('service worker:', sw);
await page.evaluate(() => { __app.gotoId('l3'); __app.simulate(3); __app.goStep(2); __app.simulate(3); });
await page.screenshot({ path: '/tmp/claude-0/-home-claude/3d713a20-13cc-58d2-917c-aa9ca1b132f0/scratchpad/shots/site_l3.png' });
// 断网再打开
await ctx.setOffline(true);
const p2 = await ctx.newPage();
p2.on('pageerror', e => errors.push('offline: ' + e.message));
try {
  await p2.goto(base + '#l5');
  await p2.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 60000 });
  await p2.evaluate(() => { __app.simulate(3); });
  await p2.screenshot({ path: '/tmp/claude-0/-home-claude/3d713a20-13cc-58d2-917c-aa9ca1b132f0/scratchpad/shots/site_offline.png' });
  console.log('offline reload OK:', await p2.evaluate(() => __app.currentSpread().id));
} catch (e) { console.log('offline failed', e.message); }
console.log('external requests:', external.length ? external : 'none');
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
