// sorting.js — open a numbered bag on the desk and sort its pieces.
// Tear the bag open (click or drag), the pieces tumble out onto the desk with simple
// physics, then click pieces to drop them into colour trays — or let "Sort for me" do it.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeStudioScene, fitShadow } from './engine.js';
import { partGeometry } from './geometry.js';
import { MATERIALS, threeColor } from './brickRenderer.js';
import { PART_BY_ID, COLOR_BY_ID, isTransColor, PLATE_H } from './parts.js';
import { makeDesk, deskAtmosphere, DESK_TOP_Y } from './desk.js';
import { bagsOf } from './bags.js';
import { el, clear, toast } from './ui.js';

const G = 32;                      // gravity (studs / s²)
const TABLE = DESK_TOP_Y;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();

function bagTexture(n, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 320;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,0.0)'; x.fillRect(0, 0, 256, 320);
  x.fillStyle = color; x.beginPath(); x.arc(128, 150, 74, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#fff'; x.font = '900 110px system-ui, Segoe UI, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), 128, 156);
  x.fillStyle = 'rgba(30,40,80,0.8)'; x.font = '800 26px system-ui, Segoe UI, sans-serif'; x.fillText('BrickVerse', 128, 270);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function labelTexture(text, hex) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#fffaf0'; x.fillRect(0, 0, 256, 64);
  x.fillStyle = hex; x.fillRect(0, 0, 56, 64);
  x.fillStyle = '#1b2440'; x.font = '800 26px system-ui, Segoe UI, sans-serif'; x.textBaseline = 'middle'; x.fillText(text, 68, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Sorting {
  constructor(game) {
    this.g = game;
    this.el = document.getElementById('screen-sorting');
    const st = makeStudioScene();
    this.scene = st.scene; this.key = st.key;
    deskAtmosphere(this.scene);
    st.floor.visible = false;
    this.desk = makeDesk(0, 2, 84, 52);
    this.scene.add(this.desk);
    fitShadow(this.key, { minX: -30, maxX: 30, minZ: -20, maxZ: 24, minY: 0, maxY: 20 }, 2048);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 600);
    this.controls = new OrbitControls(this.camera, game.engine.canvas);
    this.controls.mouseButtons = { LEFT: -1, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
    this.controls.enableDamping = true; this.controls.maxPolarAngle = Math.PI * 0.45; this.controls.minDistance = 12; this.controls.maxDistance = 90;
    this.controls.enabled = false;
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.stage = { scene: this.scene, camera: this.camera, update: dt => this.update(dt) };
    // overlay UI
    this.title = el('div', { class: 'sort-title panel' });
    this.prompt = el('div', { class: 'open-prompt' });
    this.bar = el('div', { class: 'sort-bar panel' });
    this.backBtn = el('button', { class: 'btn ghost back-btn', text: '← Back', onclick: () => this.g.show('collection') });
    this.el.append(this.title, this.prompt, this.bar, this.backBtn);
    const canvas = game.engine.canvas;
    this.ray = new THREE.Raycaster(); this.ndc = new THREE.Vector2();
    canvas.addEventListener('pointermove', e => { if (this.active) this.onMove(e); });
    canvas.addEventListener('pointerdown', e => { if (this.active && e.button === 0) this.down = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointerup', e => { if (this.active && e.button === 0 && this.down) { const d = Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]); this.down = null; if (d < 6) this.onClick(e); } });
  }

  async enter(params) {
    const set = this.g.setById(params.setId);
    const own = set && this.g.ownership(set.id);
    if (!own) { toast('You need to own that set first.', 'error'); return this.g.show('store'); }
    this.set = set; this.own = own;
    const bags = bagsOf(set);
    this.bagIndex = Math.max(0, Math.min(bags.length - 1, params.bag ?? 0));
    this.bag = bags[this.bagIndex];
    this.active = true;
    this.g.engine.setStage(this.stage);
    this.controls.enabled = true;
    this.camera.position.set(0, 30, 52);
    this.controls.target.set(0, -1, 3);
    this.controls.update();
    this.build();
  }
  leave() { this.active = false; this.controls.enabled = false; this.clearScene(); return true; }

  clearScene() {
    for (const c of [...this.root.children]) { this.root.remove(c); if (c.isInstancedMesh) c.dispose(); }
    (this.disposables || []).forEach(d => d.dispose && d.dispose());
    this.disposables = [];
    this.pieces = []; this.meshes = []; this.trays = [];
  }

  build() {
    this.clearScene();
    const set = this.set;
    this.phase = 'bag';
    this.t = 0;
    this.doneShown = false;
    this.bagHalves = null;
    // trays: one per colour in this bag (the 7 most common), plus a mixed tray
    const counts = new Map();
    for (const i of this.bag.pieces) { const c = set.bricks[i].c; counts.set(c, (counts.get(c) || 0) + 1); }
    const order = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
    const trayColors = order.length > 8 ? [...order.slice(0, 7), '*'] : order;
    const nT = trayColors.length;
    const TW = 7.2, gap = 0.8;
    const total = nT * TW + (nT - 1) * gap;
    this.trays = trayColors.map((c, i) => {
      const x = -total / 2 + TW / 2 + i * (TW + gap);
      const z = 15;
      const hex = c === '*' ? '#c9ced6' : COLOR_BY_ID[c].hex;
      const tint = new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), 0.55);
      const mat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.5 });
      const g = new THREE.Group();
      const floor = new THREE.Mesh(new THREE.BoxGeometry(TW, 0.3, 6), mat); floor.position.y = 0.15;
      g.add(floor);
      for (const [w, d, px, pz] of [[TW, 0.3, 0, -2.85], [TW, 0.3, 0, 2.85], [0.3, 6, -TW / 2 + 0.15, 0], [0.3, 6, TW / 2 - 0.15, 0]]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 1.3, d), mat); wall.position.set(px, 0.65, pz); wall.castShadow = true; g.add(wall);
        this.disposables.push(wall.geometry);
      }
      const lt = labelTexture(c === '*' ? 'Mixed' : COLOR_BY_ID[c].name, hex);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: lt }));
      label.position.set(0, 0.7, 3.02);
      g.add(label);
      g.position.set(x, TABLE, z);
      g.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
      this.root.add(g);
      this.disposables.push(mat, floor.geometry, lt, label.geometry, label.material);
      return { color: c, x, z, count: 0, group: g, width: TW };
    });
    // the bag
    const bagN = this.bagIndex + 1;
    const tex = bagTexture(bagN, ['#e3342f', '#2f7bf5', '#22a35a', '#f59e0b', '#9b4dff', '#ef4444', '#14b8a6', '#ec4899'][this.bagIndex % 8]);
    const bagMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 0.15, transmission: 0, clearcoat: 1 });
    const decal = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const bag = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(9, 11, 2.6, 4, 4, 1), bagMat);
    const pos = body.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { const zz = pos.getZ(i), yy = pos.getY(i), xx = pos.getX(i); pos.setZ(i, zz * (1 - Math.pow(Math.abs(yy) / 5.5, 3) * 0.7) * (1 - Math.pow(Math.abs(xx) / 4.5, 4) * 0.4)); }
    body.geometry.computeVertexNormals();
    const seal = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.5, 0.4), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
    seal.position.y = 5.3;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(6, 7.5), decal); front.position.set(0, 0, 1.36);
    bag.add(body, seal, front);
    // a peek at the pieces inside the bag
    const inside = new THREE.Group();
    for (let k = 0; k < Math.min(14, this.bag.pieces.length); k++) {
      const b = set.bricks[this.bag.pieces[k * Math.floor(this.bag.pieces.length / Math.min(14, this.bag.pieces.length))] || this.bag.pieces[k]];
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: threeColor(b.c) }));
      m.position.set((Math.random() - 0.5) * 6, -4 + Math.random() * 5, (Math.random() - 0.5) * 0.8);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      inside.add(m); this.disposables.push(m.geometry, m.material);
    }
    bag.add(inside);
    bag.position.set(0, TABLE + 1.4, -2);
    bag.rotation.x = -1.05;
    bag.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.root.add(bag);
    this.bagObj = bag;
    this.disposables.push(tex, bagMat, decal, body.geometry, seal.geometry, seal.material, front.geometry);
    // the pieces themselves (drawn with instancing; positions update every frame)
    this.pieces = this.bag.pieces.map(i => {
      const b = set.bricks[i];
      const tray = this.trays.find(t => t.color === b.c) || this.trays[this.trays.length - 1];
      return { b: { ...b, x: 0, y: 0, z: 0, r: 0 }, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), ang: new THREE.Vector3(), state: 'bag', tray, scale: 1 };
    });
    this.buildMeshes();
    this.renderUi();
  }

  buildMeshes() {
    const groups = new Map();
    this.pieces.forEach((p, idx) => {
      partGeometry(p.b.t, 1).forEach((sub, si) => {
        const cid = sub.color === 'own' ? p.b.c : sub.color;
        const trans = isTransColor(cid);
        const k = p.b.t + '|' + si + '|' + (trans ? 1 : 0);
        if (!groups.has(k)) groups.set(k, { geo: sub.geo, trans, items: [] });
        groups.get(k).items.push({ idx, cid });
      });
    });
    this.meshes = [];
    for (const g of groups.values()) {
      const m = new THREE.InstancedMesh(g.geo, g.trans ? MATERIALS.trans : MATERIALS.opaque, g.items.length);
      m.castShadow = !g.trans; m.receiveShadow = true;
      g.items.forEach((it, i) => m.setColorAt(i, threeColor(it.cid)));
      m.userData.items = g.items;
      m.frustumCulled = false;
      m.visible = false;
      this.root.add(m);
      this.meshes.push(m);
    }
  }

  // ------------------------------------------------------------------ UI
  renderUi() {
    const bags = bagsOf(this.set);
    clear(this.title).append(el('b', { text: `🛍️ Bag ${this.bagIndex + 1} of ${bags.length}` }), el('span', { class: 'muted', text: ` — ${this.set.name} • ${this.bag.pieces.length} pieces for steps ${this.bag.firstStep + 1}–${this.bag.lastStep + 1}` }));
    clear(this.prompt);
    const bar = clear(this.bar);
    if (this.phase === 'bag') {
      this.prompt.append(el('b', { text: 'Click or drag the bag to tear it open!' }), el('span', { class: 'muted', text: 'The pieces will tumble out onto your desk.' }));
      this.prompt.classList.add('show');
      bar.append(el('button', { class: 'btn ghost', text: 'Skip sorting', onclick: () => { this.markOpen(); this.goBuild(); } }));
      return;
    }
    this.prompt.classList.remove('show');
    const sorted = this.pieces.filter(p => p.state === 'sorted').length;
    const n = this.pieces.length;
    this.progressEl = el('span', { class: 'sort-count', text: `${sorted} / ${n} sorted` });
    if (sorted < n) {
      bar.append(el('span', { class: 'muted', text: 'Click a piece to drop it in its colour tray' }), this.progressEl,
        el('button', { class: 'btn', text: '✨ Sort for me', onclick: () => this.sortAll() }),
        el('button', { class: 'btn ghost', text: 'Build now', onclick: () => this.goBuild() }));
    } else {
      bar.append(el('b', { text: '✨ All sorted! Everything is ready.' }),
        el('button', { class: 'btn primary big', text: `🔨 Build steps ${this.bag.firstStep + 1}–${this.bag.lastStep + 1}`, onclick: () => this.goBuild() }));
    }
  }

  markOpen() {
    const own = this.own;
    if (own.state === 'unopened') own.state = 'opened';
    own.bags = Math.max(typeof own.bags === 'number' ? own.bags : 0, this.bagIndex + 1);
    this.g.requestSave(true);
  }
  goBuild() { this.g.show('studio', { setId: this.set.id }); }

  // ------------------------------------------------------------------ interaction
  setNdc(e) {
    const r = this.g.engine.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
  }
  pickPiece() {
    const hits = this.ray.intersectObjects(this.meshes, false);
    for (const h of hits) { const it = h.object.userData.items[h.instanceId]; const p = it && this.pieces[it.idx]; if (p && p.state === 'rest') return p; }
    // forgiving: nearest resting piece to the ray
    let best = null, bd = 1.2;
    for (const p of this.pieces) if (p.state === 'rest') { const d = this.ray.ray.distanceToPoint(p.pos); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  onMove(e) {
    this.setNdc(e);
    if (this.phase === 'bag' && this.down && this.down[1] - e.clientY > 30) { this.down = null; this.tear(); return; }
    if (this.phase !== 'spill') return;
    const p = this.pickPiece();
    for (const q of this.pieces) q.hover = q === p;
    this.g.engine.canvas.style.cursor = p ? 'pointer' : '';
  }
  onClick(e) {
    this.setNdc(e);
    if (this.phase === 'bag') { this.tear(); return; }
    const p = this.pickPiece();
    if (p) this.flyToTray(p);
  }

  tear() {
    if (this.phase !== 'bag') return;
    this.phase = 'spill'; this.t = 0;
    this.markOpen();
    this.g.audio.play('tear');
    setTimeout(() => this.g.audio.play('clatter'), 250);
    setTimeout(() => this.g.audio.play('clatter'), 520);
    // the bag rips into two halves that fall away
    const bag = this.bagObj;
    this.bagHalves = [-1, 1].map(side => ({ side, v: new THREE.Vector3(side * 6, 7, -2), spin: side * 3 }));
    // pieces burst out of the opening
    const origin = bag.position.clone().add(new THREE.Vector3(0, 1.5, 3));
    const n = this.pieces.length;
    this.pieces.forEach((p, i) => {
      p.state = 'fall';
      p.delay = (i / n) * 0.5;
      p.pos.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 1.5, (Math.random() - 0.5) * 2));
      const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 9;
      p.vel.set(Math.cos(a) * sp, 6 + Math.random() * 8, Math.sin(a) * sp * 0.7 + 2.5);
      p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      p.ang.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16);
    });
    for (const m of this.meshes) m.visible = true;
    this.renderUi();
  }

  flyToTray(p) {
    if (p.state !== 'rest') return;
    const t = p.tray;
    const slot = t.count++;
    const per = 12, col = slot % 4, row = Math.floor(slot / 4) % 3, layer = Math.floor(slot / per);
    // (layers stack up as a little pile)
    p.from = p.pos.clone();
    p.to = new THREE.Vector3(t.x - t.width / 2 + 1.1 + col * ((t.width - 2.2) / 3), TABLE + 0.32 + layer * 0.35, t.z - 1.9 + row * 1.9);
    p.fromRot = p.rot.clone();
    p.toYaw = (Math.random() - 0.5) * 0.6;
    p.state = 'fly'; p.ft = 0;
    p.hover = false;
    const part = PART_BY_ID[p.b.t];
    p.baseScale = Math.min(1, 2.1 / Math.max(part.w, part.d));     // fit neatly in the tray
  }

  sortAll() {
    const rest = this.pieces.filter(p => p.state === 'rest' || p.state === 'fall');
    const gap = Math.max(12, Math.min(45, 1800 / Math.max(1, rest.length)));
    rest.forEach((p, i) => setTimeout(() => { if (p.state === 'fall') { p.state = 'rest'; } this.flyToTray(p); }, i * gap));
  }

  // ------------------------------------------------------------------ simulation
  update(dt) {
    this.controls.update();
    if (!this.pieces) return;
    this.t += dt;
    if (this.phase === 'bag' && this.bagObj) {
      this.bagObj.position.y = TABLE + 1.4 + Math.abs(Math.sin(this.t * 2.2)) * 0.25;
      this.bagObj.rotation.z = Math.sin(this.t * 1.6) * 0.05;
    }
    if (this.bagHalves && this.bagObj) {
      // the torn bag slides away and shrinks
      const k = Math.min(1, this.t / 0.7);
      this.bagObj.scale.set(1 - k * 0.9, 1 - k * 0.6, 1);
      this.bagObj.position.y = TABLE + 1.4 + k * 2;
      this.bagObj.rotation.z += dt * 2;
      this.bagObj.children.forEach(c => { if (c.material) { c.material.transparent = true; c.material.opacity = Math.min(c.material.opacity, 1 - k); } });
      if (k >= 1) { this.bagObj.visible = false; this.bagHalves = null; }
    }
    let changed = false;
    let sortedNow = 0;
    for (const p of this.pieces) {
      if (p.state === 'fall') {
        if (p.delay > 0) { p.delay -= dt; continue; }
        p.vel.y -= G * dt;
        p.pos.addScaledVector(p.vel, dt);
        p.rot.x += p.ang.x * dt; p.rot.y += p.ang.y * dt; p.rot.z += p.ang.z * dt;
        // keep pieces on the desk, out of the tray row
        if (Math.abs(p.pos.x) > 34) { p.pos.x = Math.sign(p.pos.x) * 34; p.vel.x *= -0.4; }
        if (p.pos.z > 10) { p.pos.z = 10; p.vel.z *= -0.4; }
        if (p.pos.z < -18) { p.pos.z = -18; p.vel.z *= -0.4; }
        if (p.pos.y <= TABLE) {
          p.pos.y = TABLE;
          if (Math.abs(p.vel.y) > 2.5) { p.vel.y = -p.vel.y * 0.32; p.vel.x *= 0.6; p.vel.z *= 0.6; p.ang.multiplyScalar(0.5); if (Math.random() < 0.15) this.g.audio.play('tick'); }
          else { p.vel.set(0, 0, 0); p.state = 'rest'; p.rot.set(0, p.rot.y, 0); }
        }
        changed = true;
      } else if (p.state === 'fly') {
        p.ft += dt / 0.42;
        const k = Math.min(1, p.ft);
        const e = 1 - Math.pow(1 - k, 2);
        p.pos.lerpVectors(p.from, p.to, e);
        p.pos.y += Math.sin(k * Math.PI) * 4.5;
        p.rot.set(p.fromRot.x * (1 - e), p.fromRot.y + (p.toYaw - p.fromRot.y) * e, p.fromRot.z * (1 - e));
        if (k >= 1) { p.state = 'sorted'; this.g.audio.play('sort'); }
        changed = true;
      }
      if (p.state === 'sorted') sortedNow++;
      const target = (p.hover ? 1.18 : 1) * (p.baseScale || 1);
      if (Math.abs(p.scale - target) > 0.001) { p.scale += (target - p.scale) * Math.min(1, dt * 14); changed = true; }
    }
    if (this.phase === 'spill' && this.progressEl) {
      const txt = `${sortedNow} / ${this.pieces.length} sorted`;
      if (this.progressEl.textContent !== txt) this.progressEl.textContent = txt;
      if (sortedNow === this.pieces.length && !this.doneShown) { this.doneShown = true; this.g.audio.play('sparkle'); this.renderUi(); }
    }
    if (changed || this.t < 0.2) this.writeMatrices();
  }

  writeMatrices() {
    for (const m of this.meshes) {
      m.userData.items.forEach((it, i) => {
        const p = this.pieces[it.idx];
        _q.setFromEuler(_e.set(p.rot.x, p.rot.y, p.rot.z));
        const sc = p.state === 'bag' ? 0.0001 : p.scale;
        _s.set(sc, sc, sc);
        m.setMatrixAt(i, _m.compose(p.pos, _q, _s));
      });
      m.instanceMatrix.needsUpdate = true;
    }
  }
}
