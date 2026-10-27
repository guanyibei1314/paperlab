// 镜头：按"取景框"自动适配横竖屏，带临界阻尼过渡与用户微调
import * as THREE from 'three';
import { clamp } from './const.js';

const D2R = Math.PI / 180;

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.cur = { tx: 0, ty: 0, tz: 0, yaw: 0, pitch: 55, dist: 80, fov: 30 };
    this.vel = { tx: 0, ty: 0, tz: 0, yaw: 0, pitch: 0, dist: 0, fov: 0 };
    this.goal = { ...this.cur };
    this.user = { yaw: 0, pitch: 0, zoom: 1 };
    this.userGoal = { yaw: 0, pitch: 0, zoom: 1 };
    this.k = 3.2;
    this.shot = null;
    this.follow = null;
    this.dock = 0; this.vw = 1; this.vh = 1;
  }
  setViewport(w, h, dock) {
    const first = this.vw === 1;
    this.vw = w; this.vh = h; this.dockTarget = dock;
    if (first) this.dock = dock;
    this.applyView();
  }
  setDock(d) { this.dockTarget = d; }
  applyView() {
    const cam = this.camera, w = this.vw, h = this.vh, d = this.dock;
    cam.aspect = w / (h + d);
    cam.setViewOffset(w, h + d, 0, d, w, h);
    cam.updateProjectionMatrix();
    this.computeGoal();
  }
  // shot: { t:[x,y,z], yaw, pitch, size:[w,h], fov }
  setShot(shot, { instant = false, keepUser = false, speed = 3.2 } = {}) {
    this.shot = shot;
    this.k = speed;
    if (!keepUser) this.userGoal = { yaw: 0, pitch: 0, zoom: 1 };
    this.computeGoal();
    if (instant) {
      Object.assign(this.cur, this.goal);
      for (const k in this.vel) this.vel[k] = 0;
      this.user = { ...this.userGoal };
    }
  }
  computeGoal() {
    const s = this.shot; if (!s) return;
    const fov = s.fov || 30;
    // 底部导览条会挡住一部分画面：只在它上方的区域里取景
    const aspect = this.vw / (this.vh + this.dock);
    const frac = (this.vh - this.dock) / (this.vh + this.dock);
    const [w, h] = s.size;
    const tanV = Math.tan(fov * D2R / 2);
    const portrait = this.vw / this.vh < 0.85;
    const margin = portrait ? 1.04 : 1.08;
    const dh = (h / 2) / (tanV * frac);
    const dw = (w / 2) / (tanV * aspect);
    let dist = Math.max(dh, dw) * margin;
    if (portrait && s.portraitSize) {
      const [pw, ph] = s.portraitSize;
      dist = Math.max((ph / 2) / (tanV * frac), (pw / 2) / (tanV * aspect)) * margin;
    }
    const t = (portrait && s.pt) ? s.pt : s.t;
    this.goal = { tx: t[0], ty: t[1], tz: t[2], yaw: s.yaw || 0, pitch: s.pitch != null ? s.pitch : 55, dist, fov };
  }
  resize() { this.computeGoal(); }
  update(dt) {
    const k = this.k;
    dt = Math.min(dt, 0.05);
    if (this.dockTarget != null && Math.abs(this.dock - this.dockTarget) > 0.5) {
      this.dock += (this.dockTarget - this.dock) * (1 - Math.exp(-dt * 5));
      this.applyView();
    }
    for (const key in this.goal) {
      let g = this.goal[key];
      if (this.follow && (key === 'tx' || key === 'ty' || key === 'tz')) g = this.follow[key] != null ? this.follow[key] : g;
      const x = this.cur[key];
      let v = this.vel[key];
      v += (k * k * (g - x) - 2 * k * v) * dt;
      this.cur[key] = x + v * dt;
      this.vel[key] = v;
    }
    const uk = 1 - Math.exp(-dt * 6);
    for (const key in this.userGoal) this.user[key] += (this.userGoal[key] - this.user[key]) * uk;
    const c = this.cur;
    const yaw = (c.yaw + this.user.yaw) * D2R;
    const pitch = clamp(c.pitch + this.user.pitch, 8, 89) * D2R;
    const dist = c.dist * this.user.zoom;
    const cam = this.camera;
    cam.position.set(
      c.tx + Math.sin(yaw) * Math.cos(pitch) * dist,
      c.ty + Math.sin(pitch) * dist,
      c.tz + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    cam.lookAt(c.tx, c.ty, c.tz);
    if (Math.abs(cam.fov - c.fov) > 0.01) { cam.fov = c.fov; cam.updateProjectionMatrix(); }
  }
  nudge(dx, dy) {
    this.userGoal.yaw = clamp(this.userGoal.yaw - dx * 0.25, -70, 70);
    this.userGoal.pitch = clamp(this.userGoal.pitch + dy * 0.2, -40, 30);
  }
  zoom(f) { this.userGoal.zoom = clamp(this.userGoal.zoom * f, 0.35, 1.8); }
  resetUser() { this.userGoal = { yaw: 0, pitch: 0, zoom: 1 }; }
  isUserMoved() { return Math.abs(this.userGoal.yaw) > 1 || Math.abs(this.userGoal.pitch) > 1 || Math.abs(this.userGoal.zoom - 1) > 0.02; }
}
