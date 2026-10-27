// 铅笔排线 + 墨线 材质与基本几何体
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { INK, FONT, clamp } from './const.js';

export const SHARED = {
  uCookie: { value: 1 },
  uNight: { value: 0 },
  uLamp: { value: new THREE.Vector3(-6, 0, 2) },
  uInk: { value: new THREE.Color(INK) },
  uTime: { value: 0 },
  uRes: { value: new THREE.Vector2(1600, 900) },
};

const COOKIE_GLSL = /* glsl */`
uniform float uCookie;
uniform float uNight;
uniform vec3 uLamp;
uniform vec3 uInk;
uniform float uTime;
varying vec3 vWP;
varying vec3 vWN;
varying vec2 vHUv;
float lightCookie(vec3 wp){
  vec3 L = normalize(vec3(-0.62, 1.0, -0.42));
  vec2 p = wp.xz - L.xz / L.y * wp.y;
  float a = 0.5;
  mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
  vec2 q = R * (p - vec2(-4.0, -8.0));
  vec2 cell = vec2(34.0, 44.0);
  vec2 g = abs(fract(q / cell + 0.5) - 0.5) * cell;
  float pane = smoothstep(cell.x * 0.5 - 0.6, cell.x * 0.5 - 2.6, g.x) * smoothstep(cell.y * 0.5 - 0.6, cell.y * 0.5 - 2.6, g.y);
  float win = smoothstep(80.0, 46.0, length(q * vec2(0.9, 0.7)));
  // 树叶般柔和的斑驳
  float leaf = 0.5 + 0.5 * sin(q.x * 0.21 + sin(q.y * 0.17) * 2.0) * sin(q.y * 0.13 + 1.3);
  return pane * win * mix(0.82, 1.0, leaf);
}
float lightFactor(vec3 wp){
  float day = mix(0.88, 1.07, lightCookie(wp));
  float pool = 1.0 - smoothstep(20.0, 80.0, length(wp.xz - uLamp.xz));
  float night = 0.30 + 0.85 * pool;
  return mix(mix(1.0, day, uCookie), night, uNight);
}
`;

const HATCH_GLSL = /* glsl */`
uniform float uHatch;
uniform float uHScale;
uniform float uHMode;
uniform vec2 uUvScale;
uniform float uFlat;
float hline(float d, float w){
  float fw = fwidth(d);
  float dist = abs(fract(d) - 0.5);
  float c = 1.0 - smoothstep(w * 0.5 - fw, w * 0.5 + fw, dist);
  return mix(c, w, smoothstep(0.35, 0.8, fw));
}
float hatchAt(vec2 p, float s){
  float w1 = clamp((0.93 - s) * 0.70, 0.0, 0.40);
  float w2 = clamp((0.66 - s) * 0.85, 0.0, 0.42);
  float w3 = clamp((0.40 - s) * 0.90, 0.0, 0.42);
  float k = 1.0 / uHScale;
  float wob = 0.10 * sin(p.y * 2.3 + p.x * 0.9) + 0.06 * sin(p.x * 5.1);
  float d1 = (p.x + p.y) * 0.7071 * k + wob;
  float d2 = (p.x - p.y) * 0.7071 * k * 1.13 - wob;
  float d3 = p.y * k * 1.4 + 0.5;
  float h = hline(d1, w1);
  h = max(h, hline(d2, w2) * 0.9);
  h = max(h, hline(d3, w3) * 0.85);
  return h;
}
`;

const VERT_INJECT = (sh) => {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;\nvarying vec2 vHUv;')
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\n vWN = normalize(mat3(modelMatrix) * objectNormal);\n vHUv = uv;');
};

const matCache = new Map();

// 排线墨水材质：根据光照明暗自动加铅笔排线
export function inkMat(opts = {}) {
  const o = Object.assign({ color: '#ffffff', hatch: 1, scale: 0.2, mode: 'tri', uv: [12, 12], opacity: 1, side: THREE.FrontSide, shade: 0.22, offset: true }, opts);
  const key = JSON.stringify(o);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshLambertMaterial({ color: o.color, transparent: o.opacity < 1, opacity: o.opacity, side: o.side });
  if (o.offset) { m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 1; }
  const uni = {
    uHatch: { value: o.hatch }, uHScale: { value: o.scale }, uHMode: { value: o.mode === 'uv' ? 1 : 0 },
    uUvScale: { value: new THREE.Vector2(o.uv[0], o.uv[1]) }, uFlat: { value: o.shade },
  };
  m.userData.uni = uni;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, SHARED, uni);
    VERT_INJECT(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + COOKIE_GLSL + HATCH_GLSL)
      .replace('#include <opaque_fragment>', /* glsl */`
        float lf = lightFactor(vWP);
        vec3 lit = outgoingLight * lf;
        float s = clamp(dot(lit, vec3(0.299, 0.587, 0.114)) / max(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 0.001), 0.0, 1.3);
        float h = 0.0;
        if (uHMode > 0.5) {
          h = hatchAt(vHUv * uUvScale, s);
        } else {
          vec3 n = normalize(vWN);
          vec3 an = pow(abs(n), vec3(4.0));
          an /= (an.x + an.y + an.z + 1e-5);
          h = an.x * hatchAt(vWP.zy, s) + an.y * hatchAt(vWP.xz, s) + an.z * hatchAt(vWP.xy, s);
        }
        vec3 base = diffuseColor.rgb * mix(1.0, (0.62 + 0.38 * clamp(s, 0.0, 1.1)), uFlat * 2.6);
        base *= mix(1.0, 0.55 + 0.45 * lf, uNight);
        vec3 col = mix(base, uInk, clamp(h * 0.82 * uHatch, 0.0, 1.0));
        gl_FragColor = vec4(col, diffuseColor.a);
      `);
  };
  m.customProgramCacheKey = () => 'ink';
  matCache.set(key, m);
  return m;
}

// 纸张/木头等写实表面：保留光照，只加窗光
export function litMat(params = {}) {
  const m = new THREE.MeshLambertMaterial(params);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, SHARED);
    VERT_INJECT(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + COOKIE_GLSL)
      .replace('#include <opaque_fragment>', /* glsl */`
        vec3 lit = outgoingLight * lightFactor(vWP);
        gl_FragColor = vec4(lit, diffuseColor.a);
      `);
  };
  m.customProgramCacheKey = () => 'lit';
  return m;
}

// ---------- 墨线 ----------
const lineMats = new Map();
export function lineMat(width = 1.35, color = INK, opacity = 1, dashed = false) {
  const key = width + color + opacity + dashed;
  if (lineMats.has(key)) return lineMats.get(key);
  const m = new LineMaterial({ color, linewidth: width, transparent: opacity < 1, opacity, dashed, dashSize: 0.35, gapSize: 0.25, depthWrite: opacity >= 1 });
  lineMats.set(key, m);
  return m;
}
export function allLineMats() { return [...lineMats.values()]; }

// 由几何体生成带"出头"的草图线
export function edgeLines(geometry, { threshold = 28, overshoot = 0.06, width = 1.35, color = INK, opacity = 1 } = {}) {
  const eg = new THREE.EdgesGeometry(geometry, threshold);
  const p = eg.attributes.position.array;
  const out = new Float32Array(p.length);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < p.length; i += 6) {
    a.set(p[i], p[i + 1], p[i + 2]); b.set(p[i + 3], p[i + 4], p[i + 5]);
    d.subVectors(b, a); const len = d.length();
    if (overshoot > 0 && len > 0.6) {
      d.multiplyScalar(Math.min(0.22, len * overshoot) / len);
      a.sub(d); b.add(d);
    }
    out.set([a.x, a.y, a.z, b.x, b.y, b.z], i);
  }
  eg.dispose();
  const g = new LineSegmentsGeometry();
  g.setPositions(out);
  const l = new LineSegments2(g, lineMat(width, color, opacity));
  l.userData.isInkLine = true;
  return l;
}

export function polyLine(points, { width = 1.3, color = INK, opacity = 1, dashed = false, closed = false } = {}) {
  const arr = [];
  const n = points.length;
  for (let i = 0; i < n - (closed ? 0 : 1); i++) {
    const a = points[i], b = points[(i + 1) % n];
    arr.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const g = new LineSegmentsGeometry();
  g.setPositions(arr);
  const l = new LineSegments2(g, lineMat(width, color, opacity, dashed));
  if (dashed) l.computeLineDistances();
  l.userData.isInkLine = true;
  return l;
}

// 轮廓外壳（反面外扩），用于圆柱、球等光滑物体的外轮廓
const hullMats = new Map();
export function hullMat(width = 1.6, color = INK) {
  const key = width + color;
  if (hullMats.has(key)) return hullMats.get(key);
  const m = new THREE.ShaderMaterial({
    uniforms: { uWidth: { value: width }, uRes: SHARED.uRes, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */`
      uniform float uWidth; uniform vec2 uRes;
      void main(){
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec3 vn = normalize(normalMatrix * normal);
        vec4 cn = projectionMatrix * vec4(vn, 0.0);
        vec2 n2 = cn.xy; float l = length(n2);
        if (l > 1e-5) n2 /= l;
        clip.xy += n2 * uWidth * clip.w * 2.0 / uRes;
        gl_Position = clip;
      }`,
    fragmentShader: /* glsl */`uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, 1.0); }`,
    side: THREE.BackSide,
  });
  hullMats.set(key, m);
  return m;
}
export function allHullMats() { return [...hullMats.values()]; }

export function addHull(mesh, width = 1.6) {
  let g = mesh.geometry;
  if (!g.userData.smooth) {
    const tmp = g.clone();
    tmp.deleteAttribute('uv');
    if (tmp.attributes.uv1) tmp.deleteAttribute('uv1');
    const merged = mergeVertices(tmp, 1e-4);
    merged.computeVertexNormals();
    g.userData.smooth = merged;
  }
  const h = new THREE.Mesh(g.userData.smooth, hullMat(width));
  h.userData.isHull = true;
  h.raycast = () => {};
  mesh.add(h);
  return h;
}

// 统一：给网格加上墨线与阴影
export function inkify(mesh, { edges = true, hull = false, threshold = 28, overshoot = 0.06, lineWidth = 1.35, hullWidth = 1.5, cast = true, receive = true } = {}) {
  mesh.castShadow = cast; mesh.receiveShadow = receive;
  if (edges) { const l = edgeLines(mesh.geometry, { threshold, overshoot, width: lineWidth }); l.raycast = () => {}; mesh.add(l); }
  if (hull) addHull(mesh, hullWidth);
  return mesh;
}

// ---------- 常用几何体 ----------
export function box(w, h, d, opts = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (opts.base !== false) g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, opts.mat || inkMat(opts.ink));
  return inkify(m, opts);
}
export function cyl(rt, rb, h, opts = {}) {
  const g = new THREE.CylinderGeometry(rt, rb, h, opts.seg || 40, 1, !!opts.open);
  if (opts.base !== false) g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, opts.mat || inkMat(Object.assign({ mode: 'uv', uv: [Math.max(4, Math.round(rt * 30)), Math.max(2, Math.round(h * 4))] }, opts.ink)));
  return inkify(m, Object.assign({ hull: true, threshold: 40 }, opts));
}
export function sphere(r, opts = {}) {
  const g = new THREE.SphereGeometry(r, opts.seg || 32, Math.max(12, (opts.seg || 32) / 2));
  const m = new THREE.Mesh(g, opts.mat || inkMat(opts.ink));
  return inkify(m, Object.assign({ edges: false, hull: true }, opts));
}
export function extrude(shape, depth, opts = {}) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: opts.curveSegments || 24 });
  g.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(g, opts.mat || inkMat(opts.ink));
  return inkify(m, Object.assign({ threshold: 30 }, opts));
}
export function tube(curve, radius, opts = {}) {
  const g = new THREE.TubeGeometry(curve, opts.segs || 200, radius, opts.radial || 10, !!opts.closed);
  const m = new THREE.Mesh(g, opts.mat || inkMat(Object.assign({ mode: 'uv', uv: [opts.uvLen || 80, 3] }, opts.ink)));
  return inkify(m, Object.assign({ edges: false, hull: true, hullWidth: 1.2 }, opts));
}

// 玻璃：边缘发暗形成轮廓
export function glassMat(tint = '#eef3f6', opacity = 0.16) {
  return new THREE.ShaderMaterial({
    uniforms: { uTint: { value: new THREE.Color(tint) }, uInk: SHARED.uInk, uOp: { value: opacity } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vP = position;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTint; uniform vec3 uInk; uniform float uOp;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float rim = smoothstep(0.72, 0.97, f);
        float streak = smoothstep(0.08, 0.0, abs(f - 0.45)) * 0.35;
        vec3 col = mix(uTint, uInk, rim * 0.9);
        col = mix(col, vec3(1.0), streak);
        float a = uOp + rim * 0.75 + streak * 0.4;
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.95));
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

// ---------- 画布纹理工具 ----------
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (draw) draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.userData.ctx = ctx;
  return t;
}

export function paperFill(ctx, w, h, base = '#f6f4ee', grain = 0.035) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 255 * grain;
    d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9;
  }
  ctx.putImageData(img, 0, 0);
}

// ---------- 力的箭头 ----------
const arrowGeo = (() => {
  const shaft = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true); shaft.translate(0, 0.5, 0);
  const head = new THREE.ConeGeometry(1, 1, 18); head.translate(0, 0.5, 0);
  return { shaft, head };
})();

function flowMat(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: SHARED.uTime, uLen: { value: 1 }, uAlpha: { value: 1 } },
    vertexShader: /* glsl */`
      varying vec2 vUv2; varying vec3 vN; varying vec3 vV;
      void main(){
        vUv2 = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uTime; uniform float uLen; uniform float uAlpha;
      varying vec2 vUv2; varying vec3 vN; varying vec3 vV;
      void main(){
        float along = vUv2.y * uLen;
        float band = smoothstep(0.35, 0.0, abs(fract(along * 0.55 - uTime * 0.9) - 0.5) - 0.12);
        float f = abs(dot(normalize(vN), normalize(vV)));
        vec3 col = uColor * (0.78 + 0.32 * f) + band * 0.38;
        col = mix(col, vec3(1.0), pow(f, 6.0) * 0.35);
        gl_FragColor = vec4(col, uAlpha);
      }`,
    transparent: true,
  });
}

let glowTex = null;
function getGlowTex() {
  if (glowTex) return glowTex;
  glowTex = canvasTex(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  });
  return glowTex;
}

export class ForceArrow {
  constructor(color, { width = 0.22, label = '', labelSide = 1, glow = true, scale = 1, minLen = 0.05 } = {}) {
    this.color = color;
    this.group = new THREE.Group();
    this.width = width;
    this.scale = scale; // 厘米/牛
    this.minLen = minLen;
    this.mat = flowMat(color);
    this.headMat = new THREE.MeshBasicMaterial({ color, transparent: true });
    this.shaft = new THREE.Mesh(arrowGeo.shaft, this.mat);
    this.head = new THREE.Mesh(arrowGeo.head, this.headMat);
    this.holder = new THREE.Group();
    this.holder.add(this.shaft, this.head);
    const hs = addHull(this.shaft, 1.1); const hh = addHull(this.head, 1.1);
    hs.material = hh.material = hullMat(1.1);
    this.group.add(this.holder);
    if (glow) {
      this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTex(), color, transparent: true, opacity: 0.32, depthWrite: false }));
      this.group.add(this.glow);
    }
    this.labelText = label;
    this.labelSide = labelSide;
    if (label !== null) {
      this.tag = new Tag(color);
      this.group.add(this.tag.sprite);
    }
    this.group.traverse(o => { o.raycast = () => {}; });
    this._last = '';
    this.dir = new THREE.Vector3(0, 1, 0);
    this.len = 0;
  }
  // origin: 箭尾位置；vec: 力（牛）
  set(origin, vec, valueText) {
    const mag = vec.length();
    const L = mag * this.scale;
    this.len = L;
    if (L < this.minLen) { this.group.visible = false; return; }
    this.group.visible = true;
    this.group.position.copy(origin);
    this.dir.copy(vec).normalize();
    this.holder.quaternion.setFromUnitVectors(_up, this.dir);
    const headL = Math.min(L * 0.5, this.width * 4.2);
    const shaftL = Math.max(0.001, L - headL);
    this.shaft.scale.set(this.width, shaftL, this.width);
    this.head.position.y = shaftL;
    this.head.scale.set(this.width * 2.3, headL, this.width * 2.3);
    this.mat.uniforms.uLen.value = shaftL;
    if (this.glow) {
      this.glow.position.copy(this.dir).multiplyScalar(L * 0.5);
      const s = Math.max(1.2, L * 1.25);
      this.glow.scale.set(s, s, 1);
    }
    if (this.tag) {
      const txt = valueText != null ? valueText : this.labelText;
      if (txt !== this._last) { this.tag.draw(txt); this._last = txt; }
      // 标签放在箭头旁边
      const side = new THREE.Vector3().crossVectors(this.dir, _camRight).normalize();
      if (side.lengthSq() < 0.01) side.set(1, 0, 0);
      this.tag.sprite.position.copy(this.dir).multiplyScalar(L * 0.62).addScaledVector(_camRight, this.labelSide * (this.tag.w * 0.5 + this.width * 3));
      this.tag.sprite.visible = !!txt;
    }
  }
  setOpacity(a) {
    this.mat.uniforms.uAlpha.value = a; this.headMat.opacity = a;
    if (this.glow) this.glow.material.opacity = 0.32 * a;
  }
  dispose() {
    this.mat.dispose(); this.headMat.dispose();
    if (this.glow) this.glow.material.dispose();
    if (this.tag) this.tag.dispose();
  }
}
const _up = new THREE.Vector3(0, 1, 0);
export const _camRight = new THREE.Vector3(1, 0, 0);

// 小标签（始终朝向镜头）：手写数值
export class Tag {
  constructor(color = INK, { w = 2.7, h = 1.0, size = 64 } = {}) {
    this.color = color; this.w = w; this.h = h; this.size = size;
    this.tex = canvasTex(320, Math.round(320 * h / w));
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthTest: true, depthWrite: false }));
    this.sprite.scale.set(w, h, 1);
    this.sprite.renderOrder = 5;
    this.sprite.raycast = () => {};
  }
  draw(text) {
    const ctx = this.tex.userData.ctx; const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (!text) { this.tex.needsUpdate = true; return; }
    ctx.font = `600 ${Math.round(H * 0.62)}px ${FONT.num}`;
    const tw = Math.min(W - 8, ctx.measureText(text).width + 34);
    const x0 = (W - tw) / 2;
    ctx.fillStyle = 'rgba(250,248,242,0.94)';
    roundRect(ctx, x0, H * 0.1, tw, H * 0.8, 10); ctx.fill();
    ctx.strokeStyle = this.color; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = this.color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, H * 0.53, W - 20);
    this.tex.needsUpdate = true;
  }
  dispose() { this.tex.dispose(); this.sprite.material.dispose(); }
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// 立着的卡片（像参考里的读数牌）
export class Card {
  constructor({ w = 5, h = 3.2, px = 110, stand = true, tilt = -12 } = {}) {
    this.w = w; this.h = h;
    this.tex = canvasTex(Math.round(w * px), Math.round(h * px));
    const face = litMat({ map: this.tex });
    const side = litMat({ color: '#efece4' });
    const g = new THREE.BoxGeometry(w, h, 0.07);
    this.mesh = new THREE.Mesh(g, [side, side, side, side, face, side]);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    const l = edgeLines(g, { overshoot: 0.03, width: 1.2 }); this.mesh.add(l);
    this.group = new THREE.Group();
    this.inner = new THREE.Group();
    this.inner.add(this.mesh);
    this.mesh.position.y = h / 2 + (stand ? 0.35 : 0);
    this.inner.rotation.x = tilt * Math.PI / 180;
    this.group.add(this.inner);
    if (stand) {
      const leg = box(0.25, 0.4, 0.25, { ink: { hatch: 0.6 } });
      leg.position.set(-w * 0.3, 0, 0); this.inner.add(leg);
      const leg2 = leg.clone(); leg2.position.x = w * 0.3; this.inner.add(leg2);
    }
    this.group.traverse(o => { o.raycast = () => {}; });
    this._key = '';
  }
  // spec: { title, value, unit, note, color, lines:[...] }
  draw(spec) {
    const key = JSON.stringify(spec);
    if (key === this._key) return;
    this._key = key;
    const ctx = this.tex.userData.ctx; const W = ctx.canvas.width, H = ctx.canvas.height;
    paperFill(ctx, W, H, '#f7f5ef', 0.03);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(10, 10, W - 20, H - 20);
    ctx.lineWidth = 1.2; ctx.strokeRect(18, 18, W - 36, H - 36);
    const pad = 34;
    let y = pad + 6;
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    if (spec.title) {
      ctx.fillStyle = spec.color || INK;
      ctx.font = `700 ${Math.round(H * 0.14)}px ${FONT.serif}`;
      ctx.fillText(spec.title, pad, y, W - pad * 2);
      if (spec.icon) { ctx.fillStyle = spec.color; ctx.fillRect(W - pad - H * 0.12, y + 4, H * 0.12, H * 0.12); }
      y += H * 0.2;
    }
    if (spec.value != null) {
      ctx.fillStyle = spec.valueColor || '#20305a';
      ctx.font = `600 ${Math.round(H * (spec.big || 0.36))}px ${FONT.num}`;
      ctx.fillText(spec.value, pad, y - H * 0.02, W - pad * 2);
      y += H * (spec.big || 0.36) * 1.02;
    }
    if (spec.lines) {
      ctx.fillStyle = INK;
      const fs = Math.round(H * (spec.lineSize || 0.11));
      for (const ln of spec.lines) {
        if (typeof ln === 'object') {
          ctx.font = `${ln.w || 400} ${Math.round(fs * (ln.s || 1))}px ${ln.hand ? FONT.num : FONT.serif}`;
          ctx.fillStyle = ln.c || INK;
          ctx.fillText(ln.t, pad, y, W - pad * 2);
          y += fs * (ln.s || 1) * 1.45;
        } else {
          ctx.font = `400 ${fs}px ${FONT.serif}`;
          ctx.fillStyle = INK;
          ctx.fillText(ln, pad, y, W - pad * 2);
          y += fs * 1.45;
        }
      }
    }
    if (spec.note) {
      ctx.fillStyle = '#4b4752';
      ctx.font = `italic 400 ${Math.round(H * 0.095)}px ${FONT.serif}`;
      ctx.fillText(spec.note, pad, H - pad - H * 0.1, W - pad * 2);
    }
    if (spec.custom) spec.custom(ctx, W, H);
    this.tex.needsUpdate = true;
  }
  dispose() { this.tex.dispose(); }
}

// 频闪"残影"：只保留淡淡的线条
const ghostFace = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.0, depthWrite: false });
function cloneLight(o) {
  const ud = o.userData; o.userData = {};
  const c = o.clone(false);
  o.userData = ud;
  c.userData = { isInkLine: !!ud.isInkLine, isHull: !!ud.isHull };
  for (const ch of o.children) c.add(cloneLight(ch));
  return c;
}
export function ghostOf(obj, opacity = 0.45) {
  const g = cloneLight(obj);
  const lm = lineMat(1.1, INK, opacity);
  g.traverse(o => {
    if (o.userData.isInkLine) o.material = lm;
    else if (o.userData.isHull) o.visible = false;
    else if (o.isMesh) { o.material = ghostFace; o.castShadow = false; }
    o.raycast = () => {};
  });
  return g;
}

export function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose();
  });
}
