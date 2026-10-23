// trailer.js — the 30-second start-up trailer. It plays in real time with the game's own
// 3D engine (real sets, real figures, real brick-drop effects) and an upbeat soundtrack
// that is generated live by the browser, so there are no video or audio files to download.
// It always starts on a title card (browsers only allow sound after a click or key press),
// and it can be skipped at any moment with the Skip button or the Esc key.
import * as THREE from 'three';
import { BrickRenderer } from './brickRenderer.js';
import { makeStudioScene, fitShadow } from './engine.js';
import { PlaceFX } from './effects.js';
import { boundsOf } from './grid.js';
import { PLATE_H, FIGURES, PART_BY_ID } from './parts.js';
import { boxArtUrl } from './boxArt.js';
import { el } from './ui.js';

const BPM = 128, BEAT = 60 / BPM, BAR = BEAT * 4;   // one bar = 1.875 s, 16 bars = 30 s
const END = 16 * BAR + 2.6;                          // the logo card holds a little longer

// ======================================================================= music
// An original, upbeat track: C – G – Am – F, intro → groove → break → build → drop → outro.
const CHORDS = [
  { root: 130.81, notes: [261.63, 329.63, 392.0] },   // C
  { root: 98.0, notes: [246.94, 293.66, 392.0] },     // G
  { root: 110.0, notes: [261.63, 329.63, 440.0] },    // Am
  { root: 87.31, notes: [261.63, 349.23, 440.0] },    // F
];
const N = { C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, C6: 1046.5, D6: 1174.66, E6: 1318.5 };
// one bar of eighth notes per chord; 0 = rest (the note before rings on)
const HOOK = [
  [N.G5, 0, N.E5, N.G5, N.A5, 0, N.G5, N.E5],
  [N.D5, 0, N.D5, N.E5, N.G5, 0, N.E5, N.D5],
  [N.E5, 0, N.A5, 0, N.G5, N.E5, N.C5, 0],
  [N.C5, 0, N.D5, N.E5, N.A5, 0, N.G5, 0],
];

export class TrailerMusic {
  constructor(audio) { this.audio = audio; this.c = null; }

  /** Schedules the whole soundtrack. Returns false if sound isn't available. */
  start() {
    const a = this.audio;
    if (!a.ctx) return false;
    const c = this.c = a.ctx;
    if (c.state === 'suspended') c.resume();
    this.out = c.createGain();
    this.out.connect(a.master);
    const vol = 0.5 * Math.min(1.2, 0.3 + (a.settings.music ?? 0.35) * 2);
    this.out.gain.setValueAtTime(0.0001, c.currentTime);
    this.out.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), c.currentTime + 0.05);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.t0 = c.currentTime + 0.12;
    this.schedule();
    return true;
  }
  now() { return this.c ? this.c.currentTime - this.t0 : 0; }
  stop() {
    if (!this.out) return;
    const c = this.c, g = this.out;
    g.gain.cancelScheduledValues(c.currentTime);
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.35);
    setTimeout(() => { try { g.disconnect(); } catch { /* already gone */ } }, 600);
    this.out = null;
  }

  // ---- instruments
  osc(type, f, t, dur, vol, { attack = 0.006, filter = 0, q = 0.8, slideTo = 0, detune = 0, filterTo = 0 } = {}) {
    const c = this.c, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + Math.min(dur, 0.14));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) {
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = q;
      fl.frequency.setValueAtTime(filter, t);
      if (filterTo) fl.frequency.exponentialRampToValueAtTime(filterTo, t + dur);
      o.connect(fl); node = fl;
    }
    node.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + dur + 0.05);
  }
  noise(t, dur, vol, { type = 'highpass', freq = 6000, q = 0.7, sweepTo = 0, attack = 0.002, rise = false } = {}) {
    const c = this.c, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.loop = true;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    if (rise) { g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.95); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    else { g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    s.connect(f); f.connect(g); g.connect(this.out);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  kick(t, v = 1) { this.osc('sine', 160, t, 0.42, 0.95 * v, { attack: 0.003, slideTo: 42 }); this.osc('triangle', 900, t, 0.03, 0.18 * v, { attack: 0.001, slideTo: 200 }); }
  clap(t, v = 1) { for (const k of [0, 0.011, 0.023]) this.noise(t + k, k === 0.023 ? 0.2 : 0.03, 0.42 * v, { type: 'bandpass', freq: 1500, q: 0.9 }); }
  snare(t, v = 1) { this.noise(t, 0.14, 0.32 * v, { type: 'bandpass', freq: 2200, q: 0.6 }); this.osc('triangle', 220, t, 0.08, 0.14 * v, { slideTo: 160 }); }
  hat(t, v = 1, open = false) { this.noise(t, open ? 0.2 : 0.045, (open ? 0.13 : 0.09) * v, { freq: 8000 }); }
  crash(t) { this.noise(t, 1.8, 0.28, { freq: 4500 }); }
  riser(t, dur) { this.noise(t, dur, 0.22, { type: 'bandpass', freq: 400, sweepTo: 7000, q: 1.2, rise: true }); }
  whoosh(t) { this.noise(t, 0.32, 0.16, { type: 'bandpass', freq: 3500, sweepTo: 500, q: 1.5, attack: 0.08 }); }
  bass(t, f, dur, open = 700) { this.osc('sawtooth', f, t, dur, 0.24, { filter: open, q: 5 }); this.osc('sine', f / 2, t, dur, 0.22); }
  stab(t, notes, dur, vol = 0.07, filter = 2400) { for (const f of notes) for (const dt of [-9, 9]) this.osc('sawtooth', f, t, dur, vol, { filter, detune: dt }); }
  pad(t, notes, dur, vol = 0.05) { for (const f of notes) for (const dt of [-7, 7]) this.osc('sawtooth', f, t, dur, vol, { attack: 0.35, filter: 1300, detune: dt }); }
  lead(t, f, dur, vol = 0.09, oct = false) {
    this.osc('square', f, t, dur, vol, { filter: 3800, attack: 0.01 });
    this.osc('triangle', f * 2, t, dur, vol * 0.5, { attack: 0.01 });
    if (oct) this.osc('square', f * 2, t, dur, vol * 0.45, { filter: 5000, attack: 0.01 });
  }

  schedule() {
    const T = this.t0, e8 = BEAT / 2, s16 = BEAT / 4;
    for (let bar = 0; bar < 16; bar++) {
      const ch = CHORDS[bar % 4], tb = T + bar * BAR;
      const intro = bar < 2, groove = bar >= 2 && bar < 8, brk = bar === 8 || bar === 9, build = bar === 10 || bar === 11, drop = bar >= 12 && bar < 15, outro = bar === 15;
      if (intro) {
        for (let e = 1; e < 8; e += 2) this.stab(tb + e * e8, ch.notes, 0.16, 0.1, 900 + bar * 600);
        this.kick(tb, 0.7); this.kick(tb + 2 * BEAT, 0.6);
        if (bar === 1) { for (let i = 0; i < 16; i++) this.hat(tb + i * s16, 0.4 + i / 32); this.riser(tb, BAR); for (let i = 12; i < 16; i++) this.snare(tb + i * s16, 0.4 + (i - 12) * 0.15); }
        else for (let e = 0; e < 8; e++) this.hat(tb + e * e8, 0.6);
      }
      if (groove || drop) {
        for (let b = 0; b < 4; b++) this.kick(tb + b * BEAT);
        this.clap(tb + BEAT); this.clap(tb + 3 * BEAT);
        for (let i = 0; i < 16; i++) this.hat(tb + i * s16, i % 2 ? 0.45 : 0.75);
        for (let e = 1; e < 8; e += 2) this.hat(tb + e * e8, 0.8, true);
        for (let e = 0; e < 8; e++) this.bass(tb + e * e8, ch.root * (e % 2 ? 2 : 1), e8 * 0.9, drop ? 1100 : 750);
        for (let e = 1; e < 8; e += 2) this.stab(tb + e * e8, ch.notes, 0.18, drop ? 0.07 : 0.055, drop ? 3200 : 2200);
      }
      if ((groove && bar >= 4) || drop || brk) {
        const hook = HOOK[bar % 4];
        hook.forEach((f, e) => {
          if (!f) return;
          let len = 1; while (e + len < 8 && !hook[e + len]) len++;
          this.lead(tb + e * e8, f, len * e8 * 0.95, brk ? 0.06 : drop ? 0.085 : 0.075, drop);
        });
      }
      if (brk) {
        this.pad(tb, ch.notes, BAR, 0.045);
        this.bass(tb, ch.root, BAR * 0.95, 420);
        this.kick(tb, 0.8); this.kick(tb + 2 * BEAT, 0.7);
        for (let e = 0; e < 8; e++) this.hat(tb + e * e8, 0.5);
      }
      if (build) {
        for (let b = 0; b < 4; b++) if (!(bar === 11 && b === 3)) this.kick(tb + b * BEAT, 0.9);
        const k = bar - 10;
        for (let e = 0; e < 8; e++) this.bass(tb + e * e8, ch.root * (e % 2 ? 2 : 1), e8 * 0.9, 500 + (k * 8 + e) * 90);
        if (k === 0) for (let e = 0; e < 8; e++) this.snare(tb + e * e8, 0.35 + e * 0.04);
        else { for (let i = 0; i < 12; i++) this.snare(tb + i * s16, 0.6 + i * 0.03); for (let i = 0; i < 8; i++) this.snare(tb + 3 * BEAT + i * s16 / 2, 0.9); }
        if (k === 0) this.riser(tb, BAR * 2);
        for (let e = 1; e < 8; e += 2) this.stab(tb + e * e8, ch.notes, 0.12, 0.05, 1200 + (k * 8 + e) * 160);
      }
      if (outro) {
        this.kick(tb, 1.2); this.crash(tb);
        this.pad(tb, [261.63, 329.63, 392.0, 523.25], 3.6, 0.06);
        this.bass(tb, 65.41, 2.6, 500);
        [N.C5, N.E5, N.G5, N.C6, N.E6].forEach((f, i) => this.lead(tb + i * e8, f, 0.5, 0.06));
      }
    }
    // cymbal hits and impacts on the big moments, whooshes on the cuts
    this.crash(T + 2 * BAR); this.kick(T + 2 * BAR, 1.2);
    this.crash(T + 12 * BAR);
    for (const bar of [2, 4, 5, 6, 7, 8, 10]) this.whoosh(T + bar * BAR - 0.3);
    for (let i = 1; i < 6; i++) this.whoosh(T + 12 * BAR + i * BAR / 2 - 0.25);
  }
}

// ======================================================================= shots
// Each shot shows one model with its own camera move and background colours.
const SHOTS = [
  { id: 'car', from: 0, to: 2, pick: ['cars', ['supercar', 'hyper', 'sedan']], bg: ['#141a3a', '#3b1f6b'], cam: { a0: -0.9, a1: 0.5, el: 0.38, d0: 1.35, d1: 1.15 }, build: true },
  { id: 'city', from: 2, to: 4, pick: ['bigcity', ['firestation']], bg: ['#0f3d6e', '#4fa8de'], cam: { a0: 0.65, a1: -0.25, el0: 0.12, el1: 0.42, d0: 0.95, d1: 1.05, y: 0.3 } },
  { id: 'dino', from: 4, to: 5, pick: ['dinosaurs', ['trex']], bg: ['#16351f', '#8cc63f'], cam: { a0: 0.9, a1: 0.35, el: 0.12, d0: 0.8, d1: 0.7, y: 0.55 } },
  { id: 'dragon', from: 5, to: 6, pick: ['fantasy', ['dragon']], bg: ['#3a0d0d', '#ff7a2f'], cam: { a0: -0.6, a1: 0.1, el: 0.25, d0: 0.8, d1: 0.72, y: 0.5 } },
  { id: 'rocket', from: 6, to: 7, pick: ['space', ['rocket', 'shuttle']], bg: ['#05061a', '#2b2f7a'], cam: { a0: 0.4, a1: -0.3, el0: 0.05, el1: 0.3, d0: 0.85, d1: 0.75, y: 0.6 } },
  { id: 'castle', from: 7, to: 8, pick: ['castles', ['palace', 'fortress']], bg: ['#2a2350', '#d7a24a'], cam: { a0: -0.4, a1: 0.3, el: 0.3, d0: 0.8, d1: 0.74 } },
  { id: 'figures', from: 8, to: 10, figures: true, bg: ['#ffb347', '#ff5e8a'] },
  { id: 'boxes', from: 10, to: 12, pick: ['bigcity', ['hospital']], bg: ['#1b2a4a', '#5c6bc0'], cam: { a0: 0.2, a1: 0.7, el: 0.35, d0: 1.0, d1: 0.9 } },
  { id: 'm1', from: 12, to: 12.5, pick: ['trains', ['bullet', 'steam']], bg: ['#0f3d6e', '#22c3ee'], cam: { a0: 0.9, a1: 0.5, el: 0.25, d0: 1.0, d1: 0.9 }, montage: true },
  { id: 'm2', from: 12.5, to: 13, pick: ['boats', ['galleon']], bg: ['#06324a', '#1fb5a8'], cam: { a0: -0.7, a1: -0.3, el: 0.25, d0: 1.0, d1: 0.9 }, montage: true },
  { id: 'm3', from: 13, to: 13.5, pick: ['robots', ['mech', 'humanoid']], bg: ['#2b1055', '#d53369'], cam: { a0: 0.3, a1: 0.7, el: 0.15, d0: 1.0, d1: 0.9, y: 0.55 }, montage: true },
  { id: 'm4', from: 13.5, to: 14, pick: ['bigcity', ['school']], bg: ['#2f5d1c', '#f7c51e'], cam: { a0: -0.3, a1: 0.15, el: 0.35, d0: 0.85, d1: 0.78 }, montage: true },
  { id: 'm5', from: 14, to: 14.5, pick: ['themepark', ['ferriswheel', 'carousel']], bg: ['#3b0a45', '#ff8a00'], cam: { a0: 0.5, a1: 0.1, el: 0.2, d0: 0.95, d1: 0.85, y: 0.55 }, montage: true },
  { id: 'm6', from: 14.5, to: 15, pick: ['cars', ['monster', 'hyper']], bg: ['#141a3a', '#e11d48'], cam: { a0: -0.8, a1: -0.4, el: 0.2, d0: 1.0, d1: 0.9 }, montage: true },
  { id: 'logo', from: 15, to: 99, pick: ['bigcity', ['corner']], bg: ['#120a2e', '#6d28d9'], cam: { a0: 0.4, a1: 0.9, el: 0.32, d0: 1.15, d1: 1.05 } },
];
const TITLE_SHOT = { pick: ['bigcity', ['corner']], bg: ['#0b1029', '#26306b'], cam: { a0: 0, a1: Math.PI * 2, el: 0.3, d0: 1.1, d1: 1.1 } };

// on-screen words, timed in seconds
const CAPTIONS = [
  { t: [0.15, 0.95], text: 'Click!', cls: 'pop left' },
  { t: [0.95, 1.85], text: 'Clack!', cls: 'pop right' },
  { t: [1.9, 3.7], text: 'Build it brick by brick', cls: 'low' },
  { t: [3.95, 7.35], text: 'Build a whole city', sub: '8 giant buildings, inside and out', cls: 'low' },
  { t: [7.55, 9.3], text: 'Dinosaurs', cls: 'pop' },
  { t: [9.45, 11.2], text: 'Dragons', cls: 'pop' },
  { t: [11.35, 13.05], text: 'Rockets', cls: 'pop' },
  { t: [13.2, 14.95], text: 'Castles', cls: 'pop' },
  { t: [15.1, 18.65], text: 'Meet the crew', sub: '18 little figures to collect', cls: 'low' },
  { t: [18.9, 22.4], text: 'Open the box.', cls: 'stack s1' },
  { t: [19.85, 22.4], text: 'Tear the bags.', cls: 'stack s2' },
  { t: [20.8, 22.4], text: 'Follow the booklet.', cls: 'stack s3' },
  { t: [22.55, 24.3], text: '332 sets', cls: 'pop big' },
  { t: [24.4, 26.2], text: '23 themes', cls: 'pop big' },
  { t: [26.3, 28.05], text: 'One giant brick world', cls: 'pop' },
];

const ease = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

function gradientTexture([top, bottom]) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top); g.addColorStop(1, bottom); x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Trailer {
  constructor(game) {
    this.g = game;
    const st = makeStudioScene();
    this.scene = st.scene; this.key = st.key;
    this.scene.fog = null;
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 3000);
    this.views = [];
    this.music = new TrailerMusic(game.audio);
    this.state = 'title';
    this.t = 0;
  }

  /** Find a set by category and style (falls back to the first in the category). */
  pick([cat, styles]) {
    const list = this.g.catalog.filter(s => s.category === cat);
    for (const st of styles) { const s = list.find(x => x.style === st); if (s) return s; }
    return list[0];
  }

  /** A model placed in the scene, centred, with its camera move pre-computed. */
  makeView(shot, bricks) {
    const r = new BrickRenderer(this.scene, { detail: this.g.engine.quality.detail, shadows: this.g.engine.quality.shadows });
    const bb = boundsOf(bricks);
    const cx = (bb.minX + bb.maxX) / 2, cz = (bb.minZ + bb.maxZ) / 2;
    r.group.position.set(-cx, 0, -cz);
    r.group.visible = false;
    const H = bb.maxY * PLATE_H;
    const R = Math.max(3, Math.hypot(bb.maxX - bb.minX, bb.maxZ - bb.minZ, H) / 2);
    const v = { shot, r, bb: { minX: bb.minX - cx, maxX: bb.maxX - cx, minZ: bb.minZ - cz, maxZ: bb.maxZ - cz, minY: bb.minY, maxY: bb.maxY }, H, R, bricks, bg: gradientTexture(shot.bg) };
    if (shot.build) {
      v.fx = new PlaceFX(r.group);
      v.order = bricks.map((b, i) => i).sort((a, b) => bricks[a].y - bricks[b].y || bricks[a].z - bricks[b].z || bricks[a].x - bricks[b].x);
      v.landed = 0; v.dropped = 0; v.placed = [];
      r.setBricks([]);
    } else r.setBricks(bricks);
    return v;
  }

  /** The 18 figures standing in a gentle curve on a green baseplate. */
  figureLineup() {
    const bricks = [];
    const n = FIGURES.length;
    for (let x = -2; x < n * 3 + 2; x += 8) bricks.push({ t: 'plate_8x8', x, y: 0, z: -2, r: 0, c: 'green' });
    FIGURES.forEach(([id], i) => {
      const z = Math.round(Math.abs(i - (n - 1) / 2) * 0.35);
      bricks.push({ t: 'fig_' + id, x: i * 3, y: 1, z: z - 1, r: 0, c: PART_BY_ID['fig_' + id].fig.torso });
    });
    return bricks;
  }

  /** Build everything up front while the title card is showing, so the trailer never stutters. */
  prepare() {
    this.title = this.makeView(TITLE_SHOT, this.pick(TITLE_SHOT.pick).bricks);
    this.views = SHOTS.map(s => this.makeView(s, s.figures ? this.figureLineup() : this.pick(s.pick).bricks));
    // box art for the "open the box" shot (made in the background, shown if ready)
    this.boxUrls = [];
    for (const [cat, st] of [['bigcity', ['firestation']], ['dinosaurs', ['trex']], ['castles', ['palace']]]) {
      const set = this.pick([cat, st]);
      if (set) boxArtUrl(this.g, set, url => { if (url) this.boxUrls.push(url); });
    }
  }

  show(v) {
    if (this.cur === v) return;
    if (this.cur) this.cur.r.group.visible = false;
    this.cur = v;
    v.r.group.visible = true;
    this.scene.background = v.bg;
    fitShadow(this.key, v.bb, this.g.engine.quality.shadowSize);
  }

  placeCamera(v, u) {
    const c = v.shot.cam || {};
    const a = c.a0 + (c.a1 - c.a0) * ease(u);
    const elv = c.el ?? (c.el0 + (c.el1 - c.el0) * ease(u));
    const k = c.d0 + (c.d1 - c.d0) * ease(u);
    const fov = this.camera.fov * Math.PI / 180;
    const dist = v.R / Math.sin(fov / 2) * 0.9 * k;
    const target = new THREE.Vector3(0, v.H * (c.y ?? 0.4), 0);
    this.camera.position.set(Math.sin(a) * Math.cos(elv) * dist, target.y + Math.sin(elv) * dist, Math.cos(a) * Math.cos(elv) * dist);
    this.camera.near = Math.max(0.05, dist / 300); this.camera.far = dist * 20 + 300;
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ DOM
  buildOverlay() {
    const skip = () => this.finish();
    this.skipBtn = el('button', { class: 'tr-skip', onclick: skip, 'aria-label': 'Skip the trailer' }, 'Skip ', el('b', { text: '⏭' }));
    this.bar = el('div', { class: 'tr-bar-fill' });
    this.caps = el('div', { class: 'tr-caps' });
    this.boxes = el('div', { class: 'tr-boxes' });
    this.flash = el('div', { class: 'tr-flash' });
    this.titleCard = el('div', { class: 'tr-title' },
      el('h1', { class: 'tr-logo' }, el('span', { class: 't1', text: 'Brick' }), el('span', { class: 't2', text: 'Verse' }), el('sup', { text: '3D' })),
      el('p', { class: 'tr-tag', text: 'The brick-building game' }),
      el('button', { class: 'tr-play', onclick: () => this.play() }, '▶  Play trailer'),
      el('p', { class: 'tr-hint', text: 'Press Enter to play • Esc to skip' }),
      el('label', { class: 'tr-check' }, el('input', { type: 'checkbox', checked: this.g.save.settings.playTrailer !== false, onchange: e => { this.g.save.settings.playTrailer = e.target.checked; this.g.requestSave(); } }), ' Play this trailer when the game starts'));
    this.endCard = el('div', { class: 'tr-end' },
      el('h1', { class: 'tr-logo' }, el('span', { class: 't1', text: 'Brick' }), el('span', { class: 't2', text: 'Verse' }), el('sup', { text: '3D' })),
      el('p', { class: 'tr-tag', text: 'Collect it. Open it. Build it.' }),
      el('button', { class: 'tr-play', onclick: () => this.finish() }, "Let's build!"));
    this.root = el('div', { class: 'trailer', role: 'dialog', 'aria-label': 'BrickVerse 3D trailer' },
      this.caps, this.boxes, this.flash, this.titleCard, this.endCard, this.skipBtn, el('div', { class: 'tr-bar' }, this.bar));
    document.body.appendChild(this.root);
    this.onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.finish(); }
      else if (this.state === 'title' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.play(); }
      else if (this.state === 'ending' && e.key === 'Enter') this.finish();
    };
    window.addEventListener('keydown', this.onKey, true);
  }

  caption(c) {
    const node = el('div', { class: 'tr-cap ' + c.cls }, el('span', { class: 'tr-word', text: c.text }), c.sub ? el('span', { class: 'tr-sub', text: c.sub }) : null);
    this.caps.appendChild(node);
    return node;
  }

  // ------------------------------------------------------------------ run
  /** Shows the title card; resolves when the trailer ends or is skipped. */
  run() {
    return new Promise(resolve => {
      this.resolve = resolve;
      this.g.trailer = this;
      this.g.audio.holdMusic = true;
      this.prepare();
      this.buildOverlay();
      this.show(this.title);
      this.prevStage = this.g.engine.stage;
      this.g.engine.setStage(this);
      document.body.classList.add('trailer-on');
    });
  }

  play() {
    if (this.state !== 'title') return;
    this.g.audio.unlock();
    this.state = 'playing';
    this.titleCard.classList.add('gone');
    setTimeout(() => { this.titleCard.style.display = 'none'; }, 460);
    this.root.classList.add('playing');
    this.hasMusic = this.music.start();
    this.t = this.hasMusic ? -0.12 : 0;
    this.shown = new Map();
    this.cutAt = -1;
  }

  update(dt) {
    if (this.state === 'title') {
      this.titleT = (this.titleT || 0) + dt;
      this.placeCamera(this.title, (this.titleT / 40) % 1);
      return;
    }
    if (this.state === 'done') return;
    this.t = this.hasMusic ? this.music.now() : this.t + dt;
    const t = Math.max(0, this.t), bar = t / BAR;
    this.bar.style.width = Math.min(100, t / END * 100) + '%';
    // which shot?
    const idx = SHOTS.findIndex(s => bar >= s.from && bar < s.to);
    const v = this.views[idx];
    if (v && v !== this.cur) {
      this.show(v);
      if (v.shot.montage || v.shot.id === 'logo') {
        this.flash.classList.remove('go'); void this.flash.offsetWidth; this.flash.classList.add('go');
        const fx = this.burstFx || (this.burstFx = new PlaceFX(this.scene));
        fx.celebrate(new THREE.Vector3(0, v.H * 0.8, 0), 36);
      }
    }
    if (!v) return;
    const u = Math.min(1, (bar - v.shot.from) / (Math.min(v.shot.to, 16.6) - v.shot.from));
    if (v.shot.figures) this.figureCamera(v, u); else this.placeCamera(v, u);
    if (v.shot.build) this.buildStep(v, t, dt);
    if (this.burstFx) this.burstFx.update(dt);
    // captions
    CAPTIONS.forEach((c, i) => {
      const on = t >= c.t[0] && t < c.t[1];
      const node = this.shown.get(i);
      if (on && !node) this.shown.set(i, this.caption(c));
      if (!on && node && !node.classList.contains('out')) { node.classList.add('out'); setTimeout(() => node.remove(), 320); }
    });
    // box art cards pop in with the words
    if (v.shot.id === 'boxes') {
      const want = Math.min(this.boxUrls.length, Math.floor((t - 18.9) / 0.95) + 1);
      while (this.boxes.children.length < want) {
        const i = this.boxes.children.length;
        this.boxes.appendChild(el('img', { class: 'tr-box b' + i, src: this.boxUrls[i], alt: '' }));
      }
    } else if (this.boxes.children.length && !this.boxes.classList.contains('out')) {
      this.boxes.classList.add('out');
    }
    if (bar >= 15 && this.state === 'playing') { this.state = 'ending'; this.endCard.classList.add('show'); this.skipBtn.classList.add('hide'); }
    if (t >= END) this.finish();
  }

  /** The first shot: the car builds itself, piece by piece, in time with the beat. */
  buildStep(v, t, dt) {
    v.fx.update(dt);
    const n = v.order.length, span = 3.2;
    const landAt = i => 0.12 + (i / n) * span;
    while (v.dropped < n && t >= landAt(v.dropped) - 0.12) {
      const b = v.bricks[v.order[v.dropped]];
      v.dropped++;
      const fall = v.dropped;
      v.fx.drop(b, this.g.engine.quality.detail, {
        height: 1.6,
        onLand: () => { if (fall % 2 === 0) this.g.audio.place(2, true); },
        onDone: () => { v.placed.push(b); v.r.setBricks(v.placed.slice()); },
      });
    }
  }

  figureCamera(v, u) {
    const xs = v.bb.minX + 2, xe = v.bb.maxX - 3;
    const x = xs + (xe - xs) * ease(u);
    const target = new THREE.Vector3(x, 1.9, 0);
    this.camera.position.set(x - 3, 4, 14);
    this.camera.near = 0.1; this.camera.far = 600;
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
  }

  finish() {
    if (this.state === 'done') return;
    this.state = 'done';
    this.music.stop();
    window.removeEventListener('keydown', this.onKey, true);
    this.root.classList.add('closing');
    document.body.classList.remove('trailer-on');
    setTimeout(() => this.root.remove(), 450);
    for (const v of [this.title, ...this.views]) { if (v.fx) v.fx.clear(); v.r.dispose(); this.scene.remove(v.r.group); v.bg.dispose(); }
    if (this.burstFx) this.burstFx.clear();
    this.g.audio.holdMusic = false;
    if (this.g.audio.ctx) this.g.audio.startMusic();
    if (this.g.engine.stage === this) this.g.engine.setStage(this.prevStage || null);
    if (this.g.trailer === this) this.g.trailer = null;
    this.resolve && this.resolve();
  }
}
