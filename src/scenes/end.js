// 尾声：牛顿摆（每次碰撞，两球之间的力大小相等、方向相反）
import * as THREE from 'three';
import { box, cyl, sphere, inkMat, polyLine } from '../core/ink.js';
import { FORCES, clamp } from '../core/const.js';
import { forceArrow, v3, label3d } from './common.js';
import { FONT } from '../core/const.js';

const N = 5, R = 0.85, L = 6.6, GL = 980 * 0.012; // g/L 取得让摆动看起来自然
export function build(ctx) {
  const root = new THREE.Group();
  const app = new THREE.Group(); root.add(app);
  const Z = -8.6, TOP = 10.6, W = 11;
  const base = box(W + 1.6, 0.6, 5.0, { ink: { color: '#e2ddd2' } }); base.position.set(0, 0, Z); app.add(base);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = cyl(0.17, 0.17, TOP - 0.6, { ink: { color: '#dcd7cd', uv: [4, 12] }, seg: 10 });
    post.position.set(sx * W / 2, 0.6, Z + sz * 2.0); app.add(post);
  }
  for (const sz of [-1, 1]) {
    const bar = cyl(0.15, 0.15, W, { ink: { color: '#dcd7cd', uv: [10, 2] }, seg: 10, base: false });
    bar.rotation.z = Math.PI / 2; bar.position.set(0, TOP, Z + sz * 2.0); app.add(bar);
  }
  const balls = [], strings = [];
  const x0 = [];
  for (let i = 0; i < N; i++) {
    const b = sphere(R, { ink: { color: '#e9e6df', scale: 0.12 }, seg: 32 });
    app.add(b); balls.push(b);
    x0.push((i - (N - 1) / 2) * (2 * R + 0.004));
    const s = polyLine([v3(0, 0, 0), v3(0, 0, 0), v3(0, 0, 0)], { width: 1.1, color: '#4a4550' });
    app.add(s); strings.push(s);
  }
  const hint = label3d('按住一个球，向旁边拖起来再松手', { w: 10, h: 1.0, font: FONT.hand, color: '#26407a' });
  hint.position.set(0, TOP + 1.4, Z); hint.userData.noPop = true; hint.userData.keepVisible = true; root.add(hint);
  const aA = forceArrow('F', { scale: 1, width: 0.12, labelSide: 1 });
  const aB = forceArrow('F', { scale: 1, width: 0.12, labelSide: -1 });
  root.add(aA.group, aB.group);

  const th = new Array(N).fill(0), om = new Array(N).fill(0);
  let held = -1, holdAngle = 0, flash = 0, flashX = 0, flashY = 0;
  function xOf(i) { return x0[i] + L * Math.sin(th[i]); }
  function layout() {
    for (let i = 0; i < N; i++) {
      const x = xOf(i), y = TOP - L * Math.cos(th[i]);
      balls[i].position.set(x, y, Z);
      const px = x0[i];
      strings[i].geometry.setPositions([px, TOP, Z - 2.0, x, y + R * 0.9, Z, x, y + R * 0.9, Z, px, TOP, Z + 2.0]);
    }
  }
  function lift(k, ang) {
    // 拉起最左边的 k 个球
    for (let i = 0; i < N; i++) { th[i] = i < k ? -ang : 0; om[i] = 0; }
  }
  layout();
  const rt = {
    root,
    steps: [
      { cap: '最后玩一下牛顿摆：拉起一个球再松手，另一头的球会弹出去。', shot: ctx.shot(0, 7, -7.5, { pitch: 22, w: 17, h: 12 }), dur: 7, enter: () => lift(1, 0.7) },
      { cap: '拉起两个球：另一头也飞出两个。每次碰撞，两球之间的力大小相等、方向相反。', shot: ctx.shot(0, 7, -7.5, { pitch: 22, w: 17, h: 12 }), dur: 8, enter: () => lift(2, 0.6) },
      { cap: '轮到你：按住一个球拖起来，松手。翻回目录可以重温任何一课。', shot: ctx.shot(0, 5, -3, { pitch: 38, w: 22, h: 24, pw: 20, ph: 28 }), interactive: true },
    ],
    pickables: [{
      obj: app, cursor: 'grab',
      down: (hit) => {
        const lp = hit.point.clone(); root.worldToLocal(lp);
        let best = 0, bd = 1e9; for (let i = 0; i < N; i++) { const d = Math.abs(xOf(i) - lp.x); if (d < bd) { bd = d; best = i; } }
        held = best;
      },
      move: (ray) => {
        if (held < 0) return;
        const p = new THREE.Vector3();
        if (!ray.intersectPlane(new THREE.Plane(v3(0, 0, 1), -(Z + ctx.R0.z)), p)) return;
        const lx = p.x - ctx.R0.x, ly = p.y - ctx.R0.y;
        let ang = Math.atan2(lx - x0[held], TOP - ly);
        ang = clamp(ang, -1.1, 1.1);
        // 往外拉：带动这一侧的其他球一起抬起
        if (ang < 0) { for (let i = 0; i < N; i++) { th[i] = i <= held ? ang : 0; om[i] = 0; } }
        else { for (let i = 0; i < N; i++) { th[i] = i >= held ? ang : 0; om[i] = 0; } }
      },
      up: () => { held = -1; },
    }],
    update(dt) {
      if (held < 0) {
        const sub = 40, h = dt / sub;
        for (let s = 0; s < sub; s++) {
          for (let i = 0; i < N; i++) { om[i] += -GL * Math.sin(th[i]) * h - om[i] * 0.02 * h; th[i] += om[i] * h; }
          // 相邻两球的碰撞（等质量，恢复系数 0.995）
          for (let it = 0; it < N; it++) {
            let any = false;
            for (let i = 0; i < N - 1; i++) {
              const gap = xOf(i + 1) - xOf(i) - 2 * R;
              const v1 = om[i] * L * Math.cos(th[i]), v2 = om[i + 1] * L * Math.cos(th[i + 1]);
              if (gap <= 0.002 && v1 > v2) {
                const e = 0.995, vm = (v1 + v2) / 2, d = (v1 - v2) / 2;
                const n1 = vm - e * d, n2 = vm + e * d;
                om[i] = n1 / (L * Math.cos(th[i])); om[i + 1] = n2 / (L * Math.cos(th[i + 1]));
                any = true;
                const imp = Math.abs(n2 - v2);
                if (imp > 2) { flash = 0.35; flashX = (xOf(i) + xOf(i + 1)) / 2; flashY = TOP - L; if (imp > 6) ctx.sfx.clink(Math.min(1, imp / 40)); }
              }
            }
            if (!any) break;
          }
        }
      }
      layout();
      flash = Math.max(0, flash - dt);
      const risen = ctx.risen() > 0.98;
      if (risen && flash > 0) {
        const k = flash / 0.35 * 2.0;
        aA.set(v3(flashX + 0.1, flashY + R + 1.2, Z), v3(k, 0, 0), '');
        aB.set(v3(flashX - 0.1, flashY + R + 1.2, Z), v3(-k, 0, 0), '');
      } else { aA.group.visible = aB.group.visible = false; }
      hint.visible = risen && ctx.stepIndex() >= 3;
      if (hint.visible) hint.quaternion.copy(ctx.camera.quaternion);
    },
    onControl() {},
    dispose() { aA.dispose(); aB.dispose(); },
  };
  return rt;
}
