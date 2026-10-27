// 立体书：封面、书页堆、两页画布、翻页动画、可掀开的"为什么"翻页
import * as THREE from 'three';
import { PAGE_W, PAGE_H, COVER_T, PAGE_Y, SPINE_GAP, CW, CH, PX, pageProfile, clamp, easeInOut, smooth, INK } from './const.js';
import { litMat, inkMat, edgeLines, canvasTex, paperFill } from './ink.js';

const SEG = 48;

function pageGeometry(side) {
  // side: +1 右页，-1 左页。u=0 在画布左边
  const g = new THREE.PlaneGeometry(PAGE_W, PAGE_H, SEG, 1);
  g.rotateX(-Math.PI / 2); // 平放，法线朝上；PlaneGeometry 的 v=1 在 -z（远端，页顶）
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const lx = p.getX(i) + PAGE_W / 2; // 0..W
    let x, d;
    if (side > 0) { x = SPINE_GAP + lx; d = lx; } else { x = -PAGE_W - SPINE_GAP + lx; d = PAGE_W - lx; }
    p.setX(i, x);
    p.setY(i, PAGE_Y + pageProfile(d));
  }
  g.computeVertexNormals();
  return g;
}

function stackGeometry(side) {
  const s = new THREE.Shape();
  const n = 40;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const d = 0.04 + (PAGE_W - 0.04) * (i / n);
    pts.push([d, PAGE_Y + pageProfile(d) - 0.025]);
  }
  s.moveTo(0.04, COVER_T);
  s.lineTo(PAGE_W, COVER_T);
  for (let i = n; i >= 0; i--) s.lineTo(pts[i][0], pts[i][1]);
  s.lineTo(0.04, COVER_T);
  const g = new THREE.ExtrudeGeometry(s, { depth: PAGE_H - 0.1, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -(PAGE_H - 0.1) / 2);
  if (side < 0) { g.scale(-1, 1, 1); g.computeVertexNormals(); }
  return g;
}

export class Book {
  constructor(scene, renderer) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.maxAniso = renderer.capabilities.getMaxAnisotropy();

    // 封面板
    const coverMat = litMat({ color: '#2f4470' });
    const boardW = PAGE_W + 0.55, boardH = PAGE_H + 0.9;
    for (const side of [-1, 1]) {
      const g = new THREE.BoxGeometry(boardW, COVER_T, boardH);
      g.translate(side * (boardW / 2 + 0.12), COVER_T / 2, 0);
      const m = new THREE.Mesh(g, coverMat);
      m.castShadow = true; m.receiveShadow = true;
      m.add(edgeLines(g, { overshoot: 0, width: 1.1, color: '#1d2540' }));
      this.group.add(m);
    }
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.8, COVER_T, boardH), coverMat);
    spine.position.y = COVER_T / 2 - 0.05; this.group.add(spine);
    // 金色压边
    const gild = litMat({ color: '#c9a44c' });
    for (const side of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.12, 0.02, boardH - 0.3);
      const m = new THREE.Mesh(g, gild);
      m.position.set(side * (boardW + 0.12 - 0.25), COVER_T + 0.01, 0);
      this.group.add(m);
    }

    // 书页堆
    const stackMat = inkMat({ color: '#eeebe2', hatch: 0.0, shade: 0.3, side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
      const g = stackGeometry(side);
      const m = new THREE.Mesh(g, stackMat);
      m.castShadow = true; m.receiveShadow = true;
      m.position.x = side * SPINE_GAP;
      // 页边细线
      const lines = [];
      for (let k = 1; k < 9; k++) {
        const y = COVER_T + (PAGE_Y - COVER_T) * (k / 9);
        const xo = side * (PAGE_W + SPINE_GAP);
        lines.push(xo, y, -PAGE_H / 2 + 0.05, xo, y, PAGE_H / 2 - 0.05);
        lines.push(side * 2, y, PAGE_H / 2 - 0.05, xo, y, PAGE_H / 2 - 0.05);
      }
      this.group.add(m);
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
      this.group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#b9b3a6', transparent: true, opacity: 0.8 })));
    }

    // 两页画布
    this.leftTex = this.makeTex();
    this.rightTex = this.makeTex();
    this.leftPage = new THREE.Mesh(pageGeometry(-1), litMat({ map: this.leftTex }));
    this.rightPage = new THREE.Mesh(pageGeometry(1), litMat({ map: this.rightTex }));
    for (const p of [this.leftPage, this.rightPage]) { p.receiveShadow = true; this.group.add(p); }
    this.leftPage.userData.side = -1; this.rightPage.userData.side = 1;

    // 翻页用的纸
    this.turnFront = this.makeTex();
    this.turnBack = this.makeTex();
    this.buildSheet();

    // 丝带书签
    this.buildRibbon();

    // "为什么"翻页
    this.flaps = [];
    this.turning = null;
  }

  makeTex() {
    const t = canvasTex(CW, CH);
    t.anisotropy = this.maxAniso;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }

  buildSheet() {
    const n = 40;
    const g = new THREE.PlaneGeometry(PAGE_W, PAGE_H, n, 1);
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    const backUv = new Float32Array(uv.count * 2);
    for (let i = 0; i < uv.count; i++) { backUv[i * 2] = 1 - uv.getX(i); backUv[i * 2 + 1] = uv.getY(i); }
    const gb = new THREE.BufferGeometry();
    gb.setAttribute('position', g.attributes.position);
    gb.setAttribute('normal', g.attributes.normal);
    gb.setAttribute('uv', new THREE.BufferAttribute(backUv, 2));
    gb.setIndex(g.index);
    this.sheetGeo = g; this.sheetGeoB = gb;
    this.sheetBase = [];
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) this.sheetBase.push({ s: p.getX(i) + PAGE_W / 2, z: p.getZ(i) });
    this.sheetF = new THREE.Mesh(g, litMat({ map: this.turnFront, side: THREE.FrontSide }));
    this.sheetB = new THREE.Mesh(gb, litMat({ map: this.turnBack, side: THREE.BackSide }));
    this.sheet = new THREE.Group();
    this.sheet.add(this.sheetF, this.sheetB);
    this.sheetF.castShadow = true; this.sheetB.castShadow = true;
    this.sheetF.receiveShadow = true; this.sheetB.receiveShadow = true;
    this.sheet.visible = false;
    this.group.add(this.sheet);
  }

  shapeSheet(t) {
    const p = this.sheetGeo.attributes.position;
    const c = 0.5;
    const cols = 41;
    // 先按列积分
    const xs = new Float32Array(cols), ys = new Float32Array(cols), phis = new Float32Array(cols);
    let x = SPINE_GAP * (1 - 2 * t), y = PAGE_Y;
    const ds = PAGE_W / (cols - 1);
    for (let i = 0; i < cols; i++) {
      const s = i * ds;
      const a = clamp(t * (1 + c) - c * (1 - s / PAGE_W), 0, 1);
      phis[i] = Math.PI * easeInOut(a);
    }
    for (let i = 0; i < cols; i++) {
      if (i > 0) {
        const phi = (phis[i] + phis[i - 1]) / 2;
        x += Math.cos(phi) * ds; y += Math.sin(phi) * ds;
      }
      const s = i * ds;
      const cs = Math.cos(phis[i]);
      xs[i] = x; ys[i] = y + pageProfile(s) * cs * cs + 0.035 + 0.25 * Math.sin(Math.PI * t) * (s / PAGE_W);
    }
    for (let i = 0; i < p.count; i++) {
      const b = this.sheetBase[i];
      const col = Math.round(b.s / ds);
      p.setXYZ(i, xs[col], ys[col], b.z);
    }
    p.needsUpdate = true;
    this.sheetGeo.computeVertexNormals();
    this.sheetGeo.attributes.normal.needsUpdate = true;
  }

  // 翻页：dir=+1 向后翻（右→左），-1 向前翻
  // drawNew(leftCtx?, rightCtx?) 由调用方提供
  turn(dir, { drawOldFront, drawNewBack, onSwapStatic, onDone, duration = 1.25 }) {
    // dir>0: 正面 = 旧右页，背面 = 新左页；静态右页立刻换成新右页
    // dir<0: 正面 = 新右页，背面 = 旧左页；静态左页立刻换成新左页
    drawOldFront(this.turnFront.userData.ctx); this.turnFront.needsUpdate = true;
    drawNewBack(this.turnBack.userData.ctx); this.turnBack.needsUpdate = true;
    onSwapStatic();
    this.sheet.visible = true;
    this.turning = { dir, t: 0, duration, onDone };
    this.shapeSheet(dir > 0 ? 0 : 1);
  }

  update(dt) {
    if (this.turning) {
      const tr = this.turning;
      tr.t += dt / tr.duration;
      const k = clamp(tr.t, 0, 1);
      this.shapeSheet(tr.dir > 0 ? k : 1 - k);
      if (tr.t >= 1) {
        this.sheet.visible = false;
        this.turning = null;
        tr.onDone && tr.onDone();
      }
    }
    for (const f of this.flaps) f.update(dt);
  }

  buildRibbon() {
    const H2 = PAGE_H / 2;
    const pts = [
      new THREE.Vector3(0.28, PAGE_Y - 0.82, H2 - 2.2),
      new THREE.Vector3(0.32, PAGE_Y - 0.82, H2 - 0.3),
      new THREE.Vector3(0.36, PAGE_Y - 0.8, H2 + 0.12),
      new THREE.Vector3(0.45, PAGE_Y - 1.0, H2 + 0.5),
      new THREE.Vector3(0.55, 0.42, H2 + 0.85),
      new THREE.Vector3(0.7, 0.07, H2 + 1.6),
      new THREE.Vector3(1.1, 0.06, H2 + 3.2),
      new THREE.Vector3(1.4, 0.06, H2 + 4.6),
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const w = 0.62;
    const pos = [], idx = [];
    const N = 60;
    for (let i = 0; i <= N; i++) {
      const p = curve.getPoint(i / N);
      pos.push(p.x - w / 2, p.y, p.z, p.x + w / 2, p.y, p.z);
      if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, litMat({ color: '#9b2c22', side: THREE.DoubleSide }));
    m.castShadow = true; m.receiveShadow = true;
    this.group.add(m);
  }

  // 画布坐标 → 世界坐标
  toWorld(side, cx, cy, lift = 0) {
    const lx = cx / PX;
    const z = -PAGE_H / 2 + cy / PX;
    if (side > 0) return new THREE.Vector3(SPINE_GAP + lx, PAGE_Y + pageProfile(lx) + lift, z);
    return new THREE.Vector3(-PAGE_W - SPINE_GAP + lx, PAGE_Y + pageProfile(PAGE_W - lx) + lift, z);
  }

  pick(raycaster) {
    const objs = [this.leftPage, this.rightPage, ...this.flaps.map(f => f.mesh)];
    const hits = raycaster.intersectObjects(objs, false);
    if (!hits.length) return null;
    const h = hits[0];
    if (h.object.userData.flap) return { flap: h.object.userData.flap, point: h.point };
    if (!h.uv) return null;
    return { side: h.object.userData.side, x: h.uv.x * CW, y: (1 - h.uv.y) * CH, point: h.point };
  }
}

// 可掀开的纸片："为什么？掀开看答案"
export class Flap {
  constructor(book, side, rect, drawFront) {
    // rect: 画布坐标 {x,y,w,h}，铰链在上边
    this.book = book; this.side = side; this.rect = rect;
    const w = rect.w / PX, h = rect.h / PX;
    this.tex = canvasTex(Math.round(rect.w), Math.round(rect.h));
    this.tex.anisotropy = book.maxAniso;
    this.drawFront = drawFront;
    const g = new THREE.BoxGeometry(w, 0.02, h);
    g.translate(0, 0, h / 2); // 铰链在上边
    const face = litMat({ map: this.tex });
    const back = litMat({ color: '#ece8dc' });
    this.backTex = canvasTex(Math.round(rect.w), Math.round(rect.h), (c, W, H) => {
      c.fillStyle = '#ebe6d9'; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(47,44,54,0.5)'; c.lineWidth = 2; c.strokeRect(1, 1, W - 2, H - 2);
      c.save(); c.translate(W / 2, H / 2);
      c.fillStyle = '#6b6672'; c.font = `400 30px "Noto Serif SC", serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('（再点一下，合上翻页）', 0, 0);
      c.restore();
    });
    const backFace = litMat({ map: this.backTex });
    this.mesh = new THREE.Mesh(g, [back, back, face, backFace, back, back]);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.add(edgeLines(g, { overshoot: 0, width: 1.0 }));
    this.mesh.userData.flap = this;
    this.pivot = new THREE.Group();
    const p = book.toWorld(side, rect.x + rect.w / 2, rect.y, 0.03);
    this.pivot.position.copy(p);
    this.pivot.add(this.mesh);
    book.group.add(this.pivot);
    this.open = 0; this.target = 0;
    this.redraw();
    book.flaps.push(this);
  }
  redraw(state) {
    const ctx = this.tex.userData.ctx;
    this.drawFront(ctx, this.rect.w, this.rect.h, state);
    this.tex.needsUpdate = true;
  }
  toggle(v) { this.target = v != null ? (v ? 1 : 0) : (this.target ? 0 : 1); return this.target; }
  update(dt) {
    const k = 1 - Math.exp(-dt * 6);
    this.open += (this.target - this.open) * k;
    // 掀开时向上翻过去约 155°，盖在上面的预测区
    this.pivot.rotation.x = -this.open * 2.7;
    this.pivot.position.y = this.book.toWorld(this.side, this.rect.x + this.rect.w / 2, this.rect.y, 0.03).y + this.open * 0.08;
  }
  dispose() {
    this.book.group.remove(this.pivot);
    this.tex.dispose(); this.backTex.dispose();
    this.book.flaps = this.book.flaps.filter(f => f !== this);
  }
}
