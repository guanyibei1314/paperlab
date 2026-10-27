// 第 5 课 力改变运动：小车 + 打点计时器 + 纸带 + a–F 图
import * as THREE from 'three';
import { box, cyl, litMat, edgeLines, Card, canvasTex, paperFill, inkMat } from '../core/ink.js';
import { FORCES, INK, FONT, clamp, fmt } from '../core/const.js';
import { cart, pulley, Rope, forceArrow, v3, label3d } from './common.js';

const G = 9.8;
const SC = 0.25;                       // 场景厘米 / 真实厘米
const TRAVEL = 0.36;                   // 槽码落地前小车最多走 0.36 m
const M_CAR = 0.5, M_HOOK = 0.02, M_W = 0.25;
const TAPE0 = 10;                      // 开始时计时器到小车尾的纸带长（真实 cm）
const COLORS = ['#2f7fe8', '#e5703a', '#2f9a5f'];

export function build(ctx) {
  const { st } = ctx;
  const root = new THREE.Group();
  const app = new THREE.Group(); root.add(app);
  const Z = -4.6, TT = 12.6;           // 桌面高度
  const table = box(19.4, 0.5, 5.2, { ink: { color: '#e5dfd1' } }); table.position.set(0, TT - 0.5, Z); app.add(table);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const leg = box(0.55, TT - 0.5, 0.55, { ink: { color: '#dcd5c6' } }); leg.position.set(sx * 9.0, 0, Z + sz * 2.1); app.add(leg); }
  // 长木板（左端垫高）
  const tilt = Math.atan(0.45 / 18);
  const boardG = new THREE.Group(); boardG.position.set(0, TT + 0.25, Z); boardG.rotation.z = -tilt; app.add(boardG);
  const board = box(18.4, 0.25, 2.6, { ink: { color: '#ece4d2' } }); board.position.y = 0; boardG.add(board);
  const shim = box(1.0, 0.45, 2.4, { ink: { color: '#d6ceb9' } }); shim.position.set(-8.6, TT, Z); app.add(shim);
  // 打点计时器
  const timer = new THREE.Group();
  const tb = box(2.0, 1.1, 1.8, { ink: { color: '#dad5cb' } }); timer.add(tb);
  const tl = label3d('打点计时器', { w: 2.0, h: 0.5, font: FONT.serif, size: 0.8 }); tl.position.set(0, 0.6, 0.91); timer.add(tl);
  const needle = box(0.12, 0.5, 0.12, { ink: { color: '#9d978c' }, edges: false }); needle.position.set(0.6, 1.1, 0); timer.add(needle);
  timer.position.set(-7.9, 0.25, 0); boardG.add(timer);
  // 小车与滑轮
  const car = cart({ L: 2.6, W: 1.7, H: 0.6, wheel: 0.3 });
  boardG.add(car);
  const weightsG = new THREE.Group(); car.add(weightsG);
  const wBlocks = [0, 1].map(i => { const b = box(1.0, 0.45, 1.1, { ink: { color: '#cfc9bd' } }); b.position.set(-0.55 + i * 1.1, car.userData.height, 0); weightsG.add(b); return b; });
  const PXL = 9.6, PYL = 0.45, PRL = 0.55;
  const pul = pulley(PRL); pul.position.set(PXL, PYL, 0); boardG.add(pul);
  const hanger = new THREE.Group(); app.add(hanger);
  const hookTop = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 8, 16), inkMat({ color: '#cfcac0' })); hookTop.position.y = -0.1; hanger.add(hookTop);
  const rod = cyl(0.05, 0.05, 1.8, { ink: { color: '#d0cbc1' }, seg: 6, edges: false }); rod.position.y = -2.0; hanger.add(rod);
  const discs = [0, 1, 2, 3].map(i => { const d = cyl(0.55, 0.55, 0.22, { ink: { color: '#e1ddd3', uv: [12, 1] }, seg: 28 }); d.position.y = -2.0 + i * 0.26; hanger.add(d); return d; });
  const ropeH = new Rope(3, 1.4); ropeH.line.userData.noPop = true; root.add(ropeH.line);
  // 纸带
  const TAPE_MAX = TAPE0 + TRAVEL * 100 + 2;
  const tapeTex = canvasTex(2400, 64);
  const tapeGeo = new THREE.PlaneGeometry(1, 0.55);
  tapeGeo.rotateX(-Math.PI / 2);
  const tape = new THREE.Mesh(tapeGeo, litMat({ map: tapeTex })); tape.name = 'tape';
  tape.receiveShadow = true; boardG.add(tape);
  // 牌子
  const result = new Card({ w: 7.6, h: 5.0, tilt: -14 });
  result.group.position.set(-4.6, 0, 3.2); root.add(result.group);
  const graph = new Card({ w: 7.6, h: 6.2, tilt: -12, px: 120 });
  graph.group.position.set(4.6, 0, 3.0); graph.group.rotation.y = -0.15; root.add(graph.group);
  // 箭头
  const aT = forceArrow('F', { scale: 5, width: 0.14, labelSide: 1 });
  const aTh = forceArrow('F', { scale: 5, width: 0.12, labelSide: -1 });
  const aGh = forceArrow('G', { scale: 5, width: 0.12, labelSide: 1 });
  root.add(aT.group, aTh.group, aGh.group);

  // 状态
  let x = 0, v = 0, t = 0, running = false, dots = [], a = 0, lastRun = null;
  const runs = [];
  const startX = -6.4;
  function masses() { return { m: st.ctrl.hooks * M_HOOK, M: M_CAR + st.ctrl.weights * M_W }; }
  function drawTape() {
    const c = tapeTex.userData.ctx, W = c.canvas.width, H = c.canvas.height;
    paperFill(c, W, H, '#fbf3cf', 0.02);
    c.fillStyle = INK;
    const k = W / TAPE_MAX;
    dots.forEach((d, i) => { c.beginPath(); c.arc(W - (TAPE0 + d) * k, H / 2, 6, 0, 6.28); c.fill(); });
    c.strokeStyle = '#8f8778'; c.lineWidth = 3; c.strokeRect(1, 1, W - 2, H - 2);
    if (lastRun && !running) {
      // 每 5 个间隔标一个计数点
      c.strokeStyle = '#b8372a'; c.fillStyle = '#b8372a'; c.lineWidth = 2; c.font = `600 22px ${FONT.num}`; c.textAlign = 'center';
      lastRun.cps.forEach((p, j) => { const xx = W - (TAPE0 + p) * k; c.beginPath(); c.moveTo(xx, 2); c.lineTo(xx, 12); c.stroke(); c.fillText(String(j), xx, H - 4); });
    }
    tapeTex.needsUpdate = true;
  }
  function layout() {
    const xs = startX + x * 100 * SC;
    car.position.set(xs, 0.25, 0);
    car.userData.wheels.forEach(w => (w.rotation.z = -(x * 100 * SC) / car.userData.wheelR));
    const m = masses();
    wBlocks.forEach((b, i) => (b.visible = i < st.ctrl.weights));
    discs.forEach((d, i) => (d.visible = i < st.ctrl.hooks));
    // 槽码：从滑轮往下挂
    boardG.updateMatrix();
    const pw = new THREE.Vector3(PXL + PRL, PYL, 0).applyMatrix4(boardG.matrix);
    const drop = 2.0 + x * 100 * SC;
    hanger.position.set(pw.x, pw.y - drop, Z);
    const attach = new THREE.Vector3(xs + 1.3, PYL + PRL, 0).applyMatrix4(boardG.matrix);
    const ptop = new THREE.Vector3(PXL, PYL + PRL, 0).applyMatrix4(boardG.matrix);
    ropeH.set([attach, ptop, v3(pw.x, pw.y, Z), v3(pw.x, pw.y - drop - 0.05, Z)]);
    // 纸带：从计时器到车尾
    const tx0 = -7.9 + 1.0, tx1 = xs - 1.3;
    const len = Math.max(0.01, tx1 - tx0);
    const p = tapeGeo.attributes.position, uv = tapeGeo.attributes.uv;
    const u1 = (TAPE0 + x * 100) / TAPE_MAX;
    for (let i = 0; i < p.count; i++) {
      const isRight = i % 2 === 1;
      p.setX(i, isRight ? tx1 : tx0); p.setY(i, 0.268);
      uv.setX(i, isRight ? 1 : 1 - u1);
    }
    // 纸带坐标：s=0 在车尾；左端（计时器处）s = TAPE0 + x
    p.needsUpdate = true; uv.needsUpdate = true;
    tapeGeo.computeBoundingSphere();
    return { attach, pw, drop };
  }
  function analyze() {
    // 纸带上点 k 离车尾的距离 = TAPE0 + x(t_k) — 这里记录的是 x(t_k)
    const T = 0.1;
    const cps = [];
    for (let j = 0; j * 5 < dots.length; j++) cps.push(dots[j * 5]);
    const seg = [];
    for (let j = 1; j < cps.length; j++) seg.push(+(cps[j] - cps[j - 1]).toFixed(2));
    let am = NaN;
    const n = Math.floor(seg.length / 2) * 2;
    if (n >= 2) {
      const h = n / 2;
      let s1 = 0, s2 = 0;
      for (let i = 0; i < h; i++) { s1 += seg[i]; s2 += seg[h + i]; }
      am = ((s2 - s1) / 100) / (h * h * T * T);
    }
    return { cps, seg, a: am };
  }
  function run() {
    x = 0; v = 0; t = 0; dots = [0]; running = true; lastRun = null;
    const m = masses(); a = m.m * G / (m.M + m.m);
    drawTape(); ctx.sfx.thud(0.2);
  }
  function finish() {
    running = false;
    const m = masses();
    const r = analyze();
    lastRun = Object.assign(r, { F: m.m * G, M: m.M, aTrue: a });
    if (isFinite(r.a)) runs.push({ F: m.m * G, a: r.a, M: m.M });
    drawTape(); drawCards(); ctx.marginChanged();
    // 挑战：同一质量，3 种不同拉力
    const byM = {};
    runs.forEach(rr => { const k = rr.M.toFixed(2); (byM[k] = byM[k] || new Set()).add(rr.F.toFixed(3)); });
    if (Object.values(byM).some(s => s.size >= 3)) ctx.complete();
  }
  function drawCards() {
    const m = masses();
    const lines = [`槽码 ${st.ctrl.hooks} 个：F = ${fmt(m.m * G, 3)} N`, `小车 + 砝码：M = ${fmt(m.M, 2)} kg`];
    if (lastRun) {
      lines.push(`相邻计数点间距（cm）：`);
      lines.push({ t: lastRun.seg.slice(0, 6).map(s => s.toFixed(2)).join('  '), hand: true, s: 1.05, c: '#26407a' });
      lines.push({ t: `测得 a = ${fmt(lastRun.a, 2)} m/s²`, w: 700 });
    } else lines.push('点"释放"跑一次。');
    result.draw({ title: '纸带数据', lines, lineSize: 0.1 });
    graph.draw({ title: 'a–F 图', _v: runs.map(r => r.F.toFixed(3) + r.M).join(), custom: (c, W, H) => drawGraph(c, W, H) });
  }
  function drawGraph(c, W, H) {
    const x0 = 120, y0 = H - 110, x1 = W - 50, y1 = 150;
    const Fmax = 0.9, Amax = 1.6;
    c.strokeStyle = INK; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x0, y1 - 20); c.lineTo(x0, y0); c.lineTo(x1 + 10, y0); c.stroke();
    c.fillStyle = INK; c.font = `500 30px ${FONT.math}`; c.textAlign = 'center';
    for (let f = 0; f <= 0.8 + 1e-9; f += 0.2) { const xx = x0 + (f / Fmax) * (x1 - x0); c.fillRect(xx - 1, y0, 2, 10); c.fillText(f.toFixed(1), xx, y0 + 42); }
    c.textAlign = 'right';
    for (let aa = 0; aa <= 1.6 + 1e-9; aa += 0.4) { const yy = y0 - (aa / Amax) * (y0 - y1); c.fillRect(x0 - 10, yy - 1, 10, 2); c.fillText(aa.toFixed(1), x0 - 16, yy + 10); }
    c.font = `italic 500 34px ${FONT.math}`; c.textAlign = 'left'; c.fillText('F / N', x1 - 70, y0 - 16);
    c.fillText('a / (m·s⁻²)', x0 + 14, y1 - 26);
    const Ms = [...new Set(runs.map(r => r.M.toFixed(2)))].map(Number);
    Ms.forEach((M) => {
      const col = COLORS[Math.round((M - M_CAR) / M_W)] || INK;
      c.strokeStyle = col; c.setLineDash([10, 8]); c.lineWidth = 2;
      c.beginPath(); c.moveTo(x0, y0); const fe = Math.min(Fmax, Amax * M); c.lineTo(x0 + (fe / Fmax) * (x1 - x0), y0 - (fe / M / Amax) * (y0 - y1)); c.stroke(); c.setLineDash([]);
    });
    runs.forEach(r => {
      const col = COLORS[Math.round((r.M - M_CAR) / M_W)] || INK;
      const xx = x0 + (r.F / Fmax) * (x1 - x0), yy = y0 - (r.a / Amax) * (y0 - y1);
      c.fillStyle = col; c.beginPath(); c.arc(xx, yy, 10, 0, 6.28); c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    });
    // 图例
    c.font = `400 26px ${FONT.serif}`; c.textAlign = 'left';
    [0.5, 0.75, 1.0].forEach((M, i) => { c.fillStyle = COLORS[i]; c.fillRect(W - 300, 40 + i * 34, 22, 22); c.fillStyle = INK; c.fillText(`M = ${M} kg`, W - 268, 60 + i * 34); });
    c.fillStyle = '#6b6672'; c.font = `400 22px ${FONT.serif}`; c.fillText('虚线：a = F/M', x0 + 14, y1 + 10);
  }
  layout(); drawTape(); drawCards();

  let needleT = 0;
  const rt = {
    root,
    steps: [
      { cap: '实验台上：一端垫高的长木板、小车和打点计时器，细绳绕过滑轮挂着槽码。', shot: ctx.shot(0, 8, -2, { pitch: 30, w: 26, h: 21, pw: 21, ph: 28 }), dur: 5 },
      { cap: '挂 2 个槽码，释放小车。纸带上的点越来越稀：小车越来越快。', shot: ctx.shot(-0.5, 13, -4.6, { pitch: 56, w: 21, h: 9 }), dur: 6, enter: () => { ctx.setCtrl('hooks', 2); ctx.setCtrl('weights', 0); run(); } },
      { cap: '槽码增加到 4 个：拉力约为原来的 2 倍，加速度也约为原来的 2 倍。', shot: ctx.shot(-0.5, 13, -4.6, { pitch: 56, w: 21, h: 9 }), dur: 6, enter: () => { ctx.setCtrl('hooks', 4); run(); } },
      { cap: '小车上加 2 个砝码，总质量变成 1 kg：同样的拉力，加速度只剩一半左右。', shot: ctx.shot(-0.5, 13, -4.6, { pitch: 56, w: 21, h: 9 }), dur: 6, enter: () => { ctx.setCtrl('weights', 2); run(); } },
      { cap: '看 a–F 图：同一辆小车的点，大致排在一条过原点的直线上。', shot: ctx.shot(4.5, 3.8, 3, { pitch: 24, yaw: -8, w: 10, h: 9 }), dur: 7 },
      { cap: '轮到你：换槽码和砝码，多跑几次，把图补完整。', shot: ctx.shot(0, 7.5, -1.5, { pitch: 32, w: 27, h: 22, pw: 21, ph: 29 }), interactive: true },
    ],
    pickables: [{ obj: car, cursor: 'pointer', down: () => { if (!running) ctx.act({ type: 'btn', ctrl: 'run' }); } }],
    onControl(id) {
      if (id === 'run') run();
      if (id === 'clear') { runs.length = 0; lastRun = null; dots = []; x = 0; v = 0; running = false; drawTape(); drawCards(); }
      if (id === 'hooks' || id === 'weights') { if (!running) { x = 0; v = 0; dots = []; lastRun = null; drawTape(); } drawCards(); }
      ctx.marginChanged();
    },
    margin() {
      const m = masses();
      if (lastRun && isFinite(lastRun.a)) return [`T = 0.1 s`, `a = Δx/T²`, `≈ ${fmt(lastRun.a, 2)} m/s²`, `F/M = ${fmt(lastRun.F / lastRun.M, 2)}`];
      return [`F = ${fmt(m.m * G, 3)} N`, `M = ${fmt(m.M, 2)} kg`, `F/M ≈ ${fmt(m.m * G / m.M, 2)} m/s²`];
    },
    update(dt) {
      if (running) {
        const sub = 10, h = dt / sub;
        for (let i = 0; i < sub; i++) {
          t += h; v += a * h; x += v * h;
          // 每 0.02 s 打一个点（用解析式，避免累计误差）
          while (dots.length * 0.02 <= t + 1e-9) { const tk = dots.length * 0.02; dots.push(0.5 * a * tk * tk * 100); }
          if (x >= TRAVEL) { x = TRAVEL; v = 0; dots = dots.filter(d => d <= TRAVEL * 100 + 1e-6); finish(); break; }
        }
        drawTape();
        needleT += dt; needle.position.y = 1.1 + Math.sin(needleT * 60) * 0.05;
      }
      const { attach, pw, drop } = layout();
      const risen = ctx.risen() > 0.98;
      const m = masses();
      if (risen && st.ctrl.hooks > 0) {
        const Tn = running ? m.M * a : m.m * G;
        aT.set(attach.clone().add(v3(0.05, 0.1, 0)), v3(Tn, 0, 0), `拉力 ${fmt(Tn, 2)} N`);
        const hp = v3(pw.x + 1.0, pw.y - drop - 1.2, Z);
        aGh.set(hp, v3(0, -m.m * G, 0), `G ${fmt(m.m * G, 2)} N`);
        aTh.set(hp, v3(0, Tn, 0), null);
      } else { aT.group.visible = aTh.group.visible = aGh.group.visible = false; }
    },
    dispose() { aT.dispose(); aTh.dispose(); aGh.dispose(); result.dispose(); graph.dispose(); },
  };
  return rt;
}
