// 页面上的 HTML 部件：导览条、实验控件、大字课文、各种面板
import { FORCES } from './const.js';
import { GLOSSARY, QUIZ, SOURCES } from '../content.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function richHTML(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\[(\w+)\|(.+?)\]/g, (m, k, t) => `<span class="f" style="--c:${FORCES[k] ? FORCES[k].color : 'inherit'}">${t}</span>`)
    .replace(/\$(.+?)\$/g, '<i>$1</i>');
}
export function mathHTML(s) {
  return esc(s)
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
    .replace(/'([^']*)'/g, '<span style="font-style:normal">$1</span>')
    .replace(/_([A-Za-z0-9一-鿿]+)/g, '<sub>$1</sub>')
    .replace(/\^([0-9]+)/g, '<sup>$1</sup>');
}

export class UI {
  constructor(app) {
    this.app = app;
    this.el = {
      cap: $('capt'), capn: $('capn'), dots: $('dots'), controls: $('controls'), play: $('bPlay'), sound: $('bSound'),
      sheet: $('sheet'), sheetBody: $('sheetBody'), sheetTitle: $('sheetTitle'), panel: $('panel'), panelTitle: $('panelTitle'), panelBody: $('panelBody'),
      toast: $('toast'), hint: $('hint'), sr: $('sr'), loading: $('loading'), ldmsg: $('ldmsg'),
    };
    $('bMenu').onclick = () => this.openPanel('contents');
    $('bPrev').onclick = () => app.prev();
    $('bNext').onclick = () => app.next();
    $('bPlay').onclick = () => app.togglePlay();
    $('bSound').onclick = () => app.toggleSound();
    $('bTheme').onclick = () => app.toggleTheme();
    $('bTeacher').onclick = () => this.openPanel('teacher');
    $('bText').onclick = () => this.toggleSheet();
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => (b.dataset.close === 'sheet' ? this.closeSheet() : this.closePanel()));
    this.el.panel.addEventListener('click', (e) => { if (e.target === this.el.panel) this.closePanel(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { if (!this.el.panel.hidden) this.closePanel(); else if (!this.el.sheet.hidden) this.closeSheet(); return; }
      if (!this.el.panel.hidden) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowRight') { app.next(); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { app.prev(); e.preventDefault(); }
      else if (e.key === ' ' && e.target === document.body) { app.togglePlay(); e.preventDefault(); }
    });
    this._toastT = 0;
  }
  progress(p, msg) { this.el.loading.querySelector('.ld-bar i').style.width = `${Math.round(p * 100)}%`; if (msg) this.el.ldmsg.textContent = msg; }
  doneLoading() { this.el.loading.classList.add('done'); setTimeout(() => (this.el.loading.hidden = true), 700); }
  setCaption(num, text) {
    this.el.capn.textContent = num || '';
    this.el.cap.textContent = text;
    this.el.sr.textContent = text;
  }
  setDots(n, cur) {
    const d = this.el.dots;
    if (d.childElementCount !== n) { d.innerHTML = ''; for (let i = 0; i < n; i++) { const s = document.createElement('i'); s.onclick = () => this.app.goStep(i); d.appendChild(s); } }
    [...d.children].forEach((c, i) => { c.className = i === cur ? 'on' : i < cur ? 'done' : ''; });
  }
  setPlaying(p) { this.el.play.classList.toggle('playing', p); this.el.play.setAttribute('aria-label', p ? '暂停' : '自动播放'); }
  setSound(on) { this.el.sound.classList.toggle('off', !on); this.el.sound.setAttribute('aria-label', on ? '关闭声音' : '打开声音'); }
  toast(msg, ms = 2800) {
    const t = this.el.toast; t.textContent = msg; t.hidden = false;
    clearTimeout(this._toastT); this._toastT = setTimeout(() => (t.hidden = true), ms);
  }
  hint(msg) { const h = this.el.hint; if (!msg) { h.hidden = true; return; } h.textContent = msg; h.hidden = false; }

  // 实验控件（与书页上画的控件同步）
  setControls(L, st, visible) {
    const box = this.el.controls;
    if (!L || !visible) { box.hidden = true; box.innerHTML = ''; this._ctrlKey = ''; return; }
    const key = L.id + JSON.stringify(st.ctrl);
    if (key === this._ctrlKey && !box.hidden) return;
    this._ctrlKey = key;
    box.innerHTML = '';
    const btns = [];
    for (const c of L.controls) {
      if (c.type === 'button') { btns.push(c); continue; }
      const g = document.createElement('div'); g.className = 'cgroup';
      const lab = document.createElement('span'); lab.className = 'lab'; lab.textContent = c.label; g.appendChild(lab);
      if (c.type === 'choice') {
        const seg = document.createElement('div'); seg.className = 'seg'; seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', c.label);
        for (const [v, l] of c.options) {
          const b = document.createElement('button'); b.textContent = l; b.setAttribute('aria-pressed', String(st.ctrl[c.id] === v));
          b.onclick = () => this.app.action({ type: 'opt', ctrl: c.id, value: v });
          seg.appendChild(b);
        }
        g.appendChild(seg);
      } else if (c.type === 'stepper') {
        const seg = document.createElement('div'); seg.className = 'seg';
        const m = document.createElement('button'); m.textContent = '−'; m.setAttribute('aria-label', `减少${c.label}`); m.onclick = () => this.app.action({ type: 'step', ctrl: c.id, delta: -1 });
        const v = document.createElement('span'); v.className = 'stepv'; v.textContent = c.fmt ? c.fmt(st.ctrl[c.id]) : st.ctrl[c.id];
        const p = document.createElement('button'); p.textContent = '+'; p.setAttribute('aria-label', `增加${c.label}`); p.onclick = () => this.app.action({ type: 'step', ctrl: c.id, delta: 1 });
        seg.append(m, v, p); g.appendChild(seg);
      }
      box.appendChild(g);
    }
    if (btns.length) {
      const g = document.createElement('div'); g.className = 'cgroup btn';
      btns.forEach((c, i) => {
        const b = document.createElement('button'); b.className = 'chip' + (i === 0 ? ' primary' : ''); b.textContent = c.label;
        b.onclick = () => this.app.action({ type: 'btn', ctrl: c.id });
        g.appendChild(b);
      });
      box.appendChild(g);
    }
    box.hidden = false;
  }

  // 大字版课文
  toggleSheet() { if (this.el.sheet.hidden) this.openSheet(); else this.closeSheet(); }
  openSheet() { this.el.sheet.hidden = false; this.renderSheet(); $('bText').setAttribute('aria-pressed', 'true'); }
  closeSheet() { this.el.sheet.hidden = true; $('bText').setAttribute('aria-pressed', 'false'); }
  renderSheet() {
    if (this.el.sheet.hidden) return;
    const L = this.app.currentLesson();
    const body = this.el.sheetBody;
    if (!L) {
      this.el.sheetTitle.textContent = '运动的理由';
      body.innerHTML = `<div class="k">纸上实验室 · 物理 · 第一册</div><h3>运动的理由</h3><p>一本关于力与运动的立体物理书。物体为什么会动起来、停下来、越来越快？牛顿用三句话回答了。</p>
      <div class="k">怎样读这本书</div><ol><li>先在左页勾一个预测，再动手。</li><li>看右页的插图从纸上立起来。</li><li>拖一拖、点一点图里的器材，亲手试一试。</li><li>掀开"为什么"，看看原因。</li><li>完成页边的挑战，盖一枚印章。</li></ol>
      <div class="k">书里的力</div><div class="legend">${Object.values(FORCES).map(f => `<span><i style="--c:${f.color}"></i>${f.name}</span>`).join('')}</div>`;
      return;
    }
    const st = this.app.lessonState(L.id);
    this.el.sheetTitle.textContent = `第 ${L.num} 课 · ${L.title}`;
    const opts = L.predict.options.map((o, i) => {
      let cls = 'qopt';
      if (st.flapOpen && st.pred != null) cls += i === L.predict.answer ? ' right' : (i === st.pred ? ' wrong' : '');
      return `<button class="${cls}" data-pred="${i}" aria-pressed="${st.pred === i}">${esc(o)}${st.flapOpen && i === L.predict.answer ? '　✓' : ''}</button>`;
    }).join('');
    body.innerHTML = `
      <div class="k">第 ${L.num} 课</div><h3>${esc(L.title)}</h3>
      <p>${richHTML(L.intro)}</p>
      <div class="formula">${mathHTML(L.formula.expr)}<small>${richHTML(L.formula.note)}</small></div>
      <div class="k">关键词</div>
      <dl class="terms">${L.terms.map(([t, d]) => `<dt>${richHTML(t)}</dt><dd>${richHTML(d)}</dd>`).join('')}</dl>
      <div class="k">预测</div>
      <p><b>${esc(L.predict.q)}</b></p>
      <div class="popts">${opts}</div>
      <div class="reveal">${st.flapOpen ? `<b>为什么？</b><p>${richHTML(this.app.whyText(L))}</p><button data-flap="0">合上</button>` : `<b>为什么？</b> <button data-flap="1">掀开看答案</button>`}</div>
      <div class="k">挑战</div>
      <p class="hand">${esc(L.challenge)}${st.stamped ? '　<b style="color:var(--seal)">已完成</b>' : ''}</p>`;
    body.querySelectorAll('[data-pred]').forEach(b => b.onclick = () => this.app.action({ type: 'pred', i: +b.dataset.pred }));
    body.querySelectorAll('[data-flap]').forEach(b => b.onclick = () => this.app.setFlap(b.dataset.flap === '1'));
  }

  openPanel(id) {
    const P = this.el.panelBody;
    const app = this.app;
    let title = '';
    if (id === 'contents') {
      title = '目录';
      const rows = app.spreadList().map(s => `<li><button data-goto="${s.id}"><span class="n">${s.num || ''}</span><span>${esc(s.title)} <span class="s">${esc(s.sub || '')}</span></span><span class="st">${s.stamped ? '已盖章' : ''}</span></button></li>`).join('');
      P.innerHTML = `<ul class="toc">${rows}</ul>
        <h4>附录</h4><ul class="toc">
        <li><button data-panel="glossary"><span class="n"></span><span>索引</span><span></span></button></li>
        <li><button data-panel="quiz"><span class="n"></span><span>小测验</span><span></span></button></li>
        <li><button data-panel="sources"><span class="n"></span><span>资料来源</span><span></span></button></li>
        <li><button data-panel="teacher"><span class="n"></span><span>教师笔记</span><span></span></button></li></ul>`;
    } else if (id === 'teacher') {
      title = '教师笔记';
      const L = app.currentLesson();
      const list = L ? [L] : app.lessons;
      P.innerHTML = (L ? '' : '<p>这本书按"预测 → 观察 → 动手 → 解释 → 挑战"组织每一课。所有数值都由页面里的物理模型实时计算；真实数据注明了出处，示意参数在图注里标明。</p>') +
        list.map(T => `<h4>第 ${T.num} 课 · ${esc(T.title)}</h4>
        <p><b>对应教材：</b>${esc(T.teacher.book)}</p>
        <p><b>常见误区：</b></p><ul>${T.teacher.mis.map(m => `<li>${esc(m)}</li>`).join('')}</ul>
        <p><b>模型与数据：</b>${esc(T.teacher.notes)}</p>
        <p><b>课堂讨论：</b>${esc(T.teacher.discuss)}</p>`).join('');
    } else if (id === 'glossary') {
      title = '索引';
      P.innerHTML = `<dl class="gl">${GLOSSARY.map(g => `<dt>${esc(g.t)}</dt><dd>${richHTML(g.d)} <span>— 第 ${g.l} 课</span></dd>`).join('')}</dl>`;
    } else if (id === 'quiz') {
      title = '小测验';
      P.innerHTML = QUIZ.map((q, i) => `<div class="quiz" data-q="${i}"><div class="quiz-q">${i + 1}. ${esc(q.q)}</div><div class="popts">${q.o.map((o, j) => `<button class="qopt" data-qi="${i}" data-oj="${j}">${esc(o)}</button>`).join('')}</div><div class="quiz-e" hidden></div></div>`).join('') + '<p id="qscore" class="hand"></p>';
      const answered = {};
      P.querySelectorAll('[data-qi]').forEach(b => b.onclick = () => {
        const i = +b.dataset.qi, j = +b.dataset.oj; if (answered[i] != null) return;
        answered[i] = j; const q = QUIZ[i];
        const box = P.querySelector(`[data-q="${i}"]`);
        box.querySelectorAll('.qopt').forEach((x, k) => { if (k === q.a) x.classList.add('right'); if (k === j && j !== q.a) x.classList.add('wrong'); x.setAttribute('aria-pressed', String(k === j)); });
        const e = box.querySelector('.quiz-e'); e.hidden = false; e.textContent = (j === q.a ? '答对了。' : '再想想。') + q.e;
        const n = Object.keys(answered).length;
        if (n === QUIZ.length) { const s = QUIZ.filter((qq, k) => answered[k] === qq.a).length; P.querySelector('#qscore').textContent = `答对 ${s} / ${QUIZ.length} 题`; }
        app.sfx.tick();
      });
    } else if (id === 'sources') {
      title = '资料来源';
      P.innerHTML = `<p>书中的真实数据来自以下资料；标注"示意"的参数是为了让模型可以运行而设定的，不是实测值。</p><ol class="src">${SOURCES.map(s => `<li>${esc(s.t)}<br><a href="${s.u}" target="_blank" rel="noopener">${esc(s.u)}</a></li>`).join('')}</ol>`;
    }
    this.el.panelTitle.textContent = title;
    P.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => { this.closePanel(); app.gotoId(b.dataset.goto); });
    P.querySelectorAll('[data-panel]').forEach(b => b.onclick = () => this.openPanel(b.dataset.panel));
    this.el.panel.hidden = false;
    P.scrollTop = 0;
    const x = this.el.panel.querySelector('.x'); x && x.focus();
  }
  closePanel() { this.el.panel.hidden = true; }
}
