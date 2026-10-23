// boxOpening.js — the satisfying unboxing scene: show the box, click or drag up to open,
// the lid flies off, bags and the instruction booklet pop out, then a summary of what's
// inside. Skippable at any time.
import * as THREE from 'three';
import { makeStudioScene, fitShadow } from './engine.js';
import { CATEGORY_BY_ID, RARITY_BY_ID } from './catalog.js';
import { PART_BY_ID, COLOR_BY_ID } from './parts.js';
import { threeColor } from './brickRenderer.js';
import { el, clear, toast } from './ui.js';
import { makeDesk, deskAtmosphere, DESK_TOP_Y } from './desk.js';
import { boxArt } from './boxArt.js';
import { bagsOf } from './bags.js';

export class BoxOpening {
  constructor(game) {
    this.g = game;
    this.el = document.getElementById('screen-opening');
    const st = makeStudioScene({ background: '#1a2240' });
    this.scene = st.scene; this.key = st.key;
    deskAtmosphere(this.scene);
    st.floor.visible = false;
    st.hemi.intensity = 0.75;
    const spot = new THREE.SpotLight(0xfff1d6, 60, 40, Math.PI / 6, 0.5, 1.2);
    spot.position.set(0, 14, 6); spot.target.position.set(0, 1, 0);
    this.scene.add(spot, spot.target);
    // the box sits on your desk
    this.desk = makeDesk(0, -2, 64, 36);
    this.scene.add(this.desk);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    this.camera.position.set(2.5, 6.2, 16);
    this.camera.lookAt(0, 1.6, 0);
    this.root = new THREE.Group();
    this.root.position.y = DESK_TOP_Y;
    this.scene.add(this.root);
    this.stage = { scene: this.scene, camera: this.camera, update: dt => this.update(dt) };
    fitShadow(this.key, { minX: -6, maxX: 6, minZ: -6, maxZ: 6, minY: 0, maxY: 10 }, 1024);
    this.prompt = el('div', { class: 'open-prompt' }, el('b', { text: 'Click or drag up to open the box!' }), el('span', { class: 'muted', text: 'Tip: you can skip the animation.' }));
    this.panel = el('div', { class: 'open-panel panel' });
    this.skipBtn = el('button', { class: 'btn ghost skip-btn', text: 'Skip ⏭', onclick: () => this.skip() });
    this.backBtn = el('button', { class: 'btn ghost back-btn', text: '← Back', onclick: () => this.g.show('collection') });
    this.el.append(this.prompt, this.panel, this.skipBtn, this.backBtn);
    const canvas = game.engine.canvas;
    canvas.addEventListener('pointerdown', e => { if (this.active && e.button === 0) this.downY = e.clientY; });
    canvas.addEventListener('pointermove', e => { if (this.active && this.downY != null && this.downY - e.clientY > 40) { this.downY = null; this.open(); } });
    canvas.addEventListener('pointerup', e => { if (this.active && e.button === 0 && this.downY != null) { this.downY = null; this.open(); } });
  }

  async enter(params) {
    const set = this.g.setById(params.setId);
    const own = set && this.g.ownership(set.id);
    if (!own) { toast('You need to buy that set first.', 'error'); return this.g.show('store'); }
    if (own.state !== 'unopened') return this.g.show('studio', { setId: set.id });
    this.set = set;
    this.active = true;
    this.phase = 'idle';
    this.t = 0;
    this.panel.classList.remove('show');
    this.prompt.classList.add('show');
    this.skipBtn.style.display = '';
    this.g.engine.setStage(this.stage);
    clear(this.panel);
    // build the box once the thumbnail is ready (rendered or cached)
    await new Promise(res => this.g.thumb(set, url => {
      if (!url) return res();
      const img = new Image(); img.onload = () => { this.thumbImg = img; res(); }; img.onerror = () => res(); img.src = url;
    }));
    this.buildBox();
  }
  leave() { this.active = false; this.disposeBox(); return true; }

  disposeBox() {
    for (const c of [...this.root.children]) this.root.remove(c);
    if (this.disposables) this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }

  buildBox() {
    this.disposeBox();
    const art = boxArt(this.set, this.thumbImg);
    const cardboard = new THREE.MeshStandardMaterial({ color: 0x8b6a45, roughness: 0.9 });
    const mFront = new THREE.MeshStandardMaterial({ map: art.front, roughness: 0.45 });
    const mSide = new THREE.MeshStandardMaterial({ map: art.side, roughness: 0.45 });
    const mTop = new THREE.MeshStandardMaterial({ map: art.top, roughness: 0.45 });
    const mDark = new THREE.MeshStandardMaterial({ color: 0x16224d, roughness: 0.5 });
    const W = 5.2, H = 3.9, D = 1.8;
    // body (open top: the top face is the cardboard inside)
    this.body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [mSide, mSide, cardboard, mDark, mFront, mDark]);
    this.body.position.y = H / 2;
    this.body.castShadow = true; this.body.receiveShadow = true;
    // lid
    this.lid = new THREE.Mesh(new THREE.BoxGeometry(W + 0.08, 0.32, D + 0.08), [mDark, mDark, mTop, mDark, mDark, mDark]);
    this.lid.position.y = H + 0.16;
    this.lid.castShadow = true;
    this.box = new THREE.Group();
    this.box.add(this.body, this.lid);
    this.box.rotation.y = -0.35;
    this.root.add(this.box);
    // bags of pieces, the instruction booklet and confetti bricks (hidden until opened)
    const pal = this.set.palette.length ? this.set.palette : ['red', 'blue', 'yellow'];
    this.bags = [];
    const nBags = Math.min(6, bagsOf(this.set).length);
    for (let i = 0; i < nBags; i++) {
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, roughness: 0.1 });
      const bag = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.35), m);
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.2), new THREE.MeshStandardMaterial({ color: threeColor(pal[i % pal.length]), roughness: 0.4 }));
      bag.add(inner);
      // printed bag number
      const nc = document.createElement('canvas'); nc.width = 64; nc.height = 64;
      const nx = nc.getContext('2d'); nx.fillStyle = '#fff'; nx.beginPath(); nx.arc(32, 32, 28, 0, Math.PI * 2); nx.fill();
      nx.fillStyle = '#1b2440'; nx.font = '900 40px system-ui, sans-serif'; nx.textAlign = 'center'; nx.textBaseline = 'middle'; nx.fillText(String(i + 1), 32, 35);
      const ntex = new THREE.CanvasTexture(nc); ntex.colorSpace = THREE.SRGBColorSpace;
      const num = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: ntex, transparent: true }));
      num.position.z = 0.19; bag.add(num);
      this.disposables.push(ntex, num.geometry, num.material);
      bag.visible = false; bag.castShadow = true;
      this.box.add(bag);
      this.bags.push({ mesh: bag, delay: 0.15 + i * 0.12, tx: nBags > 1 ? -2.6 + i * (5.2 / (nBags - 1)) : 0, tz: 2.2 + (i % 2) * 0.6 });
      this.disposables.push(m, bag.geometry, inner.geometry, inner.material);
    }
    const bookTex = art.front.clone(); bookTex.needsUpdate = true;
    this.book = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 0.06), [mDark, mDark, mDark, mDark, new THREE.MeshStandardMaterial({ map: bookTex }), mDark]);
    this.book.visible = false; this.book.castShadow = true;
    this.box.add(this.book);
    // confetti bricks
    const cube = new THREE.BoxGeometry(0.22, 0.14, 0.22);
    this.bits = new THREE.InstancedMesh(cube, new THREE.MeshStandardMaterial({ roughness: 0.35 }), 70);
    this.bitData = [];
    for (let i = 0; i < 70; i++) {
      this.bits.setColorAt(i, threeColor(pal[i % pal.length]));
      this.bitData.push({ p: new THREE.Vector3(0, H, 0), v: new THREE.Vector3((Math.random() - 0.5) * 6, 6 + Math.random() * 5, (Math.random() - 0.2) * 5), r: Math.random() * 6 });
    }
    this.bits.visible = false;
    this.box.add(this.bits);
    this.disposables.push(cardboard, mFront, mSide, mTop, mDark, art.front, art.side, art.top, bookTex, this.body.geometry, this.lid.geometry, this.book.geometry, cube, this.bits.material, this.bits);
    this.H = H;
  }

  open() {
    if (this.phase !== 'idle' || !this.box) return;
    this.phase = 'opening'; this.t = 0;
    this.prompt.classList.remove('show');
    this.g.audio.play('open');
    this.markOpened();
  }

  markOpened() {
    const own = this.g.ownership(this.set.id);
    if (own.state === 'unopened') {
      own.state = 'opened';
      this.g.prog.onOpen(this.set);
      this.g.emit('owned', this.set.id);
      this.g.requestSave(true);
    }
  }

  skip() {
    if (!this.box) return;
    if (this.phase === 'idle') this.markOpened();
    this.phase = 'done';
    this.t = 10;
    this.applyFinalPose();
    this.showPanel();
  }

  applyFinalPose() {
    this.lid.position.set(3.4, 0.2, -1.2); this.lid.rotation.set(0.2, 0.5, 1.4);
    for (const b of this.bags) { b.mesh.visible = true; b.mesh.position.set(b.tx, 0.75, b.tz); b.mesh.rotation.set(0, 0, 0); }
    this.book.visible = true; this.book.position.set(-3.4, 0.9, 1.2); this.book.rotation.set(-0.3, 0.6, 0);
    this.bits.visible = false;
  }

  update(dt) {
    if (!this.box) return;
    this.t += dt;
    const H = this.H;
    if (this.phase === 'idle') {
      this.box.position.y = Math.sin(this.t * 2) * 0.08;
      this.box.rotation.y = -0.35 + Math.sin(this.t * 0.8) * 0.12;
      return;
    }
    if (this.phase === 'opening') {
      const t = this.t;
      const k = Math.min(1, t / 0.9);
      this.box.position.y *= 0.9;
      // lid pops up, spins away and lands
      this.lid.position.set(3.4 * k, H + 0.16 + Math.sin(k * Math.PI) * 3 - (H - 0.04) * k * k, -1.2 * k);
      this.lid.rotation.set(0.2 * k, 0.5 * k, 1.4 * k);
      if (t > 0.25) {
        this.bits.visible = true;
        const m = new THREE.Matrix4(), q = new THREE.Quaternion();
        this.bitData.forEach((b, i) => {
          b.v.y -= 18 * dt; b.p.addScaledVector(b.v, dt);
          if (b.p.y < 0.07) { b.p.y = 0.07; b.v.multiplyScalar(0.4); b.v.y = Math.abs(b.v.y) * 0.3; }
          q.setFromEuler(new THREE.Euler(b.r * t, b.r, 0));
          m.compose(b.p, q, new THREE.Vector3(1, 1, 1));
          this.bits.setMatrixAt(i, m);
        });
        this.bits.instanceMatrix.needsUpdate = true;
        this.bits.computeBoundingSphere();
      }
      for (const b of this.bags) {
        const bt = Math.max(0, Math.min(1, (t - 0.5 - b.delay) / 0.6));
        if (bt > 0) {
          b.mesh.visible = true;
          const e = 1 - Math.pow(1 - bt, 3);
          b.mesh.position.set(b.tx * e, H * (1 - e) + 0.75 * e + Math.sin(bt * Math.PI) * 2.2, b.tz * e);
          b.mesh.rotation.set(0, (1 - e) * 3, 0);
        }
      }
      const bk = Math.max(0, Math.min(1, (t - 1.1) / 0.6));
      if (bk > 0) {
        this.book.visible = true;
        const e = 1 - Math.pow(1 - bk, 3);
        this.book.position.set(-3.4 * e, H * (1 - e) + 0.9 * e + Math.sin(bk * Math.PI) * 2, 1.2 * e);
        this.book.rotation.set(-0.3 * e, 0.6 * e, 0);
      }
      if (t > 2.2) { this.phase = 'done'; this.showPanel(); this.g.audio.play('sparkle'); }
    }
    if (this.phase === 'done') this.box.rotation.y += (-0.35 - this.box.rotation.y) * 0.05;
  }

  showPanel() {
    this.skipBtn.style.display = 'none';
    this.prompt.classList.remove('show');
    const set = this.set;
    const p = clear(this.panel);
    const thumb = el('img', { class: 'booklet', alt: 'Instruction booklet' });
    this.g.thumb(set, u => { if (u) thumb.src = u; });
    const grid = el('div', { class: 'parts-mini' });
    for (const pt of set.parts.slice(0, 24)) {
      const img = el('img', { alt: '' });
      this.g.thumbFor(`part:${pt.t}:${pt.c}`, () => [{ t: pt.t, x: 0, y: 0, z: 0, r: pt.t.startsWith('wheel') || pt.t.startsWith('slope') ? 1 : 0, c: pt.c }], u => { if (u) img.src = u; });
      grid.appendChild(el('div', { class: 'pm', title: `${PART_BY_ID[pt.t].name} (${COLOR_BY_ID[pt.c].name})` }, img, el('span', { text: '×' + pt.n })));
    }
    if (set.parts.length > 24) grid.appendChild(el('div', { class: 'pm more', text: `+${set.parts.length - 24} kinds` }));
    const bags = bagsOf(set);
    p.append(
      el('h2', { text: 'Inside the box' }),
      el('p', { class: 'bag-note' }, el('b', { text: `🛍️ ${bags.length} numbered bag${bags.length > 1 ? 's' : ''}` }), el('span', { class: 'muted', text: bags.length > 1 ? ' — open bag 1 first, then the next one when the booklet tells you.' : ' — everything you need is in one bag.' })),
      el('div', { class: 'booklet-row' }, thumb, el('div', {},
        el('b', { text: 'Instruction booklet' }),
        el('p', { class: 'muted', text: `${set.steps.length} steps` }),
        el('p', {}, el('b', { text: set.brickCount.toLocaleString() }), ' pieces'),
        el('p', { class: 'muted', text: `${set.parts.length} different kinds of piece` }))),
      el('h4', { text: 'Included pieces' }), grid,
      el('p', { class: 'muted', text: 'This set is now in your available builds.' }),
      el('div', { class: 'row' },
        el('button', { class: 'btn', text: 'Build later', onclick: () => this.g.show('collection') }),
        el('button', { class: 'btn primary big', text: '🛍️ Open bag 1', onclick: () => this.g.show('sorting', { setId: set.id, bag: 0 }) })));
    this.panel.classList.add('show');
  }
}
