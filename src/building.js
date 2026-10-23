// building.js — the 3D Build Studio. One workspace with three modes:
//   * 'instructions' — follow a purchased set step by step
//   * 'free'         — sandbox building with every unlocked part
//   * 'inspect'      — look at a finished model from any angle
// Mouse: left = place/select, left-drag = move selection, right-drag = orbit,
// wheel = zoom, middle-drag or shift+right-drag = pan.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeStudioScene, fitShadow, frameModel } from './engine.js';
import { BrickRenderer, makeGhost, placeObject, threeColor } from './brickRenderer.js';
import { partGeometry } from './geometry.js';
import { PlaceFX } from './effects.js';
import { makeDesk, deskAtmosphere } from './desk.js';
import { PARTS, PART_BY_ID, PART_GROUPS, COLORS, COLOR_BY_ID, PLATE_H, footprint, isPartUnlocked } from './parts.js';
import { Occupancy, boundsOf } from './grid.js';
import { InstructionSession } from './instructions.js';
import { BookView, openBooklet, pageOfStep, stepOfPage } from './booklet.js';
import { bagsOf, bagOfStep, bagsOpened } from './bags.js';
import { autoShelve } from './collectionRoom.js';
import { BUILD_AREA, exportBuildFile, parseBuildFile } from './saveSystem.js';
import { el, clear, toast, modal, confirmBox, promptBox, download, pickTextFile, money, anyModalOpen } from './ui.js';

const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _v = new THREE.Vector3();
const UNDO_LIMIT = 150;
const cloneBricks = list => list.map(b => ({ t: b.t, x: b.x, y: b.y, z: b.z, r: b.r, c: b.c }));

/** A studded building plate. */
function makeBaseplate(w, d, color, detail) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.55 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), mat);
  slab.position.set(w / 2, -0.15, d / 2);
  slab.receiveShadow = true;
  g.add(slab);
  if (detail > 0) {
    const stud = new THREE.CylinderGeometry(0.3, 0.3, 0.12, detail >= 2 ? 12 : 6);
    stud.translate(0, 0.06, 0);
    const inst = new THREE.InstancedMesh(stud, mat, w * d);
    const m = new THREE.Matrix4();
    let i = 0;
    for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) { m.makeTranslation(x + 0.5, 0, z + 0.5); inst.setMatrixAt(i++, m); }
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    g.add(inst);
  }
  // subtle border so the edge of the build area is obvious
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.3, d)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
  edge.position.copy(slab.position);
  g.add(edge);
  g.userData.dispose = () => { slab.geometry.dispose(); mat.dispose(); edge.geometry.dispose(); g.children.forEach(c => c.isInstancedMesh && c.dispose()); };
  return g;
}

export class Studio {
  constructor(game) {
    this.g = game;
    this.el = document.getElementById('screen-studio');
    this.mode = 'free';
    this.bricks = [];
    this.occ = new Occupancy();
    this.selection = new Set();
    this.undoStack = []; this.redoStack = [];
    this.tool = 'place';
    this.part = 'brick_2x4';
    this.color = 'red';
    this.rot = 0;
    this.group = 'Bricks';
    this.area = { ...BUILD_AREA };
    this.active = false;
    this.anims = [];
    this.buildStage();
    this.buildDom();
    this.bindInput();
    // apply graphics-quality changes immediately
    game.on('quality', () => {
      const q = this.g.engine.quality;
      this.renderer.setDetail(q.detail, q.shadows);
      if (this.plateArgs) this.setPlate(...this.plateArgs);
      this.clearGhost(); this.refreshTargets && this.mode === 'instructions' && this.refreshTargets();
    });
  }

  // ================================================================= 3D stage
  buildStage() {
    const st = makeStudioScene({ background: '#dde5ee' });
    this.scene = st.scene; this.key = st.key;
    deskAtmosphere(this.scene);
    st.floor.visible = false;
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2000);
    this.camera.position.set(30, 30, 40);
    this.controls = new OrbitControls(this.camera, this.g.engine.canvas);
    this.controls.mouseButtons = { LEFT: -1, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 220;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.zoomSpeed = 1.2;
    this.controls.enabled = false;
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.renderer = new BrickRenderer(this.world, { detail: this.g.engine.quality.detail, shadows: this.g.engine.quality.shadows });
    this.targetGroup = new THREE.Group();
    this.world.add(this.targetGroup);
    this.ghost = null;
    this.ghostBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0x22c55e, depthTest: false, transparent: true }));
    this.ghostBox.renderOrder = 11;
    this.ghostBox.visible = false;
    this.world.add(this.ghostBox);
    this.fx = new PlaceFX(this.world);
    this.stage = { scene: this.scene, camera: this.camera, update: dt => this.update(dt) };
  }

  update(dt) {
    this.controls.update();
    const t = performance.now() / 1000;
    const pulse = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(t * 5));
    for (const gh of this.targetGroup.children) {
      const m = gh.userData.material;
      if (!m) continue;
      m.opacity = gh.userData.hover ? 0.85 : pulse;
      m.emissiveIntensity = gh.userData.wrong ? 1.2 : 0.35 + pulse * 0.6;
      if (gh.userData.wrong && performance.now() > gh.userData.wrong) { gh.userData.wrong = 0; m.emissive.copy(gh.userData.baseEmissive); }
    }
    this.fx.update(dt);
    // drop-in animation for newly placed pieces
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t += dt;
      const k = Math.min(1, a.t / 0.14);
      a.obj.position.y = a.y + (1 - k * k) * 0.8;
      if (k >= 1) { this.world.remove(a.obj); this.anims.splice(i, 1); a.done && a.done(); }
    }
    if (this.autoSpin) this.controls.autoRotate = true;
  }

  setPlate(w, d, color) {
    this.plateArgs = [w, d, color];
    if (this.plate) { this.world.remove(this.plate); this.plate.userData.dispose(); }
    this.plate = makeBaseplate(w, d, color, this.g.engine.quality.detail);
    this.world.add(this.plate);
    // the plate sits on a real desk
    if (this.desk) { this.world.remove(this.desk); this.desk.userData.dispose(); }
    this.desk = makeDesk(w / 2, d / 2 + 4, Math.max(76, w + 48), Math.max(56, d + 36), { mat: { x: -4, z: -4, w: w + 8, d: d + 8 } });
    this.world.add(this.desk);
    fitShadow(this.key, { minX: 0, maxX: w, minZ: 0, maxZ: d, minY: 0, maxY: 30 }, this.g.engine.quality.shadowSize);
  }

  // ================================================================= DOM
  buildDom() {
    const tb = (id, icon, label, title, fn) => el('button', { class: 'tool', dataset: { tool: id }, title, 'aria-label': title, onclick: fn }, el('span', { class: 'ti', text: icon }), el('span', { class: 'tl', text: label }));
    this.dom = {};
    this.dom.name = el('b', { class: 'studio-name' });
    this.dom.pill = el('span', { class: 'mode-pill' });
    this.dom.tools = el('div', { class: 'toolbar' },
      tb('place', '➕', 'Place', 'Place pieces (B)', () => this.setTool('place')),
      tb('select', '🖐️', 'Select', 'Select & move pieces (V)', () => this.setTool('select')),
      el('span', { class: 'sep' }),
      tb('rotate', '⟳', 'Rotate', 'Rotate (R)', () => this.rotate()),
      tb('undo', '↶', 'Undo', 'Undo (Ctrl+Z)', () => this.undo()),
      tb('redo', '↷', 'Redo', 'Redo (Ctrl+Y)', () => this.redo()),
      tb('delete', '🗑️', 'Delete', 'Delete selected or hovered piece (Del)', () => this.deleteSelection()),
      tb('duplicate', '⧉', 'Copy', 'Duplicate selection (Ctrl+D)', () => this.duplicate()),
      el('span', { class: 'sep' }),
      tb('camera', '🎥', 'View', 'Reset camera (C)', () => this.resetCamera()),
      tb('shot', '📷', 'Photo', 'Take a screenshot (P)', () => this.screenshot()),
      el('span', { class: 'sep free-only' }),
      tb('new', '📄', 'New', 'Start a new creation', () => this.newBuild()),
      tb('save', '💾', 'Save', 'Save creation (Ctrl+S)', () => this.saveBuild()),
      tb('load', '📂', 'Load', 'Load a saved creation', () => this.loadDialog()),
      tb('export', '⬇️', 'Export', 'Download as a JSON file', () => this.exportBuild()),
      tb('import', '⬆️', 'Import', 'Load a JSON build file', () => this.importBuild()),
      tb('booklet', '📖', 'Booklet', 'Open the instruction booklet (I)', () => this.openBook()),
      tb('hint', '💡', 'Hint', 'Show where the next piece goes (H)', () => this.hint()),
      tb('auto', '🤖', 'Help me', 'Place the next piece for me', () => this.autoPlace()),
      tb('rebuild', '🔁', 'Rebuild', 'Take the model apart and build it again', () => this.rebuild()),
      tb('tostudio', '🧱', 'Remix', 'Copy this model into the free Build Studio', () => this.remix()),
      el('span', { class: 'sep' }),
      tb('exit', '✕', 'Exit', 'Leave the studio', () => this.exit()),
    );
    const top = el('div', { class: 'studio-top panel' }, el('div', { class: 'studio-title' }, this.dom.pill, this.dom.name), this.dom.tools);

    // left: parts tray
    this.dom.search = el('input', { class: 'input tray-search', type: 'search', placeholder: 'Search parts…', 'aria-label': 'Search parts', oninput: () => this.renderTray() });
    this.dom.tabs = el('div', { class: 'tray-tabs' });
    this.dom.grid = el('div', { class: 'tray-grid' });
    this.dom.palette = el('div', { class: 'palette' });
    this.dom.trayTitle = el('h3', { text: 'Parts' });
    this.dom.tray = el('aside', { class: 'tray panel' }, el('div', { class: 'tray-head' }, this.dom.trayTitle, this.dom.search), this.dom.tabs, this.dom.grid, el('div', { class: 'palette-head', text: 'Colour' }), this.dom.palette);

    // right: instructions / info
    this.dom.side = el('aside', { class: 'side panel' });
    this.dom.hint = el('div', { class: 'studio-hint' });
    this.dom.banner = el('div', { class: 'studio-banner' });
    this.el.append(top, this.dom.tray, this.dom.side, this.dom.hint, this.dom.banner);
    this.renderPalette();
  }

  setHint(text) { this.dom.hint.textContent = text; }
  banner(text, kind = '') {
    this.dom.banner.textContent = text;
    this.dom.banner.className = 'studio-banner show ' + kind;
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => { this.dom.banner.className = 'studio-banner ' + kind; }, 1600);
  }

  updateToolbar() {
    const m = this.mode;
    const show = { place: m === 'free', select: m === 'free', rotate: m !== 'inspect', undo: m !== 'inspect', redo: m !== 'inspect', delete: m === 'free', duplicate: m === 'free', new: m === 'free', save: m === 'free', load: m === 'free', export: m === 'free', import: m === 'free', booklet: m !== 'free', hint: m === 'instructions', auto: m === 'instructions', rebuild: m === 'inspect', tostudio: m === 'inspect' };
    for (const b of this.dom.tools.querySelectorAll('.tool')) {
      const id = b.dataset.tool;
      if (id in show) b.style.display = show[id] ? '' : 'none';
      b.classList.toggle('on', (id === 'place' || id === 'select') && this.tool === id);
    }
    this.dom.tools.querySelector('.free-only').style.display = m === 'free' ? '' : 'none';
    const undoBtn = this.dom.tools.querySelector('[data-tool=undo]'), redoBtn = this.dom.tools.querySelector('[data-tool=redo]');
    if (m === 'free') { undoBtn.disabled = !this.undoStack.length; redoBtn.disabled = !this.redoStack.length; }
    else if (m === 'instructions' && this.session) { undoBtn.disabled = !this.session.order.length; redoBtn.disabled = !this.session.redoStack.length; }
    this.dom.tray.style.display = m === 'inspect' ? 'none' : '';
  }

  // ----------------------------------------------------------------- tray
  partColorThumb(t, c, img) {
    this.g.thumbFor(`part:${t}:${c}`, () => [{ t, x: 0, y: 0, z: 0, r: t.startsWith('wheel') || t.startsWith('slope') || t === 'windscreen_2x4' ? 1 : 0, c }], url => { if (url) img.src = url; });
  }

  /** In instructions: index of the bag that must be opened before building on, or -1. */
  bagNeeded() {
    if (this.mode !== 'instructions' || !this.session || this.session.isComplete()) return -1;
    const need = bagOfStep(this.set, this.session.currentStep());
    return need >= bagsOpened(this.set, this.g.ownership(this.set.id)) ? need : -1;
  }

  renderTray() {
    const grid = clear(this.dom.grid), tabs = clear(this.dom.tabs);
    const needBag = this.bagNeeded();
    if (needBag >= 0) {
      this.dom.trayTitle.textContent = 'Next bag';
      this.dom.search.style.display = 'none';
      this.dom.palette.style.display = 'none'; this.dom.palette.previousSibling.style.display = 'none';
      const total = bagsOf(this.set).length;
      grid.appendChild(el('div', { class: 'bag-prompt' },
        el('div', { class: 'bag-big' }, el('span', { text: String(needBag + 1) })),
        el('b', { text: needBag === 0 ? 'Open bag 1 to start!' : `Bag ${needBag} done! Open bag ${needBag + 1}.` }),
        el('p', { class: 'muted', text: `Bag ${needBag + 1} of ${total} has the pieces for the next steps. Tear it open on your desk and sort the pieces.` }),
        el('button', { class: 'btn primary', text: `🛍️ Open bag ${needBag + 1}`, onclick: () => this.g.show('sorting', { setId: this.set.id, bag: needBag }) }),
        el('button', { class: 'btn ghost small', text: 'Skip sorting', onclick: () => { const own = this.g.ownership(this.set.id); own.bags = needBag + 1; this.g.requestSave(true); this.pickFirstPiece(); this.refreshTargets(); this.renderTray(); this.renderSide(); } })));
      return;
    }
    if (this.mode === 'instructions') {
      this.dom.trayTitle.textContent = 'Pieces for this step';
      this.dom.search.style.display = 'none';
      this.dom.palette.style.display = 'none'; this.dom.palette.previousSibling.style.display = 'none';
      const st = this.session.currentStep();
      for (const p of this.session.stepPieces(st)) {
        const img = el('img', { alt: '' });
        this.partColorThumb(p.t, p.c, img);
        const done = p.remaining === 0;
        const btn = el('button', {
          class: 'part-btn' + (this.part === p.t && this.color === p.c ? ' sel' : '') + (done ? ' done' : ''),
          title: `${PART_BY_ID[p.t].name} — ${COLOR_BY_ID[p.c].name}`,
          onclick: () => { if (done) return; this.part = p.t; this.color = p.c; this.rot = p.r; this.refreshGhost(); this.renderTray(); },
        }, img, el('span', { class: 'pn', text: PART_BY_ID[p.t].name }), el('span', { class: 'swatch', style: { background: COLOR_BY_ID[p.c].hex } }), el('span', { class: 'cnt', text: done ? '✓' : `×${p.remaining}` }));
        grid.appendChild(btn);
      }
      return;
    }
    this.dom.trayTitle.textContent = 'Parts';
    this.dom.search.style.display = '';
    this.dom.palette.style.display = ''; this.dom.palette.previousSibling.style.display = '';
    const q = this.dom.search.value.trim().toLowerCase();
    for (const grp of PART_GROUPS) tabs.appendChild(el('button', { class: 'tab' + (grp === this.group && !q ? ' on' : ''), text: grp, onclick: () => { this.group = grp; this.dom.search.value = ''; this.renderTray(); } }));
    const list = PARTS.filter(p => (q ? p.name.toLowerCase().includes(q) : p.group === this.group));
    for (const p of list) {
      const unlocked = isPartUnlocked(p.id, this.g.save.unlockedParts);
      const img = el('img', { alt: '' });
      this.partColorThumb(p.id, this.color, img);
      grid.appendChild(el('button', {
        class: 'part-btn' + (this.part === p.id ? ' sel' : '') + (unlocked ? '' : ' locked'),
        title: unlocked ? p.name : `${p.name} — locked. Buy it in the Store's Parts Shop or complete a set that uses it.`,
        onclick: () => {
          if (!unlocked) { this.g.audio.play('error'); toast(`${p.name} is locked. Unlock it in the Store → Parts Shop (${money(p.unlock.cost)}) or by completing a set that uses it.`, 'info', 4500); return; }
          this.part = p.id; this.setTool('place'); this.refreshGhost(); this.renderTray();
        },
      }, img, el('span', { class: 'pn', text: p.name }), unlocked ? null : el('span', { class: 'lock', text: '🔒' })));
    }
    if (!list.length) grid.appendChild(el('p', { class: 'muted', text: 'No parts match that search.' }));
  }

  renderPalette() {
    const pal = clear(this.dom.palette);
    for (const c of COLORS) {
      pal.appendChild(el('button', {
        class: 'swatch-btn' + (c.id === this.color ? ' sel' : '') + (c.trans ? ' trans' : ''), title: c.name, 'aria-label': c.name, style: { background: c.hex },
        onclick: () => {
          if (this.mode === 'free' && this.tool === 'select' && this.selection.size) { this.recolorSelection(c.id); return; }
          this.color = c.id; this.renderPalette(); this.renderTray(); this.refreshGhost();
        },
      }));
    }
  }

  // ----------------------------------------------------------------- side panel
  renderSide() {
    const side = clear(this.dom.side);
    if (this.mode === 'free') {
      side.append(
        el('h3', { text: 'Your creation' }),
        el('p', { class: 'big-num', text: `${this.bricks.length.toLocaleString()} pieces` }),
        el('p', { class: 'muted', text: this.selection.size ? `${this.selection.size} selected — drag to move, arrow keys to nudge, PgUp/PgDn to lift, click a colour to repaint.` : `Build area: ${this.area.w} × ${this.area.d} studs.` }),
        el('div', { class: 'help' },
          el('h4', { text: 'Controls' }),
          ...[['Left-click', 'Place / select'], ['Left-drag', 'Move selected pieces'], ['Right-drag', 'Orbit camera'], ['Wheel', 'Zoom'], ['Middle-drag', 'Pan'], ['R', 'Rotate'], ['B / V', 'Place / Select tool'], ['Shift+click', 'Select several'], ['Alt+click', 'Pick up a piece & colour'], ['Ctrl+Z / Y', 'Undo / Redo'], ['Del', 'Delete'], ['Ctrl+D', 'Duplicate'], ['Esc', 'Clear selection']].map(([k, v]) => el('div', { class: 'kv' }, el('kbd', { text: k }), el('span', { text: v })))),
      );
      return;
    }
    if (this.mode === 'inspect') {
      side.append(el('h3', { text: this.set.name }), el('p', { class: 'muted', text: 'Completed! Orbit with right-drag and zoom with the wheel to admire it from every angle.' }),
        el('p', {}, el('b', { text: this.set.brickCount.toLocaleString() }), ' pieces'), el('p', { class: 'muted', text: this.set.desc }));
      return;
    }
    const s = this.session;
    const cur = s.currentStep();
    const view = Math.min(this.viewStep, s.steps.length - 1);
    const pct = Math.round(s.progress() * 100);
    // the instruction booklet, open at the step you're looking at
    const built = st => s.steps[st].every(i => s.placed.has(i));
    if (!this.book || this.book.set !== this.set) this.book = new BookView(this.g, this.set, { compact: true, page: pageOfStep(view), built, current: cur });
    this.book.opts.built = built; this.book.opts.current = cur;
    this.book.go(pageOfStep(view), this.book.page !== pageOfStep(view));
    side.append(
      el('div', { class: 'side-set' }, el('div', {}, el('h3', { text: this.set.name }), el('p', { class: 'muted', text: `${s.placed.size} / ${s.targets.length} pieces • ${pct}%` }))),
      el('div', { class: 'progress' }, el('div', { class: 'progress-fill', style: { width: pct + '%' } })),
      this.book.el,
      el('div', { class: 'step-head' },
        el('button', { class: 'btn small', text: '◀ Prev', disabled: view <= 0, onclick: () => this.gotoStep(view - 1) }),
        el('div', { class: 'step-num' }, el('span', { text: 'Step' }), el('b', { text: `${view + 1}` }), el('span', { text: `of ${s.steps.length}` })),
        el('button', { class: 'btn small', text: 'Next ▶', disabled: view >= cur || view >= s.steps.length - 1, onclick: () => this.gotoStep(view + 1) }),
      ),
      view < cur ? el('div', { class: 'review-note' }, el('span', { text: 'You are looking back at a finished step (shown in blue on the model).' }), el('button', { class: 'btn small primary', text: 'Back to current step', onclick: () => this.gotoStep(cur) })) : el('p', { class: 'muted small-tip', text: 'Find the orange-outlined pieces in the picture, pick them from the tray, then click the glowing spots.' }),
      el('button', { class: 'btn small ghost wide', text: '📖 Open the full booklet (I)', onclick: () => this.openBook() }),
    );
  }

  /** Full-screen booklet reader. Flick through every page, then jump back to building. */
  openBook() {
    if (!this.set) return;
    const s = this.session;
    const cur = s ? s.currentStep() : null;
    openBooklet(this.g, this.set, {
      page: s ? pageOfStep(Math.min(this.viewStep, s.steps.length - 1)) : 0,
      current: s && cur < s.steps.length ? cur : null,
      built: s ? (st => s.steps[st].every(i => s.placed.has(i))) : (() => true),
      maxStep: s ? cur : -1,
      onGoToStep: s ? (st => this.gotoStep(st)) : null,
    });
  }

  gotoStep(i) {
    const cur = this.session.currentStep();
    this.viewStep = Math.max(0, Math.min(i, cur, this.session.steps.length - 1));
    this.refreshTargets();
    this.renderSide();
  }

  // ================================================================= modes
  async enter(params = {}) {
    this.active = true;
    this.g.engine.setStage(this.stage);
    this.controls.enabled = true;
    this.controls.autoRotate = false;
    this.renderer.setDetail(this.g.engine.quality.detail, this.g.engine.quality.shadows);
    if (params.setId) {
      const set = this.g.setById(params.setId);
      const own = this.g.ownership(params.setId);
      if (!set || !own) { toast('You need to own that set first.', 'error'); return this.g.show('store'); }
      if (own.state === 'unopened') return this.g.show('opening', { setId: set.id });
      if (own.state === 'completed' && !params.rebuild) this.startInspect(set);
      else this.startInstructions(set, own);
    } else if (params.bricks) {
      this.startFree(params.bricks, params.name || 'Remix');
    } else this.startFree();
  }

  async leave() {
    this.active = false;
    this.controls.enabled = false;
    this.clearGhost();
    this.dragging = null;
    if (this.mode === 'free') this.persistWorkbench();
    await this.g.flushSave();
    return true;
  }

  startFree(bricks, name) {
    this.mode = 'free';
    this.session = null; this.set = null;
    this.area = { ...BUILD_AREA };
    const wb = this.g.save.workbench;
    if (bricks) { wb.bricks = cloneBricks(bricks); wb.name = name; wb.buildId = null; }
    this.bricks = cloneBricks(wb.bricks);
    this.occ = new Occupancy(this.bricks);
    this.selection.clear();
    this.undoStack = []; this.redoStack = [];
    this.setPlate(this.area.w, this.area.d, '#3f9b4f');
    this.renderer.setHighlighted([]);
    this.renderer.setBricks(this.bricks);
    clear(this.targetGroup);
    this.dom.pill.textContent = 'FREE BUILD';
    this.dom.name.textContent = wb.name;
    if (!isPartUnlocked(this.part, this.g.save.unlockedParts)) this.part = 'brick_2x4';
    this.setTool('place');
    this.resetCamera();
    this.renderTray(); this.renderPalette(); this.renderSide(); this.updateToolbar();
    this.setHint('Left-click to place • Right-drag to orbit • Wheel to zoom • R to rotate • V to select & move');
  }

  startInstructions(set, own) {
    this.mode = 'instructions';
    this.set = set;
    const margin = 5;
    const pw = Math.max(16, set.dims.w + margin * 2), pd = Math.max(16, set.dims.d + margin * 2);
    this.area = { w: pw, d: pd, maxY: set.dims.h + 60 };
    const offset = { x: Math.floor((pw - set.dims.w) / 2), z: Math.floor((pd - set.dims.d) / 2) };
    this.session = new InstructionSession(set, own, offset);
    this.book = null;
    this.selection.clear();
    this.setPlate(pw, pd, '#a6adb8');
    this.renderer.setHighlighted([]);
    this.syncInstructionBricks();
    this.viewStep = this.session.currentStep();
    this.tool = 'place';
    this.pickFirstPiece();
    this.dom.pill.textContent = 'INSTRUCTIONS';
    this.dom.name.textContent = set.name;
    this.refreshTargets();
    this.resetCamera();
    this.renderTray(); this.renderSide(); this.updateToolbar();
    this.setHint('Choose a piece on the left, then click its glowing spot • Right-drag to orbit • Wheel to zoom • H for a hint');
    if (this.session.isComplete()) this.finishSet();
  }

  startInspect(set) {
    this.mode = 'inspect';
    this.set = set;
    const pw = set.dims.w + 10, pd = set.dims.d + 10;
    this.area = { w: pw, d: pd, maxY: 999 };
    this.setPlate(pw, pd, '#a6adb8');
    const ox = 5, oz = 5;
    this.bricks = set.bricks.map(b => ({ ...b, x: b.x + ox, z: b.z + oz }));
    this.renderer.setHighlighted([]);
    this.renderer.setBricks(this.bricks);
    clear(this.targetGroup);
    this.clearGhost();
    this.dom.pill.textContent = 'COMPLETED';
    this.dom.name.textContent = set.name;
    this.resetCamera();
    this.renderSide(); this.updateToolbar();
    this.setHint('Right-drag to orbit • Wheel to zoom • Middle-drag to pan');
  }

  syncInstructionBricks() {
    this.bricks = this.session.placedBricks();
    this.occ = new Occupancy(this.bricks);
    this.renderer.setBricks(this.bricks);
  }

  pickFirstPiece() {
    const st = this.session.currentStep();
    const first = this.session.stepPieces(st).find(p => p.remaining > 0);
    if (first) { this.part = first.t; this.color = first.c; this.rot = first.r; }
  }

  refreshTargets() {
    for (const c of [...this.targetGroup.children]) { this.targetGroup.remove(c); c.userData.material && c.userData.material.dispose(); }
    if (this.mode !== 'instructions') return;
    if (this.bagNeeded() >= 0) { this.clearGhost(); return; }
    const s = this.session;
    const cur = s.currentStep();
    if (this.viewStep < cur) {
      this.renderer.setHighlighted(s.steps[this.viewStep].map(i => s.targets[i]).filter(Boolean));
      return;
    }
    this.renderer.setHighlighted([]);
    for (const i of s.remaining(cur)) {
      const t = s.targets[i];
      const gh = makeGhost(t.t, COLOR_BY_ID[t.c].hex, this.g.engine.quality.detail ? 1 : 0);
      gh.userData.target = i;
      gh.userData.baseEmissive = gh.userData.material.emissive.clone();
      placeObject(gh, t);
      this.targetGroup.add(gh);
    }
  }

  // ================================================================= camera
  resetCamera() {
    const pts = this.mode === 'instructions' ? this.session.targets : this.bricks;
    const bb = pts.length ? boundsOf(pts) : null;
    const frameList = bb ? pts : [{ t: 'plate_8x8', x: this.area.w / 2 - 8, y: 0, z: this.area.d / 2 - 8, r: 0, c: 'white' }, { t: 'brick_1x1', x: this.area.w / 2 + 8, y: 6, z: this.area.d / 2 + 8, r: 0, c: 'white' }];
    const { target } = frameModel(this.camera, frameList, new THREE.Vector3(), this.mode === 'free' && !bb ? 1.2 : this.mode === 'inspect' ? 0.85 : 0.68);
    if (this.mode === 'instructions') target.y = Math.max(1, target.y * 0.8);
    this.controls.target.copy(target);
    this.controls.update();
    fitShadow(this.key, bb ? { ...bb, minX: Math.min(bb.minX, 0), minZ: Math.min(bb.minZ, 0), maxX: Math.max(bb.maxX, this.area.w), maxZ: Math.max(bb.maxZ, this.area.d) } : { minX: 0, maxX: this.area.w, minZ: 0, maxZ: this.area.d, minY: 0, maxY: 20 }, this.g.engine.quality.shadowSize);
  }

  // ================================================================= input
  bindInput() {
    const canvas = this.g.engine.canvas;
    canvas.addEventListener('pointermove', e => this.active && this.onMove(e));
    canvas.addEventListener('pointerdown', e => this.active && this.onDown(e));
    window.addEventListener('pointerup', e => this.active && this.onUp(e));
    canvas.addEventListener('pointerleave', () => { if (this.active && !this.dragging) this.clearGhostVisual(); });
    window.addEventListener('keydown', e => this.active && this.onKey(e));
    window.addEventListener('blur', () => { if (this.dragging) this.cancelDrag(); });
  }

  setNdc(e) {
    const r = this.g.engine.canvas.getBoundingClientRect();
    _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    _ray.setFromCamera(_ndc, this.camera);
  }

  onMove(e) {
    this.lastPointer = e;
    this.setNdc(e);
    if (this.down && !this.dragging && this.down.dragCandidate && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5) this.beginDrag();
    if (this.dragging) { this.updateDrag(); return; }
    if (this.down && (e.buttons & 6)) return;    // orbiting/panning: don't jitter the ghost
    if (this.mode === 'inspect') return;
    if (this.mode === 'instructions') this.hoverTargets();
    if (this.mode === 'instructions' && this.bagNeeded() >= 0) { this.clearGhostVisual(); return; }
    if (this.tool === 'place' || this.mode === 'instructions') this.updateGhost();
    else { this.clearGhostVisual(); const hit = this.renderer.pick(_ray); this.hovered = hit ? hit.brick : null; this.g.engine.canvas.style.cursor = this.hovered ? 'pointer' : ''; }
  }

  onDown(e) {
    this.setNdc(e);
    this.down = { x: e.clientX, y: e.clientY, button: e.button, time: performance.now() };
    if (e.button !== 0 || this.mode !== 'free' || this.tool !== 'select') return;
    const hit = this.renderer.pick(_ray);
    if (hit && this.selection.has(hit.brick)) { this.down.dragCandidate = true; this.down.hit = hit; }
  }

  onUp(e) {
    const d = this.down;
    this.down = null;
    if (!d || e.button !== 0) return;
    if (this.dragging) { this.endDrag(); return; }
    if (e.target !== this.g.engine.canvas) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
    this.setNdc(e);
    this.click(e);
  }

  onKey(e) {
    if (anyModalOpen()) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && k === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); }
    else if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); this.redo(); }
    else if (ctrl && k === 'd') { e.preventDefault(); this.duplicate(); }
    else if (ctrl && k === 's') { e.preventDefault(); if (this.mode === 'free') this.saveBuild(); else this.g.flushSave(true); }
    else if (ctrl && k === 'a' && this.mode === 'free') { e.preventDefault(); this.setTool('select'); this.setSelection(this.bricks); }
    else if (ctrl) return;
    else if (k === 'r') this.rotate(e.shiftKey ? -1 : 1);
    else if (k === 'delete' || k === 'backspace') { e.preventDefault(); this.deleteSelection(); }
    else if (k === 'escape') { if (this.selection.size) this.setSelection([]); else if (this.mode === 'free') this.setTool('place'); }
    else if (k === 'b' && this.mode === 'free') this.setTool('place');
    else if (k === 'v' && this.mode === 'free') this.setTool('select');
    else if (k === 'c') this.resetCamera();
    else if (k === 'p') this.screenshot();
    else if (k === 'h' && this.mode === 'instructions') this.hint();
    else if (k === 'i' && this.mode !== 'free') this.openBook();
    else if (this.mode === 'free' && this.selection.size && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'pageup', 'pagedown'].includes(k)) {
      e.preventDefault();
      // move relative to the camera's view so "up" always means "away from me"
      const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd);
      const ax = Math.abs(fwd.x) > Math.abs(fwd.z);
      const sx = Math.sign(ax ? fwd.x : fwd.z) || 1;
      let dx = 0, dz = 0, dy = 0;
      if (k === 'pageup') dy = 1; else if (k === 'pagedown') dy = -1;
      else if (k === 'arrowup' || k === 'arrowdown') { const s = k === 'arrowup' ? sx : -sx; if (ax) dx = s; else dz = s; }
      else { const s = (k === 'arrowright' ? -1 : 1) * sx; if (ax) dz = -s; else dx = s; }
      this.nudge(dx, dy, dz);
    }
  }

  // ================================================================= ghost & placement
  clearGhost() { if (this.ghost) { this.world.remove(this.ghost); this.ghost.userData.material.dispose(); this.ghost = null; } this.ghostBox.visible = false; this.ghostKey = null; }
  clearGhostVisual() { if (this.ghost) this.ghost.visible = false; this.ghostBox.visible = false; this.placement = null; }
  refreshGhost() { this.clearGhost(); if (this.lastPointer && this.active) this.onMove(this.lastPointer); }

  ensureGhost() {
    const key = this.part + '|' + this.color;
    if (this.ghostKey === key && this.ghost) return;
    this.clearGhost();
    this.ghost = makeGhost(this.part, COLOR_BY_ID[this.color].hex, this.g.engine.quality.detail ? 1 : 0);
    this.ghost.userData.material.opacity = 0.62;
    this.world.add(this.ghost);
    this.ghostKey = key;
  }

  /** Work out where the selected piece would go under the mouse. */
  computePlacement() {
    const part = PART_BY_ID[this.part];
    if (!part) return null;
    const f = footprint(part, this.rot);
    const hit = this.renderer.pick(_ray);
    const ground = _ray.ray.intersectPlane(_plane, _v) ? _v.clone() : null;
    let x, y, z, fromAbove = true;
    if (hit && (!ground || hit.point.distanceTo(_ray.ray.origin) <= ground.distanceTo(_ray.ray.origin) + 0.01)) {
      const hb = hit.brick, hp = PART_BY_ID[hb.t];
      const p = hit.point, n = hit.normal;
      const topY = (hb.y + hp.h) * PLATE_H;
      if (n.y > 0.3 || p.y >= topY - 0.03) { y = hb.y + hp.h; x = Math.round(p.x - f.w / 2); z = Math.round(p.z - f.d / 2); }
      else if (n.y < -0.5) { y = hb.y - part.h; x = Math.round(p.x - f.w / 2); z = Math.round(p.z - f.d / 2); fromAbove = false; }
      else {
        const q = p.clone().addScaledVector(n, 0.5);
        y = hb.y; fromAbove = false;
        if (Math.abs(n.x) > Math.abs(n.z)) { x = n.x > 0 ? Math.floor(q.x) : Math.floor(q.x) - f.w + 1; z = Math.round(p.z - f.d / 2); }
        else { z = n.z > 0 ? Math.floor(q.z) : Math.floor(q.z) - f.d + 1; x = Math.round(p.x - f.w / 2); }
      }
    } else if (ground) { y = 0; x = Math.round(ground.x - f.w / 2); z = Math.round(ground.z - f.d / 2); }
    else return null;
    const b = { t: this.part, x, y, z, r: this.rot, c: this.color };
    // stack on top automatically if the spot is taken
    if (fromAbove) for (let i = 0; i < 40 && this.occ.collides(b); i++) b.y++;
    return { b, ...this.validate(b) };
  }

  validate(b, ignore) {
    const part = PART_BY_ID[b.t];
    const f = footprint(part, b.r);
    if (b.x < 0 || b.z < 0 || b.x + f.w > this.area.w || b.z + f.d > this.area.d) return { valid: false, reason: 'Outside the building plate' };
    if (b.y < 0) return { valid: false, reason: 'Below the plate' };
    if (b.y + part.h > this.area.maxY) return { valid: false, reason: 'Too high' };
    if (this.occ.collides(b, ignore)) return { valid: false, reason: 'Something is already there' };
    if (!this.occ.supported(b, ignore)) return { valid: false, reason: 'It needs something to connect to' };
    return { valid: true };
  }

  updateGhost() {
    const pl = this.computePlacement();
    this.placement = pl;
    if (!pl) { this.clearGhostVisual(); return; }
    this.ensureGhost();
    this.ghost.visible = true;
    placeObject(this.ghost, pl.b);
    const part = PART_BY_ID[pl.b.t], f = footprint(part, pl.b.r);
    this.ghostBox.visible = true;
    this.ghostBox.scale.set(f.w + 0.04, part.h * PLATE_H + 0.04, f.d + 0.04);
    this.ghostBox.position.set(pl.b.x + f.w / 2, pl.b.y * PLATE_H + part.h * PLATE_H / 2, pl.b.z + f.d / 2);
    let ok = pl.valid;
    if (this.mode === 'instructions' && ok) ok = this.session.match(pl.b) >= 0;
    const gk = `${pl.b.x},${pl.b.y},${pl.b.z},${pl.b.r}`;
    if (gk !== this.lastGhostKey) { this.lastGhostKey = gk; this.g.audio.play('tick'); }
    this.ghostBox.material.color.set(ok ? 0x22c55e : 0xef4444);
    this.ghost.userData.material.emissive.set(ok ? 0x0b3d1d : 0x5a0b0b);
    this.g.engine.canvas.style.cursor = pl.valid ? 'crosshair' : 'not-allowed';
  }

  hoverTargets() {
    const hits = _ray.intersectObjects(this.targetGroup.children, true);
    const hitT = hits.length ? hits[0].object.parent.userData.target : undefined;
    for (const gh of this.targetGroup.children) gh.userData.hover = gh.userData.target === hitT;
    this.hoverTarget = hitT;
  }

  /** Drop a piece in with a bounce; the real piece appears (and clicks) as it lands. */
  dropIn(b, onLand) {
    const part = PART_BY_ID[b.t];
    this.renderer.hidden.add(b);
    this.fx.drop(b, this.g.engine.quality.detail, {
      onLand: () => {
        this.g.audio.place(Math.max(part.w, part.d) * (part.h >= 3 ? 1.3 : 0.8), b.y > 0);
        this.fx.burst(b, part.w * part.d > 8 ? 1.3 : 1);
        onLand && onLand();
      },
      onDone: () => { this.renderer.hidden.delete(b); this.renderer.rebuild(); },
    });
  }

  // ================================================================= clicking
  click(e) {
    if (this.mode === 'inspect') return;
    if (this.mode === 'instructions') return this.instructionClick();
    if (e.altKey) {
      const hit = this.renderer.pick(_ray);
      if (hit) { this.part = hit.brick.t; this.color = hit.brick.c; this.rot = hit.brick.r; this.group = PART_BY_ID[hit.brick.t].group; this.setTool('place'); this.renderTray(); this.renderPalette(); this.refreshGhost(); toast(`Picked up ${PART_BY_ID[hit.brick.t].name} (${COLOR_BY_ID[hit.brick.c].name})`, 'info', 1500); }
      return;
    }
    if (this.tool === 'select') {
      const hit = this.renderer.pick(_ray);
      if (!hit) { if (!e.shiftKey) this.setSelection([]); return; }
      const sel = new Set(e.shiftKey ? this.selection : []);
      if (e.shiftKey && sel.has(hit.brick)) sel.delete(hit.brick); else sel.add(hit.brick);
      this.setSelection([...sel]);
      return;
    }
    const pl = this.computePlacement();
    if (!pl) return;
    if (!pl.valid) { this.g.audio.play('error'); this.banner(pl.reason, 'bad'); return; }
    this.pushUndo();
    const nb = { ...pl.b };
    this.bricks.push(nb);
    this.occ.add(nb);
    this.dropIn(nb);
    this.renderer.setBricks(this.bricks);
    this.g.prog.recordBricks(1, 'free');
    this.afterFreeChange();
    this.updateGhost();
  }

  instructionClick() {
    const s = this.session;
    const nb = this.bagNeeded();
    if (nb >= 0) { this.g.audio.play('error'); this.banner(`Open bag ${nb + 1} first — the button is on the left.`, 'bad'); return; }
    this.hoverTargets();
    if (this.viewStep < s.currentStep()) { this.gotoStep(s.currentStep()); return; }
    let idx = -1;
    if (this.hoverTarget !== undefined) {
      const t = s.targets[this.hoverTarget];
      if (t.t === this.part && t.c === this.color) idx = this.hoverTarget;
      else {
        this.wrongFeedback(this.hoverTarget, `This spot needs a ${COLOR_BY_ID[t.c].name} ${PART_BY_ID[t.t].name}. It's selected for you now — click again!`);
        this.part = t.t; this.color = t.c; this.rot = t.r; this.renderTray(); this.refreshGhost();
        return;
      }
    } else {
      const pl = this.computePlacement();
      if (!pl) return;
      idx = s.match(pl.b);
      if (idx < 0) {
        const near = s.nearMiss(pl.b);
        if (near >= 0) {
          const t = s.targets[near];
          if (t.t !== pl.b.t) this.wrongFeedback(near, `Wrong piece — this spot needs a ${PART_BY_ID[t.t].name}.`);
          else if (t.c !== pl.b.c) this.wrongFeedback(near, `Right shape, wrong colour — it should be ${COLOR_BY_ID[t.c].name}.`);
          else this.wrongFeedback(near, 'Almost! Press R to rotate the piece.');
        } else this.wrongFeedback(null, pl.valid ? 'Not there — look for the glowing outline.' : pl.reason);
        return;
      }
    }
    this.placeTarget(idx);
  }

  wrongFeedback(targetIdx, msg) {
    this.session.mistakes++;
    this.g.save.stats.mistakes++;
    this.g.audio.play('error');
    this.banner(msg, 'bad');
    for (const gh of this.targetGroup.children) if (targetIdx == null || gh.userData.target === targetIdx) { gh.userData.wrong = performance.now() + 450; gh.userData.material.emissive.set(0xff2222); }
  }

  placeTarget(idx) {
    const s = this.session;
    const res = s.place(idx);
    if (!res) return;
    const t = s.targets[idx];
    this.dropIn(t);
    this.syncInstructionBricks();
    this.g.prog.recordBricks(1, 'set');
    if (res.stepDone) {
      this.g.prog.onStep();
      if (!res.finished) {
        setTimeout(() => this.g.audio.play('step'), 140);
        this.banner(`Step ${s.currentStep()} complete! On to step ${s.currentStep() + 1}.`, 'good');
        const f = footprint(PART_BY_ID[t.t], t.r);
        this.fx.celebrate(new THREE.Vector3(t.x + f.w / 2, (t.y + PART_BY_ID[t.t].h) * PLATE_H, t.z + f.d / 2), 24);
      }
    }
    this.viewStep = s.currentStep();
    if (res.stepDone || !s.stepPieces(s.currentStep()).some(p => p.t === this.part && p.c === this.color && p.remaining)) this.pickFirstPiece();
    this.refreshTargets(); this.renderTray(); this.renderSide(); this.updateToolbar(); this.refreshGhost();
    this.g.requestSave();
    if (res.finished) this.finishSet();
    else if (res.stepDone && this.bagNeeded() >= 0) { this.banner(`Bag ${this.bagNeeded()} finished! Open bag ${this.bagNeeded() + 1} to keep going.`, 'good'); this.g.audio.play('sparkle'); }
  }

  hint() {
    if (this.mode !== 'instructions') return;
    const s = this.session;
    if (this.viewStep !== s.currentStep()) this.gotoStep(s.currentStep());
    const rem = s.remaining(s.currentStep());
    if (!rem.length) return;
    const t = s.targets[rem[0]];
    this.part = t.t; this.color = t.c; this.rot = t.r;
    this.renderTray(); this.refreshGhost();
    const f = footprint(PART_BY_ID[t.t], t.r);
    const target = new THREE.Vector3(t.x + f.w / 2, t.y * PLATE_H, t.z + f.d / 2);
    const off = this.camera.position.clone().sub(this.controls.target);
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(off.setLength(Math.min(off.length(), 26)));
    for (const gh of this.targetGroup.children) if (gh.userData.target === rem[0]) { gh.userData.wrong = performance.now() + 900; gh.userData.material.emissive.set(0xffee55); }
    this.banner(`Next: ${COLOR_BY_ID[t.c].name} ${PART_BY_ID[t.t].name}`, 'good');
  }

  autoPlace() {
    if (this.mode !== 'instructions' || this.bagNeeded() >= 0) return;
    const rem = this.session.remaining(this.session.currentStep());
    if (rem.length) this.placeTarget(rem[0]);
  }

  async finishSet() {
    const set = this.set, own = this.g.ownership(set.id);
    const firstTime = (own.timesCompleted || 0) === 0;
    own.state = 'completed';
    own.completedAt = Date.now();
    own.timesCompleted = (own.timesCompleted || 0) + 1;
    autoShelve(this.g.save, set.id);          // your finished build goes straight onto a shelf
    this.g.audio.play('complete');
    { const bb = boundsOf(this.session.targets); this.fx.celebrate(new THREE.Vector3((bb.minX + bb.maxX) / 2, bb.maxY * PLATE_H + 1, (bb.minZ + bb.maxZ) / 2), 90); }
    const r = this.g.prog.onSetComplete(set, firstTime, this.session.mistakes);
    await this.g.flushSave();
    this.g.emit('owned', set.id);
    this.controls.autoRotate = true; this.controls.autoRotateSpeed = 2.5;
    clear(this.targetGroup); this.clearGhost();
    const confetti = el('div', { class: 'confetti' });
    for (let i = 0; i < 60; i++) confetti.appendChild(el('i', { style: { left: Math.random() * 100 + '%', animationDelay: Math.random() * 0.8 + 's', background: ['#f43f5e', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#fb923c'][i % 6] } }));
    const body = el('div', { class: 'celebrate' }, confetti,
      el('p', { class: 'celebrate-title', text: `You built ${set.name}!` }),
      el('div', { class: 'reward-row' },
        el('div', { class: 'reward' }, el('b', { text: '+' + money(r.cash) }), el('span', { text: r.bonusPct ? `incl. ${r.bonusPct}% streak bonus` : 'reward' })),
        el('div', { class: 'reward' }, el('b', { text: `+${r.xp} XP` }), el('span', { text: 'experience' })),
        el('div', { class: 'reward' }, el('b', { text: set.brickCount.toLocaleString() }), el('span', { text: 'pieces placed' }))),
      r.perfect ? el('p', { class: 'perfect', text: '🎯 Perfect build — no wrong placements!' }) : null,
      r.newParts && r.newParts.length ? el('p', { class: 'muted', text: `New studio parts: ${r.newParts.map(t => PART_BY_ID[t].name).join(', ')}` }) : null,
      firstTime ? null : el('p', { class: 'muted', text: 'Rebuilds earn a smaller reward than the first build.' }));
    modal({
      title: '🎉 Model complete!', body, className: 'modal-celebrate',
      actions: [
        { label: 'Keep admiring', onClick: () => { this.startInspect(set); setTimeout(() => { this.controls.autoRotate = false; }, 6000); } },
        { label: 'My Collection', onClick: () => this.g.show('collection') },
        { label: 'See it on your shelf', kind: 'primary', onClick: () => this.g.show('room', { focus: set.id }) },
      ],
      onClose: () => { if (this.mode === 'instructions') this.startInspect(set); },
    });
  }

  async rebuild() {
    if (!this.set) return;
    const ok = await confirmBox('Rebuild this model?', 'The model will be taken apart so you can build it again from step 1. You keep the set, and rebuilds earn a small bonus.', 'Take it apart');
    if (!ok) return;
    const own = this.g.ownership(this.set.id);
    own.state = 'opened'; own.placed = [];
    this.g.requestSave(true);
    this.startInstructions(this.set, own);
  }
  remix() {
    if (!this.set) return;
    const bricks = this.set.bricks;
    const bb = boundsOf(bricks);
    if (bb.maxX > BUILD_AREA.w || bb.maxZ > BUILD_AREA.d) { toast('This model is too big for the free Build Studio plate.', 'error'); return; }
    const ox = Math.floor((BUILD_AREA.w - bb.maxX) / 2), oz = Math.floor((BUILD_AREA.d - bb.maxZ) / 2);
    this.startFree(bricks.map(b => ({ ...b, x: b.x + ox, z: b.z + oz })), this.set.name + ' Remix');
    this.persistWorkbench();
    toast('Copied into the Build Studio — change anything you like!', 'success');
  }

  // ================================================================= free-build editing
  setTool(t) {
    if (this.mode !== 'free') t = 'place';
    this.tool = t;
    if (t === 'place') { this.setSelection([]); }
    else this.clearGhostVisual();
    this.g.engine.canvas.style.cursor = '';
    this.updateToolbar();
  }

  setSelection(list) {
    this.selection = new Set(list);
    this.renderer.setHighlighted(this.selection);
    if (this.mode === 'free') this.renderSide();
  }

  pushUndo() {
    this.undoStack.push(cloneBricks(this.bricks));
    if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
    this.redoStack = [];
  }

  restore(list) {
    this.bricks = cloneBricks(list);
    this.occ = new Occupancy(this.bricks);
    this.selection.clear();
    this.renderer.setHighlighted([]);
    this.renderer.setBricks(this.bricks);
    this.afterFreeChange();
  }

  undo() {
    if (this.mode === 'instructions') {
      const i = this.session.undo();
      if (i == null) return;
      this.syncInstructionBricks(); this.viewStep = this.session.currentStep();
      this.refreshTargets(); this.renderTray(); this.renderSide(); this.updateToolbar(); this.g.audio.play('remove'); this.g.requestSave();
      return;
    }
    if (this.mode !== 'free' || !this.undoStack.length) return;
    this.redoStack.push(cloneBricks(this.bricks));
    this.restore(this.undoStack.pop());
    this.g.audio.play('remove');
  }
  redo() {
    if (this.mode === 'instructions') {
      const i = this.session.redo();
      if (i == null) return;
      this.syncInstructionBricks(); this.viewStep = this.session.currentStep();
      this.refreshTargets(); this.renderTray(); this.renderSide(); this.updateToolbar(); this.g.audio.play('place'); this.g.requestSave();
      if (this.session.isComplete()) this.finishSet();
      return;
    }
    if (this.mode !== 'free' || !this.redoStack.length) return;
    this.undoStack.push(cloneBricks(this.bricks));
    this.restore(this.redoStack.pop());
    this.g.audio.play('place');
  }

  afterFreeChange() {
    this.renderSide();
    this.updateToolbar();
    this.persistWorkbench();
  }
  persistWorkbench() {
    if (this.mode !== 'free') return;
    this.g.save.workbench.bricks = cloneBricks(this.bricks);
    this.g.requestSave();
  }

  rotate(dir = 1) {
    if (this.mode === 'free' && this.tool === 'select' && this.selection.size) return this.rotateSelection(dir);
    this.rot = (this.rot + (dir > 0 ? 1 : 3)) % 4;
    this.refreshGhost();
  }

  deleteSelection() {
    if (this.mode !== 'free') return;
    let targets = [...this.selection];
    if (!targets.length) {
      if (this.lastPointer) this.setNdc(this.lastPointer);
      const hit = this.renderer.pick(_ray);
      if (hit) targets = [hit.brick];
    }
    if (!targets.length) { toast('Hover over a piece or select pieces first, then press Delete.', 'info'); return; }
    this.pushUndo();
    const kill = new Set(targets);
    this.bricks = this.bricks.filter(b => !kill.has(b));
    this.occ = new Occupancy(this.bricks);
    this.setSelection([]);
    this.renderer.setBricks(this.bricks);
    this.g.audio.play('remove');
    this.afterFreeChange();
  }

  recolorSelection(c) {
    this.pushUndo();
    for (const b of this.selection) b.c = c;
    this.renderer.rebuild();
    this.color = c; this.renderPalette();
    this.afterFreeChange();
  }

  groupValid(list, ignore) {
    const occ = this.occ;
    for (const b of list) {
      const part = PART_BY_ID[b.t], f = footprint(part, b.r);
      if (b.x < 0 || b.z < 0 || b.y < 0 || b.x + f.w > this.area.w || b.z + f.d > this.area.d || b.y + part.h > this.area.maxY) return false;
      if (occ.collides(b, ignore)) return false;
    }
    return list.some(b => occ.supported(b, ignore)) || list.some(b => b.y === 0);
  }

  nudge(dx, dy, dz) {
    const sel = [...this.selection];
    const before = cloneBricks(this.bricks);
    for (const b of sel) { b.x += dx; b.y += dy; b.z += dz; }
    if (!this.groupValid(sel, this.selection)) {
      for (const b of sel) { b.x -= dx; b.y -= dy; b.z -= dz; }
      this.g.audio.play('error'); this.banner("Can't move there", 'bad'); return;
    }
    this.undoStack.push(before); this.redoStack = [];
    this.occ = new Occupancy(this.bricks);
    this.renderer.setHighlighted(this.selection);
    this.afterFreeChange();
  }

  rotateSelection(dir) {
    const sel = [...this.selection];
    const bb = boundsOf(sel);
    const cx = Math.floor((bb.minX + bb.maxX) / 2), cz = Math.floor((bb.minZ + bb.maxZ) / 2);
    const before = cloneBricks(this.bricks);
    const old = sel.map(b => ({ x: b.x, z: b.z, r: b.r }));
    for (const b of sel) {
      const f = footprint(PART_BY_ID[b.t], b.r);
      const x0 = b.x, x1 = b.x + f.w, z0 = b.z, z1 = b.z + f.d;
      if (dir > 0) { b.x = cx + (z0 - cz); b.z = cz - (x1 - cx); b.r = (b.r + 1) % 4; }
      else { b.x = cx - (z1 - cz); b.z = cz + (x0 - cx); b.r = (b.r + 3) % 4; }
    }
    if (!this.groupValid(sel, this.selection)) {
      sel.forEach((b, i) => Object.assign(b, old[i]));
      this.g.audio.play('error'); this.banner("Not enough room to turn it here", 'bad'); return;
    }
    this.undoStack.push(before); this.redoStack = [];
    this.occ = new Occupancy(this.bricks);
    this.renderer.setHighlighted(this.selection);
    this.g.audio.play('connect');
    this.afterFreeChange();
  }

  duplicate() {
    if (this.mode !== 'free' || !this.selection.size) { if (this.mode === 'free') toast('Select pieces first (V), then duplicate.', 'info'); return; }
    const sel = [...this.selection];
    const bb = boundsOf(sel);
    const h = bb.maxY - bb.minY, w = bb.maxX - bb.minX, d = bb.maxZ - bb.minZ;
    const tries = [[0, h, 0], [w, 0, 0], [0, 0, d], [-w, 0, 0], [0, 0, -d], [1, 0, 1], [0, h * 2, 0]];
    for (const [dx, dy, dz] of tries) {
      const copy = sel.map(b => ({ ...b, x: b.x + dx, y: b.y + dy, z: b.z + dz }));
      if (!copy.every(b => this.validate(b).valid || (!this.occ.collides(b) && b.x >= 0 && b.z >= 0))) continue;
      const occ2 = new Occupancy(this.bricks);
      if (copy.some(b => occ2.collides(b))) continue;
      const allIn = copy.every(b => { const f = footprint(PART_BY_ID[b.t], b.r); return b.x >= 0 && b.z >= 0 && b.x + f.w <= this.area.w && b.z + f.d <= this.area.d && b.y + PART_BY_ID[b.t].h <= this.area.maxY; });
      if (!allIn) continue;
      this.pushUndo();
      this.bricks.push(...copy);
      this.occ = new Occupancy(this.bricks);
      this.renderer.setBricks(this.bricks);
      this.setSelection(copy);
      this.g.audio.play('connect');
      this.g.prog.recordBricks(copy.length, 'free');
      this.afterFreeChange();
      this.banner(`Duplicated ${copy.length} piece${copy.length > 1 ? 's' : ''} — drag to move them`, 'good');
      return;
    }
    this.g.audio.play('error'); this.banner('No room to put a copy', 'bad');
  }

  // ----------------------------------------------------------------- dragging groups
  beginDrag() {
    const hit = this.down.hit;
    const y = hit.point.y;
    this.dragging = {
      plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -y),
      start: hit.point.clone(),
      orig: new Map([...this.selection].map(b => [b, { x: b.x, z: b.z }])),
      before: cloneBricks(this.bricks),
      dx: 0, dz: 0, valid: true,
    };
    this.controls.enabled = false;
    this.g.engine.canvas.style.cursor = 'grabbing';
  }
  updateDrag() {
    const d = this.dragging;
    const p = _ray.ray.intersectPlane(d.plane, _v);
    if (!p) return;
    const dx = Math.round(p.x - d.start.x), dz = Math.round(p.z - d.start.z);
    if (dx === d.dx && dz === d.dz) return;
    d.dx = dx; d.dz = dz;
    for (const [b, o] of d.orig) { b.x = o.x + dx; b.z = o.z + dz; }
    d.valid = this.groupValid([...this.selection], this.selection);
    this.renderer.outline.children.forEach(l => l.material.color.set(d.valid ? 0x1e90ff : 0xef4444));
    this.renderer.rebuild();
    this.renderer.outline.children.forEach(l => l.material.color.set(d.valid ? 0x1e90ff : 0xef4444));
  }
  endDrag() {
    const d = this.dragging;
    this.dragging = null;
    this.controls.enabled = true;
    this.g.engine.canvas.style.cursor = '';
    if (!d.valid || (d.dx === 0 && d.dz === 0)) {
      for (const [b, o] of d.orig) { b.x = o.x; b.z = o.z; }
      this.renderer.rebuild();
      if (!d.valid) { this.g.audio.play('error'); this.banner("Can't put them there — moved back", 'bad'); }
      return;
    }
    this.undoStack.push(d.before); this.redoStack = [];
    this.occ = new Occupancy(this.bricks);
    this.renderer.rebuild();
    this.g.audio.play('connect');
    this.afterFreeChange();
  }
  cancelDrag() { this.down = { hit: null }; this.endDrag(); this.dragging = null; }

  // ================================================================= files & saving
  async newBuild() {
    if (this.bricks.length && !(await confirmBox('Start a new creation?', 'Your current creation will be cleared from the studio. (Saved creations are kept — use Save first if you want to keep this one.)', 'Start new', 'danger'))) return;
    this.pushUndo();
    this.g.save.workbench = { name: 'My Creation', buildId: null, bricks: [] };
    this.startFree();
  }

  async saveBuild() {
    if (this.mode !== 'free') return;
    if (!this.bricks.length) { toast('Place some pieces before saving.', 'info'); return; }
    const wb = this.g.save.workbench;
    const name = await promptBox('Save creation', 'Name your creation', wb.name || 'My Creation');
    if (!name) return;
    const list = this.g.save.customBuilds;
    let entry = list.find(b => b.id === wb.buildId && b.name === name);
    if (!entry) {
      if (list.length >= 200) { toast('You have 200 saved creations — delete some to save more.', 'error'); return; }
      entry = { id: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, created: Date.now(), updated: Date.now(), bricks: [] };
      list.push(entry);
    }
    entry.name = name; entry.updated = Date.now(); entry.bricks = cloneBricks(this.bricks);
    wb.name = name; wb.buildId = entry.id;
    this.dom.name.textContent = name;
    this.g.prog.checkAchievements();
    const ok = await this.g.flushSave();
    if (ok) toast(`Saved "${name}" (${this.bricks.length} pieces).`, 'save');
  }

  loadDialog() {
    const list = this.g.save.customBuilds.slice().sort((a, b) => b.updated - a.updated);
    const body = el('div', { class: 'build-list' });
    if (!list.length) body.appendChild(el('p', { class: 'muted', text: 'No saved creations yet. Build something and press Save!' }));
    let m;
    for (const b of list) {
      const img = el('img', { alt: '' });
      if (b.bricks.length) this.g.thumbFor(`build:${b.id}:${b.updated}`, () => b.bricks, u => { if (u) img.src = u; });
      body.appendChild(el('div', { class: 'build-row' }, img,
        el('div', { class: 'build-info' }, el('b', { text: b.name }), el('span', { class: 'muted', text: `${b.bricks.length} pieces • ${new Date(b.updated).toLocaleString()}` })),
        el('div', { class: 'build-actions' },
          el('button', { class: 'btn small primary', text: 'Load', onclick: () => { this.pushUndo(); this.g.save.workbench = { name: b.name, buildId: b.id, bricks: cloneBricks(b.bricks) }; this.startFree(); m.close(); toast(`Loaded "${b.name}".`, 'success'); } }),
          el('button', { class: 'btn small', text: 'Export', onclick: () => download(safeName(b.name) + '.brickverse.json', exportBuildFile(b.name, b.bricks)) }),
          el('button', { class: 'btn small danger', text: 'Delete', onclick: async () => { if (await confirmBox('Delete creation?', `"${b.name}" will be deleted from this browser. This can't be undone.`, 'Delete', 'danger')) { this.g.save.customBuilds = this.g.save.customBuilds.filter(x => x !== b); this.g.requestSave(true); m.close(); this.loadDialog(); } } }),
        )));
    }
    m = modal({ title: 'Your saved creations', body, wide: true });
  }

  exportBuild() {
    if (!this.bricks.length) { toast('Nothing to export yet.', 'info'); return; }
    const name = this.g.save.workbench.name || 'My Creation';
    download(safeName(name) + '.brickverse.json', exportBuildFile(name, this.bricks));
    toast('Build file downloaded.', 'success');
  }

  async importBuild() {
    const text = await pickTextFile();
    if (text == null) return;
    const res = parseBuildFile(text);
    if (!res.ok) { this.g.audio.play('error'); modal({ title: 'Import failed', body: res.error, actions: [{ label: 'OK', kind: 'primary' }] }); return; }
    if (this.bricks.length && !(await confirmBox('Replace current creation?', `"${res.name}" has ${res.bricks.length} pieces. It will replace what's in the studio (you can Undo).`, 'Import'))) return;
    this.pushUndo();
    this.g.save.workbench = { name: res.name, buildId: null, bricks: res.bricks };
    const undo = this.undoStack.slice();
    this.startFree();
    this.undoStack = undo; this.updateToolbar();
    toast(`Imported "${res.name}" (${res.bricks.length} pieces).`, 'success');
    if (res.warnings.length) modal({ title: 'Imported with notes', body: res.warnings.join(' '), actions: [{ label: 'OK', kind: 'primary' }] });
  }

  screenshot() {
    const gv = this.ghost && this.ghost.visible, bv = this.ghostBox.visible, tv = this.targetGroup.visible;
    if (this.ghost) this.ghost.visible = false;
    this.ghostBox.visible = false; this.targetGroup.visible = false;
    const outline = this.renderer.outline.visible; this.renderer.outline.visible = false;
    const url = this.g.engine.screenshot();
    if (this.ghost) this.ghost.visible = gv;
    this.ghostBox.visible = bv; this.targetGroup.visible = tv; this.renderer.outline.visible = outline;
    if (!url) { toast('Screenshot failed.', 'error'); return; }
    // turn the image data into a file without any network request
    const bin = atob(url.split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    download(safeName(this.dom.name.textContent || 'brickverse') + '-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png', new Blob([bytes], { type: 'image/png' }), 'image/png');
    toast('Screenshot saved to your downloads.', 'success');
  }

  async exit() {
    if (this.mode === 'instructions' || this.mode === 'inspect') this.g.show('collection');
    else this.g.show('menu');
  }
}

function safeName(s) { return String(s).replace(/[^a-z0-9 _-]/gi, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'build'; }
