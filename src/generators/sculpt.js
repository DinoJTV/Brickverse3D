// generators/sculpt.js — fine sculpting for organic models (dinosaurs, dragons, sea life).
// Shapes are described in WORLD units (1 = one stud; heights also in studs, so a
// sphere looks round). They are sampled at plate resolution (0.4 tall), then filled
// with bricks wherever three plates in a row share a colour, and plates elsewhere.
// That gives smooth silhouettes without wasting pieces on the inside.
import { PLATE_H } from '../parts.js';

// ---------------------------------------------------------------- shape helpers
export const ell = (cx, cy, cz, rx, ry, rz, c) => ({ k: 'e', cx, cy, cz, rx, ry, rz, c });
export const boxS = (x0, y0, z0, x1, y1, z1, c) => ({ k: 'b', x0, y0, z0, x1, y1, z1, c });
/** Tapered capsule from point a to point b, radius ra → rb. */
export const cap = (a, b, ra, rb, c) => ({ k: 'c', a, b, ra, rb, c });
/** Chain of capsules through points with matching radii (tails, necks). */
export function chain(points, radii, c) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) out.push(cap(points[i], points[i + 1], radii[i], radii[i + 1], c));
  return out;
}

function bounds(s) {
  if (s.k === 'e') return [s.cx - s.rx, s.cy - s.ry, s.cz - s.rz, s.cx + s.rx, s.cy + s.ry, s.cz + s.rz];
  if (s.k === 'b') return [s.x0, s.y0, s.z0, s.x1, s.y1, s.z1];
  const r = Math.max(s.ra, s.rb);
  return [Math.min(s.a[0], s.b[0]) - r, Math.min(s.a[1], s.b[1]) - r, Math.min(s.a[2], s.b[2]) - r, Math.max(s.a[0], s.b[0]) + r, Math.max(s.a[1], s.b[1]) + r, Math.max(s.a[2], s.b[2]) + r];
}

function inside(s, x, y, z) {
  if (s.k === 'e') { const dx = (x - s.cx) / s.rx, dy = (y - s.cy) / s.ry, dz = (z - s.cz) / s.rz; return dx * dx + dy * dy + dz * dz <= 1; }
  if (s.k === 'b') return x >= s.x0 && x < s.x1 && y >= s.y0 && y < s.y1 && z >= s.z0 && z < s.z1;
  const [ax, ay, az] = s.a, [bx, by, bz] = s.b;
  const vx = bx - ax, vy = by - ay, vz = bz - az;
  const L2 = vx * vx + vy * vy + vz * vz || 1e-6;
  let t = ((x - ax) * vx + (y - ay) * vy + (z - az) * vz) / L2;
  t = Math.max(0, Math.min(1, t));
  const px = ax + vx * t - x, py = ay + vy * t - y, pz = az + vz * t - z;
  const r = s.ra + (s.rb - s.ra) * t;
  return px * px + py * py + pz * pz <= r * r;
}

/**
 * Fill shapes with pieces. Later shapes paint over earlier ones; a shape with c=null
 * carves (removes) material. Colour may be a function (x, y, z) in world units.
 * baseY is the plate layer the sculpture starts on.
 */
export function sculpt(b, shapes, baseY = 0) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const s of shapes) {
    const bb = bounds(s);
    x0 = Math.min(x0, bb[0]); y0 = Math.min(y0, bb[1]); z0 = Math.min(z0, bb[2]);
    x1 = Math.max(x1, bb[3]); y1 = Math.max(y1, bb[4]); z1 = Math.max(z1, bb[5]);
  }
  const gx0 = Math.floor(x0), gz0 = Math.floor(z0), gx1 = Math.ceil(x1), gz1 = Math.ceil(z1);
  const ly0 = Math.max(0, Math.floor(y0 / PLATE_H)), ly1 = Math.ceil(y1 / PLATE_H);
  const W = gx1 - gx0, D = gz1 - gz0, H = ly1 - ly0;
  const grid = new Array(W * D * H).fill(null);
  const idx = (x, l, z) => ((l * D) + (z - gz0)) * W + (x - gx0);
  for (const s of shapes) {
    const bb = bounds(s);
    const sx0 = Math.max(gx0, Math.floor(bb[0])), sx1 = Math.min(gx1, Math.ceil(bb[3]));
    const sz0 = Math.max(gz0, Math.floor(bb[2])), sz1 = Math.min(gz1, Math.ceil(bb[5]));
    const sl0 = Math.max(ly0, Math.floor(bb[1] / PLATE_H)), sl1 = Math.min(ly1, Math.ceil(bb[4] / PLATE_H));
    for (let l = sl0; l < sl1; l++) for (let z = sz0; z < sz1; z++) for (let x = sx0; x < sx1; x++) {
      const wy = (l + 0.5) * PLATE_H;
      if (inside(s, x + 0.5, wy, z + 0.5)) grid[idx(x, l - ly0, z)] = s.c === null ? null : (typeof s.c === 'function' ? s.c(x + 0.5, wy, z + 0.5) : s.c);
    }
  }
  const at = (x, l, z) => (l < 0 || l >= H || x < gx0 || x >= gx1 || z < gz0 || z >= gz1) ? null : grid[idx(x, l, z)];
  for (let l = 0; l < H; l++) {
    const y = baseY + ly0 + l;
    // bricks where three plates in a column share the colour
    b.fillMask(y, gx0, gz0, W, D, (x, z) => { const c = at(x, l, z); return c && at(x, l + 1, z) === c && at(x, l + 2, z) === c; }, (x, z) => at(x, l, z), 'brick');
    b.fillMask(y, gx0, gz0, W, D, (x, z) => !!at(x, l, z), (x, z) => at(x, l, z), 'plate');
  }
  return { top: baseY + ly1, at: (x, yw, z) => at(Math.floor(x), Math.floor(yw / PLATE_H) - ly0, Math.floor(z)) };
}

/** Plate height just above the highest piece in column (x, z), or -1 if empty. */
export function topAt(b, x, z, maxY = 400) {
  for (let y = maxY; y >= 0; y--) if (b.occ.at(x, y, z)) return y + 1;
  return -1;
}
/** Lowest occupied plate in column (x, z) above minY, or -1. */
export function bottomAt(b, x, z, minY = 0, maxY = 400) {
  for (let y = minY; y <= maxY; y++) if (b.occ.at(x, y, z)) return y;
  return -1;
}

/** A natural ground base: irregular plate island with rocks and plants. Returns plate height to build on. */
export function terrainBase(b, rng, x0, z0, w, d, style = 'jungle') {
  const ground = { jungle: 'green', desert: 'tan', volcano: 'dgray', snow: 'white', sea: 'tblue', swamp: 'dgreen' }[style] || 'green';
  const edge = { jungle: 'dgreen', desert: 'orange', volcano: 'black', snow: 'lgray', sea: 'azure', swamp: 'brown' }[style] || 'dgreen';
  const cx = x0 + w / 2, cz = z0 + d / 2;
  const blob = (x, z) => { const nx = (x + 0.5 - cx) / (w / 2), nz = (z + 0.5 - cz) / (d / 2); return nx * nx + nz * nz <= 1 + 0.18 * Math.sin(x * 1.7 + z * 0.9); };
  b.fillMask(0, x0, z0, w, d, blob, (x, z) => (blob(x + 1, z) && blob(x - 1, z) && blob(x, z + 1) && blob(x, z - 1) ? ground : edge), 'plate');
  if (style === 'sea') b.fillMask(1, x0, z0, w, d, (x, z) => blob(x, z) && (x * 3 + z * 5) % 7 === 0, 'tan', 'tile');
  return { level: 1, blob, ground };
}

/** Scatter rocks and plants on a base, avoiding anything already built. */
export function decorate(b, rng, x0, z0, w, d, blob, style = 'jungle', count = 8) {
  const plants = style === 'desert' ? ['cactus'] : style === 'snow' ? ['rock'] : style === 'sea' ? ['coral', 'weed'] : ['fern', 'flower', 'rock', 'fern'];
  for (let i = 0; i < count * 3 && count > 0; i++) {
    const x = rng.int(x0, x0 + w - 1), z = rng.int(z0, z0 + d - 1);
    if (!blob(x, z) || topAt(b, x, z, 60) !== 1) continue;
    const kind = rng.pick(plants);
    let ok = false;
    if (kind === 'rock') ok = b.add(rng.chance(0.5) ? 'round_2x2' : 'slope_curve_2x2', x, 1, z, rng.int(0, 3), rng.pick(['lgray', 'dgray']));
    else if (kind === 'fern') { ok = b.add('round_plate_1x1', x, 1, z, 0, 'dgreen') && b.add('flower_1x1', x, 2, z, 0, rng.pick(['green', 'lime', 'dgreen'])); }
    else if (kind === 'flower') ok = b.add('flower_1x1', x, 1, z, 0, rng.pick(['red', 'yellow', 'pink', 'white', 'purple']));
    else if (kind === 'cactus') { ok = b.add('round_1x1', x, 1, z, 0, 'green') && b.add('spike_1x1', x, 4, z, 0, 'green'); }
    else if (kind === 'coral') { ok = b.add(rng.pick(['round_1x1', 'cone_1x1', 'antenna_1x1']), x, 1, z, 0, rng.pick(['pink', 'orange', 'red', 'purple', 'yellow'])); }
    else if (kind === 'weed') { ok = b.add('antenna_1x1', x, 1, z, 0, rng.pick(['green', 'lime', 'dgreen'])); }
    if (ok) count--;
    if (count <= 0) break;
  }
}
