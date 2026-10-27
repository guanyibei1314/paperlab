// 第 1 课 力有多大：铁架台 + 弹簧测力计 + 钩码
import * as THREE from 'three';
import { box, cyl, tube, inkMat, litMat, edgeLines, canvasTex, paperFill, Card, polyLine } from '../core/ink.js';
import { FONT, INK, FORCES, clamp, fmt } from '../core/const.js';
import { hookWeight, ironStand, forceArrow, glowDecal, v3 } from './common.js';

const K = 100;          // 弹簧劲度系数 N/m（5 N 伸长 5 cm）
const M0 = 0.05;        // 每个钩码 50 g
const VIS = 110;        // 1 m 伸长 → 110 场景厘米（5 cm → 5.5）
const G_EARTH = 9.8, G_MOON = 1.62;

function scaleFaceTex() {
  return canvasTex(200, 1000, (ctx, W, H) => {
    paperFill(ctx, W, H, '#f4f1e8', 0.025);
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeRect(4, 4, W - 8, H - 8);
    // 刻度：0 在 y0，每 1 N = 1.1 场景厘米；面板高 9 cm → 1000 px，每厘米约 111 px
    const pxPerCm = H / 9;
    const y0 = 2.3 * pxPerCm;
    ctx.fillStyle = INK;
    for (let i = 0; i <= 25; i++) {
      const y = y0 + i * 0.2 * 1.1 * pxPerCm;
      const major = i % 5 === 0;
      ctx.lineWidth = major ? 4 : 2;
      ctx.beginPath(); ctx.moveTo(W - 18, y); ctx.lineTo(W - 18 - (major ? 70 : 38), y); ctx.stroke();
      if (major) { ctx.font = `600 64px ${FONT.math}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(String(i / 5), 22, y); }
    }
    ctx.font = `700 60px ${FONT.math}`; ctx.textAlign = 'center'; ctx.fillText('N', W / 2, H - 70);
  });
}

export function build(ctx) {
  const { st } = ctx;
  const root = new THREE.Group();
  const stand = ironStand({ height: 20.5, armLen: 6.2, baseW: 10, baseD: 6 });
  stand.position.set(-1.5, 0, -3.2);
  root.add(stand);
  const armEnd = stand.userData.armEnd.clone().add(stand.position);
  const hx = armEnd.x - 0.2, hz = armEnd.z;

  // 弹簧测力计（挂在横杆末端）
  const meter = new THREE.Group();
  const yb = 19.2; // 面板顶端
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 8, 24), inkMat({ color: '#d7d3ca' }));
  ring.position.set(hx, yb + 0.6, hz); meter.add(ring);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 9, 0.3), [litMat({ color: '#e9e6de' }), litMat({ color: '#e9e6de' }), litMat({ color: '#e9e6de' }), litMat({ color: '#e9e6de' }), litMat({ map: scaleFaceTex() }), litMat({ color: '#e9e6de' })]);
  board.position.set(hx - 0.9, yb - 4.5, hz - 0.1);
  board.castShadow = true;
  board.add(edgeLines(board.geometry, { overshoot: 0.02 }));
  meter.add(board);
  // 弹簧（螺旋线），用缩放来伸长
  const coilPts = [];
  const turns = 14, L0 = 2.0, rC = 0.34;
  for (let i = 0; i <= turns * 24; i++) { const t = i / (turns * 24); coilPts.push(v3(Math.cos(t * turns * Math.PI * 2) * rC, -t * L0, Math.sin(t * turns * Math.PI * 2) * rC)); }
  const spring = tube(new THREE.CatmullRomCurve3(coilPts), 0.06, { segs: 400, radial: 6, ink: { color: '#d8d4cb' }, hullWidth: 0.9 });
  const springG = new THREE.Group(); springG.add(spring);
  springG.position.set(hx, yb - 0.3, hz + 0.45);
  meter.add(springG);
  const topCap = box(0.9, 0.3, 0.6, { ink: { color: '#d9d6cf' } }); topCap.position.set(hx, yb - 0.45, hz + 0.3); meter.add(topCap);
  // 指针 + 拉杆 + 挂钩
  const slider = new THREE.Group();
  const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 3), litMat({ color: '#c0392b' }));
  pointer.rotation.z = Math.PI / 2; pointer.position.set(-0.55, 0, -0.05); slider.add(pointer);
  const bar = box(0.9, 0.12, 0.12, { base: false, ink: { color: '#c9c4ba' } }); bar.position.set(-0.15, 0, 0); slider.add(bar);
  const rodLen = 4.0;
  const rod = cyl(0.05, 0.05, rodLen, { ink: { color: '#d0ccc4' }, seg: 6, hull: true, edges: false });
  rod.position.y = -rodLen; slider.add(rod);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 20, Math.PI * 1.5), inkMat({ color: '#d0ccc4' }));
  hook.position.y = -rodLen - 0.15; hook.rotation.z = Math.PI * 0.75; slider.add(hook);
  slider.position.set(hx, yb - 0.3 - L0, hz + 0.45);
  meter.add(slider);
  meter.userData.delay = 0.3;
  root.add(meter);

  // 钩码：挂着的 + 备用的
  const chain = new THREE.Group(); meter.add(chain);
  const spareG = new THREE.Group(); stand.add(spareG);
  const hooks = [], spares = [];
  for (let i = 0; i < 8; i++) {
    const h = hookWeight(0.42, 0.5); h.visible = false; chain.add(h); hooks.push(h);
    const s = hookWeight(0.42, 0.5); spareG.add(s); spares.push(s);
    s.position.set(1.4 + (i % 4) * 1.05, 0.6, -1.2 + Math.floor(i / 4) * 1.15);
  }
  const HH = hooks[0].userData.height - 0.06;

  // 读数牌
  const card = new Card({ w: 6.4, h: 4.4, tilt: -14 });
  card.group.position.set(6.6, 0, -1.2);
  card.group.rotation.y = -0.25;
  root.add(card.group);
  const placeCard = new Card({ w: 5.2, h: 2.4, tilt: -14 });
  placeCard.group.position.set(6.4, 0, 3.4);
  placeCard.group.rotation.y = -0.2;
  root.add(placeCard.group);

  // 力的箭头
  const aG = forceArrow('G', { scale: 1.45, width: 0.2, labelSide: 1 });
  const aT = forceArrow('T', { scale: 1.45, width: 0.2, labelSide: -1 });
  root.add(aG.group, aT.group);
  const glow = glowDecal(FORCES.G.color, 5, 5); glow.position.set(hx, 0.03, hz + 0.6); glow.userData.noPop = true; root.add(glow);

  // 物理
  let x = 0, v = 0; // 弹簧伸长（米）
  let n = st.ctrl.n, gval = st.ctrl.place === 'moon' ? G_MOON : G_EARTH;
  let lastMargin = '';
  let settledT = 0;

  function layoutHooks() {
    hooks.forEach((h, i) => { h.visible = i < n; });
    spares.forEach((s, i) => { s.visible = i < 8 - n; });
  }
  layoutHooks();

  function drawCards() {
    const m = n * M0, G = m * gval;
    card.draw({ title: '钩码受到的重力', color: FORCES.G.color, icon: true, value: `${fmt(G, 2)} N`, lines: [`质量 ${n * 50} g = ${fmt(m, 2)} kg`, { t: `测力计读数 ≈ ${fmt(G, 1)} N`, hand: true, s: 1.15, c: '#26407a' }] });
    placeCard.draw({ title: gval === G_MOON ? '地点：月球' : '地点：地球', lines: [`g ≈ ${gval} N/kg`, gval === G_MOON ? '约为地球上的 1/6' : '教材取 9.8 N/kg'], lineSize: 0.16 });
  }
  drawCards();

  const rt = {
    root,
    steps: [
      { cap: '插图从纸上立起来：铁架台上挂着一只弹簧测力计。', shot: ctx.shot(0.8, 9.5, -2, { pitch: 30, w: 27, h: 26, pw: 22, ph: 30 }), dur: 5 },
      { cap: '挂上 2 个钩码，弹簧被拉长了。', shot: ctx.shot(-1.2, 12, -2.5, { pitch: 26, yaw: -10, w: 12, h: 14 }), dur: 5, enter: () => setN(2) },
      { cap: '紫色箭头是钩码受到的重力，粉色箭头是弹簧向上的弹力。钩码静止时，它们一样长。', shot: ctx.shot(0, 10.5, -2, { pitch: 22, yaw: 22, w: 13, h: 15 }), dur: 7 },
      { cap: '再挂 2 个：重力变成原来的 2 倍，弹簧的伸长也变成 2 倍。', shot: ctx.shot(-0.5, 10, -2.5, { pitch: 26, yaw: -6, w: 14, h: 16 }), dur: 6, enter: () => setN(4) },
      { cap: '轮到你了：增减钩码，或者把整套器材搬到月球上。', shot: ctx.shot(1.8, 9.5, -1.5, { pitch: 30, w: 28, h: 25, pw: 22, ph: 33 }), interactive: true },
    ],
    pickables: [
      { obj: spareG, cursor: 'pointer', down: () => ctx.act({ type: 'step', ctrl: 'n', delta: 1 }) },
      { obj: chain, cursor: 'pointer', down: () => ctx.act({ type: 'step', ctrl: 'n', delta: -1 }) },
    ],
    onControl(id, val) {
      if (id === 'n') { const prev = n; n = val; layoutHooks(); if (val > prev) ctx.sfx.clink(0.6); ctx.sfx.spring(); }
      if (id === 'place') gval = val === 'moon' ? G_MOON : G_EARTH;
      drawCards(); ctx.marginChanged();
    },
    margin() {
      const m = n * M0;
      return ['G = mg', `= ${fmt(m, 2)} kg × ${gval} N/kg`, `≈ ${fmt(m * gval, 2)} N`];
    },
    update(dt) {
      const m = n * M0, mt = m + 0.012;
      const c = 2 * 0.12 * Math.sqrt(K * mt);
      const sub = 8;
      for (let i = 0; i < sub; i++) {
        const h = dt / sub;
        const a = (m * gval - K * x - c * v) / mt;
        v += a * h; x += v * h;
        if (x < 0) { x = 0; v = Math.max(0, v); }
      }
      const ext = x * VIS;
      springG.scale.y = (L0 + ext) / L0;
      slider.position.y = yb - 0.3 - L0 - ext;
      chain.position.set(slider.position.x, slider.position.y - rodLen - 0.42, slider.position.z);
      // 钩码一个接一个往下挂
      hooks.forEach((h, i) => { h.position.set(0, -(i + 1) * HH, 0); });
      const risen = ctx.risen() > 0.98;
      const G = m * gval;
      const cmY = chain.position.y - (n * HH) / 2;
      const o = v3(chain.position.x, cmY, chain.position.z + 1.0);
      if (risen && n > 0) {
        aG.set(o, v3(0, -G, 0), `G ${fmt(G, 2)} N`);
        aT.set(o, v3(0, K * x, 0), `F ${fmt(K * x, 2)} N`);
        glow.visible = true; glow.material.opacity = 0.18 + 0.05 * n;
      } else { aG.group.visible = false; aT.group.visible = false; glow.visible = false; }
      const mk = `${n}|${gval}`;
      if (mk !== lastMargin) { lastMargin = mk; ctx.marginChanged(); }
      // 挑战：月球上读数超过 0.5 N
      if (gval === G_MOON && G > 0.5 && Math.abs(v) < 0.002) { settledT += dt; if (settledT > 0.6) ctx.complete(); } else settledT = 0;
    },
    dispose() { aG.dispose(); aT.dispose(); card.dispose(); placeCard.dispose(); },
  };
  function setN(k) { ctx.setCtrl('n', k); rt.onControl('n', k); }
  return rt;
}
