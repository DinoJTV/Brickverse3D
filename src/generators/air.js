// generators/air.js — aircraft, helicopters, spacecraft and rockets. Nose points to +X.

const PLANE_COLORS = ['white', 'lgray', 'azure', 'blue', 'red', 'yellow', 'orange', 'navy', 'dgreen', 'teal', 'black'];

function roundTop(b, x0, y, len, W, color) {
  // rounded fuselage top: curved slopes on both edges, tiles down the middle
  for (let x = x0; x + 2 <= x0 + len; x += 2) {
    b.add('slope_curve_2x2', x, y, 0, 2, color);
    b.add('slope_curve_2x2', x, y, W - 2, 0, color);
  }
  if (W > 4) b.fill(y, x0, 2, len, W - 4, color, 'plate');
}

/** Tail plane: two layers of 2-wide plates across the fuselage, joints staggered so it holds together. */
function tailPlane(b, x, y, z0, len, color) {
  const SPLITS = { 6: [[3, 3], [2, 4]], 8: [[4, 4], [2, 6]], 10: [[6, 4], [4, 6]], 12: [[6, 6], [4, 8]], 14: [[8, 6], [6, 8]] };
  const sp = SPLITS[len] || [[len], [len]];
  sp.forEach((parts, l) => { let z = z0; for (const n of parts) { b.add(`plate_2x${n}`, x, y + l, z, 0, color); z += n; } });
}

function fin(b, x, y, z, layers, color) {
  for (let l = 0; l < layers; l++) b.add('brick_1x3', x, y + l * 3, z, 1, color);
  b.add('slope_1x3', x, y + layers * 3, z, 3, color);
}

export function genAircraft(b, rng, o = {}) {
  const style = o.style || rng.pick(['airliner', 'jet', 'biplane', 'helicopter', 'cargo', 'seaplane', 'glider', 'prop']);
  const main = o.color || rng.pick(PLANE_COLORS);
  const acc = o.accent || rng.pick(['red', 'blue', 'yellow', 'navy', 'orange', 'dgray'].filter(c => c !== main));

  if (style === 'helicopter') {
    const W = 4;
    // skids
    b.add('plate_1x8', 0, 0, -1, 1, 'dgray'); b.add('plate_1x8', 0, 0, W, 1, 'dgray');
    b.add('round_1x1', 2, 1, -1, 0, 'dgray'); b.add('round_1x1', 5, 1, -1, 0, 'dgray');
    b.add('round_1x1', 2, 1, W, 0, 'dgray'); b.add('round_1x1', 5, 1, W, 0, 'dgray');
    b.fill(4, -1, -1, 8, W + 2, 'dgray', 'plate');
    b.fill(5, 0, 0, 8, W, main, 'brick');
    b.walls(8, 0, 0, 6, W, 1, (x, y, z) => (x === 0 || x === 5) ? main : 'tclear');
    b.add('windscreen_2x4', 6, 8, 0, 1, 'tblue');
    b.fill(11, 0, 0, 8, W, main, 'plate');
    roundTop(b, 0, 12, 6, W, main);
    b.add('slope_2x2', 6, 12, 1, 1, main);
    // tail boom
    b.fill(8, -10, 1, 10, 2, acc, 'plate');
    b.fill(9, -10, 1, 10, 2, main, 'brick');
    b.add('brick_1x2', -10, 12, 1, 1, acc);
    b.add('slope_1x2', -10, 15, 1, 3, acc);
    b.add('propeller_1x1', -10, 12, 2, 0, 'black');
    // main rotor
    b.add('round_1x1', 3, 14, 1, 0, 'dgray');
    b.add('round_plate_1x1', 3, 17, 1, 0, 'dgray');
    b.add('plate_1x8', -1, 18, 1, 1, 'black');
    b.add('plate_1x8', 3, 19, -3, 0, 'black');
    b.add('light_1x1', 7, 5, 0, 0, 'tred');
    if (o.rescue || rng.chance(0.3)) b.add('light_1x1', -5, 12, 1, 0, 'tblue');
    return { style, main };
  }

  const L = o.L || { airliner: rng.int(20, 26), jet: rng.int(12, 15), biplane: rng.int(9, 11), cargo: rng.int(20, 24), seaplane: rng.int(11, 13), glider: rng.int(10, 12), prop: rng.int(10, 12) }[style];
  const W = { airliner: 4, jet: 2, biplane: 2, cargo: 6, seaplane: 4, glider: 2, prop: 4 }[style];
  const span = { airliner: rng.int(9, 12), jet: rng.int(4, 6), biplane: rng.int(5, 7), cargo: rng.int(10, 13), seaplane: rng.int(6, 8), glider: rng.int(10, 13), prop: rng.int(6, 8) }[style];
  const layers = { airliner: 2, jet: 1, biplane: 1, cargo: 2, seaplane: 1, glider: 1, prop: 1 }[style];

  // landing gear or floats
  let base = 5;
  if (style === 'seaplane') {
    for (const z of [-3, W + 2]) b.fill(0, 1, z, L - 3, 1, 'white', 'brick');
    for (const z of [-3, W + 2]) { b.add('round_1x1', 4, 3, z, 0, 'dgray'); b.add('round_1x1', L - 6, 3, z, 0, 'dgray'); }
    base = 6;
  } else if (style === 'glider' || style === 'jet' || style === 'biplane' || style === 'prop') {
    b.add('wheel_small', Math.floor(L / 2) - 1, 0, -1, 1, 'black');
    b.add('wheel_small', Math.floor(L / 2) - 1, 0, W, 1, 'black');
    if (style !== 'biplane') b.add('wheel_small', L - 3, 0, Math.floor(W / 2) - (W > 2 ? 0 : 0), 1, 'black'); else b.add('wheel_small', 0, 0, 0, 1, 'black');
  } else {
    const mid = Math.floor(L * 0.45);
    b.add('wheel_small', mid, 0, 1, 1, 'black'); b.add('wheel_small', mid, 0, W - 2, 1, 'black');
    b.add('wheel_small', L - 4, 0, Math.floor(W / 2) - 1, 1, 'black');
  }
  // belly + wings on one plate layer
  const wingX = Math.floor(L * 0.4);
  const wingD = { airliner: 5, jet: 6, biplane: 3, cargo: 5, seaplane: 3, glider: 3, prop: 3 }[style];
  const highWing = style === 'cargo' || style === 'seaplane' || style === 'glider';
  b.fill(base, 0, 0, L, W, main === 'white' ? 'lgray' : 'white', 'plate');
  const wingMask = (x, z) => {
    if (style === 'jet') {
      // delta: wider toward the back
      const back = x - wingX; const reach = Math.round((wingD - back) * span / wingD);
      return (z < 0 && -z <= reach) || (z >= W && z - W + 1 <= reach);
    }
    if (style === 'airliner' || style === 'cargo') {
      const sweep = Math.floor(Math.abs(z < 0 ? z : z - W + 1) / 3);
      return x >= wingX - sweep && x < wingX + wingD - sweep - (Math.abs(z < 0 ? z : z - W + 1) > span - 2 ? 2 : 0);
    }
    return true;
  };
  const wingY = highWing ? base + 1 + layers * 3 : base;
  const wx0 = wingX - (style === 'airliner' || style === 'cargo' ? 3 : 0);
  const inWing = (x, z) => x >= (style === 'jet' || style === 'airliner' || style === 'cargo' ? 0 : wingX) && wingMask(x, z);
  b.fillMask(wingY, wx0, -span, wingD + 3, W + 2 * span, (x, z) => (z < 0 || z >= W || highWing) && inWing(x, z), main, 'plate');
  // second wing layer (under low wings, over high wings) running right across, so both wings lock to the plane
  b.fillMask(highWing ? wingY + 1 : wingY - 1, wx0, -span, wingD + 3, W + 2 * span, (x, z) => inWing(x, z) && (highWing || z < 0 || z >= W || x >= wingX), main, 'plate');
  if (style === 'biplane') {
    b.fillMask(base + 7, wingX, -span, wingD, W + 2 * span, () => true, main, 'plate');
    b.fillMask(base + 8, wingX, -span, wingD, W + 2 * span, () => true, main, 'plate');
    for (const z of [-span + 1, W + span - 2]) { b.add('round_1x1', wingX + 1, base + 1, z, 0, 'tan'); b.add('round_1x1', wingX + 1, base + 4, z, 0, 'tan'); }
  }
  // fuselage
  const fy = base + 1;
  for (let l = 0; l < layers; l++) {
    const yy = fy + l * 3;
    const isWin = l === layers - 1 && (style === 'airliner' || style === 'cargo');
    b.fill(yy, 0, 0, L - 2, W, (x, z) => (isWin && (z === 0 || z === W - 1) && x > 2 && x < L - 4 && x % 2 === 0) ? 'tclear' : main, 'brick');
  }
  const ty = fy + layers * 3;
  // nose
  if (W >= 4) {
    for (let z = 0; z < W; z += 2) b.add('slope_2x2', L - 2, fy + (layers - 1) * 3, z, 1, main);
    for (let l = 0; l < layers - 1; l++) b.fill(fy + l * 3, L - 2, 0, 2, W, main, 'brick');
    for (let z = 0; z < W; z += 2) b.add('slope_curve_2x2', L - 4, ty, z, 1, 'tblue');
  } else {
    b.add('slope_1x2', L - 2, fy, 0, 1, main); b.add('slope_1x2', L - 2, fy, 1, 1, main);
    b.add('slope_curve_1x2', L - 5, ty, 0, 1, 'tblue'); b.add('slope_curve_1x2', L - 5, ty, 1, 1, 'tblue');
    b.add('tile_1x2', L - 3, ty, 0, 0, main);
  }
  // tail plane across the back, then the rounded top
  if (style !== 'jet') tailPlane(b, 0, ty, -3, W + 6, main);
  if (W >= 4) roundTop(b, style !== 'jet' ? 2 : 0, ty, style !== 'jet' ? L - 6 : L - 4, W, main);
  else b.fill(ty, style !== 'jet' ? 2 : 0, 0, style !== 'jet' ? L - 7 : L - 5, W, main, 'tile');
  if (W >= 4) b.fillMask(ty + 2, 3, Math.floor(W / 2) - 1, L - 8, 2, (x) => x % 4 === 0, acc, 'tile');
  // propeller
  if (style === 'biplane' || style === 'prop' || style === 'seaplane') {
    b.add('cone_1x1', L - 1, fy + (W >= 4 ? 3 : 0) + 3, Math.floor(W / 2) - (W >= 4 ? 1 : 1), 0, 'lgray');
    b.add('propeller_1x1', L - 1, fy + (W >= 4 ? 3 : 0) + 6, Math.floor(W / 2) - 1, 0, 'black');
  }
  // engines under wings
  if (style === 'airliner' || style === 'cargo') {
    for (const z of [-4, W + 2]) { b.add('round_2x2', wingX - 2, base - 4, z, 0, 'lgray'); }
    if (style === 'cargo') for (const z of [-8, W + 6]) b.add('round_2x2', wingX - 3, base - 3 + (highWing ? 7 : 0), z, 0, 'lgray');
  }
  if (style === 'jet') {
    b.add('round_1x1', -1, fy, 0, 0, 'dgray'); b.add('round_1x1', -1, fy, 1, 0, 'dgray');
    b.add('light_1x1', -1, fy + 3, 0, 0, 'tred'); b.add('light_1x1', -1, fy + 3, 1, 0, 'tred');
  }
  // tail fin + stabiliser
  const finZ = Math.floor(W / 2) - (W === 2 ? 1 : 1);
  if (style === 'jet') { fin(b, 0, ty, 0, 1, acc); fin(b, 0, ty, 1, 1, acc); }
  else fin(b, 0, ty + 2, finZ, style === 'airliner' || style === 'cargo' ? 2 : 1, acc);
  b.add('light_1x1', wingX + 1, wingY + 1, -span, 0, 'tred');
  b.add('light_1x1', wingX + 1, wingY + 1, W + span - 1, 0, 'tgreen');
  return { style, main };
}

// ===================================================================== SPACE
export function genSpacecraft(b, rng, o = {}) {
  const style = o.style || rng.pick(['rocket', 'shuttle', 'starfighter', 'station', 'lander', 'satellite', 'saucer', 'rover', 'cruiser']);
  const main = o.color || rng.pick(['white', 'lgray', 'white', 'dgray', 'navy', 'black', 'azure']);
  const acc = o.accent || rng.pick(['red', 'orange', 'blue', 'yellow', 'tblue', 'lime', 'purple'].filter(c => c !== main));

  if (style === 'rocket') {
    const stages = o.stages || rng.int(2, 4);
    // launch pad with hazard tiles and a service tower
    b.fill(0, -1, -1, 8, 8, 'dgray', 'plate');
    b.fillMask(1, -1, -1, 8, 8, (x, z) => (x === -1 || z === -1 || x === 6 || z === 6) && (x + z) % 2 === 0, 'yellow', 'tile');
    // engines
    for (const [x, z] of [[1, 1], [4, 1], [1, 4], [4, 4]]) b.add('round_1x1', x, 1, z, 0, 'dgray');
    let y = 4;
    b.fill(y, 1, 1, 4, 4, 'black', 'plate'); y += 1;
    // first stage: 4x4 core with fins
    const h1 = rng.int(4, 6);
    for (let l = 0; l < h1; l++) b.fill(y + l * 3, 1, 1, 4, 4, l === 1 || l === h1 - 1 ? acc : main, 'brick');
    b.add('slope_1x2', -1, y, 2, 3, acc); b.add('slope_1x2', -1, y, 3, 3, acc);
    b.add('slope_1x2', 5, y, 2, 1, acc); b.add('slope_1x2', 5, y, 3, 1, acc);
    b.add('slope_1x2', 2, y, 5, 0, acc); b.add('slope_1x2', 3, y, 5, 0, acc);
    b.add('slope_1x2', 2, y, -1, 2, acc); b.add('slope_1x2', 3, y, -1, 2, acc);
    y += h1 * 3;
    // upper stages: 2x2 round sections
    for (let s2 = 1; s2 < stages; s2++) {
      b.fill(y, 1, 1, 4, 4, s2 === 1 ? 'black' : main, 'plate'); y += 1;
      const h = rng.int(2, 3);
      for (let l = 0; l < h; l++) b.add(l % 2 ? 'brick_2x2' : 'round_2x2', 2, y + l * 3, 2, 0, (l + s2) % 2 ? main : acc === 'tblue' ? 'white' : acc);
      for (let l = 0; l < h; l++) for (const [x, z] of [[1, 1], [4, 1], [1, 4], [4, 4]]) if (s2 === 1 && l === 0) b.add('round_1x1', x, y, z, 0, 'lgray');
      y += h * 3;
    }
    // capsule + nose
    b.add('round_2x2', 2, y, 2, 0, 'white'); y += 3;
    b.add('slope_1x2', 2, y, 2, 2, main);
    b.add('slope_1x2', 3, y, 2, 0, main);
    b.add('antenna_1x1', 3, y + 3, 2, 0, 'lgray');
    // service tower
    for (let l = 0; 1 + l * 3 < y; l++) b.add(l % 3 === 2 ? 'technic_1x2' : 'brick_1x2', 6, 1 + l * 3, 0, 0, l % 3 === 2 ? 'red' : 'lgray');
    return { style, main };
  }

  if (style === 'shuttle' || style === 'starfighter' || style === 'cruiser') {
    const L = style === 'shuttle' ? 16 : style === 'cruiser' ? rng.int(18, 24) : rng.int(10, 13);
    const W = style === 'starfighter' ? 2 : 4;
    const y0 = style === 'shuttle' ? 0 : 5;
    if (style !== 'shuttle') {
      b.fill(0, Math.floor(L / 2) - 2, -1, 4, W + 2, 'dgray', 'brick');
      b.fill(3, Math.floor(L / 2) - 2, -1, 4, W + 2, 'dgray', 'plate');
      b.fill(4, Math.floor(L / 2) - 2, -1, 4, W + 2, 'black', 'plate');
    } else {
      b.add('wheel_small', 4, 0, 0, 1, 'black'); b.add('wheel_small', 4, 0, W - 1, 1, 'black'); b.add('wheel_small', L - 4, 0, 1, 1, 'black');
    }
    const by = style === 'shuttle' ? 5 : y0;
    b.fill(by, 0, 0, L, W, style === 'shuttle' ? 'black' : main, 'plate');
    // wings
    const ws = style === 'starfighter' ? rng.int(4, 6) : style === 'cruiser' ? rng.int(3, 5) : 5;
    b.fillMask(by, 0, -ws, Math.floor(L * 0.6), W + 2 * ws, (x, z) => {
      const d = z < 0 ? -z : z - W + 1;
      return z < 0 || z >= W ? x < Math.floor(L * 0.6) - Math.floor(d * (style === 'starfighter' ? 0.6 : 1.1)) : false;
    }, main, 'plate');
    b.fillMask(by - 1, 0, -ws, Math.floor(L * 0.6), W + 2 * ws, (x, z) => {
      const d = z < 0 ? -z : z >= W ? z - W + 1 : 0;
      return x < Math.floor(L * 0.6) - Math.floor(d * (style === 'starfighter' ? 0.6 : 1.1));
    }, style === 'shuttle' ? 'black' : main, 'plate');
    if (style === 'starfighter') {
      b.fillMask(by + 4, 0, -ws, 4, W + 2 * ws, (x, z) => z < 0 || z >= W, acc, 'plate');
      for (const z of [-ws, W + ws - 1]) { b.add('round_1x1', 0, by + 1, z, 0, 'dgray'); b.add('cone_1x1', 3, by + 1, z, 1, acc); b.add('light_1x1', -0, by + 5, z, 0, 'tred'); }
    }
    b.fill(by + 1, 0, 0, L - 2, W, main, 'brick');
    if (style !== 'starfighter') b.fill(by + 4, 0, 0, L - 4, W, main, 'brick');
    const topY = by + (style === 'starfighter' ? 4 : 7);
    if (W === 4) {
      for (let z = 0; z < W; z += 2) b.add('slope_2x2', L - 2, by + 1, z, 1, style === 'shuttle' ? 'black' : main);
      for (let z = 0; z < W; z += 2) b.add('slope_2x2', L - 4, by + 4, z, 1, style === 'shuttle' ? 'black' : 'tblue');
      roundTop(b, 1, topY, L - 5, W, main);
      if (style === 'cruiser') {
        b.fill(topY + 2, 2, 1, 6, 2, acc, 'brick');
        b.add('window_1x2x2', 7, topY + 2, 1, 1, acc);
        b.add('dish_2x2', 3, topY + 5, 1, 0, 'lgray');
        b.add('antenna_1x1', 2, topY + 5, 1, 0, 'lgray');
        for (const z of [-ws, W + ws - 1]) b.add('technic_1x4', 0, by + 1, z, 0, 'dgray');
      }
    } else {
      b.add('slope_1x2', L - 2, by + 1, 0, 1, main); b.add('slope_1x2', L - 2, by + 1, 1, 1, main);
      b.add('slope_curve_1x2', L - 5, topY, 0, 1, 'tblue'); b.add('slope_curve_1x2', L - 5, topY, 1, 1, 'tblue');
      b.fill(topY, 0, 0, L - 5, W, main, 'tile');
    }
    // engines
    for (let z = 0; z < W; z++) b.add('round_1x1', -1, by + 1, z, 0, 'dgray');
    for (let z = 0; z < W; z++) b.add('light_1x1', -1, by + 4, z, 0, rng.pick(['tblue', 'tred', 'tyellow']));
    if (style === 'shuttle') { fin(b, 0, topY, 1, 2, main); }
    return { style, main };
  }

  if (style === 'station' || style === 'satellite') {
    const mods = style === 'station' ? rng.int(3, 5) : 1;
    // stand
    b.fill(0, 0, 0, 6, 6, 'black', 'plate');
    b.add('round_2x2', 2, 1, 2, 0, 'black'); b.add('round_2x2', 2, 4, 2, 0, 'black');
    b.add('round_2x2', 2, 7, 2, 0, 'dgray');
    const y = 10;
    const len = mods * 4;
    const x0 = 3 - Math.floor(len / 2);
    b.fill(y, x0, 2, len, 2, 'lgray', 'plate');
    for (let m = 0; m < mods; m++) {
      const mx = x0 + m * 4;
      b.fill(y + 1, mx, 2, 3, 2, m % 2 ? main : 'white', 'brick');
      b.add('round_2x2', mx + 3 > x0 + len - 1 ? mx : mx + 2, y + 4, 2, 0, acc === 'tblue' ? 'lgray' : 'lgray');
    }
    // solar panels on technic arms
    const panels = style === 'satellite' ? 1 : rng.int(1, 2);
    for (let p = 0; p < panels; p++) {
      const px = x0 + p * (len - 2);
      b.add('technic_1x6', px, y + 1, -4, 1, 'dgray');
      b.add('technic_1x6', px, y + 1, 4 + 2, 1, 'dgray');
      for (const yy of [y + 4, y + 5]) { b.fill(yy, px - 2, -6, 5, 7, yy === y + 4 ? 'dgray' : 'tblue', 'plate'); b.fill(yy, px - 2, 5, 5, 7, yy === y + 4 ? 'dgray' : 'tblue', 'plate'); }
    }
    b.add('dish_2x2', x0, y + 4, 2, 0, 'white');
    b.add('antenna_1x1', x0 + len - 1, y + 4, 2, 0, 'lgray');
    return { style, main };
  }

  if (style === 'lander' || style === 'rover') {
    if (style === 'rover') {
      for (const x of [0, 3, 6]) { b.add('wheel_large', x, 0, -1, 1, 'dgray'); b.add('wheel_large', x, 0, 4, 1, 'dgray'); }
      b.fill(3, 0, 0, 9, 4, 'lgray', 'plate');
      b.fill(4, 0, 0, 9, 4, main, 'brick');
      b.walls(7, 1, 0, 5, 4, 1, (x) => (x === 1 ? main : 'tclear'));
      b.add('windscreen_2x4', 6, 7, 0, 1, 'tblue');
      b.fill(10, 1, 0, 7, 4, main, 'plate');
      b.add('dish_2x2', 2, 11, 1, 0, 'white');
      b.add('antenna_1x1', 0, 7, 0, 0, 'lgray');
      b.add('technic_1x4', 9, 4, 1, 0, 'dgray');
      b.add('hinge_1x2', 12, 4, 1, 1, 'dgray');
      b.add('light_1x1', 8, 7, 0, 0, 'tyellow');
      return { style, main };
    }
    // lander: four legs, body, ascent stage
    for (const [x, z] of [[0, 0], [6, 0], [0, 6], [6, 6]]) { b.add('round_plate_1x1', x, 0, z, 0, 'dgray'); b.add('round_1x1', x, 1, z, 0, 'lgray'); b.add('round_1x1', x, 4, z, 0, 'lgray'); }
    b.fill(7, 0, 0, 7, 7, 'gold', 'plate');
    b.fill(8, 1, 1, 5, 5, 'gold', 'brick');
    b.fill(11, 1, 1, 5, 5, main, 'plate');
    b.fill(12, 2, 2, 3, 3, main, 'brick');
    b.add('window_1x2x2', 2, 15, 2, 0, 'lgray');
    b.fill(15, 4, 2, 1, 3, main, 'brick');
    b.fill(18, 2, 2, 3, 3, main, 'plate');
    b.add('dish_2x2', 2, 19, 2, 0, 'white');
    b.add('antenna_1x1', 4, 19, 4, 0, 'lgray');
    b.add('cone_1x1', 3, 5, 3, 2, 'dgray');
    return { style, main };
  }

  // saucer
  const R = o.R || rng.int(4, 6);
  const D = R * 2;
  b.add('round_2x2', R - 1, 0, R - 1, 0, 'dgray');
  b.add('round_2x2', R - 1, 3, R - 1, 0, 'dgray');
  b.voxel(6, 0, 0, D, 1, D, (x, l, z) => { const dx = x - R + 0.5, dz = z - R + 0.5; return dx * dx + dz * dz <= R * R ? main : null; }, 'plate');
  b.voxel(7, 0, 0, D, 1, D, (x, l, z) => { const dx = x - R + 0.5, dz = z - R + 0.5; const d2 = dx * dx + dz * dz; return d2 <= (R - 1) * (R - 1) ? main : (d2 <= R * R ? acc : null); }, 'brick');
  b.voxel(10, 0, 0, D, 1, D, (x, l, z) => { const dx = x - R + 0.5, dz = z - R + 0.5; return dx * dx + dz * dz <= (R - 1.5) * (R - 1.5) ? main : null; }, 'plate');
  b.voxel(11, 0, 0, D, 2, D, (x, l, z) => { const dx = x - R + 0.5, dz = z - R + 0.5; const r = 2.2 - l * 0.9; return dx * dx + dz * dz <= r * r ? 'tgreen' : null; }, 'brick');
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; b.add('light_1x1', Math.round(R - 0.5 + Math.cos(a) * (R - 1.5)), 10 + 1, Math.round(R - 0.5 + Math.sin(a) * (R - 1.5)), 0, rng.pick(['tyellow', 'tred', 'tblue'])); }
  return { style: 'saucer', main };
}
