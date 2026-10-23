// generators/buildings.js — houses & buildings, castles, architecture.
// Front facades face +Z. A storey is 3 brick layers (9 plates) plus a 1-plate floor.

/** Fill a run along X with the longest pieces of a family (e.g. slopes). */
function runX(b, ids, x0, len, y, z, r, c) {
  let x = x0;
  while (x < x0 + len) {
    let placed = false;
    for (const [id, w] of ids) {
      if (x + w <= x0 + len && b.fits(id, x, y, z, r) && b.add(id, x, y, z, r, c)) { x += w; placed = true; break; }
    }
    if (!placed) x++;
  }
}
/** Evenly spaced 2-wide window positions, centred between cells a and bEnd. */
export function centredSlots(a, bEnd, step) {
  const N = bEnd - a + 1;
  for (const st of [step, step + 1, step - 1, step + 2]) {
    if (st < 3) continue;
    const k = Math.floor((N + st - 4) / st);
    if (k < 1) continue;
    const total = k * st - (st - 2);
    if ((N - total) % 2 === 0) { const s0 = a + (N - total) / 2; return Array.from({ length: k }, (_, i) => s0 + i * st); }
  }
  const k = Math.max(0, Math.floor((N + step - 4) / step));
  const total = k * step - (step - 2);
  return Array.from({ length: k }, (_, i) => a + Math.floor((N - total) / 2) + i * step);
}
const SLOPE_RUN = [['slope_4x2', 4], ['slope_2x2', 2], ['slope_1x2', 1]];

/** Gable roof over x0..x0+W, z0..z0+D, starting at plate y. Ridge runs along X. */
export function gableRoof(b, x0, z0, W, D, y, roof, wall) {
  let k = 0;
  while (D - 2 * k > 2) {
    const yy = y + 3 * k;
    runX(b, SLOPE_RUN, x0, W, yy, z0 + k, 2, roof);
    runX(b, SLOPE_RUN, x0, W, yy, z0 + D - 2 - k, 0, roof);
    const inner = D - 4 - 2 * k;
    if (inner > 0) b.fillMask(yy, x0, z0 + k + 2, W, inner, () => true, (x) => (x === x0 || x === x0 + W - 1 ? wall : roof), 'brick');
    k++;
  }
  const yy = y + 3 * k;
  const rem = D - 2 * k;
  if (rem === 2) { runX(b, [['slope_curve_2x2', 2]], x0, W, yy, z0 + k, 2, roof); }
  else if (rem === 1) b.fill(yy, x0, z0 + k, W, 1, roof, 'tile');
  return yy + 2;
}

/** One storey of walls with window and door openings. Returns next floor y. */
function storey(b, rng, x0, z0, W, D, y, wall, opts) {
  const { winColor = 'white', door = null, winEvery = 3, glassWall = false, trim = null } = opts;
  const holes = new Set();
  const winSpots = [];
  // windows on front and back
  for (const z of [z0, z0 + D - 1]) for (const x of centredSlots(x0 + 1, x0 + W - 2, winEvery)) winSpots.push({ x, z, r: 0 });
  for (const x of [x0, x0 + W - 1]) for (const z of centredSlots(z0 + 1, z0 + D - 2, winEvery + 1)) winSpots.push({ x, z, r: 1 });
  const doorSpot = door != null ? { x: door, z: z0 + D - 1 } : null;
  const spots = winSpots.filter(s => !(doorSpot && s.r === 0 && s.z === doorSpot.z && s.x + 1 >= doorSpot.x && s.x <= doorSpot.x + 1));
  for (const s of spots) for (let i = 0; i < 2; i++) for (const yy of [y + 3, y + 6]) holes.add(s.r ? `${s.x},${yy},${s.z + i}` : `${s.x + i},${yy},${s.z}`);
  if (doorSpot) for (let i = 0; i < 2; i++) for (const yy of [y, y + 3, y + 6]) holes.add(`${doorSpot.x + i},${yy},${doorSpot.z}`);
  const colorFn = (x, yy, z) => (glassWall && !(x === x0 || x === x0 + W - 1 || z === z0 || z === z0 + D - 1 ? (x === x0 || x === x0 + W - 1) && (z === z0 || z === z0 + D - 1) : false) && (x === x0 || x === x0 + W - 1) && (z === z0 || z === z0 + D - 1) ? wall : (yy === y && trim ? trim : wall));
  b.walls(y, x0, z0, W, D, 3, glassWall ? (x, yy, z) => (((x === x0 || x === x0 + W - 1) && (z === z0 || z === z0 + D - 1)) || yy === y ? wall : 'tblue') : colorFn, (x, yy, z) => holes.has(`${x},${yy},${z}`));
  for (const s of spots) b.add('window_1x2x2', s.x, y + 3, s.z, s.r, winColor);
  if (doorSpot) b.add('door_1x2x3', doorSpot.x, y, doorSpot.z, 0, opts.doorColor || rng.pick(['red', 'blue', 'brown', 'dgreen', 'yellow']));
  return y + 9;
}

const WALLS = ['white', 'tan', 'lgray', 'azure', 'yellow', 'pink', 'lime', 'orange', 'dred', 'brown', 'teal'];
const ROOFS = ['dred', 'red', 'dgray', 'black', 'brown', 'navy', 'dgreen', 'blue'];

export function genHouse(b, rng, o = {}) {
  const style = o.style || rng.pick(['cottage', 'modern', 'townhouse', 'barn', 'beachhut', 'shop', 'apartment', 'cabin', 'villa', 'firestation']);
  const wall = o.wall || ({ barn: 'red', cabin: 'brown', modern: rng.pick(['white', 'lgray']), firestation: 'dred', apartment: rng.pick(['tan', 'lgray', 'white', 'orange']) })[style] || rng.pick(WALLS);
  const roof = o.roof || (style === 'barn' ? 'dgray' : rng.pick(ROOFS));
  const W = o.W || ({ cottage: rng.int(8, 11), modern: rng.int(10, 13), townhouse: rng.int(6, 7), barn: rng.int(10, 13), beachhut: 6, shop: rng.int(8, 11), apartment: rng.int(10, 12), cabin: rng.int(8, 9), villa: rng.int(14, 18), firestation: 14 })[style];
  const D = o.D || ({ cottage: rng.int(6, 8), modern: rng.int(7, 9), townhouse: 6, barn: rng.int(8, 10), beachhut: 5, shop: 7, apartment: 8, cabin: 6, villa: rng.int(9, 11), firestation: 10 })[style];
  const floors = o.floors || ({ cottage: rng.int(1, 2), modern: rng.int(1, 2), townhouse: 3, barn: 1, beachhut: 1, shop: 2, apartment: rng.int(3, 4), cabin: 1, villa: 2, firestation: 2 })[style];
  const garden = !['apartment', 'shop', 'firestation'].includes(style);
  const pad = 2;
  // base
  b.fill(0, -pad, -pad, W + pad * 2, D + pad * 2 + 2, garden ? 'green' : 'lgray', 'plate');
  let y = 1;
  if (style === 'beachhut') {
    for (const [x, z] of [[0, 0], [W - 1, 0], [0, D - 1], [W - 1, D - 1]]) { b.add('round_1x1', x, 1, z, 0, 'brown'); b.add('round_1x1', x, 4, z, 0, 'brown'); }
    b.fill(7, 0, 0, W, D + 2, 'tan', 'plate');
    y = 8;
    for (let l = 0; l < 2; l++) b.add('brick_1x2', W + 1 - 1, 1 + l * 3 + 0, D + 2, 0, 'tan');
  }
  const doorX = x => Math.floor(W / 2) - 1;
  for (let f = 0; f < floors; f++) {
    const glass = style === 'modern' && f === 0;
    const isGround = f === 0;
    if (style === 'barn' || style === 'firestation') {
      // big doors
      const holes = new Set();
      const doors = style === 'firestation' ? [2, 8] : [Math.floor(W / 2) - 2];
      if (isGround) for (const dx of doors) for (let i = 0; i < 4; i++) for (let l = 0; l < 3; l++) holes.add(`${dx + i},${y + l * 3},${D - 1}`);
      const upWins = isGround ? [] : centredSlots(1, W - 2, 4);
      for (const x of upWins) for (let i = 0; i < 2; i++) for (const yy of [y + 3, y + 6]) holes.add(`${x + i},${yy},${D - 1}`);
      b.walls(y, 0, 0, W, D, 3, (x, yy, z) => (style === 'barn' && (x === 0 || x === W - 1) && (z === 0 || z === D - 1) ? 'white' : wall), (x, yy, z) => holes.has(`${x},${yy},${z}`));
      if (isGround) for (const dx of doors) { b.add('door_1x2x3', dx, y, D - 1, 0, 'white'); b.add('door_1x2x3', dx + 2, y, D - 1, 0, 'white'); }
      for (const x of upWins) b.add('window_1x2x2', x, y + 3, D - 1, 0, 'white');
      y += 9;
    } else {
      y = storey(b, rng, 0, 0, W, D, y, wall, { door: isGround ? doorX() : null, winColor: style === 'modern' ? 'dgray' : rng.pick(['white', 'white', 'dgray', 'brown']), glassWall: glass, winEvery: style === 'apartment' ? 3 : 4, trim: style === 'villa' ? 'white' : null });
    }
    if (f < floors - 1 || style === 'modern' || style === 'apartment' || style === 'shop' || style === 'firestation') {
      b.fill(y, -(style === 'modern' ? 1 : 0), 0, W + (style === 'modern' ? 2 : 0), D + (style === 'modern' && f === 0 ? 1 : 0), style === 'modern' ? 'white' : wall === 'white' ? 'lgray' : 'white', 'plate');
      y += 1;
    }
  }
  // roof
  if (style === 'modern' || style === 'apartment' || style === 'shop' || style === 'firestation') {
    b.walls(y, 0, 0, W, D, 1, style === 'modern' ? 'white' : wall);
    if (style !== 'shop') b.fill(y, 2, 2, 2, 2, 'lgray', 'brick'), b.add('grille_1x2', 2, y + 3, 2, 0, 'dgray');
    b.add('antenna_1x1', W - 2, y, 1, 0, 'lgray');
    if (style === 'firestation') { b.add('light_1x1', 1, y + 3, D - 1, 0, 'tred'); b.add('light_1x1', W - 2, y + 3, D - 1, 0, 'tred'); }
  } else {
    const ry = style === 'cottage' || style === 'cabin' || style === 'villa' || style === 'barn' ? y : y;
    b.fill(ry, -1, -1, W + 2, D + 2, roof, 'plate');
    gableRoof(b, -1, -1, W + 2, D + 2, ry + 1, roof, wall);
    if (style === 'cottage' || style === 'cabin') {
      const cx = W - 3;
      for (let l = 0; l < 4; l++) b.add('brick_1x2', cx, ry + 1 + l * 3, 1, 0, 'dgray');
    }
  }
  // shop awning
  if (style === 'shop') {
    runX(b, [['slope_2x2', 2], ['slope_1x2', 1]], 0, W, 7 - 0, D, 0, rng.pick(['red', 'azure', 'green', 'orange']));
    b.add('tile_1x4', 1, y - 1 + 0, D, 1, 'white');
  }
  // garden & path
  if (garden) {
    b.fill(1, doorX(), D, 2, pad + 2, 'tan', 'tile');
    for (let i = 0; i < 4; i++) b.add('flower_1x1', rng.int(-pad, W + pad - 1), 1, D + rng.int(0, pad + 1), 0, rng.pick(['red', 'yellow', 'pink', 'white', 'purple']));
    if (rng.chance(0.6)) { const tx = -pad; b.add('brick_1x1', tx, 1, -pad, 0, 'brown'); b.fill(4, tx - 1 + 1, -pad, 2, 2, 'green', 'brick'); }
    if (style === 'villa') b.fill(1, W - 4, D + 1, 4, 2, 'tblue', 'tile');
  }
  return { style, main: wall };
}

// ===================================================================== CASTLES
function crenels(b, x0, z0, W, D, y, c) {
  for (let x = x0; x + 2 <= x0 + W; x += 3) { b.add('crenel_1x2', x, y, z0, 0, c); b.add('crenel_1x2', x, y, z0 + D - 1, 0, c); }
  for (let z = z0 + 1; z + 2 <= z0 + D - 1; z += 3) { b.add('crenel_1x2', x0, y, z, 1, c); b.add('crenel_1x2', x0 + W - 1, y, z, 1, c); }
}
function tower(b, rng, x, z, size, base, layers, stone, roofC, round) {
  if (round) {
    const R = size / 2;
    b.voxel(base, x, z, size, layers, size, (xx, l, zz) => {
      const dx = xx - x - R + 0.5, dz = zz - z - R + 0.5; const d = dx * dx + dz * dz;
      return d <= R * R && d >= (R - 1.3) * (R - 1.3) ? ((l + xx + zz) % 7 === 0 ? 'dgray' : stone) : null;
    });
  } else {
    b.walls(base, x, z, size, size, layers, (xx, yy, zz) => ((xx + zz + yy) % 5 === 0 ? 'dgray' : stone), (xx, yy, zz) => yy === base + 3 * (layers - 2) && (xx === x + Math.floor(size / 2) || zz === z + Math.floor(size / 2)) && !(xx === x || xx === x + size - 1) !== !(zz === z || zz === z + size - 1));
  }
  const top = base + layers * 3;
  b.fill(top, x, z, size, size, 'dgray', 'plate');
  if (roofC) {
    if (size >= 4) gableRoof(b, x, z, size, size, top + 1, roofC, stone);
    else b.add('cone_1x1', x + 1, top + 1, z + 1, 0, roofC);
    const peak = top + 1 + 3 * Math.floor(size / 2);
    b.add('antenna_1x1', x + Math.floor(size / 2), peak, z + Math.floor(size / 2) - 1, 0, 'dgray');
  } else crenels(b, x, z, size, size, top + 1, stone);
  return top;
}

export function genCastle(b, rng, o = {}) {
  const style = o.style || rng.pick(['fortress', 'palace', 'ruin', 'desertfort', 'darkkeep', 'watchtower', 'outpost', 'gatehouse']);
  const stone = ({ desertfort: 'tan', darkkeep: 'dgray', palace: 'white' })[style] || rng.pick(['lgray', 'lgray', 'dgray', 'tan']);
  const roofC = ({ palace: rng.pick(['azure', 'pink', 'blue', 'purple']), darkkeep: 'purple', desertfort: null, ruin: null })[style] ?? (rng.chance(0.6) ? rng.pick(['dred', 'blue', 'dgreen', 'navy']) : null);
  if (style === 'watchtower') {
    b.fill(0, -1, -1, 8, 8, 'dgreen', 'plate');
    const size = 6;
    const layers = rng.int(5, 7);
    b.walls(1, 0, 0, size, size, layers, (x, y, z) => ((x + z + y) % 4 === 0 ? 'dgray' : stone), (x, y, z) => z === size - 1 && x >= 2 && x <= 3 && y < 10);
    b.add('door_1x2x3', 2, 1, size - 1, 0, 'brown');
    const top = 1 + layers * 3;
    b.fill(top, -1, -1, size + 2, size + 2, 'brown', 'plate');
    crenels(b, -1, -1, size + 2, size + 2, top + 1, stone);
    if (roofC) { for (const [x, z] of [[0, 0], [5, 0], [0, 5], [5, 5]]) { b.add('round_1x1', x, top + 1, z, 0, 'brown'); b.add('round_1x1', x, top + 4, z, 0, 'brown'); } b.fill(top + 7, -1, -1, size + 2, size + 2, roofC, 'plate'); gableRoof(b, -1, -1, size + 2, size + 2, top + 8, roofC, stone); }
    b.add('round_1x1', 2, top + 1, 2, 0, 'brown'); b.add('cone_1x1', 2, top + 4, 2, 0, 'tyellow');
    return { style, main: stone };
  }
  const S = o.S || ({ fortress: rng.int(16, 20), palace: rng.int(16, 20), ruin: rng.int(12, 16), desertfort: rng.int(14, 18), darkkeep: rng.int(16, 20), outpost: rng.int(10, 12), gatehouse: 12 })[style];
  const wallL = ({ fortress: 4, palace: 4, ruin: 3, desertfort: 3, darkkeep: 5, outpost: 3, gatehouse: 5 })[style];
  const ts = style === 'outpost' ? 3 : 4;
  const round = style === 'palace' || (style === 'fortress' && rng.chance(0.4));
  b.fill(0, -2, -2, S + 4, S + 4, style === 'desertfort' ? 'tan' : style === 'darkkeep' ? 'black' : 'dgreen', 'plate');
  const gateX = Math.floor(S / 2) - 2;
  const ruinHole = (x, y, z) => style === 'ruin' && ((x * 7 + z * 13 + y * 3) % 11 === 0 || (y > 4 && (x * 5 + z * 3) % 7 === 0));
  if (style !== 'gatehouse') {
    b.walls(1, 0, 0, S, S, wallL, (x, y, z) => ((x + z + y) % 6 === 0 ? 'dgray' : stone), (x, y, z) => (z === S - 1 && x >= gateX && x < gateX + 4 && y < 1 + 15) || ruinHole(x, y, z));
  } else {
    b.walls(1, 0, S - 4, S, 4, wallL, (x, y, z) => ((x + z + y) % 6 === 0 ? 'dgray' : stone), (x, y, z) => (z === S - 1 || z === S - 4) && x >= gateX && x < gateX + 4 && y < 16);
    b.add('door_1x4x5', gateX, 1, S - 4, 0, 'dgray');
  }
  b.add('door_1x4x5', gateX, 1, S - 1, 0, style === 'darkkeep' ? 'black' : 'brown');
  b.add('arch_1x4', gateX, 16, S - 1, 0, stone);
  const wtop = 1 + wallL * 3;
  if (style !== 'ruin') crenels(b, 0, 0, S, S, wtop, stone);
  // towers
  const corners = [[-1, -1], [S - ts + 1, -1], [-1, S - ts + 1], [S - ts + 1, S - ts + 1]];
  for (const [x, z] of corners) {
    if (style === 'ruin' && rng.chance(0.4)) continue;
    tower(b, rng, x, z, ts, 1, wallL + (style === 'ruin' ? rng.int(0, 2) : rng.int(2, 3)), stone, roofC, round && ts >= 4);
  }
  // keep
  if (style !== 'outpost' && style !== 'gatehouse') {
    const kw = Math.floor(S * 0.45), kx = Math.floor((S - kw) / 2), kz = 2;
    let ky = 1;
    for (let f = 0; f < (style === 'palace' || style === 'darkkeep' ? 2 : 1); f++) ky = storey(b, rng, kx, kz, kw, kw - 2, ky, stone, { door: f === 0 ? kx + Math.floor(kw / 2) - 1 : null, winColor: style === 'palace' ? 'gold' : 'dgray', winEvery: 3, doorColor: 'brown' }) , b.fill(ky, kx, kz, kw, kw - 2, 'dgray', 'plate'), ky++;
    if (roofC) gableRoof(b, kx, kz, kw, kw - 2, ky, roofC, stone); else crenels(b, kx, kz, kw, kw - 2, ky, stone);
    if (style === 'palace') { tower(b, rng, kx + Math.floor(kw / 2) - 1, kz + 1, 3, ky, 3, stone, roofC, false); }
  }
  // courtyard props
  b.add('round_2x2', 3, 1, S - 5, 0, 'dgray');
  b.add('round_1x1', S - 4, 1, S - 4, 0, 'brown');
  b.add('round_1x1', S - 5, 1, S - 4, 0, 'brown');
  if (style === 'darkkeep') { b.add('light_1x1', gateX - 1, wtop, S - 1, 0, 'tgreen'); b.add('light_1x1', gateX + 4, wtop, S - 1, 0, 'tgreen'); }
  for (let i = 0; i < 3; i++) b.add('flower_1x1', -2 + i * 2, 1, S + 1, 0, 'yellow');
  return { style, main: stone };
}

// ===================================================================== ARCHITECTURE
export function genArchitecture(b, rng, o = {}) {
  const style = o.style || rng.pick(['skyscraper', 'lighthouse', 'pyramid', 'bridge', 'temple', 'windmill', 'pagoda', 'dome', 'tvtower', 'stadium', 'clocktower', 'arch']);
  const accent = rng.pick(['gold', 'dred', 'navy', 'dgreen', 'azure', 'teal']);
  switch (style) {
    case 'skyscraper': {
      const glass = rng.pick(['tblue', 'tclear', 'tgreen']);
      const frame = rng.pick(['lgray', 'white', 'dgray', 'black', 'tan']);
      let w = o.W || rng.int(6, 8), d = w, x0 = 0, z0 = 0;
      const tiers = rng.int(2, 3);
      b.fill(0, -2, -2, w + 4, d + 4, 'dgray', 'plate');
      let y = 1;
      for (let t = 0; t < tiers; t++) {
        const fl = rng.int(3, 5) + (t === 0 ? 2 : 0);
        for (let f = 0; f < fl; f++) {
          b.walls(y, x0, z0, w, d, 1, (x, yy, z) => (((x - x0) % 3 === 0 || x === x0 + w - 1) && ((z - z0) % 3 === 0 || z === z0 + d - 1) ? frame : glass));
          b.fill(y + 3, x0, z0, w, d, frame, 'plate');
          y += 4;
        }
        if (t < tiers - 1) { x0 += 1; z0 += 1; w -= 2; d -= 2; }
      }
      b.walls(y, x0, z0, w, d, 1, frame);
      b.add('round_1x1', x0 + Math.floor(w / 2) - 1, y, z0 + Math.floor(d / 2) - 1, 0, frame);
      b.add('antenna_1x1', x0 + Math.floor(w / 2) - 1, y + 3, z0 + Math.floor(d / 2) - 1, 0, 'lgray');
      b.add('light_1x1', x0 + Math.floor(w / 2) - 1, y + 9, z0 + Math.floor(d / 2) - 1, 0, 'tred');
      return { style, main: glass };
    }
    case 'lighthouse': {
      b.voxel(0, -3, -3, 12, 1, 12, (x, l, z) => { const d = Math.hypot(x - 2.5, z - 2.5); return d < 5.5 ? (d > 4.3 ? 'dgray' : 'lgray') : null; });
      const H = rng.int(6, 8);
      const stripe = rng.pick(['red', 'blue', 'black', 'dgreen']);
      for (let l = 0; l < H; l++) {
        const R = 3 - l * (1.4 / H);
        b.voxel(3 + l * 3, 0, 0, 6, 1, 6, (x, ll, z) => { const d = Math.hypot(x - 2.5, z - 2.5); return d <= R ? (l % 2 ? stripe : 'white') : null; });
      }
      const ty = 3 + H * 3;
      b.fill(ty, 0, 0, 6, 6, 'black', 'plate');
      b.voxel(ty + 1, 1, 1, 4, 1, 4, () => 'tyellow');
      b.fill(ty + 4, 1, 1, 4, 4, stripe, 'plate');
      b.add('round_2x2', 2, ty + 5, 2, 0, stripe);
      b.add('cone_1x1', 2, ty + 8, 2, 0, 'black');
      b.add('door_1x2x3', 2, 3, 5, 0, 'brown');
      return { style, main: stripe };
    }
    case 'pyramid': {
      const N = o.N || rng.int(12, 18);
      const c = rng.pick(['tan', 'yellow', 'gold', 'lgray']);
      for (let l = 0; 2 * l < N - 1; l++) b.walls(l * 3, l, l, N - 2 * l, N - 2 * l, 1, (x, y, z) => ((x + z) % 5 === 0 ? 'white' : c)), b.fillMask(l * 3, l + 1, l + 1, N - 2 * l - 2, N - 2 * l - 2, () => true, c, 'brick');
      const top = Math.floor((N - 1) / 2);
      b.add('cone_1x1', top, top * 3 + 3, top, 0, 'gold');
      b.add('door_1x2x3', Math.floor(N / 2) - 1, 0, N - 1, 0, 'black');
      return { style, main: c };
    }
    case 'bridge': {
      const L = rng.int(24, 32), W = 4, H = rng.int(4, 6);
      const c = rng.pick(['red', 'orange', 'lgray', 'navy']);
      b.fill(0, -2, -3, L + 4, W + 6, 'tblue', 'plate');
      const deckY = 1 + H * 3;
      for (const tx of [Math.floor(L / 4), Math.floor(3 * L / 4) - 2]) {
        for (const z of [-1, W]) for (let l = 0; l < H + 4; l++) b.add('brick_2x2', tx, 1 + l * 3, z === -1 ? -2 : W, 0, c);
        b.fill(1 + (H + 4) * 3, tx, -2, 2, W + 4, c, 'brick');
        b.add('light_1x1', tx, 1 + (H + 5) * 3, -2, 0, 'tred');
      }
      b.fill(deckY, 0, 0, L, W, 'dgray', 'plate');
      b.fill(deckY + 1, 0, 0, L, W, (x, z) => (z === 1 || z === 2) && x % 3 === 0 ? 'white' : 'black', 'tile');
      for (let x = 0; x + 1 < L; x += 4) { b.add('round_1x1', x, deckY + 1, -1, 0, c); b.add('round_1x1', x, deckY + 1, W, 0, c); }
      b.fill(deckY + 4, 0, -1, L, 1, c, 'plate'); b.fill(deckY + 4, 0, W, L, 1, c, 'plate');
      for (const ax of [0, L - 6]) { b.add('arch_1x6', ax, 1, -1, 0, c); b.add('arch_1x6', ax, 1, W, 0, c); }
      return { style, main: c };
    }
    case 'temple': {
      const W = rng.int(12, 16), D = rng.int(8, 10);
      const c = rng.pick(['white', 'tan', 'lgray']);
      b.fill(0, -2, -2, W + 4, D + 4, c === 'white' ? 'lgray' : 'dgray', 'plate');
      b.fill(1, -1, -1, W + 2, D + 2, c, 'brick');
      b.fill(4, 0, 0, W, D, c, 'plate');
      const colH = rng.int(4, 5);
      for (let x = 0; x + 2 <= W; x += 3) for (const z of [0, D - 2]) for (let l = 0; l < colH; l++) b.add('round_2x2', x, 5 + l * 3, z, 0, c);
      b.walls(5, 3, 3, W - 6, D - 6, colH, c);
      const ty = 5 + colH * 3;
      b.fill(ty, -1, -1, W + 2, D + 2, c, 'plate');
      b.fill(ty + 1, -1, -1, W + 2, D + 2, accent, 'plate');
      gableRoof(b, -1, -1, W + 2, D + 2, ty + 2, c, c);
      return { style, main: c };
    }
    case 'windmill': {
      const c = rng.pick(['white', 'tan', 'brown', 'red']);
      b.fill(0, -2, -2, 10, 10, 'green', 'plate');
      for (let l = 0; l < 6; l++) { const R = 3 - l * 0.25; b.voxel(1 + l * 3, 0, 0, 6, 1, 6, (x, ll, z) => (Math.hypot(x - 2.5, z - 2.5) <= R && !(l < 3 && z >= 4 && (x === 2 || x === 3)) ? c : null)); }
      b.add('door_1x2x3', 2, 1, 4, 0, 'brown');
      b.fill(19, 0, 0, 6, 6, 'dred', 'plate');
      gableRoof(b, 0, 0, 6, 6, 20, 'dred', c);
      // sails: a technic cross on a hub, centred on the tower, with cloth on both arms
      b.add('technic_1x2', 2, 14, 5, 0, 'dgray');
      for (const y of [8, 11, 17, 20]) b.add('technic_1x2', 2, y, 7, 1, 'brown');
      b.add('technic_1x6', 0, 14, 7, 1, 'brown');
      b.fill(17, -2, 7, 4, 1, 'white', 'plate'); b.fill(17, 4, 7, 4, 1, 'white', 'plate');
      return { style, main: c };
    }
    case 'pagoda': {
      const tiers = rng.int(3, 5);
      const c = rng.pick(['dred', 'red']);
      const roofC = rng.pick(['dgreen', 'black', 'navy', 'gold']);
      b.fill(0, -3, -3, 14, 14, 'lgray', 'plate');
      let y = 1, s = 8, o2 = 0;
      for (let t = 0; t < tiers; t++) {
        b.walls(y, o2, o2, s, s, 2, (x, yy, z) => ((x - o2) % 3 === 0 && (z === o2 || z === o2 + s - 1) ? 'black' : c));
        y += 6;
        b.fill(y, o2 - 1, o2 - 1, s + 2, s + 2, roofC, 'plate');
        runX(b, [['slope_2x2', 2], ['slope_1x2', 1]], o2 - 1, s + 2, y + 1, o2 - 1, 2, roofC);
        runX(b, [['slope_2x2', 2], ['slope_1x2', 1]], o2 - 1, s + 2, y + 1, o2 + s - 1, 0, roofC);
        y += 1;
        if (s > 3) { o2 += 1; s -= 2; }
      }
      b.add('round_1x1', o2 + Math.floor(s / 2) - 1, y + 3, o2 + Math.floor(s / 2) - 1, 0, 'gold');
      b.add('cone_1x1', o2 + Math.floor(s / 2) - 1, y + 6, o2 + Math.floor(s / 2) - 1, 0, 'gold');
      return { style, main: c };
    }
    case 'dome': {
      const c = rng.pick(['white', 'tan', 'lgray']);
      const dc = rng.pick(['gold', 'azure', 'teal', 'lgray']);
      const S = 12, R = 5;
      b.fill(0, -2, -2, S + 4, S + 4, 'lgray', 'plate');
      b.walls(1, 0, 0, S, S, 3, (x, y, z) => ((x + z) % 3 === 0 ? 'white' : c));
      b.fill(10, 0, 0, S, S, c, 'plate');
      for (let l = 0; l < 5; l++) { const r = Math.sqrt(Math.max(0, R * R - (l * 1.25) * (l * 1.25))); b.voxel(11 + l * 3, 0, 0, S, 1, S, (x, ll, z) => (Math.hypot(x - 5.5, z - 5.5) <= r ? dc : null)); }
      b.add('antenna_1x1', 5, 26, 5, 0, 'gold');
      b.add('door_1x2x3', 5, 1, S - 1, 0, 'brown');
      for (const [x, z] of [[-2, -2], [S, -2], [-2, S], [S, S]]) for (let l = 0; l < 6; l++) b.add(l < 5 ? 'round_2x2' : 'cone_1x1', x, 1 + l * 3, z, 0, c);
      return { style, main: dc };
    }
    case 'tvtower': {
      const c = rng.pick(['lgray', 'white', 'red']);
      b.fill(0, -2, -2, 8, 8, 'dgray', 'plate');
      for (let l = 0; l < 10; l++) b.add('round_2x2', 1, 1 + l * 3, 1, 0, c);
      const py = 31;
      b.voxel(py, -2, -2, 8, 1, 8, (x, l, z) => (Math.hypot(x - 1.5, z - 1.5) <= 3.6 ? 'tblue' : null));
      b.voxel(py + 3, -2, -2, 8, 1, 8, (x, l, z) => (Math.hypot(x - 1.5, z - 1.5) <= 3.6 ? c : null), 'plate');
      for (let l = 0; l < 3; l++) b.add('round_1x1', 1, py + 4 + l * 3, 1, 0, c);
      b.add('antenna_1x1', 1, py + 13, 1, 0, 'lgray');
      b.add('light_1x1', 1, py + 19, 1, 0, 'tred');
      return { style, main: c };
    }
    case 'stadium': {
      const R = 9;
      b.fill(0, 0, 0, 2 * R + 2, 2 * R + 2, 'dgray', 'plate');
      b.voxel(1, 3, 4, 2 * R - 4, 1, 2 * R - 6, () => 'green', 'plate');
      for (let l = 0; l < 4; l++) b.voxel(1 + l * 3, 0, 0, 2 * R + 2, 1, 2 * R + 2, (x, ll, z) => { const d = Math.hypot((x - R + 0.5) / 1, (z - R + 0.5) / 0.85); return d <= R + 1 && d >= R - 2.5 + l * 0.9 ? (l === 3 ? accent : ((x + z) % 4 === 0 ? 'white' : 'lgray')) : null; });
      for (const [x, z] of [[0, 0], [2 * R + 1, 0], [0, 2 * R + 1], [2 * R + 1, 2 * R + 1]]) for (let l = 0; l < 6; l++) b.add(l < 5 ? 'round_1x1' : 'light_1x1', x, 1 + l * 3, z, 0, l < 5 ? 'lgray' : 'tyellow');
      b.fill(2, R - 1, R - 3, 2, 1, 'white', 'tile');
      return { style, main: accent };
    }
    case 'clocktower': {
      const c = rng.pick(['tan', 'brown', 'lgray', 'dred']);
      b.fill(0, -1, -1, 8, 8, 'lgray', 'plate');
      b.walls(1, 0, 0, 6, 6, 9, (x, y, z) => ((y - 1) % 9 === 0 ? 'dgray' : c), (x, y, z) => z === 5 && (x === 2 || x === 3) && y < 10);
      b.add('door_1x2x3', 2, 1, 5, 0, 'dgreen');
      b.fill(28, -1, -1, 8, 8, 'dgray', 'plate');
      b.walls(29, 0, 0, 6, 6, 1, (x, y, z) => ((x === 2 || x === 3) || (z === 2 || z === 3) ? 'white' : 'gold'));
      b.fill(32, 0, 0, 6, 6, 'dgray', 'plate');
      gableRoof(b, 0, 0, 6, 6, 33, accent === 'gold' ? 'dgreen' : accent, c);
      b.add('antenna_1x1', 2, 42, 2, 0, 'gold');
      return { style, main: c };
    }
    default: { // triumphal arch
      const c = rng.pick(['white', 'tan', 'lgray']);
      b.fill(0, -1, -1, 16, 6, 'lgray', 'plate');
      b.fill(1, 0, 0, 4, 4, c, 'brick'); b.fill(1, 10, 0, 4, 4, c, 'brick');
      for (let l = 1; l < 5; l++) { b.fill(1 + l * 3, 0, 0, 4, 4, c, 'brick'); b.fill(1 + l * 3, 10, 0, 4, 4, c, 'brick'); }
      b.add('arch_1x6', 4, 10, 0, 0, c); b.add('arch_1x6', 4, 10, 3, 0, c);
      b.fill(10, 4, 1, 6, 2, c, 'brick');
      b.fill(16, 0, 0, 14, 4, c, 'brick');
      b.fill(19, 0, 0, 14, 4, accent, 'plate');
      b.fill(20, 0, 0, 14, 4, c, 'brick');
      b.fill(23, 1, 1, 12, 2, 'gold', 'tile');
      return { style: 'arch', main: c };
    }
  }
}
