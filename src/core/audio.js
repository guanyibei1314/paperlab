// 合成音效（不需要任何音频文件）
export class Sfx {
  constructor() { this.ctx = null; this.on = true; this.master = null; this.loops = new Map(); }
  ensure() {
    if (this.ctx) return this.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
    return this.ctx;
  }
  unlock() { const c = this.ensure(); if (c && c.state === 'suspended') c.resume().catch(() => {}); }
  ok() { return this.on && this.ctx && this.ctx.state === 'running'; }
  noiseBurst({ dur = 0.3, f0 = 800, f1 = 3000, q = 0.8, gain = 0.4, type = 'bandpass', delay = 0 } = {}) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + dur * 0.15); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  tone({ f = 440, dur = 0.2, gain = 0.2, type = 'sine', delay = 0, f1 = null } = {}) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  page() { this.noiseBurst({ dur: 0.42, f0: 600, f1: 2600, q: 0.7, gain: 0.32 }); this.noiseBurst({ dur: 0.25, f0: 3000, f1: 1200, q: 1.2, gain: 0.12, delay: 0.3 }); }
  tick() { this.tone({ f: 1800, dur: 0.05, gain: 0.08, type: 'triangle' }); }
  pencil() { this.noiseBurst({ dur: 0.16, f0: 2500, f1: 5000, q: 2, gain: 0.12, type: 'bandpass' }); }
  flap() { this.noiseBurst({ dur: 0.25, f0: 900, f1: 2200, q: 0.9, gain: 0.22 }); }
  stamp() { this.tone({ f: 120, f1: 55, dur: 0.25, gain: 0.5 }); this.noiseBurst({ dur: 0.12, f0: 400, f1: 200, q: 0.6, gain: 0.3, type: 'lowpass' }); }
  clink(v = 1) { this.tone({ f: 2630, dur: 0.5, gain: 0.12 * v }); this.tone({ f: 4120, dur: 0.35, gain: 0.07 * v }); this.tone({ f: 5970, dur: 0.2, gain: 0.04 * v }); }
  thud(v = 1) { this.tone({ f: 160, f1: 70, dur: 0.18, gain: 0.35 * v }); this.noiseBurst({ dur: 0.08, f0: 500, f1: 300, q: 0.5, gain: 0.15 * v, type: 'lowpass' }); }
  whoosh(dur = 0.8) { this.noiseBurst({ dur, f0: 300, f1: 2500, q: 0.6, gain: 0.35 }); }
  spring() { this.tone({ f: 220, f1: 330, dur: 0.25, gain: 0.08, type: 'triangle' }); }
  success() { [523, 659, 784].forEach((f, i) => this.tone({ f, dur: 0.4, gain: 0.1, delay: i * 0.09, type: 'triangle' })); }
}
