// generators/city.js — BIG CITY: large, detailed buildings with furnished interiors,
// vehicles parked inside, street furniture and rooftop details.
//
// House rules (so every building is neat and really buildable):
//  * Fronts face +Z. y is in plates. Walls are 3-plate brick layers.
//  * Each building has ONE window grid, centred on the facade and the same on every
//    floor, so windows, doors, garage bays, columns and signs all line up.
//  * Things on the street are placed in mirror pairs around the building's centre line.
//  * Every piece connects: floors are two crossing plate layers, signs/lights stand on
//    studs, flags sit on their poles, flowers grow in planters, nothing hangs in the air.
import { ModelBuilder } from '../models.js';
import { PART_BY_ID, footprint } from '../parts.js';
import { genCar, genTruck, genTrain } from './vehicles.js';
import { genAircraft } from './air.js';

// ------------------------------------------------------------------ toolkit
/** Build another model and drop it in. pos = {x|cx, z|cz} (corner or centre). turns = quarter turns. */
export function stamp(b, gen, rng, opts, pos, y, turns = 0) {
  const t = new ModelBuilder();
  gen(t, rng, opts);
  let { bricks, dims } = t.finish();
  for (let k = 0; k < ((turns % 4) + 4) % 4; k++) {
    bricks = bricks.map(br => { const f = footprint(PART_BY_ID[br.t], br.r); return { ...br, x: br.z, z: dims.w - br.x - f.w, r: (br.r + 1) % 4 }; });
    dims = { w: dims.d, d: dims.w, h: dims.h };
  }
  const dx = pos.cx != null ? Math.round(pos.cx - dims.w / 2) : pos.x;
  const dz = pos.cz != null ? Math.round(pos.cz - dims.d / 2) : pos.z;
  for (const br of bricks) b.add(br.t, br.x + dx, br.y + y, br.z + dz, br.r, br.c);
  return { dims, x: dx, z: dz };
}

/** Evenly spaced window positions (2 wide) centred between cells a and bEnd. */
export function gridSlots(a, bEnd, step) {
  const N = bEnd - a + 1;
  for (const st of [step, step + 1, step - 1, step + 2, step + 3]) {
    if (st < 3) continue;
    const k = Math.floor((N + st - 4) / st);
    if (k < 1) continue;
    const total = k * st - (st - 2);
    if ((N - total) % 2 === 0) { const s0 = a + (N - total) / 2; return Array.from({ length: k }, (_, i) => s0 + i * st); }
  }
  return [];
}

/**
 * One storey: walls with framed windows on a fixed grid (o.cols front/back, o.rows sides),
 * optional shutters, custom paint and extra openings. Returns the y at the top of the walls.
 */
function storey(b, o) {
  const { x0, z0, W, D, y } = o;
  const layers = o.layers || 3;
  const x1 = x0 + W - 1, z1 = z0 + D - 1;
  const key = (x, yy, z) => x + ',' + yy + ',' + z;
  const holes = new Set(), shut = new Set(), wins = [];
  const sides = o.sides || { front: true, back: true, left: true, right: true };
  const keep = o.keepOut || (() => false);
  const wy = y + (o.winRow ?? 1) * 3;
  const cols = o.cols || gridSlots(x0 + 1, x1 - 1, o.step || 4);
  const rows = o.rows || gridSlots(z0 + 1, z1 - 1, o.step || 4);
  if (o.windows !== false) {
    for (const [z, on] of [[z1, sides.front], [z0, sides.back]]) if (on) for (const x of cols) {
      if (keep(x, wy, z) || keep(x + 1, wy, z)) continue;
      wins.push({ x, z, r: 0 });
      for (const xx of [x, x + 1]) for (const yy of [wy, wy + 3]) holes.add(key(xx, yy, z));
      if (o.shutter && z === z1) for (const yy of [wy, wy + 3]) { shut.add(key(x - 1, yy, z)); shut.add(key(x + 2, yy, z)); }
    }
    for (const [x, on] of [[x0, sides.left], [x1, sides.right]]) if (on) for (const z of rows) {
      if (keep(x, wy, z) || keep(x, wy, z + 1)) continue;
      wins.push({ x, z, r: 1 });
      for (const zz of [z, z + 1]) for (const yy of [wy, wy + 3]) holes.add(key(x, yy, zz));
    }
  }
  const extra = o.hole || (() => false);
  const color = (x, yy, z) => {
    if (o.paint) { const c = o.paint(x, yy, z); if (c) return c; }
    if ((x === x0 || x === x1) && (z === z0 || z === z1)) return o.pillar || o.wall;
    if (shut.has(key(x, yy, z)) && !holes.has(key(x, yy, z))) return o.shutter;
    if (yy === y && o.base) return o.base;
    return o.wall;
  };
  b.walls(y, x0, z0, W, D, layers, color, (x, yy, z) => holes.has(key(x, yy, z)) || extra(x, yy, z));
  for (const w of wins) b.add('window_1x2x2', w.x, wy, w.z, w.r, o.frame || 'white');
  return y + layers * 3;
}

/** A strip of 2-deep plates along x or z (each piece rests on the wall and overhangs by one). */
function band(b, y, x, z, len, axis, c) {
  let p = 0;
  while (p < len) {
    const n = [8, 6, 4, 3, 2].find(v => p + v <= len);
    if (n) { b.add(`plate_2x${n}`, axis === 'x' ? x + p : x, y, axis === 'x' ? z : z + p, axis === 'x' ? 1 : 0, c); p += n; }
    else { b.add('plate_1x2', axis === 'x' ? x + p : x, y, axis === 'x' ? z : z + p, axis === 'x' ? 0 : 1, c); p += 1; }
  }
}

/**
 * Floor slab: two plate layers whose joins cross (so the floor holds together) with a
 * one-stud cornice all round. skip(x, z) leaves holes (e.g. for a fire pole). Returns new y.
 */
function slab(b, y, x0, z0, W, D, c, skip = () => false) {
  const x1 = x0 + W - 1, z1 = z0 + D - 1;
  b.fillMask(y, x0, z0, W, D, (x, z) => !skip(x, z), c, 'plate');
  band(b, y + 1, x0 - 1, z1, W + 2, 'x', c);           // front cornice
  band(b, y + 1, x0 - 1, z0 - 1, W + 2, 'x', c);       // back cornice
  band(b, y + 1, x0 - 1, z0 + 1, D - 2, 'z', c);       // left cornice
  band(b, y + 1, x1, z0 + 1, D - 2, 'z', c);           // right cornice
  b.fillMask(y + 1, x0 + 1, z0 + 1, W - 2, D - 2, (x, z) => !skip(x, z), c, 'plate');
  return y + 2;
}

/** Roof parapet: one brick layer with a smooth tile cap. */
function parapet(b, y, x0, z0, W, D, wall, cap) {
  b.walls(y, x0, z0, W, D, 1, wall);
  b.fillMask(y + 3, x0, z0, W, D, (x, z) => x === x0 || z === z0 || x === x0 + W - 1 || z === z0 + D - 1, cap, 'tile');
}
/** Smooth tiles over the rest of a flat roof (call after placing rooftop items). */
function roofTiles(b, y, x0, z0, W, D, c = 'lgray') { b.fillMask(y, x0 + 1, z0 + 1, W - 2, D - 2, () => true, c, 'tile'); }

// 3×5 pixel font for brick-built signs
const FONT = {
  A: ['111', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'], C: ['111', '100', '100', '100', '111'], D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'], G: ['111', '100', '101', '101', '111'], H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'], K: ['101', '110', '100', '110', '101'], L: ['100', '100', '100', '100', '111'], M: ['10001', '11011', '10101', '10001', '10001'],
  N: ['111', '101', '101', '101', '101'], O: ['111', '101', '101', '101', '111'], P: ['111', '101', '111', '100', '100'], R: ['111', '101', '110', '101', '101'],
  S: ['111', '100', '111', '001', '111'], T: ['111', '010', '010', '010', '010'], U: ['101', '101', '101', '101', '111'], W: ['10001', '10001', '10101', '11011', '10001'],
  Y: ['101', '101', '010', '010', '010'], ' ': ['000', '000', '000', '000', '000'],
};
/**
 * Lettered sign standing on studs, centred on the span [sx, sx+sw).
 * Each letter pixel is 1 stud × 2 plates, with a margin and an optional frame.
 */
function sign(b, sx, sw, y, z, text, fg = 'white', bg = 'red', frame = null) {
  const chars = [...text.toUpperCase()].filter(ch => FONT[ch]);
  const starts = []; let tw = 0;
  for (const ch of chars) { starts.push(tw); tw += FONT[ch][0].length + 1; }
  tw -= 1;
  let w = tw + 4;
  if ((sw - w) % 2) w += 1;                       // same parity as the span, so the panel is exactly centred
  const x0 = sx + (sw - w) / 2;
  const lpad = Math.floor((w - tw) / 2);
  const bit = (x, row) => {
    const lx = x - x0 - lpad;
    if (lx < 0 || lx >= tw) return false;
    let ci = chars.length - 1; while (ci > 0 && starts[ci] > lx) ci--;
    const g = FONT[chars[ci]][row], cc = lx - starts[ci];
    return cc < g.length && g[cc] === '1';
  };
  const H = 14;                                    // frame, margin, 5 rows × 2 plates, margin, frame
  for (let p = 0; p < H; p++) {
    const edge = p === 0 || p === H - 1;
    const row = 4 - Math.floor((p - 2) / 2);
    const inText = p >= 2 && p <= 11;
    b.fillMask(y + p, x0, z, w, 1, () => true, x => (frame && (edge || x === x0 || x === x0 + w - 1)) ? frame : (inText && bit(x, row) ? fg : bg), 'plate');
  }
  return { x0, w, top: y + H };
}
/** A free-standing sign on two posts, centred on [sx, sx+sw). */
function postSign(b, sx, sw, z, text, fg, bg, frame, posts = 1, y = 1) {
  const tw = [...text.toUpperCase()].filter(ch => FONT[ch]).reduce((a, ch) => a + FONT[ch][0].length + 1, -1);
  let w = tw + 4; if ((sw - w) % 2) w += 1;
  const x0 = sx + (sw - w) / 2;
  for (const x of [x0 + 1, x0 + w - 2]) for (let l = 0; l < posts; l++) b.add('round_1x1', x, y + l * 3, z, 0, 'dgray');
  return sign(b, sx, sw, y + posts * 3, z, text, fg, bg, frame);
}

/** A little figure standing on the studs at (x, y, z), facing the street unless turned. */
function fig(b, role, x, y, z, r = 0, c) { b.add('fig_' + role, x, y, z, r, c || PART_BY_ID['fig_' + role].fig.torso); }

const F = {
  /** Single bed: headboard, frame, pillow and blanket. */
  bed(b, x, y, z, blanket = 'azure', frame = 'white') {
    b.add('brick_1x2', x, y, z - 1, 1, frame); b.add('brick_1x2', x, y + 3, z - 1, 1, frame);
    b.add('brick_2x4', x, y, z, 0, frame);
    b.add('tile_2x2', x, y + 3, z, 0, 'white');
    b.add('tile_2x2', x, y + 3, z + 2, 0, blanket);
  },
  /** Bunk bed: lower bed, two posts at the foot, upper bunk resting on them. */
  bunk(b, x, y, z, c = 'red') {
    b.add('brick_2x4', x, y, z, 0, c);
    b.add('tile_2x2', x, y + 3, z, 0, 'white'); b.add('tile_1x2', x, y + 3, z + 2, 1, 'navy');
    b.add('round_1x1', x, y + 3, z + 3, 0, 'dgray'); b.add('round_1x1', x + 1, y + 3, z + 3, 0, 'dgray');
    b.add('plate_2x4', x, y + 6, z, 0, c);
    b.add('tile_2x2', x, y + 7, z, 0, 'white'); b.add('tile_2x2', x, y + 7, z + 2, 0, 'navy');
  },
  desk(b, x, y, z, top = 'tan', screen = true) {
    b.add('brick_1x1', x, y, z, 0, 'dgray'); b.add('brick_1x1', x + 3, y, z, 0, 'dgray');
    b.add('plate_2x4', x, y + 3, z, 1, top);
    if (screen) { b.add('brick_1x2', x + 1, y + 4, z, 1, 'black'); b.add('light_1x1', x + 1, y + 7, z, 0, 'tblue'); b.add('tile_1x2', x + 1, y + 4, z + 1, 1, 'lgray'); }
    b.add('brick_1x1', x + 1, y, z + 2, 0, 'black'); b.add('plate_1x1', x + 1, y + 3, z + 2, 0, 'black');
  },
  table(b, x, y, z, top = 'white', chair = 'red') {
    b.add('round_1x1', x, y, z, 0, 'lgray'); b.add('round_plate_1x1', x, y + 3, z, 0, 'lgray');
    b.add('plate_2x2', x, y + 4, z, 0, top);
    for (const [dx, dz] of [[-1, 0], [2, 1], [1, -1], [0, 2]]) b.add('brick_1x1', x + dx, y, z + dz, 0, chair);
  },
  counter(b, x, y, z, len, c = 'white', top = 'lgray', r = 0) {
    if (r === 0) { b.fill(y, x, z, len, 1, c, 'brick'); b.fill(y + 3, x, z, len, 1, top, 'tile'); }
    else { b.fill(y, x, z, 1, len, c, 'brick'); b.fill(y + 3, x, z, 1, len, top, 'tile'); }
  },
  lockers(b, x, y, z, n, c = 'lgray') { b.fill(y, x, z, n, 1, c, 'brick'); b.fill(y + 3, x, z, n, 1, c, 'brick'); b.fill(y + 6, x, z, n, 1, 'dgray', 'tile'); },
  plant(b, x, y, z) { b.add('round_1x1', x, y, z, 0, 'orange'); b.add('flower_1x1', x, y + 3, z, 0, 'green'); },
  sofa(b, x, y, z, c = 'blue') { b.fill(y, x, z, 4, 2, c, 'plate'); b.fill(y + 1, x, z, 4, 1, c, 'brick'); b.add('brick_1x1', x, y + 1, z + 1, 0, c); b.add('brick_1x1', x + 3, y + 1, z + 1, 0, c); },
  bench(b, x, y, z, len = 4, c = 'brown') { b.add('brick_1x1', x, y, z, 0, 'dgray'); b.add('brick_1x1', x + len - 1, y, z, 0, 'dgray'); b.fill(y + 3, x, z, len, 1, c, 'plate'); },
  lamp(b, x, y, z) { for (let l = 0; l < 4; l++) b.add('round_1x1', x, y + l * 3, z, 0, 'dgray'); b.add('plate_1x1', x, y + 12, z, 0, 'dgray'); b.add('light_1x1', x, y + 13, z, 0, 'tyellow'); },
  hydrant(b, x, y, z) { b.add('round_1x1', x, y, z, 0, 'red'); b.add('round_plate_1x1', x, y + 3, z, 0, 'red'); b.add('cone_1x1', x, y + 4, z, 0, 'red'); },
  cone(b, x, y, z) { b.add('cone_1x1', x, y, z, 0, 'orange'); },
  /** Rooftop air-con unit: 4×4 block with two vent grilles centred on top. */
  aircon(b, x, y, z) { b.fill(y, x, z, 4, 4, 'lgray', 'brick'); b.add('grille_1x2', x + 1, y + 3, z + 1, 1, 'dgray'); b.add('grille_1x2', x + 1, y + 3, z + 2, 1, 'dgray'); },
  /** Rooftop warning beacon on a short post. */
  beacon(b, x, y, z, c = 'tred') { b.add('round_1x1', x, y, z, 0, 'lgray'); b.add('light_1x1', x, y + 3, z, 0, c); },
  /** A neat 4×4 tree: green base, thick trunk, two-tier leafy top. */
  tree(b, x, y, z) {
    b.add('plate_4x4', x, y, z, 0, 'dgreen');
    b.add('round_2x2', x + 1, y + 1, z + 1, 0, 'brown'); b.add('round_2x2', x + 1, y + 4, z + 1, 0, 'brown');
    b.add('plate_4x4', x, y + 7, z, 0, 'green');
    b.add('brick_2x4', x, y + 8, z, 0, 'green'); b.add('brick_2x4', x + 2, y + 8, z, 0, 'lime');
    b.add('plate_4x4', x, y + 11, z, 0, 'green');
    b.add('brick_2x2', x + 1, y + 12, z + 1, 0, 'lime');
  },
  /** Planter box with flowers (len along x). */
  planter(b, x, y, z, len, colors = ['red', 'yellow', 'pink', 'white']) {
    b.fill(y, x, z, len, 1, 'dgray', 'brick');
    b.fill(y + 3, x, z, len, 1, 'brown', 'plate');
    for (let i = 0; i < len; i++) b.add('flower_1x1', x + i, y + 4, z, 0, colors[i % colors.length]);
  },
  /** Flag pole with the flag standing on top of the pole. */
  flagpole(b, x, y, z, flag = 'blue', h = 7, dir = 1) {
    for (let l = 0; l < h; l++) b.add('round_1x1', x, y + l * 3, z, 0, 'lgray');
    const t = y + h * 3, fx = dir > 0 ? x : x - 1;
    b.add('brick_1x2', fx, t, z, 1, flag); b.add('brick_1x2', fx, t + 3, z, 1, flag);
    b.add('round_plate_1x1', x, t + 6, z, 0, 'gold');
  },
};

/** Ground: pavement in front, then a road. Lane lines are painted last (see genBigCity). */
function street(b, x0, z0, W, roadZ, depth, opts = {}) {
  b.fill(0, x0, z0, W, roadZ - z0, opts.ground || 'lgray', 'plate');
  b.fill(0, x0, roadZ, W, depth, 'dgray', 'plate');
  b.fill(1, x0, roadZ, W, 1, 'lgray', 'tile');
  if (opts.lanes !== false) (b._lanes ||= []).push([x0, W, roadZ + Math.floor(depth / 2)]);
}
/** Dashed white lane line; skips anything already parked on the road. */
function laneMarks(b, x0, W, z) {
  for (let x = x0 + 1; x + 2 <= x0 + W - 1; x += 4) if (!b.occ.at(x, 1, z) && !b.occ.at(x + 1, 1, z)) b.add('tile_1x2', x, 1, z, 1, 'white');
}

// ------------------------------------------------------------------ the buildings
export const BIG_CITY = ['firestation', 'hospital', 'policehq', 'townhall', 'trainstation', 'mall', 'school', 'corner'];

export function genBigCity(b, rng, o = {}) {
  const kind = o.kind || rng.pick(BIG_CITY);
  b._lanes = [];
  const res = BUILD[kind](b, rng, o);
  for (const [x0, W, z] of b._lanes) laneMarks(b, x0, W, z);
  delete b._lanes;
  return res;
}

const BUILD = {
  // ================================================================ FIRE STATION
  firestation(b, rng) {
    const W = 38, D = 24, X = 3, Z = 2, x1 = X + W - 1, z1 = Z + D - 1;
    street(b, 0, 0, W + 6, z1 + 6, 10);
    const gy = 2;
    b.fill(1, X, Z, W, D, 'dgray', 'plate');
    // two 8-wide garage bays on the left, an office with a centred door on the right
    const bays = [X + 2, X + 12];
    const door = X + 27;
    const upCols = [X + 3, X + 7, X + 13, X + 17, X + 22, X + 27, X + 32];
    const rows = gridSlots(Z + 1, z1 - 1, 4);
    const inBay = x => bays.some(bx => x >= bx && x < bx + 8);
    const pole = { x: X + 30, z: Z + 14 };
    let y = storey(b, {
      x0: X, z0: Z, W, D, y: gy, layers: 5, wall: 'red', pillar: 'white', frame: 'white', winRow: 1,
      cols: [X + 22, X + 32], rows,
      hole: (x, yy, z) => z === z1 && ((inBay(x) && yy < gy + 15) || ((x === door || x === door + 1) && yy < gy + 9)),
    });
    for (const bx of bays) { b.add('arch_1x4', bx, gy + 12, z1, 0, 'white'); b.add('arch_1x4', bx + 4, gy + 12, z1, 0, 'white'); }
    b.add('door_1x2x3', door, gy, z1, 0, 'red');
    // the fire engine and the chief's car, parked facing the doors
    stamp(b, genTruck, rng, { style: 'fire', L: 16, color: 'red', accent: 'white' }, { cx: bays[0] + 4, z: Z + 5 }, gy, 3);
    stamp(b, genCar, rng, { style: 'suv', color: 'red', W: 6 }, { cx: bays[1] + 4, z: Z + 6 }, gy, 3);
    // equipment wall, office desk, the brass fire pole
    F.lockers(b, X + 2, gy, Z + 1, 8, 'yellow');
    for (let i = 0; i < 3; i++) b.add('round_2x2', X + 12 + i * 3, gy, Z + 1, 0, 'red');
    F.desk(b, X + 25, gy, Z + 3, 'tan');
    F.counter(b, X + 35, gy, Z + 8, 8, 'white', 'red', 1);
    F.plant(b, X + 21, gy, z1 - 1); F.plant(b, X + 36, gy, z1 - 1);
    for (let l = 0; l < 8; l++) b.add('round_1x1', pole.x, gy + l * 3, pole.z, 0, 'gold');
    fig(b, 'firefighter', X + 25, gy, Z + 8);
    // crew floor
    y = slab(b, y, X, Z, W, D, 'white', (x, z) => x === pole.x && z === pole.z);
    const fy = y;
    y = storey(b, { x0: X, z0: Z, W, D, y, wall: 'red', pillar: 'white', frame: 'white', shutter: 'dred', cols: upCols, rows });
    for (let i = 0; i < 4; i++) F.bunk(b, X + 2 + i * 3, fy, Z + 3, 'red');
    F.table(b, X + 17, fy, Z + 11, 'white', 'red');
    F.sofa(b, X + 23, fy, Z + 4, 'navy');
    F.counter(b, X + 2, fy, z1 - 3, 8, 'white', 'dgray');
    F.lockers(b, X + 31, fy, Z + 1, 6, 'lgray');
    F.plant(b, x1 - 1, fy, z1 - 1);
    fig(b, 'firefighter', X + 20, fy, Z + 16);
    // roof; the hose-drying tower is built before the parapet so they join neatly
    y = slab(b, y, X, Z, W, D, 'white');
    const tx = x1 - 6, tz = Z + 1;
    let ty = y;
    for (let f = 0; f < 3; f++) { ty = storey(b, { x0: tx, z0: tz, W: 6, D: 6, y: ty, wall: 'red', pillar: 'white', frame: 'white', cols: [tx + 2], rows: [tz + 2] }); ty = slab(b, ty, tx, tz, 6, 6, 'white'); }
    parapet(b, ty, tx, tz, 6, 6, 'red', 'white');
    F.flagpole(b, tx + 2, ty, tz + 2, 'red', 3);
    F.beacon(b, tx + 4, ty, tz + 3, 'tred');
    roofTiles(b, ty, tx, tz, 6, 6, 'lgray');
    parapet(b, y, X, Z, W, D, 'red', 'white');
    sign(b, bays[0], bays[1] + 8 - bays[0], y, z1 + 1, 'FIRE', 'white', 'red', 'gold');
    // rooftop: air-con unit, dish, beacons at the front corners
    F.aircon(b, X + 4, y, Z + 4);
    b.add('dish_2x2', X + 24, y, Z + 4, 0, 'white');
    F.beacon(b, X + 1, y, z1 - 1, 'tred'); F.beacon(b, x1 - 1, y, z1 - 1, 'tred');
    roofTiles(b, y, X, Z, W, D, 'lgray');
    // pavement: yellow lines either side of each bay, hydrant, cones, lamps, hose reel
    for (const bx of bays) { b.fill(1, bx - 1, z1 + 1, 1, 4, 'yellow', 'tile'); b.fill(1, bx + 8, z1 + 1, 1, 4, 'yellow', 'tile'); }
    F.hydrant(b, door - 3, 1, z1 + 3); F.lamp(b, X, 1, z1 + 3); F.lamp(b, x1, 1, z1 + 3);
    for (let i = 0; i < 3; i++) F.cone(b, X + 21 + i, 1, z1 + 4);
    b.add('round_2x2', X + 33, 1, z1 + 2, 0, 'red'); b.add('round_plate_1x1', X + 33, 4, z1 + 2, 0, 'yellow');
    fig(b, 'firefighter', bays[0] + 3, 1, z1 + 2); fig(b, 'firefighter', bays[1] + 3, 1, z1 + 2);
    return { style: 'firestation', main: 'red' };
  },

  // ================================================================ HOSPITAL
  hospital(b, rng) {
    const W = 40, D = 24, X = 3, Z = 2, x1 = X + W - 1, z1 = Z + D - 1;
    street(b, 0, 0, W + 13, z1 + 6, 10);
    const gy = 2;
    b.fill(1, X, Z, W, D, 'lgray', 'plate');
    const cols = gridSlots(X + 1, x1 - 1, 4);         // shared by every floor
    const rows = gridSlots(Z + 1, z1 - 1, 4);
    const mid = X + W / 2;                            // centre line of the facade
    const lobby = [mid - 10, mid + 10];               // 20-wide glass front, centred
    const bay = [Z + 8, Z + 20];                      // ambulance doorway in the right wall
    let y = storey(b, {
      x0: X, z0: Z, W, D, y: gy, layers: 4, wall: 'white', pillar: 'azure', frame: 'azure', cols, rows,
      sides: { front: true, back: true, left: true, right: false },
      keepOut: (x, yy, z) => z === z1 && x >= lobby[0] - 1 && x <= lobby[1],
      hole: (x, yy, z) => (z === z1 && x >= lobby[0] && x < lobby[1] && yy < gy + 9) || (x === x1 && z >= bay[0] && z < bay[1] && yy < gy + 9),
      paint: (x, yy, z) => (yy === gy + 9 ? 'azure' : null),
    });
    b.add('window_1x4x3', lobby[0], gy, z1, 0, 'azure'); b.add('window_1x4x3', lobby[0] + 4, gy, z1, 0, 'azure');
    b.add('door_1x2x3', mid - 2, gy, z1, 0, 'tclear'); b.add('door_1x2x3', mid, gy, z1, 0, 'tclear');
    b.add('window_1x4x3', mid + 2, gy, z1, 0, 'azure'); b.add('window_1x4x3', mid + 6, gy, z1, 0, 'azure');
    // lobby: reception desk, waiting chairs, plants (all mirrored about the centre)
    F.counter(b, mid - 5, gy, z1 - 9, 10, 'white', 'azure');
    b.add('brick_1x2', mid - 1, gy + 4, z1 - 9, 1, 'black'); b.add('light_1x1', mid - 1, gy + 7, z1 - 9, 0, 'tblue');
    for (const o of [-8, -3, 3, 8]) b.add('brick_1x2', mid + o - 1, gy, z1 - 4, 1, 'teal');
    F.plant(b, lobby[0], gy, z1 - 1); F.plant(b, lobby[1] - 1, gy, z1 - 1);
    fig(b, 'nurse', mid - 1, gy, z1 - 11); fig(b, 'doctor', mid - 6, gy, z1 - 6);
    // treatment room at the back right
    F.bed(b, X + 27, gy, Z + 3, 'white', 'lgray'); F.bed(b, X + 31, gy, Z + 3, 'white', 'lgray');
    F.beacon(b, X + 35, gy, Z + 3, 'tgreen');
    // ambulance parked inside, ready to drive out of the side doorway
    stamp(b, genCar, rng, { style: 'ambulance' }, { x: X + 25, cz: (bay[0] + bay[1]) / 2 }, gy, 0);
    // canopy over the ambulance driveway on two posts
    const cy = gy + 12;
    for (const z of [bay[0], bay[1] - 1]) { for (let l = 0; l < 4; l++) b.add('round_1x1', x1 + 5, 1 + l * 3, z, 0, 'lgray'); b.add('round_plate_1x1', x1 + 5, 13, z, 0, 'lgray'); }
    b.add('plate_6x8', x1 + 1, cy, bay[0], 0, 'white'); b.add('plate_4x6', x1 + 1, cy, bay[0] + 8, 1, 'white');
    // wards: two floors of patient rooms
    y = slab(b, y, X, Z, W, D, 'azure');
    b.fill(cy + 1, x1 + 2, bay[0], 5, bay[1] - bay[0], 'red', 'tile');
    for (let f = 0; f < 2; f++) {
      const fy = y;
      y = storey(b, { x0: X, z0: Z, W, D, y, wall: 'white', pillar: 'azure', frame: 'azure', cols, rows, base: f ? 'azure' : 'white' });
      for (let i = 0; i < 6; i++) { F.bed(b, X + 3 + i * 6, fy, Z + 3, f ? 'pink' : 'azure'); F.beacon(b, X + 5 + i * 6, fy, Z + 2, i % 2 ? 'tgreen' : 'tred'); }
      F.counter(b, mid - 5, fy, z1 - 8, 10, 'white', 'azure');
      F.plant(b, X + 1, fy, z1 - 1); F.plant(b, x1 - 1, fy, z1 - 1);
      fig(b, f ? 'doctor' : 'nurse', X + 6 + f * 12, fy, Z + 10);
      y = slab(b, y, X, Z, W, D, f ? 'white' : 'azure');
    }
    // top floor: offices, with a red cross centred on the front
    const fy = y;
    y = storey(b, {
      x0: X, z0: Z, W, D, y, wall: 'white', pillar: 'azure', frame: 'azure', cols, rows,
      keepOut: (x, yy, z) => z === z1 && x >= mid - 4 && x < mid + 4,
      paint: (x, yy, z) => {
        if (z !== z1 || x < mid - 3 || x >= mid + 3) return null;
        const row = (yy - fy) / 3;
        if (x === mid - 1 || x === mid) return 'red';
        if (row === 1) return 'red';
        return 'white';
      },
    });
    for (let i = 0; i < 3; i++) F.desk(b, X + 3 + i * 6, fy, Z + 3, 'white');
    F.sofa(b, X + 28, fy, Z + 4, 'azure');
    y = slab(b, y, X, Z, W, D, 'azure');
    parapet(b, y, X, Z, W, D, 'white', 'azure');
    sign(b, X, W, y, z1 + 1, 'HOSPITAL', 'white', 'red', 'white');
    // rooftop helipad: yellow ring, white H built into the deck, rescue helicopter on top
    const R = 8, hcx = X + 12, hcz = Z + 12;
    b.voxel(y, hcx - R, hcz - R, 2 * R, 1, 2 * R, (x, l, z) => {
      const d = Math.hypot(x + 0.5 - hcx, z + 0.5 - hcz); if (d > R - 0.3) return null;
      const lx = x - (hcx - 3), lz = z - (hcz - 3);
      if (lx >= 0 && lx < 6 && lz >= 0 && lz < 6 && (lx === 0 || lx === 5 || lz === 2 || lz === 3)) return 'white';
      return d > R - 1.5 ? 'yellow' : 'dgray';
    }, 'plate');
    stamp(b, genAircraft, rng, { style: 'helicopter', color: 'red', accent: 'white', rescue: true }, { cx: hcx, cz: hcz }, y + 1, 0);
    F.aircon(b, X + 28, y, Z + 5);
    b.add('dish_2x2', X + 34, y, Z + 14, 0, 'white');
    F.beacon(b, X + 1, y, Z + 1, 'tred'); F.beacon(b, x1 - 1, y, Z + 1, 'tred');
    roofTiles(b, y, X, Z, W, D, 'lgray');
    // pavement: mirrored lamps, trees, planters and benches either side of the entrance
    F.lamp(b, X, 1, z1 + 4); F.lamp(b, x1, 1, z1 + 4);
    F.tree(b, X + 3, 1, z1 + 1); F.tree(b, x1 - 6, 1, z1 + 1);
    F.planter(b, lobby[0], 1, z1 + 3, 6); F.planter(b, lobby[1] - 6, 1, z1 + 3, 6);
    F.bench(b, lobby[0], 1, z1 + 1, 4, 'brown'); F.bench(b, lobby[1] - 4, 1, z1 + 1, 4, 'brown');
    fig(b, 'shopper', mid - 1, 1, z1 + 3);
    return { style: 'hospital', main: 'white' };
  },

  // ================================================================ POLICE HQ
  policehq(b, rng) {
    const W = 34, D = 22, X = 3, Z = 2, x1 = X + W - 1, z1 = Z + D - 1;
    street(b, 0, 0, W + 6, z1 + 7, 10);
    const gy = 2;
    b.fill(1, X, Z, W, D, 'dgray', 'plate');
    const cols = gridSlots(X + 1, x1 - 1, 4), rows = gridSlots(Z + 1, z1 - 1, 4);
    const mid = X + W / 2;
    const door = mid - 2;                                  // 4-wide gate, centred
    const bay = cols[cols.length - 2] - 1;                 // 8-wide garage under the last two window columns
    const inBay = x => x >= bay && x < bay + 8;
    b.fill(1, door - 2, z1 + 1, 8, 2, 'lgray', 'plate');  // front step
    let y = storey(b, {
      x0: X, z0: Z, W, D, y: gy, layers: 5, wall: 'white', pillar: 'blue', frame: 'blue', base: 'blue', cols, rows,
      keepOut: (x, yy, z) => z === z1 && ((x >= door - 1 && x <= door + 4) || (x >= bay - 1 && x <= bay + 8)),
      hole: (x, yy, z) => z === z1 && (((x >= door && x < door + 4) && yy < gy + 15) || (inBay(x) && yy < gy + 15)),
    });
    b.add('door_1x4x5', door, gy, z1, 0, 'blue');
    b.add('arch_1x4', bay, gy + 12, z1, 0, 'white'); b.add('arch_1x4', bay + 4, gy + 12, z1, 0, 'white');
    stamp(b, genCar, rng, { style: 'police' }, { cx: bay + 4, z: Z + 7 }, gy, 3);
    // two jail cells with bars along the back wall
    for (let c = 0; c < 2; c++) {
      const cx = X + 2 + c * 7;
      for (let i = 0; i < 6; i++) b.add('antenna_1x1', cx + i, gy, Z + 7, 0, 'dgray');
      b.add('brick_1x4', cx, gy, Z + 2, 1, 'lgray');
      b.add('brick_1x1', cx + 5, gy, Z + 2, 0, 'white');
    }
    F.counter(b, mid - 5, gy, z1 - 7, 10, 'blue', 'white');
    b.add('brick_1x2', mid - 1, gy + 4, z1 - 7, 1, 'black'); b.add('light_1x1', mid - 1, gy + 7, z1 - 7, 0, 'tblue');
    F.plant(b, door - 2, gy, z1 - 1); F.plant(b, door + 5, gy, z1 - 1);
    fig(b, 'police', mid - 1, gy, z1 - 9);
    // offices and control room
    y = slab(b, y, X, Z, W, D, 'blue');
    for (let f = 0; f < 2; f++) {
      const fy = y;
      y = storey(b, { x0: X, z0: Z, W, D, y, wall: 'white', pillar: 'blue', frame: 'blue', base: f ? 'white' : 'lgray', cols, rows });
      for (let i = 0; i < 4; i++) F.desk(b, X + 3 + i * 7, fy, Z + 3, 'white');
      if (f === 1) { b.fill(fy, mid - 5, Z + 12, 10, 1, 'black', 'brick'); for (let i = 0; i < 5; i++) b.add('light_1x1', mid - 5 + i * 2, fy + 3, Z + 12, 0, ['tblue', 'tgreen', 'tred', 'tyellow', 'tblue'][i]); }
      else F.table(b, mid - 1, fy, Z + 13, 'tan', 'black');
      F.lockers(b, X + 24, fy, z1 - 1, 6, 'lgray');
      y = slab(b, y, X, Z, W, D, f ? 'blue' : 'white');
    }
    parapet(b, y, X, Z, W, D, 'white', 'blue');
    sign(b, X, W, y, z1 + 1, 'POLICE', 'white', 'blue', 'white');
    // roof: radio mast, dish, beacons and a police helicopter
    for (let l = 0; l < 6; l++) b.add('round_1x1', x1 - 3, y + l * 3, Z + 3, 0, l % 2 ? 'red' : 'white');
    b.add('antenna_1x1', x1 - 3, y + 18, Z + 3, 0, 'lgray');
    b.add('dish_2x2', x1 - 8, y, Z + 3, 0, 'white');
    stamp(b, genAircraft, rng, { style: 'helicopter', color: 'blue', accent: 'white' }, { cx: X + 11, cz: Z + 11 }, y, 0);
    F.beacon(b, X + 1, y, z1 - 1, 'tblue'); F.beacon(b, x1 - 1, y, z1 - 1, 'tred');
    roofTiles(b, y, X, Z, W, D, 'lgray');
    // pavement
    F.flagpole(b, X, 1, z1 + 5, 'blue', 6);
    F.lamp(b, x1, 1, z1 + 5);
    for (const x of [bay - 1, bay + 8]) b.fill(1, x, z1 + 1, 1, 4, 'yellow', 'tile');
    for (let i = 0; i < 3; i++) F.cone(b, bay + 2 + i * 2, 1, z1 + 5);
    fig(b, 'police', door - 4, 1, z1 + 3); fig(b, 'police', bay + 3, 1, z1 + 3);
    return { style: 'policehq', main: 'blue' };
  },

  // ================================================================ TOWN HALL
  townhall(b, rng) {
    const W = 38, D = 22, X = 3, Z = 2, x1 = X + W - 1, z1 = Z + D - 1;
    street(b, 0, 0, W + 6, z1 + 10, 8, { ground: 'tan' });
    const stone = 'tan', trim = 'white';
    const mid = X + W / 2;
    const cols = gridSlots(X + 1, x1 - 1, 4), rows = gridSlots(Z + 1, z1 - 1, 4);
    // plinth under the building and the portico, with centred steps
    b.fill(1, X, Z, W, D, trim, 'brick');
    b.fill(1, X + 1, z1 + 1, W - 2, 4, trim, 'brick');
    for (let s = 0; s < 3; s++) b.fill(1 + s, mid - 8 + s, z1 + 5, 16 - s * 2, 3 - s, trim, 'plate');
    const gy = 4;
    const door = mid - 2;
    let y = gy;
    for (let f = 0; f < 2; f++) {
      const fy = y;
      y = storey(b, { x0: X, z0: Z, W, D, y, layers: 4, wall: stone, pillar: trim, frame: 'dgreen', base: trim, cols, rows,
        keepOut: (x, yy, z) => f === 0 && z === z1 && x >= door - 1 && x <= door + 4,
        hole: (x, yy, z) => f === 0 && z === z1 && x >= door && x < door + 4 && yy < gy + 9 });
      if (f === 0) {
        b.add('door_1x2x3', door, gy, z1, 0, 'brown'); b.add('door_1x2x3', door + 2, gy, z1, 0, 'brown');
        F.table(b, mid - 11, fy, Z + 8, 'brown', 'dred'); F.table(b, mid + 9, fy, Z + 8, 'brown', 'dred');
        F.counter(b, mid - 6, fy, Z + 4, 12, 'brown', 'dgreen');
      } else {
        for (let i = 0; i < 5; i++) b.add('brick_1x2', mid - 9 + i * 4, fy, Z + 10, 1, 'dred');
        F.counter(b, mid - 7, fy, Z + 4, 14, 'brown', 'brown');
        F.plant(b, X + 1, fy, z1 - 1); F.plant(b, x1 - 1, fy, z1 - 1);
      }
      y = slab(b, y, X, Z, W, D, trim);
    }
    // portico: six columns placed symmetrically about the door, beam on top
    for (const o of [-15, -9, -3, 3, 9, 15]) for (let l = 0; l < 9; l++) b.add('round_2x2', mid + o - 1, gy + l * 3, z1 + 2, 0, trim);
    b.fill(gy + 27, X + 1, z1 + 2, W - 2, 2, trim, 'plate');
    // pediment: a low triangle (3 studs in per layer, sloped ends) bridging the roof and the beam
    let py = y, px = X + 1, pw = W - 2;
    while (pw >= 8) {
      for (const z of [z1, z1 + 2]) { b.add('slope_2x3', px, py, z, 3, trim); b.add('slope_2x3', px + pw - 3, py, z, 1, trim); }
      b.fill(py, px + 3, z1, pw - 6, 4, (x) => (py === y && (x === mid - 1 || x === mid) ? 'gold' : trim), 'brick');
      px += 3; pw -= 6; py += 3;
    }
    b.fill(py, px, z1, pw, 4, trim, 'tile');
    // clock tower with a green dome, centred on the roof
    const ts = 8, tx = mid - ts / 2, tz = Z + 4;
    let ty = y;
    ty = storey(b, { x0: tx, z0: tz, W: ts, D: ts, y: ty, wall: stone, pillar: trim, frame: 'dgreen', cols: [tx + 3], rows: [tz + 3] });
    ty = slab(b, ty, tx, tz, ts, ts, trim);
    // clock faces on all four sides (white face, black hands)
    ty = storey(b, { x0: tx, z0: tz, W: ts, D: ts, y: ty, wall: stone, pillar: trim, windows: false,
      paint: (x, yy, z) => { const lx = (x === tx || x === tx + ts - 1) ? z - tz : x - tx; const ly = (yy - ty) / 3; if (lx < 2 || lx > 5) return null; if (lx === 3 && ly >= 1) return 'black'; if (lx === 4 && ly === 1) return 'black'; return 'white'; } });
    ty = slab(b, ty, tx, tz, ts, ts, trim);
    for (let l = 0; l < 4; l++) { const r = 4 - l * 0.95; b.voxel(ty + l * 3, tx, tz, ts, 1, ts, (x, ll, z) => (Math.hypot(x - tx - 3.5, z - tz - 3.5) <= r ? 'dgreen' : null)); }
    b.add('round_2x2', tx + 3, ty + 12, tz + 3, 0, 'gold');
    parapet(b, y, X, Z, W, D, stone, trim);
    F.flagpole(b, X + 1, y, z1 - 1, 'red', 4); F.flagpole(b, x1 - 1, y, z1 - 1, 'blue', 4, -1);
    roofTiles(b, y, X, Z, W, D, 'dgreen');
    // gardens either side of the steps, all mirrored
    F.tree(b, X, 1, z1 + 5); F.tree(b, x1 - 3, 1, z1 + 5);
    F.planter(b, X + 5, 1, z1 + 7, 6, ['red', 'yellow']); F.planter(b, x1 - 10, 1, z1 + 7, 6, ['red', 'yellow']);
    F.lamp(b, mid - 10, 1, z1 + 8); F.lamp(b, mid + 9, 1, z1 + 8);
    fig(b, 'mayor', mid - 1, gy, z1 + 1); fig(b, 'kid', mid - 1, 1, z1 + 8);
    return { style: 'townhall', main: 'tan' };
  },

  // ================================================================ TRAIN STATION
  trainstation(b, rng) {
    const W = 42, D = 16, X = 3, Z = 15, x1 = X + W - 1, z1 = Z + D - 1;
    const GW = W + 6;
    // tracks and platform behind the station
    b.fill(0, 0, 0, GW, Z, 'dgray', 'plate');
    stamp(b, genTrain, rng, { style: 'diesel', cars: 1, track: true, color: 'blue', accent: 'yellow' }, { cx: GW / 2, z: 1 }, 1, 0);
    b.fill(1, 0, 8, GW, Z - 8, 'lgray', 'brick');
    b.fill(4, 0, 8, GW, 1, 'yellow', 'tile');
    // platform canopy: one post under each roof plate
    for (let i = 0; i < 6; i++) { for (let l = 0; l < 6; l++) b.add('round_1x1', i * 8 + 3, 4 + l * 3, 11, 0, 'dgreen'); b.add('plate_6x8', i * 8, 22, 8, 1, 'dgreen'); }
    b.fill(23, 0, 9, GW, 4, 'tclear', 'tile');
    b.fill(23, 0, 8, GW, 1, 'dgreen', 'tile'); b.fill(23, 0, 13, GW, 1, 'dgreen', 'tile');
    F.bench(b, 6, 4, 12, 4, 'brown'); F.bench(b, GW - 10, 4, 12, 4, 'brown');
    fig(b, 'conductor', GW / 2 - 1, 4, 10);
    // station building
    street(b, 0, Z, GW, z1 + 6, 10);
    const gy = 2;
    b.fill(1, X, Z, W, D, 'tan', 'plate');
    const cols = gridSlots(X + 1, x1 - 1, 4), rows = gridSlots(Z + 1, z1 - 1, 4);
    const mid = X + W / 2;
    const tw = 8, tx = mid - tw / 2, tz = Z + 1;       // clock tower rises from the middle of the roof, behind the sign
    const door = mid - 2;
    let y = storey(b, { x0: X, z0: Z, W, D, y: gy, layers: 4, wall: 'dred', pillar: 'tan', frame: 'dgreen', base: 'tan', cols, rows,
      keepOut: (x, yy, z) => (z === z1 || z === Z) && x >= door - 1 && x <= door + 4,
      hole: (x, yy, z) => (z === z1 || z === Z) && x >= door && x < door + 4 && yy < gy + 9 });
    for (const z of [z1, Z]) { b.add('door_1x2x3', door, gy, z, 0, 'dgreen'); b.add('door_1x2x3', door + 2, gy, z, 0, 'dgreen'); }
    // ticket hall: counter on the left, benches on the right (mirrored), departure board
    F.counter(b, X + 4, gy, Z + 5, 8, 'brown', 'tan');
    for (let i = 0; i < 3; i++) F.bench(b, x1 - 11, gy, Z + 4 + i * 3, 8, 'brown');
    b.fill(gy, mid - 3, Z + 1, 6, 1, 'black', 'brick');
    for (let i = 0; i < 3; i++) b.add('light_1x1', mid - 3 + i * 2, gy + 3, Z + 1, 0, ['tgreen', 'tyellow', 'tred'][i]);
    y = slab(b, y, X, Z, W, D, 'tan');
    const fy = y;
    y = storey(b, { x0: X, z0: Z, W, D, y, wall: 'dred', pillar: 'tan', frame: 'dgreen', cols, rows });
    for (const dx of [X + 3, X + 9, x1 - 12, x1 - 6]) F.desk(b, dx, fy, Z + 3, 'tan');
    y = slab(b, y, X, Z, W, D, 'tan');
    // the clock tower: two more storeys above the roof, clock face on the front
    let ty = y;
    ty = storey(b, { x0: tx, z0: tz, W: tw, D: 6, y: ty, wall: 'dred', pillar: 'tan', frame: 'dgreen', cols: [tx + 3], rows: [tz + 2] });
    ty = slab(b, ty, tx, tz, tw, 6, 'tan');
    ty = storey(b, { x0: tx, z0: tz, W: tw, D: 6, y: ty, wall: 'dred', pillar: 'tan', windows: false,
      paint: (x, yy, z) => { if (z !== tz + 5 || x < tx + 2 || x > tx + 5) return null; const ly = (yy - ty) / 3; return (x === tx + 3 && ly >= 1) || (x === tx + 4 && ly === 1) ? 'black' : 'white'; } });
    ty = slab(b, ty, tx, tz, tw, 6, 'tan');
    // pitched tower roof: two rows of slopes meeting at the ridge
    for (let x = tx; x < tx + tw; x += 2) {
      b.add('slope_2x2', x, ty, tz, 2, 'dgreen'); b.add('slope_2x2', x, ty, tz + 4, 0, 'dgreen');
    }
    b.fill(ty, tx, tz + 2, tw, 2, 'dgreen', 'brick');
    for (let x = tx; x < tx + tw; x += 2) { b.add('slope_2x2', x, ty + 3, tz + 1, 2, 'dgreen'); b.add('slope_2x2', x, ty + 3, tz + 3, 0, 'dgreen'); }
    F.flagpole(b, mid - 1, ty + 6, tz + 2, 'red', 2);
    parapet(b, y, X, Z, W, D, 'dred', 'tan');
    sign(b, X, W, y, z1 + 1, 'STATION', 'white', 'navy', 'tan');
    // glass skylights on the left and right of the roof
    for (const sx of [X + 4, x1 - 13]) for (let x = sx; x < sx + 10; x += 2) { b.add('slope_2x2', x, y, Z + 6, 2, 'tblue'); b.add('slope_2x2', x, y, Z + 8, 0, 'tblue'); }
    roofTiles(b, y, X, Z, W, D, 'dgray');
    // forecourt: mirrored lamps, benches and trees, a taxi waiting
    F.bench(b, mid - 9, 1, z1 + 3, 4, 'brown'); F.bench(b, mid + 5, 1, z1 + 3, 4, 'brown');
    fig(b, 'shopper', mid - 1, 1, z1 + 2); fig(b, 'worker', X + 6, gy, Z + 3);
    F.lamp(b, X + 6, 1, z1 + 2); F.lamp(b, x1 - 6, 1, z1 + 2);
    F.tree(b, X, 1, z1 + 1); F.tree(b, x1 - 3, 1, z1 + 1);
    stamp(b, genCar, rng, { style: 'taxi' }, { x: X + 4, z: z1 + 8 }, 1, 0);
    return { style: 'trainstation', main: 'dred' };
  },

  // ================================================================ SHOPPING MALL
  mall(b, rng) {
    const W = 44, D = 22, X = 3, Z = 2, x1 = X + W - 1, z1 = Z + D - 1;
    street(b, 0, 0, W + 6, z1 + 6, 14, { lanes: false });
    const gy = 2;
    b.fill(1, X, Z, W, D, 'white', 'plate');
    const shops = ['red', 'blue', 'green', 'orange', 'purple'];
    const sw = 8, s0 = X + 3;                          // five shop fronts, 3 studs of wall at each end
    const mid = X + W / 2;
    const rows = gridSlots(Z + 1, z1 - 1, 4);
    // upper-floor windows: two above each shop, centred over it
    const cols = []; for (let i = 0; i < 5; i++) cols.push(s0 + i * sw, s0 + i * sw + 4);
    let y = storey(b, { x0: X, z0: Z, W, D, y: gy, layers: 4, wall: 'lgray', pillar: 'white', frame: 'white', cols, rows,
      sides: { front: false, back: true, left: true, right: true },
      hole: (x, yy, z) => z === z1 && x >= s0 && x < s0 + 5 * sw && (x - s0) % sw < 6 && yy < gy + 9 });
    shops.forEach((c, i) => {
      const sx = s0 + i * sw;
      b.add('window_1x4x3', sx, gy, z1, 0, c);
      b.add('door_1x2x3', sx + 4, gy, z1, 0, c);
      F.counter(b, sx, gy, z1 - 5, 5, c, 'white');
      for (let s = 0; s < 3; s++) b.add('brick_1x2', sx + s * 2, gy, Z + 2, 1, ['yellow', 'red', 'blue', 'lime'][(i + s) % 4]);
    });
    // fountain in the middle of the mall
    b.voxel(gy, mid - 4, Z + 7, 8, 1, 6, (x, l, z) => (Math.hypot(x + 0.5 - mid, (z + 0.5 - Z - 10) * 1.3) <= 3.6 ? 'white' : null));
    b.fill(gy + 3, mid - 2, Z + 8, 4, 4, 'tblue', 'plate');
    b.add('round_2x2', mid - 1, gy + 4, Z + 9, 0, 'white'); b.add('round_2x2', mid - 1, gy + 7, Z + 9, 0, 'tblue'); b.add('dish_2x2', mid - 1, gy + 10, Z + 9, 0, 'tblue');
    // escalator up to the first floor
    for (let s = 0; s < 4; s++) b.add('slope_2x3', x1 - 10, gy + s * 3, Z + 4 + s * 2, 2, 'lgray');
    y = slab(b, y, X, Z, W, D, 'white');
    // awnings over each shop, resting on the cornice
    shops.forEach((c, i) => { const sx = s0 + i * sw; for (let x = sx; x < sx + 6; x += 2) b.add('slope_2x2', x, y, z1 + 1, 0, c); });
    // first floor: cinema and food court
    const fy = y;
    y = storey(b, { x0: X, z0: Z, W, D, y, wall: 'white', pillar: 'lgray', frame: 'dgray', winRow: 1, cols, rows, paint: (x, yy, z) => (z === z1 && yy === fy ? 'navy' : null) });
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) b.add('brick_1x1', X + 4 + i * 2, fy, Z + 8 + r * 2, 0, 'dred');
    b.fill(fy, X + 3, Z + 2, 14, 1, 'white', 'brick'); b.fill(fy + 3, X + 3, Z + 2, 14, 1, 'white', 'brick');
    for (let i = 0; i < 4; i++) F.table(b, X + 25 + (i % 2) * 7, fy, Z + 6 + Math.floor(i / 2) * 7, 'white', ['red', 'yellow', 'blue', 'green'][i]);
    y = slab(b, y, X, Z, W, D, 'lgray');
    parapet(b, y, X, Z, W, D, 'white', 'lgray');
    sign(b, X, W, y, z1 + 1, 'MALL', 'yellow', 'red', 'yellow');
    // glass atrium dome, centred: rings that overlap as they get smaller, capped on top
    const dd = (x, z) => Math.hypot((x + 0.5 - mid) / 6, (z + 0.5 - Z - 10) / 5);
    for (let l = 0; l < 3; l++) b.voxel(y + l * 3, mid - 6, Z + 5, 12, 1, 10, (x, ll, z) => { const d = dd(x, z); return d <= 1 - l * 0.3 && d > 0.55 - l * 0.3 ? 'tblue' : null; });
    b.fillMask(y + 9, mid - 6, Z + 5, 12, 10, (x, z) => dd(x, z) <= 0.36, 'tblue', 'plate');
    F.aircon(b, x1 - 6, y, Z + 3);
    roofTiles(b, y, X, Z, W, D, 'lgray');
    // car park: four bay lines mirrored about the centre, a car in each bay
    for (let i = 0; i < 4; i++) b.fill(1, mid - 23 + i * 15, z1 + 7, 1, 9, 'white', 'tile');
    stamp(b, genCar, rng, { style: 'hatch' }, { cx: mid - 15, z: z1 + 8 }, 1, 0);
    stamp(b, genCar, rng, { style: 'sedan' }, { cx: mid, z: z1 + 8 }, 1, 0);
    stamp(b, genCar, rng, { style: 'van' }, { cx: mid + 15, z: z1 + 8 }, 1, 0);
    for (const x of [X, x1]) F.lamp(b, x, 1, z1 + 3);
    F.planter(b, mid - 6, 1, z1 + 3, 4); F.planter(b, mid + 2, 1, z1 + 3, 4);
    fig(b, 'shopper', s0 + 4, 1, z1 + 2); fig(b, 'kid', s0 + 4 * sw, 1, z1 + 2, 0, 'blue'); fig(b, 'shopper', mid - 1, gy, Z + 15, 0, 'teal');
    return { style: 'mall', main: 'lgray' };
  },

  // ================================================================ SCHOOL
  school(b, rng) {
    const W = 36, D = 20, BX = 22, Z = 2, x1 = BX + W - 1, z1 = Z + D - 1;
    const GW = BX + W + 3;
    // grass all round, pavement in front of the school, a road along the front
    b.fill(0, 0, 0, GW, z1 + 6, 'green', 'plate');
    b.fill(0, 0, z1 + 6, GW, 9, 'dgray', 'plate');
    b.fill(1, 0, z1 + 6, GW, 1, 'lgray', 'tile');
    b._lanes.push([0, GW, z1 + 10]);
    b.fill(1, BX - 1, z1 + 1, W + 2, 5, 'lgray', 'plate');
    const gy = 2;
    b.fill(1, BX, Z, W, D, 'lgray', 'plate');
    const cols = gridSlots(BX + 1, x1 - 1, 4), rows = gridSlots(Z + 1, z1 - 1, 4);
    const mid = BX + W / 2, door = mid - 2;
    let y = gy;
    for (let f = 0; f < 2; f++) {
      const fy = y;
      y = storey(b, { x0: BX, z0: Z, W, D, y, wall: 'orange', pillar: 'yellow', frame: 'white', base: 'yellow', shutter: 'blue', cols, rows,
        keepOut: (x, yy, z) => f === 0 && z === z1 && x >= door - 1 && x <= door + 4,
        hole: (x, yy, z) => f === 0 && z === z1 && x >= door && x < door + 4 && yy < gy + 9 });
      if (f === 0) { b.add('door_1x2x3', door, gy, z1, 0, 'blue'); b.add('door_1x2x3', door + 2, gy, z1, 0, 'blue'); }
      // classroom: rows of desks, teacher's desk, chalkboard on a white ledge
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const dx = BX + 3 + c * 3, dz = Z + 7 + r * 3; b.add('brick_1x1', dx, fy, dz, 0, 'dgray'); b.add('plate_1x2', dx, fy + 3, dz, 0, 'tan'); b.add('brick_1x1', dx, fy, dz + 1, 0, ['red', 'blue', 'yellow', 'green'][c]); }
      b.fill(fy, BX + 3, Z + 1, 12, 1, 'white', 'brick');
      b.fill(fy + 3, BX + 3, Z + 1, 12, 1, 'dgreen', 'brick');
      F.desk(b, BX + 6, fy, Z + 3, 'brown', false);
      // second classroom: group tables
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) F.table(b, BX + 22 + c * 4, fy, Z + 4 + r * 6, 'white', ['red', 'blue', 'yellow'][c]);
      F.plant(b, x1 - 1, fy, z1 - 1);
      y = slab(b, y, BX, Z, W, D, 'yellow');
    }
    // pitched roof with a bell tower centred on the ridge
    b.fill(y, BX - 1, Z - 1, W + 2, D + 2, 'dred', 'plate');
    let k = 0;
    while (D + 2 - 2 * k > 2) {
      for (let x = BX - 1; x + 2 <= BX + W + 1; x += 2) { b.add('slope_2x2', x, y + 1 + k * 3, Z - 1 + k, 2, 'dred'); b.add('slope_2x2', x, y + 1 + k * 3, Z + D - 1 - k, 0, 'dred'); }
      b.fill(y + 1 + k * 3, BX - 1, Z + 1 + k, W + 2, D - 2 - 2 * k, 'dred', 'brick');
      k++;
    }
    const top = y + 1 + k * 3;
    const ridgeZ = Z - 1 + k;                     // the ridge: studs on rows ridgeZ and ridgeZ + 1
    // big lettered sign standing along the ridge, centred
    sign(b, BX, W, top, ridgeZ, 'SCHOOL', 'white', 'blue', 'yellow');
    // a small bell cupola at each end of the ridge
    for (const cx of [BX + 1, x1 - 2]) {
      b.fill(top, cx, ridgeZ, 2, 2, 'white', 'brick'); b.fill(top + 3, cx, ridgeZ, 2, 2, 'white', 'brick');
      b.add('round_2x2', cx, top + 6, ridgeZ, 0, 'gold');
    }
    F.flagpole(b, BX - 3, 1, z1 + 3, 'blue', 7);
    F.lamp(b, BX - 1, 2, z1 + 4); F.lamp(b, x1 + 1, 2, z1 + 4);
    fig(b, 'teacher', mid - 1, 2, z1 + 2); fig(b, 'kid', mid - 6, 2, z1 + 3); fig(b, 'kid', mid + 4, 2, z1 + 3, 0, 'blue');
    fig(b, 'teacher', BX + 10, gy, Z + 5, 0, 'teal'); fig(b, 'kid', 4, 5, 4, 0, 'lime'); fig(b, 'kid', 4, 1, 14, 0, 'pink');
    // playground: sandpit, slide, swings, roundabout, trees
    b.fill(1, 2, 2, 6, 6, 'yellow', 'brick'); b.fill(4, 3, 3, 4, 4, 'tan', 'plate');
    for (const [x, z] of [[11, 3], [13, 3], [11, 5], [13, 5]]) for (let l = 0; l < 4; l++) b.add('round_1x1', x, 1 + l * 3, z, 0, 'red');
    b.fill(13, 11, 3, 3, 3, 'red', 'plate');
    for (let s = 0; s < 4; s++) b.add('slope_1x2', 12, 10 - s * 3, 6 + s, 0, 'yellow');
    for (const x of [2, 10]) for (let l = 0; l < 5; l++) b.add('round_1x1', x, 1 + l * 3, 12, 0, 'blue');
    for (const x of [4, 8]) b.add('plate_1x1', x, 15, 12, 0, 'dgray');
    b.fill(16, 2, 12, 9, 1, 'blue', 'plate');
    b.add('round_2x2', 14, 1, 12, 0, 'yellow'); b.add('dish_2x2', 14, 4, 12, 0, 'red');
    F.tree(b, 1, 1, 16); F.tree(b, 14, 1, 16);
    stamp(b, genCar, rng, { style: 'van', color: 'yellow' }, { x: 2, z: z1 + 7 }, 1, 0);
    return { style: 'school', main: 'orange' };
  },

  // ================================================================ CORNER CAFÉ & APARTMENTS
  corner(b, rng) {
    const W = 26, D = 18, X = 3, Z = 2, x1 = X + W - 1, z1 = Z + D - 1;
    street(b, 0, 0, W + 6, z1 + 7, 8);
    const gy = 2;
    b.fill(1, X, Z, W, D, 'white', 'plate');
    const cols = gridSlots(X + 1, x1 - 1, 4), rows = gridSlots(Z + 1, z1 - 1, 4);
    const mid = X + W / 2, door = mid - 1;
    // café front: four big windows mirrored round a centred door
    const shopWins = [mid - 11, mid - 6, mid + 2, mid + 7];
    const inWin = x => shopWins.some(sx => x >= sx && x < sx + 4);
    let y = storey(b, { x0: X, z0: Z, W, D, y: gy, layers: 4, wall: 'dgreen', pillar: 'gold', frame: 'gold', base: 'black', cols, rows,
      sides: { front: false, back: true, left: true, right: true },
      hole: (x, yy, z) => z === z1 && (inWin(x) || x === door || x === door + 1) && yy < gy + 9 });
    for (const sx of shopWins) b.add('window_1x4x3', sx, gy, z1, 0, 'gold');
    b.add('door_1x2x3', door, gy, z1, 0, 'gold');
    F.counter(b, X + 2, gy, Z + 4, 10, 'brown', 'white');
    b.add('brick_2x2', X + 14, gy, Z + 2, 0, 'lgray'); b.add('round_1x1', X + 15, gy + 3, Z + 2, 0, 'dgray');
    for (const o of [-7, 0, 7]) F.table(b, mid + o - 1, gy, Z + 10, 'white', 'brown');
    y = slab(b, y, X, Z, W, D, 'gold');
    // striped awning along the whole front, resting on the cornice
    for (let x = X; x + 2 <= X + W; x += 2) b.add('slope_2x2', x, y, z1 + 1, 0, ((x - X) / 2) % 2 ? 'white' : 'red');
    // two floors of apartments
    const colors = ['tan', 'pink'];
    for (let f = 0; f < 2; f++) {
      const fy = y;
      y = storey(b, { x0: X, z0: Z, W, D, y, wall: colors[f], pillar: 'white', frame: 'white', shutter: f ? 'dgreen' : 'blue', base: 'white', cols, rows });
      F.bed(b, X + 3, fy, Z + 3, f ? 'purple' : 'red', 'brown'); F.sofa(b, X + 12, fy, Z + 4, f ? 'teal' : 'orange'); F.table(b, X + 20, fy, Z + 10, 'white', 'brown');
      fig(b, f ? 'kid' : 'shopper', X + 7, fy, Z + 10, 0, f ? 'yellow' : 'pink');
      F.counter(b, X + 2, fy, z1 - 3, 6, 'white', 'dgray'); F.plant(b, x1 - 1, fy, z1 - 1);
      y = slab(b, y, X, Z, W, D, 'white');
    }
    // rooftop garden
    parapet(b, y, X, Z, W, D, 'white', 'dgray');
    sign(b, X, W, y, z1 + 1, 'CAFE', 'gold', 'dgreen', 'gold');
    b.fill(y, X + 2, Z + 2, 8, 6, 'green', 'plate');
    for (let i = 0; i < 6; i++) b.add('flower_1x1', X + 3 + i, y + 1, Z + 4, 0, ['red', 'yellow', 'pink', 'white', 'purple', 'orange'][i]);
    F.tree(b, X + 3, y, Z + 9); F.tree(b, x1 - 5, y, Z + 2);
    F.bench(b, X + 13, y, Z + 9, 4, 'brown');
    b.add('antenna_1x1', x1 - 1, y, Z + 12, 0, 'lgray');
    roofTiles(b, y, X, Z, W, D, 'tan');
    // pavement café: tables with chairs, planters, a lamp each side (mirrored)
    F.table(b, X + 3, 1, z1 + 3, 'white', 'dgreen'); F.table(b, x1 - 4, 1, z1 + 3, 'white', 'dgreen');
    F.planter(b, door - 6, 1, z1 + 2, 4); F.planter(b, door + 4, 1, z1 + 2, 4);
    F.lamp(b, X, 1, z1 + 5); F.lamp(b, x1, 1, z1 + 5);
    fig(b, 'chef', X + 5, gy, Z + 2); fig(b, 'shopper', mid - 1, 1, z1 + 2);
    return { style: 'corner', main: 'dgreen' };
  },
};
