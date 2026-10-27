// 第 2 课 越滑越远：斜面 + 不同表面 + 频闪残影
import * as THREE from 'three';
import { box, extrude, inkMat, litMat, edgeLines, Card, ghostOf, polyLine, canvasTex, paperFill } from '../core/ink.js';
import { FORCES, INK, FONT, clamp, fmt } from '../core/const.js';
import { cart, rulerTex, forceArrow, v3, label3d } from './common.js';

const S = 0.25;                 // 场景厘米 / 真实厘米
const G = 9.8;
const THETA = 30 * Math.PI / 180;
const H_MAX = 10;               // 斜面上最高释放点（真实 cm）
const TRACK = 120;              // 水平轨道长度（真实 cm）
const MU = { towel: 0.4, cotton: 0.2, wood: 0.1, ideal: 0 };
const NAME = { towel: '毛巾', cotton: '棉布', wood: '木板', ideal: '无阻力' };
const MASS = 0.2;               // 小车质量 kg（只用来算力的大小）

function surfaceTex(kind) {
  return canvasTex(1024, 64, (ctx, W, H) => {
    if (kind === 'towel') {
      ctx.fillStyle = '#efeadf'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 2600; i++) { const x = Math.random() * W, y = Math.random() * H; ctx.strokeStyle = `rgba(60,55,70,${0.25 + Math.random() * 0.3})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 1.6 + Math.random() * 1.6, 0, 6.28); ctx.stroke(); }
    } else if (kind === 'cotton') {
      ctx.fillStyle = '#f3efe6'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(60,55,70,0.28)'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 3, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + 1); ctx.stroke(); }
    } else if (kind === 'wood') {
      ctx.fillStyle = '#efe6d4'; ctx.fillRect(0, 0, W, H);
      for (let k = 0; k < 14; k++) { ctx.strokeStyle = `rgba(110,85,60,${0.18 + Math.random() * 0.15})`; ctx.lineWidth = 1 + Math.random() * 1.5; ctx.beginPath(); const y0 = Math.random() * H; for (let x = 0; x <= W; x += 16) ctx.lineTo(x, y0 + Math.sin(x * 0.01 + k) * 4); ctx.stroke(); }
    } else {
      ctx.fillStyle = '#f7f9fb'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(120,150,180,0.35)'; ctx.lineWidth = 2;
      for (let x = -H; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + 40, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 14, H); ctx.lineTo(x + 50, 0); ctx.stroke(); }
    }
  });
}

export function build(ctx) {
  const { st } = ctx;
  const root = new THREE.Group();
  const app = new THREE.Group(); root.add(app);
  const Z = -3.2;
  // 斜面：底边在 xb，高 H_MAX*S
  const hS = H_MAX * S, run = hS / Math.tan(THETA);
  const xb = -4.4, xt = xb - run;
  const sh = new THREE.Shape(); sh.moveTo(xt, 0); sh.lineTo(xb, 0); sh.lineTo(xt, hS + 0.02); sh.lineTo(xt, 0);
  const ramp = extrude(sh, 3.0, { ink: { color: '#ece6d8' } });
  ramp.position.z = Z; app.add(ramp);
  const stop = box(0.3, 0.5, 3.0, { ink: { color: '#ddd7ca' } }); stop.position.set(xt + 0.05, hS, Z); app.add(stop);
  // 水平轨道
  const trackLen = TRACK * S;
  const board = box(trackLen + 2.2, 0.18, 3.4, { ink: { color: '#e8e2d4' } });
  board.position.set(xb + trackLen / 2 + 0.6, -0.18, Z); app.add(board);
  // 书页外的一端用木块垫着
  const prop = box(1.6, 1.3, 3.0, { ink: { color: '#dcd5c6' } }); prop.position.set(xb + trackLen - 0.5, -1.48, Z); app.add(prop);
  const surfMeshes = {};
  for (const k of Object.keys(MU)) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(trackLen, 3.0), litMat({ map: surfaceTex(k) }));
    m.rotation.x = -Math.PI / 2; m.position.set(xb + trackLen / 2, 0.012, Z); m.receiveShadow = true; m.visible = false;
    app.add(m); surfMeshes[k] = m;
  }
  // 刻度尺
  const rt0 = rulerTex({ len: TRACK, every: 10, px: 16, h: 70 });
  const ruler = new THREE.Mesh(new THREE.PlaneGeometry(trackLen, 1.0), litMat({ map: rt0 }));
  ruler.rotation.x = -Math.PI / 2; ruler.position.set(xb + trackLen / 2, 0.02, Z + 2.1); ruler.receiveShadow = true;
  ruler.add(edgeLines(new THREE.PlaneGeometry(trackLen, 1.0), { overshoot: 0 }));
  app.add(ruler);
  const cmLabel = label3d('cm', { w: 1.4, h: 0.7, font: FONT.math }); cmLabel.rotation.x = -Math.PI / 2; cmLabel.position.set(xb + trackLen + 0.9, 0.03, Z + 2.1); app.add(cmLabel);

  // 小车
  const car = cart({ L: 2.4, W: 1.5, H: 0.55, wheel: 0.28 });
  app.add(car);
  const wheels = car.userData.wheels;

  // 标记旗
  const flags = {};
  function flagAt(kind, dist) {
    if (flags[kind]) { app.remove(flags[kind]); }
    const g = new THREE.Group();
    const pole = box(0.06, 1.6, 0.06, { ink: { color: '#d8d3c8' }, edges: false }); g.add(pole);
    const t = canvasTex(256, 128, (c, W, H) => { c.fillStyle = kind === 'ideal' ? '#eef4f8' : '#f6f2e8'; c.fillRect(0, 0, W, H); c.strokeStyle = INK; c.lineWidth = 5; c.strokeRect(2, 2, W - 4, H - 4); c.fillStyle = '#b8372a'; c.font = `700 46px ${FONT.serif}`; c.textBaseline = 'top'; c.fillText(NAME[kind], 14, 10); c.fillStyle = '#26407a'; c.font = `600 54px ${FONT.num}`; c.fillText(kind === 'ideal' ? '→ ∞' : `${dist.toFixed(0)} cm`, 14, 60); });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), litMat({ map: t, side: THREE.DoubleSide }));
    fl.position.set(0.78, 1.25, 0); g.add(fl);
    fl.add(edgeLines(new THREE.PlaneGeometry(1.5, 0.75), { overshoot: 0, width: 1 }));
    const off = { towel: -1.05, cotton: -0.35, wood: 0.35, ideal: 1.05 }[kind];
    g.position.set(xb + dist * S, 0, Z - 2.2 - off * 0.55);
    app.add(g); flags[kind] = g;
  }

  // 读数牌
  const card = new Card({ w: 7.2, h: 4.8, tilt: -16 });
  card.group.position.set(-3.0, 0, -10.2); card.group.rotation.y = 0.05;
  root.add(card.group);
  const results = {};
  function drawCard() {
    const lines = ['towel', 'cotton', 'wood', 'ideal'].map(k => ({ t: `${NAME[k]}（μ = ${MU[k]}）：${results[k] == null ? '—' : (k === 'ideal' && results[k] === Infinity ? '一直运动' : results[k].toFixed(0) + ' cm')}`, c: k === st.ctrl.surface ? '#b8372a' : INK, w: k === st.ctrl.surface ? 700 : 400 }));
    card.draw({ title: '滑行距离', lines: [{ t: `释放高度 h = ${relH.toFixed(1)} cm`, hand: true, s: 1.15, c: '#26407a' }, ...lines], lineSize: 0.105 });
  }

  // 力的箭头
  const aF = forceArrow('f', { scale: 2.0, width: 0.16, labelSide: 1 });
  const aG = forceArrow('G', { scale: 1.0, width: 0.13, labelSide: 1 });
  const aN = forceArrow('N', { scale: 1.0, width: 0.13, labelSide: -1 });
  root.add(aF.group, aG.group, aN.group);
  // 引导虚线
  const guide = polyLine([v3(0, 0, 0), v3(1, 0, 0)], { width: 1.2, dashed: true, color: '#6b6672' });
  guide.userData.noPop = true; guide.userData.keepVisible = true; root.add(guide);
  const hLabel = label3d('', { w: 3.2, h: 0.9, font: FONT.num, color: '#26407a' });
  hLabel.userData.noPop = true; hLabel.userData.keepVisible = true; root.add(hLabel);
  const endNote = label3d('……没有阻力，就一直运动下去 →', { w: 12, h: 1.2, font: FONT.hand, color: '#26407a', size: 1.0 });
  endNote.rotation.x = -Math.PI / 2; endNote.position.set(xb + trackLen + 6.5, 0.05 - 1.47, Z); endNote.visible = false;
  endNote.userData.noPop = true; endNote.userData.keepVisible = true; root.add(endNote);

  // 状态
  let relH = H_MAX;           // 释放高度（真实 cm）
  let phase = 'idle';         // idle | ramp | flat | stopped | gone
  let s = 0, v = 0;           // 斜面上沿斜面距离（m）或水平距离（m），速度 m/s
  let tFlat = 0, nextGhost = 0;
  const ghosts = [];
  let runSurface = null;
  let dragging = false;

  function rampPos(hReal) {
    // 小车在斜面上，高度为 hReal（真实 cm）时的位置（车底中心）
    const along = (hReal * S) / Math.sin(THETA);
    return v3(xb - along * Math.cos(THETA), hReal * S, Z);
  }
  function placeOnRamp(hReal) {
    const p = rampPos(hReal);
    car.position.copy(p).add(v3(0.0, 0.0, 0));
    // 车底贴着斜面：沿法线抬一点
    car.rotation.set(0, 0, -THETA);
    car.position.x += 0; car.position.y += 0.02;
  }
  function placeFlat(xReal) {
    car.rotation.set(0, 0, 0);
    car.position.set(xb + xReal * S, 0.02, Z);
  }
  function clearGhosts() { ghosts.forEach(g => app.remove(g)); ghosts.length = 0; }
  function reset() {
    phase = 'idle'; s = 0; v = 0; clearGhosts(); endNote.visible = false; car.visible = true;
    placeOnRamp(relH);
    aF.group.visible = false;
  }
  function release() {
    reset();
    phase = 'ramp'; runSurface = st.ctrl.surface;
    s = 0; v = 0;
    ctx.sfx.thud(0.3);
  }
  function setSurface(k) { for (const kk in surfMeshes) surfMeshes[kk].visible = kk === k; }
  setSurface(st.ctrl.surface);
  reset(); drawCard();

  const rt = {
    root,
    steps: [
      { cap: '插图立起来：一段斜面，接着一条长长的水平轨道。', shot: ctx.shot(8.5, 1, -2.5, { pitch: 42, w: 40, h: 16, pw: 40, ph: 30, pt: [9, 1, -3] }), dur: 5 },
      { cap: '小车从斜面顶端由静止滑下，冲上铺着毛巾的平面。', shot: ctx.shot(2, 1, -2.5, { pitch: 38, w: 26, h: 13 }), dur: 5, enter: () => { ctx.setCtrl('surface', 'towel'); rt.onControl('surface', 'towel'); relH = H_MAX; release(); } },
      { cap: '换成棉布，从同一高度再放一次：阻力小了，滑得更远。', shot: ctx.shot(4, 1, -2.5, { pitch: 38, w: 30, h: 14 }), dur: 5.5, enter: () => { ctx.setCtrl('surface', 'cotton'); rt.onControl('surface', 'cotton'); release(); } },
      { cap: '换成木板：滑得更远。淡淡的虚影每隔 0.1 s 记一次位置，间隔越来越小，说明在减速。', shot: ctx.shot(8.5, 1, -2.5, { pitch: 40, w: 38, h: 15 }), dur: 7, enter: () => { ctx.setCtrl('surface', 'wood'); rt.onControl('surface', 'wood'); release(); } },
      { cap: '要是一点阻力都没有呢？虚影的间隔一样大：小车做匀速直线运动，一直滑下去。', shot: ctx.shot(14, 1, -2.5, { pitch: 40, w: 46, h: 16 }), dur: 8, enter: () => { ctx.setCtrl('surface', 'ideal'); rt.onControl('surface', 'ideal'); release(); } },
      { cap: '轮到你：选一种表面，把小车沿斜面往下拖可以换高度，然后点"释放"。', shot: ctx.shot(8, 1, -2, { pitch: 44, w: 40, h: 18, pw: 40, ph: 30, pt: [9, 1, -3] }), interactive: true },
    ],
    pickables: [{
      obj: car, cursor: 'grab',
      down: () => { dragging = true; phase = 'idle'; clearGhosts(); endNote.visible = false; },
      move: (ray) => {
        // 与 z = Z 的竖直平面求交
        const p = new THREE.Vector3();
        const plane = new THREE.Plane(v3(0, 0, 1), -(Z + ctx.R0.z));
        if (!ray.intersectPlane(plane, p)) return;
        const lx = p.x - ctx.R0.x;
        const along = clamp((xb - lx) / Math.cos(THETA), 0.3, run / Math.cos(THETA));
        relH = clamp(Math.round((along * Math.sin(THETA)) / S * 2) / 2, 1, H_MAX);
        placeOnRamp(relH); drawCard(); ctx.marginChanged();
      },
      up: () => { dragging = false; },
    }],
    onControl(id, val) {
      if (id === 'surface') { setSurface(val); if (phase !== 'idle') reset(); drawCard(); }
      if (id === 'release') release();
      if (id === 'reset') { relH = H_MAX; reset(); drawCard(); ctx.marginChanged(); }
    },
    margin() {
      const mu = MU[st.ctrl.surface];
      const d = mu > 0 ? relH / mu : Infinity;
      return [`h = ${relH.toFixed(1)} cm`, mu > 0 ? `s = h/μ = ${d.toFixed(0)} cm` : 's → ∞', '（斜面不计摩擦）'];
    },
    update(dt) {
      const sub = 6, h = dt / sub;
      const mu = MU[runSurface || st.ctrl.surface];
      for (let i = 0; i < sub; i++) {
        if (phase === 'ramp') {
          v += G * Math.sin(THETA) * h; s += v * h;
          const total = (relH / 100) / Math.sin(THETA);
          if (s >= total) { phase = 'flat'; s = 0; tFlat = 0; nextGhost = 0; }
        } else if (phase === 'flat') {
          tFlat += h;
          if (mu > 0) { v -= mu * G * h; if (v <= 0) { v = 0; phase = 'stopped'; } }
          s += v * h;
          if (tFlat >= nextGhost) {
            nextGhost += 0.1;
            if (ghosts.length < 60) { placeFlat(s * 100); const gh = ghostOf(car, 0.4); gh.position.copy(car.position); app.add(gh); ghosts.push(gh); }
          }
        }
      }
      // 摆放小车
      if (phase === 'ramp') {
        const total = (relH / 100) / Math.sin(THETA);
        const hh = relH * (1 - s / total);
        placeOnRamp(hh);
      } else if (phase === 'flat' || phase === 'stopped') {
        placeFlat(s * 100);
        if (s * 100 > TRACK + 4) {
          if (mu === 0) { phase = 'gone'; endNote.visible = true; }
        }
      }
      if (phase === 'gone') { s += v * dt; placeFlat(s * 100); if (car.position.x > xb + TRACK * S + 14) car.visible = false; }
      const wr = car.userData.wheelR;
      wheels.forEach(w => { w.rotation.z = -((phase === 'ramp' ? s : s + 0.4) * 100 * S) / wr; });
      if (phase === 'stopped') {
        const d = s * 100;
        phase = 'done';
        results[runSurface] = d; flagAt(runSurface, d); drawCard(); ctx.sfx.tick();
        // 挑战：木板上停在 50 cm（±3）
        if (runSurface === 'wood' && Math.abs(d - 50) <= 3) ctx.complete();
      }
      if (phase === 'gone' && results.ideal !== Infinity) { results.ideal = Infinity; flagAt('ideal', TRACK); drawCard(); }
      // 箭头
      const risen = ctx.risen() > 0.98;
      if (risen && phase === 'flat' && car.visible) {
        const c = car.position.clone().add(ctx.R0).sub(ctx.R0);
        const top = v3(car.position.x, 0.55 + 0.28 * 0.9, Z);
        if (mu > 0) aF.set(v3(car.position.x - 1.2, 0.35, Z + 0.9), v3(-mu * MASS * G, 0, 0), `f ${fmt(mu * MASS * G, 2)} N`); else aF.group.visible = false;
        aG.set(v3(car.position.x, 0.6, Z + 0.95), v3(0, -MASS * G, 0), null);
        aN.set(v3(car.position.x, 0.6, Z + 0.95), v3(0, MASS * G, 0), null);
      } else { aF.group.visible = false; aG.group.visible = false; aN.group.visible = false; }
      // 高度引导线
      const show = risen && (phase === 'idle');
      guide.visible = show; hLabel.visible = show;
      if (show) {
        const p = rampPos(relH);
        guide.geometry.setPositions([p.x - 0.8, p.y, Z + 1.6, xt - 1.4, p.y, Z + 1.6]);
        guide.computeLineDistances();
        hLabel.position.set(xt - 2.6, p.y + 0.15, Z + 1.6);
        const txt = `h = ${relH.toFixed(1)} cm`;
        if (hLabel.userData.txt !== txt) {
          hLabel.userData.txt = txt;
          const c2 = hLabel.userData.tex.userData.ctx; const W = c2.canvas.width, H = c2.canvas.height;
          c2.clearRect(0, 0, W, H); c2.fillStyle = '#26407a'; c2.font = `600 ${H * 0.62}px ${FONT.num}`; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText(txt, W / 2, H / 2);
          hLabel.userData.tex.needsUpdate = true;
        }
        hLabel.quaternion.copy(ctx.camera.quaternion);
      }
    },
    dispose() { aF.dispose(); aG.dispose(); aN.dispose(); card.dispose(); },
  };
  return rt;
}
