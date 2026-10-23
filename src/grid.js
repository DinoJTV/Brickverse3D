// grid.js — the "stud-and-tube" rules: which cells a piece fills, collisions, support.
import { PART_BY_ID, footprint, hasTopConnection } from './parts.js';

const key = (x, y, z) => x + ',' + y + ',' + z;
const SIDE_ATTACH = new Set(['wheel', 'connector', 'propeller', 'hinge', 'technic', 'eye']);

/** All grid cells a brick fills. */
export function cellsOf(b) {
  const part = PART_BY_ID[b.t];
  if (!part) return [];
  const f = footprint(part, b.r);
  const out = [];
  for (let x = 0; x < f.w; x++)
    for (let z = 0; z < f.d; z++)
      for (let y = 0; y < part.h; y++) out.push([b.x + x, b.y + y, b.z + z]);
  return out;
}

/** An occupancy map of cell → brick, rebuilt from a brick list. */
export class Occupancy {
  constructor(bricks = []) {
    this.map = new Map();
    for (const b of bricks) this.add(b);
  }
  add(b) { for (const [x, y, z] of cellsOf(b)) this.map.set(key(x, y, z), b); }
  remove(b) {
    for (const [x, y, z] of cellsOf(b)) {
      const k = key(x, y, z);
      if (this.map.get(k) === b) this.map.delete(k);
    }
  }
  at(x, y, z) { return this.map.get(key(x, y, z)); }

  /** True if the brick would overlap anything (ignoring bricks in the `ignore` set). */
  collides(b, ignore) {
    for (const [x, y, z] of cellsOf(b)) {
      const o = this.map.get(key(x, y, z));
      if (o && !(ignore && ignore.has(o))) return true;
    }
    return false;
  }

  /**
   * A piece is "connected" if it sits on the baseplate, clicks onto studs below it,
   * or has a piece clicked onto it from above. Wheels, hinges and technic parts
   * may also attach from the side.
   */
  supported(b, ignore) {
    if (b.y === 0) return true;
    const part = PART_BY_ID[b.t];
    const f = footprint(part, b.r);
    for (let x = 0; x < f.w; x++) for (let z = 0; z < f.d; z++) {
      const below = this.map.get(key(b.x + x, b.y - 1, b.z + z));
      if (below && !(ignore && ignore.has(below)) && hasTopConnection(PART_BY_ID[below.t])) return true;
      const above = this.map.get(key(b.x + x, b.y + part.h, b.z + z));
      if (above && !(ignore && ignore.has(above)) && hasTopConnection(part)) return true;
    }
    if (SIDE_ATTACH.has(part.kind)) {
      for (const [x, y, z] of cellsOf(b)) {
        for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const n = this.map.get(key(x + dx, y, z + dz));
          if (n && n !== b && !(ignore && ignore.has(n))) return true;
        }
      }
    }
    return false;
  }
}

/** Axis-aligned bounds of a brick list, in grid units. */
export function boundsOf(bricks) {
  if (!bricks.length) return { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
  const bb = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const b of bricks) {
    const part = PART_BY_ID[b.t];
    if (!part) continue;
    const f = footprint(part, b.r);
    bb.minX = Math.min(bb.minX, b.x); bb.maxX = Math.max(bb.maxX, b.x + f.w);
    bb.minZ = Math.min(bb.minZ, b.z); bb.maxZ = Math.max(bb.maxZ, b.z + f.d);
    bb.minY = Math.min(bb.minY, b.y); bb.maxY = Math.max(bb.maxY, b.y + part.h);
  }
  return bb;
}

/** Do two placements describe the same physical piece? (handles symmetric rotations) */
export function samePlacement(a, b) {
  if (a.t !== b.t || a.x !== b.x || a.y !== b.y || a.z !== b.z) return false;
  if (a.r === b.r) return true;
  const part = PART_BY_ID[a.t];
  const symmetric180 = ['box', 'tile', 'round', 'axle', 'technic', 'grille', 'crenel', 'arch', 'window', 'trainwheel', 'wheel', 'light', 'flower', 'spike', 'antenna', 'cone', 'connector', 'dish', 'propeller', 'eye', 'hinge'];
  if (symmetric180.includes(part.kind) && (a.r & 1) === (b.r & 1)) return true;
  if (part.w === 1 && part.d === 1 && ['box', 'tile', 'round', 'cone', 'antenna', 'light', 'flower', 'spike', 'connector'].includes(part.kind)) return true;
  if (part.w === part.d && ['box', 'tile', 'round', 'dish'].includes(part.kind)) return true;
  return false;
}
