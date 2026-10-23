// collectionRoom.js — the Display Room: a cosy room with big wooden shelving units.
// Put your finished builds AND sealed boxes on any shelf spot, move them around,
// turn them to face the best way, or take them down. Everything is saved.
// Each "room" holds 24 spots; more rooms open up as your collection grows.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeStudioScene, fitShadow } from './engine.js';
import { BrickRenderer } from './brickRenderer.js';
import { PLATE_H } from './parts.js';
import { RARITY_BY_ID } from './catalog.js';
import { boxArt, boxArtUrl } from './boxArt.js';
import { el, clear, toast } from './ui.js';

const BAYS = 2, COLS = 3, ROWS = 4, PER_ROOM = BAYS * COLS * ROWS;
const SW = 11, SH = 10, SD = 9, T = 0.8;           // slot width/height/depth, board thickness
const BAY_W = COLS * SW + T * 2, GAP = 3;

/** Shelf data lives in save.room.shelf: { slotIndex: { kind: 'build'|'box', id, rot } } */
export function shelfOf(save) {
  if (!save.room.shelf || typeof save.room.shelf !== 'object') {
    save.room.shelf = {};
    (save.room.order || []).forEach((id, i) => { save.room.shelf[i] = { kind: 'build', id, rot: save.room.rot?.[id] || 0 }; });
  }
  return save.room.shelf;
}
export function firstEmptySlot(save) { const sh = shelfOf(save); let i = 0; while (sh[i]) i++; return i; }
/** Put a finished build on the first free spot (unless it's already on display). */
export function autoShelve(save, id) {
  const sh = shelfOf(save);
  for (const k in sh) if (sh[k].id === id) { sh[k].kind = 'build'; return; }
  sh[firstEmptySlot(save)] = { kind: 'build', id, rot: 0 };
}

function slotPos(local) {
  const bay = Math.floor(local / (COLS * ROWS));
  const r = Math.floor((local % (COLS * ROWS)) / COLS);       // 0 = top shelf
  const c = local % COLS;
  const bayX = -((BAYS * BAY_W + (BAYS - 1) * GAP) / 2) + bay * (BAY_W + GAP);
  const x = bayX + T + c * SW + SW / 2;
  const y = (ROWS - 1 - r) * SH + T;                            // top of the board this slot stands on
  return new THREE.Vector3(x, y, SD / 2 + 0.2);
}

export class CollectionRoom {
  constructor(game) {
    this.g = game;
    this.el = document.getElementById('screen-room');
    const st = makeStudioScene({ background: '#efe6d8' });
    this.scene = st.scene; this.key = st.key;
    this.scene.fog = new THREE.Fog('#efe6d8', 150, 300);
    st.floor.visible = false;
    st.hemi.intensity = 0.9;
    // room: wooden floor, warm walls, a rug
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0xa87a52, roughness: 0.7 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(400, 120), new THREE.MeshStandardMaterial({ color: 0xf1e6d6, roughness: 0.95 }));
    wall.position.set(0, 60, -0.05); wall.receiveShadow = true;
    const rug = new THREE.Mesh(new THREE.CircleGeometry(20, 48), new THREE.MeshStandardMaterial({ color: 0x8c4a3c, roughness: 0.95 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.02, 30); rug.scale.set(1.6, 1, 0.8); rug.receiveShadow = true;
    const skirting = new THREE.Mesh(new THREE.BoxGeometry(400, 3, 0.6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    skirting.position.set(0, 1.5, 0.3);
    this.scene.add(floor, wall, rug, skirting);
    this.buildShelves();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 900);
    this.controls = new OrbitControls(this.camera, game.engine.canvas);
    this.controls.mouseButtons = { LEFT: -1, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
    this.controls.enableDamping = true; this.controls.maxPolarAngle = Math.PI * 0.49; this.controls.minDistance = 8; this.controls.maxDistance = 150;
    this.controls.minAzimuthAngle = -1.2; this.controls.maxAzimuthAngle = 1.2;
    this.controls.screenSpacePanning = true;
    this.controls.enabled = false;
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.markers = new THREE.Group(); this.scene.add(this.markers);
    this.selBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(SW - 0.4, SH - T - 0.3, SD - 0.4)), new THREE.LineBasicMaterial({ color: 0xffb300, transparent: true, depthTest: false }));
    this.selBox.renderOrder = 10; this.selBox.visible = false;
    this.scene.add(this.selBox);
    this.items = [];
    this.page = 0;
    this.mode = 'view';            // 'view' | 'place' (putting something new up) | 'move'
    fitShadow(this.key, { minX: -45, maxX: 45, minZ: -5, maxZ: 40, minY: 0, maxY: 45 }, 2048);
    this.stage = { scene: this.scene, camera: this.camera, update: dt => this.update(dt) };
    this.left = el('div', { class: 'shelf-left panel' });
    this.panel = el('div', { class: 'room-panel panel' });
    this.pager = el('div', { class: 'room-pager panel' });
    this.hint = el('div', { class: 'studio-hint', text: 'Click an item to pick it up • Right-drag to look around • Wheel to zoom • Q/E turn it' });
    this.el.append(this.left, this.panel, this.pager, this.hint);
    const canvas = game.engine.canvas;
    this.ray = new THREE.Raycaster();
    canvas.addEventListener('pointerdown', e => { if (this.active && e.button === 0) this.down = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointerup', e => { if (this.active && e.button === 0 && this.down && Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) < 6) this.click(e); this.down = null; });
    canvas.addEventListener('pointermove', e => { if (this.active) this.hover(e); });
    window.addEventListener('keydown', e => {
      if (!this.active || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'escape' && this.mode !== 'view') { this.setMode('view'); e.stopPropagation(); }
      if (this.sel == null) return;
      if (k === 'q') this.rotateSel(-1); else if (k === 'e') this.rotateSel(1);
      else if (k === 'm') this.setMode('move');
    });
  }

  buildShelves() {
    const oak = new THREE.MeshStandardMaterial({ color: 0xc9925a, roughness: 0.55 });
    const back = new THREE.MeshStandardMaterial({ color: 0xe9d4b8, roughness: 0.8 });
    const g = new THREE.Group();
    for (let b = 0; b < BAYS; b++) {
      const x0 = -((BAYS * BAY_W + (BAYS - 1) * GAP) / 2) + b * (BAY_W + GAP);
      const H = ROWS * SH + T;
      const add = (w, h, d, x, y, z, m = oak) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); };
      add(T, H + 1, SD, x0 + T / 2, (H + 1) / 2, SD / 2);
      add(T, H + 1, SD, x0 + BAY_W - T / 2, (H + 1) / 2, SD / 2);
      add(BAY_W, 0.5, 0.4, x0 + BAY_W / 2, H / 2, 0.2, back);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(BAY_W - T * 2, H), back); panel.position.set(x0 + BAY_W / 2, H / 2, 0.05); panel.receiveShadow = true; g.add(panel);
      for (let r = 0; r <= ROWS; r++) add(BAY_W, T, SD, x0 + BAY_W / 2, r * SH + T / 2, SD / 2);
      add(BAY_W + 1, 1.2, SD + 1, x0 + BAY_W / 2, H + 1.2, SD / 2);
    }
    this.scene.add(g);
  }

  async enter(params = {}) {
    this.active = true;
    this.g.engine.setStage(this.stage);
    this.controls.enabled = true;
    const sh = shelfOf(this.g.save);
    this.cleanShelf();
    if (params.focus) {
      const key = Object.keys(sh).find(k => sh[k].id === params.focus);
      if (key != null) this.page = Math.floor(Number(key) / PER_ROOM);
    }
    this.mode = 'view'; this.placing = null;
    this.build();
    this.camera.position.set(0, 24, 96);
    this.controls.target.set(0, 19, 0);
    this.sel = null;
    if (params.focus) { const it = this.items.find(i => i.id === params.focus); if (it) this.select(it.slot); }
    this.renderUi();
  }
  leave() { this.active = false; this.controls.enabled = false; this.clearItems(); return true; }

  /** Drop entries for sets you no longer have in that state. */
  cleanShelf() {
    const sh = shelfOf(this.g.save);
    for (const k of Object.keys(sh)) {
      const it = sh[k], o = this.g.save.owned[it?.id];
      if (!it || !o || !this.g.setById(it.id)) { delete sh[k]; continue; }
      if (it.kind === 'build' && o.state !== 'completed') delete sh[k];
      if (it.kind === 'box' && o.state !== 'unopened') { if (o.state === 'completed') it.kind = 'build'; else delete sh[k]; }
    }
  }

  pages() {
    const keys = Object.keys(shelfOf(this.g.save)).map(Number);
    const maxIdx = keys.length ? Math.max(...keys) : 0;
    return Math.max(1, Math.floor(maxIdx / PER_ROOM) + 1);
  }

  clearItems() {
    for (const it of this.items) { it.renderer && it.renderer.dispose(); it.dispose && it.dispose(); this.root.remove(it.group); }
    this.items = [];
    for (const c of [...this.markers.children]) { this.markers.remove(c); c.geometry.dispose(); c.material.dispose(); }
  }

  build() {
    this.clearItems();
    const sh = shelfOf(this.g.save);
    const detail = Math.min(1, this.g.engine.quality.detail);
    for (let l = 0; l < PER_ROOM; l++) {
      const slot = this.page * PER_ROOM + l;
      const entry = sh[slot];
      if (!entry) continue;
      const set = this.g.setById(entry.id);
      const p = slotPos(l);
      const group = new THREE.Group();
      group.position.copy(p);
      group.rotation.y = (entry.rot || 0) * Math.PI / 2;
      const item = { slot, id: entry.id, kind: entry.kind, set, group, targetRot: group.rotation.y };
      if (entry.kind === 'build') {
        const d = set.dims;
        const s = Math.min(1, (SW - 1.6) / Math.max(d.w, d.d), (SH - T - 1.2) / (d.h * PLATE_H));
        const inner = new THREE.Group();
        inner.position.set(-d.w / 2, 0, -d.d / 2);
        item.renderer = new BrickRenderer(inner, { detail, shadows: this.g.engine.quality.shadows });
        item.renderer.setBricks(set.bricks);
        const holder = new THREE.Group(); holder.scale.setScalar(s); holder.add(inner);
        group.add(holder);
      } else {
        // a sealed box standing on the shelf, with its real artwork
        const W = 7.4, H = 5.6, D = 2.6;
        const mats = [];
        const plain = new THREE.MeshStandardMaterial({ color: 0x16224d, roughness: 0.5 });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [plain, plain, plain, plain, plain, plain]);
        mesh.position.y = H / 2; mesh.castShadow = true; mesh.receiveShadow = true;
        group.add(mesh);
        this.g.thumb(set, url => {
          const apply = img => {
            const art = boxArt(set, img);
            const m = k => new THREE.MeshStandardMaterial({ map: art[k], roughness: 0.45 });
            const f = m('front'), sd = m('side'), tp = m('top');
            mats.push(f, sd, tp, art.front, art.side, art.top);
            mesh.material = [sd, sd, tp, plain, f, plain];
          };
          if (!url) return;
          const img = new Image(); img.onload = () => apply(img); img.src = url;
        });
        item.dispose = () => { mesh.geometry.dispose(); plain.dispose(); mats.forEach(m => m.dispose()); };
      }
      group.traverse(o => { o.userData.slot = slot; });
      this.root.add(group);
      this.items.push(item);
    }
    this.renderMarkers();
  }

  /** Glowing spots for where something can go (place / move modes). */
  renderMarkers() {
    for (const c of [...this.markers.children]) { this.markers.remove(c); c.geometry.dispose(); c.material.dispose(); }
    if (this.mode === 'view') return;
    const sh = shelfOf(this.g.save);
    for (let l = 0; l < PER_ROOM; l++) {
      const slot = this.page * PER_ROOM + l;
      if (sh[slot] && !(this.mode === 'move' && slot !== this.sel)) continue;
      if (this.mode === 'move' && slot === this.sel) continue;
      const p = slotPos(l);
      const m = new THREE.Mesh(new THREE.BoxGeometry(SW - 0.8, SH - T - 0.6, SD - 0.8), new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.22, depthWrite: false }));
      m.position.set(p.x, p.y + (SH - T - 0.6) / 2, p.z);
      m.userData.emptySlot = slot;
      this.markers.add(m);
    }
  }

  setNdc(e) {
    const r = this.g.engine.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
  }
  /** Which slot is under the mouse (item, or an empty marker). */
  slotAt() {
    const hits = this.ray.intersectObjects([...this.markers.children, ...this.root.children], true);
    for (const h of hits) {
      if (h.object.userData.emptySlot != null) return { slot: h.object.userData.emptySlot, empty: true };
      if (h.object.userData.slot != null) return { slot: h.object.userData.slot, empty: false };
    }
    return null;
  }
  hover(e) {
    this.setNdc(e);
    const s = this.slotAt();
    this.g.engine.canvas.style.cursor = s ? 'pointer' : '';
    for (const m of this.markers.children) m.material.opacity = 0.22;
    if (s && s.empty) { const m = this.markers.children.find(x => x.userData.emptySlot === s.slot); if (m) m.material.opacity = 0.5; }
  }

  click(e) {
    this.setNdc(e);
    const s = this.slotAt();
    const sh = shelfOf(this.g.save);
    if (this.mode === 'place') {
      if (!s) return;
      if (!s.empty && sh[s.slot]) { this.g.audio.play('error'); toast('That spot is taken — pick a glowing one.', 'info', 1800); return; }
      sh[s.slot] = { kind: this.placing.kind, id: this.placing.id, rot: 0 };
      this.g.audio.place(4, true);
      this.finishEdit(s.slot);
      return;
    }
    if (this.mode === 'move') {
      if (!s || s.slot === this.sel) return;
      const a = sh[this.sel], b = sh[s.slot];
      sh[s.slot] = a; if (b) sh[this.sel] = b; else delete sh[this.sel];
      this.g.audio.place(4, true);
      this.finishEdit(s.slot);
      return;
    }
    if (s && !s.empty) this.select(s.slot); else { this.sel = null; this.selBox.visible = false; this.renderUi(); }
  }

  finishEdit(slot) {
    this.mode = 'view'; this.placing = null;
    this.g.requestSave();
    this.build();
    this.select(slot);
    this.renderUi();
  }

  select(slot) {
    this.sel = slot;
    const p = slotPos(slot % PER_ROOM);
    this.selBox.position.set(p.x, p.y + (SH - T - 0.3) / 2, p.z);
    this.selBox.visible = true;
    this.g.audio.play('click');
    this.renderUi();
  }

  rotateSel(dir) {
    const sh = shelfOf(this.g.save), e = sh[this.sel];
    if (!e) return;
    e.rot = ((e.rot || 0) + dir + 4) % 4;
    const it = this.items.find(i => i.slot === this.sel);
    if (it) it.targetRot += dir * Math.PI / 2;
    this.g.audio.play('tick');
    this.g.requestSave();
  }

  setMode(mode, placing = null) {
    this.mode = mode; this.placing = placing;
    if (mode === 'place' && this.pageFull()) {
      // jump to a room with space
      const sh = shelfOf(this.g.save);
      this.page = Math.floor(firstEmptySlot(this.g.save) / PER_ROOM);
      void sh;
      this.build();
    }
    this.renderMarkers();
    this.renderUi();
  }
  pageFull() { const sh = shelfOf(this.g.save); for (let l = 0; l < PER_ROOM; l++) if (!sh[this.page * PER_ROOM + l]) return false; return true; }

  update(dt) {
    this.controls.update();
    for (const it of this.items) it.group.rotation.y += (it.targetRot - it.group.rotation.y) * Math.min(1, dt * 10);
    const t = performance.now() / 1000;
    if (this.selBox.visible) this.selBox.material.opacity = 0.6 + 0.4 * Math.sin(t * 5);
    for (const m of this.markers.children) m.scale.setScalar(1 + Math.sin(t * 4) * 0.015);
  }

  // ------------------------------------------------------------------ UI
  renderUi() {
    const sh = shelfOf(this.g.save);
    const onShelf = new Set(Object.values(sh).map(e => e.id));
    // left: things you could put up
    const left = clear(this.left);
    const done = this.g.completedSets().filter(s => !onShelf.has(s.id));
    const boxes = this.g.ownedSets().filter(s => this.g.save.owned[s.id].state === 'unopened' && !onShelf.has(s.id));
    left.append(el('h3', { text: 'Not on display' }));
    if (!done.length && !boxes.length) left.append(el('p', { class: 'muted', text: this.g.completedSets().length ? 'Everything you own is on the shelves! 🎉' : 'Finish a build (or buy a box) to put it on your shelves.' }));
    const row = (s, kind) => {
      const img = el('img', { alt: '' });
      if (kind === 'box') boxArtUrl(this.g, s, u => { if (u) img.src = u; }); else this.g.thumb(s, u => { if (u) img.src = u; });
      return el('div', { class: 'shelf-item' + (this.placing && this.placing.id === s.id ? ' on' : '') }, img,
        el('div', {}, el('b', { text: s.name }), el('span', { class: 'muted', text: kind === 'box' ? 'Sealed box' : 'Finished build' })),
        el('button', { class: 'btn small primary', text: 'Place', onclick: () => { this.sel = null; this.selBox.visible = false; this.setMode('place', { kind, id: s.id }); } }));
    };
    const list = el('div', { class: 'shelf-list' });
    done.forEach(s => list.appendChild(row(s, 'build')));
    boxes.forEach(s => list.appendChild(row(s, 'box')));
    left.append(list);
    // right: the selected item / instructions
    const p = clear(this.panel);
    if (this.mode === 'place') {
      p.append(el('h3', { text: 'Choose a spot' }), el('p', { class: 'muted', text: 'Click a glowing spot on the shelves. Press Esc to cancel.' }), el('button', { class: 'btn small', text: 'Cancel', onclick: () => this.setMode('view') }));
    } else if (this.mode === 'move') {
      p.append(el('h3', { text: 'Move it' }), el('p', { class: 'muted', text: 'Click an empty glowing spot — or another item to swap places. Esc to cancel.' }), el('button', { class: 'btn small', text: 'Cancel', onclick: () => this.setMode('view') }));
    } else if (this.sel != null && sh[this.sel]) {
      const e = sh[this.sel], set = this.g.setById(e.id);
      p.append(el('h3', { text: set.name }), el('p', { class: 'muted', text: `${e.kind === 'box' ? 'Sealed box' : 'Finished build'} • ${set.brickCount} pieces • ${RARITY_BY_ID[set.rarity].name}` }),
        el('div', { class: 'row' }, el('button', { class: 'btn small', text: '⟲ Turn', title: 'Q', onclick: () => this.rotateSel(-1) }), el('button', { class: 'btn small', text: 'Turn ⟳', title: 'E', onclick: () => this.rotateSel(1) })),
        el('div', { class: 'row' }, el('button', { class: 'btn small', text: '✋ Move', title: 'M', onclick: () => this.setMode('move') }), el('button', { class: 'btn small', text: '⬇ Take down', onclick: () => { delete sh[this.sel]; this.sel = null; this.selBox.visible = false; this.g.requestSave(); this.build(); this.renderUi(); } })),
        e.kind === 'box'
          ? el('button', { class: 'btn primary', text: '📦 Open this box', onclick: () => this.g.show('opening', { setId: e.id }) })
          : el('button', { class: 'btn primary', text: '🔍 Look closer in the studio', onclick: () => this.g.show('studio', { setId: e.id }) }));
    } else {
      const n = Object.keys(sh).length;
      p.append(el('h3', { text: 'Display Room' }), el('p', { class: 'muted', text: n ? `${n} thing${n > 1 ? 's' : ''} on your shelves. Click one to turn it, move it or take it down.` : 'Your shelves are empty. Use "Place" on the left to put something up!' }));
    }
    // pages
    const pages = Math.max(this.pages(), this.page + 1);
    const pg = clear(this.pager);
    pg.append(el('button', { class: 'btn small', text: '◀', disabled: this.page === 0, onclick: () => { this.page--; this.sel = null; this.selBox.visible = false; this.build(); this.renderUi(); } }),
      el('span', { text: `Room ${this.page + 1} of ${pages}` }),
      el('button', { class: 'btn small', text: this.page >= pages - 1 ? '+ New room' : '▶', disabled: this.page >= pages - 1 && !this.pageFull(), onclick: () => { this.page++; this.sel = null; this.selBox.visible = false; this.build(); this.renderUi(); } }));
  }
}
