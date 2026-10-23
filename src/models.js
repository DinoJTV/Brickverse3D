// models.js — the structured model data system.
// A model is just a list of placed pieces: {t, x, y, z, r, c}.
// Generators (src/generators/*.js) use ModelBuilder to assemble pieces from reusable
// components. The SAME brick list is used for the finished model, the parts list and
// the instruction steps, so instructions can never mention a piece that doesn't exist.
import { PART_BY_ID, footprint } from './parts.js';
import { Occupancy, boundsOf } from './grid.js';

// ------------------------------------------------------------ seeded randomness
export function makeRng(seed) {
  let s = (typeof seed === 'string' ? hashString(seed) : seed) >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    chance: p => next() < p,
    shuffle: arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  };
}
export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Piece sizes used when filling areas, biggest first.
const BRICK_SIZES = [[2,8],[2,6],[2,4],[2,3],[2,2],[1,8],[1,6],[1,4],[1,3],[1,2],[1,1]];
const PLATE_SIZES = [[8,8],[6,8],[6,6],[4,8],[4,6],[4,4],[2,8],[2,6],[2,4],[2,3],[2,2],[1,8],[1,6],[1,4],[1,3],[1,2],[1,1]];
const TILE_SIZES = [[2,4],[2,2],[1,4],[1,2],[1,1]];

export class ModelBuilder {
  constructor() {
    this.bricks = [];
    this.occ = new Occupancy();
    this.skipped = 0;
  }

  /** Place one piece. Returns false (and places nothing) if it would overlap. */
  add(t, x, y, z, r = 0, c = 'white') {
    if (!PART_BY_ID[t]) throw new Error('Unknown part ' + t);
    if (y < 0) { this.skipped++; return false; }
    const b = { t, x, y, z, r: ((r % 4) + 4) % 4, c };
    if (this.occ.collides(b)) { this.skipped++; return false; }
    this.bricks.push(b);
    this.occ.add(b);
    return true;
  }

  isFree(x, y, z) { return !this.occ.at(x, y, z); }

  /**
   * Fill cells chosen by mask(x, z) on layer y with the largest pieces that fit.
   * kind: 'brick' | 'plate' | 'tile'. color may be a string or a function (x,z)=>color.
   * Alternating orientation per layer staggers the joints like a real build.
   */
  fillMask(y, x0, z0, w, d, mask, color, kind = 'brick') {
    const sizes = kind === 'plate' ? PLATE_SIZES : kind === 'tile' ? TILE_SIZES : BRICK_SIZES;
    const h = kind === 'brick' ? 3 : 1;
    const prefix = kind === 'brick' ? 'brick' : kind === 'plate' ? 'plate' : 'tile';
    const colorAt = typeof color === 'function' ? color : () => color;
    const want = (x, z) => x >= x0 && x < x0 + w && z >= z0 && z < z0 + d && mask(x, z);
    const done = new Set();
    const free = (x, z) => {
      for (let yy = y; yy < y + h; yy++) if (this.occ.at(x, yy, z)) return false;
      return true;
    };
    const preferX = (y % 2 === 0);
    for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) {
      if (done.has(x + ',' + z) || !want(x, z) || !free(x, z)) continue;
      const c = colorAt(x, z);
      let placed = false;
      for (const [a, bb] of sizes) {
        const orients = a === bb ? [[a, bb]] : (preferX ? [[bb, a], [a, bb]] : [[a, bb], [bb, a]]);
        for (const [fw, fd] of orients) {
          let ok = true;
          for (let i = 0; i < fw && ok; i++) for (let j = 0; j < fd && ok; j++) {
            const xx = x + i, zz = z + j;
            if (done.has(xx + ',' + zz) || !want(xx, zz) || !free(xx, zz) || colorAt(xx, zz) !== c) ok = false;
          }
          if (!ok) continue;
          const id = `${prefix}_${Math.min(a, bb)}x${Math.max(a, bb)}`;
          if (!PART_BY_ID[id]) continue;
          const part = PART_BY_ID[id];
          const r = (part.w === fw && part.d === fd) ? 0 : 1;
          if (this.add(id, x, y, z, r, c)) {
            for (let i = 0; i < fw; i++) for (let j = 0; j < fd; j++) done.add((x + i) + ',' + (z + j));
            placed = true;
          }
          break;
        }
        if (placed) break;
      }
    }
  }

  /** Solid rectangle of one kind of piece. */
  fill(y, x0, z0, w, d, color, kind = 'brick') {
    this.fillMask(y, x0, z0, w, d, () => true, color, kind);
  }

  /** Hollow rectangle of brick walls, `layers` bricks tall. Returns top y. */
  walls(y, x0, z0, w, d, layers, color, skip) {
    for (let l = 0; l < layers; l++) {
      const yy = y + l * 3;
      this.fillMask(yy, x0, z0, w, d, (x, z) => (x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + d - 1) && !(skip && skip(x, yy, z)), typeof color === 'function' ? (x, z) => color(x, yy, z) : color, 'brick');
    }
    return y + layers * 3;
  }

  /**
   * Voxel solid: shape(x, layer, z) returns a colour or null for each brick-sized cell.
   * `layer` counts brick layers (3 plates each) starting at baseY.
   */
  voxel(baseY, x0, z0, w, layers, d, shape, kind = 'brick') {
    const h = kind === 'brick' ? 3 : 1;
    for (let l = 0; l < layers; l++) {
      const cache = new Map();
      const col = (x, z) => { const k = x + ',' + z; if (!cache.has(k)) cache.set(k, shape(x, l, z)); return cache.get(k); };
      this.fillMask(baseY + l * h, x0, z0, w, d, (x, z) => !!col(x, z), col, kind);
    }
  }

  /** Row of slopes along X at height y facing direction r, across z range. */
  slopeRow(type, x, y, z0, z1, r, c) {
    const part = PART_BY_ID[type];
    const f = footprint(part, r);
    for (let z = z0; z + f.d <= z1; z += f.d) this.add(type, x, y, z, r, c);
  }

  /** True if a piece would fit here without overlapping anything. */
  fits(t, x, y, z, r = 0) { return !this.occ.collides({ t, x, y, z, r: ((r % 4) + 4) % 4 }); }

  /**
   * Make every piece hold on like a real build. A piece that touches no studs is fixed by,
   * in order: joining it with a neighbour of the same colour into one bigger piece,
   * growing it by a stud so it reaches support, adding a small post under it, or
   * lowering it onto studs just below. Tiny loose decorations that can't be fixed are
   * removed. Returns how many pieces were changed.
   */
  repair(maxPasses = 6) {
    const occ = this.occ;
    const prefixOf = t => (t.startsWith('brick_') ? 'brick' : t.startsWith('plate_') ? 'plate' : null);
    const boxPiece = (prefix, w, d) => {
      const t = `${prefix}_${Math.min(w, d)}x${Math.max(w, d)}`;
      const p = PART_BY_ID[t];
      if (!p) return null;
      return { t, r: p.w === w ? 0 : 1 };
    };
    const rect = b => { const f = footprint(PART_BY_ID[b.t], b.r); return { x: b.x, z: b.z, w: f.w, d: f.d }; };
    const removeB = b => { occ.remove(b); const i = this.bricks.indexOf(b); if (i >= 0) this.bricks.splice(i, 1); };
    const addB = b => { this.bricks.push(b); occ.add(b); };
    // swap `olds` for `nb` if it fits and is supported; otherwise undo
    const trySwap = (olds, nb) => {
      const ign = new Set(olds);
      if (occ.collides(nb, ign)) return false;
      for (const o of olds) removeB(o);
      addB(nb);
      if (occ.supported(nb)) return true;
      removeB(nb); for (const o of olds) addB(o);
      return false;
    };
    let changed = 0;
    for (let pass = 0; pass < maxPasses; pass++) {
      const loose = this.bricks.filter(b => !occ.supported(b));
      if (!loose.length) break;
      let fixedThisPass = 0;
      for (const P of loose) {
        if (!this.bricks.includes(P) || occ.supported(P)) continue;
        const part = PART_BY_ID[P.t], h = part.h, R = rect(P), pre = prefixOf(P.t);
        let ok = false;
        // 1) join with a same-colour neighbour of the same kind into one bigger piece
        if (pre) {
          const seen = new Set();
          const around = [];
          for (let i = 0; i < R.w; i++) { around.push([R.x + i, R.z - 1], [R.x + i, R.z + R.d]); }
          for (let j = 0; j < R.d; j++) { around.push([R.x - 1, R.z + j], [R.x + R.w, R.z + j]); }
          for (const [cx, cz] of around) {
            const N = occ.at(cx, P.y, cz);
            if (!N || seen.has(N) || N.y !== P.y || N.c !== P.c || prefixOf(N.t) !== pre) continue;
            seen.add(N);
            const Q = rect(N);
            let u = null;
            if (Q.z === R.z && Q.d === R.d && (Q.x === R.x + R.w || R.x === Q.x + Q.w)) u = { x: Math.min(Q.x, R.x), z: R.z, w: Q.w + R.w, d: R.d };
            else if (Q.x === R.x && Q.w === R.w && (Q.z === R.z + R.d || R.z === Q.z + Q.d)) u = { x: R.x, z: Math.min(Q.z, R.z), w: R.w, d: Q.d + R.d };
            if (!u) continue;
            const bp = boxPiece(pre, u.w, u.d);
            if (bp && trySwap([P, N], { t: bp.t, x: u.x, y: P.y, z: u.z, r: bp.r, c: P.c })) { ok = true; break; }
          }
        }
        // 2) grow by one or two studs toward support
        if (!ok && pre) {
          for (const k of [1, 2, 3]) {
            for (const [ax, az, aw, ad] of [[-k, 0, k, 0], [0, 0, k, 0], [0, -k, 0, k], [0, 0, 0, k]]) {
              const bp = boxPiece(pre, R.w + aw, R.d + ad);
              if (bp && trySwap([P], { t: bp.t, x: R.x + ax, y: P.y, z: R.z + az, r: bp.r, c: P.c })) { ok = true; break; }
            }
            if (ok) break;
          }
        }
        // 3) a short post under it, down to the studs below (at most one brick tall)
        if (!ok) {
          let best = null;
          for (let i = 0; i < R.w && !best; i++) for (let j = 0; j < R.d && !best; j++) {
            const cx = R.x + i, cz = R.z + j;
            for (let g = 1; g <= 3; g++) {
              const yy = P.y - g;
              if (yy < 0) break;
              const below = occ.at(cx, yy, cz);
              if (below) {
                if (g > 1 && PART_BY_ID[below.t].studs !== 'none') best = { cx, cz, g: g - 1 };
                break;
              }
              if (yy === 0) { if (g === 1) best = { cx, cz, g: 1, ground: true }; break; }
            }
          }
          if (best) {
            const posts = [];
            let yy = P.y - best.g;
            let left = best.g;
            while (left > 0) { const t = left >= 3 ? 'brick_1x1' : 'plate_1x1'; const hh = left >= 3 ? 3 : 1; posts.push({ t, x: best.cx, y: yy, z: best.cz, r: 0, c: P.c }); yy += hh; left -= hh; }
            if (posts.every(p => !occ.collides(p))) { for (const p of posts) addB(p); if (occ.supported(P) && posts.every(p => occ.supported(p))) ok = true; else for (const p of posts) removeB(p); }
          }
        }
        // 4) a hidden plate underneath, linking it to the piece beside it
        if (!ok && part.h >= 1) {
          for (let i = 0; i < R.w && !ok; i++) for (let j = 0; j < R.d && !ok; j++) {
            const cx = R.x + i, cz = R.z + j;
            if (P.y < 1 || occ.at(cx, P.y - 1, cz)) continue;
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = cx + dx, nz = cz + dz;
              const N = occ.at(nx, P.y, nz);
              if (!N || N === P || occ.at(nx, P.y - 1, nz)) continue;
              if (N.y !== P.y) continue;
              const nb = { t: 'plate_1x2', x: Math.min(cx, nx), y: P.y - 1, z: Math.min(cz, nz), r: dx ? 1 : 0, c: N.c };
              if (occ.collides(nb)) continue;
              addB(nb);
              if (occ.supported(P) && occ.supported(nb)) { ok = true; break; }
              removeB(nb);
            }
          }
        }
        // 5) lower it onto studs just below
        if (!ok) {
          for (let g = 1; g <= 3 && !ok; g++) {
            if (P.y - g < 0) break;
            if (trySwap([P], { ...P, y: P.y - g })) ok = true;
          }
        }
        // 6) a plate on top, bridging it to a neighbour whose top is level with it
        if (!ok && part.studs !== 'none') {
          const top = P.y + h;
          for (let i = 0; i < R.w && !ok; i++) for (let j = 0; j < R.d && !ok; j++) {
            const cx = R.x + i, cz = R.z + j;
            if (occ.at(cx, top, cz)) continue;
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = cx + dx, nz = cz + dz;
              const N = occ.at(nx, top - 1, nz);
              if (!N || N === P || occ.at(nx, top, nz) || PART_BY_ID[N.t].studs === 'none' || N.y + PART_BY_ID[N.t].h !== top) continue;
              const nb = { t: 'plate_1x2', x: Math.min(cx, nx), y: top, z: Math.min(cz, nz), r: dx ? 1 : 0, c: P.c };
              if (occ.collides(nb)) continue;
              addB(nb);
              if (occ.supported(P) && occ.supported(nb)) { ok = true; break; }
              removeB(nb);
            }
          }
        }
        // 7) small loose decorations go
        if (!ok && (!pre || pre === 'plate' || R.w * R.d <= 2)) { removeB(P); ok = true; }
        if (ok) { fixedThisPass++; changed++; }
      }
      if (!fixedThisPass) break;
    }
    return changed;
  }

  /** Final, normalised model: shifted so its min corner is at (0, 0, 0). */
  finish() {
    const bb = boundsOf(this.bricks);
    const dx = -bb.minX, dz = -bb.minZ, dy = -Math.min(0, bb.minY);
    const bricks = this.bricks.map(b => ({ ...b, x: b.x + dx, y: b.y + dy, z: b.z + dz }));
    return { bricks, dims: { w: bb.maxX - bb.minX, d: bb.maxZ - bb.minZ, h: bb.maxY - Math.min(0, bb.minY) } };
  }
}

// ------------------------------------------------------------ instructions
/**
 * Turn a brick list into numbered construction steps.
 * Pieces are ordered bottom-up so supporting pieces are always placed first,
 * then grouped into small steps of nearby pieces from the same layer.
 */
export function makeSteps(bricks, maxPerStep) {
  const order = bricks.map((b, i) => i).sort((a, b) => {
    const A = bricks[a], B = bricks[b];
    return A.y - B.y || A.x - B.x || A.z - B.z;
  });
  const per = maxPerStep || (bricks.length < 40 ? 3 : bricks.length < 150 ? 5 : bricks.length < 400 ? 8 : 12);
  const steps = [];
  let cur = [], curY = null;
  for (const i of order) {
    const y = bricks[i].y;
    if (cur.length && (cur.length >= per || (y !== curY && cur.length >= Math.ceil(per / 2)))) {
      steps.push(cur); cur = [];
    }
    cur.push(i); curY = y;
  }
  if (cur.length) steps.push(cur);
  return steps;
}

/** Count pieces by type+colour — the "included pieces" list. */
export function partsList(bricks) {
  const m = new Map();
  for (const b of bricks) {
    const k = b.t + '|' + b.c;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].map(([k, n]) => { const [t, c] = k.split('|'); return { t, c, n }; })
    .sort((a, b) => b.n - a.n);
}

/** A short fingerprint of a model's shape — used by tests to prove sets aren't duplicates. */
export function shapeSignature(bricks) {
  const s = bricks.map(b => `${b.t}${b.x},${b.y},${b.z},${b.r}`).sort().join(';');
  return hashString(s).toString(36) + ':' + bricks.length;
}
