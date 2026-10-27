// 主程序：把书桌、书、镜头、课程场景和页面控件连在一起
import * as THREE from 'three';
import { PAGE_W, PAGE_Y, SPINE_GAP, CW, CH, PX, clamp, easeOutBack, easeInOut } from './core/const.js';
import * as ink from './core/ink.js';
import { buildEnvironment } from './core/scene.js';
import { Book, Flap } from './core/book.js';
import { CameraRig } from './core/camera.js';
import * as pages from './core/pages.js';
import { UI } from './core/ui.js';
import { Sfx } from './core/audio.js';
import { LESSONS, FINALE } from './content.js';
import { SCENES } from './scenes/index.js';

const R0 = new THREE.Vector3(SPINE_GAP + PAGE_W / 2, PAGE_Y, 0);
const SHOT = {
  cover: { t: [0, 0, 1.5], yaw: 0, pitch: 60, size: [47, 34], portraitSize: [43, 34] },
  spread: { t: [0, 0, 1.5], yaw: 0, pitch: 58, size: [45, 31], portraitSize: [42, 30] },
  left: { t: [-10.1, 1.1, -3.4], yaw: 0, pitch: 76, size: [21, 20.5], portraitSize: [20.5, 21] },
  leftLow: { t: [-10.3, 1.1, 7.2], yaw: 0, pitch: 70, size: [21, 13], portraitSize: [20.5, 14] },
  right: { t: [10.1, 1.1, 0.3], yaw: 0, pitch: 64, size: [22, 29], portraitSize: [20.5, 26] },
};
const STORE_KEY = 'paperlab-motion-v1';

function loadStore() {
  try { const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); if (s && s.v === 1) return s; } catch (e) {}
  return { v: 1, pred: {}, flap: {}, stamps: {}, sound: true, done: {} };
}

export class App {
  constructor() {
    this.store = loadStore();
    this.lessons = LESSONS;
    this.spreads = [{ id: 'contents', kind: 'contents', title: '扉页与目录', num: 0 }, ...LESSONS.map(L => ({ id: L.id, kind: 'lesson', L, title: L.title, num: L.num, sub: L.sub })), { id: 'end', kind: 'finale', title: FINALE.title, sub: FINALE.sub, num: 0 }];
    this.ls = {};
    for (const L of LESSONS) {
      const ctrl = {};
      for (const c of L.controls) if (c.type !== 'button') ctrl[c.id] = c.value;
      this.ls[L.id] = { ctrl, margin: [] };
    }
    this.ls.end = { ctrl: {}, margin: [] };
    this.cur = 0; this.step = 0; this.steps = []; this.playing = false; this.stepT = 0;
    this.rt = null; this.riseVal = 0; this.riseTarget = 0;
    this.hits = { '-1': [], '1': [] };
    this.flap = null;
    this.busy = false;
    this.sfx = new Sfx(); this.sfx.on = this.store.sound !== false;
    this.ui = new UI(this);
    this.ui.setSound(this.sfx.on);
    this.time = 0;
    this._marginDirty = false; this._marginT = 0;
  }

  save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(this.store)); } catch (e) {} }

  async init() {
    const canvas = document.getElementById('gl');
    this.ui.progress(0.1, '正在铺开书桌……');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;
    const scene = new THREE.Scene();
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(30, 1, 1, 900);
    this.rig = new CameraRig(this.camera);
    this.env = buildEnvironment(scene);
    this.ui.progress(0.3, '正在装订书页……');
    await this.loadFonts();
    this.ui.progress(0.7, '正在排版……');
    this.book = new Book(scene, renderer);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    if (window.ResizeObserver) new ResizeObserver(() => this.rig.setDock(this.measureDock())).observe(document.getElementById('dock'));
    this.applyTheme();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener && mq.addEventListener('change', () => this.applyTheme());
    new MutationObserver(() => this.applyTheme()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    document.fonts && document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => this.repaintAll());

    // 起始页
    const hash = (location.hash || '').slice(1);
    let start = this.spreads.findIndex(s => s.id === hash);
    if (start < 0) start = 0;
    this.cur = start;
    this.paintStatic();
    this.setupSpread(true);
    this.bindInput(canvas);
    window.addEventListener('hashchange', () => {
      const id = (location.hash || '').slice(1);
      const i = this.spreads.findIndex(s => s.id === id);
      if (i >= 0 && i !== this.cur && !this._settingHash) this.gotoSpread(i);
    });
    this.ui.progress(1, '');
    this.last = performance.now();
    renderer.setAnimationLoop((now) => this.frame(now));
    setTimeout(() => this.ui.doneLoading(), 250);
  }

  async loadFonts() {
    if (!document.fonts || !document.fonts.load) return;
    const text = (window.__ALLCHARS || '') + JSON.stringify(LESSONS) + '0123456789.=+−×≈NkgmsLMPa%';
    const specs = ['400 30px "Noto Serif SC"', '700 30px "Noto Serif SC"', '900 30px "Noto Serif SC"', '400 30px "Long Cang"', '500 30px "Caveat"', '600 30px "Caveat"', 'italic 500 30px "EB Garamond"', '500 30px "EB Garamond"'];
    const all = Promise.all(specs.map(s => document.fonts.load(s, text).catch(() => {})));
    await Promise.race([all, new Promise(r => setTimeout(r, 6000))]);
  }

  // ---------- 主题 ----------
  isDark() {
    const t = document.documentElement.dataset.theme;
    if (t === 'dark') return true; if (t === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  applyTheme() { if (this.env) this.env.setNight(this.isDark()); }
  toggleTheme() {
    document.documentElement.dataset.theme = this.isDark() ? 'light' : 'dark';
    this.applyTheme();
    this.sfx.tick();
  }
  toggleSound() { this.sfx.unlock(); this.sfx.on = !this.sfx.on; this.store.sound = this.sfx.on; this.save(); this.ui.setSound(this.sfx.on); this.sfx.tick(); }

  measureDock() {
    const el = document.getElementById('dock');
    const h = el ? el.getBoundingClientRect().height : 80;
    return Math.min(window.innerHeight * 0.42, Math.max(60, h + 8));
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.rig.setViewport(w, h, this.measureDock());
    const pr = this.renderer.getPixelRatio();
    ink.SHARED.uRes.value.set(w * pr, h * pr);
    this.portrait = w / h < 0.85;
  }

  // ---------- 课程状态 ----------
  currentSpread() { return this.spreads[this.cur]; }
  currentLesson() { const s = this.currentSpread(); return s.kind === 'lesson' ? s.L : null; }
  lessonState(id) {
    const st = this.ls[id];
    st.pred = this.store.pred[id]; st.flapOpen = !!this.store.flap[id]; st.stamped = !!this.store.stamps[id];
    return st;
  }
  spreadList() { return this.spreads.map(s => ({ id: s.id, num: s.num, title: s.title, sub: s.sub, stamped: s.kind === 'lesson' && this.store.stamps[s.id] })); }
  whyText(L) { return this.rtWhy && L.id === this.currentLesson()?.id ? this.rtWhy : L.why.replace('{OPT}', (SCENES[L.id] && SCENES[L.id].opt) || '0.6'); }

  // ---------- 画页面 ----------
  paintSide(spread, side, ctx, record) {
    const st = spread.kind === 'lesson' ? this.lessonState(spread.id) : { stamps: this.store.stamps };
    let res = null;
    if (spread.kind === 'contents') res = side < 0 ? (pages.drawTitleLeft(ctx, st), { hits: [] }) : pages.drawContentsRight(ctx, this.lessons, st);
    else if (spread.kind === 'finale') res = side < 0 ? (pages.drawFinaleLeft(ctx, st), { hits: [] }) : pages.drawFinaleRight(ctx, this.lessons, st);
    else {
      const L = spread.L;
      const Lw = Object.assign({}, L, { why: this.whyText(L) });
      res = side < 0 ? pages.drawLessonLeft(ctx, Lw, st) : pages.drawLessonRight(ctx, L, st);
    }
    if (record) {
      this.hits[side] = res.hits || [];
      if (side < 0) { this.flapRect = res.flapRect || null; this.sealAt = res.sealAt || null; }
    }
    return res;
  }
  redrawLeft() { this.paintSide(this.currentSpread(), -1, this.book.leftTex.userData.ctx, true); this.book.leftTex.needsUpdate = true; }
  redrawRight() { this.paintSide(this.currentSpread(), 1, this.book.rightTex.userData.ctx, true); this.book.rightTex.needsUpdate = true; }
  paintStatic() { this.redrawLeft(); this.redrawRight(); this.makeFlap(); }
  repaintAll() { if (!this.book || this.book.turning) return; this.redrawLeft(); this.redrawRight(); if (this.flap) this.flap.redraw(this.lessonState(this.currentSpread().id)); }

  makeFlap() {
    if (this.flap) { this.flap.dispose(); this.flap = null; }
    const s = this.currentSpread();
    if (s.kind !== 'lesson' || !this.flapRect) return;
    const st = this.lessonState(s.id);
    this.flap = new Flap(this.book, -1, this.flapRect, pages.drawFlapFront);
    this.flap.redraw(st);
    this.flap.toggle(st.flapOpen); this.flap.open = st.flapOpen ? 1 : 0;
  }

  // ---------- 翻页 ----------
  gotoId(id) { const i = this.spreads.findIndex(s => s.id === id); if (i >= 0) this.gotoSpread(i); }
  gotoSpread(idx, step = 0) {
    if (idx < 0 || idx >= this.spreads.length) return;
    if (this.busy) { this._pending = [idx, step]; return; }
    if (idx === this.cur) { this.goStep(step); return; }
    this.busy = true;
    const dir = idx > this.cur ? 1 : -1;
    const old = this.spreads[this.cur], neu = this.spreads[idx];
    this.ui.setControls(null);
    this.ui.hint(null);
    this.rig.follow = null;
    this.rig.setShot(SHOT.spread, { speed: 3.4 });
    this.riseTarget = 0;
    const foldTime = this.rt ? 420 : 0;
    this.ui.setCaption(neu.num || '', `翻到${neu.kind === 'lesson' ? `第 ${neu.num} 课 · ${neu.title}` : neu.title}……`);
    this.after(foldTime / 1000, () => {
      this.disposeRuntime();
      const B = this.book;
      const tmp = document.createElement('canvas'); tmp.width = CW; tmp.height = CH;
      const flapImg = (spread, ctx) => {
        // 把翻页（合着时）画进副本里，翻页过程中看起来是一体的
        if (spread.kind !== 'lesson') return;
        const st = this.lessonState(spread.id);
        if (st.flapOpen) return;
        const r = this._flapRectFor(spread);
        if (!r) return;
        const fc = document.createElement('canvas'); fc.width = r.w; fc.height = r.h;
        pages.drawFlapFront(fc.getContext('2d'), r.w, r.h, st);
        ctx.drawImage(fc, r.x, r.y);
      };
      this.sfx.page();
      B.turn(dir, {
        drawOldFront: (ctx) => { if (dir > 0) this.paintSide(old, 1, ctx, false); else this.paintSide(neu, 1, ctx, false); },
        drawNewBack: (ctx) => { if (dir > 0) { this.paintSide(neu, -1, ctx, false); flapImg(neu, ctx); } else { this.paintSide(old, -1, ctx, false); flapImg(old, ctx); } },
        onSwapStatic: () => {
          this.cur = idx;
          if (dir > 0) { this.paintSide(neu, 1, B.rightTex.userData.ctx, true); B.rightTex.needsUpdate = true; this.after(0.7, () => { if (this.flap && this.book.turning) { this.flap.dispose(); this.flap = null; } }); }
          else { if (this.flap) { this.flap.dispose(); this.flap = null; } this.paintSide(neu, -1, B.leftTex.userData.ctx, true); B.leftTex.needsUpdate = true; }
        },
        onDone: () => {
          if (dir > 0) { this.paintSide(neu, -1, B.leftTex.userData.ctx, true); B.leftTex.needsUpdate = true; }
          else { this.paintSide(neu, 1, B.rightTex.userData.ctx, true); B.rightTex.needsUpdate = true; }
          this.makeFlap();
          this.busy = false;
          this.setupSpread(false, step);
          if (this._pending) { const [i, s] = this._pending; this._pending = null; if (i !== this.cur) this.gotoSpread(i, s); }
        },
        duration: 1.15,
      });
    });
  }
  _flapRectFor(spread) {
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    const res = this.paintSide(spread, -1, c.getContext('2d'), false);
    return res && res.flapRect;
  }

  setupSpread(instant, step = 0) {
    const s = this.currentSpread();
    this._settingHash = true;
    try { if ((location.hash || '').slice(1) !== s.id) history.replaceState(null, '', '#' + s.id); } catch (e) {}
    setTimeout(() => (this._settingHash = false), 50);
    this.rtWhy = null;
    this.userActed = false;
    if (s.kind === 'lesson') {
      this.buildRuntime(s.L);
      this.steps = [
        { cap: '先读一读左页，在"预测"里勾一个答案。', shot: SHOT.left, dur: 8, read: true },
        ...this.rt.steps,
        { cap: '掀开左页的"为什么"，看看你猜得对不对。', shot: SHOT.leftLow, dur: 7, final: true },
      ];
    } else if (s.kind === 'contents') {
      this.steps = [
        { cap: '《运动的理由》共 8 课。点目录里的课名，或者按 ▶ 从第 1 课开始。', shot: SHOT.cover, dur: 6 },
      ];
    } else {
      this.buildRuntime({ id: 'end', num: 0, title: FINALE.title, controls: [] });
      this.steps = [{ cap: '牛顿用三句话概括了这本书里的全部实验。右页是你盖过的印章。', shot: SHOT.spread, dur: 7 }, ...this.rt.steps];
    }
    if (instant) this.rig.setShot(this.steps[0].shot, { instant: true });
    this.goStep(Math.min(step, this.steps.length - 1));
    this.ui.renderSheet();
    if (!this.ui.el.sheet.hidden) this.ui.renderSheet();
  }

  buildRuntime(L) {
    const build = SCENES[L.id] && SCENES[L.id].build;
    if (!build) { this.rt = { root: new THREE.Group(), steps: [], update() {}, onControl() {}, pickables: [], dispose() {} }; return; }
    const st = this.lessonState(L.id);
    const app = this;
    const ctx = {
      THREE, ink, R0: R0.clone(), book: this.book, scene: this.scene, sfx: this.sfx, rig: this.rig, L, st, SHOT,
      shot: (x, y, z, o = {}) => ({ t: [R0.x + x, R0.y + y, R0.z + z], yaw: o.yaw || 0, pitch: o.pitch != null ? o.pitch : 55, size: [o.w || 20, o.h || 15], portraitSize: o.pw ? [o.pw, o.ph || o.h || 15] : undefined, pt: o.pt ? [R0.x + o.pt[0], R0.y + o.pt[1], R0.z + o.pt[2]] : undefined }),
      rise: () => { app.riseTarget = 1; },
      risen: () => app.riseVal,
      complete: () => app.complete(L),
      toast: (m, ms) => app.ui.toast(m, ms),
      hint: (m) => app.ui.hint(m),
      setCtrl: (id, v) => { st.ctrl[id] = v; app.redrawRight(); app.ui.setControls(L, st, app.riseVal > 0.5); },
      marginChanged: () => { app._marginDirty = true; },
      setWhy: (w) => { app.rtWhy = w; },
      follow: (v) => { app.rig.follow = v ? { tx: v.x, ty: v.y, tz: v.z } : null; },
      stepIndex: () => app.step,
      act: (a) => app.action(a),
      camera: this.camera,
    };
    this.rt = build(ctx);
    this.rt.root.position.copy(R0);
    this.scene.add(this.rt.root);
    this.riseVal = 0; this.riseTarget = 0;
    this.applyRise(0);
    st.margin = this.rt.margin ? this.rt.margin() : [];
    this.redrawLeft();
  }
  disposeRuntime() {
    if (!this.rt) return;
    this.scene.remove(this.rt.root);
    this.rt.dispose && this.rt.dispose();
    ink.disposeTree(this.rt.root);
    this.rt = null;
  }

  applyRise(t) {
    if (!this.rt) return;
    const kids = this.rt.root.children;
    let i = 0;
    for (const c of kids) {
      if (c.userData.noPop) { c.visible = c.userData.keepVisible ? c.visible : t > 0.98; continue; }
      if (c.userData.sy0 == null) c.userData.sy0 = c.scale.y;
      const d = c.userData.delay != null ? c.userData.delay : Math.min(0.45, i * 0.07);
      const p = clamp((t * 1.6 - d) / 0.7, 0, 1);
      const s = p <= 0 ? 0.004 : Math.max(0.004, easeOutBack(p));
      c.scale.y = c.userData.sy0 * s;
      i++;
    }
  }

  // ---------- 步骤 ----------
  goStep(i) {
    if (this.busy) return;
    i = clamp(i, 0, this.steps.length - 1);
    const prev = this.steps[this.step];
    this.step = i; this.stepT = 0;
    const s = this.steps[i];
    const L = this.currentLesson();
    this.rig.follow = null;
    if (s.shot) this.rig.setShot(typeof s.shot === 'function' ? s.shot() : s.shot);
    this.ui.setCaption(L ? L.num : '', s.cap);
    this.ui.setDots(this.steps.length, i);
    if (s.enter && !s.interactive) this.userActed = false;
    if (s.enter) s.enter();
    if (this.rt && i > 0 && !s.final && !s.read) this.riseTarget = Math.max(this.riseTarget, s.noRise ? 0 : 1);
    if (s.interactive && this.playing) this.setPlaying(false);
    if (s.interactive && !this._toldOrbit) {
      this._toldOrbit = true;
      this.after(1.2, () => this.ui.toast(this.portrait ? '提示：在空白处拖动可以换个角度看，双指缩放。' : '提示：在空白处拖动可以换个角度看，滚轮缩放，双击回到原来的镜头。', 4200));
    }
    if (this.portrait && L) {
      if (s.read && this.ui.el.sheet.hidden) { this.ui.openSheet(); this._autoSheet = true; }
      else if (!s.read && !s.final && this._autoSheet) { this.ui.closeSheet(); this._autoSheet = false; }
    }
    this.ui.setControls(L, L ? this.lessonState(L.id) : null, !!(L && this.riseVal > 0.5 && !s.read));
  }
  next() {
    this.sfx.unlock();
    if (this.busy) return;
    if (this.step < this.steps.length - 1) this.goStep(this.step + 1);
    else if (this.cur < this.spreads.length - 1) this.gotoSpread(this.cur + 1);
    else this.setPlaying(false);
  }
  prev() {
    this.sfx.unlock();
    if (this.busy) return;
    if (this.step > 0) this.goStep(this.step - 1);
    else if (this.cur > 0) this.gotoSpread(this.cur - 1);
  }
  togglePlay() { this.sfx.unlock(); this.setPlaying(!this.playing); if (this.playing && this.currentSpread().kind === 'contents') this.next(); }
  setPlaying(p) { this.playing = p; this.ui.setPlaying(p); this.stepT = 0; }

  // ---------- 交互 ----------
  action(a) {
    this.sfx.unlock();
    const L = this.currentLesson();
    if (a.type === 'goto') { this.gotoId(a.id); return; }
    if (a.type === 'panel') { this.ui.openPanel(a.id); return; }
    if (!L) return;
    const st = this.lessonState(L.id);
    if (a.type === 'pred') {
      this.store.pred[L.id] = a.i; this.save();
      this.sfx.pencil();
      this.redrawLeft();
      if (this.flap) this.flap.redraw(this.lessonState(L.id));
      this.ui.renderSheet();
      if (this.steps[this.step] && this.steps[this.step].read && !this.playing) setTimeout(() => this.ui.toast('预测好了。按 › 让插图立起来。', 2400), 200);
      return;
    }
    const c = L.controls.find(x => x.id === a.ctrl);
    if (!c) return;
    this.userActed = true;
    if (this.playing) this.setPlaying(false);
    if (this.riseTarget < 1) this.riseTarget = 1;
    if (a.type === 'opt') st.ctrl[c.id] = a.value;
    else if (a.type === 'step') st.ctrl[c.id] = Number(clamp(st.ctrl[c.id] + a.delta * c.step, c.min, c.max).toFixed(3));
    this.sfx.tick();
    if (this.rt && this.rt.onControl) this.rt.onControl(c.id, st.ctrl[c.id], a);
    this.redrawRight();
    this.ui.setControls(L, st, true);
    // 交互后移到实验镜头
    const s = this.steps[this.step];
    if (s && (s.read || s.final)) {
      const k = this.steps.findIndex(x => x.interactive);
      if (k > 0) this.goStep(k);
    }
  }
  setFlap(open) {
    const L = this.currentLesson(); if (!L || !this.flap) return;
    this.store.flap[L.id] = !!open; this.save();
    this.flap.toggle(open);
    this.sfx.flap();
    this.redrawLeft();
    this.ui.renderSheet();
    if (open && this.store.pred[L.id] == null) this.ui.toast('还没有预测哦。答案已经掀开了，也可以先合上，猜一猜再看。', 3200);
  }

  complete(L) {
    if (this.store.stamps[L.id]) return;
    // 只认读者自己动手完成的挑战（演示步骤不算）
    if (!this.userActed) return;
    this.store.stamps[L.id] = true; this.save();
    this.sfx.success();
    this.ui.toast(`挑战完成！左页盖上了"${L.stamp}"印章。`, 3600);
    const sa = this.sealAt;
    if (!sa) { this.redrawLeft(); return; }
    const pos = this.book.toWorld(-1, sa.x, sa.y - 4, 0);
    const g = new THREE.Group();
    const handle = ink.cyl(0.55, 0.7, 2.6, { ink: { color: '#c8a77a' } });
    handle.position.y = 0.6;
    const knob = ink.sphere(0.75, { ink: { color: '#c8a77a' } }); knob.position.y = 3.4;
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.6, 1.95), ink.litMat({ color: '#a8291d' }));
    base.position.y = 0.3; base.castShadow = true;
    base.add(ink.edgeLines(base.geometry, { overshoot: 0 }));
    g.add(handle, knob, base);
    g.rotation.y = -0.1;
    g.position.copy(pos);
    this.scene.add(g);
    this.stampAnim = { g, t: 0, pos, printed: false, L };
    this.prevShot = this.rig.shot;
    this.rig.setShot({ t: [pos.x + 2, pos.y, pos.z - 1], yaw: 0, pitch: 62, size: [16, 11] }, { keepUser: false });
  }
  updateStamp(dt) {
    const a = this.stampAnim; if (!a) return;
    a.t += dt;
    const t = a.t;
    const start = 0.7;
    let y;
    if (t < start) y = 9;
    else if (t < start + 0.35) y = 9 * (1 - easeInOut((t - start) / 0.35));
    else if (t < start + 0.6) y = 0;
    else y = 9 * easeInOut(clamp((t - start - 0.6) / 0.5, 0, 1));
    a.g.position.y = a.pos.y + y + 0.01;
    if (!a.printed && t >= start + 0.35) {
      a.printed = true; this.sfx.stamp(); this.redrawLeft();
    }
    if (t > start + 1.2) {
      this.scene.remove(a.g); ink.disposeTree(a.g);
      this.stampAnim = null;
      const cs = this.steps[this.step];
      if (cs && cs.shot && this.currentLesson() === a.L) this.rig.setShot(typeof cs.shot === 'function' ? cs.shot() : cs.shot);
      this.ui.renderSheet();
    }
  }

  // ---------- 输入 ----------
  bindInput(canvas) {
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const setRay = (e) => {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, this.camera);
    };
    this.ray = ray;
    const pointers = new Map();
    let drag = null, orbit = null, click = null, pinch = null;
    const pickInteractive = () => {
      if (!this.rt || this.riseVal < 0.9 || !this.rt.pickables || !this.rt.pickables.length) return null;
      const objs = this.rt.pickables.filter(p => p.enabled !== false && p.obj.visible !== false).map(p => p.obj);
      const hits = ray.intersectObjects(objs, true);
      for (const h of hits) {
        let o = h.object;
        while (o) { const p = this.rt.pickables.find(pp => pp.obj === o); if (p) return { p, hit: h }; o = o.parent; }
      }
      return null;
    };
    const bookAction = () => {
      const bh = this.book.pick(ray);
      if (!bh) return null;
      if (bh.flap) return { flap: true };
      const list = this.hits[bh.side] || [];
      for (const h of list) if (bh.x >= h.x && bh.x <= h.x + h.w && bh.y >= h.y && bh.y <= h.y + h.h) return { action: h.action };
      return null;
    };
    canvas.addEventListener('pointerdown', (e) => {
      this.sfx.unlock();
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
        if (drag) { drag.p.up && drag.p.up(); drag = null; }
        orbit = null; click = null;
        return;
      }
      setRay(e);
      const pi = pickInteractive();
      if (pi) {
        drag = pi;
        this.userActed = true;
        if (this.playing) this.setPlaying(false);
        pi.p.down && pi.p.down(pi.hit, ray.ray, e);
        canvas.style.cursor = pi.p.dragCursor || 'grabbing';
        return;
      }
      click = bookAction();
      orbit = { x: e.clientX, y: e.clientY, moved: false };
    });
    canvas.addEventListener('pointermove', (e) => {
      const pt = pointers.get(e.pointerId);
      if (pt) { pt.x = e.clientX; pt.y = e.clientY; }
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch.d > 0) this.rig.zoom(pinch.d / d);
        pinch.d = d;
        return;
      }
      if (drag) { setRay(e); drag.p.move && drag.p.move(ray.ray, e); return; }
      if (orbit && pt) {
        const dx = e.clientX - orbit.x, dy = e.clientY - orbit.y;
        if (!orbit.moved && Math.hypot(dx, dy) > 6) orbit.moved = true;
        if (orbit.moved) { this.rig.nudge(dx, dy); orbit.x = e.clientX; orbit.y = e.clientY; }
        return;
      }
      if (e.pointerType === 'mouse') {
        setRay(e);
        const pi = pickInteractive();
        if (pi) { canvas.style.cursor = pi.p.cursor || 'grab'; return; }
        const ba = bookAction();
        canvas.style.cursor = ba ? 'pointer' : 'default';
      }
    });
    const up = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (drag) { drag.p.up && drag.p.up(e); drag = null; canvas.style.cursor = 'default'; return; }
      if (orbit && !orbit.moved && click) {
        if (click.flap) this.setFlap(!this.store.flap[this.currentLesson().id]);
        else if (click.action) this.action(click.action);
      }
      orbit = null; click = null;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.rig.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    canvas.addEventListener('dblclick', () => this.rig.resetUser());
  }

  // ---------- 每一帧 ----------
  frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (this._frozen) return;
    this.tick(dt);
    this.renderer.render(this.scene, this.camera);
  }
  // 测试用：把某一跨页的左右页画成图片
  pageImage(id, side) {
    const sp = this.spreads.find(s => s.id === id);
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    this.paintSide(sp, side, c.getContext('2d'), false);
    return c.toDataURL('image/jpeg', 0.8);
  }
  // 测试用：书页坐标 → 屏幕坐标
  screenOf(side, x, y) {
    const p = this.book.toWorld(side, x, y);
    p.project(this.camera);
    return [Math.round((p.x + 1) / 2 * window.innerWidth), Math.round((1 - p.y) / 2 * window.innerHeight)];
  }
  // 测试用：快进若干秒再画一帧
  simulate(sec, dt = 1 / 60) {
    this._frozen = true;
    for (let t = 0; t < sec; t += dt) this.tick(dt);
    this.renderer.render(this.scene, this.camera);
    return { spread: this.currentSpread().id, step: this.step, rise: +this.riseVal.toFixed(2) };
  }
  tick(dt) {
    this.time += dt;
    ink.SHARED.uTime.value = this.time;
    this.rig.update(dt);
    const m = this.camera.matrixWorld.elements;
    ink._camRight.set(m[0], m[1], m[2]).normalize();
    this.book.update(dt);
    // 立起 / 收起
    if (this.rt) {
      const sp = this.riseTarget > this.riseVal ? 0.62 : 2.4;
      const prev = this.riseVal;
      this.riseVal += clamp(this.riseTarget - this.riseVal, -sp * dt, sp * dt);
      if (prev !== this.riseVal) {
        this.applyRise(this.riseVal);
        const L = this.currentLesson();
        const s = this.steps[this.step];
        if ((prev <= 0.5) !== (this.riseVal <= 0.5) && L) this.ui.setControls(L, this.lessonState(L.id), this.riseVal > 0.5 && s && !s.read);
      }
      this.rt.update(dt, this.time);
      if (this._marginDirty) {
        this._marginT += dt;
        if (this._marginT > 0.3) {
          this._marginT = 0; this._marginDirty = false;
          const L = this.currentLesson();
          if (L && this.rt.margin) { this.ls[L.id].margin = this.rt.margin(); this.redrawLeft(); }
        }
      }
    }
    this.updateStamp(dt);
    // 自动播放
    if (this.playing && !this.busy) {
      const s = this.steps[this.step];
      this.stepT += dt;
      if (s && s.dur && !s.interactive && this.stepT > s.dur) this.next();
    }
    if (this._timers) {
      for (const tm of this._timers) tm.t -= dt;
      const due = this._timers.filter(tm => tm.t <= 0);
      this._timers = this._timers.filter(tm => tm.t > 0);
      due.forEach(tm => tm.fn());
    }
  }
  after(sec, fn) { (this._timers || (this._timers = [])).push({ t: sec, fn }); }
}
