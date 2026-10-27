import { createRequire } from 'module';
import fs from 'fs'; import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const svg = fs.readFileSync('site/assets/icon.svg', 'utf8');
for (const s of [180, 192, 512]) {
  const p = await browser.newPage({ viewport: { width: s, height: s } });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body></html>`);
  await p.screenshot({ path: `site/assets/icon-${s}.png`, omitBackground: true });
  await p.close();
}
// 分享卡片图：用真实页面截一张
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.route('http://local/**', async (route) => {
  const u = new URL(route.request().url());
  const f = path.join('site', u.pathname === '/' ? 'index.html' : u.pathname);
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  try { await route.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] || 'application/octet-stream' }); } catch (e) { await route.fulfill({ status: 404, body: '' }); }
});
await page.goto('http://local/');
await page.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 60000 });
await page.waitForTimeout(500);
await page.evaluate(() => { document.getElementById('dock').style.display = 'none'; window.__app.rig.setDock(0); window.__app.rig.setShot({ t: [0, 0, 1.2], yaw: 0, pitch: 56, size: [46, 26] }); window.__app.simulate(3); });
await page.screenshot({ path: 'site/assets/og.jpg', type: 'jpeg', quality: 82 });
await browser.close();
console.log('icons + og done');
