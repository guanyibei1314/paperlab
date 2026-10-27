// 第 7 课 互相推：冰面上的两个人（牛顿第三定律）
import * as THREE from 'three';
import { box, cyl, litMat, edgeLines, Card, canvasTex, ghostOf, polyLine } from '../core/ink.js';
import { FORCES, INK, FONT, clamp, fmt } from '../core/const.js';
import { mannequin, forceArrow, v3 } from './common.js';

const FMAX = 120, TP = 0.4;          // 推力模型
const SPM = 4.6;                      // 场景厘米 / 米
const EDGE = 8.2;

function iceTex() {
  return canvasTex(1024, 512, (c, W, H) => {
    const gr = c.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W / 2);
    gr.addColorStop(0, '#f4f8fa'); gr.addColorStop(1, '#e3ecf1');
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(110,140,165,0.28)'; c.lineWidth = 1.2;
    for (let i = 0; i < 120; i++) { const x = Math.random() * W, y = Math.random() * H, a = Math.random() * 6.28, l = 30 + Math.random() * 160; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 20, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  });
}

export function build(ctx) {
  const { st } = ctx;
  const root = new THREE.Group();
  const app = new THREE.Group(); root.add(app);
  const Z = -3.4;
  // 冰场
  const shape = new THREE.Shape(); shape.absellipse(0, 0, 9.4, 4.6, 0, Math.PI * 2);
  const iceGeo = new THREE.ShapeGeometry(shape, 64); iceGeo.rotateX(-Math.PI / 2);
  const uv = iceGeo.attributes.uv; const pp = iceGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pp.getX(i) + 9.4) / 18.8, (pp.getZ(i) + 4.6) / 9.2);
  const ice = new THREE.Mesh(iceGeo, litMat({ map: iceTex() })); ice.position.set(0, 0.03, Z); ice.receiveShadow = true; app.add(ice);
  const rimPts = []; for (let i = 0; i < 96; i++) { const t = i / 96 * Math.PI * 2; rimPts.push(v3(Math.cos(t) * 9.4, 0.05, Z + Math.sin(t) * 4.6)); }
  app.add(polyLine(rimPts, { closed: true, width: 1.6 }));
  // 中线
  app.add(polyLine([v3(0, 0.05, Z - 4.4), v3(0, 0.05, Z + 4.4)], { width: 1.1, dashed: true, color: '#7b8aa0' }));

  // 两个人
  function person(m) {
    const h = 1.70 * Math.cbrt(m / 60);
    const p = mannequin({ scale: (h * SPM) / 16.2, color: '#efebe2' });
    // 冰刀
    const L = p.userData.limbs;
    for (const leg of [L.legL, L.legR]) { const blade = box(0.15, 0.35, 2.0, { ink: { color: '#c9c6c0' }, base: false }); blade.position.set(0, -0.6, 0.4); leg.ft.add(blade); }
    p.userData.h = h; p.userData.m = m;
    return p;
  }
  let pL, pR;
  const people = new THREE.Group(); app.add(people);
  function buildPeople() {
    if (pL) { people.remove(pL); people.remove(pR); }
    pL = person(st.ctrl.mL); pR = person(st.ctrl.mR);
    pL.rotation.y = Math.PI / 2; pR.rotation.y = -Math.PI / 2;
    people.add(pL, pR);
  }
  buildPeople();
  // 读数牌
  const cL = new Card({ w: 4.6, h: 2.6, tilt: -18 }); cL.group.position.set(-6.4, 0, 3.6); cL.group.rotation.y = 0.2; root.add(cL.group);
  const cR = new Card({ w: 4.6, h: 2.6, tilt: -18 }); cR.group.position.set(6.4, 0, 3.6); cR.group.rotation.y = -0.2; root.add(cR.group);
  const cG = new Card({ w: 7.0, h: 4.6, tilt: -10, px: 120 }); cG.group.position.set(0, 0, -10.2); root.add(cG.group);
  // 箭头
  const aOnR = forceArrow('F', { scale: 0.028, width: 0.13, labelSide: 1 });
  const aOnL = forceArrow('F', { scale: 0.028, width: 0.13, labelSide: 1 });
  root.add(aOnR.group, aOnL.group);

  // 状态（米、米/秒）
  let xL, xR, vL, vR, t, pushing, done, ghostT, hist, lastF = 0, vLend = 0, vRend = 0;
  const ghosts = [];
  function clearGhosts() { ghosts.forEach(g => app.remove(g)); ghosts.length = 0; }
  // 量出手臂弯着 / 伸直时，手到身体的水平距离（场景厘米）
  function measureReach(p) {
    const out = [];
    const save = p.position.clone();
    for (const e of [0, 1]) {
      poseOne(p, e); p.position.set(0, 0, 0); p.updateWorldMatrix(true, true);
      const hp = new THREE.Vector3(); p.userData.limbs.armR.hand.getWorldPosition(hp);
      const bp = new THREE.Vector3(); p.getWorldPosition(bp);
      const fwd = v3(Math.sin(p.rotation.y), 0, Math.cos(p.rotation.y));
      // 去掉父级缩放（立起动画）对水平距离没有影响
      out.push(hp.sub(bp).dot(fwd) + 0.35 * p.scale.x);
    }
    p.position.copy(save);
    return out;
  }
  let rL = [3, 4], rR = [3, 4];
  function reachAt(r, e) { return r[0] + (r[1] - r[0]) * e; }
  function extFor() { const d = (xR - xL) * SPM; return clamp((d - rL[0] - rR[0]) / ((rL[1] + rR[1]) - (rL[0] + rR[0])), 0, 1); }
  function reset() {
    clearGhosts();
    rL = measureReach(pL); rR = measureReach(pR);
    xL = -rL[0] / SPM; xR = rR[0] / SPM;
    vL = 0; vR = 0; t = 0; pushing = false; done = false; ghostT = 0; hist = []; lastF = 0; vLend = 0; vRend = 0;
    pose(0); drawCards();
  }
  function pose(ext) { for (const p of [pL, pR]) poseOne(p, ext); }
  function poseOne(p, ext) {
    // ext: 0 弯臂 → 1 伸直
    {
      const L = p.userData.limbs;
      const lean = 0.18 * (1 - ext * 0.6);
      p.userData.spine.rotation.x = lean;
      for (const a of [L.armL, L.armR]) { a.sh.rotation.x = -1.35 + (1 - ext) * 0.25; a.el.rotation.x = -(1 - ext) * 1.1; }
      L.armL.sh.rotation.z = -0.12; L.armR.sh.rotation.z = 0.12;
      L.legL.hp.rotation.x = -0.25; L.legR.hp.rotation.x = 0.3; L.legL.kn.rotation.x = 0.25; L.legR.kn.rotation.x = 0.15;
    }
  }
  function push() { reset(); pushing = true; t = 0; ctx.sfx.thud(0.4); }
  function drawCards() {
    const mL = st.ctrl.mL, mR = st.ctrl.mR;
    cL.draw({ title: `左边的人 ${mL} kg`, lines: [`受到的推力 ${fmt(lastF, 0)} N ←`, { t: `滑开速度 ${fmt(Math.abs(done ? vLend : vL), 2)} m/s`, hand: true, s: 1.2, c: '#26407a' }], lineSize: 0.15 });
    cR.draw({ title: `右边的人 ${mR} kg`, lines: [`受到的推力 ${fmt(lastF, 0)} N →`, { t: `滑开速度 ${fmt(Math.abs(done ? vRend : vR), 2)} m/s`, hand: true, s: 1.2, c: '#26407a' }], lineSize: 0.15 });
    cG.draw({ title: '推力随时间变化', _v: hist.length, custom: (c, W, H) => {
      const x0 = 80, y0 = H - 70, x1 = W - 40, y1 = 130;
      c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(x0, y1 - 10); c.lineTo(x0, y0); c.lineTo(x1, y0); c.stroke();
      c.font = `500 26px ${FONT.math}`; c.fillStyle = INK; c.textAlign = 'right';
      c.fillText('120', x0 - 8, y1 + 8); c.fillText('0', x0 - 8, y0 + 8);
      c.textAlign = 'left'; c.fillText('t / s', x1 - 60, y0 - 12); c.fillText('F / N', x0 + 10, y1 - 16);
      c.textAlign = 'center'; c.fillText('0.4', x0 + (x1 - x0) * 0.8, y0 + 34);
      const px = (tt) => x0 + (tt / 0.5) * (x1 - x0), py = (f) => y0 - (f / FMAX) * (y0 - y1);
      if (hist.length > 1) {
        c.lineWidth = 7; c.strokeStyle = FORCES.F.color; c.beginPath(); hist.forEach((hh, i) => (i ? c.lineTo(px(hh[0]), py(hh[1])) : c.moveTo(px(hh[0]), py(hh[1])))); c.stroke();
        c.lineWidth = 3; c.setLineDash([12, 10]); c.strokeStyle = '#2f4470'; c.beginPath(); hist.forEach((hh, i) => (i ? c.lineTo(px(hh[0]), py(hh[2])) : c.moveTo(px(hh[0]), py(hh[2])))); c.stroke(); c.setLineDash([]);
      }
      c.font = `400 22px ${FONT.serif}`; c.textAlign = 'left';
      c.fillStyle = FORCES.F.color; c.fillText('—— 右边的人受到的力', W - 290, 56);
      c.fillStyle = '#2f4470'; c.fillText('- - 左边的人受到的力', W - 290, 86);
    } });
  }
  reset();

  let cardT = 0;
  const rt = {
    root,
    steps: [
      { cap: '冰面上站着两个人，手掌贴着手掌。冰面几乎没有摩擦。', shot: ctx.shot(0, 3.5, -2.5, { pitch: 30, w: 24, h: 17, pw: 20, ph: 26 }), dur: 5, enter: () => reset() },
      { cap: '一推……两人朝相反的方向滑开。', shot: ctx.shot(0, 3.5, -3, { pitch: 28, w: 22, h: 12 }), dur: 5, enter: () => push() },
      { cap: '看推力的曲线：两人受到的力每一刻都一样大，两条线完全重合。', shot: ctx.shot(0, 3.2, -10, { pitch: 26, w: 11, h: 8 }), dur: 6 },
      { cap: '换成 60 kg 和 30 kg：力还是一样大，30 kg 的人滑得快一倍。', shot: ctx.shot(0, 3.5, -3, { pitch: 30, w: 24, h: 14 }), dur: 7, enter: () => { ctx.setCtrl('mL', 60); ctx.setCtrl('mR', 30); buildPeople(); reset(); push(); } },
      { cap: '轮到你：换两人的质量，再推一次。', shot: ctx.shot(0, 3.2, -2.5, { pitch: 34, w: 25, h: 19, pw: 20, ph: 27 }), interactive: true },
    ],
    pickables: [{ obj: people, cursor: 'pointer', down: () => push() }],
    onControl(id) {
      if (id === 'mL' || id === 'mR') { buildPeople(); reset(); }
      if (id === 'push') push();
      if (id === 'reset') reset();
      ctx.marginChanged();
    },
    margin() {
      const mL = st.ctrl.mL, mR = st.ctrl.mR;
      return ['F相同，冲量相同', 'm左v左 = m右v右', `v左 : v右 = ${mR} : ${mL}`];
    },
    update(dt) {
      const sub = 8, h = dt / sub;
      for (let i = 0; i < sub; i++) {
        let F = 0;
        if (pushing) {
          t += h;
          F = t < TP ? FMAX * Math.sin(Math.PI * t / TP) : 0;
          if (t >= TP) { pushing = false; done = true; vLend = vL; vRend = vR; ctx.marginChanged(); if (st.ctrl.mL === 2 * st.ctrl.mR) ctx.complete(); }
          vL -= F / st.ctrl.mL * h; vR += F / st.ctrl.mR * h;
          if (Math.floor((t - h) / 0.01) !== Math.floor(t / 0.01)) hist.push([t, F, F]);
        }
        lastF = F;
        xL += vL * h; xR += vR * h;
        // 滑到冰场边缘慢慢停下
        if (xL * SPM < -EDGE) { vL *= 0.9; if (xL * SPM < -EDGE - 0.4) { xL = -(EDGE + 0.4) / SPM; vL = 0; } }
        if (xR * SPM > EDGE) { vR *= 0.9; if (xR * SPM > EDGE + 0.4) { xR = (EDGE + 0.4) / SPM; vR = 0; } }
      }
      const ext = pushing ? extFor() : (done ? 1 : 0);
      pose(ext);
      if (done) { t += dt; const relax = clamp((t - TP) / 1.2, 0, 1); for (const p of [pL, pR]) { const L = p.userData.limbs; for (const a of [L.armL, L.armR]) { a.sh.rotation.x = -1.35 * (1 - relax) - 0.1 * relax; a.el.rotation.x = -0.2 * relax; } } }
      pL.position.set(xL * SPM, 0.05, Z); pR.position.set(xR * SPM, 0.05, Z);
      // 残影
      if (done && (Math.abs(vL) > 0.01 || Math.abs(vR) > 0.01)) { ghostT += dt; if (ghostT > 0.35 && ghosts.length < 24) { ghostT = 0; for (const p of [pL, pR]) { const g = ghostOf(p, 0.3); g.position.copy(p.position); g.rotation.copy(p.rotation); g.scale.copy(p.scale); app.add(g); ghosts.push(g); } } }
      cardT += dt; if (cardT > 0.08) { cardT = 0; drawCards(); }
      const risen = ctx.risen() > 0.98;
      if (risen && pushing && lastF > 1) {
        const hy = Math.min(pL.userData.h, pR.userData.h) * SPM * 0.72;
        const cx = xL * SPM + reachAt(rL, ext);
        aOnR.set(v3(cx + 0.1, hy + 0.5, Z), v3(lastF, 0, 0), `${fmt(lastF, 0)} N`);
        aOnL.set(v3(cx - 0.1, hy - 0.2, Z), v3(-lastF, 0, 0), `${fmt(lastF, 0)} N`);
      } else { aOnR.group.visible = aOnL.group.visible = false; }
    },
    dispose() { aOnR.dispose(); aOnL.dispose(); cL.dispose(); cR.dispose(); cG.dispose(); },
  };
  return rt;
}
