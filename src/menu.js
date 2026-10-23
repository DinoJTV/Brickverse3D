// menu.js — main menu (with a rotating showcase model), plus the Daily Rewards,
// Settings, Achievements and Profile windows.
import { Trailer } from './trailer.js';
import * as THREE from 'three';
import { makeStudioScene, fitShadow } from './engine.js';
import { BrickRenderer } from './brickRenderer.js';
import { ACHIEVEMENTS, DAILY_REWARDS, xpToNext } from './progression.js';
import { exportSaveFile, parseSaveFile, resetSave, writeSave } from './saveSystem.js';
import { el, clear, toast, modal, confirmBox, money, num, download, pickTextFile } from './ui.js';
import { boundsOf } from './grid.js';
import { PLATE_H } from './parts.js';

export class Menu {
  constructor(game) {
    this.g = game;
    this.el = document.getElementById('screen-menu');
    const st = makeStudioScene({ background: '#11183a' });
    this.scene = st.scene; this.key = st.key;
    this.scene.fog = new THREE.Fog('#11183a', 60, 160);
    st.hemi.intensity = 0.8;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(16, 16.5, 0.8, 64), new THREE.MeshStandardMaterial({ color: 0x24305e, roughness: 0.4, metalness: 0.1 }));
    disc.position.y = -0.4; disc.receiveShadow = true;
    this.scene.add(disc);
    this.turn = new THREE.Group(); this.scene.add(this.turn);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 500);
    this.stage = { scene: this.scene, camera: this.camera, update: dt => { if (this.g.save.settings.autoRotateMenu) this.turn.rotation.y += dt * 0.25; } };
    game.on('quality', () => { if (this.showcaseRenderer) this.showcaseRenderer.setDetail(game.engine.quality.detail, game.engine.quality.shadows); });
    this.content = el('div', { class: 'menu-wrap' });
    this.el.append(this.content);
    game.on('money', () => game.currentId === 'menu' && this.renderStats());
  }

  pickShowcase() {
    const done = this.g.completedSets();
    if (done.length) return done[Math.floor(Math.random() * done.length)];
    const nice = this.g.catalog.filter(s => ['dinosaurs', 'fantasy', 'cars', 'castles'].includes(s.category) && s.brickCount > 150 && s.brickCount < 900);
    return nice[Math.floor(Math.random() * nice.length)] || this.g.catalog[0];
  }

  async enter() {
    this.g.engine.setStage(this.stage);
    const set = this.pickShowcase();
    if (this.showcaseRenderer) this.showcaseRenderer.dispose();
    const inner = new THREE.Group();
    this.turn.clear(); this.turn.add(inner);
    this.showcaseRenderer = new BrickRenderer(inner, { detail: this.g.engine.quality.detail, shadows: this.g.engine.quality.shadows });
    this.showcaseRenderer.setBricks(set.bricks);
    const bb = boundsOf(set.bricks);
    // fit the model on the turntable, shown on the right-hand side of the screen
    const s = Math.min(1.3, 18 / Math.hypot(bb.maxX, bb.maxZ, bb.maxY * PLATE_H));
    inner.position.set(-bb.maxX / 2, 0, -bb.maxZ / 2);
    this.turn.scale.setScalar(s);
    const h = bb.maxY * PLATE_H * s;
    this.turn.position.set(0, 0, 0);
    this.camera.position.set(-14, 13 + h * 0.3, 52);
    this.camera.lookAt(-13, h * 0.45 + 1.5, 0);
    fitShadow(this.key, { minX: -18, maxX: 18, minZ: -18, maxZ: 18, minY: 0, maxY: 30 }, this.g.engine.quality.shadowSize);
    this.showcaseName = set.name;
    this.render();
  }
  leave() { return true; }

  render() {
    const c = clear(this.content);
    const big = (icon, label, sub, fn, cls = '') => el('button', { class: 'menu-btn ' + cls, onclick: fn }, el('span', { class: 'mb-ico', text: icon }), el('span', { class: 'mb-text' }, el('b', { text: label }), el('small', { text: sub })));
    const unopened = this.g.ownedSets().filter(s => this.g.save.owned[s.id].state === 'unopened').length;
    const inProg = this.g.ownedSets().filter(s => this.g.save.owned[s.id].state === 'opened');
    this.statsBox = el('div', { class: 'menu-stats' });
    c.append(
      el('div', { class: 'menu-hero' },
        el('h1', { class: 'title' }, el('span', { class: 't1', text: 'Brick' }), el('span', { class: 't2', text: 'Verse' }), el('span', { class: 't3', text: '3D' })),
        el('p', { class: 'tagline', text: 'Collect sets. Open the box. Build it brick by brick.' })),
      el('div', { class: 'menu-buttons' },
        big('▶', 'Play', inProg.length ? `Continue ${inProg[0].name}` : unopened ? `${unopened} box${unopened > 1 ? 'es' : ''} waiting to be opened` : 'Find your next set', () => this.play(), 'play'),
        big('🛒', 'Brick Store', `${this.g.catalog.length} sets in ${new Set(this.g.catalog.map(s => s.category)).size} categories`, () => this.g.show('store')),
        big('📦', 'My Collection', `${this.g.ownedSets().length} owned`, () => this.g.show('collection')),
        big('🧱', 'Build Studio', 'Build anything you like', () => this.g.show('studio')),
        big('🏛️', 'Display Room', `${Object.keys(this.g.save.room.shelf || {}).length || this.g.completedSets().length} on your shelves`, () => this.g.show('room')),
        el('div', { class: 'menu-small' },
          el('button', { class: 'btn ghost', onclick: () => this.openDaily() }, '🎁 Daily Rewards', this.g.prog.unclaimedCount() ? el('span', { class: 'dot', text: this.g.prog.unclaimedCount() }) : null),
          el('button', { class: 'btn ghost', text: '🏆 Achievements', onclick: () => this.openAchievements() }),
          el('button', { class: 'btn ghost', text: '👤 Profile', onclick: () => this.openProfile() }),
          el('button', { class: 'btn ghost', text: '⚙️ Settings', onclick: () => this.openSettings() }),
          el('button', { class: 'btn ghost', text: '❓ How to play', onclick: () => this.openHelp() }),
          el('button', { class: 'btn ghost', text: '🎬 Watch trailer', onclick: () => new Trailer(this.g).run() }))),
      this.statsBox,
      el('div', { class: 'showcase-tag', text: '✨ ' + this.showcaseName }));
    this.renderStats();
  }

  renderStats() {
    if (!this.statsBox) return;
    const s = this.g.save.stats;
    const st = (n, label) => el('div', { class: 'ms' }, el('b', { text: num(n) }), el('span', { text: label }));
    clear(this.statsBox).append(st(s.setsPurchased, 'sets purchased'), st(s.modelsCompleted, 'models completed'), st(s.bricksPlaced, 'pieces placed'), st(this.g.save.level, 'level'));
  }

  play() {
    const owned = this.g.ownedSets();
    const inProg = owned.find(s => this.g.save.owned[s.id].state === 'opened');
    if (inProg) return this.g.show('studio', { setId: inProg.id });
    const box = owned.find(s => this.g.save.owned[s.id].state === 'unopened');
    if (box) return this.g.show('opening', { setId: box.id });
    this.g.show('store', { category: this.g.save.stats.modelsCompleted < 2 ? 'beginner' : undefined });
  }

  // ------------------------------------------------------------------ daily
  openDaily() {
    const p = this.g.prog;
    const st = p.dailyStatus();
    const days = el('div', { class: 'daily-days' });
    DAILY_REWARDS.forEach((r, i) => {
      const cur = i === st.dayIndex;
      const past = i < st.dayIndex || (cur && st.claimedToday);
      days.appendChild(el('div', { class: 'day' + (cur ? ' cur' : '') + (past ? ' got' : '') }, el('span', { text: `Day ${i + 1}` }), el('b', { text: money(r) }), past ? el('i', { text: '✓' }) : null));
    });
    const claimBtn = el('button', { class: 'btn primary big', text: st.claimedToday ? 'Come back tomorrow!' : `Claim ${money(st.reward)}`, disabled: st.claimedToday,
      onclick: () => { if (p.claimDaily()) { m.close(); this.openDaily(); this.g.updateTopBar(); if (this.g.currentId === 'menu') this.render(); } } });
    const ch = el('div', { class: 'challenges' });
    p.ensureChallenges().forEach((c, i) => {
      const done = c.progress >= c.target;
      ch.appendChild(el('div', { class: 'challenge' + (c.claimed ? ' claimed' : done ? ' done' : '') },
        el('div', { class: 'ch-text' }, el('b', { text: p.challengeText(c) }), el('div', { class: 'progress small' }, el('div', { class: 'progress-fill', style: { width: Math.min(100, c.progress / c.target * 100) + '%' } })), el('span', { class: 'muted', text: `${Math.min(c.progress, c.target)} / ${c.target}` })),
        el('button', { class: 'btn small ' + (done && !c.claimed ? 'primary' : ''), text: c.claimed ? 'Claimed ✓' : done ? `Claim ${money(c.reward)}` : money(c.reward), disabled: c.claimed || !done,
          onclick: () => { if (p.claimChallenge(i)) { m.close(); this.openDaily(); this.g.updateTopBar(); } } })));
    });
    const bs = this.g.save.buildStreak;
    const body = el('div', { class: 'daily' },
      el('p', { class: 'muted', text: `Log in every day for bigger rewards. Login streak: ${st.claimedToday ? this.g.save.daily.loginStreak : Math.max(0, st.streak - 1)} day(s).` }),
      days, el('div', { class: 'center' }, claimBtn),
      el('h3', { text: "Today's challenges" }), ch,
      el('p', { class: 'muted', text: `Building streak: ${bs.count} day(s) (best ${bs.best}). Build on consecutive days to earn up to +50% completion rewards — currently +${p.streakBonusPct()}%.` }));
    const m = modal({ title: '🎁 Daily Rewards', body, wide: true });
  }

  // ------------------------------------------------------------------ achievements
  openAchievements() {
    const a = this.g.save.achievements;
    const got = ACHIEVEMENTS.filter(x => a[x.id]).length;
    const list = el('div', { class: 'ach-list' });
    for (const x of ACHIEVEMENTS) list.appendChild(el('div', { class: 'ach' + (a[x.id] ? ' got' : '') }, el('span', { class: 'ach-ico', text: a[x.id] ? '🏆' : '🔒' }), el('div', {}, el('b', { text: x.name }), el('span', { class: 'muted', text: x.desc })), el('span', { class: 'ach-r', text: money(x.reward) })));
    modal({ title: `🏆 Achievements (${got}/${ACHIEVEMENTS.length})`, body: list, wide: true });
  }

  openProfile() {
    const s = this.g.save, st = s.stats;
    const row = (k, v) => el('div', { class: 'kv' }, el('span', { text: k }), el('b', { text: v }));
    const cats = new Set(this.g.completedSets().map(x => x.category)).size;
    modal({
      title: '👤 Your profile',
      body: el('div', { class: 'profile' },
        el('div', { class: 'profile-top' }, el('div', { class: 'lvl-big', text: s.level }), el('div', {}, el('b', { text: `Level ${s.level}` }), el('div', { class: 'progress' }, el('div', { class: 'progress-fill', style: { width: (s.xp / xpToNext(s.level) * 100) + '%' } })), el('span', { class: 'muted', text: `${Math.floor(s.xp)} / ${xpToNext(s.level)} XP to level ${s.level + 1}` }))),
        row('Money', money(s.money)), row('Money earned (total)', money(st.moneyEarned)), row('Sets purchased', num(st.setsPurchased)), row('Boxes opened', num(st.boxesOpened)),
        row('Models completed', num(st.modelsCompleted)), row('Categories completed in', `${cats}`), row('Total pieces placed', num(st.bricksPlaced)), row('Pieces placed in the studio', num(st.freeBricksPlaced)),
        row('Instruction steps finished', num(st.stepsCompleted)), row('Saved creations', num(s.customBuilds.length)), row('Achievements', `${Object.keys(s.achievements).length} / ${ACHIEVEMENTS.length}`),
        row('Playing since', new Date(s.createdAt).toLocaleDateString())),
    });
  }

  // ------------------------------------------------------------------ settings
  openSettings() {
    const g = this.g, set = g.save.settings;
    const range = (label, key) => {
      const out = el('span', { class: 'muted', text: Math.round(set[key] * 100) + '%' });
      const r = el('input', { type: 'range', min: 0, max: 100, value: Math.round(set[key] * 100), 'aria-label': label, oninput: () => { set[key] = r.value / 100; out.textContent = r.value + '%'; g.audio.applyVolumes(); g.requestSave(); } });
      return el('label', { class: 'set-row' }, el('span', { text: label }), r, out);
    };
    const check = (label, key, fn) => el('label', { class: 'set-row' }, el('span', { text: label }), el('input', { type: 'checkbox', checked: !!set[key], onchange: e => { set[key] = e.target.checked; fn && fn(); g.requestSave(); } }));
    const q = el('select', { class: 'input select', 'aria-label': 'Graphics quality', onchange: () => { set.quality = q.value; g.engine.setQuality(q.value); g.emit('quality'); g.requestSave(); toast(`Graphics set to ${q.value}.`, 'info'); } },
      ...[['ultra', 'Ultra — contact shadows, glow, 4K shadows (gaming PCs)'], ['high', 'High — contact shadows, detailed studs'], ['medium', 'Medium — lighter shadows, simple studs'], ['low', 'Low — no shadows, no studs (fastest)']].map(([v, t]) => el('option', { value: v, text: t, selected: set.quality === v })));
    const body = el('div', { class: 'settings' },
      el('h3', { text: 'Graphics' }), el('label', { class: 'set-row' }, el('span', { text: 'Quality' }), q),
      check('Spin the model on the main menu', 'autoRotateMenu'),
      check('Play the trailer when the game starts', 'playTrailer'),
      el('h3', { text: 'Sound' }), range('Music volume', 'music'), range('Sound effects volume', 'sfx'), check('Mute everything', 'muted', () => g.audio.applyVolumes()),
      el('h3', { text: 'Saving' }),
      el('p', { class: 'muted', text: `Your progress is saved automatically in this browser only (${g.storageMode === 'indexeddb' ? 'IndexedDB' : g.storageMode === 'localstorage' ? 'local storage' : 'temporary memory — progress will be lost when you close the tab'}). It is not uploaded anywhere and does not sync between devices. Download a backup file to move your progress or keep it safe.` }),
      el('div', { class: 'row wrap' },
        el('button', { class: 'btn', text: '💾 Save now', onclick: () => g.flushSave(true) }),
        el('button', { class: 'btn', text: '⬇️ Download backup', onclick: () => { download(`brickverse-backup-${new Date().toISOString().slice(0, 10)}.json`, exportSaveFile(g.save)); toast('Backup downloaded.', 'success'); } }),
        el('button', { class: 'btn', text: '⬆️ Restore backup', onclick: () => this.restoreBackup() }),
        el('button', { class: 'btn danger', text: '🗑️ Reset all progress', onclick: () => this.resetAll() })),
    );
    modal({ title: '⚙️ Settings', body, wide: true });
  }

  async restoreBackup() {
    const text = await pickTextFile('.json,application/json', 20 * 1024 * 1024);
    if (text == null) return;
    const res = parseSaveFile(text);
    if (!res.ok) { modal({ title: 'Restore failed', body: res.error, actions: [{ label: 'OK', kind: 'primary' }] }); return; }
    if (!(await confirmBox('Restore this backup?', 'Your current progress in this browser will be replaced by the backup file.', 'Restore', 'danger'))) return;
    try { await writeSave(res.save); toast('Backup restored. Reloading…', 'success'); setTimeout(() => location.reload(), 700); }
    catch (e) { toast('Could not save the restored backup: ' + e.message, 'error', 6000); }
  }

  async resetAll() {
    if (!(await confirmBox('Reset ALL progress?', 'This deletes your money, sets, builds and achievements from this browser. Consider downloading a backup first.', 'Continue', 'danger'))) return;
    if (!(await confirmBox('Are you completely sure?', 'This cannot be undone.', 'Yes, reset everything', 'danger'))) return;
    this.g.flushSave = async () => true;   // stop autosave from re-saving old data
    await resetSave();
    location.reload();
  }

  openHelp(welcome = false) {
    const step = (n, t, d) => el('div', { class: 'help-step' }, el('span', { class: 'hs-n', text: n }), el('div', {}, el('b', { text: t }), el('p', { class: 'muted', text: d })));
    const body = el('div', { class: 'help-steps' },
      welcome ? el('p', { text: `Welcome, builder! You start with ${money(500)}. Here's how BrickVerse works:` }) : null,
      step('1', 'Buy a set', 'Visit the Brick Store. Beginner Sets are cheap and quick — perfect to start.'),
      step('2', 'Open the box', 'Find it in My Collection, click it, then click or drag up on the box.'),
      step('3', 'Build it', 'Pick a piece from the tray on the left and click its glowing spot. Right-drag to orbit, wheel to zoom.'),
      step('4', 'Earn rewards', 'Finishing a model pays more than it cost! Claim daily rewards and challenges too.'),
      step('5', 'Create freely', 'In the Build Studio you can build anything, save it, and export it as a file.'),
      el('p', { class: 'muted', text: 'Controls: Left-click place/select • Right-drag orbit • Wheel zoom • Middle-drag pan • R rotate • Ctrl+Z undo • Ctrl+Y redo • Delete remove' }));
    modal({ title: welcome ? '👋 Welcome to BrickVerse 3D!' : '❓ How to play', body, wide: true, actions: welcome ? [{ label: 'Show me Beginner Sets', kind: 'primary', onClick: () => this.g.show('store', { category: 'beginner' }) }] : [{ label: 'Got it', kind: 'primary' }] });
  }
}
