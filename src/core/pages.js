// 书页模板：课文页、实验页、扉页与目录、尾声
import { CW, CH, FONT, FORCES, INK, SEAL } from './const.js';
import { drawRich, measureRich, drawMath, drawHand } from './type.js';

const RED = '#b8372a';
const GREY = '#6b6672';
let paperCanvas = null;

function paperBase() {
  if (paperCanvas) return paperCanvas;
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f6f4ee'; ctx.fillRect(0, 0, CW, CH);
  const img = ctx.getImageData(0, 0, CW, CH); const d = img.data;
  let seed = 4242; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 7; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.8; }
  // 纸纤维
  ctx.putImageData(img, 0, 0);
  for (let k = 0; k < 900; k++) {
    ctx.strokeStyle = `rgba(150,140,120,${0.02 + rnd() * 0.04})`;
    ctx.lineWidth = 0.6;
    const x = rnd() * CW, y = rnd() * CH, a = rnd() * 6.28, l = 4 + rnd() * 14;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  paperCanvas = c;
  return c;
}

export function drawPaper(ctx, side) {
  ctx.drawImage(paperBase(), 0, 0);
  // 书脊附近的阴影
  const g = side < 0 ? ctx.createLinearGradient(CW, 0, CW - 220, 0) : ctx.createLinearGradient(0, 0, 220, 0);
  g.addColorStop(0, 'rgba(70,60,45,0.16)');
  g.addColorStop(0.35, 'rgba(70,60,45,0.05)');
  g.addColorStop(1, 'rgba(70,60,45,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
}

const M = { out: 140, inn: 150, top: 120 };
export function cols(side) { return side < 0 ? { x0: M.out, x1: CW - M.inn } : { x0: M.inn, x1: CW - M.out }; }

function runningHead(ctx, side, text, page) {
  const { x0, x1 } = cols(side);
  ctx.fillStyle = GREY; ctx.font = `400 22px ${FONT.serif}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = side < 0 ? 'left' : 'right';
  ctx.fillText(text, side < 0 ? x0 : x1, M.top);
  ctx.font = `400 26px ${FONT.math}`;
  ctx.fillText(String(page), side < 0 ? x0 : x1, CH - 80);
  ctx.textAlign = 'left';
}

function label(ctx, text, x, y, color = RED) {
  ctx.fillStyle = color; ctx.font = `700 24px ${FONT.serif}`;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const spaced = text.split('').join(' ');
  ctx.fillText(spaced, x, y);
}

// 手画椭圆圈
export function handEllipse(ctx, cx, cy, rx, ry, color = RED, lw = 3) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath();
  const n = 40;
  for (let i = 0; i <= n + 4; i++) {
    const a = -2.2 + (i / n) * Math.PI * 2;
    const wob = 1 + 0.04 * Math.sin(i * 1.7);
    const x = cx + Math.cos(a) * rx * wob * (1 + i * 0.002);
    const y = cy + Math.sin(a) * ry * wob;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function checkbox(ctx, x, y, s, checked, correct) {
  ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
  ctx.strokeRect(x, y, s, s);
  if (checked) {
    ctx.save();
    ctx.strokeStyle = correct === false ? RED : '#26407a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + s * 0.12, y + s * 0.55); ctx.lineTo(x + s * 0.42, y + s * 0.88); ctx.lineTo(x + s * 1.1, y - s * 0.15); ctx.stroke();
    ctx.restore();
  }
}

export function drawSeal(ctx, cx, cy, size, text, rot = -0.12, alpha = 1) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.globalAlpha = alpha * 0.92;
  ctx.strokeStyle = SEAL; ctx.fillStyle = SEAL;
  ctx.lineWidth = size * 0.07;
  const r = size / 2;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-r, -r, size, size, size * 0.08) : ctx.rect(-r, -r, size, size);
  ctx.stroke();
  ctx.lineWidth = size * 0.02;
  ctx.strokeRect(-r * 0.86, -r * 0.86, size * 0.86, size * 0.86);
  const chars = [...text];
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (chars.length <= 2) {
    ctx.font = `900 ${size * 0.38}px ${FONT.serif}`;
    chars.forEach((c, i) => ctx.fillText(c, 0, (i - (chars.length - 1) / 2) * size * 0.4));
  } else if (chars.length === 3) {
    ctx.font = `900 ${size * 0.3}px ${FONT.serif}`;
    chars.forEach((c, i) => ctx.fillText(c, 0, (i - 1) * size * 0.29));
  } else {
    ctx.font = `900 ${size * 0.34}px ${FONT.serif}`;
    // 从右到左竖排两列
    const order = [[0.2, -0.2], [0.2, 0.2], [-0.2, -0.2], [-0.2, 0.2]];
    chars.slice(0, 4).forEach((c, i) => ctx.fillText(c, order[i][0] * size, order[i][1] * size));
  }
  // 斑驳
  ctx.globalCompositeOperation = 'destination-out';
  let seed = text.length * 97 + 13; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    ctx.globalAlpha = 0.25 + rnd() * 0.5;
    ctx.beginPath(); ctx.arc((rnd() - 0.5) * size, (rnd() - 0.5) * size, rnd() * size * 0.025 + 0.5, 0, 6.28); ctx.fill();
  }
  ctx.restore();
}

function dashedCircle(ctx, cx, cy, r) {
  ctx.save(); ctx.strokeStyle = '#9d97a3'; ctx.lineWidth = 2; ctx.setLineDash([7, 8]);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}

// ---------- 课文页（左） ----------
export function drawLessonLeft(ctx, L, st) {
  const hits = [];
  drawPaper(ctx, -1);
  const { x0, x1 } = cols(-1);
  const W = x1 - x0;
  runningHead(ctx, -1, `第 ${L.num} 课 · ${L.title}`, L.num * 2 + 2);
  let y = 190;
  label(ctx, `第 ${L.num} 课`, x0, y);
  y += 18;
  ctx.fillStyle = INK; ctx.font = `900 84px ${FONT.serif}`; ctx.textBaseline = 'top';
  ctx.fillText(L.title, x0 - 4, y);
  y += 124;
  y = drawRich(ctx, L.intro, x0, y, W, { size: 35, lineH: 62, justify: true });
  y += 30;
  // 公式框：高度按公式和注释实际占的空间来定
  const fw = 740;
  const fsz = L.formula.size || 64;
  const hasFrac = /\\frac/.test(L.formula.expr);
  const noteH = measureRich(ctx, L.formula.note, fw - 70, { size: 22, lineH: 33 });
  const top = hasFrac ? fsz * 1.05 : fsz * 0.92;
  const below = hasFrac ? fsz * 0.75 : fsz * 0.3;
  const fh = 34 + top + below + 14 + noteH + 22;
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x0, y, fw, fh);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.strokeRect(x0, y, fw, fh);
  ctx.lineWidth = 1; ctx.strokeRect(x0 + 7, y + 7, fw - 14, fh - 14);
  drawMath(ctx, L.formula.expr, x0 + 40, y + 34 + top, fsz, INK);
  drawRich(ctx, L.formula.note, x0 + 36, y + 34 + top + below + 14 - 22 * 0.2, fw - 70, { size: 22, lineH: 33, color: GREY });
  // 页边草稿（实时计算）
  if (st.margin && st.margin.length) drawHand(ctx, st.margin, x0 + fw + 40, y + 4, 34, '#33406e', -0.035);
  y += fh + 44;
  label(ctx, '关键词', x0, y);
  y += 18;
  for (const [term, def] of L.terms) {
    const tt = term.startsWith('[') ? term : `**${term}**`;
    y = drawRich(ctx, `${tt}　${def}`, x0, y, W, { size: 30, lineH: 49 }) + 10;
  }
  y += 30;
  label(ctx, '预测', x0, y);
  y += 16;
  y = drawRich(ctx, `**${L.predict.q}**`, x0, y, W, { size: 33, lineH: 52 });
  y += 12;
  L.predict.options.forEach((opt, i) => {
    const s = 32;
    const checked = st.pred === i;
    const reveal = st.flapOpen && st.pred != null;
    checkbox(ctx, x0 + 4, y + 10, s, checked, reveal ? i === L.predict.answer : undefined);
    ctx.fillStyle = INK; ctx.font = `400 32px ${FONT.serif}`; ctx.textBaseline = 'alphabetic';
    ctx.fillText(opt, x0 + 60, y + 39);
    const tw = ctx.measureText(opt).width;
    hits.push({ x: x0 - 6, y: y, w: Math.max(420, tw + 80), h: 56, action: { type: 'pred', i } });
    y += 60;
  });
  y += 30;
  const flapRect = { x: x0, y: Math.min(Math.max(y + 10, 1540), CH - 160 - 300), w: 770, h: 300 };
  // 翻页下面的答案
  ctx.save();
  ctx.fillStyle = 'rgba(224,232,240,0.55)'; ctx.fillRect(flapRect.x, flapRect.y, flapRect.w, flapRect.h);
  label(ctx, '答案', flapRect.x + 26, flapRect.y + 44, '#26407a');
  let ay = flapRect.y + 56;
  if (st.pred != null) {
    const ok = st.pred === L.predict.answer;
    ctx.fillStyle = ok ? '#26407a' : '#b8372a'; ctx.font = `400 33px ${FONT.hand}`; ctx.textBaseline = 'top';
    ctx.fillText(ok ? `你选了"${L.predict.options[st.pred]}"，猜对了！` : `你选了"${L.predict.options[st.pred]}"，正确答案是"${L.predict.options[L.predict.answer]}"。`, flapRect.x + 110, flapRect.y + 16, flapRect.w - 130);
  }
  drawRich(ctx, L.why, flapRect.x + 26, ay, flapRect.w - 52, { size: 25, lineH: 39 });
  ctx.restore();
  // 挑战
  const cx0 = flapRect.x + flapRect.w + 44, cw = x1 - cx0;
  label(ctx, '挑战', cx0, flapRect.y + 4);
  ctx.save();
  ctx.fillStyle = '#33406e'; ctx.font = `400 34px ${FONT.hand}`; ctx.textBaseline = 'top';
  wrapHand(ctx, L.challenge, cx0, flapRect.y + 22, cw, 40);
  ctx.restore();
  const sc = { x: cx0 + cw / 2, y: flapRect.y + flapRect.h - 40 };
  if (st.stamped) drawSeal(ctx, sc.x, sc.y - 4, 140, L.stamp, -0.1);
  else dashedCircle(ctx, sc.x, sc.y - 4, 62);
  return { hits, flapRect, sealAt: sc };
}

function wrapHand(ctx, text, x, y, w, lh) {
  let line = '', yy = y;
  for (const ch of text) {
    const t = line + ch;
    if (ctx.measureText(t).width > w && line) {
      if ('，。、；：？！）'.includes(ch)) { ctx.fillText(t, x, yy); line = ''; yy += lh; continue; }
      ctx.fillText(line, x, yy); line = ch; yy += lh;
    } else line = t;
  }
  if (line) ctx.fillText(line, x, yy);
  return yy + lh;
}

export function drawFlapFront(ctx, w, h, st = {}) {
  ctx.fillStyle = '#efe9da'; ctx.fillRect(0, 0, w, h);
  // 纸纹
  ctx.strokeStyle = 'rgba(150,140,120,0.08)';
  for (let i = 0; i < 40; i++) { ctx.beginPath(); const yy = (i / 40) * h; ctx.moveTo(0, yy); ctx.lineTo(w, yy + 3); ctx.stroke(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(1, 1, w - 2, h - 2);
  ctx.lineWidth = 1; ctx.setLineDash([6, 6]); ctx.strokeRect(12, 12, w - 24, h - 24); ctx.setLineDash([]);
  ctx.fillStyle = RED; ctx.font = `700 26px ${FONT.serif}`; ctx.textBaseline = 'top';
  ctx.fillText('为什么？', 40, 42);
  ctx.fillStyle = INK; ctx.font = `700 46px ${FONT.serif}`;
  ctx.fillText('掀开看答案', 40, 94);
  ctx.fillStyle = GREY; ctx.font = `400 26px ${FONT.serif}`;
  ctx.fillText(st.pred == null ? '……先在上面选一个预测，再掀开。' : '……你已经做出预测了。', 40, 170);
  ctx.save();
  ctx.translate(w - 160, h - 92); ctx.rotate(-0.08);
  ctx.fillStyle = '#33406e'; ctx.font = `400 34px ${FONT.hand}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText('掀这里', 0, 0);
  ctx.strokeStyle = '#33406e'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(50, 14); ctx.quadraticCurveTo(80, 30, 108, 56); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(108, 56); ctx.lineTo(90, 54); ctx.moveTo(108, 56); ctx.lineTo(102, 38); ctx.stroke();
  ctx.restore();
}

// ---------- 实验页（右） ----------
export function drawLessonRight(ctx, L, st) {
  const hits = [];
  drawPaper(ctx, 1);
  const { x0, x1 } = cols(1);
  const W = x1 - x0;
  runningHead(ctx, 1, `图 ${L.num}`, L.num * 2 + 3);
  // 底部说明
  let y = CH - 470;
  const capH = measureRich(ctx, L.fig.caption, W, { size: 24, lineH: 36 });
  y = CH - 300 - capH;
  ctx.save(); ctx.globalAlpha = 0.95;
  drawRich(ctx, L.fig.caption, x0, y, W, { size: 24, lineH: 36, color: GREY });
  ctx.restore();
  y += capH + 6;
  y = drawRich(ctx, `**${L.fig.instruction}**`, x0, y, W, { size: 30, lineH: 46 });
  y += 16;
  // 控件
  ctx.textBaseline = 'alphabetic';
  let cx = x0, cy = y + 38;
  const rowH = 62;
  for (const c of L.controls) {
    const val = st.ctrl ? st.ctrl[c.id] : undefined;
    ctx.font = `400 28px ${FONT.serif}`;
    if (c.type === 'button') {
      ctx.font = `700 28px ${FONT.serif}`;
      const tw = ctx.measureText(c.label).width + 44;
      if (cx + tw > x1) { cx = x0; cy += rowH; }
      ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
      ctx.strokeRect(cx, cy - 34, tw, 48); ctx.lineWidth = 1; ctx.strokeRect(cx + 5, cy - 29, tw - 10, 38);
      ctx.fillStyle = INK; ctx.fillText(c.label, cx + 22, cy);
      hits.push({ x: cx - 4, y: cy - 40, w: tw + 8, h: 60, action: { type: 'btn', ctrl: c.id } });
      cx += tw + 26;
      continue;
    }
    const lab = c.label + '：';
    let need = ctx.measureText(lab).width;
    if (c.type === 'choice') for (const [, ol] of c.options) need += ctx.measureText(ol).width + 30;
    else need += 200;
    if (cx + need > x1 && cx > x0) { cx = x0; cy += rowH; }
    ctx.fillStyle = GREY; ctx.fillText(lab, cx, cy);
    cx += ctx.measureText(lab).width + 6;
    if (c.type === 'choice') {
      for (const [ov, ol] of c.options) {
        const sel = val === ov;
        ctx.font = `${sel ? 700 : 400} 28px ${FONT.serif}`;
        ctx.fillStyle = sel ? INK : '#4a4652';
        const tw = ctx.measureText(ol).width;
        ctx.fillText(ol, cx, cy);
        if (sel) handEllipse(ctx, cx + tw / 2, cy - 10, tw / 2 + 16, 26, RED, 3);
        hits.push({ x: cx - 12, y: cy - 40, w: tw + 24, h: 58, action: { type: 'opt', ctrl: c.id, value: ov } });
        cx += tw + 32;
      }
    } else if (c.type === 'stepper') {
      const vtxt = c.fmt ? c.fmt(val) : String(val);
      ctx.font = `700 30px ${FONT.serif}`;
      const bw = 44;
      // −
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(cx, cy - 34, bw, 44);
      ctx.fillStyle = INK; ctx.fillText('−', cx + 13, cy);
      hits.push({ x: cx - 6, y: cy - 42, w: bw + 12, h: 60, action: { type: 'step', ctrl: c.id, delta: -1 } });
      cx += bw + 14;
      ctx.font = `600 40px ${FONT.num}`; ctx.fillStyle = '#26407a';
      const vw = Math.max(70, ctx.measureText(vtxt).width);
      ctx.fillText(vtxt, cx + (vw - ctx.measureText(vtxt).width) / 2, cy + 2);
      cx += vw + 14;
      ctx.strokeStyle = INK; ctx.strokeRect(cx, cy - 34, bw, 44);
      ctx.fillStyle = INK; ctx.font = `700 30px ${FONT.serif}`; ctx.fillText('+', cx + 12, cy);
      hits.push({ x: cx - 6, y: cy - 42, w: bw + 12, h: 60, action: { type: 'step', ctrl: c.id, delta: 1 } });
      cx += bw + 30;
    }
    cx += 24;
  }
  return { hits };
}

// ---------- 扉页 + 目录 ----------
export const BOOK_TITLE = '运动的理由';
export function drawTitleLeft(ctx, st) {
  drawPaper(ctx, -1);
  const { x0, x1 } = cols(-1);
  const W = x1 - x0;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = RED; ctx.font = `700 24px ${FONT.serif}`;
  ctx.fillText('纸 上 实 验 室 · 物 理 · 第 一 册', x0 + W / 2, 330);
  ctx.fillStyle = INK; ctx.font = `900 128px ${FONT.serif}`;
  ctx.fillText(BOOK_TITLE, x0 + W / 2, 500);
  ctx.fillStyle = GREY; ctx.font = `400 32px ${FONT.serif}`;
  ctx.fillText('一本关于力与运动的立体物理书', x0 + W / 2, 580);
  ctx.font = `400 26px ${FONT.serif}`;
  ctx.fillText('物体为什么会动起来、停下来、越来越快？牛顿用三句话回答了。', x0 + W / 2, 636);
  // 小插图：一个木块被橙色箭头推着
  drawTitleSketch(ctx, x0 + W / 2, 900);
  ctx.textAlign = 'left';
  let y = 1240;
  label(ctx, '怎 样 读 这 本 书', x0 + 60, y);
  y += 20;
  const how = [
    '先在左页勾一个预测，再动手。',
    '看右页的插图从纸上立起来。',
    '拖一拖、点一点图里的器材，亲手试一试。',
    '掀开"为什么"，看看原因。',
    '完成页边的挑战，盖一枚印章。',
  ];
  ctx.font = `400 33px ${FONT.serif}`;
  how.forEach((h, i) => {
    ctx.fillStyle = RED; ctx.font = `700 30px ${FONT.math}`;
    ctx.fillText(String(i + 1), x0 + 66, y + 54 + i * 62);
    ctx.fillStyle = INK; ctx.font = `400 33px ${FONT.serif}`;
    ctx.fillText(h, x0 + 110, y + 54 + i * 62);
  });
  ctx.fillStyle = GREY; ctx.font = `400 22px ${FONT.serif}`; ctx.textAlign = 'center';
  ctx.fillText('适合八年级至高一 · 对应人教版初中物理八年级下册与高中物理必修第一册', x0 + W / 2, CH - 150);
  ctx.textAlign = 'left';
  runningHead(ctx, -1, '', 2);
}

function drawTitleSketch(ctx, cx, cy) {
  ctx.save();
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  // 桌面
  ctx.beginPath(); ctx.moveTo(cx - 330, cy + 120); ctx.lineTo(cx + 330, cy + 120); ctx.stroke();
  for (let i = -320; i < 330; i += 26) { ctx.beginPath(); ctx.moveTo(cx + i, cy + 122); ctx.lineTo(cx + i - 16, cy + 140); ctx.lineWidth = 1.5; ctx.stroke(); }
  ctx.lineWidth = 3;
  // 木块（斜投影）
  const bx = cx - 60, by = cy + 120, w = 200, h = 130, d = 60;
  ctx.fillStyle = '#fbfaf6';
  ctx.beginPath(); ctx.rect(bx, by - h, w, h); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx, by - h); ctx.lineTo(bx + d, by - h - d * 0.6); ctx.lineTo(bx + w + d, by - h - d * 0.6); ctx.lineTo(bx + w, by - h); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx + w, by); ctx.lineTo(bx + w + d, by - d * 0.6); ctx.lineTo(bx + w + d, by - h - d * 0.6); ctx.stroke();
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 16; i++) { const x = bx + w + 4 + i * 3.6; ctx.beginPath(); ctx.moveTo(x, by - 4 - i * 2.1); ctx.lineTo(x, by - h - i * 2.1 + 6); ctx.stroke(); }
  // 推力箭头
  const ac = FORCES.F.color;
  ctx.fillStyle = ac; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 300, cy + 40); ctx.lineTo(cx - 130, cy + 40); ctx.lineTo(cx - 130, cy + 18); ctx.lineTo(cx - 70, cy + 55); ctx.lineTo(cx - 130, cy + 92); ctx.lineTo(cx - 130, cy + 70); ctx.lineTo(cx - 300, cy + 70); ctx.closePath();
  ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = `italic 600 30px ${FONT.math}`; ctx.fillText('F', cx - 235, cy + 66);
  // 摩擦力
  ctx.fillStyle = FORCES.f.color;
  ctx.beginPath(); ctx.moveTo(cx + 140, cy + 108); ctx.lineTo(cx + 60, cy + 108); ctx.lineTo(cx + 60, cy + 98); ctx.lineTo(cx + 30, cy + 113); ctx.lineTo(cx + 60, cy + 128); ctx.lineTo(cx + 60, cy + 118); ctx.lineTo(cx + 140, cy + 118); ctx.closePath();
  ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = 1.8; ctx.stroke();
  ctx.restore();
}

export function drawContentsRight(ctx, lessons, st) {
  const hits = [];
  lessons = [...lessons, { id: 'end', num: 0, title: '尾声 · 三句话', sub: '牛顿三大定律', page: 20 }];
  drawPaper(ctx, 1);
  const { x0, x1 } = cols(1);
  ctx.fillStyle = INK; ctx.font = `900 72px ${FONT.serif}`; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillText('目录', x0, 290);
  let y = 380;
  for (const L of lessons) {
    const stamped = st.stamps && st.stamps[L.id];
    ctx.fillStyle = RED; ctx.font = `600 30px ${FONT.math}`;
    ctx.fillText(L.num ? String(L.num) : '', x0, y);
    ctx.fillStyle = INK; ctx.font = `400 38px ${FONT.serif}`;
    ctx.fillText(L.title, x0 + 54, y);
    const tw = ctx.measureText(L.title).width;
    ctx.fillStyle = GREY; ctx.font = `400 25px ${FONT.serif}`;
    ctx.fillText(L.sub || '', x0 + 54 + tw + 22, y);
    // 点线与页码
    ctx.fillStyle = '#a7a1ac';
    const pn = String(L.page);
    ctx.font = `400 30px ${FONT.math}`;
    const pw = ctx.measureText(pn).width;
    ctx.fillText(pn, x1 - pw, y);
    if (stamped) drawSeal(ctx, x1 - pw - 50, y - 12, 44, L.stamp, -0.15);
    hits.push({ x: x0 - 10, y: y - 46, w: x1 - x0 + 20, h: 64, action: { type: 'goto', id: L.id } });
    y += 70;
  }
  y += 18;
  const extras = [['索引', 'glossary'], ['小测验', 'quiz'], ['资料来源', 'sources'], ['教师笔记', 'teacher']];
  ctx.font = `700 32px ${FONT.serif}`;
  let ex = x0 + 54;
  for (const [t, id] of extras) {
    ctx.fillStyle = INK; ctx.fillText(t, ex, y);
    const tw = ctx.measureText(t).width;
    ctx.fillRect(ex, y + 8, tw, 2);
    hits.push({ x: ex - 10, y: y - 40, w: tw + 20, h: 60, action: { type: 'panel', id } });
    ex += tw + 48;
  }
  // 力的图例
  y += 110;
  label(ctx, '书 里 的 力', x0, y);
  y += 30;
  const keys = ['G', 'N', 'F', 'f', 'T', 'D', 'net'];
  const colW = (x1 - x0) / 2;
  keys.forEach((k, i) => {
    const cx = x0 + (i % 2) * colW, cy = y + Math.floor(i / 2) * 70;
    forceIcon(ctx, cx, cy, 44, FORCES[k].color);
    ctx.fillStyle = INK; ctx.font = `400 30px ${FONT.serif}`;
    ctx.fillText(FORCES[k].name, cx + 64, cy + 34);
  });
  y += 4 * 70 + 20;
  ctx.fillStyle = GREY; ctx.font = `italic 400 24px ${FONT.serif}`;
  ctx.fillText('每种颜色代表一种力；箭头越长，力越大。', x0, y);
  runningHead(ctx, 1, '', 3);
  return { hits };
}

export function forceIcon(ctx, x, y, s, color) {
  ctx.save();
  ctx.fillStyle = color; ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x + s * 0.2, y + s * 0.5); ctx.lineTo(x + s * 0.75, y + s * 0.5);
  ctx.moveTo(x + s * 0.58, y + s * 0.32); ctx.lineTo(x + s * 0.8, y + s * 0.5); ctx.lineTo(x + s * 0.58, y + s * 0.68); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(x, y, s, s);
  ctx.restore();
}

// ---------- 尾声 ----------
export function drawFinaleLeft(ctx, st) {
  drawPaper(ctx, -1);
  const { x0, x1 } = cols(-1);
  const W = x1 - x0;
  runningHead(ctx, -1, '尾声 · 三句话', 20);
  let y = 190;
  label(ctx, '尾 声', x0, y);
  y += 18;
  ctx.fillStyle = INK; ctx.font = `900 84px ${FONT.serif}`; ctx.textBaseline = 'top';
  ctx.fillText('三句话', x0 - 4, y);
  y += 124;
  y = drawRich(ctx, '1687 年，牛顿出版了《自然哲学的数学原理》。在书的开头，他用三句话说清了物体为什么运动、怎样运动。这本书里的八个实验，都在这三句话里。', x0, y, W, { size: 33, lineH: 58, justify: true });
  y += 30;
  const laws = [
    ['第一定律', '一切物体在没有受到力的作用时，总保持静止状态或匀速直线运动状态。', '第 2、3、4 课'],
    ['第二定律', '物体加速度的大小跟它受到的作用力成正比，跟它的质量成反比，加速度的方向跟作用力的方向相同。', '第 1、5、6 课'],
    ['第三定律', '两个物体之间的作用力和反作用力总是大小相等，方向相反，作用在同一条直线上。', '第 7、8 课'],
  ];
  for (const [t, body, ref] of laws) {
    const h = measureRich(ctx, body, W - 80, { size: 31, lineH: 52 }) + 120;
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(x0, y, W, h);
    ctx.fillStyle = RED; ctx.font = `700 30px ${FONT.serif}`; ctx.textBaseline = 'alphabetic';
    ctx.fillText(t, x0 + 36, y + 58);
    ctx.fillStyle = GREY; ctx.font = `400 24px ${FONT.serif}`; ctx.textAlign = 'right';
    ctx.fillText(ref, x1 - 36, y + 56); ctx.textAlign = 'left';
    drawRich(ctx, body, x0 + 36, y + 74, W - 80, { size: 31, lineH: 52 });
    y += h + 26;
  }
  y += 6;
  ctx.fillStyle = GREY; ctx.font = `italic 400 30px ${FONT.math}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText('Corpus omne perseverare in statu suo quiescendi', x0, y + 30);
  ctx.fillText('vel movendi uniformiter in directum …', x0, y + 70);
  ctx.font = `400 22px ${FONT.serif}`;
  ctx.fillText('第一定律拉丁文原文的开头。', x0, y + 112);
}

export function drawFinaleRight(ctx, lessons, st) {
  const hits = [];
  drawPaper(ctx, 1);
  const { x0, x1 } = cols(1);
  runningHead(ctx, 1, '牛顿摆 · 印章', 21);
  // 上半页留给立起来的牛顿摆
  ctx.fillStyle = GREY; ctx.font = `italic 400 24px ${FONT.serif}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText('图　牛顿摆：五个一样的钢球并排挂着。', x0, 840);
  ctx.fillStyle = INK; ctx.font = `900 56px ${FONT.serif}`;
  ctx.fillText('我的印章', x0, 960);
  const got = lessons.filter(L => st.stamps && st.stamps[L.id]).length;
  ctx.fillStyle = GREY; ctx.font = `400 26px ${FONT.serif}`;
  ctx.fillText(`已经盖了 ${got} / ${lessons.length} 枚。完成每课页边的挑战，就能盖上一枚。`, x0, 1012);
  const cw = (x1 - x0) / 4;
  lessons.forEach((L, i) => {
    const cx = x0 + cw * (i % 4) + cw / 2, cy = 1150 + Math.floor(i / 4) * 250;
    if (st.stamps && st.stamps[L.id]) drawSeal(ctx, cx, cy, 140, L.stamp, ((i * 37) % 7 - 3) * 0.03);
    else ghostSeal(ctx, cx, cy, 130, L.stamp);
    ctx.fillStyle = INK; ctx.font = `400 25px ${FONT.serif}`; ctx.textAlign = 'center';
    ctx.fillText(`${L.num} ${L.title}`, cx, cy + 112);
    ctx.textAlign = 'left';
    hits.push({ x: cx - cw / 2, y: cy - 90, w: cw, h: 220, action: { type: 'goto', id: L.id } });
  });
  let y = 1620;
  label(ctx, '接 下 来', x0, y);
  const next = [['做一遍小测验', 'quiz'], ['查索引', 'glossary'], ['看资料来源', 'sources']];
  ctx.font = `700 32px ${FONT.serif}`;
  let ex = x0;
  for (const [t, id] of next) {
    ctx.fillStyle = INK; ctx.fillText(t, ex, y + 60);
    const tw = ctx.measureText(t).width;
    ctx.fillRect(ex, y + 70, tw, 2);
    hits.push({ x: ex - 10, y: y + 14, w: tw + 20, h: 64, action: { type: 'panel', id } });
    ex += tw + 50;
  }
  ctx.fillStyle = GREY; ctx.font = `400 22px ${FONT.serif}`;
  ctx.fillText('纸上实验室 · 物理 · 第一册《运动的理由》', x0, CH - 150);
  return { hits };
}

function ghostSeal(ctx, cx, cy, size, text) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(120,110,120,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([6, 7]);
  ctx.strokeRect(-size / 2, -size / 2, size, size);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(120,110,120,0.22)';
  ctx.font = `900 ${size * (text.length > 2 ? 0.28 : 0.36)}px ${FONT.serif}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const chars = [...text];
  chars.forEach((c, i) => ctx.fillText(c, 0, (i - (chars.length - 1) / 2) * size * (chars.length > 2 ? 0.29 : 0.38)));
  ctx.restore();
}
