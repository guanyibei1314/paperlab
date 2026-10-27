import { createRequire } from 'module';
import fs from 'fs'; import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = process.argv[2];
const html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync('dist/index.html', 'utf8') + '</body></html>';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', async (route) => { const u = new URL(route.request().url()); await route.fulfill({ body: fs.readFileSync(path.join('node_modules/three', u.pathname.replace('/npm/three@0.170.0/', ''))), contentType: 'application/javascript' }); });
await page.route('http://local/**', r => r.fulfill({ body: html, contentType: 'text/html' }));
await page.goto('http://local/index.html');
await page.waitForTimeout(4000);
for (const id of ['contents','l1','l2','l3','l4','l5','l6','l7','l8','end']) for (const side of [-1, 1]) {
  const d = await page.evaluate(([i, s]) => window.__app.pageImage(i, s), [id, side]);
  fs.writeFileSync(`${out}/${id}_${side < 0 ? 'L' : 'R'}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
}
await browser.close();
