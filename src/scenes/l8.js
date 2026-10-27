// 第 8 课 水火箭：推力 F = 2AΔp，绝热膨胀，空气阻力
import * as THREE from 'three';
import { box, cyl, extrude, inkMat, litMat, edgeLines, glassMat, Card, canvasTex, paperFill, polyLine } from '../core/ink.js';
import { FORCES, INK, FONT, clamp, fmt } from '../core/const.js';
import { forceArrow, rulerTex, v3, label3d } from './common.js';

const RHO = 1000, RHO_A = 1.2, G = 9.8, PATM = 101325, GAMMA = 1.4;
const VB = 0.002, D_N = 0.021, A_N = Math.PI * (D_N / 2) ** 2, MD = 0.15, CD = 0.4, S_B = Math.PI * 0.05 ** 2;
const HSCALE = 0.5;   // 高度：场景厘米 / 米

// 与页面里实时模拟完全相同的模型，用来算最佳水量
export function simulate(Vw_L, pg_MPa, dt = 2e-4) {
  let Va = VB - Vw_L / 1000; const Va0 = Va, p0 = PATM + pg_MPa * 1e6;
  let mw = Vw_L, v = 0, h = 0, t = 0, Fmax = 0;
  for (let i = 0; i < 200000; i++) {
    const p = p0 * Math.pow(Va0 / Va, GAMMA), dp = p - PATM;
    let T = 0;
    if (mw > 0 && dp > 0) { const ve = Math.sqrt(2 * dp / RHO); const dm = Math.min(mw, RHO * A_N * ve * dt); mw -= dm; Va += dm / RHO; T = 2 * A_N * dp; }
    Fmax = Math.max(Fmax, T);
    const m = MD + mw, Fd = 0.5 * RHO_A * CD * S_B * v * Math.abs(v);
    let a = (T - Fd) / m - G; if (h <= 0 && a < 0) a = 0;
    v += a * dt; h += v * dt; t += dt;
    if (v < 0 && T === 0) return { h, Fmax, t };
  }
  return { h, Fmax, t };
}
export function bestWater(p) {
  let best = 0.1, bh = 0;
  for (let w = 1; w <= 18; w++) { const r = simulate(w / 10, p); if (r.h > bh) { bh = r.h; best = w / 10; } }
  return best;
}

export function build(ctx) {
  const { st } = ctx;
  const root = new THREE.Group();
  const app = new THREE.Group(); root.add(app);
  const PX = -3.2, PZ = -3.2;
  // 发射架
  const base = box(6.5, 0.45, 5, { ink: { color: '#dcd6ca' } }); base.position.set(PX, 0, PZ); app.add(base);
  const ltube = cyl(0.22, 0.22, 2.4, { ink: { color: '#d3cdc1' }, seg: 12 }); ltube.position.set(PX, 0.45, PZ); app.add(ltube);
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + 0.3; const leg = box(0.25, 1.6, 0.25, { ink: { color: '#cfc8ba' } }); leg.position.set(PX + Math.cos(a) * 1.3, 0.45, PZ + Math.sin(a) * 1.3); leg.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); app.add(leg); }
  // 压力表
  const gaugeTex = canvasTex(256, 256);
  function drawGauge(pMPa) {
    const c = gaugeTex.userData.ctx;
    paperFill(c, 256, 256, '#f4f1e8', 0.02);
    c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.arc(128, 128, 118, 0, 6.28); c.stroke();
    c.lineWidth = 3; c.font = `500 30px ${FONT.math}`; c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) { const a = Math.PI * 0.75 + (i / 5) * Math.PI * 1.5; c.beginPath(); c.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); c.lineTo(128 + Math.cos(a) * 84, 128 + Math.sin(a) * 84); c.stroke(); c.fillText((i * 0.1).toFixed(1), 128 + Math.cos(a) * 64, 128 + Math.sin(a) * 64); }
    c.font = `500 24px ${FONT.math}`; c.fillText('MPa', 128, 190);
    const a = Math.PI * 0.75 + clamp(pMPa / 0.5, 0, 1) * Math.PI * 1.5;
    c.strokeStyle = '#b8372a'; c.lineWidth = 6; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92); c.stroke();
    gaugeTex.needsUpdate = true;
  }
  const gauge = new THREE.Group();
  const gbody = cyl(1.0, 1.0, 0.4, { ink: { color: '#d8d2c6' }, seg: 32, base: false }); gbody.rotation.x = Math.PI / 2; gauge.add(gbody);
  const gface = new THREE.Mesh(new THREE.CircleGeometry(0.92, 32), litMat({ map: gaugeTex })); gface.position.z = 0.21; gauge.add(gface);
  const gstem = cyl(0.12, 0.12, 1.6, { ink: { color: '#cdc7bb' }, seg: 8 }); gstem.position.y = -2.4; gauge.add(gstem);
  gauge.position.set(PX + 2.6, 2.4, PZ + 1.3); gauge.rotation.y = -0.2; app.add(gauge);
  // 打气筒
  const pump = new THREE.Group(); pump.position.set(PX + 5.4, 0, PZ + 1.6); app.add(pump);
  const pfoot = box(2.2, 0.25, 0.8, { ink: { color: '#d3ccbf' } }); pump.add(pfoot);
  const pbarrel = cyl(0.45, 0.45, 4.6, { ink: { color: '#e4dfd5', uv: [8, 8] }, seg: 20 }); pbarrel.position.y = 0.25; pump.add(pbarrel);
  const prodG = new THREE.Group(); pump.add(prodG);
  const prod = cyl(0.08, 0.08, 2.4, { ink: { color: '#c9c3b7' }, seg: 6, edges: false }); prodG.add(prod);
  const phand = cyl(0.18, 0.18, 2.4, { ink: { color: '#d5cdbd' }, seg: 10, base: false }); phand.rotation.z = Math.PI / 2; phand.position.y = 2.4; prodG.add(phand);
  prodG.position.y = 4.4;
  const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([v3(PX + 5.4, 0.5, PZ + 1.6), v3(PX + 4.2, 0.2, PZ + 2.6), v3(PX + 2.0, 0.25, PZ + 2.4), v3(PX + 0.9, 0.4, PZ + 0.9)]), 40, 0.1, 6, false), inkMat({ color: '#cfc8bb' }));
  app.add(hose);

  // 火箭（倒置的瓶子）
  const rocket = new THREE.Group(); app.add(rocket);
  const BODY_R = 1.0, BODY_L = 2.6, NECK_L = 0.9;
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(BODY_R, BODY_R, BODY_L, 40, 1, true), glassMat('#eef4f6', 0.12)); bottle.position.y = NECK_L + BODY_L / 2; bottle.renderOrder = 3; rocket.add(bottle);
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(BODY_R, 0.32, NECK_L, 40, 1, true), glassMat('#eef4f6', 0.12)); shoulder.position.y = NECK_L / 2; shoulder.renderOrder = 3; rocket.add(shoulder);
  const circ = (r, y) => { const a = []; for (let i = 0; i < 40; i++) { const t = i / 40 * Math.PI * 2; a.push(v3(Math.cos(t) * r, y, Math.sin(t) * r)); } return a; };
  rocket.add(polyLine(circ(BODY_R, NECK_L), { closed: true, width: 1 }), polyLine(circ(BODY_R, NECK_L + BODY_L), { closed: true, width: 1 }), polyLine(circ(0.32, 0), { closed: true, width: 1.2 }));
  const nose = cyl(0.0, BODY_R, 1.5, { ink: { color: '#ece6da', uv: [10, 3] }, seg: 32 }); nose.position.y = NECK_L + BODY_L; rocket.add(nose);
  for (let i = 0; i < 3; i++) {
    const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(1.0, -0.4); fs.lineTo(1.0, 0.5); fs.lineTo(0, 1.4); fs.lineTo(0, 0);
    const fin = extrude(fs, 0.06, { ink: { color: '#e8e2d5' } });
    const fg = new THREE.Group(); fin.position.set(BODY_R * 0.55, 0.1, 0); fg.add(fin); fg.rotation.y = i * Math.PI * 2 / 3; rocket.add(fg);
  }
  const water = new THREE.Mesh(new THREE.CylinderGeometry(BODY_R * 0.96, BODY_R * 0.96, 1, 32), new THREE.MeshBasicMaterial({ color: '#4f8fe0', transparent: true, opacity: 0.45, depthWrite: false }));
  water.renderOrder = 2; rocket.add(water);
  const waterNeck = new THREE.Mesh(new THREE.CylinderGeometry(BODY_R * 0.94, 0.3, NECK_L * 0.98, 32), water.material); waterNeck.position.y = NECK_L / 2; waterNeck.renderOrder = 2; rocket.add(waterNeck);
  const PAD_Y = 0.45 + 2.0;

  // 高度标尺
  const POLE_H = 23;
  const poleTex = canvasTex(64, 1400, (c, W, H) => {
    paperFill(c, W, H, '#f3efe2', 0.02);
    c.fillStyle = INK; c.strokeStyle = INK;
    for (let m = 0; m <= 45; m++) { const y = H - (m * HSCALE / POLE_H) * H; const major = m % 10 === 0, mid = m % 5 === 0; c.lineWidth = major ? 3 : 1.5; c.beginPath(); c.moveTo(0, y); c.lineTo(major ? 40 : mid ? 28 : 16, y); c.stroke(); }
  });
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.5, POLE_H, 0.3), [litMat({ color: '#ebe6da' }), litMat({ color: '#ebe6da' }), litMat({ color: '#ebe6da' }), litMat({ color: '#ebe6da' }), litMat({ map: poleTex }), litMat({ color: '#ebe6da' })]);
  pole.geometry.translate(0, POLE_H / 2, 0); pole.add(edgeLines(pole.geometry, { overshoot: 0.01 }));
  pole.castShadow = true;
  const poleG = new THREE.Group(); poleG.add(pole); poleG.position.set(PX + 6.8, PAD_Y, PZ - 2.2); app.add(poleG);
  const poleBase = box(1.6, PAD_Y, 1.6, { ink: { color: '#dad3c5' } }); poleBase.position.set(PX + 6.8, 0, PZ - 2.2); app.add(poleBase);
  for (let m = 0; m <= 40; m += 10) { const lb = label3d(`${m} m`, { w: 2.0, h: 0.7, font: FONT.math, size: 0.9 }); lb.position.set(1.4, m * HSCALE, 0.2); poleG.add(lb); }
  const maxMark = new THREE.Group(); poleG.add(maxMark);
  const mm = box(1.6, 0.08, 0.5, { base: false, ink: { color: '#b8372a' }, edges: false }); mm.material = litMat({ color: '#b8372a' }); maxMark.add(mm);
  const maxLabel = label3d('', { w: 3.2, h: 0.8, font: FONT.num, color: '#b8372a' }); maxLabel.position.set(-2.0, 0.1, 0.2); maxMark.add(maxLabel);
  const hLab = label3d('高度按比例缩小', { w: 4.6, h: 0.7, font: FONT.hand, color: '#6b6672', size: 0.85 }); hLab.position.set(0, POLE_H + 0.6, 0.2); poleG.add(hLab);

  // 喷水粒子
  const NP = 260;
  const jGeo = new THREE.BufferGeometry(); const jPos = new Float32Array(NP * 3); jGeo.setAttribute('position', new THREE.BufferAttribute(jPos, 3));
  const jTex = canvasTex(32, 32, (c) => { const gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(120,180,255,1)'); gr.addColorStop(1, 'rgba(80,140,230,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32); });
  const jet = new THREE.Points(jGeo, new THREE.PointsMaterial({ size: 0.42, map: jTex, transparent: true, depthWrite: false, color: '#ffffff' }));
  jet.userData.noPop = true; jet.userData.keepVisible = true; jet.frustumCulled = false; root.add(jet);
  const parts = []; for (let i = 0; i < NP; i++) parts.push({ alive: false, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });

  // 牌子
  const card = new Card({ w: 6.2, h: 4.4, tilt: -14 });
  card.group.position.set(7.2, 0, 0.6); card.group.rotation.y = -0.45; root.add(card.group);
  // 箭头
  const aUp = forceArrow('F', { scale: 0.02, width: 0.16, labelSide: 1 });
  const aDn = forceArrow('F', { scale: 0.02, width: 0.16, labelSide: -1 });
  const aG = forceArrow('G', { scale: 0.6, width: 0.12, labelSide: -1 });
  const aD = forceArrow('D', { scale: 0.6, width: 0.12, labelSide: 1 });
  root.add(aUp.group, aDn.group, aG.group, aD.group);

  // 状态
  let phase = 'pad', h = 0, v = 0, Va = 0, Va0 = 0, p0 = 0, mw = 0, T = 0, ve = 0, Fd = 0, pumpT = 0, slow = 1, maxH = 0, flightT = 0, tilt = 0, landT = 0;
  const records = [];
  const optCache = {};
  function opt(p) { if (optCache[p] == null) optCache[p] = bestWater(p); return optCache[p]; }
  function waterLevel(L) {
    // 倒置瓶子：先填满瓶颈（约 0.25 L），再往上填瓶身
    const neckV = 0.25;
    if (L <= neckV) { waterNeck.scale.set(1, Math.max(0.02, L / neckV), 1); waterNeck.position.y = NECK_L * (L / neckV) / 2; water.visible = false; return; }
    waterNeck.scale.set(1, 1, 1); waterNeck.position.y = NECK_L / 2; water.visible = true;
    const hh = ((L - neckV) / (2.0 - neckV)) * BODY_L;
    water.scale.y = Math.max(0.01, hh); water.position.y = NECK_L + hh / 2;
  }
  function resetPad() {
    phase = 'pad'; h = 0; v = 0; slow = 1; flightT = 0; tilt = 0; T = 0;
    rocket.position.set(PX, PAD_Y, PZ); rocket.rotation.set(0, 0, 0);
    waterLevel(st.ctrl.water); drawGauge(0); prodG.position.y = 4.4;
    parts.forEach(p => { p.alive = false; });
  }
  function startLaunch() {
    if (phase === 'pumping' || phase === 'thrust' || phase === 'coast') return;
    resetPad(); phase = 'pumping'; pumpT = 0;
  }
  function ignite() {
    Va = VB - st.ctrl.water / 1000; Va0 = Va; p0 = PATM + st.ctrl.p * 1e6; mw = st.ctrl.water;
    phase = 'thrust'; slow = 0.1; maxH = 0; flightT = 0;
    ctx.sfx.whoosh(1.2);
  }
  function drawCard() {
    const lines = [];
    const shown = records.slice(-5);
    if (!shown.length) lines.push('还没有发射。');
    const best = records.reduce((b, r) => (r.h > (b ? b.h : -1) ? r : b), null);
    shown.forEach(r => lines.push({ t: `${r.w.toFixed(1)} L · ${r.p} MPa → ${r.h.toFixed(1)} m`, hand: true, s: 1.05, c: r === best ? '#b8372a' : '#26407a', w: r === best ? 700 : 500 }));
    card.draw({ title: '发射记录（最高点）', lines, note: phase === 'thrust' ? `推力 ${fmt(T, 0)} N` : `本次推力最大 ${fmt(2 * A_N * st.ctrl.p * 1e6, 0)} N`, lineSize: 0.11 });
  }
  resetPad(); drawCard();

  const rt = {
    root,
    steps: [
      { cap: '一个 2 L 饮料瓶做的水火箭，立在发射架上；旁边是打气筒和高度标尺。', shot: ctx.shot(1.5, 7, -2.5, { pitch: 30, w: 22, h: 21, pw: 20, ph: 27 }), dur: 5 },
      { cap: '装 1.2 L 水，打气到 0.3 MPa，发射！慢镜头里：瓶子把水向下推，水把瓶子向上推，两个力一样大。', shot: ctx.shot(1, 11, -3, { pitch: 22, w: 20, h: 25, pw: 20, ph: 30 }), dur: 10, enter: () => { ctx.setCtrl('water', 1.2); ctx.setCtrl('p', 0.3); resetPad(); startLaunch(); } },
      { cap: '水越多越好吗？只装 0.6 L 再试一次：飞得更高了。', shot: ctx.shot(1, 11, -3, { pitch: 22, w: 20, h: 25, pw: 20, ph: 30 }), dur: 10, enter: () => { ctx.setCtrl('water', 0.6); resetPad(); startLaunch(); } },
      { cap: '轮到你：改变水量和气压，找出飞得最高的水量。', shot: ctx.shot(2, 9.5, -2.5, { pitch: 26, w: 24, h: 26, pw: 20, ph: 35 }), interactive: true, enter: () => { if (phase === 'landed') resetPad(); } },
    ],
    pickables: [{ obj: rocket, cursor: 'pointer', down: () => startLaunch() }, { obj: pump, cursor: 'pointer', down: () => startLaunch() }],
    onControl(id) {
      if (id === 'water' || id === 'p') { if (phase === 'pad' || phase === 'landed') resetPad(); drawCard(); }
      if (id === 'launch') startLaunch();
      if (id === 'clear') { records.length = 0; maxMark.visible = false; drawCard(); }
      ctx.marginChanged();
    },
    margin() {
      const dp = st.ctrl.p * 1e6;
      return [`A = π(0.0105)² m²`, `F = 2AΔp`, `= 2 × 3.46×10⁻⁴ × ${dp.toExponential(0).replace('e+5', '×10⁵')}`, `≈ ${fmt(2 * A_N * dp, 0)} N`];
    },
    update(dt) {
      if (phase === 'pumping') {
        pumpT += dt;
        prodG.position.y = 4.4 - Math.abs(Math.sin(pumpT * 7)) * 2.0;
        drawGauge(st.ctrl.p * clamp(pumpT / 1.4, 0, 1));
        if (Math.floor(pumpT * 7 / Math.PI) !== Math.floor((pumpT - dt) * 7 / Math.PI)) ctx.sfx.noiseBurst({ dur: 0.15, f0: 1200, f1: 600, gain: 0.08 });
        if (pumpT > 1.5) ignite();
      }
      if (phase === 'thrust' || phase === 'coast' || phase === 'fall') {
        const sdt = dt * slow;
        const sub = phase === 'thrust' ? 60 : 10, hh = sdt / sub;
        for (let i = 0; i < sub; i++) {
          T = 0; ve = 0;
          if (phase === 'thrust') {
            const p = p0 * Math.pow(Va0 / Va, GAMMA), dp = p - PATM;
            if (mw > 0 && dp > 0) { ve = Math.sqrt(2 * dp / RHO); const dm = Math.min(mw, RHO * A_N * ve * hh); mw -= dm; Va += dm / RHO; T = 2 * A_N * dp; }
            else { phase = 'coast'; }
          }
          const m = MD + Math.max(0, mw);
          Fd = 0.5 * RHO_A * CD * S_B * v * Math.abs(v);
          let a = (T - Fd) / m - G; if (h <= 0 && a < 0) a = 0;
          v += a * hh; h += v * hh; flightT += hh;
          if (h > maxH) maxH = h;
          if (phase === 'coast' && v < 0) phase = 'fall';
          if (phase === 'fall' && h <= 0) { h = 0; v = 0; phase = 'landed'; landT = 0; break; }
        }
        if (phase !== 'thrust') slow = Math.min(1, slow + dt * 1.2);
        if (phase === 'landed') {
          ctx.sfx.thud(0.6);
          records.push({ w: st.ctrl.water, p: st.ctrl.p, h: maxH });
          drawCard(); ctx.marginChanged();
          // 挑战：找到最佳水量（同一气压下至少试过 3 种水量）
          const tried = new Set(records.filter(r => r.p === st.ctrl.p).map(r => r.w.toFixed(1)));
          if (Math.abs(st.ctrl.water - opt(st.ctrl.p)) <= 0.1 + 1e-6 && tried.size >= 3) ctx.complete();
        }
        // 水位跟着减少
        waterLevel(Math.max(0, mw));
        rocket.position.set(PX, PAD_Y + h * HSCALE, PZ);
        if (phase === 'fall') { tilt = Math.min(Math.PI, tilt + dt * 1.2); rocket.rotation.z = tilt; }
        drawGauge(phase === 'thrust' ? Math.max(0, (p0 * Math.pow(Va0 / Va, GAMMA) - PATM) / 1e6) : 0);
        maxMark.visible = true; maxMark.position.y = maxH * HSCALE;
        const t2 = `${maxH.toFixed(1)} m`;
        if (maxLabel.userData.txt !== t2) { maxLabel.userData.txt = t2; const c = maxLabel.userData.tex.userData.ctx; c.clearRect(0, 0, c.canvas.width, c.canvas.height); c.fillStyle = '#b8372a'; c.font = `600 ${c.canvas.height * 0.62}px ${FONT.num}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t2, c.canvas.width / 2, c.canvas.height / 2); maxLabel.userData.tex.needsUpdate = true; }
        if (phase === 'thrust') drawCard();
      }
      if (phase === 'landed') { landT += dt; rocket.position.y = PAD_Y * 0 + 1.0; rocket.rotation.z = Math.PI / 2; rocket.position.x = PX + 3.0; }
      // 喷水粒子
      const sdt2 = dt * slow;
      const nozzle = v3(rocket.position.x, rocket.position.y - 0.05, rocket.position.z);
      if (phase === 'thrust' && ve > 0) {
        let n = 10;
        for (const p of parts) { if (n <= 0) break; if (!p.alive) { n--; p.alive = true; p.life = 0; p.x = nozzle.x + (Math.random() - 0.5) * 0.2; p.y = nozzle.y; p.z = nozzle.z + (Math.random() - 0.5) * 0.2; const sp = ve * 0.35; p.vx = (Math.random() - 0.5) * sp * 0.25; p.vz = (Math.random() - 0.5) * sp * 0.25; p.vy = -sp; } }
      }
      parts.forEach((p, i) => {
        if (p.alive) { p.life += sdt2; p.vy -= 98 * sdt2 * 0.3; p.x += p.vx * sdt2; p.y += p.vy * sdt2; p.z += p.vz * sdt2; if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.15; p.vx *= 1.6; p.vz *= 1.6; } if (p.life > 1.2) p.alive = false; }
        jPos[i * 3] = p.alive ? p.x : 0; jPos[i * 3 + 1] = p.alive ? p.y : -99; jPos[i * 3 + 2] = p.alive ? p.z : 0;
      });
      jGeo.attributes.position.needsUpdate = true;
      // 箭头
      const risen = ctx.risen() > 0.98;
      if (risen && phase === 'thrust' && T > 1) {
        aUp.set(v3(rocket.position.x + 1.5, rocket.position.y + 0.3, rocket.position.z), v3(0, T, 0), `水推瓶 ${fmt(T, 0)} N`);
        aDn.set(v3(rocket.position.x - 1.5, rocket.position.y + 0.3, rocket.position.z), v3(0, -T, 0), `瓶推水 ${fmt(T, 0)} N`);
      } else { aUp.group.visible = aDn.group.visible = false; }
      if (risen && (phase === 'coast' || phase === 'fall')) {
        const m = MD + Math.max(0, mw);
        aG.set(v3(rocket.position.x + 1.4, rocket.position.y + 1.5, rocket.position.z), v3(0, -m * G, 0), `G ${fmt(m * G, 1)} N`);
        if (Fd > 0.05) aD.set(v3(rocket.position.x - 1.4, rocket.position.y + 1.5, rocket.position.z), v3(0, -Math.sign(v) * Fd, 0), `阻力 ${fmt(Fd, 1)} N`); else aD.group.visible = false;
      } else { aG.group.visible = aD.group.visible = false; }
    },
    dispose() { aUp.dispose(); aDn.dispose(); aG.dispose(); aD.dispose(); card.dispose(); },
  };
  return rt;
}
