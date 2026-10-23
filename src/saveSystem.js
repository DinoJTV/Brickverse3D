// saveSystem.js — saving and loading progress in THIS browser (IndexedDB, with a
// localStorage fallback). GitHub Pages is static hosting, so nothing is uploaded or
// synced between devices; players can download/upload a backup file instead.
import { PART_BY_ID, COLOR_BY_ID, footprint } from './parts.js';
import { Occupancy } from './grid.js';

export const SAVE_VERSION = 1;
const DB_NAME = 'brickverse3d';
const STORE = 'kv';
const LS_PREFIX = 'brickverse3d:';

export const BUILD_AREA = { w: 48, d: 48, maxY: 180 };   // free-build plate size (studs) and height limit (plates)
export const MAX_BRICKS = 6000;

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    money: 500,
    xp: 0,
    level: 1,
    owned: {},                // setId -> { state: 'unopened'|'opened'|'completed', boughtAt, placed: [], completedAt, timesCompleted }
    stats: { setsPurchased: 0, modelsCompleted: 0, bricksPlaced: 0, boxesOpened: 0, moneyEarned: 0, freeBricksPlaced: 0, mistakes: 0, stepsCompleted: 0 },
    achievements: {},          // id -> timestamp
    daily: { lastClaimDay: null, loginStreak: 0, challengeDay: null, challenges: [] },
    buildStreak: { lastDay: null, count: 0, best: 0 },
    unlockedParts: [],
    milestones: {},            // milestone id -> true (already paid)
    customBuilds: [],          // { id, name, created, updated, bricks }
    workbench: { name: 'My Creation', buildId: null, bricks: [] },   // the free build in progress (autosaved)
    room: { order: [], rot: {} },
    settings: { quality: 'ultra', music: 0.35, sfx: 0.8, muted: false, showHints: true, autoRotateMenu: true, playTrailer: true },
  };
}

// ------------------------------------------------------------------ storage backends
function openDb() {
  return new Promise((res, rej) => {
    if (!('indexedDB' in window)) return rej(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error || new Error('IndexedDB failed to open'));
    req.onblocked = () => rej(new Error('IndexedDB blocked'));
  });
}

class Storage {
  constructor() { this.db = null; this.mode = 'none'; }
  async init() {
    try { this.db = await openDb(); this.mode = 'indexeddb'; }
    catch (e) {
      try { localStorage.setItem(LS_PREFIX + 'test', '1'); localStorage.removeItem(LS_PREFIX + 'test'); this.mode = 'localstorage'; }
      catch { this.mode = 'memory'; this.mem = new Map(); }
    }
    return this.mode;
  }
  get(key) {
    if (this.mode === 'indexeddb') return new Promise((res, rej) => {
      const r = this.db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      r.onsuccess = () => res(r.result ?? null); r.onerror = () => rej(r.error);
    });
    if (this.mode === 'localstorage') return Promise.resolve(localStorage.getItem(LS_PREFIX + key));
    return Promise.resolve(this.mem.get(key) ?? null);
  }
  set(key, value) {
    if (this.mode === 'indexeddb') return new Promise((res, rej) => {
      const tx = this.db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => res(true); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('Save aborted'));
    });
    if (this.mode === 'localstorage') { localStorage.setItem(LS_PREFIX + key, value); return Promise.resolve(true); }
    this.mem.set(key, value); return Promise.resolve(true);
  }
  del(key) {
    if (this.mode === 'indexeddb') return new Promise(res => { const tx = this.db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(key); tx.oncomplete = () => res(true); tx.onerror = () => res(false); });
    if (this.mode === 'localstorage') { localStorage.removeItem(LS_PREFIX + key); return Promise.resolve(true); }
    this.mem.delete(key); return Promise.resolve(true);
  }
}
export const storage = new Storage();

// ------------------------------------------------------------------ validation
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d, min = -Infinity, max = Infinity) => (typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const str = (v, d, max = 60) => (typeof v === 'string' ? v.slice(0, max) : d);

/**
 * Check a list of pieces from a save or an imported file.
 * Drops anything malformed or overlapping and reports what happened.
 */
export function validateBricks(list, area = BUILD_AREA) {
  const errors = [];
  if (!Array.isArray(list)) return { bricks: [], errors: ['The build has no list of pieces.'] };
  if (list.length > MAX_BRICKS) { errors.push(`Too many pieces (${list.length}); only the first ${MAX_BRICKS} were kept.`); list = list.slice(0, MAX_BRICKS); }
  const occ = new Occupancy();
  const out = [];
  let bad = 0, overlap = 0, outside = 0;
  for (const raw of list) {
    if (!isObj(raw)) { bad++; continue; }
    const b = { t: raw.t, x: raw.x, y: raw.y, z: raw.z, r: raw.r ?? 0, c: raw.c };
    if (!PART_BY_ID[b.t] || !COLOR_BY_ID[b.c] || ![b.x, b.y, b.z, b.r].every(Number.isInteger) || b.r < 0 || b.r > 3) { bad++; continue; }
    const f = footprint(PART_BY_ID[b.t], b.r);
    if (b.x < 0 || b.z < 0 || b.y < 0 || b.x + f.w > area.w || b.z + f.d > area.d || b.y + PART_BY_ID[b.t].h > area.maxY) { outside++; continue; }
    if (occ.collides(b)) { overlap++; continue; }
    occ.add(b); out.push(b);
  }
  if (bad) errors.push(`${bad} unreadable piece${bad > 1 ? 's were' : ' was'} skipped.`);
  if (outside) errors.push(`${outside} piece${outside > 1 ? 's were' : ' was'} outside the build area and skipped.`);
  if (overlap) errors.push(`${overlap} overlapping piece${overlap > 1 ? 's were' : ' was'} skipped.`);
  return { bricks: out, errors };
}

/** Repair a loaded save: fill in anything missing, clamp numbers, drop junk. */
export function sanitizeSave(raw) {
  const d = defaultSave();
  const notes = [];
  if (!isObj(raw)) return { save: d, notes: ['Save data was missing, so a new game was started.'] };
  const s = d;
  s.createdAt = num(raw.createdAt, d.createdAt);
  s.money = Math.round(num(raw.money, d.money, 0, 1e9));
  s.xp = Math.round(num(raw.xp, 0, 0, 1e10));
  s.level = Math.round(num(raw.level, 1, 1, 999));
  if (isObj(raw.owned)) for (const [id, o] of Object.entries(raw.owned)) {
    if (!isObj(o) || typeof id !== 'string' || id.length > 40) continue;
    const state = ['unopened', 'opened', 'completed'].includes(o.state) ? o.state : 'unopened';
    s.owned[id] = { state, boughtAt: num(o.boughtAt, Date.now()), placed: Array.isArray(o.placed) ? o.placed.filter(Number.isInteger) : [], completedAt: o.completedAt ? num(o.completedAt, null) : null, timesCompleted: Math.round(num(o.timesCompleted, state === 'completed' ? 1 : 0, 0, 1e6)), ...(typeof o.bags === 'number' ? { bags: Math.round(num(o.bags, 0, 0, 50)) } : {}) };
  }
  if (isObj(raw.stats)) for (const k of Object.keys(d.stats)) s.stats[k] = Math.round(num(raw.stats[k], 0, 0, 1e12));
  if (isObj(raw.achievements)) for (const [k, v] of Object.entries(raw.achievements)) if (typeof k === 'string' && k.length < 40) s.achievements[k] = num(v, Date.now());
  if (isObj(raw.daily)) {
    s.daily.lastClaimDay = str(raw.daily.lastClaimDay, null, 12);
    s.daily.loginStreak = Math.round(num(raw.daily.loginStreak, 0, 0, 10000));
    s.daily.challengeDay = str(raw.daily.challengeDay, null, 12);
    if (Array.isArray(raw.daily.challenges)) s.daily.challenges = raw.daily.challenges.filter(isObj).slice(0, 5).map(c => ({ id: str(c.id, 'x', 40), progress: num(c.progress, 0, 0), target: num(c.target, 1, 1), reward: num(c.reward, 50, 0, 100000), claimed: !!c.claimed, param: str(c.param, '', 40) }));
  }
  if (isObj(raw.buildStreak)) { s.buildStreak.lastDay = str(raw.buildStreak.lastDay, null, 12); s.buildStreak.count = Math.round(num(raw.buildStreak.count, 0, 0)); s.buildStreak.best = Math.round(num(raw.buildStreak.best, 0, 0)); }
  if (Array.isArray(raw.unlockedParts)) s.unlockedParts = raw.unlockedParts.filter(p => typeof p === 'string' && PART_BY_ID[p]);
  if (isObj(raw.milestones)) for (const k of Object.keys(raw.milestones)) if (k.length < 60) s.milestones[k] = true;
  if (Array.isArray(raw.customBuilds)) {
    for (const cb of raw.customBuilds.slice(0, 200)) {
      if (!isObj(cb)) continue;
      const { bricks, errors } = validateBricks(cb.bricks);
      if (errors.length) notes.push(`Build "${str(cb.name, 'Untitled', 40)}": ${errors.join(' ')}`);
      s.customBuilds.push({ id: str(cb.id, 'b' + Math.random().toString(36).slice(2), 40), name: str(cb.name, 'Untitled', 40), created: num(cb.created, Date.now()), updated: num(cb.updated, Date.now()), bricks });
    }
  }
  if (isObj(raw.workbench)) {
    const { bricks, errors } = validateBricks(raw.workbench.bricks);
    if (errors.length) notes.push('Your studio build: ' + errors.join(' '));
    s.workbench = { name: str(raw.workbench.name, 'My Creation', 40), buildId: str(raw.workbench.buildId, null, 40), bricks };
  }
  if (isObj(raw.room)) {
    if (Array.isArray(raw.room.order)) s.room.order = raw.room.order.filter(x => typeof x === 'string').slice(0, 1000);
    if (isObj(raw.room.rot)) for (const [k, v] of Object.entries(raw.room.rot)) s.room.rot[k] = Math.round(num(v, 0, 0, 3));
    if (isObj(raw.room.shelf)) {
      s.room.shelf = {};
      for (const [k, v] of Object.entries(raw.room.shelf)) {
        const i = Number(k);
        if (!Number.isInteger(i) || i < 0 || i > 5000 || !isObj(v) || typeof v.id !== 'string' || v.id.length > 40) continue;
        s.room.shelf[i] = { kind: v.kind === 'box' ? 'box' : 'build', id: v.id, rot: Math.round(num(v.rot, 0, 0, 3)) };
      }
    }
  }
  if (isObj(raw.settings)) {
    s.settings.quality = ['ultra', 'high', 'medium', 'low'].includes(raw.settings.quality) ? raw.settings.quality : 'ultra';
    s.settings.music = num(raw.settings.music, d.settings.music, 0, 1);
    s.settings.sfx = num(raw.settings.sfx, d.settings.sfx, 0, 1);
    s.settings.muted = !!raw.settings.muted;
    s.settings.showHints = raw.settings.showHints !== false;
    s.settings.autoRotateMenu = raw.settings.autoRotateMenu !== false;
    s.settings.playTrailer = raw.settings.playTrailer !== false;
  }
  return { save: s, notes };
}

// ------------------------------------------------------------------ load / save
export async function loadSave() {
  await storage.init();
  let text = null;
  try { text = await storage.get('save'); } catch (e) { return { save: defaultSave(), notes: ['Could not read saved progress: ' + e.message], mode: storage.mode, fresh: true }; }
  if (!text) return { save: defaultSave(), notes: [], mode: storage.mode, fresh: true };
  let raw;
  try { raw = JSON.parse(text); }
  catch {
    // keep the broken data so it isn't lost, then start fresh
    try { await storage.set('save-corrupt-' + Date.now(), text); } catch { /* ignore */ }
    return { save: defaultSave(), notes: ['Your saved progress was damaged and could not be read. A backup copy was kept and a new game was started.'], mode: storage.mode, fresh: true };
  }
  const { save, notes } = sanitizeSave(raw);
  return { save, notes, mode: storage.mode, fresh: false };
}

export async function writeSave(save) {
  const text = JSON.stringify(save);
  await storage.set('save', text);
  return text.length;
}

export async function resetSave() { await storage.del('save'); }

/** Small cache for rendered thumbnails so reloading the store is instant. */
export async function cacheGet(key) { try { return await storage.get('thumb:' + key); } catch { return null; } }
export async function cacheSet(key, val) { try { await storage.set('thumb:' + key, val); } catch { /* cache only */ } }

// ------------------------------------------------------------------ files
export function exportBuildFile(name, bricks) {
  return JSON.stringify({ format: 'brickverse-build', version: 1, name, exportedAt: new Date().toISOString(), pieces: bricks.length, bricks: bricks.map(b => ({ t: b.t, x: b.x, y: b.y, z: b.z, r: b.r, c: b.c })) }, null, 1);
}

/** Parse + validate a build file. Never executes anything from the file. */
export function parseBuildFile(text) {
  let data;
  try { data = JSON.parse(text); } catch { return { ok: false, error: 'This file is not valid JSON.' }; }
  if (!isObj(data) || data.format !== 'brickverse-build') return { ok: false, error: 'This is not a BrickVerse build file.' };
  if (!Array.isArray(data.bricks)) return { ok: false, error: 'The build file has no pieces in it.' };
  const { bricks, errors } = validateBricks(data.bricks);
  if (!bricks.length) return { ok: false, error: 'None of the pieces in this file could be used. ' + errors.join(' ') };
  return { ok: true, name: str(data.name, 'Imported build', 40), bricks, warnings: errors };
}

export function exportSaveFile(save) {
  return JSON.stringify({ format: 'brickverse-save', exportedAt: new Date().toISOString(), save }, null, 1);
}
export function parseSaveFile(text) {
  let data;
  try { data = JSON.parse(text); } catch { return { ok: false, error: 'This file is not valid JSON.' }; }
  if (!isObj(data) || data.format !== 'brickverse-save' || !isObj(data.save)) return { ok: false, error: 'This is not a BrickVerse save file.' };
  const { save, notes } = sanitizeSave(data.save);
  return { ok: true, save, notes };
}
