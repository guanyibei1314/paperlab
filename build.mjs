import { build } from 'esbuild';
import fs from 'fs';
const minify = process.argv.includes('--min');
const r = await build({
  entryPoints: ['src/main.js'], bundle: true, format: 'esm', write: false,
  external: ['three', 'three/addons/*'], minify, target: 'es2020', charset: 'utf8', legalComments: 'none',
});
let js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync('src/style.css', 'utf8');
const fonts = fs.existsSync('dist/fonts.css') && !process.argv.includes('--nofonts') ? fs.readFileSync('dist/fonts.css', 'utf8') : '';
const chars = fs.existsSync('dist/chars.txt') ? fs.readFileSync('dist/chars.txt', 'utf8') : '';
let html = fs.readFileSync('src/template.html', 'utf8');
html = html.replace('/*__FONTS__*/', () => fonts).replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => `window.__ALLCHARS=${JSON.stringify(chars)};\n` + js);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/app.js', js);
fs.writeFileSync('dist/index.html', html);
console.log('built', (html.length / 1024).toFixed(0) + ' KB', minify ? '(min)' : '');
