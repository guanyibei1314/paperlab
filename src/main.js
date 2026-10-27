import { App } from './app.js';
const app = new App();
window.__app = app;
app.init().catch((e) => {
  console.error(e);
  const m = document.getElementById('ldmsg');
  if (m) m.textContent = '加载失败：' + (e && e.message ? e.message : e) + '。请刷新页面重试；如果仍然不行，可能是浏览器关闭了 WebGL 硬件加速。';
});
