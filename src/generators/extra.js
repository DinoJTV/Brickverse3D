// generators/extra.js — Fantasy & Dragons, Underwater World, Farm & Countryside,
// City & Emergency, Racing & Sports, Theme Park.
import { ell, boxS, cap, chain, sculpt, topAt, terrainBase, decorate } from './sculpt.js';
import { gableRoof } from './buildings.js';

const hash = (x, y, z) => { let h = (Math.floor(x) * 73856093) ^ (Math.floor(y * 2.5) * 19349663) ^ (Math.floor(z) * 83492791); return ((h ^ (h >>> 13)) >>> 0) % 97; };
const eyePair = (x, y, z, iris = 'yellow') => [ell(x, y, z, 0.5, 0.4, 0.45, iris), ell(x + 0.15, y, z * 1.1, 0.28, 0.24, 0.35, 'black'), ell(x, y, -z, 0.5, 0.4, 0.45, iris), ell(x + 0.15, y, -z * 1.1, 0.28, 0.24, 0.35, 'black')];
const scaleAll = (shapes, k, dx = 0, dy = 0, dz = 0) => shapes.map(s => {
  const w = c => (typeof c === 'function' ? (x, y, z) => c((x - dx) / k, (y - dy) / k, (z - dz) / k) : c);
  if (s.k === 'e') return { ...s, cx: s.cx * k + dx, cy: s.cy * k + dy, cz: s.cz * k + dz, rx: s.rx * k, ry: s.ry * k, rz: s.rz * k, c: w(s.c) };
  if (s.k === 'b') return { ...s, x0: s.x0 * k + dx, x1: s.x1 * k + dx, y0: s.y0 * k + dy, y1: s.y1 * k + dy, z0: s.z0 * k + dz, z1: s.z1 * k + dz, c: w(s.c) };
  return { ...s, a: [s.a[0] * k + dx, s.a[1] * k + dy, s.a[2] * k + dz], b: [s.b[0] * k + dx, s.b[1] * k + dy, s.b[2] * k + dz], ra: s.ra * k, rb: s.rb * k, c: w(s.c) };
});

// ===================================================================== FANTASY & DRAGONS
const DRAGONS = {
  fire: { skin: 'red', belly: 'yellow', wing: 'orange', horn: 'black', breath: ['tred', 'tyellow'] },
  forest: { skin: 'green', belly: 'lime', wing: 'dgreen', horn: 'tan', breath: ['tgreen', 'tyellow'] },
  ice: { skin: 'azure', belly: 'white', wing: 'tblue', horn: 'white', breath: ['tclear', 'tblue'] },
  shadow: { skin: 'black', belly: 'dgray', wing: 'purple', horn: 'lgray', breath: ['tgreen', 'tclear'] },
  gold: { skin: 'gold', belly: 'tan', wing: 'yellow', horn: 'white', breath: ['tyellow', 'tred'] },
  storm: { skin: 'navy', belly: 'azure', wing: 'blue', horn: 'yellow', breath: ['tblue', 'tclear'] },
};
function dragonShapes(p, pose) {
  const paint = (x, y, z) => (y < 4.4 && Math.abs(z) < 1.4 ? p.belly : (hash(x, y, z) % 11 === 0 ? p.wing : p.skin));
  const S = [];
  const rear = pose === 'rearing';
  for (const zs of [1, -1]) {
    S.push(cap([5, 4.6, zs * 1.5], [5.6, 2.4, zs * 1.8], 1.2, 0.85, paint), cap([5.6, 2.4, zs * 1.8], [5.0, 0.6, zs * 1.8], 0.7, 0.55, paint));
    S.push(ell(5.6, 0.4, zs * 1.8, 1.2, 0.4, 0.7, p.skin));
    if (!rear) S.push(cap([10, 4.4, zs * 1.4], [10.4, 0.6, zs * 1.6], 0.75, 0.55, paint), ell(10.8, 0.4, zs * 1.6, 1.0, 0.4, 0.6, p.skin));
    else S.push(cap([10.4, 6.0, zs * 1.4], [12.0, 5.4, zs * 1.8], 0.55, 0.4, paint));
    // wings: bony arm + membrane panels
    const wy = rear ? 9.5 : 8;
    S.push(cap([8.4, 6.0, zs * 1.4], [7.5, wy, zs * 5.0], 0.4, 0.3, p.skin));
    S.push(cap([7.5, wy, zs * 5.0], [4.0, wy + 1.5, zs * 9.5], 0.3, 0.2, p.skin));
    S.push(ell(5.6, wy - 0.4, zs * 5.6, 3.2, 0.25, 3.6, p.wing));
    S.push(ell(3.6, wy - 0.1, zs * 7.8, 2.0, 0.25, 1.9, p.wing));
  }
  S.push(ell(7.5, rear ? 5.6 : 4.8, 0, 3.8, 1.9, 1.8, paint));
  const neck = rear ? [[10, 6.4, 0], [11.5, 8.6, 0], [12.4, 10.6, 0]] : [[10.5, 5.6, 0], [12.4, 7.4, 0], [13.6, 9.0, 0]];
  S.push(...chain(neck, [1.3, 1.0, 0.85], paint));
  const h = neck[2];
  S.push(ell(h[0] + 1.2, h[1] + 0.3, 0, 1.8, 0.9, 1.0, p.skin));
  S.push(ell(h[0] + 2.6, h[1] - 0.1, 0, 1.1, 0.6, 0.75, p.skin));
  S.push(boxS(h[0] + 1.6, h[1] - 0.45, -0.55, h[0] + 3.6, h[1] - 0.15, 0.55, 'dred'));
  S.push(...eyePair(h[0] + 1.3, h[1] + 0.65, 0.8));
  for (const zs of [1, -1]) S.push(...chain([[h[0] + 0.6, h[1] + 0.9, zs * 0.6], [h[0] - 0.6, h[1] + 1.8, zs * 0.9], [h[0] - 1.6, h[1] + 2.2, zs * 1.0]], [0.35, 0.25, 0.1], p.horn));
  // spikes along the spine
  for (let i = 0; i < 6; i++) S.push(cap([2.5 + i * 1.6, (rear ? 7.3 : 6.5) + Math.sin(i / 2) * 0.3, 0], [2.0 + i * 1.6, (rear ? 8.4 : 7.6), 0], 0.35, 0.08, p.horn));
  S.push(...chain([[4, 4.8, 0], [0.5, 4.0, 0], [-2.5, 3.0, 0], [-5, 2.4, 2], [-7, 2.0, 3]], [1.4, 1.0, 0.7, 0.45, 0.25], paint));
  S.push(ell(-7.4, 2.0, 3.2, 0.9, 0.25, 0.7, p.wing));
  return { S, head: [h[0] + 3.8, h[1] - 0.3] };
}

export function genFantasy(b, rng, o = {}) {
  const kind = o.kind || rng.pick(['dragon', 'wizardtower', 'treehouse', 'unicorn', 'crystalcave', 'mushroomhouse', 'phoenix']);
  if (kind === 'dragon') {
    const p = DRAGONS[o.breed || rng.pick(Object.keys(DRAGONS))];
    const k = o.scale || 1.4;
    const { S, head } = dragonShapes(p, o.pose || 'standing');
    const shapes = scaleAll(S, k);
    if (o.fire !== false) for (let i = 0; i < 4; i++) shapes.push(ell((head[0] + 0.8 + i * 1.4) * k, (head[1] - 0.2 - i * 0.25) * k, 0, (0.7 + i * 0.35) * k, (0.5 + i * 0.25) * k, (0.55 + i * 0.3) * k, i % 2 ? p.breath[0] : p.breath[1]));
    const { blob } = terrainBase(b, rng, Math.floor(-10 * k), Math.floor(-6 * k), Math.ceil(30 * k), Math.ceil(12 * k), o.breed === 'ice' ? 'snow' : 'volcano');
    sculpt(b, shapes, 1);
    // treasure hoard
    for (let i = 0; i < 10; i++) { const x = rng.int(Math.floor(-2 * k), Math.floor(6 * k)), z = rng.int(Math.floor(-4 * k), Math.floor(4 * k)); if (topAt(b, x, z, 40) === 1) b.add(rng.chance(0.7) ? 'round_plate_1x1' : 'light_1x1', x, 1, z, 0, rng.pick(['gold', 'gold', 'tyellow', 'tred', 'tblue'])); }
    decorate(b, rng, Math.floor(-10 * k), Math.floor(-6 * k), Math.ceil(30 * k), Math.ceil(12 * k), blob, 'snow', 4);
    return { style: 'dragon', main: p.skin };
  }
  if (kind === 'phoenix') {
    const S = [boxS(-1, 0, -1, 2, 3, 2, 'dgray'), ell(0.5, 3.2, 0.5, 2, 0.8, 2, 'lgray'),
      ell(0.5, 5.4, 0.5, 1.4, 1.8, 1.2, 'red'), ell(1.4, 7.6, 0.5, 0.9, 0.85, 0.8, 'orange'), cap([2.2, 7.6, 0.5], [3.3, 7.3, 0.5], 0.35, 0.1, 'yellow'),
      ...eyePair(1.8, 7.9, 0.5 + 0.55, 'black').map(s => ({ ...s, cz: s.cz })),
      ...chain([[1.0, 8.4, 0.5], [0.0, 9.6, 0.5], [-1.0, 10.3, 0.5]], [0.4, 0.3, 0.15], 'yellow')];
    for (const zs of [1, -1]) S.push(ell(-0.2, 6.6, 0.5 + zs * 4.4, 1.6, 0.25, 3.8, (x, y, z) => (Math.abs(z - 0.5) > 6 ? 'tyellow' : Math.abs(z - 0.5) > 4 ? 'orange' : 'red')), cap([0.5, 6.4, 0.5 + zs * 1.0], [0.0, 8.4, 0.5 + zs * 7.6], 0.3, 0.15, 'dred'));
    S.push(...chain([[-0.6, 4.6, 0.5], [-2.4, 3.6, 0.5], [-4.2, 3.0, 0.5]], [0.7, 0.6, 0.4], 'tred'));
    sculpt(b, scaleAll(S, o.scale || 1.5), 0);
    return { style: 'phoenix', main: 'red' };
  }
  if (kind === 'unicorn') {
    const coat = 'white', mane = (x, y) => ['pink', 'purple', 'azure', 'yellow'][Math.floor(y * 1.2) % 4];
    const S = [];
    for (const [x, zs] of [[7.2, 1], [7.2, -1], [2.4, 1], [2.4, -1]]) S.push(cap([x, 4.2, zs * 0.9], [x, 0.4, zs * 1.0], 0.55, 0.45, coat), ell(x, 0.3, zs * 1.0, 0.55, 0.3, 0.5, 'gold'));
    S.push(ell(4.8, 4.6, 0, 3.4, 1.4, 1.4, coat));
    S.push(cap([7.8, 5.2, 0], [9.0, 7.6, 0], 0.9, 0.7, coat));
    S.push(ell(10.0, 7.8, 0, 1.5, 0.75, 0.75, coat), ell(11.1, 7.4, 0, 0.6, 0.5, 0.55, 'pink'));
    S.push(cap([9.8, 8.4, 0], [11.0, 10.6, 0], 0.3, 0.06, 'gold'));
    S.push(...eyePair(9.9, 8.1, 0.6, 'purple'));
    S.push(...chain([[9.0, 8.6, 0], [8.2, 7.6, 0], [7.4, 6.0, 0]], [0.55, 0.55, 0.5], mane));
    S.push(...chain([[1.4, 5.0, 0], [0.4, 4.0, 0], [0.2, 2.2, 0]], [0.55, 0.6, 0.45], mane));
    const k = o.scale || 1.5;
    const { blob } = terrainBase(b, rng, -3, Math.floor(-5 * k), Math.ceil(19 * k), Math.ceil(10 * k), 'jungle');
    sculpt(b, scaleAll(S, k), 1);
    decorate(b, rng, -3, Math.floor(-5 * k), Math.ceil(19 * k), Math.ceil(10 * k), blob, 'jungle', 8);
    return { style: 'unicorn', main: 'white' };
  }
  if (kind === 'wizardtower') {
    const H = rng.int(6, 8), stone = rng.pick(['lgray', 'tan', 'dgray']), roof = rng.pick(['purple', 'navy', 'blue', 'dred']);
    b.fill(0, -2, -2, 12, 12, 'dgreen', 'plate');
    for (let l = 0; l < H; l++) b.voxel(1 + l * 3, 0, 0, 8, 1, 8, (x, ll, z) => { const d = Math.hypot(x - 3.5, z - 3.5); if (d > 3.9 || d < 2.4) return null; const win = (l % 2 === 1) && (Math.abs(x - 3.5) < 1 || Math.abs(z - 3.5) < 1); return win ? 'tyellow' : ((x + z + l) % 5 === 0 ? 'dgray' : stone); });
    b.add('door_1x2x3', 3, 1, 7, 0, 'brown');
    const ty = 1 + H * 3;
    b.voxel(ty, -1, -1, 10, 1, 10, (x, l, z) => (Math.hypot(x - 3.5, z - 3.5) <= 4.8 ? 'brown' : null), 'plate');
    for (let l = 0; l < 5; l++) { const r = 4.2 - l * 0.85; b.voxel(ty + 1 + l * 3, 0, 0, 8, 1, 8, (x, ll, z) => (Math.hypot(x - 3.5, z - 3.5) <= r ? roof : null)); }
    b.add('cone_1x1', 3, ty + 16, 3, 0, roof);
    for (let i = 0; i < 6; i++) b.add('light_1x1', rng.int(-2, 9), ty + 1 + rng.int(0, 2) * 3, rng.int(-2, 9), 0, 'tyellow');
    b.add('antenna_1x1', 4, ty + 16, 4, 0, 'gold');
    return { style: 'wizardtower', main: roof };
  }
  if (kind === 'treehouse' || kind === 'mushroomhouse') {
    const k = o.scale || 1;
    terrainBase(b, rng, -6, -6, 20, 20, 'jungle');
    if (kind === 'mushroomhouse') {
      const capC = rng.pick(['red', 'orange', 'purple', 'azure']);
      sculpt(b, [cap([4, 0, 4], [4, 7, 4], 3.2, 2.8, 'tan'), ell(4, 9.2, 4, 6.4, 2.8, 6.4, (x, y, z) => (y < 8.2 ? 'white' : (hash(x, y, z) % 6 === 0 ? 'white' : capC))), boxS(3, 0, 6, 5, 3.5, 8, null)], 1);
      b.add('door_1x2x3', 3, 1, 6, 0, 'brown');
      b.add('window_1x2x2', 1, 8, 3, 1, 'brown') || b.add('light_1x1', 1, 12, 5, 0, 'tyellow');
      b.add('flower_1x1', 7, 1, 8, 0, 'yellow'); b.add('flower_1x1', 0, 1, 8, 0, 'pink');
      return { style: kind, main: capC };
    }
    sculpt(b, [cap([4, 0, 4], [4, 12, 4], 2.0, 1.4, 'brown'), cap([4, 7, 4], [9, 11, 5], 0.8, 0.5, 'brown'), cap([4, 9, 4], [0, 12, 2], 0.7, 0.4, 'brown'),
      ell(4, 17, 4, 6.5, 3.5, 6.0, (x, y, z) => (hash(x, y, z) % 7 === 0 ? 'lime' : 'green')), ell(9.5, 13.5, 6, 3, 2, 3, 'dgreen')], 1);
    const py = 22;
    b.fill(py, -1, 5, 8, 6, 'brown', 'plate');
    b.walls(py + 1, 0, 6, 6, 4, 2, (x, y, z) => (z === 9 && (x === 2 || x === 3) && y > py ? 'tclear' : 'tan'));
    b.fill(py + 7, -1, 5, 8, 6, 'dred', 'plate'); gableRoof(b, -1, 5, 8, 6, py + 8, 'dred', 'tan');
    for (let l = 0; l < 7; l++) b.add('technic_1x2', -2, 1 + l * 3, 7, 1, 'brown');
    b.add('antenna_1x1', 6, py + 1, 10, 0, 'red');
    return { style: kind, main: 'green' };
  }
  // crystal cave
  terrainBase(b, rng, -2, -2, 20, 14, 'volcano');
  sculpt(b, [ell(8, 0, 5, 9, 7.5, 5, (x, y, z) => (hash(x, y, z) % 5 === 0 ? 'lgray' : 'dgray')), ell(8, 0, 6, 6.5, 5.5, 5.5, null)], 1);
  const cols = ['tblue', 'tgreen', 'purple', 'tred', 'tclear', 'pink'];
  for (let i = 0; i < 14; i++) { const x = rng.int(3, 13), z = rng.int(2, 10); const y = topAt(b, x, z, 40); if (y >= 0 && y < 30) { b.add('cone_1x1', x, y, z, 0, rng.pick(cols)); } }
  for (let i = 0; i < 6; i++) b.add('light_1x1', rng.int(4, 12), 1, rng.int(5, 10), 0, rng.pick(cols));
  b.add('round_plate_1x1', 8, 1, 7, 0, 'gold'); b.add('round_plate_1x1', 9, 1, 7, 0, 'gold');
  return { style: 'crystalcave', main: 'dgray' };
}

// ===================================================================== UNDERWATER
export function genUnderwater(b, rng, o = {}) {
  const kind = o.kind || rng.pick(['shark', 'octopus', 'jellyfish', 'seaturtle', 'whale', 'angler', 'reef', 'sunkenship', 'seahorse', 'clownfish', 'manta']);
  const k = o.scale || 1.3;
  const base = (w, d) => terrainBase(b, rng, Math.floor(-w / 2), Math.floor(-d / 2), w, d, 'sea');
  const stand = (x, h, c = 'dgray') => [boxS(x - 1, 0, -1, x + 1, h, 1, c)];
  let S = [];
  let main = 'blue';
  switch (kind) {
    case 'shark': main = rng.pick(['lgray', 'dgray', 'blue']);
      S = [...stand(0, 3.5), ...chain([[-7, 6, 0], [-3, 5.2, 0], [1, 5, 0], [5, 5.3, 0]], [0.6, 1.5, 1.8, 1.1], (x, y, z) => (y < 4.6 ? 'white' : main)),
        ell(6.3, 5.0, 0, 1.6, 0.85, 1.0, main), boxS(5.0, 4.4, -0.7, 7.6, 4.7, 0.7, 'dred'), boxS(5.2, 4.4, -0.85, 7.6, 4.7, -0.55, 'white'), boxS(5.2, 4.4, 0.55, 7.6, 4.7, 0.85, 'white'),
        ...eyePair(5.6, 5.5, 0.85, 'black'), cap([0, 6.6, 0], [-1.4, 9.0, 0], 0.7, 0.15, main), ell(-7.6, 7.2, 0, 0.5, 1.8, 0.3, main), ell(-7.2, 4.9, 0, 0.4, 1.0, 0.3, main),
        cap([1.5, 4.6, 1.2], [0, 3.8, 3.4], 0.4, 0.15, main), cap([1.5, 4.6, -1.2], [0, 3.8, -3.4], 0.4, 0.15, main)]; break;
    case 'whale': main = rng.pick(['navy', 'blue', 'dgray']);
      S = [...stand(0, 3), ...chain([[-10, 6.5, 0], [-5, 5.2, 0], [1, 5.4, 0], [6, 5.6, 0]], [0.5, 2.0, 2.6, 2.3], (x, y, z) => (y < 4.2 ? 'white' : main)),
        ell(-10.6, 7.4, 0, 0.6, 0.3, 2.6, main), ...eyePair(6.0, 5.4, 2.0, 'black'), ell(1, 4.2, 2.6, 1.6, 0.3, 1.2, main), ell(1, 4.2, -2.6, 1.6, 0.3, 1.2, main),
        cap([4, 8, 0], [3.4, 10.4, 0], 0.4, 0.8, 'tblue')]; break;
    case 'octopus': main = rng.pick(['red', 'purple', 'orange', 'pink']);
      S = [ell(0, 7, 0, 2.6, 3, 2.6, main), ...eyePair(1.8, 6.4, 1.2, 'yellow')];
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; S.push(...chain([[Math.cos(a) * 1.4, 4.6, Math.sin(a) * 1.4], [Math.cos(a) * 3.4, 2.4, Math.sin(a) * 3.4], [Math.cos(a + 0.4) * 5, 0.6, Math.sin(a + 0.4) * 5], [Math.cos(a + 0.9) * 5.6, 1.6, Math.sin(a + 0.9) * 5.6]], [0.75, 0.55, 0.4, 0.2], (x, y, z) => (hash(x, y, z) % 5 === 0 ? 'white' : main))); }
      break;
    case 'jellyfish': main = rng.pick(['tblue', 'pink', 'purple', 'tclear']);
      S = [...stand(0, 6, 'tclear'), ell(0, 8.5, 0, 3.2, 2.0, 3.2, main), ell(0, 7.2, 0, 2.8, 0.8, 2.8, null), ell(0, 8.6, 0, 1.4, 0.8, 1.4, 'pink')];
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; S.push(...chain([[Math.cos(a) * 2.2, 7.4, Math.sin(a) * 2.2], [Math.cos(a) * 2.6, 4.8, Math.sin(a) * 2.6], [Math.cos(a) * 2.2, 2.6, Math.sin(a) * 2.2]], [0.3, 0.25, 0.15], 'tclear')); }
      break;
    case 'seaturtle': main = 'green';
      S = [...stand(0, 3), ell(0, 4.6, 0, 3.8, 1.3, 3, (x, y, z) => (y > 4.6 ? ((Math.floor(x) + Math.floor(z)) % 3 === 0 ? 'tan' : 'brown') : 'lime')),
        cap([3.4, 4.6, 0], [5.4, 5.2, 0], 0.9, 0.75, 'green'), ...eyePair(5.6, 5.5, 0.6, 'black'),
        ell(2.6, 4.2, 3.6, 1.0, 0.25, 2.0, 'green'), ell(2.6, 4.2, -3.6, 1.0, 0.25, 2.0, 'green'), ell(-3, 4.2, 2.6, 0.8, 0.25, 1.2, 'green'), ell(-3, 4.2, -2.6, 0.8, 0.25, 1.2, 'green')]; break;
    case 'angler': main = rng.pick(['dgray', 'navy', 'brown']);
      S = [...stand(0, 3), ell(0, 6, 0, 3, 2.6, 2.2, main), boxS(1.4, 4.8, -1.4, 3.2, 5.4, 1.4, 'black'), boxS(1.6, 5.2, -1.6, 3.2, 5.6, -1.2, 'white'), boxS(1.6, 5.2, 1.2, 3.2, 5.6, 1.6, 'white'),
        ...eyePair(1.8, 7.0, 1.3, 'tyellow'), ...chain([[0.5, 8.4, 0], [2.2, 10, 0], [4.0, 9.4, 0]], [0.25, 0.2, 0.15], main), ell(4.3, 9.0, 0, 0.6, 0.6, 0.6, 'tyellow'),
        ell(-3.6, 6, 0, 0.8, 1.8, 0.3, main)]; break;
    case 'seahorse': main = rng.pick(['orange', 'yellow', 'pink', 'lime']);
      S = [...stand(0, 1.5), ...chain([[0, 1.4, 0], [-1, 2.4, 0], [-0.6, 3.6, 0], [0.4, 5.6, 0], [0.8, 7.8, 0], [0.2, 9.4, 0]], [0.3, 0.6, 0.9, 1.3, 1.2, 0.9], main),
        cap([0.4, 9.6, 0], [2.6, 9.2, 0], 0.55, 0.3, main), ...eyePair(0.9, 9.9, 0.55, 'black'), ell(-1.0, 7, 0, 0.8, 1.6, 0.25, 'tyellow'),
        cap([-0.2, 10.2, 0], [-0.8, 11.2, 0], 0.3, 0.1, main)]; break;
    case 'clownfish': main = 'orange';
      for (const [dx, dz, s] of [[0, 0, 1], [-3, 3.5, 0.75]]) S.push(...stand(dx, 2.5 * s + 1), ...scaleAll([ell(0, 4, 0, 2.6, 1.6, 1.1, (x) => (Math.abs(x - 1.2) < 0.4 || Math.abs(x + 0.8) < 0.4 ? 'white' : 'orange')), ell(-2.8, 4, 0, 0.5, 1.2, 0.3, 'orange'), ...eyePair(1.8, 4.4, 0.75, 'black'), ell(0, 5.6, 0, 1.3, 0.4, 0.25, 'orange')], s, dx, 0, dz));
      S.push(ell(3, 1.4, -2.5, 2.2, 1.6, 2.2, (x, y, z) => (hash(x, y, z) % 3 ? 'pink' : 'purple')));
      break;
    case 'manta': main = rng.pick(['navy', 'black', 'dgray']);
      S = [...stand(0, 4), ell(0, 5.4, 0, 2.6, 0.7, 6.8, (x, y, z) => (y < 5.3 ? 'white' : main)), ell(2.8, 5.4, 1.2, 0.8, 0.4, 0.4, main), ell(2.8, 5.4, -1.2, 0.8, 0.4, 0.4, main), cap([-2, 5.4, 0], [-8, 5.6, 0], 0.4, 0.1, main), ...eyePair(2.0, 5.9, 1.4, 'black')]; break;
    default: break;
  }
  if (kind === 'reef' || kind === 'sunkenship') {
    base(26, 18);
    if (kind === 'sunkenship') {
      sculpt(b, [boxS(-8, 0.4, -3, 8, 3.6, 3, (x, y, z) => (hash(x, y, z) % 4 ? 'brown' : 'dgreen')), boxS(-7, 2, -2, 7, 3.6, 2, null), boxS(-8, 3.6, -3, -3, 6.4, 3, 'brown'), cap([2, 3, 0], [5, 9, 1], 0.4, 0.4, 'brown'), ell(2.8, 6.8, 0.8, 0.3, 1.8, 1.4, 'white')], 1);
      b.fill(2, 9, -6, 2, 2, 'brown', 'brick'); b.add('round_plate_1x1', 9, 5, -6, 0, 'gold'); b.add('round_plate_1x1', 10, 5, -5, 0, 'gold');
    }
    const cols = ['pink', 'orange', 'red', 'purple', 'yellow', 'tred', 'lime'];
    for (let i = 0; i < (kind === 'reef' ? 40 : 18); i++) {
      const x = rng.int(-12, 12), z = rng.int(-8, 8); const y = topAt(b, x, z, 30);
      if (y < 1 || y > 3) continue;
      const c = rng.pick(cols); const t = rng.pick(['round_1x1', 'cone_1x1', 'antenna_1x1', 'round_2x2', 'flower_1x1']);
      if (b.add(t, x, y, z, 0, c) && t === 'round_1x1' && rng.chance(0.5)) b.add('cone_1x1', x, y + 3, z, 0, c);
    }
    if (kind === 'reef') {
      sculpt(b, [ell(0, 0, 0, 6, 4, 4, (x, y, z) => (hash(x, y, z) % 4 ? 'pink' : 'purple')), ell(7, 0, -3, 3, 3, 3, 'orange')], 1);
      b.fill(2, -10, 5, 2, 2, 'gold', 'brick');
    }
    decorate(b, rng, -13, -9, 26, 18, () => true, 'sea', 10);
    return { style: kind, main: 'pink' };
  }
  const sh = scaleAll(S, k);
  base(Math.ceil(22 * k), Math.ceil(14 * k));
  sculpt(b, sh, 1);
  decorate(b, rng, Math.floor(-11 * k), Math.floor(-7 * k), Math.ceil(22 * k), Math.ceil(14 * k), () => true, 'sea', 10);
  return { style: kind, main };
}

// ===================================================================== FARM
export function genFarm(b, rng, o = {}) {
  const kind = o.kind || rng.pick(['tractor', 'combine', 'haywagon', 'silo', 'coop', 'vegpatch', 'pigpen', 'farmstand', 'scarecrow']);
  const red = rng.pick(['red', 'dred']);
  switch (kind) {
    case 'tractor': {
      const c = o.color || rng.pick(['green', 'red', 'blue', 'orange', 'yellow']);
      b.add('wheel_large', 0, 0, -1, 1, 'yellow'); b.add('wheel_large', 0, 0, 4, 1, 'yellow');
      b.add('wheel_small', 7, 0, -1, 1, 'yellow'); b.add('wheel_small', 7, 0, 4, 1, 'yellow');
      b.fill(2, 0, 0, 10, 4, 'dgray', 'plate');
      b.fill(3, 0, 0, 10, 4, c, 'brick');
      b.fill(6, 5, 0, 5, 4, c, 'brick');
      for (let z = 0; z < 4; z += 2) b.add('slope_2x2', 9, 9, z, 1, c);
      b.fill(9, 5, 0, 4, 4, c, 'plate');
      b.add('grille_1x2', 10, 3, 1, 0, 'black'); b.add('grille_1x2', 10, 3, 3 - 1, 0, 'black');
      b.add('round_1x1', 8, 10, 3, 0, 'black'); b.add('round_1x1', 8, 13, 3, 0, 'black');
      b.walls(6, 0, 0, 4, 4, 2, (x, y, z) => (y === 6 ? c : 'tclear'));
      b.fill(12, -1, -1, 6, 6, c, 'plate'); b.fill(13, 0, 0, 4, 4, 'white', 'tile');
      b.add('light_1x1', 4, 13, 0, 0, 'tyellow');
      b.add('light_1x1', 10, 9, 0, 0, 'tyellow'); b.add('light_1x1', 10, 9, 3, 0, 'tyellow');
      b.add('hinge_1x2', -1, 3, 1, 1, 'dgray');
      return { style: kind, main: c };
    }
    case 'combine': {
      const c = rng.pick(['green', 'red', 'yellow']);
      b.add('wheel_large', 3, 0, -1, 1, 'black'); b.add('wheel_large', 3, 0, 6, 1, 'black');
      b.add('wheel_small', 11, 0, 0, 1, 'black'); b.add('wheel_small', 11, 0, 5, 1, 'black');
      b.fill(3, 1, 0, 14, 6, 'dgray', 'plate');
      for (let l = 0; l < 3; l++) b.fill(4 + l * 3, 1, 0, 11, 6, c, 'brick');
      b.walls(13, 0, 1, 5, 4, 2, (x, y, z) => (y === 13 ? c : 'tclear'));
      b.fill(19, -1, 0, 7, 6, c, 'plate');
      b.add('round_1x1', 8, 13, 1, 0, 'lgray'); b.add('technic_1x6', 8, 13, -1, 1, 'lgray');
      // header reel
      b.fill(3, -4, -2, 4, 10, 'yellow', 'plate');
      b.add('technic_1x6', -4, 4, -1, 1, 'dgray'); b.add('technic_1x6', -4, 4, 3, 1, 'dgray');
      for (let z = -2; z < 8; z += 2) b.add('grille_1x2', -3, 4, z, 0, 'yellow');
      b.add('light_1x1', 0, 21, 2, 0, 'tyellow');
      return { style: kind, main: c };
    }
    case 'haywagon': {
      for (const x of [1, 7]) { b.add('wheel_small', x, 0, -1, 1, 'red'); b.add('wheel_small', x, 0, 6, 1, 'red'); }
      b.fill(2, 0, 0, 10, 6, 'brown', 'plate');
      b.walls(3, 0, 0, 10, 6, 1, (x, y, z) => ((x + z) % 2 ? 'brown' : 'tan'));
      for (let x = 1; x < 9; x += 2) for (let z = 1; z < 5; z += 2) b.add('brick_2x2', x, 3 + 0, z, 0, 'yellow');
      for (let x = 2; x < 8; x += 2) b.add('brick_2x2', x, 6, 2, 0, 'yellow');
      b.add('technic_1x4', 10, 2, 2, 0, 'dgray');
      return { style: kind, main: 'yellow' };
    }
    case 'silo': {
      b.fill(0, -2, -2, 12, 12, 'green', 'plate');
      for (let l = 0; l < 9; l++) b.voxel(1 + l * 3, 0, 0, 8, 1, 8, (x, ll, z) => { const d = Math.hypot(x - 3.5, z - 3.5); return d <= 3.9 && d > 2.2 ? (l % 3 === 0 ? 'white' : 'lgray') : null; });
      for (let l = 0; l < 3; l++) b.voxel(28 + l * 3, 0, 0, 8, 1, 8, (x, ll, z) => (Math.hypot(x - 3.5, z - 3.5) <= 3.9 - l * 1.3 ? red : null));
      for (let l = 0; l < 9; l++) b.add('technic_1x2', 8, 1 + l * 3, 3, 1, 'dgray');
      b.add('cone_1x1', 3, 37, 3, 0, 'lgray');
      return { style: kind, main: 'lgray' };
    }
    case 'coop': {
      b.fill(0, -2, -2, 14, 12, 'green', 'plate');
      b.fill(1, 0, 0, 6, 6, 'brown', 'plate');
      for (const [x, z] of [[0, 0], [5, 0], [0, 5], [5, 5]]) b.add('round_1x1', x, 1, z, 0, 'brown');
      b.fill(4, 0, 0, 6, 6, 'brown', 'plate');
      b.walls(5, 0, 0, 6, 6, 2, (x, y, z) => (z === 5 && x === 2 && y === 5 ? 'black' : 'white'));
      b.fill(11, -1, -1, 8, 8, red, 'plate'); gableRoof(b, -1, -1, 8, 8, 12, red, 'white');
      b.add('slope_4x2', 1, 1, 6, 0, 'brown');
      // chickens
      for (const [x, z] of [[8, 2], [10, 5], [8, 7]]) { b.add('brick_1x1', x, 1, z, 0, 'white'); b.add('round_plate_1x1', x, 4, z, 0, 'red'); b.add('tile_1x1', x + 1, 1, z, 0, 'yellow'); }
      for (let x = 7; x < 12; x += 2) b.add('crenel_1x2', x, 1, 9, 0, 'brown');
      return { style: kind, main: 'white' };
    }
    case 'vegpatch': case 'scarecrow': {
      b.fill(0, -1, -1, 14, 12, 'green', 'plate');
      b.fill(1, 0, 0, 12, 10, 'brown', 'plate');
      const crops = [['flower_1x1', 'orange'], ['round_plate_1x1', 'red'], ['flower_1x1', 'lime'], ['cone_1x1', 'green']];
      for (let z = 0; z < 10; z += 2) { const [t, c] = crops[(z / 2) % crops.length]; for (let x = 0; x < 12; x += 2) b.add(t, x, 2, z, 0, c); }
      // scarecrow
      const sx = 6, sz = 5;
      b.add('round_1x1', sx, 2, sz, 0, 'brown'); b.add('round_1x1', sx, 5, sz, 0, 'brown');
      b.add('brick_1x2', sx, 8, sz - 1 + 1 - 1, 0, 'blue');
      b.add('plate_1x6', sx, 11, sz - 3 + 1, 0, 'brown');
      b.add('round_1x1', sx, 12, sz, 0, 'tan'); b.add('round_plate_1x1', sx, 15, sz, 0, 'yellow'); b.add('cone_1x1', sx, 16, sz, 0, 'brown');
      b.add('flower_1x1', sx, 12, sz + 2, 0, 'black');
      return { style: kind, main: 'brown' };
    }
    case 'pigpen': {
      b.fill(0, -1, -1, 14, 12, 'green', 'plate');
      b.fill(1, 1, 1, 10, 8, 'brown', 'tile');
      for (let x = 0; x < 12; x += 3) { b.add('crenel_1x2', x, 1, 0, 0, 'tan'); b.add('crenel_1x2', x, 1, 9, 0, 'tan'); }
      for (let z = 2; z < 9; z += 3) { b.add('crenel_1x2', 0, 1, z, 1, 'tan'); b.add('crenel_1x2', 11, 1, z, 1, 'tan'); }
      for (const [x, z] of [[3, 3], [7, 5]]) { b.fill(2, x, z, 3, 2, 'pink', 'brick'); b.add('round_plate_1x1', x + 3, 3, z, 0, 'pink'); b.add('eye_1x1', x + 2, 5, z, 0, 'black'); b.add('eye_1x1', x + 2, 5, z + 1, 0, 'black'); }
      b.fill(2, 2, 7, 3, 1, 'lgray', 'brick'); b.fill(5, 2, 7, 3, 1, 'tblue', 'plate');
      return { style: kind, main: 'pink' };
    }
    default: { // farm stand
      b.fill(0, -1, -1, 10, 8, 'green', 'plate');
      for (const [x, z] of [[0, 0], [7, 0], [0, 5], [7, 5]]) for (let l = 0; l < 3; l++) b.add('round_1x1', x, 1 + l * 3, z, 0, 'brown');
      b.fill(4, 0, 0, 8, 6, 'brown', 'plate');
      const fr = ['red', 'orange', 'yellow', 'green', 'purple'];
      for (let x = 1; x < 7; x++) b.add('round_plate_1x1', x, 5, 1 + (x % 2), 0, fr[x % fr.length]);
      b.add('brick_2x2', 1, 5, 3, 0, 'tan'); b.add('brick_2x2', 4, 5, 3, 0, 'tan');
      b.fill(10, -1, -1, 10, 8, red, 'plate');
      for (let x = -1; x < 9; x += 2) { b.add('slope_1x2', x, 11, -1, 2, x % 4 === 1 ? 'white' : red); b.add('slope_1x2', x + 1, 11, -1, 2, x % 4 === 1 ? red : 'white'); }
      return { style: 'farmstand', main: red };
    }
  }
}

// ===================================================================== CITY & EMERGENCY
export function genCity(b, rng, o = {}) {
  const kind = o.kind || rng.pick(['policestation', 'hospital', 'gasstation', 'bus', 'schoolbus', 'busstop', 'trafficlights']);
  if (kind === 'bus' || kind === 'schoolbus') {
    const c = kind === 'schoolbus' ? 'yellow' : rng.pick(['red', 'blue', 'green', 'white', 'azure']);
    const L = 20, W = 6;
    for (const x of [2, 14]) { b.add('wheel_small', x, 0, -1, 1, 'lgray'); b.add('wheel_small', x, 0, W, 1, 'lgray'); }
    b.fill(1, 0, 0, L, W, 'dgray', 'plate');
    b.fill(2, 0, 0, L, W, c, 'brick');
    b.walls(5, 0, 0, L, W, 1, (x, y, z) => (x === 0 || x === L - 1 || (x - 1) % 3 === 0 ? c : 'tclear'));
    b.fill(5, L - 1, 1, 1, W - 2, 'tclear', 'brick');
    b.fill(8, 0, 0, L, W, kind === 'schoolbus' ? 'black' : 'white', 'plate');
    b.fill(9, 0, 0, L, W, c, 'plate');
    b.add('light_1x1', L - 1, 2 + 1 + 6 + 1, 0, 0, 'tyellow');
    b.add('grille_1x2', L, 2, 2, 0, 'lgray');
    if (kind === 'schoolbus') { b.add('light_1x1', L - 1, 10, 1, 0, 'tred'); b.add('light_1x1', L - 1, 10, W - 2, 0, 'tred'); b.add('tile_1x4', L - 1, 2, -1, 0, 'black'); }
    else b.fill(10, 6, 1, 6, 4, 'lgray', 'brick');
    return { style: kind, main: c };
  }
  if (kind === 'busstop' || kind === 'trafficlights') {
    b.fill(0, -1, -1, 14, 8, 'lgray', 'plate');
    b.fillMask(1, -1, 4, 14, 3, (x, z) => (x % 2 === 0), 'white', 'tile');
    if (kind === 'busstop') {
      b.add('round_1x1', 0, 1, 0, 0, 'dgray'); b.add('round_1x1', 6, 1, 0, 0, 'dgray');
      for (let l = 1; l < 3; l++) { b.add('round_1x1', 0, 1 + l * 3, 0, 0, 'dgray'); b.add('round_1x1', 6, 1 + l * 3, 0, 0, 'dgray'); }
      b.fill(1, 1, -1, 5, 1, 'tblue', 'brick'); b.fill(4, 1, -1, 5, 1, 'tblue', 'brick');
      b.fill(10, -1, -1, 9, 3, 'dgray', 'plate');
      b.add('plate_1x4', 1, 3, 0, 1, 'brown') ; b.add('brick_1x4', 1, 1, 0, 1, 'dgray');
      for (let l = 0; l < 4; l++) b.add('round_1x1', 10, 1 + l * 3, 1, 0, 'lgray');
      b.add('brick_1x2', 10, 13, 0, 0, 'blue');
    } else {
      for (const [x, z] of [[0, 0], [11, 6]]) { for (let l = 0; l < 4; l++) b.add('round_1x1', x, 1 + l * 3, z, 0, 'dgray'); b.add('brick_1x1', x, 13, z, 0, 'black'); b.add('light_1x1', x, 16, z, 0, 'tgreen'); b.add('brick_1x1', x + (x ? -1 : 1), 13, z, 0, 'black'); b.add('light_1x1', x + (x ? -1 : 1), 16, z, 0, 'tred'); }
    }
    return { style: kind, main: 'lgray' };
  }
  // buildings
  const W = kind === 'gasstation' ? 16 : rng.int(12, 14), D = 9;
  const wall = { policestation: rng.pick(['lgray', 'white', 'azure']), hospital: 'white', gasstation: 'white' }[kind];
  b.fill(0, -2, -2, W + 4, D + 6, 'lgray', 'plate');
  if (kind === 'gasstation') {
    b.walls(1, 0, 0, 7, 6, 2, (x, y, z) => (z === 5 && x > 0 && x < 6 && y > 1 ? 'tclear' : wall), (x, y, z) => z === 5 && x === 3 && y < 7);
    b.add('door_1x2x3', 3, 1, 5, 0, 'red');
    b.fill(7, 0, 0, 7, 6, 'red', 'plate');
    for (const [x, z] of [[9, 1], [14, 1], [9, 6], [14, 6]]) for (let l = 0; l < 4; l++) b.add('round_1x1', x, 1 + l * 3, z, 0, 'lgray');
    b.fill(13, 8, 0, 8, 8, 'red', 'plate'); b.fill(14, 8, 0, 8, 8, 'white', 'tile');
    for (const z of [3, 5]) { b.fill(1, 11, z, 1, 1, 'red', 'brick'); b.add('brick_1x1', 11, 4, z, 0, 'red'); b.add('light_1x1', 11, 7, z, 0, 'tyellow'); }
    for (let l = 0; l < 6; l++) b.add('round_1x1', -2, 1 + l * 3, 7, 0, 'dgray'); b.fill(19, -3, 6, 3, 3, 'red', 'brick');
    return { style: kind, main: 'red' };
  }
  let y = 1;
  for (let f = 0; f < 2; f++) {
    b.walls(y, 0, 0, W, D, 3, (x, yy, z) => (yy === y && f === 0 ? (kind === 'policestation' ? 'blue' : 'red') : ((x % 3 === 1 || z % 3 === 1) && yy > y && (z === D - 1 || z === 0 || x === 0 || x === W - 1) ? 'tclear' : wall)), (x, yy, z) => f === 0 && z === D - 1 && (x === Math.floor(W / 2) - 1 || x === Math.floor(W / 2)) && yy < y + 9);
    if (f === 0) b.add('door_1x2x3', Math.floor(W / 2) - 1, 1, D - 1, 0, kind === 'policestation' ? 'blue' : 'tclear');
    y += 9; b.fill(y, 0, 0, W, D, 'dgray', 'plate'); y++;
  }
  b.walls(y, 0, 0, W, D, 1, wall);
  if (kind === 'hospital') {
    b.fill(y, 3, 2, 6, 5, 'lgray', 'tile') ; b.fill(y, 5, 3, 2, 3, 'red', 'tile');
    b.fill(y, 4, 4, 4, 1, 'red', 'tile');
    b.fill(1, W, 2, 3, 5, 'dgray', 'tile');
  } else {
    b.add('light_1x1', 1, y + 3, D - 1, 0, 'tblue'); b.add('light_1x1', W - 2, y + 3, D - 1, 0, 'tred');
    b.add('antenna_1x1', 2, y, 2, 0, 'lgray'); b.add('dish_2x2', 5, y, 3, 0, 'white');
    b.fillMask(1, 0, D + 1, W, 3, (x, z) => x % 4 === 0, 'white', 'tile');
  }
  return { style: kind, main: wall };
}

// ===================================================================== RACING & SPORTS
export function genRacing(b, rng, o = {}) {
  const kind = o.kind || rng.pick(['pitgarage', 'trophy', 'podium', 'startgantry', 'skateramp', 'kart']);
  const team = rng.pick(['red', 'blue', 'orange', 'lime', 'azure', 'purple', 'black']);
  switch (kind) {
    case 'trophy': {
      b.fill(0, 0, 0, 8, 8, 'black', 'brick'); b.fill(3, 1, 1, 6, 6, 'black', 'brick'); b.fill(6, 1, 1, 6, 6, 'gold', 'plate');
      sculpt(b, [cap([4, 3, 4], [4, 5, 4], 1.4, 0.6, 'gold'), ell(4, 9, 4, 3.2, 3.6, 3.2, 'gold'), ell(4, 10.6, 4, 2.4, 2.4, 2.4, null), ell(0.6, 9.5, 4, 1.2, 1.6, 0.4, 'gold'), ell(7.4, 9.5, 4, 1.2, 1.6, 0.4, 'gold')], 7);
      b.fill(7, 3, 7, 2, 1, team, 'tile');
      return { style: kind, main: 'gold' };
    }
    case 'podium': {
      b.fill(0, -1, -1, 14, 6, 'dgray', 'plate');
      b.fill(1, 4, 0, 4, 4, 'gold', 'brick'); b.fill(4, 4, 0, 4, 4, 'gold', 'brick'); b.fill(7, 4, 0, 4, 4, 'gold', 'brick');
      b.fill(1, 0, 0, 4, 4, 'lgray', 'brick'); b.fill(4, 0, 0, 4, 4, 'lgray', 'brick');
      b.fill(1, 8, 0, 4, 4, 'orange', 'brick');
      for (const [x, y] of [[5, 10], [1, 7], [9, 4]]) { b.add('brick_1x2', x, y, 1, 0, rng.pick(['red', 'blue', 'green'])); b.add('round_1x1', x, y + 3, 1, 0, 'yellow'); b.add('round_plate_1x1', x, y + 6, 1, 0, 'black'); }
      b.add('antenna_1x1', 6, 10, 3, 0, 'lgray'); b.add('brick_1x2', 6, 16, 2, 1, team);
      return { style: kind, main: 'gold' };
    }
    case 'startgantry': {
      b.fill(0, -2, -2, 18, 10, 'dgray', 'plate');
      b.fillMask(1, -2, 2, 18, 2, (x, z) => (x + z) % 2 === 0, 'white', 'tile');
      for (const x of [-2, 13]) for (let l = 0; l < 6; l++) b.add('brick_2x2', x, 1 + l * 3, -1, 0, 'lgray');
      b.fill(19, -2, -1, 17, 2, 'black', 'brick');
      for (let x = 2; x < 12; x += 2) { b.add('light_1x1', x, 22, -1, 0, 'tred'); b.add('light_1x1', x, 22, 0, 0, x > 8 ? 'tgreen' : 'tred'); }
      b.fill(22, -2, -1, 4, 2, team, 'plate'); b.fill(22, 11, -1, 4, 2, team, 'plate');
      return { style: kind, main: 'black' };
    }
    case 'skateramp': {
      b.fill(0, -1, -1, 18, 10, 'lgray', 'plate');
      for (const [x, r] of [[0, 3], [12, 1]]) { for (let z = 0; z < 8; z += 2) { b.add('slope_2x3', x, 1, z, r, team); b.add('slope_2x3', x + (r === 3 ? 0 : 1) - 0, 4, z, r, team); } }
      b.fill(1, 0, 0, 3, 8, team, 'brick') ; b.fill(1, 13, 0, 3, 8, team, 'brick');
      b.add('brick_1x4', 7, 1, 2, 0, 'yellow'); b.add('tile_1x4', 7, 4, 2, 0, 'black');
      return { style: kind, main: team };
    }
    case 'kart': {
      b.add('wheel_small', 0, 0, -1, 1, 'black'); b.add('wheel_small', 0, 0, 4, 1, 'black');
      b.add('wheel_small', 6, 0, -1, 1, 'black'); b.add('wheel_small', 6, 0, 4, 1, 'black');
      b.fill(1, 0, 0, 9, 4, 'dgray', 'plate');
      b.fill(2, 1, 1, 7, 2, team, 'plate');
      b.add('brick_1x2', 2, 3, 1, 0, 'black'); b.add('slope_2x2', 7, 2, 1, 1, team);
      b.add('round_plate_1x1', 5, 3, 1, 0, 'black'); b.add('round_1x1', 3, 3, 2, 0, 'white'); b.add('round_plate_1x1', 3, 6, 2, 0, team);
      b.add('round_1x1', 0, 2, 1, 0, 'lgray'); b.fill(2, -1, 0, 1, 4, team, 'plate');
      return { style: kind, main: team };
    }
    default: { // pit garage
      const W = 14, D = 9;
      b.fill(0, -1, -1, W + 2, D + 6, 'dgray', 'plate');
      b.walls(1, 0, 0, W, D, 3, (x, y, z) => (y === 1 ? team : 'white'), (x, y, z) => z === D - 1 && x > 1 && x < W - 2);
      b.fill(10, -1, -1, W + 2, D + 1, 'lgray', 'plate');
      b.fill(11, 0, 0, W, D, team, 'tile');
      for (let x = 1; x < W - 1; x += 3) b.add('technic_1x2', x, 1, 0, 0, 'lgray');
      b.add('brick_1x2', 1, 4, 1, 0, 'red'); b.add('brick_1x2', 1, 7, 1, 0, 'red');
      b.add('round_1x1', 12, 1, 1, 0, 'black'); b.add('round_1x1', 12, 4, 1, 0, 'black');
      // the race car inside
      b.add('wheel_small', 3, 1, 2, 1, 'black'); b.add('wheel_small', 3, 1, 7, 1, 'black');
      b.add('wheel_small', 9, 1, 2, 1, 'black'); b.add('wheel_small', 9, 1, 7, 1, 'black');
      b.fill(3, 2, 3, 11, 4, 'dgray', 'plate'); b.fill(4, 3, 4, 9, 2, team, 'brick');
      b.add('round_1x1', 7, 7, 4, 0, 'white'); b.fill(7, 2, 3, 1, 4, team, 'plate');
      b.fillMask(1, 0, D + 1, W, 3, (x, z) => (x + z) % 2 === 0, 'white', 'tile');
      return { style: 'pitgarage', main: team };
    }
  }
}

// ===================================================================== THEME PARK
export function genThemePark(b, rng, o = {}) {
  const kind = o.kind || rng.pick(['ferriswheel', 'carousel', 'coaster', 'bumpercars', 'ticketbooth', 'icecream', 'balloon', 'swingride', 'hauntedhouse', 'teacups', 'droptower']);
  const c1 = rng.pick(['red', 'blue', 'purple', 'orange', 'teal', 'pink']);
  const c2 = rng.pick(['yellow', 'white', 'azure', 'lime']);
  const lights = ['tyellow', 'tred', 'tblue', 'tgreen'];
  switch (kind) {
    case 'ferriswheel': {
      const R = o.R || 8;
      b.fill(0, -R - 2, -3, 2 * R + 5, 8, 'lgray', 'plate');
      const S = [];
      const H = R + 2.4;
      for (const z of [-1.5, 2.5]) { S.push(cap([-R * 0.6, 0, z], [0.5, H, z], 0.4, 0.4, 'lgray'), cap([R * 0.6 + 1, 0, z], [0.5, H, z], 0.4, 0.4, 'lgray')); }
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, a2 = (i + 1) / n * Math.PI * 2;
        const p1 = [0.5 + Math.cos(a) * R, H + Math.sin(a) * R, 0.5], p2 = [0.5 + Math.cos(a2) * R, H + Math.sin(a2) * R, 0.5];
        S.push(cap(p1, p2, 0.45, 0.45, i % 2 ? c1 : c2));
        if (i % 2 === 0) S.push(cap([0.5, H, 0.5], p1, 0.25, 0.25, 'white'));
      }
      S.push(ell(0.5, H, 0.5, 1, 1, 1.6, 'dgray'));
      sculpt(b, S, 1);
      for (let i = 0; i < n; i += 2) { const a = i / n * Math.PI * 2; const x = Math.round(0.5 + Math.cos(a) * R) - 1, y = Math.round((H + Math.sin(a) * R) / 0.4) - 3; b.fill(Math.max(1, y), x, 1, 2, 2, rng.pick(['red', 'yellow', 'blue', 'green', 'orange']), 'brick'); b.add('light_1x1', x, Math.max(1, y) + 3, 1, 0, rng.pick(lights)); }
      b.fill(1, -2, 5, 5, 3, 'white', 'brick');
      return { style: kind, main: c1 };
    }
    case 'carousel': case 'teacups': {
      const R = 7;
      b.voxel(0, -R, -R, 2 * R, 1, 2 * R, (x, l, z) => (Math.hypot(x + 0.5, z + 0.5) <= R ? ((x + z) % 2 ? c2 : 'lgray') : null), 'plate');
      b.voxel(1, -R + 1, -R + 1, 2 * R - 2, 1, 2 * R - 2, (x, l, z) => (Math.hypot(x + 0.5, z + 0.5) <= R - 1 ? c1 : null), 'plate');
      for (let l = 0; l < 5; l++) b.add('round_2x2', -1, 2 + l * 3, -1, 0, l % 2 ? c2 : 'gold');
      if (kind === 'carousel') {
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2, x = Math.round(Math.cos(a) * 4.6) - 1, z = Math.round(Math.sin(a) * 4.6) - 1;
          const y = 2 + (i % 2) * 2;
          b.add('brick_1x2', x, y + 0, z, (i % 2), rng.pick(['white', 'tan', 'black', 'brown']));
          for (let l = 0; l < 4; l++) b.add('round_plate_1x1', x, y + 3 + l, z, 0, 'gold');
          b.add('antenna_1x1', x, y + 7, z, 0, 'gold');
        }
      } else {
        for (let i = 0; i < 5; i++) {
          const a = i / 5 * Math.PI * 2, x = Math.round(Math.cos(a) * 4.2) - 1, z = Math.round(Math.sin(a) * 4.2) - 1;
          const cc = rng.pick(['pink', 'azure', 'lime', 'yellow', 'purple']);
          b.add('round_2x2', x, 2, z, 0, cc); b.add('round_plate_1x1', x, 5, z, 0, 'white');
        }
      }
      if (kind === 'carousel') {
        const ty = 17;
        b.voxel(ty, -R, -R, 2 * R, 1, 2 * R, (x, l, z) => (Math.hypot(x + 0.5, z + 0.5) <= R ? 'gold' : null), 'plate');
        for (let l = 0; l < 4; l++) { const r = R - 0.5 - l * 1.8; b.voxel(ty + 1 + l * 3, -R, -R, 2 * R, 1, 2 * R, (x, ll, z) => { const d = Math.hypot(x + 0.5, z + 0.5); return d <= r ? (Math.floor(Math.atan2(z + 0.5, x + 0.5) * 3) % 2 ? c1 : 'white') : null; }); }
        b.add('antenna_1x1', -1, ty + 13, -1, 0, 'gold');
        for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; b.add('light_1x1', Math.round(Math.cos(a) * 6.3) - 1, ty + 1, Math.round(Math.sin(a) * 6.3) - 1, 0, rng.pick(lights)); }
      }
      return { style: kind, main: c1 };
    }
    case 'coaster': {
      const L = 34;
      b.fill(0, -1, -2, L + 2, 8, 'green', 'plate');
      const h = x => Math.round(3 + 9 * Math.max(0, Math.sin(x / L * Math.PI * 2 - 0.3)) + 4 * Math.max(0, Math.sin(x / L * Math.PI * 4 + 1)));
      for (let x = 0; x < L; x += 2) {
        const hy = 1 + h(x) * 3;
        for (let y = 1; y + 3 <= hy; y += 3) b.add(x % 4 === 0 ? 'round_1x1' : 'technic_connector', x, y, 2, 0, x % 4 === 0 ? 'white' : 'lgray');
        b.add('plate_2x4', x, hy, 1, 1, c1);
        b.add('tile_1x2', x, hy + 1, 1, 1, 'dgray'); b.add('tile_1x2', x, hy + 1, 4, 1, 'dgray');
      }
      const cx = 10;
      for (let i = 0; i < 3; i++) { const x = cx + i * 2, hy = 1 + h(x) * 3 + 1; b.add('brick_2x2', x, hy, 2, 0, i ? c2 : 'red'); b.add('round_plate_1x1', x, hy + 3, 2, 0, 'black'); }
      b.walls(1, L - 6, 3, 6, 4, 2, c2); b.fill(7, L - 7, 2, 8, 6, c1, 'plate');
      return { style: kind, main: c1 };
    }
    case 'bumpercars': {
      b.fill(0, -1, -1, 18, 14, 'dgray', 'plate');
      b.fill(1, 0, 0, 16, 12, 'black', 'tile');
      for (let x = 0; x < 16; x += 3) { b.add('crenel_1x2', x, 2, 0, 0, c2); b.add('crenel_1x2', x, 2, 11, 0, c2); }
      for (const [x, z] of [[0, 0], [15, 0], [0, 11], [15, 11]]) for (let l = 0; l < 5; l++) b.add('round_1x1', x, 2 + l * 3 + (l === 0 ? 0 : 0), z, 0, 'lgray');
      b.fill(17, -1, -1, 18, 14, c1, 'plate'); b.fill(18, 2, 2, 12, 8, 'tclear', 'plate');
      for (let i = 0; i < 5; i++) { const x = 2 + i * 3, z = 2 + (i % 3) * 3; const cc = rng.pick(['red', 'blue', 'yellow', 'lime', 'orange']); b.fill(2, x, z, 2, 2, 'dgray', 'plate'); b.add('brick_2x2', x, 3, z, 0, cc); b.add('antenna_1x1', x, 6, z, 0, 'lgray'); b.add('round_plate_1x1', x + 1, 6, z + 1, 0, 'black'); }
      return { style: kind, main: c1 };
    }
    case 'ticketbooth': case 'icecream': {
      b.fill(0, -1, -1, 10, 9, 'lgray', 'plate');
      b.walls(1, 0, 0, 6, 5, 3, (x, y, z) => (z === 4 && y === 4 && x > 0 && x < 5 ? 'tclear' : (y === 1 ? c1 : 'white')), (x, y, z) => z === 4 && y === 4 && x > 0 && x < 5);
      b.fill(10, -1, -1, 8, 7, c1, 'plate');
      for (let x = -1; x < 7; x++) b.add('slope_1x2', x, 11, 4, 0, x % 2 ? c1 : 'white');
      b.fill(11, -1, -1, 8, 5, c1, 'brick');
      if (kind === 'icecream') { sculpt(b, [cap([3, 0, 2.5], [3, 3, 2.5], 0.5, 1.4, 'tan'), ell(3, 3.8, 2.5, 1.8, 1.6, 1.8, 'pink'), ell(3, 5.3, 2.5, 1.2, 1.1, 1.2, 'white'), ell(3, 6.6, 2.5, 0.5, 0.5, 0.5, 'red')], 14); }
      else { for (const x of [1, 4]) { b.add('round_1x1', x, 14, 1, 0, 'lgray'); b.add('round_1x1', x, 17, 1, 0, 'lgray'); } b.fill(20, 1, 1, 4, 1, c2, 'brick'); }
      for (let i = 0; i < 4; i++) { b.add('round_1x1', -1 + i * 3, 1, 7, 0, 'brown'); b.add('flower_1x1', -1 + i * 3, 4, 7, 0, rng.pick(['red', 'yellow', 'pink'])); }
      return { style: kind, main: c1 };
    }
    case 'balloon': {
      const S = [ell(0, 12, 0, 5.5, 6.5, 5.5, (x, y, z) => { const a = Math.atan2(z, x); return ['red', 'yellow', 'blue', 'white', 'orange', 'lime'][(Math.floor((a + Math.PI) / (Math.PI / 4)) % 6 + 6) % 6]; }), cap([0, 5, 0], [0, 7, 0], 1.0, 2.6, (x, y, z) => (Math.atan2(z, x) > 0 ? c1 : c2))];
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S.push(cap([x * 1.4, 3, z * 1.4], [x * 1.1, 5.4, z * 1.1], 0.15, 0.15, 'black'));
      S.push(boxS(-1.5, 0.6, -1.5, 1.5, 3, 1.5, 'brown'));
      S.push(boxS(-1, 1.2, -1, 1, 3, 1, null));
      b.fill(0, -4, -4, 8, 8, 'green', 'plate');
      for (let l = 0; l < 2; l++) b.add('round_1x1', 3, 1 + l * 3, 3, 0, 'brown');
      sculpt(b, S, 1);
      return { style: kind, main: c1 };
    }
    case 'swingride': case 'droptower': {
      b.voxel(0, -7, -7, 14, 1, 14, (x, l, z) => (Math.hypot(x + 0.5, z + 0.5) <= 7 ? 'lgray' : null), 'plate');
      const H = kind === 'droptower' ? 14 : 8;
      for (let l = 0; l < H; l++) b.add(l % 2 ? 'technic_connector' : 'round_2x2', l % 2 ? 0 : -1, 1 + l * 3, l % 2 ? 0 : -1, 0, l % 2 ? 'dgray' : c1) || b.add('round_2x2', -1, 1 + l * 3, -1, 0, c1);
      const ty = 1 + H * 3;
      if (kind === 'droptower') {
        b.voxel(10, -3, -3, 6, 1, 6, (x, l, z) => { const d = Math.hypot(x + 0.5, z + 0.5); return d <= 3 && d > 1.2 ? c2 : null; });
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; b.add('brick_1x1', Math.round(Math.cos(a) * 2.2) - 1 + 1, 13, Math.round(Math.sin(a) * 2.2), 0, rng.pick(['red', 'blue', 'yellow'])); }
        b.add('cone_1x1', 0, ty, 0, 0, 'tred');
        b.add('light_1x1', -1, ty, 0, 0, 'tyellow');
      } else {
        b.voxel(ty, -6, -6, 12, 1, 12, (x, l, z) => (Math.hypot(x + 0.5, z + 0.5) <= 6 ? c1 : null), 'plate');
        for (let l = 0; l < 3; l++) b.voxel(ty + 1 + l * 3, -6, -6, 12, 1, 12, (x, ll, z) => (Math.hypot(x + 0.5, z + 0.5) <= 5.5 - l * 2 ? (l % 2 ? c2 : c1) : null));
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const x = Math.round(Math.cos(a) * 5) - 0, z = Math.round(Math.sin(a) * 5); b.add('antenna_1x1', x, ty - 6, z, 0, 'lgray'); b.add('brick_1x1', x, ty - 9, z, 0, rng.pick(['red', 'yellow', 'blue', 'green'])); }
      }
      return { style: kind, main: c1 };
    }
    default: { // haunted house
      const W = 12, D = 8;
      b.fill(0, -2, -2, W + 4, D + 6, 'dgreen', 'plate');
      let y = 1;
      for (let f = 0; f < 2; f++) { b.walls(y, 0, 0, W, D, 3, (x, yy, z) => ((x === 2 || x === 9) && yy > y && (z === D - 1) ? 'tgreen' : (hash(x, yy, z) % 6 === 0 ? 'black' : 'dgray')), (x, yy, z) => f === 0 && z === D - 1 && (x === 5 || x === 6) && yy < 10); y += 9; b.fill(y, 0, 0, W, D, 'black', 'plate'); y++; }
      b.add('door_1x2x3', 5, 1, D - 1, 0, 'purple');
      b.fill(y, -1, -1, W + 2, D + 2, 'purple', 'plate'); gableRoof(b, -1, -1, W + 2, D + 2, y + 1, 'purple', 'dgray');
      for (const x of [-2, W + 1]) for (let l = 0; l < 3; l++) b.add('round_1x1', x, 1 + l * 3, D + 2, 0, 'black');
      b.add('light_1x1', -2, 10, D + 2, 0, 'tgreen'); b.add('light_1x1', W + 1, 10, D + 2, 0, 'tgreen');
      sculpt(b, [ell(W + 2, 4, -1, 1.2, 1.5, 1.2, 'white'), ell(W + 2.3, 4.6, -0.1, 0.25, 0.25, 0.25, 'black')], 20);
      for (let i = 0; i < 3; i++) b.add('round_1x1', -2 + i, 1, -2, 0, 'orange');
      return { style: 'hauntedhouse', main: 'purple' };
    }
  }
}
