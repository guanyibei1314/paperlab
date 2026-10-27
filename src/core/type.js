// 画布排版：中文断行（避头尾）、粗体、力的颜色词、行内公式
import { FONT, FORCES, INK } from './const.js';

const NO_START = '，。、；：？！）》」』”’…—%·,.;:?!)]';
const NO_END = '（《「『“‘([';

// 解析富文本：**粗体**  [G|重力]  $公式$
export function parseRich(str) {
  const runs = [];
  const re = /\*\*(.+?)\*\*|\[(\w+)\|(.+?)\]|\$(.+?)\$/g;
  let last = 0, m;
  while ((m = re.exec(str))) {
    if (m.index > last) runs.push({ t: str.slice(last, m.index), s: 'n' });
    if (m[1] != null) runs.push({ t: m[1], s: 'b' });
    else if (m[2] != null) runs.push({ t: m[3], s: 'f', k: m[2] });
    else if (m[4] != null) runs.push({ t: m[4], s: 'm' });
    last = re.lastIndex;
  }
  if (last < str.length) runs.push({ t: str.slice(last), s: 'n' });
  return runs;
}

function tokenize(text) {
  // 中文字符逐字；拉丁字母/数字连续成词
  const out = [];
  const re = /[A-Za-z0-9.\-+/×²³%°′]+|\s+|./gu;
  let m;
  while ((m = re.exec(text))) out.push(m[0]);
  return out;
}

export function fontFor(style, size, weight = 400) {
  if (style === 'b' || style === 'f') return `700 ${size}px ${FONT.serif}`;
  return `${weight} ${size}px ${FONT.serif}`;
}

// 排出若干行，每行由若干片段组成
export function layoutRich(ctx, str, maxW, { size = 34, weight = 400, color = INK } = {}) {
  const runs = parseRich(str);
  const items = [];
  for (const r of runs) {
    if (r.s === 'm') {
      const w = measureMath(ctx, r.t, size * 1.02);
      items.push({ kind: 'math', t: r.t, w, size: size * 1.02, color });
      continue;
    }
    const font = fontFor(r.s, size, weight);
    ctx.font = font;
    const col = r.s === 'f' ? (FORCES[r.k] ? FORCES[r.k].color : color) : color;
    for (const tk of tokenize(r.t)) {
      const isSpace = /^\s+$/.test(tk);
      items.push({ kind: 'text', t: isSpace ? ' ' : tk, w: isSpace ? size * 0.3 : ctx.measureText(tk).width, font, color: col, space: isSpace, under: r.s === 'f' });
    }
  }
  const lines = [];
  let line = [], w = 0;
  const push = () => { while (line.length && line[line.length - 1].space) { w -= line.pop().w; } lines.push({ items: line, w }); line = []; w = 0; };
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.space && line.length === 0) continue;
    if (w + it.w > maxW && line.length) {
      const first = it.t[0];
      if (it.kind === 'text' && NO_START.includes(first)) {
        // 标点悬挂：允许超出一点
        line.push(it); w += it.w; push(); continue;
      }
      // 行末不能是开括号
      let carry = [];
      while (line.length && line[line.length - 1].kind === 'text' && NO_END.includes(line[line.length - 1].t)) { const c = line.pop(); w -= c.w; carry.unshift(c); }
      push();
      for (const c of carry) { line.push(c); w += c.w; }
    }
    line.push(it); w += it.w;
  }
  if (line.length) push();
  return lines;
}

export function drawRich(ctx, str, x, y, maxW, opts = {}) {
  const size = opts.size || 34;
  const lh = opts.lineH || size * 1.72;
  const lines = layoutRich(ctx, str, maxW, opts);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  let yy = y + size;
  for (const ln of lines) {
    let xx = x;
    if (opts.align === 'center') xx = x + (maxW - ln.w) / 2;
    // 两端对齐（最后一行除外）
    let extra = 0;
    if (opts.justify && ln !== lines[lines.length - 1] && ln.items.length > 1) extra = (maxW - ln.w) / (ln.items.length - 1);
    if (extra > size * 0.35) extra = 0;
    for (const it of ln.items) {
      if (it.kind === 'math') {
        drawMath(ctx, it.t, xx, yy, it.size, it.color);
      } else if (!it.space) {
        ctx.font = it.font; ctx.fillStyle = it.color;
        ctx.fillText(it.t, xx, yy);
        if (it.under) { ctx.fillRect(xx, yy + size * 0.18, it.w, Math.max(2, size * 0.06)); }
      }
      xx += it.w + extra;
    }
    yy += lh;
  }
  return y + lines.length * lh;
}

export function measureRich(ctx, str, maxW, opts = {}) {
  const size = opts.size || 34;
  const lh = opts.lineH || size * 1.72;
  return layoutRich(ctx, str, maxW, opts).length * lh;
}

// ---------- 公式 ----------
// 记法：变量自动斜体；'文字' 为正体；\frac{A}{B} 为分式；x_下标；空格分隔
const OPS = '=+−-×÷⇒≈·<>≤≥→';
function mathTokens(src) {
  const out = [];
  const re = /\\frac\{([^{}]*)\}\{([^{}]*)\}|'([^']*)'|√\(([^()]*)\)|([A-Za-zΔμαθωρ]+)(?:_([A-Za-z0-9一-鿿推合]+))?(?:\^([0-9]+))?|([0-9]+(?:\.[0-9]+)?)|([=+−\-×÷⇒≈·<>≤≥→])|([一-鿿，。：（）]+)|(\S)/gu;
  let m;
  while ((m = re.exec(src))) {
    if (m[1] != null) out.push({ k: 'frac', a: m[1], b: m[2] });
    else if (m[3] != null) out.push({ k: 'rom', t: m[3] });
    else if (m[4] != null) out.push({ k: 'sqrt', a: m[4] });
    else if (m[5] != null) out.push({ k: 'var', t: m[5], sub: m[6], sup: m[7] });
    else if (m[8] != null) out.push({ k: 'num', t: m[8] });
    else if (m[9] != null) out.push({ k: 'op', t: m[9] === '-' ? '−' : m[9] });
    else if (m[10] != null) out.push({ k: 'cjk', t: m[10] });
    else out.push({ k: 'rom', t: m[11] });
  }
  return out;
}

function mfont(kind, size) {
  if (kind === 'var') return `italic 500 ${size}px ${FONT.math}`;
  if (kind === 'cjk') return `400 ${size * 0.86}px ${FONT.serif}`;
  return `500 ${size}px ${FONT.math}`;
}

function layoutMath(ctx, src, size, draw, x, y, color) {
  const toks = mathTokens(src);
  let w = 0;
  const gap = size * 0.12;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (i > 0) w += gap;
    if (t.k === 'op') w += size * 0.22;
    if (t.k === 'frac') {
      const fs = size * 0.82;
      const wa = layoutMath(ctx, t.a, fs, false);
      const wb = layoutMath(ctx, t.b, fs, false);
      const fw = Math.max(wa, wb) + size * 0.25;
      if (draw) {
        layoutMath(ctx, t.a, fs, true, x + w + (fw - wa) / 2, y - size * 0.42, color);
        layoutMath(ctx, t.b, fs, true, x + w + (fw - wb) / 2, y + size * 0.56, color);
        ctx.fillStyle = color; ctx.fillRect(x + w, y - size * 0.3, fw, Math.max(2, size * 0.05));
      }
      w += fw;
    } else if (t.k === 'sqrt') {
      const wa = layoutMath(ctx, t.a, size, false);
      if (draw) {
        ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, size * 0.05);
        ctx.beginPath();
        ctx.moveTo(x + w, y - size * 0.3); ctx.lineTo(x + w + size * 0.15, y); ctx.lineTo(x + w + size * 0.35, y - size * 0.85); ctx.lineTo(x + w + size * 0.45 + wa, y - size * 0.85);
        ctx.stroke();
        layoutMath(ctx, t.a, size, true, x + w + size * 0.42, y, color);
      }
      w += wa + size * 0.5;
    } else {
      ctx.font = mfont(t.k, size);
      const tw = ctx.measureText(t.t).width;
      if (draw) { ctx.fillStyle = color; ctx.fillText(t.t, x + w, y); }
      w += tw;
      if (t.sub) {
        const ss = size * 0.6;
        ctx.font = /[一-鿿]/.test(t.sub) ? `400 ${ss}px ${FONT.serif}` : `500 ${ss}px ${FONT.math}`;
        const sw = ctx.measureText(t.sub).width;
        if (draw) { ctx.fillStyle = color; ctx.fillText(t.sub, x + w + size * 0.02, y + size * 0.22); }
        w += sw + size * 0.04;
      }
      if (t.sup) {
        const ss = size * 0.6;
        ctx.font = `500 ${ss}px ${FONT.math}`;
        const sw = ctx.measureText(t.sup).width;
        if (draw) { ctx.fillStyle = color; ctx.fillText(t.sup, x + w + size * 0.02, y - size * 0.42); }
        w += sw + size * 0.04;
      }
    }
    if (t.k === 'op') w += size * 0.22;
  }
  return w;
}

export function measureMath(ctx, src, size) { return layoutMath(ctx, src, size, false); }
export function drawMath(ctx, src, x, y, size, color = INK) { ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; return layoutMath(ctx, src, size, true, x, y, color); }

// 手写体多行（页边草稿）
export function drawHand(ctx, lines, x, y, size, color = '#3b3f63', rot = -0.03) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  let yy = 0;
  for (const ln of lines) {
    const isNum = /^[0-9A-Za-z=≈×.\s\-+/:()²√]+$/.test(ln);
    ctx.font = isNum ? `500 ${size * 1.12}px ${FONT.num}` : `400 ${size}px ${FONT.hand}`;
    ctx.fillText(ln, 0, yy);
    yy += size * 1.3;
  }
  ctx.restore();
  return y + yy;
}
