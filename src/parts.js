// parts.js — every kind of brick the game knows about.
//
// Coordinate system (shared by EVERYTHING in the game):
//   * 1 stud  = 1 world unit along X and Z.
//   * 1 plate = 0.4 world units tall (PLATE_H). A standard brick is 3 plates tall.
//   * A placed piece is stored as integer grid cells: {x, y, z} is the minimum corner,
//     where y counts plate layers. Rotation r is 0..3 (quarter turns around +Y).
//   * Footprint w (along X) and d (along Z) are swapped when r is 1 or 3.
// Because positions are integers on this grid, pieces always stay aligned no matter
// how the camera moves.

export const PLATE_H = 0.4;

// ---------------------------------------------------------------- colours
export const COLORS = [
  { id: 'white',     name: 'White',          hex: '#f4f4f0' },
  { id: 'lgray',     name: 'Light Grey',     hex: '#a3a6a8' },
  { id: 'dgray',     name: 'Dark Grey',      hex: '#5f6366' },
  { id: 'black',     name: 'Black',          hex: '#27292b' },
  { id: 'red',       name: 'Red',            hex: '#c8242b' },
  { id: 'dred',      name: 'Dark Red',       hex: '#7c1e22' },
  { id: 'orange',    name: 'Orange',         hex: '#ef7d1a' },
  { id: 'yellow',    name: 'Yellow',         hex: '#f7c51e' },
  { id: 'tan',       name: 'Sand',           hex: '#d7c08a' },
  { id: 'brown',     name: 'Brown',          hex: '#6b4226' },
  { id: 'lime',      name: 'Lime',           hex: '#a5ca18' },
  { id: 'green',     name: 'Green',          hex: '#2b8a3e' },
  { id: 'dgreen',    name: 'Forest Green',   hex: '#1c4f32' },
  { id: 'teal',      name: 'Teal',           hex: '#14958e' },
  { id: 'azure',     name: 'Sky Blue',       hex: '#4fa8de' },
  { id: 'blue',      name: 'Blue',           hex: '#1f5bbf' },
  { id: 'navy',      name: 'Navy',           hex: '#1a2c5b' },
  { id: 'purple',    name: 'Purple',         hex: '#6a3aa0' },
  { id: 'pink',      name: 'Pink',           hex: '#e889b4' },
  { id: 'gold',      name: 'Pearl Gold',     hex: '#c99a3a' },
  { id: 'tclear',    name: 'Clear Glass',    hex: '#dff3ff', trans: true },
  { id: 'tblue',     name: 'Blue Glass',     hex: '#4fb3ff', trans: true },
  { id: 'tred',      name: 'Red Glass',      hex: '#ff4b4b', trans: true },
  { id: 'tyellow',   name: 'Yellow Glass',   hex: '#ffd84a', trans: true },
  { id: 'tgreen',    name: 'Green Glass',    hex: '#6bff8a', trans: true },
];
export const COLOR_BY_ID = Object.fromEntries(COLORS.map(c => [c.id, c]));
export const isTransColor = id => !!(COLOR_BY_ID[id] && COLOR_BY_ID[id].trans);

// ---------------------------------------------------------------- parts
// kind: which geometry recipe to use (see geometry.js)
// studs: 'all' | 'none' | 'back' (only the back row — slopes)
// group: which tray tab it appears in
// unlock: null = always available in free build; {cost} = buy in the Parts Shop
const P = [];
function add(def) { P.push({ studs: 'all', unlock: null, ...def }); }

// Bricks (3 plates tall)
for (const [w, d] of [[1,1],[1,2],[1,3],[1,4],[1,6],[1,8],[2,2],[2,3],[2,4],[2,6],[2,8]]) {
  add({ id: `brick_${w}x${d}`, name: `Brick ${w}×${d}`, kind: 'box', w, d, h: 3, group: 'Bricks' });
}
// Plates (1 plate tall)
for (const [w, d] of [[1,1],[1,2],[1,3],[1,4],[1,6],[1,8],[2,2],[2,3],[2,4],[2,6],[2,8],[4,4],[4,6],[4,8],[6,6],[6,8],[8,8]]) {
  add({ id: `plate_${w}x${d}`, name: `Plate ${w}×${d}`, kind: 'box', w, d, h: 1, group: 'Plates' });
}
// Tiles (smooth, no studs)
for (const [w, d] of [[1,1],[1,2],[1,4],[2,2],[2,4]]) {
  add({ id: `tile_${w}x${d}`, name: `Tile ${w}×${d}`, kind: 'tile', w, d, h: 1, group: 'Tiles', studs: 'none' });
}
// Slopes — high side at the back (low z), sloping down toward +z.
for (const [w, d] of [[1,2],[2,2],[1,3],[2,3],[4,2]]) {
  add({ id: `slope_${w}x${d}`, name: `Slope ${w}×${d}`, kind: 'slope', w, d, h: 3, group: 'Slopes', studs: 'back' });
}
add({ id: 'slope_curve_2x2', name: 'Curved Slope 2×2', kind: 'curve', w: 2, d: 2, h: 2, group: 'Slopes', studs: 'none' });
add({ id: 'slope_curve_1x2', name: 'Curved Slope 1×2', kind: 'curve', w: 1, d: 2, h: 2, group: 'Slopes', studs: 'none' });
add({ id: 'wedge_2x2', name: 'Wedge Plate 2×2', kind: 'wedge', w: 2, d: 2, h: 1, group: 'Slopes' });
add({ id: 'slope_inv_1x2', name: 'Inverted Slope 1×2', kind: 'invslope', w: 1, d: 2, h: 3, group: 'Slopes' });

// Windows & doors
add({ id: 'window_1x2x2', name: 'Window 1×2×2', kind: 'window', w: 2, d: 1, h: 6, group: 'Windows & Doors' });
add({ id: 'window_1x4x3', name: 'Window 1×4×3', kind: 'window', w: 4, d: 1, h: 9, group: 'Windows & Doors' });
add({ id: 'windscreen_2x4', name: 'Windscreen 2×4', kind: 'windscreen', w: 4, d: 2, h: 3, group: 'Windows & Doors', studs: 'none' });
add({ id: 'door_1x2x3', name: 'Door 1×2×3', kind: 'door', w: 2, d: 1, h: 9, group: 'Windows & Doors' });
add({ id: 'door_1x4x5', name: 'Gate 1×4×5', kind: 'door', w: 4, d: 1, h: 15, group: 'Windows & Doors', unlock: { cost: 150 } });

// Wheels & axles (wheel axis runs along X)
add({ id: 'wheel_small', name: 'Wheel Small', kind: 'wheel', w: 1, d: 2, h: 5, group: 'Wheels', studs: 'none' });
add({ id: 'wheel_large', name: 'Wheel Large', kind: 'wheel', w: 1, d: 3, h: 7, group: 'Wheels', studs: 'none' });
add({ id: 'axle_plate_2x2', name: 'Axle Plate 2×2', kind: 'axle', w: 2, d: 2, h: 1, group: 'Wheels' });
add({ id: 'axle_plate_2x4', name: 'Axle Plate 2×4', kind: 'axle', w: 4, d: 2, h: 1, group: 'Wheels' });
add({ id: 'train_wheel', name: 'Train Wheel Set', kind: 'trainwheel', w: 4, d: 2, h: 3, group: 'Wheels', studs: 'all', unlock: { cost: 200 } });

// Hinges & technic
add({ id: 'hinge_1x2', name: 'Hinge Plate 1×2', kind: 'hinge', w: 2, d: 1, h: 1, group: 'Technic & Hinges', unlock: { cost: 120 } });
add({ id: 'hinge_brick_1x4', name: 'Hinge Brick 1×4', kind: 'hinge', w: 4, d: 1, h: 3, group: 'Technic & Hinges', unlock: { cost: 160 } });
add({ id: 'technic_1x2', name: 'Technic Brick 1×2', kind: 'technic', w: 2, d: 1, h: 3, group: 'Technic & Hinges', unlock: { cost: 180 } });
add({ id: 'technic_1x4', name: 'Technic Brick 1×4', kind: 'technic', w: 4, d: 1, h: 3, group: 'Technic & Hinges', unlock: { cost: 220 } });
add({ id: 'technic_1x6', name: 'Technic Brick 1×6', kind: 'technic', w: 6, d: 1, h: 3, group: 'Technic & Hinges', unlock: { cost: 260 } });
add({ id: 'technic_connector', name: 'Technic Connector Hub', kind: 'connector', w: 1, d: 1, h: 3, group: 'Technic & Hinges', studs: 'none', unlock: { cost: 200 } });

// Decorative / special
add({ id: 'round_1x1', name: 'Round Brick 1×1', kind: 'round', w: 1, d: 1, h: 3, group: 'Special' });
add({ id: 'round_2x2', name: 'Round Brick 2×2', kind: 'round', w: 2, d: 2, h: 3, group: 'Special' });
add({ id: 'round_plate_1x1', name: 'Round Plate 1×1', kind: 'round', w: 1, d: 1, h: 1, group: 'Special' });
add({ id: 'cone_1x1', name: 'Cone 1×1', kind: 'cone', w: 1, d: 1, h: 3, group: 'Special', studs: 'none' });
add({ id: 'dish_2x2', name: 'Radar Dish 2×2', kind: 'dish', w: 2, d: 2, h: 1, group: 'Special', studs: 'none', unlock: { cost: 140 } });
add({ id: 'antenna_1x1', name: 'Antenna', kind: 'antenna', w: 1, d: 1, h: 6, group: 'Special', studs: 'none' });
add({ id: 'grille_1x2', name: 'Grille Tile 1×2', kind: 'grille', w: 1, d: 2, h: 1, group: 'Special', studs: 'none' });
add({ id: 'eye_1x1', name: 'Eye Tile 1×1', kind: 'eye', w: 1, d: 1, h: 1, group: 'Special', studs: 'none' });
add({ id: 'flower_1x1', name: 'Flower', kind: 'flower', w: 1, d: 1, h: 2, group: 'Special', studs: 'none', unlock: { cost: 100 } });
add({ id: 'arch_1x4', name: 'Arch 1×4', kind: 'arch', w: 4, d: 1, h: 3, group: 'Special' });
add({ id: 'arch_1x6', name: 'Arch 1×6', kind: 'arch', w: 6, d: 1, h: 6, group: 'Special', unlock: { cost: 150 } });
add({ id: 'crenel_1x2', name: 'Battlement 1×2', kind: 'crenel', w: 2, d: 1, h: 3, group: 'Special', studs: 'none' });
add({ id: 'spike_1x1', name: 'Horn / Tooth', kind: 'spike', w: 1, d: 1, h: 2, group: 'Special', studs: 'none' });
add({ id: 'propeller_1x1', name: 'Propeller', kind: 'propeller', w: 1, d: 1, h: 2, group: 'Special', studs: 'none', unlock: { cost: 160 } });
add({ id: 'light_1x1', name: 'Light Tile', kind: 'light', w: 1, d: 1, h: 1, group: 'Special', studs: 'none' });

// Figures — little toy people, 2 studs wide, standing on two studs. Each character has its
// own outfit; the piece colour is the shirt/jacket colour.
//   hat: what's on the head · hair colour · legs colour · detail: something printed on the body
export const FIGURES = [
  ['firefighter', 'Firefighter', { hat: 'fire', hatC: 'red', hairC: 'brown', legs: 'black', torso: 'black', detail: 'stripes', detailC: 'yellow' }],
  ['doctor', 'Doctor', { hat: 'hair', hairC: 'brown', legs: 'azure', torso: 'white', detail: 'stetho', detailC: 'black' }],
  ['nurse', 'Nurse', { hat: 'nursecap', hatC: 'white', hairC: 'yellow', legs: 'white', torso: 'azure', detail: 'cross', detailC: 'red' }],
  ['police', 'Police Officer', { hat: 'cap', hatC: 'navy', hairC: 'brown', legs: 'black', torso: 'navy', detail: 'badge', detailC: 'gold' }],
  ['mayor', 'Mayor', { hat: 'tophat', hatC: 'black', hairC: 'dgray', legs: 'black', torso: 'black', detail: 'tie', detailC: 'red' }],
  ['chef', 'Chef', { hat: 'chef', hatC: 'white', hairC: 'brown', legs: 'black', torso: 'white', detail: 'buttons', detailC: 'black' }],
  ['worker', 'Builder', { hat: 'hardhat', hatC: 'yellow', hairC: 'brown', legs: 'blue', torso: 'orange', detail: 'stripes', detailC: 'lgray' }],
  ['conductor', 'Train Conductor', { hat: 'cap', hatC: 'dred', hairC: 'dgray', legs: 'black', torso: 'dred', detail: 'badge', detailC: 'gold' }],
  ['teacher', 'Teacher', { hat: 'ponytail', hairC: 'brown', legs: 'navy', torso: 'green', detail: 'buttons', detailC: 'white' }],
  ['kid', 'Kid', { hat: 'hair', hairC: 'orange', legs: 'blue', torso: 'red', detail: 'star', detailC: 'yellow' }],
  ['shopper', 'Shopper', { hat: 'ponytail', hairC: 'black', legs: 'navy', torso: 'purple', detail: 'none' }],
  ['astronaut', 'Astronaut', { hat: 'space', hatC: 'white', hairC: 'brown', legs: 'white', torso: 'white', detail: 'badge', detailC: 'red' }],
  ['knight', 'Knight', { hat: 'knight', hatC: 'lgray', hairC: 'brown', legs: 'dgray', torso: 'blue', detail: 'cross', detailC: 'gold' }],
  ['pirate', 'Pirate', { hat: 'bandana', hatC: 'red', hairC: 'black', legs: 'brown', torso: 'white', detail: 'stripes', detailC: 'red' }],
  ['farmer', 'Farmer', { hat: 'straw', hatC: 'tan', hairC: 'brown', legs: 'blue', torso: 'red', detail: 'buttons', detailC: 'white' }],
  ['racer', 'Racing Driver', { hat: 'racing', hatC: 'white', hairC: 'brown', legs: 'red', torso: 'red', detail: 'stripes', detailC: 'white' }],
  ['wizard', 'Wizard', { hat: 'wizard', hatC: 'purple', hairC: 'white', legs: 'purple', torso: 'purple', detail: 'star', detailC: 'gold' }],
  ['explorer', 'Explorer', { hat: 'safari', hatC: 'tan', hairC: 'brown', legs: 'brown', torso: 'tan', detail: 'buttons', detailC: 'brown' }],
];
for (const [id, name, fig] of FIGURES) add({ id: 'fig_' + id, name: name + ' Figure', kind: 'figure', w: 2, d: 1, h: 8, group: 'Figures', studs: 'none', fig });

export const PARTS = P;
export const PART_BY_ID = Object.fromEntries(P.map(p => [p.id, p]));
export const PART_GROUPS = [...new Set(P.map(p => p.group))];

/** Footprint of a part after rotation r (0..3). */
export function footprint(part, r) {
  return (r & 1) ? { w: part.d, d: part.w } : { w: part.w, d: part.d };
}

/** Is this part type available in free build? */
export function isPartUnlocked(partId, unlockedParts) {
  const p = PART_BY_ID[partId];
  if (!p) return false;
  return !p.unlock || (unlockedParts && unlockedParts.includes(partId));
}

/** Studs on top of a piece, as local cell coords [[cx, cz], ...] in UN-rotated space. */
export function studCells(part) {
  const out = [];
  if (part.studs === 'none') return out;
  for (let x = 0; x < part.w; x++) for (let z = 0; z < part.d; z++) {
    if (part.studs === 'back' && z !== 0) continue;
    out.push([x, z]);
  }
  return out;
}

/** Whether something placed directly above this part's cell can "click" on. */
export function hasTopConnection(part) { return part.studs !== 'none'; }
