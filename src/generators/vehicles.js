// generators/vehicles.js — cars, motorcycles, trucks & construction, trains.
// Convention: vehicles point toward +X. Slope rotation r=1 slopes down toward +X,
// r=3 slopes down toward -X. Wheels use r=1 so their axle runs along Z.

const CAR_COLORS = ['red', 'blue', 'yellow', 'white', 'black', 'orange', 'lime', 'azure', 'green', 'dred', 'navy', 'purple', 'teal', 'pink', 'lgray', 'gold'];
const accentFor = (rng, main) => rng.pick(['white', 'black', 'dgray', 'yellow', 'red', 'lgray'].filter(c => c !== main));

/** Pair of wheels on an axle at x, for a body that spans z 0..W-1. */
function axle(b, x, W, big, rim, y = 0) {
  const t = big ? 'wheel_large' : 'wheel_small';
  const span = big ? 3 : 2;
  b.add(t, x, y, -1, 1, rim);
  b.add(t, x, y, W, 1, rim);
  return span;
}

// ===================================================================== CARS
export const CAR_STYLES = ['sedan', 'coupe', 'supercar', 'convertible', 'suv', 'racer', 'van', 'classic', 'hatch', 'muscle', 'police', 'taxi', 'ambulance', 'pickup', 'limo', 'monster', 'buggy', 'rally', 'hyper', 'drag'];
const BASE_KIND = { muscle: 'coupe', police: 'sedan', taxi: 'sedan', ambulance: 'van', limo: 'sedan', rally: 'hatch', hyper: 'supercar' };
const STYLE_COLORS = { police: ['white', 'black', 'navy'], taxi: ['yellow'], ambulance: ['white'], limo: ['black', 'white', 'dgray'], muscle: ['orange', 'red', 'yellow', 'black', 'blue', 'lime'], hyper: ['lime', 'orange', 'azure', 'white', 'red', 'purple'] };

export function genCar(b, rng, o = {}) {
  const style = o.style || rng.pick(CAR_STYLES);
  if (style === 'pickup' || style === 'monster') return genPickup(b, rng, { ...o, style });
  if (style === 'buggy') return genBuggy(b, rng, o);
  if (style === 'drag') return genDragster(b, rng, o);
  const kind = BASE_KIND[style] || style;
  const main = o.color || rng.pick(STYLE_COLORS[style] || CAR_COLORS);
  if (style === 'limo') o = { ...o, L: o.L || rng.int(17, 19), W: 6 };
  if (style === 'police' || style === 'taxi') o = { ...o, W: 6, L: o.L || rng.int(12, 13) };
  if (style === 'muscle') o = { ...o, W: 6, L: o.L || rng.int(12, 13), stripe: true, spoiler: rng.chance(0.5) };
  if (style === 'hyper') o = { ...o, W: 6, L: o.L || rng.int(14, 15), spoiler: true, stripe: rng.chance(0.5) };
  if (style === 'rally') o = { ...o, W: 6, stripe: true, spoiler: true };
  const acc = o.accent || accentFor(rng, main);
  const rim = rng.pick(['lgray', 'dgray', 'gold', 'white', 'black']);
  const big = kind === 'suv' || (o.big ?? false);
  let W = o.W || (kind === 'racer' ? 4 : rng.pick([4, 4, 6]));
  if (kind === 'suv' || kind === 'van') W = o.W || 6;
  let L = o.L || ({ sedan: rng.int(10, 13), coupe: rng.int(9, 11), supercar: rng.int(11, 14), convertible: rng.int(9, 12), suv: rng.int(11, 13), racer: rng.int(12, 15), van: rng.int(11, 13), classic: rng.int(10, 12), hatch: rng.int(8, 10) })[kind];
  const span = big ? 3 : 2;
  const wy = 0;
  const chassisY = big ? 2 : 1;
  const rearAx = 1, frontAx = L - span - 1;
  axle(b, rearAx, W, big, rim, wy);
  axle(b, frontAx, W, big, rim, wy);
  if (o.sixWheel || (kind === 'racer' && false)) axle(b, rearAx + span + 1, W, big, rim, wy);

  // chassis
  if (big) b.fill(1, 0, 0, L, W, 'dgray', 'plate');
  for (const ax of [rearAx, frontAx]) {
    if (W === 4) b.add('axle_plate_2x4', ax, chassisY, 0, 1, 'dgray');
  }
  b.fill(chassisY, 0, 0, L, W, 'dgray', 'plate');
  const y1 = chassisY + 1;

  if (kind === 'racer') {
    // open-wheel racer: narrow centre tub, wings front and back
    b.fill(y1, 1, 1, L - 2, 2, main, 'brick');
    b.fill(y1, 0, 0, 1, W, acc, 'brick');
    b.add('plate_1x4', L - 1, y1, 0, 0, acc);
    b.add('slope_2x2', L - 3, y1 + 3, 1, 1, main);
    b.add('slope_1x2', L - 4, y1 + 3, 1, 1, main);
    b.add('slope_1x2', L - 4, y1 + 3, 2, 1, main);
    b.add('brick_1x2', 3, y1 + 3, 1, 0, main);
    b.add('round_1x1', 5, y1 + 3, 1, 0, rng.pick(['white', 'yellow', 'azure', 'red']));
    b.add('cone_1x1', 5, y1 + 6, 1, 0, 'tclear');
    b.add('tile_1x2', 4, y1 + 3, 1, 1, 'black');
    b.add('round_1x1', 0, y1 + 3, 0, 0, 'black');
    b.add('round_1x1', 0, y1 + 3, 3, 0, 'black');
    b.add('plate_2x4', 0, y1 + 6, 0, 0, acc);
    b.add('light_1x1', 1, y1 + 3, 1, 0, 'tred');
    b.add('light_1x1', 1, y1 + 3, 2, 0, 'tred');
    return { style, main };
  }

  // lower body; the front and back rows are the bumpers, built into the body so nothing sticks out
  const bump = kind === 'suv' || kind === 'van' ? 'black' : rng.pick(['lgray', 'dgray', 'black', 'lgray']);
  b.fill(y1, 1, 0, L - 2, W, main, 'brick');
  b.fill(y1, 0, 0, 1, W, bump, 'brick'); b.fill(y1, L - 1, 0, 1, W, bump, 'brick');
  let y2 = y1 + 3;
  if (kind === 'suv' || kind === 'van') {
    b.fillMask(y2, 0, 0, L, W, (x, z) => !(x === L - 1), main, 'brick');
    y2 += 3;
  }

  // front: headlights + grille on the nose
  const nose = L - 1;
  // tall vans/SUVs have a step at the nose, so the lights sit on the lower body there
  const lightY = kind === 'suv' || kind === 'van' ? y2 - 3 : y2;
  b.add('light_1x1', nose, lightY, 0, 0, 'tyellow');
  b.add('light_1x1', nose, lightY, W - 1, 0, 'tyellow');
  for (let z = 1; z < W - 1; z += 2) b.add('grille_1x2', nose, lightY, z, 0, 'lgray');

  const hoodLen = { sedan: 3, coupe: 3, supercar: 4, convertible: 3, suv: 2, van: 1, classic: 3, hatch: 2 }[kind];
  const trunkLen = { sedan: 2, coupe: 2, supercar: 2, convertible: 2, suv: 1, van: 0, classic: 3, hatch: 1 }[kind];
  // hood slopes toward the front
  const hoodX = nose - hoodLen;
  if (kind === 'classic') {
    for (let z = 0; z < W; z += 2) b.add('slope_curve_2x2', nose - 2, y2, z, 1, main);
    b.fill(y2, hoodX, 0, nose - 2 - hoodX, W, main, 'plate');
  } else if (kind === 'supercar') {
    for (let z = 0; z < W; z += 2) b.add('slope_2x3', hoodX, y2, z, 1, main);
    b.fill(y2, hoodX + 3, 0, 1, W, main, 'plate');
    b.fillMask(y2, hoodX + 3, 0, 1, W, (x, z) => z > 0 && z < W - 1, main, 'tile');
  } else if (hoodLen >= 2) {
    for (let z = 0; z < W; z += 2) b.add('slope_2x2', nose - 2, y2, z, 1, main);
    if (hoodLen > 2) b.fill(y2, hoodX, 0, hoodLen - 2, W, main, 'plate');
  } else if (hoodLen === 1) {
    b.fill(y2, hoodX, 0, 1, W, main, 'plate');
  }
  if (o.stripe) b.fillMask(y2 + 1, hoodX, 0, nose - hoodX, W, (x, z) => z === Math.floor(W / 2) - 1 || z === Math.floor(W / 2), acc, 'tile');

  // cabin
  const cabEnd = hoodX;              // x where windscreen starts (exclusive end of cabin)
  const cabStart = trunkLen;
  const wsX = cabEnd - 2;
  const glass = o.glass || 'tclear';
  const sideGlass = kind === 'van' ? glass : glass;
  if (W === 4) b.add('windscreen_2x4', wsX, y2, 0, 1, glass);
  else { b.add('windscreen_2x4', wsX, y2, 1, 1, glass); b.add('brick_1x2', wsX, y2, 0, 1, main); b.add('brick_1x2', wsX, y2, 5, 1, main); }

  if (kind === 'convertible') {
    // open top: seats and a steering wheel
    b.add('brick_1x2', cabStart + 1, y2, 1, 0, acc);
    if (W === 6) b.add('brick_1x2', cabStart + 1, y2, 3, 0, acc);
    b.fillMask(y2, cabStart, 0, wsX - cabStart, W, (x, z) => z === 0 || z === W - 1, main, 'brick');
    b.add('round_plate_1x1', wsX - 1, y2, 1, 0, 'black');
    b.fill(y2, cabStart, 0, wsX - cabStart, W, 'black', 'plate');
  } else {
    const tall = kind === 'suv' || kind === 'van' ? 1 : 1;
    for (let l = 0; l < tall; l++) {
      const yy = y2 + l * 3;
      b.fillMask(yy, cabStart, 0, wsX - cabStart, W, (x, z) => (z === 0 || z === W - 1), (x) => (x === cabStart ? main : sideGlass), 'brick');
      b.fillMask(yy, cabStart, 0, wsX - cabStart, W, (x, z) => x === cabStart, main, 'brick');
    }
    const roofY = y2 + 3 * tall;
    b.fill(roofY, cabStart, 0, wsX - cabStart + 2, W, kind === 'coupe' || kind === 'supercar' ? main : (rng.chance(0.3) ? acc : main), 'plate');
    if (kind === 'suv' && rng.chance(0.6)) {
      b.add('plate_1x4', cabStart + 1, roofY + 1, 0, 1, 'black');
      b.add('plate_1x4', cabStart + 1, roofY + 1, W - 1, 1, 'black');
    }
    if (kind === 'van') b.add('light_1x1', cabStart + 2, roofY + 1, 2, 0, rng.pick(['tblue', 'tyellow', 'tclear']));
    if (kind === 'coupe' || kind === 'supercar') b.fillMask(roofY + 1, cabStart, 0, wsX - cabStart + 2, W, (x, z) => z > 0 && z < W - 1, o.stripe ? acc : main, 'tile');
  }
  // trunk
  if (trunkLen > 0) {
    if (kind === 'supercar' || kind === 'coupe') {
      for (let z = 0; z < W; z += 2) b.add('slope_curve_2x2', 0, y2, z, 3, main);
    } else {
      b.fill(y2, 0, 0, trunkLen, W, main, 'plate');
    }
  }
  // spoiler
  const curvedTail = trunkLen > 0 && (kind === 'supercar' || kind === 'coupe');
  const tailY = curvedTail ? y2 + 2 : y2 + (trunkLen > 0 ? 1 : 0);
  const spoiler = o.spoiler ?? (kind === 'supercar' || (kind === 'coupe' && rng.chance(0.5)) || (kind === 'hatch' && rng.chance(0.3)));
  if (spoiler) {
    b.add('round_1x1', 0, tailY, 0, 0, 'black');
    b.add('round_1x1', 0, tailY, W - 1, 0, 'black');
    b.fill(tailY + 3, 0, 0, 1, W, acc, 'plate');
  }
  // tail lights sit on the rear edge (on the trunk lid when there is one)
  if (!curvedTail) {
    b.add('light_1x1', 0, tailY, spoiler ? 1 : 0, 0, 'tred');
    b.add('light_1x1', 0, tailY, spoiler ? W - 2 : W - 1, 0, 'tred');
  }
  carExtras(b, rng, style, kind, { L, W, y2, cabStart, wsX, main, acc, nose, chassisY });
  return { style, main };
}


/** Style-specific details layered onto the base car body. */
function carExtras(b, rng, style, kind, c) {
  const { L, W, y2, cabStart, wsX, main, acc, nose, chassisY } = c;
  const roofY = y2 + 3;
  const mid = Math.floor(W / 2) - 1;
  const cy = chassisY;                   // chassis plate height
  // exhaust pipes tucked under the back of the chassis
  b.add('round_plate_1x1', 0, 0, 1, 0, 'lgray');
  if (kind === 'supercar' || kind === 'coupe' || style === 'muscle') b.add('round_plate_1x1', 0, 0, W - 2, 0, 'lgray');
  // door seams: a darker tile line along each side
  // interior: seats and a steering wheel visible through the glass
  if (kind !== 'convertible' && kind !== 'van') {
    for (const z of W === 6 ? [1, 4] : [1, 2]) b.add('brick_1x1', cabStart + 1, y2, z, 0, rng.pick(['black', 'tan', 'dred']));
    b.add('round_plate_1x1', wsX - 1, y2, W === 6 ? 4 : 2, 0, 'black');
  }
  // side mirrors and exhausts
  if (style === 'police') {
    b.add('light_1x1', cabStart + 2, roofY + 1, mid, 0, 'tred'); b.add('light_1x1', cabStart + 2, roofY + 1, mid + 1, 0, 'tblue');
    b.add('tile_1x2', 1, y2, mid, 0, 'blue');
  } else if (style === 'taxi') {
    b.add('brick_1x2', cabStart + 2, roofY + 1, mid, 0, 'white');
    b.add('tile_1x2', cabStart + 2, roofY + 4, mid, 0, 'black');
    b.fillMask(roofY + 1, cabStart, 0, 2, W, (x, z) => (x + z) % 2 === 0 && z !== mid && z !== mid + 1, 'black', 'tile');
  } else if (style === 'ambulance') {
    b.add('light_1x1', 2, roofY + 1, 1, 0, 'tred'); b.add('light_1x1', 2, roofY + 1, W - 2, 0, 'tblue');
    b.fillMask(roofY + 1, 4, 1, 3, W - 2, (x, z) => z === mid || z === mid + 1 || x === 5, 'red', 'tile');
  } else if (style === 'limo') {
    b.add('antenna_1x1', 1, y2, 0, 0, 'black');
  } else if (style === 'muscle') {
    b.add('grille_1x2', nose - 2, y2 + 3, mid, 0, 'black');
  } else if (style === 'hyper') {
  } else if (style === 'rally') {
    for (let z = 0; z < W; z++) b.add('light_1x1', wsX + 1, roofY + 1, z, 0, 'tyellow');
    b.add('antenna_1x1', 1, roofY + 1, 1, 0, 'black');
  }
}

/** Pickup trucks and monster trucks: cab up front, open bed behind. */
function genPickup(b, rng, o) {
  const monster = o.style === 'monster';
  const main = o.color || rng.pick(monster ? ['lime', 'orange', 'purple', 'red', 'blue', 'black'] : ['red', 'blue', 'dgreen', 'white', 'tan', 'black', 'navy']);
  const acc = accentFor(rng, main);
  const W = 6, L = monster ? 13 : rng.int(13, 15);
  const rim = rng.pick(['lgray', 'gold', 'black', 'red']);
  let base = 0;
  if (monster) {
    // giant wheels: two large wheels stacked side by side on each corner
    for (const x of [0, L - 4]) for (const z of [-2, -1, W, W + 1]) b.add('wheel_large', x + 0, 0, z, 1, rim);
    b.add('technic_1x4', 1, 3, 2, 1, 'dgray'); b.add('technic_1x4', L - 3, 3, 2, 1, 'dgray');
    base = 5;
  } else {
    for (const x of [1, L - 4]) { b.add('wheel_large', x, 0, -1, 1, rim); b.add('wheel_large', x, 0, W, 1, rim); }
    base = 2;
  }
  b.fill(base, 0, 0, L, W, 'dgray', 'plate');
  b.fill(base + 1, 0, 0, L, W, main, 'brick');
  const y = base + 4;
  const cabX = L - 7;
  // bed
  b.fill(y, 0, 0, cabX, W, 'dgray', 'plate');
  b.walls(y + 1, 0, 0, cabX, W, 1, main);
  b.add('light_1x1', 0, y + 4, 0, 0, 'tred'); b.add('light_1x1', 0, y + 4, W - 1, 0, 'tred');
  if (!monster) { b.add('brick_2x2', 2, y + 1, 2, 0, rng.pick(['brown', 'tan', 'blue'])); }
  // cab
  b.walls(y, cabX, 0, 4, W, 1, (x) => (x === cabX ? main : main));
  b.fill(y, cabX + 1, 1, 2, W - 2, 'black', 'plate');
  b.walls(y + 3, cabX, 0, 3, W, 1, (x, yy, z) => (x === cabX ? main : 'tclear'));
  b.add('windscreen_2x4', cabX + 3, y + 3, 1, 1, 'tclear');
  b.add('brick_1x2', cabX + 3, y + 3, 0, 1, main); b.add('brick_1x2', cabX + 3, y + 3, W - 1, 1, main);
  b.fill(y + 6, cabX, 0, 5, W, main, 'plate');
  if (monster) { for (let z = 0; z < W; z++) b.add('light_1x1', cabX + 2, y + 7, z, 0, z % 2 ? 'tyellow' : 'tclear'); }
  else b.fillMask(y + 7, cabX, 1, 5, W - 2, () => true, acc === 'black' ? 'dgray' : acc, 'tile');
  // hood
  for (let z = 0; z < W; z += 2) b.add('slope_2x2', L - 2, y, z, 1, main);
  b.fill(y, cabX + 4, 0, L - 2 - cabX - 4, W, main, 'plate');
  b.add('light_1x1', L - 1, y, 0, 0, 'tyellow'); b.add('light_1x1', L - 1, y, W - 1, 0, 'tyellow');
  b.add('grille_1x2', L, base + 1, 2, 0, 'lgray'); b.add('grille_1x2', L, base + 1, 4, 0, 'lgray');
  if (monster) { b.add('round_1x1', cabX - 1, y + 1, -1, 0, 'lgray'); b.add('round_1x1', cabX - 1, y + 4, -1, 0, 'lgray'); b.fillMask(y + 1, 1, 1, cabX - 2, W - 2, (x, z) => (x + z) % 3 === 0, 'tgreen', 'tile'); }
  return { style: o.style, main };
}

/** Dune buggy: open tube frame, roll cage, chunky wheels. */
function genBuggy(b, rng, o) {
  const main = o.color || rng.pick(['orange', 'lime', 'yellow', 'red', 'azure']);
  const L = 11, W = 6;
  for (const x of [0, L - 3]) { b.add('wheel_large', x, 0, -1, 1, 'black'); b.add('wheel_large', x, 0, W, 1, 'black'); }
  b.fill(3, 0, 0, L, W, 'dgray', 'plate');
  for (const z of [0, W - 1]) { b.add('technic_1x6', 1, 4, z, 0, main); b.add('technic_1x4', 7, 4, z, 0, main); }
  b.fill(4, 1, 1, 9, 4, 'black', 'plate');
  b.add('brick_1x2', 3, 5, 1, 0, 'black'); b.add('brick_1x2', 3, 5, 3, 0, 'black');
  b.add('round_plate_1x1', 6, 5, 3, 0, 'black');
  for (const [x, z] of [[2, 0], [2, W - 1], [7, 0], [7, W - 1]]) { b.add('round_1x1', x, 7, z, 0, 'dgray'); b.add('round_1x1', x, 10, z, 0, 'dgray'); }
  b.fill(13, 2, 0, 6, W, 'dgray', 'plate');
  b.fillMask(14, 2, 0, 6, W, (x, z) => x === 7, 'tyellow', 'tile');
  for (let z = 0; z < W; z += 2) b.add('slope_2x2', 9, 7, z, 1, main);
  b.fill(7, 8, 0, 1, W, main, 'brick');
  b.add('round_1x1', 0, 7, 2, 0, 'lgray'); b.add('round_1x1', 0, 7, 3, 0, 'lgray');
  b.add('antenna_1x1', 0, 14, 0, 0, 'red');
  return { style: 'buggy', main };
}

/** Drag racer: tiny front wheels, huge rear slicks, long nose and a tall wing. */
function genDragster(b, rng, o) {
  const main = o.color || rng.pick(['red', 'yellow', 'black', 'purple', 'blue', 'orange']);
  const acc = accentFor(rng, main);
  const L = 18;
  b.add('wheel_large', 0, 0, -2, 1, 'black'); b.add('wheel_large', 0, 0, -1, 1, 'black');
  b.add('wheel_large', 0, 0, 2, 1, 'black'); b.add('wheel_large', 0, 0, 3, 1, 'black');
  b.add('wheel_small', L - 2, 0, -1, 1, 'lgray'); b.add('wheel_small', L - 2, 0, 2, 1, 'lgray');
  b.fill(3, 0, 0, L, 2, 'dgray', 'plate');
  b.fill(4, 0, 0, 7, 2, main, 'brick');
  b.fill(4, 7, 0, L - 7, 2, main, 'plate');
  b.fill(5, 7, 0, L - 9, 2, acc, 'tile');
  b.add('slope_1x2', L - 2, 5, 0, 1, main); b.add('slope_1x2', L - 2, 5, 1, 1, main);
  b.add('windscreen_2x4', 4, 7, -1, 1, 'tblue');
  b.add('round_1x1', 5, 7, 0, 0, 'white'); b.add('round_1x1', 5, 7, 1, 0, 'white');
  b.fill(7, 2, 0, 2, 2, 'lgray', 'brick');
  b.add('grille_1x2', 2, 10, 0, 0, 'black');
  for (const z of [0, 1]) { b.add('technic_1x2', 0, 7, z, 1, 'dgray'); }
  b.add('round_1x1', 0, 10, 0, 0, 'dgray'); b.add('round_1x1', 0, 10, 1, 0, 'dgray');
  b.fill(13, -1, -2, 3, 6, acc, 'plate');
  b.add('light_1x1', 0, 14, -2, 0, 'tred'); b.add('light_1x1', 0, 14, 3, 0, 'tred');
  return { style: 'drag', main };
}

// ===================================================================== MOTORCYCLES
export function genMotorcycle(b, rng, o = {}) {
  const style = o.style || rng.pick(['sport', 'chopper', 'dirt', 'scooter', 'cruiser', 'trike', 'sidecar']);
  const main = o.color || rng.pick(CAR_COLORS);
  const acc = accentFor(rng, main);
  const big = style === 'dirt' || style === 'chopper' || style === 'cruiser';
  const wt = big ? 'wheel_large' : 'wheel_small';
  const span = big ? 3 : 2;
  const wh = big ? 7 : 5;                   // wheel height in plates
  const L = { sport: 8, chopper: 11, dirt: 8, scooter: 7, cruiser: 10, trike: 9, sidecar: 9 }[style] + rng.int(0, 1);
  const z = 1;                               // the bike runs along X, one stud wide, at z=1
  const rimC = rng.pick(['lgray', 'black', 'gold']);
  b.add(wt, 0, 0, z, 1, rimC);
  b.add(wt, L - span, 0, z, 1, rimC);
  if (style === 'trike') { b.add('wheel_large', 0, 0, z - 1, 1, rimC); b.add('wheel_large', 0, 0, z + 1, 1, rimC); }
  // engine between the wheels
  const mid = L - 2 * span;
  b.fill(1, span, z, mid, 1, 'lgray', 'brick');
  if (big) b.fill(4, span, z, mid, 1, main, 'brick'); else b.fill(4, span, z, mid, 1, main, 'plate');
  b.add('round_plate_1x1', span, 0, z, 0, 'dgray');
  if (rng.chance(0.7)) b.add('round_1x1', span, 1, z + 1, 0, 'lgray'); // exhaust
  // frame / mudguards over the wheels
  b.fill(wh, 0, z, L, 1, main, 'plate');
  const top = wh + 1;
  const fork = L - span;
  if (style === 'sport') {
    b.fill(top, span, z, mid, 1, main, 'brick');
    b.add('slope_1x2', fork, top, z, 1, main);
    b.add('slope_curve_1x2', fork - 2, top + 3, z, 1, 'tblue');
    b.add('tile_1x2', 1, top, z, 1, 'black');
    b.add('slope_1x2', 0, top + 1, z, 3, acc);
  } else if (style === 'chopper' || style === 'cruiser') {
    b.add('tile_1x2', 2, top, z, 1, 'black');
    b.add('brick_1x2', 4, top, z, 1, main);
    b.add('round_1x1', fork, top, z, 0, 'lgray');
    b.add('round_1x1', fork, top + 3, z, 0, 'lgray');
    b.add('plate_1x3', fork, top + 6, z - 1, 0, 'black');
    b.add('light_1x1', L - 1, top, z, 0, 'tyellow');
    if (style === 'cruiser') { b.add('brick_1x2', 1, 1, z - 1, 1, acc); b.add('brick_1x2', 1, 1, z + 1, 1, acc); b.add('tile_1x2', 1, 4, z - 1, 1, acc); b.add('tile_1x2', 1, 4, z + 1, 1, acc); }
  } else if (style === 'dirt') {
    b.add('slope_1x2', fork - 1, top, z, 1, main);
    b.add('tile_1x2', 2, top, z, 1, 'black');
    b.add('brick_1x1', fork + 1, top, z, 0, 'dgray');
    b.add('plate_1x3', fork + 1, top + 3, z - 1, 0, 'black');
    b.add('grille_1x2', 4, top, z, 1, acc);
  } else if (style === 'scooter') {
    b.add('brick_1x2', 1, top, z, 1, main);
    b.add('tile_1x2', 1, top + 3, z, 1, 'tan');
    b.add('brick_1x1', fork, top, z, 0, main);
    b.add('round_1x1', fork, top + 3, z, 0, main);
    b.add('plate_1x3', fork, top + 6, z - 1, 0, 'black');
    b.add('light_1x1', L - 1, top, z, 0, 'tyellow');
  } else {
    b.add('tile_1x2', 2, top, z, 1, 'black');
    b.add('brick_1x1', fork, top, z, 0, 'dgray');
    b.add('plate_1x3', fork, top + 3, z - 1, 0, 'black');
    if (style === 'trike') { b.fill(top, 0, z - 1, 2, 3, acc, 'brick'); b.fill(top + 3, 0, z - 1, 2, 3, 'black', 'tile'); }
    if (style === 'sidecar') {
      b.add('wheel_small', 3, 0, z + 3, 1, 'lgray');
      b.fill(2, 2, z + 1, 4, 2, 'dgray', 'plate');
      b.fill(3, 2, z + 1, 4, 2, acc, 'brick');
      b.add('slope_curve_2x2', 4, 6, z + 1, 1, acc);
      b.add('tile_1x2', 2, 6, z + 1, 1, 'black');
    }
  }
  b.add('light_1x1', 0, top, z, 0, 'tred');
  return { style, main };
}
function pickLen(n) { for (const l of [8, 6, 4, 3, 2]) if (l <= n) return l; return 1; }

// ===================================================================== TRUCKS & CONSTRUCTION
function cab(b, rng, x, y, W, len, color, glass = 'tclear', tall = 2) {
  // a truck cab occupying x..x+len-1, front at +X
  b.fill(y, x, 0, len, W, color, 'brick');
  const y2 = y + 3;
  if (tall >= 2) {
    b.fillMask(y2, x, 0, len - 2, W, (xx, z) => z === 0 || z === W - 1 || xx === x, (xx) => (xx === x ? color : glass), 'brick');
    if (W === 4) b.add('windscreen_2x4', x + len - 2, y2, 0, 1, glass);
    else { b.add('windscreen_2x4', x + len - 2, y2, 1, 1, glass); b.add('brick_1x2', x + len - 2, y2, 0, 1, color); b.add('brick_1x2', x + len - 2, y2, W - 1, 1, color); }
    b.fill(y2 + 3, x, 0, len, W, color, 'plate');
    b.fillMask(y2 + 4, x, 0, len, W, (xx, z) => z > 0 && z < W - 1, 'white', 'tile');
  }
  b.add('light_1x1', x + len - 1, y2, 0, 0, 'tyellow');
  b.add('light_1x1', x + len - 1, y2, W - 1, 0, 'tyellow');
  return y2 + 4;
}

function tracks(b, x, y, L, W, color = 'black') {
  // crawler tracks on both sides, technic beams make the treads
  for (const z of [0, W - 1]) {
    let xx = x;
    while (xx < x + L) {
      const len = [6, 4, 2].find(n => xx + n <= x + L) || 1;
      if (len >= 2) b.add('technic_1x' + len, xx, y, z, 0, color); else b.add('brick_1x1', xx, y, z, 0, color);
      xx += len;
    }
  }
  b.fill(y + 3, x, 0, L, W, 'dgray', 'plate');
}

export function genTruck(b, rng, o = {}) {
  const style = o.style || rng.pick(['dump', 'tanker', 'flatbed', 'fire', 'excavator', 'bulldozer', 'crane', 'mixer', 'forklift', 'tow', 'garbage', 'roller']);
  const W = o.W || 6;
  const yellowish = ['excavator', 'bulldozer', 'crane', 'forklift', 'roller', 'dump'].includes(style);
  const main = o.color || (style === 'fire' ? 'red' : style === 'garbage' ? rng.pick(['green', 'lime', 'white']) : yellowish ? rng.pick(['yellow', 'orange', 'yellow', 'lime']) : rng.pick(CAR_COLORS));
  const acc = o.accent || (yellowish ? rng.pick(['black', 'dgray']) : accentFor(rng, main));

  if (style === 'excavator' || style === 'bulldozer') {
    const L = style === 'excavator' ? 10 : 9;
    tracks(b, 0, 0, L, W, 'black');
    b.fill(3, 1, 1, L - 2, W - 2, 'dgray', 'brick');
    if (style === 'excavator') {
      // rotating house
      b.fill(7, 1, 0, 8, W, main, 'plate');
      b.fill(8, 1, 0, 6, W, main, 'brick');
      b.fill(11, 1, 0, 3, W, main, 'brick');
      b.fillMask(11, 4, 0, 3, W, (x, z) => z === 0 || z === W - 1 || x === 4, (x) => (x === 4 ? main : 'tclear'), 'brick');
      b.add('windscreen_2x4', 5, 11, 1, 1, 'tclear');
      b.fill(14, 1, 0, 6, W, main, 'plate');
      b.add('grille_1x2', 1, 15, 1, 0, 'dgray');
      b.add('round_1x1', 2, 15, 4, 0, 'dgray');
      // boom: stair-stepped arm up, then the dipper arm down to the bucket
      const bz = 2;
      for (let i = 0; i < 5; i++) b.add('technic_1x4', 7 + i, 8 + i * 3, bz, 0, acc);
      for (let i = 0; i < 4; i++) b.add('technic_1x2', 14 + i, 17 - i * 3, bz, 0, acc);
      b.add('brick_1x2', 18, 5, bz, 0, 'dgray');
      b.add('slope_inv_1x2', 19, 5, bz, 0, 'dgray');
      b.add('spike_1x1', 18, 3, bz, 0, 'dgray'); b.add('spike_1x1', 18, 3, bz + 1, 0, 'dgray');
    } else {
      b.fill(7, 1, 1, L - 2, W - 2, main, 'brick');
      b.fill(10, 1, 1, 4, W - 2, main, 'brick');
      b.fillMask(13, 1, 1, 4, W - 2, (x, z) => z === 1 || z === W - 2 || x === 1 || x === 4, (x, z) => (x === 1 ? main : 'tclear'), 'brick');
      b.fill(16, 1, 1, 4, W - 2, main, 'plate');
      b.add('round_1x1', 6, 10, 2, 0, 'dgray');
      b.add('round_1x1', 6, 13, 2, 0, 'dgray');
      // blade
      for (let z = -1; z <= W; z += 2) b.add('brick_1x2', L, 3, z, 0, main === 'yellow' ? 'dgray' : 'yellow');
      for (let z = -1; z <= W; z += 2) b.add('slope_1x2', L, 6, z, 0, main === 'yellow' ? 'dgray' : 'yellow');
      b.add('technic_1x2', L - 2, 6, 0, 0, acc);
      b.add('technic_1x2', L - 2, 6, W - 1, 0, acc);
      // ripper at back
      b.add('spike_1x1', -1, 3, 2, 0, 'dgray');
      b.add('spike_1x1', -1, 3, 3, 0, 'dgray');
    }
    return { style, main };
  }

  if (style === 'forklift' || style === 'roller') {
    const L = 7;
    if (style === 'roller') {
      b.fill(0, 5, 0, 2, W, 'dgray', 'brick'); b.fill(3, 5, 0, 2, W, 'dgray', 'brick');
      b.add('wheel_large', 0, 0, -1, 1, 'black'); b.add('wheel_large', 0, 0, W, 1, 'black');
    } else {
      axle(b, 0, W, false, 'black'); axle(b, L - 2, W, false, 'black');
    }
    b.fill(2, 0, 0, L - (style === 'roller' ? 2 : 0), W, 'dgray', 'plate');
    b.fill(3, 0, 0, L - 2, W, main, 'brick');
    b.fill(6, 0, 0, 3, W, main, 'brick');
    b.add('round_1x1', 3, 6, 0, 0, 'black'); b.add('round_1x1', 3, 6, W - 1, 0, 'black');
    b.add('round_1x1', 3, 9, 0, 0, 'black'); b.add('round_1x1', 3, 9, W - 1, 0, 'black');
    b.add('brick_1x2', 1, 6, 2, 0, 'black');
    b.fill(12, 0, 0, 4, W, main, 'plate');
    b.add('light_1x1', 1, 13, 2, 0, 'tyellow');
    if (style === 'forklift') {
      // mast and forks
      b.add('technic_1x2', L, 2, 0, 1, 'dgray'); b.add('technic_1x2', L, 2, W - 1, 1, 'dgray');
      for (let l = 1; l < 4; l++) { b.add('brick_1x1', L, 2 + l * 3, 0, 0, 'dgray'); b.add('brick_1x1', L, 2 + l * 3, W - 1, 0, 'dgray'); }
      b.add('plate_1x6', L, 14, 0, 0, 'dgray');
      b.add('plate_1x4', L + 1, 2, 1, 1, 'lgray'); b.add('plate_1x4', L + 1, 2, W - 2, 1, 'lgray');
      b.add('brick_2x2', L + 2, 3, 2, 0, rng.pick(['brown', 'tan', 'blue']));
    }
    return { style, main };
  }

  // wheeled trucks
  const L = o.L || rng.int(16, 20);
  const cabLen = 4;
  const ax = [1, 4, L - 4];
  if (L >= 19) ax.splice(2, 0, 8);
  for (const x of ax) axle(b, x, W, true, rng.pick(['lgray', 'dgray', 'white']));
  b.fill(1, 0, 0, L, W, 'dgray', 'plate');
  b.fill(2, 0, 0, L, W, 'black', 'plate');
  b.add('grille_1x2', L - 1, 3, 2, 0, 'lgray');
  const top = cab(b, rng, L - cabLen, 3, W, cabLen, main);
  b.add('brick_1x1', L - cabLen - 1, 3, 0, 0, 'lgray');
  b.add('round_1x1', L - cabLen - 1, 6, 0, 0, 'lgray');
  b.add('round_1x1', L - cabLen - 1, 9, 0, 0, 'lgray');
  const bedLen = L - cabLen - 1;
  if (style === 'dump') {
    b.fill(3, 0, 0, bedLen, W, acc, 'plate');
    b.walls(4, 0, 0, bedLen, W, 2, main);
    b.fill(10, 0, 0, 1, W, main, 'plate');
    for (let z = 0; z < W; z += 2) b.add('slope_2x2', bedLen - 2, 10, z, 3, main);
    b.fill(4, 1, 1, bedLen - 2, W - 2, rng.pick(['tan', 'brown', 'dgray']), 'brick');
  } else if (style === 'tanker') {
    b.fill(3, 0, 0, bedLen, W, 'dgray', 'plate');
    b.fill(4, 0, 0, bedLen, W, acc === 'black' ? 'lgray' : acc, 'brick');
    b.fill(7, 0, 0, bedLen, W, acc === 'black' ? 'lgray' : acc, 'brick');
    for (let x = 0; x + 2 <= bedLen; x += 2) { b.add('slope_curve_2x2', x, 10, 0, 2, 'lgray'); b.add('slope_curve_2x2', x, 10, W - 2, 0, 'lgray'); }
    b.fill(10, 0, 2, bedLen, 2, 'lgray', 'plate');
    b.fill(11, 0, 2, bedLen, 2, main, 'tile');
  } else if (style === 'flatbed' || style === 'tow') {
    b.fill(3, 0, 0, bedLen, W, acc === 'black' ? 'dgray' : acc, 'plate');
    if (style === 'flatbed') {
      const crateColors = ['brown', 'tan', 'blue', 'red', 'green'];
      for (let x = 0; x + 2 <= bedLen - 1; x += 3) b.add(rng.chance(0.5) ? 'brick_2x2' : 'brick_2x3', x, 4, rng.int(0, 2), 0, rng.pick(crateColors));
    } else {
      b.add('technic_1x6', 0, 4, 2, 0, 'dgray');
      b.add('technic_1x4', 0, 7, 2, 0, 'dgray');
      b.add('hinge_1x2', -1, 4, 2, 0, 'black');
      b.add('round_1x1', bedLen - 1, 4, 3, 0, 'yellow');
      b.add('light_1x1', L - 2, top, 2, 0, 'tyellow');
      b.add('light_1x1', L - 2, top, 3, 0, 'tyellow');
    }
  } else if (style === 'fire') {
    b.fill(3, 0, 0, bedLen, W, 'red', 'brick');
    b.fillMask(6, 0, 0, bedLen, W, (x, z) => z === 0 || z === W - 1, (x) => (x % 3 === 0 ? 'white' : 'red'), 'brick');
    b.fill(9, 0, 0, bedLen, W, 'red', 'plate');
    b.add('technic_1x6', 1, 10, 2, 0, 'lgray');
    b.add('technic_1x6', 1, 10, 3, 0, 'lgray');
    b.add('technic_1x4', 7, 10, 2, 0, 'lgray');
    b.add('technic_1x4', 7, 10, 3, 0, 'lgray');
    b.add('light_1x1', L - 3, top, 1, 0, 'tblue');
    b.add('light_1x1', L - 3, top, 4, 0, 'tred');
    b.add('round_2x2', 4, 3, -2, 0, 'lgray');
  } else if (style === 'crane') {
    b.fill(3, 0, 0, bedLen, W, 'dgray', 'plate');
    b.fill(4, 2, 1, 4, 4, main, 'brick');
    b.add('round_2x2', 3, 7, 2, 0, 'dgray');
    for (let i = 0; i < 6; i++) b.add('technic_1x2', 3 + i, 10 + i * 3, 2, 0, acc === 'black' ? 'yellow' : acc);
    b.add('brick_1x1', 9, 25, 2, 0, 'dgray');
    b.add('antenna_1x1', 9, 19, 3, 0, 'black');
    // outriggers
    b.add('plate_1x3', 1, 2, -2, 0, 'dgray'); b.add('plate_1x3', 1, 2, W - 1, 0, 'dgray');
  } else if (style === 'mixer') {
    b.fill(3, 0, 0, bedLen, W, 'dgray', 'plate');
    const prof = [2, 4, 6, 6, 6, 6, 4, 2];
    for (let x = 0; x < Math.min(bedLen, prof.length + 3); x++) {
      const p = prof[Math.min(prof.length - 1, Math.max(0, x - 1))];
      const z0 = (W - p) / 2;
      b.fillMask(4, x, z0, 1, p, () => true, x % 2 ? main : 'white', 'brick');
      if (p >= 4) b.fillMask(7, x, z0 + 1, 1, p - 2, () => true, x % 2 ? main : 'white', 'brick');
    }
    b.add('cone_1x1', 0, 10, 2, 0, 'dgray');
  } else if (style === 'garbage') {
    b.fill(3, 0, 0, bedLen, W, main, 'brick');
    b.fill(6, 0, 0, bedLen, W, main, 'brick');
    b.fill(9, 0, 0, bedLen, W, main, 'brick');
    for (let z = 0; z < W; z += 2) b.add('slope_curve_2x2', 0, 12, z, 3, main);
    b.fill(12, 2, 0, bedLen - 2, W, main, 'plate');
    b.add('grille_1x2', 0, 4, -1, 1, 'dgray');
    b.add('light_1x1', 4, 13, 2, 0, 'tyellow');
  }
  return { style, main };
}

// ===================================================================== TRAINS
function loco(b, rng, x0, style, main, acc, W = 6, y0 = 0) {
  const L = style === 'steam' ? 14 : style === 'bullet' ? 16 : 13;
  b.add('train_wheel', x0 + 1, y0, 2, 0, 'lgray');
  b.add('train_wheel', x0 + L - 5, y0, 2, 0, 'lgray');
  if (style === 'steam') b.add('train_wheel', x0 + 5, y0, 2, 0, 'red');
  b.fill(y0 + 3, x0, 0, L, W, 'black', 'plate');
  b.fill(y0 + 4, x0, 0, L, W, acc, 'plate');
  const y = y0 + 5;
  if (style === 'steam') {
    // boiler (rounded), cab at the back, chimney up front
    b.fill(y, x0 + 4, 1, L - 4, 4, main, 'brick');
    b.fill(y + 3, x0 + 4, 1, L - 4, 4, main, 'brick');
    for (let x = x0 + 4; x + 2 <= x0 + L; x += 2) { b.add('slope_curve_2x2', x, y + 6, 1, 2, main); b.add('slope_curve_2x2', x, y + 6, 3, 0, main); }
    b.add('round_1x1', x0 + L - 2, y + 6, 2, 0, 'black');
    b.add('round_1x1', x0 + L - 2, y + 9, 2, 0, 'black');
    b.add('cone_1x1', x0 + L - 2, y + 12, 2, 0, 'black');
    b.add('round_1x1', x0 + 8, y + 6, 3, 0, 'gold');
    b.add('light_1x1', x0 + L - 1, y + 3, 2, 0, 'tyellow');
    b.walls(y, x0, 0, 4, W, 1, main);
    b.fillMask(y + 3, x0, 0, 4, W, (x, z) => x === x0 || ((z === 0 || z === W - 1) && (x === x0 + 3))|| (x === x0 + 3), main, 'brick');
    b.add('window_1x2x2', x0 + 1, y + 3, 0, 0, main);
    b.add('window_1x2x2', x0 + 1, y + 3, W - 1, 0, main);
    b.fill(y + 9, x0, 0, 4, W, 'black', 'plate');
    b.fill(y + 10, x0, 0, 4, W, main, 'tile');
    b.add('slope_1x2', x0 + L, y0 + 4, 1, 1, 'red'); b.add('slope_1x2', x0 + L, y0 + 4, 4, 1, 'red');
  } else if (style === 'diesel') {
    b.fill(y, x0, 0, L, W, main, 'brick');
    b.fillMask(y + 3, x0 + 2, 1, L - 4, W - 2, () => true, acc, 'brick');
    b.fill(y + 3, x0, 0, 2, W, main, 'brick');
    b.fill(y + 3, x0 + L - 2, 0, 2, W, main, 'brick');
    b.fillMask(y + 6, x0, 0, 2, W, (x, z) => true, 'tclear', 'brick');
    b.fillMask(y + 6, x0 + L - 2, 0, 2, W, (x, z) => true, 'tclear', 'brick');
    b.fill(y + 9, x0, 0, 2, W, main, 'plate'); b.fill(y + 9, x0 + L - 2, 0, 2, W, main, 'plate');
    b.fill(y + 6, x0 + 2, 1, L - 4, W - 2, 'lgray', 'plate');
    for (let x = x0 + 3; x < x0 + L - 3; x += 2) b.add('grille_1x2', x, y + 7, 2, 0, 'dgray');
    b.add('light_1x1', x0 + L - 1, y + 10, 2, 0, 'tyellow'); b.add('light_1x1', x0, y + 10, 3, 0, 'tred');
    b.add('light_1x1', x0 + L - 1, y + 10, 3, 0, 'tyellow');
  } else { // bullet
    b.fill(y, x0, 0, L - 4, W, main, 'brick');
    b.fillMask(y + 3, x0, 0, L - 4, W, (x, z) => z === 0 || z === W - 1, (x) => (x % 3 === 1 ? main : 'tblue'), 'brick');
    b.fill(y + 3, x0, 1, L - 4, W - 2, 'white', 'plate');
    b.fill(y + 6, x0, 0, L - 4, W, main, 'plate');
    for (let z = 0; z < W; z += 2) b.add('slope_curve_2x2', x0 + 1, y + 7, z, 3, acc);
    b.fill(y + 7, x0 + 3, 0, L - 7, W, acc, 'tile');
    for (let z = 0; z < W; z += 2) { b.add('slope_2x2', x0 + L - 4, y, z, 1, main); b.add('slope_2x3', x0 + L - 5, y + 3, z, 1, 'tblue'); }
    b.add('slope_2x2', x0 + L - 2, y0 + 4, 2, 1, acc);
  }
  return L;
}

function carriage(b, rng, x0, kind, main, acc, W = 6, y0 = 0) {
  const L = kind === 'passenger' ? 14 : 12;
  b.add('train_wheel', x0 + 1, y0, 2, 0, 'dgray');
  b.add('train_wheel', x0 + L - 5, y0, 2, 0, 'dgray');
  b.fill(y0 + 3, x0, 0, L, W, 'black', 'plate');
  const y = y0 + 4;
  if (kind === 'passenger') {
    b.fill(y, x0, 0, L, W, 'dgray', 'plate');
    b.walls(y + 1, x0, 0, L, W, 1, main);
    b.walls(y + 4, x0, 0, L, W, 1, (x, yy, z) => ((x - x0) % 3 === 0 || x === x0 + L - 1) ? main : 'tclear');
    b.fill(y + 7, x0, 0, L, W, acc, 'plate');
    for (let x = x0; x + 2 <= x0 + L; x += 2) { b.add('slope_curve_2x2', x, y + 8, 0, 2, 'lgray'); b.add('slope_curve_2x2', x, y + 8, 4, 0, 'lgray'); }
    b.fill(y + 8, x0, 2, L, 2, 'lgray', 'tile');
  } else if (kind === 'freight') {
    b.fill(y, x0, 0, L, W, 'brown', 'plate');
    b.walls(y + 1, x0, 0, L, W, 2, main);
    b.fill(y + 1, x0 + 1, 1, L - 2, W - 2, rng.pick(['dgray', 'tan', 'brown']), 'brick');
  } else if (kind === 'tank') {
    b.fill(y, x0, 0, L, W, 'dgray', 'plate');
    b.fill(y + 1, x0 + 1, 1, L - 2, 4, main, 'brick');
    b.fill(y + 4, x0 + 1, 1, L - 2, 4, main, 'brick');
    for (let x = x0 + 1; x + 2 <= x0 + L - 1; x += 2) { b.add('slope_curve_2x2', x, y + 7, 1, 2, main); b.add('slope_curve_2x2', x, y + 7, 3, 0, main); }
    b.add('round_1x1', x0 + 5, y + 7, 2, 0, acc);
  } else { // container flat
    b.fill(y, x0, 0, L, W, 'dgray', 'plate');
    const cc = rng.pick(['blue', 'red', 'orange', 'teal', 'green']);
    b.fill(y + 1, x0 + 1, 0, L - 2, W, cc, 'brick');
    b.fill(y + 4, x0 + 1, 0, L - 2, W, cc, 'brick');
    b.fill(y + 7, x0 + 1, 0, L - 2, W, cc, 'plate');
  }
  return L;
}

export function genTrain(b, rng, o = {}) {
  const style = o.style || rng.pick(['steam', 'diesel', 'bullet']);
  const main = o.color || (style === 'steam' ? rng.pick(['black', 'dgreen', 'navy', 'dred']) : rng.pick(['red', 'blue', 'yellow', 'white', 'orange', 'green', 'azure']));
  const acc = o.accent || (style === 'steam' ? 'red' : accentFor(rng, main));
  const cars = o.cars ?? 0;
  const y0 = o.track ? 1 : 0;
  let x = 0;
  const kinds = o.kinds || ['passenger', 'freight', 'tank', 'container'];
  const parts = [];
  for (let i = 0; i < cars; i++) parts.push(style === 'bullet' ? 'passenger' : rng.pick(kinds));
  for (let i = parts.length - 1; i >= 0; i--) {
    x += carriage(b, rng, x, parts[i], style === 'bullet' ? main : rng.pick([main, acc, 'dgray', 'brown', 'azure']), acc, 6, y0) + 1;
  }
  const L = loco(b, rng, x, style, main, acc, 6, y0);
  if (o.track) {
    const tl = x + L + 2;
    for (let xx = -2; xx < tl; xx += 2) b.add('plate_1x6', xx, 0, 0, 0, 'brown');
    b.fillMask(1, -2, 0, tl + 2, 6, (xx, z) => z === 1 || z === 4, 'dgray', 'tile');
  }
  return { style, main };
}
