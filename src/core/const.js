// 书本尺寸（单位：厘米，场景单位 1 = 1 cm）
export const PAGE_W = 20;
export const PAGE_H = 27;
export const COVER_T = 0.32;   // 封面板厚度
export const STACK = 1.15;     // 每侧书页堆叠厚度
export const PAGE_Y = COVER_T + STACK; // 书页平坦处的高度
export const SPINE_GAP = 0.06;

// 书页画布（每厘米 75 像素）
export const CW = 1500;
export const CH = 2025;
export const PX = CW / PAGE_W;

// 书里用到的力，以及它们的颜色
export const FORCES = {
  G: { name: '重力', color: '#7b4cff', sym: 'G' },
  N: { name: '支持力', color: '#2f7fe8', sym: 'N' },
  F: { name: '拉力·推力', color: '#ff7a1a', sym: 'F' },
  f: { name: '摩擦力·阻力', color: '#e5403a', sym: 'f' },
  T: { name: '弹簧的弹力', color: '#d23aa6', sym: 'F' },
  D: { name: '空气阻力', color: '#10b2c6', sym: 'f' },
  net: { name: '合力', color: '#e9a800', sym: 'F' },
};

export const FONT = {
  serif: '"Noto Serif SC", "Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif',
  hand: '"Long Cang", "Kaiti SC", "STKaiti", "KaiTi", cursive',
  num: '"Caveat", "Long Cang", "Comic Sans MS", cursive',
  math: '"EB Garamond", "Times New Roman", "Noto Serif SC", serif',
};

export const INK = '#2f2c36';
export const PAPER = '#f5f3ec';
export const SEAL = '#c0392b';

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutBack = (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// 书页在离书脊 d 厘米处相对平坦处的高度偏移（书脊附近下凹）
export function pageProfile(d) {
  const t = 1 - smooth(0, 4.2, d);
  return -0.85 * t * t - 0.1 * smooth(PAGE_W - 1.6, PAGE_W, d);
}

export function fmt(x, digits = 2) {
  if (!isFinite(x)) return '—';
  const s = x.toFixed(digits);
  return s === '-0' + (digits ? '.' + '0'.repeat(digits) : '') ? s.slice(1) : s;
}
