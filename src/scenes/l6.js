// 第 6 课 同时落地：牛顿管（有空气 / 真空）+ 阿波罗 15 号月面实验
import * as THREE from 'three';
import { box, cyl, sphere, tube, inkMat, litMat, edgeLines, glassMat, Card, canvasTex, polyLine } from '../core/ink.js';
import { FORCES, INK, FONT, clamp, fmt, easeInOut } from '../core/const.js';
import { forceArrow, mannequin, v3, label3d } from './common.js';

const G = 9.8, G_MOON = 1.62;
const TUBE_LEN = 13, TUBE_R = 1.15, SPM = 10.6; // 场景厘米 / 米
const TRAVEL = 1.0;                              // 管内下落 1 m
const VT = 0.7;                                  // 羽毛在空气中的终端速度（示意）
const MOON_H = 1.6;                              // 阿波罗 15 号松手高度约 1.6 m

function feather(len = 2.2) {
  const g = new THREE.Group();
  const shaft = new THREE.CatmullRomCurve3([v3(0, -len / 2, 0), v3(0.12, 0, 0), v3(0.05, len / 2, 0)]);
  g.add(tube(shaft, 0.03, { segs: 30, radial: 5, ink: { color: '#e9e5dc' }, hullWidth: 0.8 }));
  const vaneShape = new THREE.Shape();
  vaneShape.moveTo(0, -len * 0.35);
  vaneShape.quadraticCurveTo(0.65, -len * 0.1, 0.45, len * 0.42);
  vaneShape.quadraticCurveTo(0.2, len * 0.5, 0.05, len * 0.45);
  vaneShape.lineTo(0, -len * 0.35);
  const vg = new THREE.ShapeGeometry(vaneShape, 12);
  const m = inkMat({ color: '#f1ede4', side: THREE.DoubleSide, scale: 0.08 });
  const v1 = new THREE.Mesh(vg, m); v1.add(edgeLines(vg, { overshoot: 0, width: 1 })); g.add(v1);
  const v2 = v1.clone(); v2.scale.x = -0.7; g.add(v2);
  // 羽枝
  const barbs = [];
  for (let i = 0; i < 9; i++) { const y = -len * 0.3 + i * len * 0.08; barbs.push(v3(0.05, y, 0.01), v3(0.42 - Math.abs(i - 5) * 0.04, y + 0.18, 0.01)); barbs.push(v3(0.05, y, 0.01), v3(-0.3 + Math.abs(i - 5) * 0.03, y + 0.15, 0.01)); }
  const bl = polyLine([v3(0, 0, 0), v3(0, 0, 0)], { width: 0.8, color: '#6b6672' });
  const arr = []; for (const p of barbs) arr.push(p.x, p.y, p.z);
  bl.geometry.setPositions(arr); g.add(bl);
  g.traverse(o => { o.castShadow = true; });
  return g;
}

function hammer() {
  const g = new THREE.Group();
  const handle = cyl(0.12, 0.12, 3.2, { ink: { color: '#d9d3c6', uv: [4, 8] }, seg: 10 });
  handle.position.y = -2.6; g.add(handle);
  const head = box(1.5, 0.45, 0.45, { ink: { color: '#c9c6be' }, base: false }); head.position.y = 0.75; g.add(head);
  const pick = box(0.5, 0.3, 0.3, { ink: { color: '#c9c6be' }, base: false }); pick.position.set(-0.95, 0.75, 0); g.add(pick);
  return g;
}

export function build(ctx) {
  const { st } = ctx;
  const root = new THREE.Group();
  // ---------- 牛顿管 ----------
  const tubeRig = new THREE.Group(); root.add(tubeRig);
  const TX = -4.6, TZ = -3.6, TY = 8.9;
  const base = box(6, 0.5, 4.5, { ink: { color: '#ddd8ce' } }); base.position.set(TX, 0, TZ); tubeRig.add(base);
  const post = box(0.8, TY - 0.5, 0.8, { ink: { color: '#e3dfd6' } }); post.position.set(TX, 0.5, TZ - 1.8); tubeRig.add(post);
  const pivot = new THREE.Group(); pivot.position.set(TX, TY, TZ); tubeRig.add(pivot);
  const axle = cyl(0.25, 0.25, 1.9, { ink: { color: '#cfc9bd' }, seg: 12, base: false }); axle.rotation.x = Math.PI / 2; axle.position.z = -0.9; pivot.add(axle);
  const clampRing = new THREE.Mesh(new THREE.TorusGeometry(TUBE_R + 0.12, 0.14, 8, 32), inkMat({ color: '#d5d0c6' })); clampRing.rotation.x = Math.PI / 2; pivot.add(clampRing);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(TUBE_R, TUBE_R, TUBE_LEN, 48, 1, true), glassMat('#eef4f7', 0.08));
  glass.renderOrder = 3; pivot.add(glass);
  const circ = (r, y) => { const a = []; for (let i = 0; i < 48; i++) { const t = i / 48 * Math.PI * 2; a.push(v3(Math.cos(t) * r, y, Math.sin(t) * r)); } return a; };
  for (const sgn of [-1, 1]) {
    const cap = cyl(TUBE_R + 0.15, TUBE_R + 0.15, 0.6, { ink: { color: '#d6d1c7', uv: [16, 1] }, seg: 32, base: false });
    cap.position.y = sgn * (TUBE_LEN / 2 + 0.3); pivot.add(cap);
    pivot.add(polyLine(circ(TUBE_R, sgn * TUBE_LEN / 2), { closed: true, width: 1.1 }));
  }
  // 管内物体
  const coin = cyl(0.62, 0.62, 0.12, { ink: { color: '#dcd8cf', uv: [14, 1] }, seg: 32, base: false, hullWidth: 1.1 });
  pivot.add(coin);
  const fea = feather(2.3); pivot.add(fea);
  // 空气分子
  const NP = 70;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(NP * 3); const pSeed = [];
  for (let i = 0; i < NP; i++) { pSeed.push([Math.random() * 6.28, Math.random() * (TUBE_R - 0.25), (Math.random() - 0.5) * (TUBE_LEN - 0.6), Math.random() * 6.28]); }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const dotTex = canvasTex(32, 32, (c) => { c.fillStyle = '#5b6b8a'; c.beginPath(); c.arc(16, 16, 12, 0, 6.28); c.fill(); });
  const pMat = new THREE.PointsMaterial({ size: 0.3, map: dotTex, transparent: true, opacity: 0.7, depthWrite: false });
  const air = new THREE.Points(pGeo, pMat); air.renderOrder = 4; pivot.add(air);
  // 抽气机
  const pump = new THREE.Group(); pump.position.set(TX + 4.6, 0, TZ + 0.8); tubeRig.add(pump);
  const pbody = cyl(0.9, 0.9, 4.2, { ink: { color: '#e2ddd3', uv: [10, 6] }, seg: 24 }); pbody.position.y = 0.5; pump.add(pbody);
  const pbase = box(2.6, 0.5, 2.6, { ink: { color: '#d8d2c6' } }); pump.add(pbase);
  const piston = new THREE.Group(); pump.add(piston);
  const prod = cyl(0.15, 0.15, 2.6, { ink: { color: '#cbc5b9' }, seg: 8 }); piston.add(prod);
  const phandle = box(2.2, 0.35, 0.5, { ink: { color: '#d0c9bb' } }); phandle.position.y = 2.6; piston.add(phandle);
  piston.position.y = 4.7;
  const plab = label3d('抽气机', { w: 2.4, h: 0.7, font: FONT.serif, size: 0.9 }); plab.position.set(0, 2.4, 0.95); pump.add(plab);
  // 软管接到转轴后端（空心轴通到管内）
  const hose = tube(new THREE.CatmullRomCurve3([v3(TX + 4.6 - 0.9, 1.6, TZ + 0.8), v3(TX + 3.0, 1.0, TZ - 1.0), v3(TX + 1.2, 3.0, TZ - 2.6), v3(TX + 0.3, TY - 1.5, TZ - 2.7), v3(TX, TY, TZ - 2.25)]), 0.13, { segs: 60, ink: { color: '#cfc9be' }, hullWidth: 1 });
  tubeRig.add(hose);

  // ---------- 月面 ----------
  const moon = new THREE.Group(); root.add(moon);
  const MX = 5.2, MZ = -3.0;
  const patch = cyl(4.8, 5.0, 0.7, { ink: { color: '#cfcdc8', uv: [40, 2], scale: 0.12 }, seg: 48 }); patch.position.set(MX, 0, MZ); moon.add(patch);
  for (const [cx, cz, r] of [[-2.2, 1.2, 0.8], [1.8, -1.6, 0.6], [2.6, 1.4, 0.45], [-1.0, -2.6, 0.5]]) {
    const cr = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 6, 24), inkMat({ color: '#c9c7c1' })); cr.rotation.x = Math.PI / 2; cr.position.set(MX + cx, 0.72, MZ + cz); moon.add(cr);
  }
  const man = mannequin({ scale: 0.5, color: '#efede8' });
  man.position.set(MX - 1.3, 0.7, MZ - 0.6); man.rotation.y = 0.35; moon.add(man);
  const L = man.userData.limbs;
  L.armR.sh.rotation.x = -1.35; L.armL.sh.rotation.x = -1.35; L.armR.el.rotation.x = -0.1; L.armL.el.rotation.x = -0.1;
  L.armR.sh.rotation.z = 0.1; L.armL.sh.rotation.z = -0.1;
  // 头盔
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(1.35, 24, 16), glassMat('#eef2f6', 0.1)); helmet.position.y = 1.2; man.userData.neck.add(helmet);
  const pack = box(2.4, 3.2, 1.0, { ink: { color: '#e6e3dc' }, base: false }); pack.position.set(0, 2.0, -1.4); man.userData.spine.add(pack);
  const ham = hammer(); ham.scale.setScalar(0.75); moon.add(ham);
  const mf = feather(2.0); moon.add(mf);
  const moonCard = new Card({ w: 5.6, h: 3.3, tilt: -16 });
  moonCard.group.position.set(MX + 1.6, 0, MZ + 5.8); moonCard.group.rotation.y = -0.2; root.add(moonCard.group);
  const tubeCard = new Card({ w: 5.0, h: 3.3, tilt: -16 });
  tubeCard.group.position.set(TX - 0.6, 0, TZ + 6.6); tubeCard.group.rotation.y = 0.15; root.add(tubeCard.group);

  // 箭头
  const aGc = forceArrow('G', { scale: 1, width: 0.12, labelSide: 1 });
  const aGf = forceArrow('G', { scale: 1, width: 0.09, labelSide: -1 });
  const aDf = forceArrow('D', { scale: 1, width: 0.09, labelSide: -1 });
  root.add(aGc.group, aGf.group, aDf.group);

  // 状态
  let orient = 1, flipT = -1, falling = false, sc = 0, sf = 0, vc = 0, vf = 0, tFall = 0, tc = null, tf = null, airLevel = st.ctrl.air === 'air' ? 1 : 0, pumpT = 0;
  let moonFall = false, mt = 0, mh = 0, mvh = 0, mTime = null;
  const done = { air: false, vac: false, moon: false };
  const END = TUBE_LEN / 2 - 0.55;
  const handPos = () => { man.updateMatrixWorld(true); const a = new THREE.Vector3(), b = new THREE.Vector3(); L.armR.hand.getWorldPosition(a); L.armL.hand.getWorldPosition(b); moon.worldToLocal(a); moon.worldToLocal(b); return [a, b]; };
  function placeTubeObjects() {
    // 物体沿管轴的位置：从"下端"算起的高度 s（米）
    const bottom = -orient * END;
    coin.position.set(0.15, bottom + orient * (sc * SPM + 0.06), 0.1);
    coin.rotation.z = 0.15;
    const sway = (airLevel > 0.5 && falling && tf == null) ? Math.sin(tFall * 7) * 0.45 : 0;
    fea.position.set(-0.3 + sway, bottom + orient * (sf * SPM + 1.2), -0.1);
    fea.rotation.z = orient > 0 ? 0.1 + sway * 0.6 : Math.PI + 0.1 + sway * 0.6;
  }
  function resetTube() { sc = 0; sf = 0; vc = 0; vf = 0; falling = false; tc = tf = null; placeTubeObjects(); }
  function flip() {
    if (flipT >= 0) return;
    // 物体留在原来的"下端"，翻过来以后就在上端
    flipT = 0; falling = false; tc = tf = null; ctx.sfx.whoosh(0.5);
  }
  function resetMoon() {
    moonFall = false; mh = MOON_H; mvh = 0; mTime = null;
    const [a, b] = handPos();
    ham.position.copy(a).add(v3(0, -0.2, 0)); mf.position.copy(b).add(v3(0, -0.6, 0));
    ham.rotation.set(0, 0, 0); mf.rotation.set(0, 0, 0.2);
  }
  function dropMoon() { resetMoon(); moonFall = true; mt = 0; ctx.sfx.tick(); }
  function drawCards() {
    const L1 = [`硬币：${tc == null ? '—' : fmt(tc, 2) + ' s'}`, `羽毛：${tf == null ? '—' : fmt(tf, 2) + ' s'}`, { t: airLevel > 0.5 ? '管内有空气' : '管内抽成真空', hand: true, s: 1.1, c: '#26407a' }];
    tubeCard.draw({ title: '下落 1 m 用时', lines: L1, lineSize: 0.14 });
    const tm = Math.sqrt(2 * MOON_H / G_MOON);
    moonCard.draw({ title: '月球 · 1971 年 8 月 2 日', lines: [`锤子 1.32 kg、羽毛：${mTime == null ? '—' : fmt(mTime, 2) + ' s'}`, `理论值 √(2h/g) = ${fmt(tm, 2)} s`, { t: '“伽利略先生的发现是对的。”', hand: true, s: 1.0, c: '#26407a' }], lineSize: 0.12 });
  }
  resetTube(); resetMoon(); drawCards();

  const rt = {
    root,
    steps: [
      { cap: '一根 1 m 长的玻璃管，里面有一枚硬币和一根羽毛；旁边是抽气机。', shot: ctx.shot(0, 7, -2.5, { pitch: 30, w: 24, h: 19, pw: 20, ph: 26 }), dur: 5, enter: () => { ctx.setCtrl('scene', 'tube'); } },
      { cap: '管里有空气，把管子翻过来：硬币很快落到底，羽毛慢悠悠地飘。', shot: ctx.shot(-3.5, 8.5, -3.5, { pitch: 22, w: 15, h: 17 }), dur: 6, enter: () => { ctx.setCtrl('air', 'air'); rt.onControl('air', 'air'); resetTube(); flip(); } },
      { cap: '用抽气机把管里的空气抽掉：蓝色的小点代表空气分子，越来越少。', shot: ctx.shot(-2, 7.5, -2.5, { pitch: 26, w: 18, h: 17 }), dur: 5, enter: () => { ctx.setCtrl('air', 'vac'); rt.onControl('air', 'vac'); } },
      { cap: '再翻转一次：硬币和羽毛并排下落，同时到底。', shot: ctx.shot(-3.5, 8.5, -3.5, { pitch: 22, w: 15, h: 17 }), dur: 6, enter: () => { flip(); } },
      { cap: '1971 年 8 月 2 日，月球上没有空气。阿波罗 15 号指令长斯科特同时松开锤子和羽毛……', shot: ctx.shot(5, 4, -2.5, { pitch: 26, yaw: -12, w: 14, h: 11 }), dur: 7, enter: () => { ctx.setCtrl('scene', 'moon'); dropMoon(); } },
      { cap: '轮到你：在管子里和月球上都试一试。', shot: ctx.shot(0, 6.5, -1.5, { pitch: 32, w: 26, h: 19, pw: 20, ph: 27 }), interactive: true },
    ],
    pickables: [
      { obj: pivot, cursor: 'pointer', down: () => { ctx.setCtrl('scene', 'tube'); flip(); } },
      { obj: moon, cursor: 'pointer', down: () => { ctx.setCtrl('scene', 'moon'); dropMoon(); } },
    ],
    onControl(id, val) {
      if (id === 'air') { pumpT = 0; if (val === 'vac') ctx.sfx.noiseBurst({ dur: 1.4, f0: 300, f1: 900, q: 0.6, gain: 0.18 }); else ctx.sfx.noiseBurst({ dur: 0.8, f0: 3000, f1: 1500, q: 0.8, gain: 0.15 }); }
      if (id === 'go') { if (st.ctrl.scene === 'moon') dropMoon(); else flip(); }
      if (id === 'scene') ctx.marginChanged();
      drawCards();
    },
    margin() {
      if (st.ctrl.scene === 'moon') return ['h ≈ 1.6 m', 't = √(2h/g)', `= √(2×1.6/1.62)`, `≈ ${fmt(Math.sqrt(2 * 1.6 / 1.62), 2)} s`];
      return ['h = 1 m', 't = √(2h/g)', `≈ ${fmt(Math.sqrt(2 * TRAVEL / G), 2)} s`, '（真空时）'];
    },
    update(dt, time) {
      // 空气分子
      const target = st.ctrl.air === 'air' ? 1 : 0;
      if (airLevel !== target) { airLevel += clamp(target - airLevel, -dt / 1.6, dt / 1.0); pumpT += dt; }
      piston.position.y = 4.7 - (airLevel !== target && target === 0 ? Math.abs(Math.sin(pumpT * 5)) * 1.6 : 0);
      pMat.opacity = 0.75 * airLevel;
      air.visible = airLevel > 0.02;
      for (let i = 0; i < NP; i++) {
        const [a, r, y, ph] = pSeed[i];
        const ang = a + time * (1.3 + (i % 5) * 0.4);
        pPos[i * 3] = Math.cos(ang) * r + Math.sin(time * 7 + ph) * 0.06;
        pPos[i * 3 + 1] = y + Math.sin(time * 5 + ph * 3) * 0.25;
        pPos[i * 3 + 2] = Math.sin(ang) * r;
      }
      pGeo.attributes.position.needsUpdate = true;
      // 翻转
      if (flipT >= 0) {
        flipT += dt / 0.75;
        const k = easeInOut(clamp(flipT, 0, 1));
        const from = orient > 0 ? 0 : Math.PI;
        pivot.rotation.z = from + k * Math.PI;
        if (flipT >= 1) {
          pivot.rotation.z = (from + Math.PI) % (2 * Math.PI);
          orient = -orient; flipT = -1;
          // 物体现在在上端：高度 = 全程
          sc = TRAVEL; sf = TRAVEL; vc = 0; vf = 0; falling = true; tFall = 0; tc = tf = null; drawCards();
        } else {
          // 翻转过程中，物体贴在原来的下端（随管子转）
          const keep = orient; const bottom = -keep * END;
          coin.position.y = bottom + keep * 0.06; fea.position.y = bottom + keep * 1.2;
        }
      }
      if (falling) {
        const sub = 8, h = dt / sub;
        for (let i = 0; i < sub; i++) {
          tFall += h;
          if (tc == null) { vc += G * h; sc -= vc * h; if (sc <= 0) { sc = 0; tc = tFall; ctx.sfx.clink(0.6); drawCards(); } }
          if (tf == null) { const k = airLevel * G / (VT * VT); vf += (G - k * vf * vf) * h; sf -= vf * h; if (sf <= 0) { sf = 0; tf = tFall; ctx.sfx.tick(); drawCards(); } }
        }
        if (tc != null && tf != null) {
          falling = false;
          if (airLevel > 0.9) done.air = true; else if (airLevel < 0.1) done.vac = true;
          if (done.air && done.vac && done.moon) ctx.complete();
        }
      }
      if (flipT < 0) placeTubeObjects();
      // 月面
      if (moonFall) {
        mt += dt; mh = MOON_H - 0.5 * G_MOON * mt * mt;
        const [a, b] = handPos();
        const drop = (MOON_H - Math.max(0, mh)) / MOON_H; // 0..1
        const ground = 0.72;
        ham.position.set(a.x, (a.y - 0.2) - drop * (a.y - 0.2 - ground - 0.15), a.z);
        mf.position.set(b.x, (b.y - 0.6) - drop * (b.y - 0.6 - ground - 0.1), b.z);
        if (mh <= 0) { moonFall = false; mTime = Math.sqrt(2 * MOON_H / G_MOON); ham.rotation.z = 1.2; mf.rotation.z = 1.45; ctx.sfx.thud(0.4); done.moon = true; drawCards(); if (done.air && done.vac && done.moon) ctx.complete(); }
      }
      // 箭头（不标数值：硬币和羽毛的质量没有可靠数据）
      const risen = ctx.risen() > 0.98;
      if (risen && falling && st.ctrl.scene === 'tube') {
        const cw = new THREE.Vector3(); coin.getWorldPosition(cw); root.worldToLocal(cw);
        const fw = new THREE.Vector3(); fea.getWorldPosition(fw); root.worldToLocal(fw);
        aGc.set(cw.clone().add(v3(1.9, 0, 0)), v3(0, -2.2, 0), tc == null ? '硬币 G' : '');
        aGf.set(fw.clone().add(v3(-1.9, 0, 0)), v3(0, -0.7, 0), tf == null ? '羽毛 G' : '');
        const dr = airLevel * (vf * vf) / (VT * VT) * 0.7;
        if (tf == null && dr > 0.05) aDf.set(fw.clone().add(v3(-1.9, 0, 0)), v3(0, dr, 0), '空气阻力'); else aDf.group.visible = false;
        if (tc != null) aGc.group.visible = false;
        if (tf != null) { aGf.group.visible = false; aDf.group.visible = false; }
      } else { aGc.group.visible = aGf.group.visible = aDf.group.visible = false; }
    },
    dispose() { aGc.dispose(); aGf.dispose(); aDf.dispose(); tubeCard.dispose(); moonCard.dispose(); },
  };
  return rt;
}
