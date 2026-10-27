// 书桌、桌垫、灯光（白天窗光 / 夜晚台灯）
import * as THREE from 'three';
import { litMat, canvasTex, SHARED } from './ink.js';

function woodTexture() {
  return canvasTex(2048, 1536, (ctx, W, H) => {
    const planks = 9;
    const ph = H / planks;
    let seed = 99;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < planks; i++) {
      const y0 = i * ph;
      const tone = 186 + rnd() * 14;
      ctx.fillStyle = `rgb(${tone + 16},${tone + 2},${tone - 22})`;
      ctx.fillRect(0, y0, W, ph);
      // 木纹
      for (let k = 0; k < 46; k++) {
        const yy = y0 + rnd() * ph;
        const amp = 2 + rnd() * 9; const freq = 0.002 + rnd() * 0.006; const ph0 = rnd() * 10;
        ctx.strokeStyle = `rgba(${120 + rnd() * 40},${95 + rnd() * 30},${70 + rnd() * 20},${0.05 + rnd() * 0.09})`;
        ctx.lineWidth = 0.6 + rnd() * 2.2;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 16) {
          const y = yy + Math.sin(x * freq + ph0) * amp + Math.sin(x * freq * 3.1 + ph0 * 2) * amp * 0.3;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // 接缝
      ctx.fillStyle = 'rgba(90,70,50,0.25)';
      ctx.fillRect(0, y0, W, 2);
      const seam = rnd() * W;
      ctx.fillRect(seam, y0, 2, ph);
    }
  });
}

function feltTexture() {
  return canvasTex(512, 512, (ctx, W, H) => {
    ctx.fillStyle = '#98ada2'; ctx.fillRect(0, 0, W, H);
    const img = ctx.getImageData(0, 0, W, H); const d = img.data;
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    ctx.putImageData(img, 0, 0);
  });
}

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function buildEnvironment(scene) {
  const wood = woodTexture();
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(320, 240), litMat({ map: wood }));
  desk.rotation.x = -Math.PI / 2;
  desk.position.y = -0.27;
  desk.receiveShadow = true;
  scene.add(desk);

  const felt = feltTexture();
  felt.wrapS = felt.wrapT = THREE.RepeatWrapping; felt.repeat.set(6, 4);
  const matGeo = new THREE.ExtrudeGeometry(roundedRectShape(96, 66, 3.2), { depth: 0.25, bevelEnabled: false, curveSegments: 12 });
  matGeo.rotateX(-Math.PI / 2);
  matGeo.translate(0, -0.27, 0);
  // 让纹理坐标按世界尺寸铺
  const uv = matGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 16, uv.getY(i) / 16);
  const mat = new THREE.Mesh(matGeo, litMat({ map: felt }));
  mat.receiveShadow = true;
  mat.position.set(0, 0, 1);
  scene.add(mat);

  const hemi = new THREE.HemisphereLight('#fdfbf6', '#b8ae9c', 2.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3df', 2.6);
  sun.position.set(-52, 92, -36);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -48; sc.right = 48; sc.top = 40; sc.bottom = -40; sc.near = 40; sc.far = 220;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);

  // 从读者这边来的一点补光，让朝前的牌子、表盘不至于发灰
  const fill = new THREE.DirectionalLight('#f3f1ff', 0.75);
  fill.position.set(10, 40, 90);
  scene.add(fill);

  scene.background = new THREE.Color('#d8d1c4');
  scene.fog = new THREE.Fog('#d8d1c4', 170, 380);

  const env = {
    desk, mat, hemi, sun, fill,
    setNight(n) {
      SHARED.uNight.value = n ? 1 : 0;
      SHARED.uCookie.value = n ? 0 : 1;
      if (n) {
        hemi.color.set('#9aa5c4'); hemi.groundColor.set('#3b3631'); hemi.intensity = 0.85;
        sun.color.set('#ffd49a'); sun.intensity = 2.6; sun.position.set(-24, 60, 20);
        fill.intensity = 0.35; fill.color.set('#c9d2ff');
        scene.background.set('#15161b'); scene.fog.color.set('#15161b');
      } else {
        hemi.color.set('#fdfbf6'); hemi.groundColor.set('#b8ae9c'); hemi.intensity = 2.5;
        sun.color.set('#fff3df'); sun.intensity = 2.6; sun.position.set(-52, 92, -36);
        fill.intensity = 0.75; fill.color.set('#f3f1ff');
        scene.background.set('#d8d1c4'); scene.fog.color.set('#d8d1c4');
      }
    },
  };
  return env;
}
