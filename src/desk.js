// desk.js — a real-feeling place to build: a wooden desk with a lamp, a mug and a pencil
// cup, against a warm wall. The desk top sits just under the building plate (y = -0.3),
// so everything you do happens ON the desk instead of floating in space.
import * as THREE from 'three';

let woodTex = null;
function woodTexture() {
  if (woodTex) return woodTex;
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = '#b5804f'; x.fillRect(0, 0, 1024, 1024);
  // planks
  for (let p = 0; p < 4; p++) {
    const y0 = p * 256;
    const tone = [0, 10, -8, 5][p];
    x.fillStyle = `rgb(${181 + tone},${128 + tone},${79 + tone})`; x.fillRect(0, y0, 1024, 256);
    // grain lines
    for (let i = 0; i < 90; i++) {
      const yy = y0 + Math.random() * 256;
      x.strokeStyle = `rgba(${90 + Math.random() * 40},${55 + Math.random() * 25},${25},${0.08 + Math.random() * 0.14})`;
      x.lineWidth = 1 + Math.random() * 2.5;
      x.beginPath(); x.moveTo(0, yy);
      for (let xx = 0; xx <= 1024; xx += 64) x.lineTo(xx, yy + Math.sin(xx / (80 + i) + i) * (2 + Math.random() * 3));
      x.stroke();
    }
    // a knot or two
    for (let k = 0; k < 2; k++) {
      const kx = Math.random() * 1024, ky = y0 + 40 + Math.random() * 170;
      for (let r = 18; r > 2; r -= 3) { x.strokeStyle = `rgba(90,52,22,${0.12 + (18 - r) * 0.01})`; x.beginPath(); x.ellipse(kx, ky, r * 2.2, r, 0, 0, Math.PI * 2); x.stroke(); }
    }
    x.fillStyle = 'rgba(60,32,12,0.55)'; x.fillRect(0, y0, 1024, 3);
  }
  woodTex = new THREE.CanvasTexture(c);
  woodTex.colorSpace = THREE.SRGBColorSpace;
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
  woodTex.anisotropy = 8;
  return woodTex;
}

const TOP_Y = -0.3;        // desk surface height (the plate's underside)

/**
 * Add a desk centred under (cx, cz). w/d = desk top size in studs.
 * Returns a group; call group.userData.dispose() to remove it.
 */
export function makeDesk(cx, cz, w, d, { lamp = true, props = true, mat = null } = {}) {
  const g = new THREE.Group();
  const disposables = [];
  const tex = woodTexture().clone(); tex.needsUpdate = true;
  tex.repeat.set(w / 40, d / 40);
  const wood = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.7 });
  disposables.push(tex, wood, darkWood);
  const T = 2.4;
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, T, d), [darkWood, darkWood, wood, darkWood, darkWood, darkWood]);
  top.position.set(cx, TOP_Y - T / 2, cz);
  top.receiveShadow = true; top.castShadow = true;
  g.add(top);
  disposables.push(top.geometry);
  // legs and floor
  const legH = 30;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(2.6, legH, 2.6), darkWood);
    leg.position.set(cx + sx * (w / 2 - 3), TOP_Y - T - legH / 2, cz + sz * (d / 2 - 3));
    g.add(leg); disposables.push(leg.geometry);
  }
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4c, roughness: 0.85 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w * 6, d * 6), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, TOP_Y - T - legH, cz);
  floor.receiveShadow = true;
  g.add(floor); disposables.push(floor.geometry, floorMat);
  // wall behind the desk
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe9dfd1, roughness: 0.95 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(w * 6, 140), wallMat);
  wall.position.set(cx, TOP_Y - T - legH + 70, cz - d / 2 - 6);
  wall.receiveShadow = true;
  g.add(wall); disposables.push(wall.geometry, wallMat);
  const skirting = new THREE.Mesh(new THREE.BoxGeometry(w * 6, 3, 0.6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
  skirting.position.set(cx, TOP_Y - T - legH + 1.5, cz - d / 2 - 5.7);
  g.add(skirting); disposables.push(skirting.geometry, skirting.material);

  const backX = cx + w / 2 - 7, backZ = cz - d / 2 + 6;
  if (lamp) {
    // desk lamp in the back corner, with a warm glow
    const metal = new THREE.MeshStandardMaterial({ color: 0x2e3a59, roughness: 0.35, metalness: 0.4 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.7, 28), metal);
    base.position.set(backX, TOP_Y + 0.35, backZ);
    const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 11, 10), metal);
    arm1.position.set(backX - 1.2, TOP_Y + 6, backZ + 0.5); arm1.rotation.z = 0.25;
    const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9, 10), metal);
    arm2.position.set(backX - 5.2, TOP_Y + 12.4, backZ + 1.4); arm2.rotation.z = 1.15;
    const head = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3.6, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0xe3342f, roughness: 0.4, side: THREE.DoubleSide }));
    head.position.set(backX - 9.2, TOP_Y + 13, backZ + 2.2); head.rotation.z = -0.6;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff1c4 }));
    bulb.position.set(backX - 9.9, TOP_Y + 11.9, backZ + 2.2);
    const light = new THREE.PointLight(0xffd8a0, 60, 45, 1.6);
    light.position.copy(bulb.position);
    for (const m of [base, arm1, arm2, head]) { m.castShadow = true; g.add(m); disposables.push(m.geometry); }
    g.add(bulb, light);
    disposables.push(metal, head.material, bulb.geometry, bulb.material);
  }
  if (props) {
    // a mug of tea and a pencil cup on the left
    const mx = cx - w / 2 + 6, mz = cz - d / 2 + 7;
    const mugMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4 });
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.5, 3.6, 28, 1, true), mugMat);
    mug.position.set(mx, TOP_Y + 1.8, mz);
    const mugBottom = new THREE.Mesh(new THREE.CircleGeometry(1.5, 28), mugMat); mugBottom.rotation.x = -Math.PI / 2; mugBottom.position.set(mx, TOP_Y + 0.02, mz);
    const tea = new THREE.Mesh(new THREE.CircleGeometry(1.5, 28), new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.2 }));
    tea.rotation.x = -Math.PI / 2; tea.position.set(mx, TOP_Y + 3.0, mz);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.22, 10, 20), mugMat);
    handle.position.set(mx + 1.9, TOP_Y + 1.9, mz);
    const cupMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 3.4, 20), cupMat);
    cup.position.set(mx + 5, TOP_Y + 1.7, mz - 1);
    const pencils = [];
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 6, 6), new THREE.MeshStandardMaterial({ color: [0xe3342f, 0x22c55e, 0x3b82f6][i] }));
      p.position.set(mx + 5 + (i - 1) * 0.5, TOP_Y + 4.2, mz - 1 + (i % 2) * 0.4); p.rotation.z = (i - 1) * 0.15;
      pencils.push(p);
    }
    for (const m of [mug, mugBottom, tea, handle, cup, ...pencils]) { m.castShadow = true; g.add(m); disposables.push(m.geometry, m.material); }
  }
  if (mat) {
    // green self-healing cutting mat with a stud grid, under the building plate
    const mc = document.createElement('canvas'); mc.width = 1024; mc.height = 1024;
    const mx = mc.getContext('2d');
    mx.fillStyle = '#2e6b52'; mx.fillRect(0, 0, 1024, 1024);
    const cells = Math.max(mat.w, mat.d), step = 1024 / cells;
    for (let i = 0; i <= cells; i++) {
      mx.strokeStyle = i % 5 === 0 ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.12)';
      mx.lineWidth = i % 5 === 0 ? 2.2 : 1;
      mx.beginPath(); mx.moveTo(i * step, 0); mx.lineTo(i * step, 1024); mx.stroke();
      mx.beginPath(); mx.moveTo(0, i * step); mx.lineTo(1024, i * step); mx.stroke();
    }
    mx.fillStyle = 'rgba(255,255,255,0.5)'; mx.font = '600 20px system-ui, sans-serif';
    for (let i = 0; i <= cells; i += 5) { mx.fillText(String(i), i * step + 3, 20); mx.fillText(String(i), 3, i * step - 3); }
    const mt = new THREE.CanvasTexture(mc); mt.colorSpace = THREE.SRGBColorSpace; mt.anisotropy = 8;
    const mm = new THREE.MeshStandardMaterial({ map: mt, roughness: 0.85 });
    const side = new THREE.MeshStandardMaterial({ color: 0x24563f, roughness: 0.85 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(mat.w, 0.12, mat.d), [side, side, mm, side, side, side]);
    m.position.set(mat.x + mat.w / 2, TOP_Y + 0.02, mat.z + mat.d / 2);
    m.receiveShadow = true;
    g.add(m); disposables.push(mt, mm, side, m.geometry);
  }
  // a sunny window and a framed picture on the wall
  const wallZ = cz - d / 2 - 5.9, floorY = TOP_Y - T - legH;
  const sky = document.createElement('canvas'); sky.width = 256; sky.height = 256;
  const sx = sky.getContext('2d');
  const sg = sx.createLinearGradient(0, 0, 0, 256); sg.addColorStop(0, '#5aa9f0'); sg.addColorStop(0.75, '#cfe8ff'); sg.addColorStop(1, '#eaf6ff');
  sx.fillStyle = sg; sx.fillRect(0, 0, 256, 256);
  sx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [x0, y0, r] of [[60, 70, 22], [84, 62, 28], [110, 72, 20], [180, 120, 18], [200, 112, 24], [222, 122, 16]]) { sx.beginPath(); sx.arc(x0, y0, r, 0, Math.PI * 2); sx.fill(); }
  sx.fillStyle = '#6fbf6a'; sx.beginPath(); sx.ellipse(70, 262, 120, 40, 0, 0, Math.PI * 2); sx.fill(); sx.beginPath(); sx.ellipse(210, 266, 110, 34, 0, 0, Math.PI * 2); sx.fill();
  const skyTex = new THREE.CanvasTexture(sky); skyTex.colorSpace = THREE.SRGBColorSpace;
  const winW = Math.min(46, w * 0.45), winH = 30;
  const win = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), new THREE.MeshBasicMaterial({ map: skyTex }));
  win.position.set(cx - w * 0.22, TOP_Y + 26, wallZ + 0.02);
  win.userData.noAO = true;
  g.add(win); disposables.push(skyTex, win.geometry, win.material);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  for (const [fw, fh, fx, fy] of [[winW + 2, 1.2, 0, winH / 2 + 0.6], [winW + 2, 1.6, 0, -winH / 2 - 0.8], [1.2, winH, -winW / 2 - 0.6, 0], [1.2, winH, winW / 2 + 0.6, 0], [0.6, winH, 0, 0], [winW, 0.6, 0, 0]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.8), frameMat);
    f.position.set(win.position.x + fx, win.position.y + fy, wallZ + 0.4); f.castShadow = true;
    g.add(f); disposables.push(f.geometry);
  }
  disposables.push(frameMat);
  // picture frame with a brick-art print
  const art = document.createElement('canvas'); art.width = 200; art.height = 260;
  const ax = art.getContext('2d');
  ax.fillStyle = '#fdf6e8'; ax.fillRect(0, 0, 200, 260);
  const brickCols = ['#e3342f', '#f7c51e', '#1f5bbf', '#2b8a3e', '#ef7d1a', '#f4f4f0'];
  for (let r = 0; r < 7; r++) for (let c = 0; c < 4; c++) { if ((r + c) % 3 === 0) continue; ax.fillStyle = brickCols[(r * 3 + c) % 6]; ax.fillRect(24 + c * 38 + (r % 2) * 10, 24 + r * 30, 34, 26); }
  const artTex = new THREE.CanvasTexture(art); artTex.colorSpace = THREE.SRGBColorSpace;
  const pic = new THREE.Mesh(new THREE.BoxGeometry(11, 14.3, 0.6), [frameMat, frameMat, frameMat, frameMat, new THREE.MeshStandardMaterial({ map: artTex, roughness: 0.6 }), frameMat]);
  pic.position.set(cx + w * 0.22, TOP_Y + 24, wallZ + 0.3); pic.castShadow = true;
  g.add(pic); disposables.push(artTex, pic.geometry, pic.material[4]);
  if (props) {
    // potted plant at the back left
    const px = cx - w / 2 + 6, pz = cz - d / 2 + 16;
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 1.6, 3.6, 24), new THREE.MeshStandardMaterial({ color: 0xc8643c, roughness: 0.8 }));
    pot.position.set(px, TOP_Y + 1.8, pz); pot.castShadow = true;
    g.add(pot); disposables.push(pot.geometry, pot.material);
    const leaf = new THREE.MeshStandardMaterial({ color: 0x3f9d4a, roughness: 0.6 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const l = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 8), leaf);
      l.scale.set(0.5, 1.6, 1);
      l.position.set(px + Math.cos(a) * 1.2, TOP_Y + 5 + (i % 3) * 0.8, pz + Math.sin(a) * 1.2);
      l.rotation.set(Math.sin(a) * 0.6, a, Math.cos(a) * 0.6);
      l.castShadow = true;
      g.add(l); disposables.push(l.geometry);
    }
    disposables.push(leaf);
  }
  void floorY;
  g.userData.dispose = () => { [...new Set(disposables)].forEach(d => d.dispose && d.dispose()); };
  g.userData.topY = TOP_Y;
  return g;
}

export const DESK_TOP_Y = TOP_Y;

/** Warm room colours for desk scenes. */
export function deskAtmosphere(scene) {
  scene.background = new THREE.Color('#d8cbb8');
  scene.fog = new THREE.Fog('#d8cbb8', 140, 320);
}
