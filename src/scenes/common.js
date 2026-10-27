// 各课共用的器材
import * as THREE from 'three';
import { box, cyl, sphere, tube, inkMat, litMat, edgeLines, canvasTex, paperFill, inkify, ForceArrow, Card, polyLine } from '../core/ink.js';
import { FONT, INK, FORCES } from '../core/const.js';

export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// 钩码：圆柱 + 上方挂钩 + 下方挂环
export function hookWeight(r = 0.42, h = 0.55, color = '#e9e6de') {
  const g = new THREE.Group();
  const body = cyl(r, r, h, { ink: { color, uv: [10, 3] }, seg: 28 });
  body.position.y = 0.06;
  g.add(body);
  const top = cyl(r * 0.5, r * 0.85, 0.08, { ink: { color }, seg: 24, hull: false });
  top.position.y = h + 0.06; g.add(top);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 20, Math.PI * 1.6), inkMat({ color: '#d7d3ca' }));
  hook.position.y = h + 0.3; hook.rotation.z = -0.4;
  inkify(hook, { edges: false, hull: true, hullWidth: 1 });
  g.add(hook);
  const stem = cyl(0.03, 0.03, 0.18, { ink: { color: '#d7d3ca' }, seg: 6, hull: false, edges: false });
  stem.position.y = h + 0.12; g.add(stem);
  g.userData.height = h + 0.42;
  return g;
}

// 铁架台
export function ironStand({ height = 20, armLen = 6, baseW = 10, baseD = 6 } = {}) {
  const g = new THREE.Group();
  const base = box(baseW, 0.6, baseD, { ink: { color: '#d9d6cf' } });
  g.add(base);
  const rod = cyl(0.28, 0.28, height, { ink: { color: '#e4e1da', uv: [6, 30] }, seg: 16 });
  rod.position.set(-baseW / 2 + 1.6, 0.6, 0);
  g.add(rod);
  const clamp = box(1.2, 1.0, 1.1, { ink: { color: '#d0ccc4' } });
  clamp.position.set(rod.position.x, height - 1.1, 0);
  g.add(clamp);
  const arm = cyl(0.2, 0.2, armLen, { ink: { color: '#e4e1da', uv: [6, 12] }, seg: 12, base: false });
  arm.rotation.z = Math.PI / 2;
  arm.position.set(rod.position.x + armLen / 2, height - 0.6, 0);
  g.add(arm);
  const screw = cyl(0.12, 0.12, 0.8, { ink: { color: '#cfcac2' }, seg: 8, base: false });
  screw.rotation.x = Math.PI / 2; screw.position.set(rod.position.x, height - 0.6, 0.8);
  g.add(screw);
  g.userData.armEnd = v3(rod.position.x + armLen, height - 0.6, 0);
  return g;
}

// 刻度尺纹理
export function rulerTex({ len = 100, every = 10, label = 'cm', px = 18, h = 64, from = 0 } = {}) {
  return canvasTex(Math.round(len * px), h, (ctx, W, H) => {
    paperFill(ctx, W, H, '#f3efe2', 0.03);
    ctx.fillStyle = INK; ctx.strokeStyle = INK;
    for (let i = 0; i <= len; i++) {
      const x = i * px;
      const major = (i + from) % every === 0;
      const mid = (i + from) % (every / 2) === 0;
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, major ? H * 0.5 : mid ? H * 0.34 : H * 0.2); ctx.stroke();
      if (major) { ctx.font = `500 ${H * 0.36}px ${FONT.math}`; ctx.textAlign = 'center'; ctx.fillText(String(i + from), Math.min(W - 14, Math.max(14, x)), H * 0.9); }
    }
  });
}

// 一张写满数据的小牌子（不带支架）
export function dataCard(w, h, opts = {}) { return new Card(Object.assign({ w, h }, opts)); }

// 光滑小车（带四个轮子）
export function cart({ L = 3.2, W = 1.8, H = 0.9, wheel = 0.45, color = '#ecebe6' } = {}) {
  const g = new THREE.Group();
  const body = box(L, H, W, { ink: { color } });
  body.position.y = wheel * 0.9;
  g.add(body);
  const rim = box(L * 0.96, 0.18, W * 0.96, { ink: { color: '#e2e0da' } });
  rim.position.y = wheel * 0.9 + H; g.add(rim);
  const wheels = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wg = new THREE.Group();
    const wm = cyl(wheel, wheel, 0.28, { ink: { color: '#d5d2ca', uv: [8, 2] }, seg: 24, base: false });
    wm.rotation.x = Math.PI / 2;
    wg.add(wm);
    const spoke = box(wheel * 1.5, 0.05, 0.3, { base: false, ink: { color: '#bdb8ae' }, edges: false, cast: false });
    wm.add(spoke); spoke.rotation.x = Math.PI / 2;
    wg.position.set(sx * (L / 2 - wheel * 0.9), wheel, sz * (W / 2 + 0.02));
    g.add(wg); wheels.push(wg);
  }
  g.userData.wheels = wheels; g.userData.wheelR = wheel;
  g.userData.height = wheel * 0.9 + H + 0.18;
  return g;
}

// 滑轮（装在桌边）
export function pulley(r = 0.7) {
  const g = new THREE.Group();
  const wheel = new THREE.Group();
  const w = cyl(r, r, 0.3, { ink: { color: '#e6e3dc', uv: [10, 2] }, seg: 32, base: false });
  w.rotation.x = Math.PI / 2; wheel.add(w);
  const groove = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 8, 40), inkMat({ color: '#cfcbc2' }));
  inkify(groove, { edges: false, hull: false }); wheel.add(groove);
  const sp = box(r * 1.7, 0.08, 0.32, { base: false, ink: { color: '#d0ccc3' }, edges: true });
  sp.rotation.x = Math.PI / 2; wheel.add(sp);
  g.add(wheel);
  const axle = cyl(0.12, 0.12, 0.6, { ink: { color: '#bfbab0' }, seg: 8, base: false, edges: false });
  axle.rotation.x = Math.PI / 2; g.add(axle);
  const bracket = box(0.3, r + 0.5, 0.7, { ink: { color: '#d9d6cf' } });
  bracket.position.set(-0.2, -r - 0.5, 0); g.add(bracket);
  g.userData.wheel = wheel; g.userData.r = r;
  return g;
}

// 一根绳子（可更新的折线）
export class Rope {
  constructor(n = 2, width = 1.6) {
    this.n = n;
    this.width = width;
    this.line = polyLine(Array.from({ length: n }, () => v3(0, 0, 0)), { width, color: '#4a4550' });
    this.line.frustumCulled = false;
  }
  set(points) {
    const arr = [];
    for (let i = 0; i < points.length - 1; i++) { const a = points[i], b = points[i + 1]; arr.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    this.line.geometry.setPositions(arr);
  }
}

// 木头人（像参考视频里的人偶），关节可动
export function mannequin({ scale = 1, color = '#ece7dc' } = {}) {
  const m = inkMat({ color, scale: 0.16 });
  const part = (r1, r2, len) => {
    const geo = new THREE.CapsuleGeometry((r1 + r2) / 2, len, 6, 14);
    geo.translate(0, -len / 2 - (r1 + r2) / 2, 0);
    const mesh = new THREE.Mesh(geo, m);
    inkify(mesh, { edges: false, hull: true, hullWidth: 1.3 });
    return mesh;
  };
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 9.2; root.add(hips);
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), m); pelvis.scale.set(1.2, 0.8, 0.8); inkify(pelvis, { edges: false, hull: true, hullWidth: 1.3 }); hips.add(pelvis);
  const spine = new THREE.Group(); spine.position.y = 0.4; hips.add(spine);
  const torso = part(0.95, 1.1, 3.0); torso.rotation.z = Math.PI; torso.position.y = -0.2; spine.add(torso);
  const neck = new THREE.Group(); neck.position.y = 4.3; spine.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 16), m); head.scale.set(0.85, 1.05, 0.9); head.position.y = 1.2; inkify(head, { edges: false, hull: true, hullWidth: 1.3 }); neck.add(head);
  const limbs = {};
  const arm = (side) => {
    const sh = new THREE.Group(); sh.position.set(side * 1.45, 3.7, 0); spine.add(sh);
    const up = part(0.42, 0.36, 2.2); sh.add(up);
    const el = new THREE.Group(); el.position.y = -2.95; sh.add(el);
    const lo = part(0.34, 0.3, 2.0); el.add(lo);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), m); hand.position.y = -2.85; inkify(hand, { edges: false, hull: true, hullWidth: 1.2 }); el.add(hand);
    return { sh, el, hand };
  };
  const leg = (side) => {
    const hp = new THREE.Group(); hp.position.set(side * 0.65, -0.3, 0); hips.add(hp);
    const up = part(0.55, 0.45, 3.3); hp.add(up);
    const kn = new THREE.Group(); kn.position.y = -4.3; hp.add(kn);
    const lo = part(0.42, 0.36, 3.2); kn.add(lo);
    const ft = new THREE.Group(); ft.position.y = -4.1; kn.add(ft);
    const foot = box(0.8, 0.45, 1.7, { ink: { color }, base: false }); foot.position.set(0, -0.15, 0.4); ft.add(foot);
    return { hp, kn, ft };
  };
  limbs.armL = arm(-1); limbs.armR = arm(1); limbs.legL = leg(-1); limbs.legR = leg(1);
  root.userData = { hips, spine, neck, limbs };
  root.scale.setScalar(scale);
  return root;
}

export function forceArrow(kind, opts = {}) {
  const a = new ForceArrow(FORCES[kind].color, opts);
  a.group.userData.noPop = true;
  return a;
}

export function glowDecal(color, w = 4, h = 4) {
  const t = canvasTex(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, color, transparent: true, opacity: 0.35, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  m.raycast = () => {};
  return m;
}

export function label3d(text, { size = 1, color = INK, font = FONT.hand, w = 6, h = 1.6, weight = 400 } = {}) {
  const t = canvasTex(Math.round(w * 80), Math.round(h * 80), (ctx, W, H) => {
    ctx.fillStyle = color; ctx.font = `${weight} ${Math.round(H * 0.6 * size)}px ${font}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, H / 2, W - 10);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.raycast = () => {};
  m.userData.tex = t;
  return m;
}
