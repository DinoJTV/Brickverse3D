// generators/misc.js — robots & mechs, boats & ships.

const ROBOT_COLORS = [['lgray', 'red'], ['white', 'blue'], ['dgray', 'orange'], ['yellow', 'black'], ['azure', 'white'], ['navy', 'gold'], ['dgreen', 'lime'], ['dred', 'lgray'], ['purple', 'teal'], ['orange', 'dgray'], ['black', 'tgreen'], ['white', 'red']];

export function genRobot(b, rng, o = {}) {
  const style = o.style || rng.pick(['humanoid', 'mech', 'walker', 'treadbot', 'droid', 'tank']);
  const [main, acc] = o.colors || rng.pick(ROBOT_COLORS);
  const eye = rng.pick(['tred', 'tblue', 'tgreen', 'tyellow']);
  const s = o.scale || 1;

  if (style === 'humanoid' || style === 'mech') {
    const big = style === 'mech' ? 1 : 0;
    const legH = (big ? 4 : 3) + (s > 1 ? 1 : 0);
    const lw = big ? 3 : 2, gap = big ? 2 : 1;
    const W = lw * 2 + gap;
    // feet
    b.fill(0, -1, 0, lw + 2, lw, acc, 'plate');
    b.fill(0, -1, lw + gap, lw + 2, lw, acc, 'plate');
    // legs
    for (let l = 0; l < legH; l++) {
      b.fill(1 + l * 3, 0, 0, lw, lw, l === Math.floor(legH / 2) ? acc : main, 'brick');
      b.fill(1 + l * 3, 0, lw + gap, lw, lw, l === Math.floor(legH / 2) ? acc : main, 'brick');
    }
    let y = 1 + legH * 3;
    b.fill(y, 0, 0, lw, W, 'dgray', 'plate'); y += 1;
    // torso
    const tH = big ? 4 : 3;
    const tw = big ? 4 : 3;
    for (let l = 0; l < tH; l++) b.fill(y + l * 3, 0, -1, tw, W + 2, (x, z) => (l === tH - 2 && x === tw - 1 && z >= 1 && z < W - 1 ? acc : main), 'brick');
    b.add('light_1x1', tw - 1, y + tH * 3, Math.floor(W / 2), 0, eye);
    // arms
    const armTop = y + tH * 3;
    for (const z of [-3 - big, W + 1]) {
      b.fill(armTop - 3, -0, z, 2, 2 + big, acc, 'brick');
      for (let l = 0; l < tH; l++) b.add(big ? 'brick_2x3' : 'brick_2x2', 0, armTop - 6 - l * 3, z, 0, l === tH - 1 ? 'dgray' : main);
      // shoulder plate locks the arm onto the top of the torso
      if (z < 0) b.fill(armTop, 0, z, 2, -z, 'dgray', 'plate'); else b.fill(armTop, 0, W, 2, z + 2 + big - W, 'dgray', 'plate');
    }
    if (style === 'mech') { b.add('technic_1x6', 1, armTop, -4, 0, 'dgray'); b.add('technic_1x4', 2, armTop + 3, -4, 0, 'dgray'); b.add('round_1x1', -1, armTop, W + 2, 0, 'dgray'); b.add('round_1x1', -1, armTop + 3, W + 2, 0, 'tred'); }
    // backpack
    b.fill(armTop - 3, -2, 1, 2, W - 2, 'dgray', 'brick');
    b.fill(armTop, -2, 1, 4, W - 2, 'dgray', 'plate');
    b.add('cone_1x1', -2, armTop - 6, 1, 0, 'dgray'); b.add('cone_1x1', -2, armTop - 6, W - 2, 0, 'dgray');
    // head
    const hy = armTop + (style === 'mech' ? 0 : 0);
    b.fill(hy, 0, 1, tw, W - 2, 'dgray', 'plate');
    const hs = big ? 3 : 2;
    const hz = Math.floor((W - hs) / 2);
    b.fill(hy + 1, 0, hz, hs, hs, main, 'brick');
    b.fill(hy + 4, 0, hz, hs, hs, acc, 'plate');
    for (let z = hz; z < hz + hs; z++) b.add('light_1x1', hs - 1, hy + 5, z, 0, eye);
    b.add('antenna_1x1', 0, hy + 5, hz, 0, 'lgray');
    return { style, main };
  }
  if (style === 'walker') {
    const legs = [[0, 0], [8, 0], [0, 8], [8, 8]];
    for (const [x, z] of legs) {
      b.fill(0, x, z, 2, 2, acc, 'plate');
      for (let l = 0; l < 4; l++) b.add('brick_2x2', x, 1 + l * 3, z, 0, l === 1 ? acc : main);
      b.add('technic_1x2', x, 13, z, 0, 'dgray');
    }
    b.fill(16, 0, 0, 10, 10, 'dgray', 'plate');
    b.fill(17, 1, 1, 8, 8, main, 'brick');
    b.fill(20, 1, 1, 7, 8, main, 'brick');
    b.fill(23, 2, 2, 6, 6, acc, 'plate');
    for (let z = 2; z < 8; z += 2) b.add('slope_2x2', 8, 20, z, 1, main);
    b.fill(24, 3, 3, 3, 4, main, 'brick');
    b.add('windscreen_2x4', 6, 24, 3, 1, eye);
    b.add('technic_1x6', 6, 27, 4, 0, 'dgray'); b.add('technic_1x6', 6, 27, 5, 0, 'dgray');
    b.add('dish_2x2', 3, 27, 3, 0, 'lgray');
    return { style, main };
  }
  if (style === 'treadbot' || style === 'tank') {
    const L = style === 'tank' ? 12 : 8, W = 6;
    for (const z of [0, W - 1]) for (let x = 0; x < L; x += 4) b.add('technic_1x4', x, 0, z, 0, 'black');
    b.fill(0, 1, 1, L - 2, W - 2, 'dgray', 'brick');
    b.fill(3, 0, 0, L, W, main, 'plate');
    b.fill(4, 0, 0, L, W, main, 'brick');
    if (style === 'tank') {
      b.fill(7, 2, 1, 6, 4, acc, 'brick');
      b.fill(10, 2, 1, 6, 4, main, 'plate');
      b.add('technic_1x6', 8, 8, 2, 0, 'dgray'); b.add('technic_1x4', 14, 8, 2, 0, 'dgray');
      b.add('round_plate_1x1', 4, 11, 2, 0, 'black'); b.add('antenna_1x1', 3, 11, 4, 0, 'black');
      b.add('light_1x1', 7, 11, 1, 0, eye);
    } else {
      b.fill(7, 2, 1, 4, 4, main, 'brick');
      b.fill(10, 2, 1, 4, 4, acc, 'brick');
      b.fill(13, 3, 2, 2, 2, main, 'brick');
      b.add('light_1x1', 4, 16, 2, 0, eye); b.add('light_1x1', 4, 16, 3, 0, eye);
      b.add('antenna_1x1', 3, 16, 2, 0, 'lgray');
      b.add('hinge_brick_1x4', 2, 10, 0, 1, 'dgray'); b.add('hinge_brick_1x4', 2, 10, 5, 1, 'dgray');
      b.add('technic_1x2', 6, 10, -1, 1, acc); b.add('technic_1x2', 6, 10, 6, 1, acc);
    }
    return { style, main };
  }
  // droid: round body on a stand
  const R = 3;
  b.add('round_2x2', 2, 0, 2, 0, 'dgray');
  b.voxel(3, 0, 0, 6, 3, 6, (x, l, z) => { const d = Math.hypot(x - 2.5, z - 2.5); return d <= R - (l === 2 ? 1 : 0) ? ((l === 1 && x === 5) ? acc : main) : null; });
  b.voxel(12, 1, 1, 4, 1, 4, (x, l, z) => (Math.hypot(x - 2.5, z - 2.5) <= 2 ? acc : null));
  b.add('light_1x1', 4, 15, 2, 0, eye); b.add('light_1x1', 4, 15, 3, 0, eye);
  b.add('antenna_1x1', 1, 15, 2, 0, 'lgray');
  for (const z of [-1, 6]) { b.add('round_1x1', 2, 6, z, 0, acc); b.add('brick_1x2', 2, 3, z, 1, main); }
  return { style: 'droid', main };
}

// ===================================================================== BOATS
function hull(b, L, W, layers, color, deck, stripe, bowLen = 4) {
  const half = W / 2;
  const widthAt = x => {
    const fromBow = L - 1 - x;
    if (fromBow >= bowLen) return W;
    return Math.max(2, Math.round(W * (fromBow + 1) / (bowLen + 1) / 2) * 2);
  };
  for (let l = 0; l < layers; l++) {
    b.fillMask(l * 3, 0, 0, L - (l === 0 ? 1 : 0), W, (x, z) => { const w = widthAt(x + (l === 0 ? 1 : 0)) - (l === 0 ? 2 : 0); return Math.abs(z + 0.5 - half) <= w / 2; }, l === layers - 1 && stripe ? stripe : color, 'brick');
  }
  const y = layers * 3;
  b.fillMask(y, 0, 0, L, W, (x, z) => Math.abs(z + 0.5 - half) <= widthAt(x) / 2, deck, 'plate');
  return y + 1;
}

export function genBoat(b, rng, o = {}) {
  const style = o.style || rng.pick(['sailboat', 'speedboat', 'tugboat', 'cargo', 'ferry', 'galleon', 'submarine', 'fishing', 'yacht', 'canoe']);
  const main = o.color || ({ galleon: 'brown', tugboat: rng.pick(['red', 'navy', 'dgreen']), submarine: rng.pick(['yellow', 'dgray', 'black']), cargo: rng.pick(['navy', 'dred', 'black', 'dgreen']), canoe: rng.pick(['brown', 'red', 'green']) })[style] || rng.pick(['white', 'navy', 'red', 'azure', 'blue', 'white']);
  const acc = rng.pick(['red', 'blue', 'yellow', 'navy', 'white', 'orange'].filter(c => c !== main));
  const deck = rng.pick(['tan', 'brown', 'white', 'lgray']);

  if (style === 'submarine') {
    const L = rng.int(16, 20);
    b.fill(0, Math.floor(L / 2) - 3, 1, 2, 2, 'dgray', 'brick'); b.fill(0, Math.floor(L / 2) + 2, 1, 2, 2, 'dgray', 'brick');
    b.voxel(3, 0, -1, L, 3, 6, (x, l, z) => { const t = (x - L / 2 + 0.5) / (L / 2); const r = 2.6 * Math.sqrt(Math.max(0, 1 - t * t * t * t)); const dz = z + 0.5 - 2, dy = (l - 1) * 1.2; return dz * dz + dy * dy <= r * r ? (l === 1 && (x % 4 === 1) && (z === -1 || z === 4) ? 'tyellow' : main) : null; });
    b.fill(12, Math.floor(L / 2) - 1, 1, 4, 2, main, 'brick'); b.fill(15, Math.floor(L / 2) - 1, 1, 4, 2, main, 'brick');
    b.fill(18, Math.floor(L / 2) - 1, 1, 4, 2, acc, 'plate');
    b.add('antenna_1x1', Math.floor(L / 2), 19, 1, 0, 'lgray');
    b.add('propeller_1x1', -1, 6, 1, 0, 'gold');
    b.add('light_1x1', L - 2, 12, 1, 0, 'tyellow');
    return { style, main };
  }
  const L = o.L || ({ sailboat: rng.int(12, 15), speedboat: rng.int(10, 12), tugboat: rng.int(12, 14), cargo: rng.int(22, 28), ferry: rng.int(20, 24), galleon: rng.int(22, 28), fishing: rng.int(12, 14), yacht: rng.int(16, 20), canoe: 10 })[style];
  const W = ({ sailboat: 4, speedboat: 4, tugboat: 6, cargo: 8, ferry: 8, galleon: 8, fishing: 6, yacht: 6, canoe: 2 })[style];
  const layers = ({ sailboat: 1, speedboat: 1, tugboat: 2, cargo: 2, ferry: 2, galleon: 2, fishing: 2, yacht: 2, canoe: 1 })[style];
  const top = hull(b, L, W, layers, main, deck, rng.chance(0.5) ? acc : null, style === 'canoe' ? 2 : style === 'cargo' ? 5 : 4);
  const cz = W / 2 - 1;
  switch (style) {
    case 'canoe':
      b.add('slope_curve_1x2', L - 2, top, 0, 1, main); b.add('slope_curve_1x2', L - 2, top, 1, 1, main);
      b.add('slope_curve_1x2', 0, top, 0, 3, main); b.add('slope_curve_1x2', 0, top, 1, 3, main);
      for (const x of [3, 6]) {
        b.add('round_1x1', x, top, 0, 0, rng.pick(['red', 'blue', 'yellow', 'white']));
        b.add('round_plate_1x1', x, top + 3, 0, 0, 'yellow');
        b.add('technic_1x4', x, top + 1, 1, 1, 'brown');
      }
      b.add('tile_1x2', 4, top, 1, 0, 'tan');
      b.fill(-0, -2, -3, 6, 2, 'brown', 'plate'); b.add('round_1x1', -2, 0, -3, 0, 'brown');
      break;
    case 'sailboat': {
      for (let l = 0; l < 6; l++) b.add('round_1x1', Math.floor(L / 2), top + l * 3, cz, 0, 'tan');
      // triangular sail made of 1-stud-thick bricks
      for (let l = 0; l < 5; l++) { const w = Math.max(1, 5 - l); b.fill(top + 3 + l * 3, Math.floor(L / 2) - w, cz + 1, w, 1, l % 2 ? 'white' : acc === 'white' ? 'lgray' : 'white', 'brick'); }
      b.add('tile_1x2', 1, top, 1, 0, 'white');
      b.add('cone_1x1', Math.floor(L / 2), top + 18, cz, 0, acc);
      break;
    }
    case 'speedboat': case 'yacht': {
      b.add('windscreen_2x4', L - 6, top, 0, 1, 'tblue');
      b.fill(top, 1, 0, L - 7, W, 'white', 'brick');
      if (style === 'yacht') {
        b.fill(top, 1, 1, L - 7, W - 2, 'white', 'brick');
        b.walls(top + 3, 2, 1, L - 9, W - 2, 1, (x) => (x === 2 ? 'white' : 'tblue'));
        b.fill(top + 6, 2, 1, L - 9, W - 2, 'white', 'plate');
        b.add('antenna_1x1', 3, top + 7, 2, 0, 'lgray'); b.add('dish_2x2', 5, top + 7, 2, 0, 'white');
      } else { b.add('brick_1x2', 3, top, 1, 1, 'black'); b.add('brick_1x2', 3, top, 2, 1, 'black'); }
      b.add('propeller_1x1', -1, 1, cz, 0, 'lgray');
      break;
    }
    case 'tugboat': case 'fishing': {
      b.walls(top, 2, 1, 6, W - 2, 2, (x, y, z) => (y === top ? main === 'white' ? 'red' : 'white' : (x === 2 ? 'white' : 'tclear')));
      b.fill(top + 6, 1, 0, 8, W, acc, 'plate');
      b.add('round_2x2', 4, top + 7, cz, 0, style === 'tugboat' ? 'black' : 'white');
      b.add('round_2x2', 4, top + 10, cz, 0, style === 'tugboat' ? 'red' : 'white');
      if (style === 'fishing') { b.add('technic_1x6', 0, top, 0, 1, 'dgray'); b.add('round_1x1', 0, top + 3, 0, 0, 'yellow'); b.add('grille_1x2', 9, top, 2, 0, 'dgray'); }
      else { for (let z = 0; z < W; z += 2) b.add('round_1x1', L - 1 - (z ? 1 : 0), top, z, 0, 'black'); }
      b.add('light_1x1', 8, top + 7, 0, 0, 'tred'); b.add('light_1x1', 8, top + 7, W - 1, 0, 'tgreen');
      break;
    }
    case 'cargo': {
      b.walls(top, 1, 1, 4, W - 2, 3, (x, y, z) => (x === 4 ? 'tclear' : 'white'));
      b.fill(top + 9, 0, 0, 6, W, 'white', 'plate');
      b.add('round_2x2', 2, top + 10, cz, 0, acc);
      const cols = ['red', 'blue', 'orange', 'teal', 'green', 'yellow', 'dgray'];
      for (let x = 7; x + 4 <= L - 4; x += 4) for (let z = 0; z + 4 <= W; z += 4) {
        const stack = rng.int(1, 3);
        for (let s = 0; s < stack; s++) { const c = rng.pick(cols); b.fill(top + s * 3, x, z, 4, 2, c, 'brick'); b.fill(top + s * 3, x, z + 2, 4, 2, c, 'brick'); }
      }
      break;
    }
    case 'ferry': {
      for (let f = 0; f < 2; f++) {
        const y = top + f * 7;
        const x0 = f, w = L - 6 - f * 2;
        b.walls(y, x0, 0, w, W, 2, (x, yy, z) => (yy === y ? (f ? acc : 'white') : (x - x0) % 3 === 0 ? 'white' : 'tblue'));
        b.fill(y + 6, x0, 0, w, W, 'white', 'plate');
      }
      b.add('round_2x2', 4, top + 14, cz, 0, acc); b.add('round_2x2', 4, top + 17, cz, 0, 'black');
      b.add('windscreen_2x4', L - 8, top + 7, 2, 1, 'tblue');
      break;
    }
    case 'galleon': {
      // raised stern castle
      b.walls(top, 0, 0, 6, W, 2, (x, y, z) => (x === 5 ? 'brown' : (z === 0 || z === W - 1) && x % 2 ? 'gold' : 'brown'));
      b.fill(top + 6, -1, 0, 7, W, 'brown', 'plate');
      for (let x = -1; x < 6; x += 2) { b.add('crenel_1x2', x, top + 7, 0, 0, 'gold'); b.add('crenel_1x2', x, top + 7, W - 1, 0, 'gold'); }
      b.add('light_1x1', 0, top + 7, cz, 0, 'tyellow');
      // masts + sails
      const masts = [9, Math.floor(L / 2) + 4, L - 5].filter(x => x < L - 2);
      masts.forEach((mx, i) => {
        // mast in sections with a yard (cross-beam) between them; each sail hangs from its yard
        const tall = i === 1;
        let y = top;
        const yards = [];
        for (let sec = 0; sec < (tall ? 3 : 2); sec++) {
          for (let l = 0; l < 3; l++) { b.add('round_1x1', mx, y, cz, 0, 'brown'); y += 3; }
          b.add('plate_1x6', mx, y, cz - 3, 0, 'brown'); yards.push({ y, half: 3 - Math.max(0, sec - (tall ? 1 : 0)) }); y += 1;
        }
        for (const yd of yards) for (const yy of [yd.y - 3, yd.y - 6]) b.fillMask(yy, mx, cz - 3, 1, 6, (x, z) => z !== cz, 'white', 'brick');
        b.add('round_1x1', mx, y, cz, 0, 'brown');
        b.add('cone_1x1', mx, y + 3, cz, 0, acc);
      });
      // cannons
      for (let x = 7; x < L - 4; x += 3) { b.add('round_1x1', x, top - 3 + 0, -1, 0, 'black'); b.add('round_1x1', x, top - 3, W, 0, 'black'); }
      b.add('technic_1x4', L, top - 1, cz, 0, 'brown');
      break;
    }
  }
  return { style, main };
}
