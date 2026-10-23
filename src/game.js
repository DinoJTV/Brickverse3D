// game.js — the central Game object: player save, catalogue, 3D engine, audio,
// progression, screen routing, the top bar and autosaving.
import { Engine, ThumbnailMaker } from './engine.js';
import { buildCatalog, CATEGORY_BY_ID, RARITY_BY_ID } from './catalog.js';
import { loadSave, writeSave, cacheGet, cacheSet } from './saveSystem.js';
import { Progression, xpToNext } from './progression.js';
import { Audio } from './audio.js';
import { el, $, toast, money, tweenNumber, closeTopModal, anyModalOpen } from './ui.js';

export const CATALOG_VERSION = 'c10';

export class Game {
  constructor() {
    this.events = new EventTarget();
    this.screens = {};
    this.current = null;
    this.saveTimer = null;
    this.saving = false;
  }
  emit(name, detail) { this.events.dispatchEvent(new CustomEvent(name, { detail })); }
  on(name, fn) { this.events.addEventListener(name, e => fn(e.detail)); }

  async init(progress) {
    progress('Loading your saved progress…', 0.05);
    const loaded = await loadSave();
    this.save = loaded.save;
    this.storageMode = loaded.mode;
    this.loadNotes = loaded.notes;
    this.isNewPlayer = loaded.fresh;

    progress('Designing hundreds of sets…', 0.1);
    this.catalog = await buildCatalog((d, t) => progress(`Designing sets… ${d}/${t}`, 0.1 + 0.75 * d / t));
    this.byId = new Map(this.catalog.map(s => [s.id, s]));
    this.repairOwned();

    progress('Starting the 3D engine…', 0.9);
    this.engine = new Engine(document.getElementById('view'), this.save.settings.quality);
    this.thumbs = new ThumbnailMaker(this.engine.envMap, [400, 300], { fancy: this.engine.quality.ao });
    this.audio = new Audio(this.save.settings);
    this.prog = new Progression(this);
    this.prog.ensureChallenges();

    const unlockAudio = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlockAudio, { once: false });
    window.addEventListener('keydown', unlockAudio, { once: false });
    document.addEventListener('click', e => { if (e.target.closest('button')) this.audio.play('click'); });

    this.buildTopBar();
    this.on('money', () => this.updateTopBar());
    this.on('xp', () => this.updateTopBar());
    this.on('challenges', () => this.updateTopBar());

    // save when the tab is hidden or closed, so nothing is lost
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.flushSave(); });
    window.addEventListener('pagehide', () => this.flushSave());
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && anyModalOpen()) { closeTopModal(); e.stopPropagation(); } }, true);
    progress('Ready!', 1);
  }

  /** Drop progress for sets that no longer exist and fix out-of-range indices. */
  repairOwned() {
    for (const [id, o] of Object.entries(this.save.owned)) {
      const set = this.byId.get(id);
      if (!set) { delete this.save.owned[id]; continue; }
      o.placed = [...new Set(o.placed.filter(i => i >= 0 && i < set.bricks.length))];
      if (o.state === 'completed' && o.placed.length !== set.bricks.length && !o.completedAt) o.state = 'opened';
    }
    this.save.room.order = this.save.room.order.filter(id => this.save.owned[id]?.state === 'completed');
  }

  // ------------------------------------------------------------ data helpers
  setById(id) { return this.byId.get(id); }
  ownedSets() { return Object.keys(this.save.owned).map(id => this.byId.get(id)).filter(Boolean); }
  completedSets() { return this.ownedSets().filter(s => this.save.owned[s.id].state === 'completed'); }
  ownership(id) { return this.save.owned[id] || null; }
  completion(id) {
    const o = this.save.owned[id], s = this.byId.get(id);
    if (!o || !s) return 0;
    if (o.state === 'completed') return 1;
    return o.placed.length / s.bricks.length;
  }

  buySet(set) {
    if (this.save.owned[set.id]) { toast('You already own this set.', 'info'); return false; }
    const lock = this.prog.canUnlockSet(set);
    if (!lock.ok) { toast(`Locked: ${lock.why} to buy this set.`, 'error'); this.audio.play('error'); return false; }
    if (this.save.money < set.price) { toast(`You need ${money(set.price - this.save.money)} more to buy this set.`, 'error'); this.audio.play('error'); return false; }
    this.prog.spend(set.price);
    this.save.owned[set.id] = { state: 'unopened', boughtAt: Date.now(), placed: [], completedAt: null, timesCompleted: 0 };
    this.audio.play('buy');
    toast(`You bought ${set.name}! Find the box in My Collection.`, 'success', 3500);
    this.prog.onPurchase(set);
    this.emit('owned', set.id);
    this.requestSave(true);
    return true;
  }

  // ------------------------------------------------------------ thumbnails (cached)
  thumb(set, cb) {
    const key = `${CATALOG_VERSION}:${set.id}`;
    if (this.thumbs.cache.has(key)) { cb(this.thumbs.cache.get(key)); return; }
    cacheGet(key).then(url => {
      if (url && typeof url === 'string' && url.startsWith('data:image/')) { this.thumbs.cache.set(key, url); cb(url); return; }
      this.thumbs.request(key, () => set.bricks, u => { if (u) cacheSet(key, u); cb(u); });
    });
  }
  thumbFor(key, bricksFn, cb) { this.thumbs.request(key, bricksFn, cb); }

  // ------------------------------------------------------------ saving
  requestSave(immediate = false) {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flushSave(), immediate ? 50 : 1500);
  }
  async flushSave(showToast = false) {
    clearTimeout(this.saveTimer);
    if (this.saving) { this.saveTimer = setTimeout(() => this.flushSave(showToast), 300); return false; }
    this.saving = true;
    const ind = $('#save-indicator');
    try {
      await writeSave(this.save);
      if (ind) { ind.textContent = '✓ Saved'; ind.className = 'save-ind ok'; clearTimeout(this._indT); this._indT = setTimeout(() => { ind.className = 'save-ind'; }, 1800); }
      if (showToast) toast('Progress saved in this browser.', 'save');
      return true;
    } catch (e) {
      console.error('Save failed', e);
      if (ind) { ind.textContent = '⚠ Not saved'; ind.className = 'save-ind fail'; }
      toast('Saving failed: ' + (e && e.message ? e.message : 'unknown error') + '. Try freeing browser storage, or download a backup in Settings.', 'error', 6000);
      return false;
    } finally { this.saving = false; }
  }

  // ------------------------------------------------------------ screens
  register(id, screen) { this.screens[id] = screen; }
  async show(id, params = {}) {
    const next = this.screens[id];
    if (!next) { toast('That screen does not exist: ' + id, 'error'); return; }
    if (this.current && this.current.leave) {
      const ok = await this.current.leave(id);
      if (ok === false) return;
    }
    for (const s of Object.values(this.screens)) s.el.classList.remove('active');
    this.current = next;
    this.currentId = id;
    next.el.classList.add('active');
    document.body.dataset.screen = id;
    for (const b of document.querySelectorAll('[data-nav]')) b.classList.toggle('active', b.dataset.nav === id);
    try { await next.enter(params); }
    catch (e) { console.error(e); this.fatal(e); }
  }

  // ------------------------------------------------------------ top bar
  buildTopBar() {
    const bar = $('#topbar');
    const nav = (id, icon, label) => el('button', { class: 'nav-btn', dataset: { nav: id }, onclick: () => this.show(id) }, el('span', { class: 'nav-ico', text: icon }), el('span', { class: 'nav-label', text: label }));
    this.ui = {
      level: el('span', { class: 'lvl-num', text: '1' }),
      xpFill: el('div', { class: 'xp-fill' }),
      xpText: el('span', { class: 'xp-text' }),
      money: el('span', { class: 'money-num', text: '$0' }),
      dailyDot: el('span', { class: 'dot hidden' }),
    };
    bar.append(
      el('button', { class: 'logo', 'aria-label': 'Main menu', onclick: () => this.show('menu') }, el('span', { class: 'logo-brick' }), el('span', { class: 'logo-text' }, 'Brick', el('b', { text: 'Verse' }), el('sup', { text: '3D' }))),
      el('nav', { class: 'nav' }, nav('store', '🛒', 'Store'), nav('collection', '📦', 'My Collection'), nav('room', '🏛️', 'Display Room'), nav('studio', '🧱', 'Build Studio')),
      el('div', { class: 'bar-right' },
        el('button', { class: 'chip daily-chip', title: 'Daily rewards & challenges', onclick: () => this.screens.menu.openDaily() }, el('span', { text: '🎁' }), this.ui.dailyDot),
        el('div', { class: 'chip level-chip', title: 'Your level and experience' }, el('span', { class: 'lvl-badge' }, this.ui.level), el('div', { class: 'xp-bar' }, this.ui.xpFill, this.ui.xpText)),
        el('div', { class: 'chip money-chip', title: 'Your money' }, el('span', { class: 'coin' }), this.ui.money),
        el('span', { id: 'save-indicator', class: 'save-ind' }),
        el('button', { class: 'chip icon-only', title: 'Settings', 'aria-label': 'Settings', onclick: () => this.screens.menu.openSettings() }, '⚙️'),
      ),
    );
    this.updateTopBar(true);
  }
  updateTopBar(instant) {
    const s = this.save;
    if (!this.ui) return;
    this.ui.level.textContent = s.level;
    const need = xpToNext(s.level);
    this.ui.xpFill.style.width = Math.min(100, (s.xp / need) * 100) + '%';
    this.ui.xpText.textContent = `${Math.floor(s.xp)} / ${need} XP`;
    if (instant) { this.ui.money.textContent = money(s.money); this.ui.money.dataset.value = s.money; }
    else tweenNumber(this.ui.money, s.money, money);
    const n = this.prog ? this.prog.unclaimedCount() : 0;
    this.ui.dailyDot.classList.toggle('hidden', !n);
    this.ui.dailyDot.textContent = n || '';
  }

  fatal(e) {
    const box = $('#fatal');
    if (!box) return;
    box.querySelector('.fatal-msg').textContent = (e && (e.stack || e.message)) ? String(e.message || e) : String(e);
    box.classList.add('show');
  }
}

export { CATEGORY_BY_ID, RARITY_BY_ID };
