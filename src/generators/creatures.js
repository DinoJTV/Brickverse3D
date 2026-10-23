// generators/creatures.js — dinosaurs, prehistoric creatures and animals.
// Creatures are sculpted from simple shapes (ellipsoids and boxes) that are then filled
// with bricks layer by layer. Heads point to +X. Shape y-units are BRICK layers.

/** Fill a list of shapes with bricks. Later shapes paint over earlier ones. */
function sculpt(b, shapes, baseY = 0) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxL = 0;
  for (const s of shapes) {
    const [x0, x1, z0, z1, y1] = s.k === 'box'
      ? [s.x, s.x + s.w, s.z, s.z + s.d, s.y + s.h]
      : [s.cx - s.rx, s.cx + s.rx, s.cz - s.rz, s.cz + s.rz, s.cy + s.ry];
    minX = Math.min(minX, Math.floor(x0)); maxX = Math.max(maxX, Math.ceil(x1));
    minZ = Math.min(minZ, Math.floor(z0)); maxZ = Math.max(maxZ, Math.ceil(z1));
    maxL = Math.max(maxL, Math.ceil(y1));
  }
  const inside = (s, x, l, z) => {
    const px = x + 0.5, py = l + 0.5, pz = z + 0.5;
    if (s.k === 'box') return px >= s.x && px < s.x + s.w && py >= s.y && py < s.y + s.h && pz >= s.z && pz < s.z + s.d;
    const dx = (px - s.cx) / s.rx, dy = (py - s.cy) / s.ry, dz = (pz - s.cz) / s.rz;
    return dx * dx + dy * dy + dz * dz <= 1;
  };
  b.voxel(baseY, minX, minZ, maxX - minX, maxL, maxZ - minZ, (x, l, z) => {
    let c = null;
    for (const s of shapes) if (inside(s, x, l, z)) c = typeof s.c === 'function' ? s.c(x, l, z) : s.c;
    return c;
  });
}

/** Plate height just above the highest piece at column (x, z). */
function topAt(b, x, z, maxY = 200) {
  for (let y = maxY; y >= 0; y--) if (b.occ.at(x, y, z)) return y + 1;
  return 0;
}

const E = (cx, cy, cz, rx, ry, rz, c) => ({ k: 'ell', cx, cy, cz, rx, ry, rz, c });
const BOX = (x, y, z, w, h, d, c) => ({ k: 'box', x, y, z, w, h, d, c });

const DINO_SKINS = [
  ['green', 'lime'], ['dgreen', 'tan'], ['brown', 'tan'], ['orange', 'yellow'], ['teal', 'azure'],
  ['dgray', 'lgray'], ['purple', 'pink'], ['dred', 'orange'], ['blue', 'azure'], ['tan', 'white'], ['lime', 'yellow'],
];

export function genDinosaur(b, rng, o = {}) {
  const species = o.species || rng.pick(['sauropod', 'trex', 'triceratops', 'stegosaurus', 'raptor', 'pterosaur', 'ankylosaur', 'spinosaurus', 'crested', 'mammoth', 'sabretooth']);
  const s = o.scale || rng.pick([1, 1.25, 1.5]);
  let [skin, belly] = o.skin || rng.pick(DINO_SKINS);
  if (species === 'mammoth') { skin = rng.pick(['brown', 'dred', 'tan']); belly = 'brown'; }
  if (species === 'sabretooth') { skin = rng.pick(['tan', 'orange', 'gold']); belly = 'white'; }
  const accent = rng.pick(['red', 'orange', 'yellow', 'dgreen', 'purple', 'black']);
  const S = v => v * s;
  const sh = [];
  const cz = S(4);
  const legs = (xs, rx, h, wide) => { for (const x of xs) for (const z of [cz - wide, cz + wide - S(1.6)]) sh.push(BOX(x, 0, z, S(1.6) + (rx || 0), h, S(1.6), skin)); };
  const bellyC = (cy) => (x, l, z) => (l < cy ? belly : skin);

  switch (species) {
    case 'sauropod': {
      legs([S(3), S(9)], S(0.4), S(3), S(2));
      sh.push(E(S(7), S(4.2), cz, S(6), S(2), S(3), bellyC(S(3.3))));
      for (let i = 0; i < 6; i++) sh.push(E(S(12.5 + i * 1.2), S(5 + i * 1.1), cz, S(1.3), S(0.9), S(1.1), skin));
      sh.push(E(S(19.5), S(11.5), cz, S(2), S(0.9), S(1.2), skin));
      for (let i = 0; i < 8; i++) sh.push(E(S(1.5 - i * 1.3), S(4 - i * 0.4), cz, S(1.6 - i * 0.12), S(0.9), S(1.4 - i * 0.12), skin));
      break;
    }
    case 'trex': {
      legs([S(6)], S(0.6), S(3), S(2));
      sh.push(E(S(7), S(4.5), cz, S(4.5), S(1.8), S(2.4), bellyC(S(3.8))));
      sh.push(E(S(11), S(5.8), cz, S(1.6), S(1.3), S(1.5), skin));
      sh.push(E(S(13.5), S(6.6), cz, S(2.6), S(1.3), S(1.6), skin));
      sh.push(BOX(S(13), S(5.2), cz - S(1), S(3), S(0.6), S(2), belly));
      for (let i = 0; i < 7; i++) sh.push(E(S(2.5 - i * 1.4), S(4.6 - i * 0.35), cz, S(1.8 - i * 0.2), S(0.95 - i * 0.05), S(1.6 - i * 0.18), skin));
      sh.push(BOX(S(10.5), S(3.8), cz - S(2.3), 1, 1, 1, skin)); sh.push(BOX(S(10.5), S(3.8), cz + S(2.3) - 1, 1, 1, 1, skin));
      break;
    }
    case 'raptor': {
      legs([S(4)], 0, S(2.5), S(1.4));
      sh.push(E(S(5), S(3.5), cz, S(3.2), S(1.2), S(1.6), bellyC(S(3))));
      sh.push(E(S(8.5), S(4.6), cz, S(1.1), S(1.2), S(0.9), skin));
      sh.push(E(S(10.2), S(5.4), cz, S(1.9), S(0.8), S(1), skin));
      for (let i = 0; i < 6; i++) sh.push(E(S(1.5 - i * 1.2), S(3.7 + i * 0.12), cz, S(1.3 - i * 0.12), S(0.7), S(1 - i * 0.1), i % 2 ? accent : skin));
      break;
    }
    case 'triceratops': case 'ankylosaur': case 'stegosaurus': case 'mammoth': case 'sabretooth': {
      const tall = species === 'mammoth' ? 3.2 : species === 'stegosaurus' ? 2.6 : species === 'sabretooth' ? 2.4 : 2;
      legs([S(2.5), S(8)], S(0.3), S(tall), S(species === 'ankylosaur' ? 2.6 : 2));
      const bw = species === 'ankylosaur' ? 3.6 : species === 'sabretooth' ? 2.3 : 3;
      sh.push(E(S(6), S(tall + 1.6), cz, S(5.2), S(species === 'mammoth' ? 2.6 : 1.9), S(bw), bellyC(S(tall + 1))));
      if (species === 'triceratops') {
        sh.push(E(S(12), S(tall + 1.4), cz, S(2.2), S(1.3), S(1.8), skin));
        sh.push(BOX(S(10.5), S(tall + 1), cz - S(3.2), 1, S(3.2), S(6.4), accent));
      } else if (species === 'mammoth') {
        sh.push(E(S(11.5), S(tall + 3), cz, S(2), S(2), S(2), skin));
        for (let i = 0; i < 4; i++) sh.push(E(S(13.3), S(tall + 2 - i * 0.9), cz, S(0.7), S(0.7), S(0.7), skin));
        sh.push(E(S(11), S(tall + 4.2), cz - S(2.2), S(0.6), S(1.3), S(1), belly)); sh.push(E(S(11), S(tall + 4.2), cz + S(2.2), S(0.6), S(1.3), S(1), belly));
      } else if (species === 'sabretooth') {
        sh.push(E(S(11.5), S(tall + 2.6), cz, S(1.8), S(1.4), S(1.6), skin));
        sh.push(E(S(11), S(tall + 4), cz - S(1), S(0.5), S(0.6), S(0.5), skin)); sh.push(E(S(11), S(tall + 4), cz + S(1), S(0.5), S(0.6), S(0.5), skin));
      } else {
        sh.push(E(S(11.6), S(tall + 0.9), cz, S(1.6), S(1), S(1.3), skin));
      }
      const tl = species === 'ankylosaur' ? 6 : species === 'mammoth' ? 2 : 5;
      for (let i = 0; i < tl; i++) sh.push(E(S(0.5 - i * 1.3), S(tall + 1.5 - i * 0.2), cz, S(1.4 - i * 0.15), S(0.8), S(1.2 - i * 0.12), skin));
      if (species === 'ankylosaur') sh.push(E(S(0.5 - tl * 1.3), S(tall + 0.4), cz, S(1.3), S(0.9), S(1.4), accent));
      break;
    }
    case 'spinosaurus': case 'crested': {
      legs([S(6)], S(0.5), S(3), S(1.9));
      sh.push(E(S(7), S(4.5), cz, S(4.3), S(1.6), S(2.1), bellyC(S(4))));
      sh.push(E(S(11), S(5.8), cz, S(1.4), S(1.3), S(1.2), skin));
      sh.push(E(S(13.2), S(6.4), cz, S(2.8), S(0.9), S(1.1), skin));
      for (let i = 0; i < 7; i++) sh.push(E(S(2.5 - i * 1.4), S(4.5 - i * 0.3), cz, S(1.6 - i * 0.18), S(0.9), S(1.4 - i * 0.15), skin));
      if (species === 'spinosaurus') for (let x = Math.round(S(3)); x <= Math.round(S(10)); x++) { const h = Math.max(1, Math.round(S(3.2) * Math.sin((x - S(2.5)) / S(8) * Math.PI))); sh.push(BOX(x, Math.round(S(5.9)), Math.floor(cz), 1, h, 1, accent)); }
      else for (let i = 0; i < 4; i++) sh.push(E(S(12.5 - i * 1.2), S(7.4 + i * 0.4), cz, S(0.8), S(0.6), S(0.6), accent));
      break;
    }
    case 'pterosaur': {
      // a stand, then a body with wide wings
      sh.push(BOX(S(5), 0, cz - 1, 2, S(3), 2, 'dgray'));
      sh.push(E(S(6), S(4.2), cz, S(3), S(1), S(1.4), bellyC(S(4))));
      sh.push(E(S(9.6), S(5), cz, S(2.6), S(0.7), S(0.9), skin));
      sh.push(E(S(7.6), S(5.7), cz, S(1.6), S(0.7), S(0.5), accent));
      break;
    }
  }
  sculpt(b, sh);

  // ------------------------------------------------ surface details
  const headX = { sauropod: S(20.5), trex: S(15), raptor: S(11.4), triceratops: S(12.8), ankylosaur: S(12.6), stegosaurus: S(12.6), mammoth: S(12.4), sabretooth: S(12.6), spinosaurus: S(14.6), crested: S(14.6), pterosaur: S(10.6) }[species];
  const hx = Math.floor(headX) - 1;
  const zL = Math.floor(cz) - 1, zR = Math.floor(cz) + (s >= 1.25 ? 1 : 0);
  for (const z of [zL, zR]) { const y = topAt(b, hx, z); if (y > 0) b.add('eye_1x1', hx, y, z, 0, 'black'); }
  if (species === 'triceratops') {
    const y = topAt(b, hx + 1, Math.floor(cz)); b.add('spike_1x1', hx + 1, y, Math.floor(cz), 0, 'white');
    for (const z of [Math.floor(cz) - 2, Math.floor(cz) + 1]) b.add('spike_1x1', Math.floor(S(10.5)) - 0, topAt(b, Math.floor(S(10.5)), z), z, 0, 'white');
  }
  if (species === 'stegosaurus') {
    for (let x = Math.floor(S(1.5)); x <= Math.floor(S(10)); x += 2) {
      const z = Math.floor(cz) - ((x / 2) % 2 ? 1 : 0);
      const y = topAt(b, x, z);
      b.add('slope_1x2', x, y, z, x % 4 ? 3 : 1, accent);
    }
    for (const z of [Math.floor(cz) - 1, Math.floor(cz)]) { const x = Math.floor(S(-4.5)); b.add('spike_1x1', x, topAt(b, x, z), z, 0, 'white'); }
  }
  if (species === 'ankylosaur') {
    for (let x = Math.floor(S(2)); x <= Math.floor(S(10)); x += 2) for (let z = Math.floor(cz - S(2.4)); z <= Math.floor(cz + S(2.4)); z += 2) {
      const y = topAt(b, x, z); if (y > 3) b.add('round_plate_1x1', x, y, z, 0, accent);
    }
  }
  if (species === 'mammoth') {
    for (const z of [Math.floor(cz) - 2, Math.floor(cz) + 1]) { b.add('spike_1x1', Math.floor(S(14)), Math.floor(S(3.2)) * 3, z, 0, 'white'); }
  }
  if (species === 'sabretooth' || species === 'trex' || species === 'raptor') {
    const tx = hx + 1;
    for (const z of [Math.floor(cz) - 1, Math.floor(cz)]) {
      for (let y = 30; y >= 0; y--) if (b.occ.at(tx, y, z)) { /* find underside */
        let yb = y; while (yb > 0 && b.occ.at(tx, yb - 1, z)) yb--;
        if (yb >= 2) b.add('spike_1x1', tx, yb - 2, z, 0, 'white');
        break;
      }
    }
  }
  if (species === 'pterosaur') {
    const wy = Math.floor(S(4)) * 3 + 2;
    const span = Math.round(S(7));
    b.fillMask(wy, Math.floor(S(4)), Math.floor(cz) - span - 1, Math.round(S(4)), span * 2 + 2, (x, z) => {
      const d = Math.abs(z + 0.5 - cz);
      return d > S(1.2) && x < S(4) + S(4) - d * 0.35;
    }, (x, z) => (Math.abs(z + 0.5 - cz) > span - 1 ? accent : skin), 'plate');
  }
  return { style: species, main: skin };
}

// ===================================================================== ANIMALS
const ANIMAL_LIST = ['cat', 'dog', 'elephant', 'giraffe', 'penguin', 'owl', 'fish', 'turtle', 'rabbit', 'bear', 'horse', 'frog', 'pig', 'duck', 'lion', 'whale', 'cow', 'fox', 'panda', 'parrot', 'snail', 'flamingo', 'crab', 'koala'];
export const ANIMALS = ANIMAL_LIST;

export function genAnimal(b, rng, o = {}) {
  const kind = o.kind || rng.pick(ANIMAL_LIST);
  const s = o.scale || 1;
  const S = v => v * s;
  const sh = [];
  const cz = S(3);
  const four = (fx, bx, h, wide, c) => { for (const x of [fx, bx]) for (const z of [cz - wide, cz + wide - S(1.2)]) sh.push(BOX(x, 0, z, S(1.2), h, S(1.2), c)); };
  let eyes = null, extra = () => {};
  const coat = o.coat;
  switch (kind) {
    case 'cat': case 'fox': case 'dog': case 'lion': {
      const c = coat || ({ cat: rng.pick(['orange', 'dgray', 'white', 'black', 'tan']), fox: 'orange', dog: rng.pick(['brown', 'tan', 'white', 'black', 'gold']), lion: 'gold' })[kind];
      const bel = kind === 'fox' ? 'white' : kind === 'lion' ? 'tan' : c === 'white' ? 'lgray' : 'white';
      four(S(1.2), S(5.5), S(2), S(1.4), c);
      sh.push(E(S(4), S(2.7), cz, S(3.4), S(1.1), S(1.6), (x, l, z) => (l < S(2.2) ? bel : c)));
      if (kind === 'lion') sh.push(E(S(7.4), S(3.8), cz, S(1.7), S(1.8), S(2.1), 'brown'));
      sh.push(E(S(8), S(4), cz, S(1.4), S(1.2), S(1.4), c));
      sh.push(E(S(9.3), S(3.6), cz, S(0.8), S(0.6), S(0.8), kind === 'dog' ? 'black' : bel));
      for (const z of [cz - S(0.9), cz + S(0.9)]) sh.push(E(S(7.8), S(5.2), z, S(0.5), S(kind === 'dog' ? 0.5 : 0.8), S(0.5), kind === 'dog' ? 'brown' : c));
      for (let i = 0; i < 4; i++) sh.push(E(S(0.4 - i * 0.6), S(3.2 + i * (kind === 'dog' ? 0.4 : 0.6)), cz, S(0.6), S(0.6), S(kind === 'fox' ? 0.9 : 0.5), kind === 'fox' && i === 3 ? 'white' : c));
      eyes = [S(8.6), S(4.4)];
      break;
    }
    case 'bear': case 'panda': case 'koala': {
      const c = coat || (kind === 'panda' ? 'white' : kind === 'koala' ? 'lgray' : rng.pick(['brown', 'black', 'white', 'tan']));
      const dark = kind === 'panda' ? 'black' : c === 'black' ? 'dgray' : 'brown';
      four(S(1.5), S(5.5), S(2), S(1.8), kind === 'panda' ? 'black' : c);
      sh.push(E(S(4), S(3), cz, S(3.6), S(1.6), S(2.2), (x, l, z) => (kind === 'panda' && x > S(5) ? 'black' : c)));
      sh.push(E(S(8), S(4.5), cz, S(1.8), S(1.6), S(1.8), c));
      sh.push(E(S(9.6), S(4), cz, S(0.7), S(0.6), S(0.8), dark));
      for (const z of [cz - S(1.4), cz + S(1.4)]) sh.push(E(S(7.6), S(6), z, S(0.6), S(0.6), S(0.6), kind === 'koala' ? 'white' : dark));
      eyes = [S(8.8), S(5.2)];
      break;
    }
    case 'elephant': {
      const c = coat || rng.pick(['lgray', 'dgray', 'azure', 'pink']);
      four(S(1.5), S(6), S(3), S(2), c);
      sh.push(E(S(4.5), S(4.4), cz, S(4), S(2), S(2.4), c));
      sh.push(E(S(9), S(5.4), cz, S(1.8), S(1.8), S(1.8), c));
      for (let i = 0; i < 5; i++) sh.push(E(S(10.6 + i * 0.2), S(4.4 - i * 0.9), cz, S(0.6), S(0.6), S(0.6), c));
      for (const z of [cz - S(2.2), cz + S(2.2)]) sh.push(E(S(8.6), S(5.6), z, S(0.6), S(1.6), S(1), c));
      eyes = [S(9.8), S(6.2)];
      extra = () => { for (const z of [Math.floor(cz) - 2, Math.floor(cz) + 1]) b.add('spike_1x1', Math.floor(S(10.5)), Math.max(0, Math.floor(S(3.4)) * 3 - 2), z, 0, 'white'); };
      break;
    }
    case 'giraffe': case 'horse': case 'cow': {
      const c = coat || ({ giraffe: 'yellow', horse: rng.pick(['brown', 'white', 'black', 'tan']), cow: 'white' })[kind];
      const spot = kind === 'giraffe' ? 'brown' : kind === 'cow' ? 'black' : c;
      const legH = kind === 'giraffe' ? S(4) : S(3);
      four(S(1.3), S(6), legH, S(1.5), kind === 'horse' ? c : c);
      sh.push(E(S(4.2), legH + S(1.2), cz, S(3.6), S(1.3), S(1.8), (x, l, z) => ((Math.floor(x / 2) + Math.floor(z / 2) + l) % 3 === 0 ? spot : c)));
      const nl = kind === 'giraffe' ? 7 : kind === 'horse' ? 3 : 1;
      for (let i = 0; i < nl; i++) sh.push(E(S(7.4 + i * 0.25), legH + S(2 + i * 0.9), cz, S(0.8), S(0.7), S(0.8), kind === 'horse' && i > 0 ? c : c));
      const hy = legH + S(2 + nl * 0.9);
      sh.push(E(S(8.8), hy, cz, S(1.6), S(0.8), S(0.9), c));
      if (kind === 'horse') for (let i = 0; i < nl + 1; i++) sh.push(BOX(S(6.8 + i * 0.25), legH + S(2.3 + i * 0.9), cz - 0.5, 1, 1, 1, 'black'));
      if (kind === 'cow') sh.push(E(S(9.8), hy - S(0.2), cz, S(0.6), S(0.5), S(0.8), 'pink'));
      for (let i = 0; i < 3; i++) sh.push(E(S(0.5 - i * 0.4), legH + S(1 - i * 0.6), cz, S(0.4), S(0.6), S(0.4), kind === 'horse' ? 'black' : c));
      eyes = [S(9), hy + S(0.4)];
      extra = () => { if (kind !== 'horse') for (const z of [Math.floor(cz) - 1, Math.floor(cz)]) { const x = Math.floor(S(8.2)); b.add(kind === 'cow' ? 'spike_1x1' : 'round_1x1', x, topAt(b, x, z), z, 0, kind === 'cow' ? 'white' : 'brown'); } };
      break;
    }
    case 'penguin': case 'owl': case 'parrot': case 'duck': case 'flamingo': {
      const c = coat || ({ penguin: 'black', owl: rng.pick(['brown', 'tan', 'white']), parrot: rng.pick(['red', 'green', 'blue', 'azure']), duck: rng.pick(['yellow', 'white']), flamingo: 'pink' })[kind];
      const front = kind === 'penguin' ? 'white' : kind === 'owl' ? 'tan' : kind === 'parrot' ? 'yellow' : c;
      if (kind === 'flamingo') { sh.push(BOX(S(3), 0, cz - 0.5, 1, S(4), 1, 'pink')); }
      const by = kind === 'flamingo' ? S(5) : kind === 'duck' ? S(1.6) : S(2.6);
      if (kind === 'duck') {
        sh.push(E(S(3.5), by, cz, S(3), S(1.6), S(2), c));
        sh.push(E(S(5.8), by + S(2), cz, S(1.4), S(1.4), S(1.4), c));
        sh.push(BOX(S(7), by + S(1.6), cz - S(1), S(1.4), S(0.6), S(2), 'orange'));
        eyes = [S(6.2), by + S(2.6)];
      } else if (kind === 'flamingo') {
        sh.push(E(S(3.5), by, cz, S(2.4), S(1.2), S(1.5), c));
        for (let i = 0; i < 4; i++) sh.push(E(S(5.2 + i * 0.1), by + S(1 + i * 0.8), cz, S(0.5), S(0.6), S(0.5), c));
        sh.push(E(S(5.8), by + S(4.4), cz, S(0.9), S(0.6), S(0.6), c));
        sh.push(BOX(S(6.4), by + S(3.6), cz - 0.5, 1, 1, 1, 'black'));
        eyes = [S(5.6), by + S(4.8)];
      } else {
        sh.push(E(S(3), by, cz, S(2.2), S(2.4), S(2), (x, l, z) => (x >= S(3.6) ? front : c)));
        if (kind === 'owl') for (const z of [cz - S(1), cz + S(1)]) sh.push(E(S(3), by + S(2.6), z, S(0.5), S(0.5), S(0.5), c));
        sh.push(BOX(S(5), by + S(0.8), cz - 0.5, 1, 1, 1, kind === 'penguin' ? 'orange' : kind === 'owl' ? 'yellow' : 'dgray'));
        for (const z of [cz - S(1.4), cz + S(1.4) - 1]) sh.push(BOX(S(3), 0, z, S(1.2), S(0.6), 1, kind === 'penguin' ? 'orange' : 'dgray'));
        if (kind === 'parrot') for (let i = 0; i < 3; i++) sh.push(E(S(0.8 - i * 0.6), by - S(1 + i * 0.6), cz, S(0.5), S(0.7), S(0.4), i === 2 ? 'blue' : c));
        eyes = [S(4.4), by + S(1.6)];
      }
      break;
    }
    case 'fish': case 'whale': {
      const c = coat || (kind === 'whale' ? rng.pick(['blue', 'navy', 'dgray']) : rng.pick(['orange', 'yellow', 'azure', 'teal', 'red', 'purple']));
      const st = kind === 'whale' ? S(2) : S(2);
      sh.push(BOX(S(4), 0, cz - 1, 2, st, 2, 'dgray'));
      const L = kind === 'whale' ? S(5) : S(3.2);
      sh.push(E(S(5), st + S(1.8), cz, L, S(1.6), S(1.5), (x, l, z) => (l < st + S(1.3) ? 'white' : (kind === 'fish' && (x % 3 === 0) ? 'white' : c))));
      for (let i = 0; i < 2; i++) sh.push(E(S(5) - L - S(0.6 + i * 0.6), st + S(1.8), cz, S(0.5), S(0.7 + i * 0.7), S(0.4), c));
      sh.push(BOX(S(4.5), st + S(3.2), cz - 0.5, S(1.5), S(kind === 'whale' ? 0.6 : 1), 1, c));
      eyes = [S(5) + L - S(1.2), st + S(2.6)];
      break;
    }
    case 'turtle': case 'snail': case 'crab': case 'frog': case 'rabbit': case 'pig': {
      const c = coat || ({ turtle: 'green', snail: 'tan', crab: 'red', frog: rng.pick(['green', 'lime']), rabbit: rng.pick(['white', 'tan', 'lgray']), pig: 'pink' })[kind];
      const shell = kind === 'turtle' ? rng.pick(['brown', 'dgreen', 'teal']) : kind === 'snail' ? rng.pick(['orange', 'purple', 'brown', 'azure']) : c;
      if (kind === 'turtle') {
        four(S(1.5), S(5), S(1), S(2.4), c);
        sh.push(E(S(4), S(1.6), cz, S(3.2), S(1.6), S(2.6), (x, l, z) => ((x + z) % 3 === 0 ? 'tan' : shell)));
        sh.push(E(S(8), S(1.6), cz, S(1.2), S(0.8), S(1), c));
        eyes = [S(8.4), S(2)];
      } else if (kind === 'snail') {
        sh.push(E(S(4), S(0.6), cz, S(4), S(0.6), S(1), c));
        sh.push(E(S(3.4), S(2.4), cz, S(2.2), S(2.2), S(1.1), (x, l, z) => ((x + l) % 2 ? shell : 'white')));
        sh.push(E(S(7.4), S(1.6), cz, S(0.6), S(1.2), S(0.6), c));
        eyes = [S(7.2), S(2.8)];
      } else if (kind === 'crab') {
        sh.push(E(S(4), S(1.6), cz, S(2.2), S(0.9), S(3), c));
        for (const z of [cz - S(3.2), cz + S(3.2) - 1]) { sh.push(BOX(S(3), 0, z, 1, S(1.2), 1, c)); sh.push(BOX(S(5), 0, z, 1, S(1.2), 1, c)); sh.push(E(S(7), S(1.6), z + 0.5, S(1), S(0.7), S(0.7), c)); }
        eyes = [S(5.6), S(2.4)];
      } else if (kind === 'frog') {
        sh.push(E(S(3.5), S(1.4), cz, S(2.8), S(1.4), S(2.2), (x, l, z) => (l === 0 ? 'lime' : c)));
        for (const z of [cz - S(1.4), cz + S(1.4)]) sh.push(E(S(4.6), S(2.8), z, S(0.7), S(0.7), S(0.7), c));
        for (const z of [cz - S(2.4), cz + S(2.4) - 1]) sh.push(BOX(S(1), 0, z, S(1.6), 1, 1, c));
        eyes = [S(4.6), S(3.2)];
      } else if (kind === 'rabbit') {
        sh.push(E(S(3.2), S(1.8), cz, S(2.4), S(1.8), S(1.8), c));
        sh.push(E(S(5.6), S(3.2), cz, S(1.3), S(1.2), S(1.2), c));
        for (const z of [cz - S(0.6), cz + S(0.6)]) sh.push(E(S(5.2), S(5.2), z, S(0.4), S(1.4), S(0.4), c));
        sh.push(E(S(0.8), S(2), cz, S(0.6), S(0.6), S(0.6), 'white'));
        eyes = [S(6.2), S(3.6)];
      } else {
        four(S(1.5), S(5), S(1.4), S(1.6), c);
        sh.push(E(S(3.8), S(2.6), cz, S(3.4), S(1.4), S(2), c));
        sh.push(E(S(7.6), S(2.8), cz, S(1), S(0.8), S(1), c));
        sh.push(BOX(S(8.4), S(2.4), cz - 1, 1, 1, 2, 'dred'));
        eyes = [S(7.4), S(3.4)];
      }
      break;
    }
  }
  sculpt(b, sh);
  if (eyes) {
    const ex = Math.floor(eyes[0]);
    for (const z of [Math.floor(cz) - 1, Math.floor(cz) + (s > 1 ? 1 : 0)]) { const y = topAt(b, ex, z); if (y > 0) b.add('eye_1x1', ex, y, z, 0, 'black'); }
  }
  extra();
  // little species details that make similar body shapes read differently
  const hx = eyes ? Math.floor(eyes[0]) : 0;
  const cz0 = Math.floor(cz);
  if (kind === 'cat' || kind === 'fox' || kind === 'lion') for (const z of [cz0 - 1, cz0 + (s > 1 ? 1 : 0)]) { const x = hx - 1; b.add(kind === 'lion' ? 'round_plate_1x1' : 'spike_1x1', x, topAt(b, x, z), z, 0, kind === 'lion' ? 'brown' : sh[sh.length - 1].c === 'white' ? 'orange' : (typeof sh[1].c === 'string' ? sh[1].c : 'orange')); }
  if (kind === 'dog') { for (const z of [cz0 - 1, cz0 + (s > 1 ? 1 : 0)]) b.add('slope_curve_1x2', hx - 2, topAt(b, hx - 2, z), z, 3, 'brown'); }
  if (kind === 'owl') for (const z of [cz0 - 1, cz0 + 1]) b.add('cone_1x1', hx - 1, topAt(b, hx - 1, z), z, 0, 'brown');
  if (kind === 'penguin') b.add('round_plate_1x1', hx - 1, topAt(b, hx - 1, cz0), cz0, 0, 'yellow');
  if (kind === 'rabbit') b.add('round_plate_1x1', hx, topAt(b, hx, cz0), cz0, 0, 'pink');
  if (kind === 'whale') b.add('antenna_1x1', hx - 2, topAt(b, hx - 2, cz0), cz0, 0, 'tblue');
  if (kind === 'fish') b.add('round_plate_1x1', hx - 1, topAt(b, hx - 1, cz0), cz0, 0, 'white');
  if (o.flowers) for (let i = 0; i < 4; i++) b.add('flower_1x1', -2 - i, 0, i * 2 - 1, 0, rng.pick(['red', 'yellow', 'pink', 'white']));
  return { style: kind, main: sh[0] ? (typeof sh[0].c === 'string' ? sh[0].c : 'tan') : 'tan' };
}

/** A handful of tiny standalone builds for beginner sets. */
export function genMini(b, rng, o = {}) {
  const kind = o.kind || rng.pick(['tree', 'flowerbed', 'snowman', 'mushroom', 'cactus', 'lamp', 'bench', 'mailbox', 'campfire', 'palm']);
  switch (kind) {
    case 'tree': case 'palm': {
      const h = rng.int(2, 4);
      b.fill(0, 0, 0, 4, 4, 'green', 'plate');
      for (let l = 0; l < h; l++) b.add(kind === 'palm' ? 'round_1x1' : 'brick_1x1', 1, 1 + l * 3, 1, 0, 'brown');
      const top = 1 + h * 3;
      if (kind === 'palm') {
        for (const [x, z, w, d] of [[-1, 1, 5, 1], [1, -1, 1, 5]]) b.fill(top + (w > 1 ? 0 : 1), x, z, w, d, 'lime', 'plate');
        b.add('round_plate_1x1', 1, top + 2, 1, 0, 'brown');
      } else {
        b.fill(top, -1, -1, 5, 5, rng.pick(['green', 'dgreen', 'lime']), 'brick');
        b.fill(top + 3, 0, 0, 3, 3, rng.pick(['green', 'dgreen', 'lime']), 'brick');
        b.add('round_1x1', 1, top + 6, 1, 0, 'green');
        if (rng.chance(0.5)) { b.add('round_plate_1x1', -1, top + 3, 2, 0, 'red'); b.add('round_plate_1x1', 3, top + 3, 0, 0, 'red'); }
      }
      break;
    }
    case 'flowerbed': {
      b.fill(0, 0, 0, 6, 4, 'brown', 'brick');
      b.walls(0, -1, -1, 8, 6, 1, 'tan');
      for (let x = 0; x < 6; x++) for (let z = 0; z < 4; z++) if ((x + z) % 2 === 0) b.add('flower_1x1', x, 3, z, 0, rng.pick(['red', 'yellow', 'pink', 'white', 'purple', 'orange']));
      b.fill(3, 0, 0, 6, 4, 'green', 'plate');
      break;
    }
    case 'snowman': {
      b.fill(0, 0, 0, 4, 4, 'white', 'plate');
      b.voxel(1, 0, 0, 4, 2, 4, (x, l, z) => ((x === 0 || x === 3) && (z === 0 || z === 3) ? null : 'white'));
      b.fill(7, 1, 1, 2, 2, 'white', 'brick');
      b.fill(10, 1, 1, 2, 2, 'black', 'plate');
      b.add('round_2x2', 1, 11, 1, 0, 'black');
      b.add('eye_1x1', 2, 10, 1, 0, 'black');
      b.add('cone_1x1', 3, 7, 1, 0, 'orange');
      b.add('plate_1x4', 0, 6, 0, 1, 'red');
      break;
    }
    case 'mushroom': {
      b.add('round_2x2', 1, 0, 1, 0, 'white'); b.add('round_2x2', 1, 3, 1, 0, 'white');
      b.voxel(6, -1, -1, 6, 1, 6, (x, l, z) => ((x === -1 || x === 4) && (z === -1 || z === 4) ? null : 'red'));
      b.fill(9, 0, 0, 4, 4, 'red', 'plate');
      for (const [x, z] of [[0, 0], [3, 1], [1, 3], [2, 2]]) b.add('round_plate_1x1', x, 10, z, 0, 'white');
      break;
    }
    case 'cactus': {
      b.fill(0, 0, 0, 4, 4, 'tan', 'plate');
      for (let l = 0; l < 4; l++) b.add('brick_1x1', 1, 1 + l * 3, 1, 0, 'green');
      b.add('brick_1x1', 0, 4, 1, 0, 'green'); b.add('brick_1x1', -1, 4, 1, 0, 'green'); b.add('brick_1x1', -1, 7, 1, 0, 'green');
      b.add('brick_1x1', 2, 7, 1, 0, 'green'); b.add('brick_1x1', 3, 7, 1, 0, 'green'); b.add('brick_1x1', 3, 10, 1, 0, 'green');
      b.add('flower_1x1', 1, 13, 1, 0, 'pink');
      break;
    }
    case 'lamp': case 'mailbox': {
      b.fill(0, -1, -1, 4, 4, 'lgray', 'plate');
      b.add('brick_2x2', 0, 1, 0, 0, 'dgray');
      for (let l = 0; l < 4; l++) b.add('round_1x1', 0, 4 + l * 3, 0, 0, kind === 'lamp' ? 'black' : 'brown');
      if (kind === 'lamp') {
        b.add('plate_2x2', 0, 16, 0, 0, 'black');
        b.add('brick_1x1', 0, 17, 0, 0, 'tyellow'); b.add('brick_1x1', 1, 17, 1, 0, 'tyellow');
        b.add('plate_2x2', 0, 20, 0, 0, 'black'); b.add('cone_1x1', 0, 21, 0, 0, 'black');
      } else { b.fill(16, 0, -1, 2, 3, 'blue', 'brick'); b.fill(19, 0, -1, 2, 3, 'blue', 'plate'); b.add('tile_1x2', 0, 20, 0, 1, 'red'); b.add('flower_1x1', 2, 1, 2, 0, 'red'); }
      break;
    }
    case 'bench': {
      b.fill(0, -1, -1, 8, 4, 'green', 'plate');
      b.add('brick_1x2', 0, 1, 0, 0, 'dgray'); b.add('brick_1x2', 5, 1, 0, 0, 'dgray');
      b.add('plate_2x6', 0, 4, 0, 1, 'brown');
      b.add('brick_1x1', 0, 5, 1, 0, 'dgray'); b.add('brick_1x1', 5, 5, 1, 0, 'dgray');
      b.add('brick_1x6', 0, 8, 1, 1, 'brown');
      b.add('flower_1x1', 6, 1, 2, 0, 'yellow'); b.add('flower_1x1', -1, 1, 2, 0, 'pink');
      break;
    }
    case 'birdhouse': {
      b.fill(0, 0, 0, 4, 4, 'green', 'plate');
      for (let l = 0; l < 4; l++) b.add('brick_1x1', 1, 1 + l * 3, 1, 0, 'brown');
      b.fill(13, 0, 0, 3, 3, 'tan', 'plate');
      b.walls(14, 0, 0, 3, 3, 1, 'red', (x, y, z) => x === 1 && z === 2);
      b.add('round_plate_1x1', 1, 14, 2, 0, 'black');
      b.fill(17, -1, -1, 5, 5, 'dgray', 'plate');
      b.add('slope_2x2', 0, 18, -1, 2, 'dgray'); b.add('slope_2x2', 0, 18, 2, 0, 'dgray');
      break;
    }
    case 'well': {
      b.fill(0, -1, -1, 6, 6, 'green', 'plate');
      b.walls(1, 0, 0, 4, 4, 2, 'lgray');
      b.fill(1, 1, 1, 2, 2, 'tblue', 'plate');
      b.add('round_1x1', 0, 7, 0, 0, 'brown'); b.add('round_1x1', 3, 7, 3, 0, 'brown');
      b.add('round_1x1', 0, 10, 0, 0, 'brown'); b.add('round_1x1', 3, 10, 3, 0, 'brown');
      b.fill(13, -1, -1, 6, 6, 'dred', 'plate');
      b.add('slope_4x2', -1, 14, -1, 2, 'dred'); b.add('slope_4x2', -1, 14, 3, 0, 'dred');
      break;
    }
    case 'tent': {
      b.fill(0, -1, -1, 8, 7, 'green', 'plate');
      b.add('slope_4x2', 0, 1, 0, 2, 'orange'); b.add('slope_4x2', 0, 1, 2, 0, 'orange');
      b.add('slope_curve_2x2', 0, 4, 1, 2, 'orange');
      b.add('slope_curve_2x2', 2, 4, 1, 2, 'orange');
      b.add('plate_1x3', 5, 1, 4, 1, 'brown'); b.add('cone_1x1', 5, 2, 5, 0, 'tyellow');
      break;
    }
    case 'signpost': {
      b.fill(0, 0, 0, 3, 3, 'tan', 'plate');
      for (let l = 0; l < 5; l++) b.add('round_1x1', 1, 1 + l * 3, 1, 0, 'brown');
      b.add('brick_1x4', -1, 10, 1, 1, 'white'); b.add('slope_1x2', 3, 10, 1, 1, 'white');
      b.add('brick_1x3', 0, 13, 2, 0, 'yellow');
      b.add('tile_1x2', -1, 13, 1, 1, 'red');
      break;
    }
    case 'pumpkin': {
      b.fill(0, -1, -1, 6, 6, 'brown', 'plate');
      b.voxel(1, 0, 0, 4, 2, 4, (x, l, z) => ((x === 0 || x === 3) && (z === 0 || z === 3) ? null : 'orange'));
      b.add('round_1x1', 1, 7, 1, 0, 'dgreen'); b.add('eye_1x1', 1, 7, 2, 0, 'black'); b.add('eye_1x1', 2, 7, 2, 0, 'black');
      break;
    }
    case 'gokart': {
      b.add('wheel_small', 0, 0, -1, 1, 'lgray'); b.add('wheel_small', 0, 0, 4, 1, 'lgray');
      b.add('wheel_small', 5, 0, -1, 1, 'lgray'); b.add('wheel_small', 5, 0, 4, 1, 'lgray');
      b.fill(1, 0, 0, 7, 4, 'dgray', 'plate');
      b.add('brick_1x2', 1, 2, 1, 0, 'black'); b.add('tile_1x2', 3, 2, 1, 0, 'red');
      b.add('slope_2x2', 5, 2, 1, 1, 'red'); b.add('round_plate_1x1', 4, 2, 2, 0, 'black');
      b.add('round_1x1', 2, 2, 3, 0, 'yellow');
      break;
    }
    case 'campfire': {
      b.fill(0, 0, 0, 4, 4, 'dgray', 'plate');
      for (const [x, z] of [[0, 1], [3, 2], [1, 0], [2, 3]]) b.add('round_plate_1x1', x, 1, z, 0, 'lgray');
      b.add('plate_1x3', 1, 1, 1, 1, 'brown'); b.add('plate_1x3', 1, 2, 1, 0, 'brown');
      b.add('cone_1x1', 1, 3, 1, 0, 'tyellow');
      b.add('cone_1x1', 2, 2, 2, 0, 'tred');
      break;
    }
  }
  return { style: kind, main: 'green' };
}
