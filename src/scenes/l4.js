// 第 4 课 二力平衡：桌面小车 + 两侧滑轮钩码
import * as THREE from 'three';
import { box, Card, ghostOf } from '../core/ink.js';
import { FORCES, INK, clamp, fmt } from '../core/const.js';
import { cart, pulley, hookWeight, Rope, forceArrow, v3 } from './common.js';

const M_CART = 0.2, M0 = 0.05, G = 9.8;
const SCALE = 10;                 // 1 场景厘米 = 10 真实厘米
const TOP = 8, PX = 8.4, PR = 0.6, PY = TOP + 0.1;
const RANGE = 3.5;

export function build(ctx) {
  const { st } = ctx;
  const root = new THREE.Group();
  const app = new THREE.Group(); root.add(app);
  const Z = -3.6;
  // 桌子
  const top = box(16.6, 0.5, 4.4, { ink: { color: '#e6e0d2' } }); top.position.set(0, TOP - 0.5, Z); app.add(top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const leg = box(0.55, TOP - 0.5, 0.55, { ink: { color: '#ddd6c7' } }); leg.position.set(sx * 7.6, 0, Z + sz * 1.7); app.add(leg); }
  const stopL = box(0.4, 0.6, 2.4, { ink: { color: '#d4cdbd' } }); stopL.position.set(-(RANGE + 1.85), TOP, Z); app.add(stopL);
  const stopR = stopL.clone(); stopR.position.x = RANGE + 1.85; app.add(stopR);
  // 滑轮
  const pl = pulley(PR), pr = pulley(PR);
  pl.position.set(-PX, PY, Z); pl.rotation.y = Math.PI; pr.position.set(PX, PY, Z);
  app.add(pl, pr);
  // 小车
  const car = cart({ L: 3.2, W: 1.9, H: 0.6, wheel: 0.32 });
  const carG = new THREE.Group(); carG.add(car); app.add(carG);
  carG.position.set(0, TOP, Z);
  const attachY = TOP + 0.62;
  // 钩码
  const hangL = new THREE.Group(), hangR = new THREE.Group(); app.add(hangL, hangR);
  const hooksL = [], hooksR = [];
  for (let i = 0; i < 5; i++) { const a = hookWeight(0.38, 0.45); hangL.add(a); hooksL.push(a); const b = hookWeight(0.38, 0.45); hangR.add(b); hooksR.push(b); }
  const HH = hooksL[0].userData.height - 0.05;
  // 绳子
  const ropeL = new Rope(4, 1.5), ropeR = new Rope(4, 1.5);
  ropeL.line.userData.noPop = true; ropeR.line.userData.noPop = true;
  root.add(ropeL.line, ropeR.line);
  // 读数牌
  const card = new Card({ w: 6.6, h: 4.0, tilt: -16 });
  card.group.position.set(0, 0, 3.3); card.group.rotation.y = 0;
  root.add(card.group);
  // 箭头
  const a1 = forceArrow('F', { scale: 2.5, width: 0.15, labelSide: 1 });
  const a2 = forceArrow('F', { scale: 2.5, width: 0.15, labelSide: 1 });
  const an = forceArrow('net', { scale: 2.5, width: 0.17, labelSide: 1 });
  root.add(a1.group, a2.group, an.group);

  // 状态（真实单位：x 米，v 米/秒）
  let x = 0, v = 0, phi = 0, omega = 0, ghostT = 0, uniformT = 0, twisting = false;
  const L0 = 1.6; // 竖直段的初始长度（场景厘米）
  const ghosts = [];
  function clearGhosts() { ghosts.forEach(g => app.remove(g)); ghosts.length = 0; }
  function nL() { return st.ctrl.nL; }
  function nR() { return st.ctrl.nR; }
  function layout() {
    const xs = x * 100 / SCALE;
    carG.position.x = xs; carG.rotation.y = phi;
    const hx = 1.6 * Math.cos(phi), hz = 1.6 * Math.sin(phi);
    const aL = v3(xs - hx, attachY, Z + hz), aR = v3(xs + hx, attachY, Z - hz);
    const lenL = L0 + xs, lenR = L0 - xs; // 竖直段长度（场景厘米）
    hangL.position.set(-PX - PR, PY - lenL, Z);
    hangR.position.set(PX + PR, PY - lenR, Z);
    hooksL.forEach((h, i) => { h.visible = i < nL(); h.position.y = -(i + 1) * HH; });
    hooksR.forEach((h, i) => { h.visible = i < nR(); h.position.y = -(i + 1) * HH; });
    ropeL.set([aL, v3(-PX, PY + PR, Z), v3(-PX - PR, PY, Z), v3(-PX - PR, PY - lenL + 0.02, Z)]);
    ropeR.set([aR, v3(PX, PY + PR, Z), v3(PX + PR, PY, Z), v3(PX + PR, PY - lenR + 0.02, Z)]);
    return { aL, aR };
  }
  function state() {
    const F = (nR() - nL()) * M0 * G;
    if (Math.abs(F) > 1e-6) return '合力不为零：加速运动';
    return Math.abs(v) > 1e-4 ? '二力平衡：匀速直线运动' : '二力平衡：静止';
  }
  function drawCard() {
    const F1 = nL() * M0 * G, F2 = nR() * M0 * G;
    card.draw({ title: '小车受到的两个拉力', color: FORCES.F.color, lines: [
      `向左 F₁ = ${fmt(F1, 2)} N　向右 F₂ = ${fmt(F2, 2)} N`,
      { t: `合力 = ${fmt(Math.abs(F2 - F1), 2)} N${F2 > F1 ? '，向右' : F2 < F1 ? '，向左' : ''}`, w: 700, c: FORCES.net.color === '#e9a800' ? '#a77800' : FORCES.net.color },
      { t: `速度 ${fmt(Math.abs(v), 2)} m/s`, hand: true, s: 1.2, c: '#26407a' },
      { t: state(), w: 700 },
    ], lineSize: 0.11 });
  }
  function reset() { x = 0; v = 0; phi = 0; omega = 0; clearGhosts(); uniformT = 0; drawCard(); }
  reset(); layout();

  let lastCard = '';
  const rt = {
    root,
    steps: [
      { cap: '桌上的小车两端系着细绳，绳子绕过滑轮挂着钩码。', shot: ctx.shot(0, 5.5, -2.5, { pitch: 30, w: 25, h: 17, pw: 21, ph: 26 }), dur: 5 },
      { cap: '两边各挂 2 个钩码：两个拉力一样大、方向相反，小车静止不动。', shot: ctx.shot(0, 7.5, -3, { pitch: 26, w: 21, h: 11 }), dur: 6, enter: () => { ctx.setCtrl('nL', 2); ctx.setCtrl('nR', 2); reset(); } },
      { cap: '轻轻推一下……松手后，小车一直匀速向右运动，直到碰到挡板。虚影的间隔一样大。', shot: ctx.shot(0.5, 7.5, -3, { pitch: 30, w: 22, h: 12 }), dur: 8, enter: () => { reset(); v = 0.12; } },
      { cap: '右边多挂 1 个：合力向右，小车越来越快。', shot: ctx.shot(0.5, 7, -3, { pitch: 28, w: 22, h: 12 }), dur: 6, enter: () => { reset(); ctx.setCtrl('nR', 3); } },
      { cap: '轮到你：增减钩码、推一推；也可以按住小车转个角度再松手。', shot: ctx.shot(0, 5.5, -2, { pitch: 32, w: 26, h: 18, pw: 21, ph: 27 }), interactive: true, enter: () => { reset(); ctx.setCtrl('nL', 2); ctx.setCtrl('nR', 2); } },
    ],
    pickables: [{
      obj: carG, cursor: 'grab',
      down: (hit, ray, e) => { twisting = true; this_d = { x: e.clientX, phi0: phi }; omega = 0; },
      move: (ray, e) => { if (!this_d) return; phi = clamp(this_d.phi0 + (e.clientX - this_d.x) * 0.01, -0.7, 0.7); },
      up: () => { twisting = false; this_d = null; },
    }],
    onControl(id) {
      if (id === 'push') { v += 0.12; ctx.sfx.thud(0.3); }
      if (id === 'reset') reset();
      if (id === 'nL' || id === 'nR') { if (Math.abs(x) >= RANGE * SCALE / 100 - 1e-4) { x = 0; v = 0; } }
      clearGhosts(); drawCard(); ctx.marginChanged();
    },
    margin() {
      const F1 = nL() * M0 * G, F2 = nR() * M0 * G;
      return [`F₁ = ${nL()} × 0.49 = ${fmt(F1, 2)} N`, `F₂ = ${nR()} × 0.49 = ${fmt(F2, 2)} N`, `F合 = ${fmt(Math.abs(F2 - F1), 2)} N`];
    },
    update(dt) {
      const F = (nR() - nL()) * M0 * G;
      const M = M_CART + (nL() + nR()) * M0;
      const a = F / M;
      const lim = RANGE * SCALE / 100;
      const sub = 4, h = dt / sub;
      for (let i = 0; i < sub; i++) {
        v += a * h; x += v * h;
        if (x > lim) { x = lim; if (v > 0.02) ctx.sfx.thud(Math.min(1, v * 3)); v = 0; }
        if (x < -lim) { x = -lim; if (v < -0.02) ctx.sfx.thud(Math.min(1, -v * 3)); v = 0; }
        if (!twisting) {
          const w2 = 9 * (nL() + nR()) / 4;
          const alpha = -w2 * Math.sin(phi) - 2 * 0.22 * Math.sqrt(Math.max(w2, 0.01)) * omega;
          omega += alpha * h; phi += omega * h;
        }
      }
      const { aL, aR } = layout();
      // 残影
      if (Math.abs(v) > 1e-3) { ghostT += dt; if (ghostT > 0.5 && ghosts.length < 40) { ghostT = 0; const g = ghostOf(carG, 0.35); g.position.copy(carG.position); g.rotation.copy(carG.rotation); app.add(g); ghosts.push(g); } } else ghostT = 0.5;
      // 挑战：平衡时向右匀速运动 1.5 s
      if (nL() === nR() && v > 0.01 && Math.abs(x) < lim) { uniformT += dt; if (uniformT > 1.5) ctx.complete(); } else uniformT = 0;
      const risen = ctx.risen() > 0.98;
      const F1 = nL() * M0 * G, F2 = nR() * M0 * G;
      if (risen) {
        const dL = v3(-PX, PY + PR, Z).sub(aL).normalize(), dR = v3(PX, PY + PR, Z).sub(aR).normalize();
        a1.set(aL.clone().add(v3(0, 0.05, 0)), dL.multiplyScalar(F1), F1 > 0 ? `F₁ ${fmt(F1, 2)} N` : '');
        a2.set(aR.clone().add(v3(0, 0.05, 0)), dR.multiplyScalar(F2), F2 > 0 ? `F₂ ${fmt(F2, 2)} N` : '');
        if (Math.abs(F2 - F1) > 1e-6) an.set(v3(carG.position.x, attachY + 1.6, Z), v3(F2 - F1, 0, 0), `合力 ${fmt(Math.abs(F2 - F1), 2)} N`); else an.group.visible = false;
      } else { a1.group.visible = a2.group.visible = an.group.visible = false; }
      const ck = `${nL()}${nR()}${fmt(Math.abs(v), 2)}${state()}`;
      if (ck !== lastCard) { lastCard = ck; drawCard(); }
    },
    dispose() { a1.dispose(); a2.dispose(); an.dispose(); card.dispose(); },
  };
  let this_d = null;
  return rt;
}
