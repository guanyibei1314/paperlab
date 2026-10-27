// 第 3 课 惯性：硬币、卡片和杯子（真实摩擦耦合）
import * as THREE from 'three';
import { box, cyl, inkMat, litMat, edgeLines, glassMat, Card, canvasTex, paperFill, polyLine } from '../core/ink.js';
import { FORCES, INK, FONT, clamp, fmt } from '../core/const.js';
import { forceArrow, v3, label3d } from './common.js';
import { ForceArrow } from '../core/ink.js';

const g = 980;           // cm/s²
const MU = 0.3;          // 硬币—卡片
const MU_PAGE = 3.0;     // 卡片落在书页上后翻滚、很快停下（示意）
const RC = 2.225 / 2;    // 硬币半径 cm
const TC = 0.19;         // 硬币厚度（示意）
const CUP_R = 3.7, CUP_IN = 3.45, CUP_H = 10, CUP_BOT = 0.6;
const CARD_L = 9, CARD_W = 5.4, CARD_T = 0.06;

function circle(r, y, n = 64) { const a = []; for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; a.push(v3(Math.cos(t) * r, y, Math.sin(t) * r)); } return a; }

export function build(ctx) {
  const { st } = ctx;
  const root = new THREE.Group();
  const app = new THREE.Group(); root.add(app);
  const cx = -2.2, Z = -3.2;
  // 杯子
  const cup = new THREE.Group(); cup.position.set(cx, 0, Z); app.add(cup);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(CUP_R, CUP_R * 0.92, CUP_H, 64, 1, true), glassMat('#eef4f7', 0.1));
  wall.position.y = CUP_H / 2; wall.renderOrder = 3; cup.add(wall);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(CUP_IN, CUP_IN * 0.92, CUP_H - CUP_BOT, 64, 1, true), glassMat('#eef4f7', 0.05));
  inner.position.y = CUP_BOT + (CUP_H - CUP_BOT) / 2; inner.renderOrder = 3; cup.add(inner);
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(CUP_R * 0.92, CUP_R * 0.92, CUP_BOT, 48), glassMat('#e6eef2', 0.25));
  bottom.position.y = CUP_BOT / 2; bottom.renderOrder = 3; cup.add(bottom);
  for (const [r, y] of [[CUP_R, CUP_H], [CUP_IN, CUP_H], [CUP_R * 0.92, 0.01], [CUP_IN * 0.92, CUP_BOT]]) cup.add(polyLine(circle(r, y), { width: 1.3, closed: true }));
  // 杯影（玻璃不投影，画一圈淡影）
  const shadowTex = canvasTex(128, 128, (c) => { const gr = c.createRadialGradient(64, 64, 30, 64, 64, 64); gr.addColorStop(0, 'rgba(60,60,70,0.25)'); gr.addColorStop(1, 'rgba(60,60,70,0)'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(cx + 1.2, 0.02, Z - 0.6); app.add(shadow);

  // 卡片
  const cardTex = canvasTex(900, 540, (c, W, H) => {
    paperFill(c, W, H, '#f3efe4', 0.02);
    c.strokeStyle = '#b8372a'; c.lineWidth = 8; c.strokeRect(20, 20, W - 40, H - 40);
    c.fillStyle = '#b8372a'; c.font = `900 120px ${FONT.serif}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('惯 性', W / 2, H / 2 - 30);
    c.fillStyle = INK; c.font = `400 44px ${FONT.serif}`; c.fillText('纸上实验室 · 卡片', W / 2, H / 2 + 90);
  });
  const cardMat = litMat({ color: '#efebe1' });
  const card = new THREE.Mesh(new THREE.BoxGeometry(CARD_L, CARD_T, CARD_W), [cardMat, cardMat, litMat({ map: cardTex }), cardMat, cardMat, cardMat]);
  card.castShadow = true; card.receiveShadow = true;
  card.add(edgeLines(card.geometry, { overshoot: 0.02, width: 1.1 }));
  app.add(card);

  // 硬币
  const coin = cyl(RC, RC, TC, { ink: { color: '#dedbd2', uv: [24, 1] }, seg: 48, base: false, hullWidth: 1.2 });
  const face = new THREE.Mesh(new THREE.CircleGeometry(RC * 0.98, 48), litMat({ map: canvasTex(256, 256, (c, W, H) => { c.fillStyle = '#e4e1d8'; c.fillRect(0, 0, W, H); c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.arc(128, 128, 112, 0, 6.28); c.stroke(); c.fillStyle = INK; c.font = `900 120px ${FONT.math}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('1', 128, 118); c.font = `400 40px ${FONT.serif}`; c.fillText('元', 128, 196); }) }));
  face.rotation.x = -Math.PI / 2; face.position.y = TC / 2 + 0.005; coin.add(face);
  app.add(coin);

  // 读数牌
  const info = new Card({ w: 7.0, h: 4.6, tilt: -14 });
  info.group.position.set(5.6, 0, -2.6); info.group.rotation.y = -0.3;
  root.add(info.group);
  const slowLabel = label3d('慢镜头 ×1/12', { w: 5, h: 1.2, font: FONT.hand, color: '#b8372a' });
  slowLabel.userData.noPop = true; slowLabel.userData.keepVisible = true; slowLabel.visible = false; root.add(slowLabel);
  const hint = label3d('← 按住卡片向右拖', { w: 6.5, h: 1.1, font: FONT.hand, color: '#26407a' });
  hint.userData.noPop = true; hint.userData.keepVisible = true; hint.visible = false; root.add(hint);

  const aF = forceArrow('f', { scale: 1, width: 0.12, labelSide: 1 });
  const aV = new ForceArrow('#77737f', { scale: 1, width: 0.12, labelSide: 1, glow: false }); aV.group.userData.noPop = true;
  root.add(aF.group, aV.group);

  // 状态
  let cardMode, cardX, cardY, cardV, cardVY, cardRot, cardTarget, coinMode, coinX, coinY, coinVX, coinVY, coinRot;
  let coinInside = false;
  let flickT = 0, measured = null, slow = 1, slowClock = 0, dragUsed = false, cardHistory = [];
  const TOP = CUP_H + CARD_T / 2;
  function reset() {
    cardMode = 'rest'; cardX = cx; cardY = TOP; cardV = 0; cardVY = 0; cardRot = 0;
    coinMode = 'onCard'; coinX = cx; coinY = TOP + CARD_T / 2 + TC / 2; coinVX = 0; coinVY = 0; coinRot = 0;
    flickT = 0; slow = 1; dragUsed = false; cardHistory = []; coinInside = false;
    place();
  }
  function place() {
    card.position.set(cardX, cardY, Z); card.rotation.z = cardRot;
    coin.position.set(coinX, coinY, Z); coin.rotation.z = coinRot;
  }
  function flick(v0, slowmo) {
    reset();
    cardMode = 'flick'; cardV = v0 * 100; flickT = 0; measured = null;
    if (slowmo) { slow = 1 / 12; slowClock = 0; }
    ctx.sfx.noiseBurst({ dur: 0.12, f0: 2000, f1: 600, q: 1, gain: 0.25 });
  }
  function drawInfo() {
    const lines = [];
    if (measured) {
      lines.push(`卡片速度 ${fmt(measured.v / 100, 2)} m/s`);
      lines.push(`卡片离开硬币用时 ${fmt(measured.t, 3)} s`);
      lines.push({ t: `硬币只获得 ${fmt(measured.dv / 100, 2)} m/s`, hand: true, s: 1.15, c: '#26407a' });
    } else lines.push('弹出卡片后，这里显示测量结果。');
    const where = coinMode === 'inCup' ? '硬币落进了杯子' : coinMode === 'onTable' ? '硬币跟着卡片离开了杯口' : '';
    info.draw({ title: '一瞬间', lines, note: where, lineSize: 0.115 });
  }
  reset(); drawInfo();

  function stepPhysics(h) {
    // 卡片
    if (cardMode === 'flick' || cardMode === 'drag') {
      if (cardMode === 'flick') cardX += cardV * h;
      if (Math.abs(cardX - cx) > CUP_R) { cardMode = 'fall'; cardVY = 0; }
    } else if (cardMode === 'fall') {
      cardV -= Math.sign(cardV) * 0.06 * cardV * cardV * h; // 薄卡片空气阻力很大
      cardVY -= g * h; cardX += cardV * h; cardY += cardVY * h; cardRot -= Math.sign(cardV || 1) * 2.2 * h;
      cardRot = Math.max(cardRot, -0.5);
      if (cardY <= CARD_T / 2 + 0.01) { cardY = CARD_T / 2 + 0.01; cardRot = 0; cardMode = 'slide'; cardVY = 0; ctx.sfx.noiseBurst({ dur: 0.1, f0: 900, f1: 500, gain: 0.12 }); }
    } else if (cardMode === 'slide') {
      const dv = MU_PAGE * g * h;
      if (Math.abs(cardV) <= dv) { cardV = 0; cardMode = 'landed'; } else cardV -= Math.sign(cardV) * dv;
      cardX += cardV * h;
    }
    // 硬币
    if (coinMode === 'onCard') {
      if (cardMode === 'fall' || cardMode === 'slide' || cardMode === 'landed') {
        coinMode = 'air'; coinVY = cardMode === 'fall' ? cardVY : 0;
        if (!measured && Math.abs(cardV - coinVX) > 5) { measured = { t: flickT, v: Math.abs(cardV), dv: Math.abs(coinVX) }; drawInfo(); ctx.marginChanged(); }
      } else {
        const dv = clamp(cardV - coinVX, -MU * g * h, MU * g * h);
        coinVX += dv; coinX += coinVX * h;
        coinY = cardY + CARD_T / 2 + TC / 2;
        if (Math.abs(coinX - cardX) > CARD_L / 2) {
          coinMode = 'air'; coinVY = 0;
          if (!measured) { measured = { t: flickT, v: Math.abs(cardV), dv: Math.abs(coinVX) }; drawInfo(); ctx.marginChanged(); }
        }
      }
    } else if (coinMode === 'air') {
      const yPrev = coinY;
      coinVY -= g * h; coinX += coinVX * h; coinY += coinVY * h;
      coinRot += coinVX * 0.002 * h * 60;
      const dx = coinX - cx;
      if (!coinInside && yPrev >= CUP_H + TC / 2 && coinY < CUP_H + TC / 2) {
        if (Math.abs(dx) < CUP_IN - RC * 0.5) coinInside = true;
        else if (Math.abs(dx) < CUP_R + RC) {
          // 碰到杯沿，被弹到外面
          coinX = cx + Math.sign(dx) * (CUP_R + RC + 0.02); coinVX = Math.sign(dx) * Math.max(Math.abs(coinVX) * 0.5, 15); ctx.sfx.clink(0.5);
        }
      }
      if (coinInside) {
        if (Math.abs(dx) > CUP_IN - RC) { coinX = cx + Math.sign(dx) * (CUP_IN - RC); coinVX *= -0.3; if (Math.abs(coinVX) > 3) ctx.sfx.clink(0.35); }
        if (coinY <= CUP_BOT + TC / 2) {
          coinY = CUP_BOT + TC / 2;
          if (Math.abs(coinVY) > 30) { coinVY *= -0.25; coinVX *= 0.6; ctx.sfx.clink(Math.min(1, Math.abs(coinVY) / 100)); }
          else { coinVY = 0; coinVX = 0; coinRot = 0; coinMode = 'inCup'; drawInfo(); }
        }
      } else if (coinY <= TC / 2) {
        coinY = TC / 2; coinVY = 0; coinVX = 0; coinRot = 0; coinMode = 'onTable'; ctx.sfx.thud(0.3); drawInfo();
        if (dragUsed) ctx.complete();
      } else if (coinY < CUP_H && Math.abs(dx) < CUP_R + RC) {
        coinX = cx + Math.sign(dx || 1) * (CUP_R + RC + 0.01);
      }
    }
  }

  let lastMargin = '';
  const rt = {
    root,
    steps: [
      { cap: '一只玻璃杯，杯口盖着一张卡片，卡片中央放着一枚 1 元硬币。', shot: ctx.shot(0.5, 6, -2.5, { pitch: 36, w: 22, h: 17, pw: 18, ph: 24 }), dur: 5, enter: () => reset() },
      { cap: '用 3 m/s 的速度把卡片弹出去。慢镜头里看：卡片飞走了，硬币几乎没动。', shot: ctx.shot(1.5, 7, -3, { pitch: 30, yaw: 0, w: 22, h: 14 }), dur: 7, enter: () => { ctx.setCtrl('speed', 3); flick(3, true); } },
      { cap: '硬币失去支撑，在重力作用下落进杯里。它还保持着原来的静止状态，这就是惯性。', shot: ctx.shot(-1.5, 5.5, -3, { pitch: 34, w: 17, h: 15 }), dur: 6 },
      { cap: '换成 0.3 m/s 慢慢弹：摩擦力有足够的时间，带着硬币一起走了。', shot: ctx.shot(2, 6, -2.5, { pitch: 34, w: 24, h: 16 }), dur: 7, enter: () => { ctx.setCtrl('speed', 0.3); flick(0.3, false); } },
      { cap: '轮到你：按住卡片拖一拖，快一点、慢一点都试试；也可以点"弹一下"。', shot: ctx.shot(1.5, 6, -2.5, { pitch: 38, w: 24, h: 18, pw: 18, ph: 24 }), interactive: true, enter: () => { if (coinMode !== 'onCard' || cardMode !== 'rest') reset(); } },
    ],
    pickables: [{
      obj: card, cursor: 'grab',
      down: (hit, ray) => {
        if (cardMode !== 'rest') return;
        const p = new THREE.Vector3();
        ray.intersectPlane(new THREE.Plane(v3(0, 1, 0), -(TOP + ctx.R0.y)), p);
        this_drag = { x0: p.x, cardX0: cardX };
        cardMode = 'drag'; cardTarget = cardX; dragUsed = true; measured = null; flickT = 0; cardHistory = [];
      },
      move: (ray) => {
        if (cardMode !== 'drag' || !this_drag) return;
        const p = new THREE.Vector3();
        if (!ray.intersectPlane(new THREE.Plane(v3(0, 1, 0), -(TOP + ctx.R0.y)), p)) return;
        cardTarget = Math.max(this_drag.cardX0 - 1.5, this_drag.cardX0 + (p.x - this_drag.x0));
      },
      up: () => {
        if (cardMode === 'drag') {
          // 松手时保留当时的速度（像把卡片甩出去）
          const hst = cardHistory.slice(-4);
          const vEst = hst.length >= 2 ? (hst[hst.length - 1].x - hst[0].x) / Math.max(1e-3, hst[hst.length - 1].t - hst[0].t) : 0;
          if (Math.abs(vEst) > 20) { cardMode = 'flick'; cardV = vEst; }
          else { cardMode = Math.abs(cardX - cx) > CUP_R ? 'fall' : 'rest'; cardV = 0; }
        }
        this_drag = null;
      },
    }],
    onControl(id, val) {
      if (id === 'flick') flick(st.ctrl.speed, st.ctrl.speed >= 1);
      if (id === 'reset') { reset(); measured = null; drawInfo(); }
    },
    margin() {
      if (!measured) return ['Δv = μg·t', 'μg = 0.3 × 9.8', '≈ 2.9 m/s²'];
      return [`t ≈ ${fmt(measured.t, 3)} s`, `Δv = μg·t`, `≈ 2.9 × ${fmt(measured.t, 3)}`, `≈ ${fmt(2.94 * measured.t, 2)} m/s`];
    },
    update(dt) {
      let sdt = dt * slow;
      if (slow < 1) { slowClock += sdt; if (slowClock > 0.12) slow = Math.min(1, slow + dt * 0.8); }
      const sub = 40, h = sdt / sub;
      let dragStep = 0;
      if (cardMode === 'drag') { dragStep = (cardTarget - cardX) / sub; cardV = (cardTarget - cardX) / Math.max(sdt, 1e-4); }
      for (let i = 0; i < sub; i++) {
        if (cardMode === 'drag') cardX += dragStep;
        if (cardMode === 'flick' || cardMode === 'drag' || cardMode === 'fall') flickT += h;
        stepPhysics(h);
      }
      if (cardMode === 'drag') cardHistory.push({ x: cardX, t: (cardHistory.length ? cardHistory[cardHistory.length - 1].t : 0) + dt });
      place();
      const risen = ctx.risen() > 0.98;
      slowLabel.visible = risen && slow < 0.99;
      if (slowLabel.visible) { slowLabel.position.set(cx, CUP_H + 4.2, Z); slowLabel.quaternion.copy(ctx.camera.quaternion); }
      hint.visible = risen && cardMode === 'rest' && coinMode === 'onCard' && ctx.stepIndex() >= 5;
      if (hint.visible) { hint.position.set(cx + 7.5, TOP + 0.6, Z + 2.8); hint.quaternion.copy(ctx.camera.quaternion); }
      // 箭头：硬币受到的摩擦力
      const rel = cardV - coinVX;
      if (risen && coinMode === 'onCard' && Math.abs(rel) > 2) aF.set(v3(coinX, coinY + 0.4, Z + 1.4), v3(Math.sign(rel) * 1.6, 0, 0), '摩擦力 f'); else aF.group.visible = false;
      if (risen && (cardMode === 'flick' || cardMode === 'drag') && Math.abs(cardV) > 2) aV.set(v3(cardX + CARD_L / 2 + 0.3, TOP, Z), v3(Math.sign(cardV) * 2.2, 0, 0), `卡片 ${fmt(Math.abs(cardV) / 100, 1)} m/s`); else aV.group.visible = false;
      const mk = measured ? measured.t.toFixed(4) : '-';
      if (mk !== lastMargin) { lastMargin = mk; ctx.marginChanged(); }
    },
    dispose() { aF.dispose(); aV.dispose(); info.dispose(); },
  };
  let this_drag = null;
  return rt;
}
