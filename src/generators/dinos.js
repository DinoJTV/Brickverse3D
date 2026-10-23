// generators/dinos.js — detailed, sculpted dinosaurs and prehistoric creatures.
// Each species is a "skeleton" of capsules and ellipsoids (designed at scale 1, facing +X),
// painted with belly colours, stripes or spots, sculpted eyes, open jaws with teeth,
// then placed on a little themed base with rocks and plants.
import { ell, boxS, cap, chain, sculpt, topAt, terrainBase, decorate } from './sculpt.js';

const SKINS = [
  { skin: 'green', belly: 'lime', dark: 'dgreen', acc: 'orange' },
  { skin: 'dgreen', belly: 'tan', dark: 'black', acc: 'red' },
  { skin: 'brown', belly: 'tan', dark: 'dred', acc: 'orange' },
  { skin: 'orange', belly: 'yellow', dark: 'dred', acc: 'black' },
  { skin: 'teal', belly: 'azure', dark: 'navy', acc: 'yellow' },
  { skin: 'dgray', belly: 'lgray', dark: 'black', acc: 'red' },
  { skin: 'purple', belly: 'pink', dark: 'navy', acc: 'lime' },
  { skin: 'dred', belly: 'orange', dark: 'black', acc: 'yellow' },
  { skin: 'blue', belly: 'azure', dark: 'navy', acc: 'orange' },
  { skin: 'tan', belly: 'white', dark: 'brown', acc: 'dred' },
  { skin: 'lime', belly: 'yellow', dark: 'green', acc: 'purple' },
  { skin: 'navy', belly: 'lgray', dark: 'black', acc: 'tblue' },
];

const hash = (x, y, z) => { let h = (Math.floor(x) * 73856093) ^ (Math.floor(y * 2.5) * 19349663) ^ (Math.floor(z) * 83492791); h = (h ^ (h >>> 13)) >>> 0; return h % 97; };

/** Skin painter: belly underneath, pattern on the back. */
function painter(p, bellyY, pattern, spineZ = 0) {
  return (x, y, z) => {
    if (y < bellyY(x) && Math.abs(z - spineZ) < 1.6) return p.belly;
    if (pattern === 'stripes' && y > bellyY(x) + 0.9 && ((Math.floor(x * 0.75) % 2) + 2) % 2 === 0) return p.dark;
    if (pattern === 'spots' && y > bellyY(x) + 0.6 && hash(x, y, z) % 9 === 0) return p.dark;
    if (pattern === 'back' && y > bellyY(x) + 1.6) return p.dark;
    return p.skin;
  };
}

/** Eyes: coloured iris with a black pupil, on both sides of the head. */
function eyes(x, y, zOff, iris = 'yellow') {
  return [ell(x, y, zOff, 0.55, 0.42, 0.5, iris), ell(x + 0.15, y, zOff * 1.08, 0.3, 0.25, 0.4, 'black'),
          ell(x, y, -zOff, 0.55, 0.42, 0.5, iris), ell(x + 0.15, y, -zOff * 1.08, 0.3, 0.25, 0.4, 'black')];
}
/** Open mouth: dark band with white teeth along both edges. */
function mouth(x0, x1, y, halfW) {
  return [boxS(x0, y - 0.2, -halfW + 0.2, x1, y + 0.2, halfW - 0.2, 'dred'),
          boxS(x0 + 0.2, y - 0.2, -halfW - 0.4, x1, y + 0.2, -halfW + 0.45, 'white'),
          boxS(x0 + 0.2, y - 0.2, halfW - 0.45, x1, y + 0.2, halfW + 0.4, 'white')];
}
const pair = (fn) => [fn(1), fn(-1)];

// --------------------------------------------------------------- species skeletons
const SPECIES = {
  trex: (p, v) => {
    const slim = v.slim ? 0.85 : 1;
    const paint = painter(p, () => 5.0, v.pattern || 'stripes');
    const S = [];
    for (const zs of [1, -1]) {
      S.push(cap([7, 5.2, zs * 1.4], [7.7, 3.1, zs * 1.6], 1.4 * slim, 1.0 * slim, paint));
      S.push(cap([7.7, 3.1, zs * 1.6], [6.6, 1.0, zs * 1.6], 0.85 * slim, 0.6, paint));
      S.push(ell(7.5, 0.45, zs * 1.6, 1.6, 0.45, 0.75, p.skin));
      S.push(cap([10.4, 5.0, zs * 1.3], [11.5, 4.1, zs * 1.6], 0.45, 0.35, paint));
    }
    S.push(ell(7, 5.7, 0, 4.0, 2.1 * slim, 2.0 * slim, paint));
    S.push(ell(9.6, 5.8, 0, 2.2, 1.9 * slim, 1.7 * slim, paint));
    S.push(cap([10.5, 6.3, 0], [12.3, 7.5, 0], 1.5 * slim, 1.2, paint));
    S.push(ell(14.2, 8.0, 0, 2.6, 1.15, 1.25, p.skin));
    S.push(ell(16.4, 7.7, 0, 1.3, 0.8, 0.95, p.skin));
    S.push(ell(14.3, 6.7, 0, 2.4, 0.6, 1.1, p.belly));
    S.push(...mouth(13.0, 17.4, 7.1, 1.0));
    S.push(ell(13.7, 8.95, 0.75, 0.8, 0.35, 0.35, v.horns ? p.acc : p.dark), ell(13.7, 8.95, -0.75, 0.8, 0.35, 0.35, v.horns ? p.acc : p.dark));
    S.push(...eyes(13.8, 8.35, 1.05, v.iris));
    S.push(...chain([[3.5, 6, 0], [0, 5.7, 0], [-3.5, 5.2, 0], [-7, 4.6, 0], [-10, 4.4, 0]], [1.9, 1.5, 1.05, 0.65, 0.3], paint));
    return { S, feet: [[9.4, 1.6], [9.4, -1.6]], spine: v.spikes ? [[0, 6], [10, 7]] : null, base: v.base || 'jungle' };
  },
  raptor: (p, v) => {
    const paint = painter(p, () => 3.0, v.pattern || 'stripes');
    const S = [];
    for (const zs of [1, -1]) {
      S.push(cap([5, 3.2, zs * 0.9], [5.6, 1.9, zs], 0.8, 0.55, paint));
      S.push(cap([5.6, 1.9, zs], [4.8, 0.55, zs], 0.5, 0.35, paint));
      S.push(ell(5.5, 0.3, zs, 0.95, 0.3, 0.45, p.skin));
      S.push(cap([6.3, 3.3, zs * 0.9], [7.3, 2.6, zs * 1.1], 0.35, 0.28, paint));
    }
    S.push(ell(4.6, 3.4, 0, 2.7, 1.25, 1.25, paint));
    S.push(cap([6.7, 3.8, 0], [7.9, 5.0, 0], 0.85, 0.65, paint));
    S.push(ell(9.0, 5.25, 0, 1.5, 0.62, 0.65, p.skin));
    S.push(ell(9.0, 4.7, 0, 1.3, 0.32, 0.5, p.belly));
    S.push(...mouth(8.3, 10.5, 4.95, 0.5));
    S.push(...eyes(8.6, 5.55, 0.55, 'orange'));
    S.push(ell(8.2, 5.95, 0, 0.9, 0.3, 0.25, p.acc));
    S.push(...chain([[2.2, 3.6, 0], [-1, 3.9, 0], [-4, 4.1, 0], [-6.5, 4.4, 0]], [1.0, 0.7, 0.42, 0.2], paint));
    S.push(ell(-6.3, 4.5, 0, 0.9, 0.35, 0.6, p.acc));
    return { S, feet: [[6.6, 1], [6.6, -1]], base: v.base || 'jungle' };
  },
  sauropod: (p, v) => {
    const tall = v.tall;
    const paint = painter(p, () => 4.2, v.pattern || 'spots');
    const S = [];
    for (const [x, zs] of [[9.3, 1], [9.3, -1], [3.2, 1], [3.2, -1]]) {
      S.push(cap([x, 5, zs * 1.6], [x + (x > 5 ? 0.2 : 0), 0.5, zs * 1.6], 1.05, 0.9, paint));
      S.push(ell(x + 0.2, 0.4, zs * 1.6, 1.05, 0.4, 1.0, p.dark));
    }
    S.push(ell(6.2, 5.4, 0, 5.2, 2.5, 2.5, paint));
    const neck = tall
      ? [[10.5, 6.2, 0], [12.3, 8.7, 0], [13.6, 11.6, 0], [14.3, 14.4, 0], [14.8, 16.2, 0]]
      : [[10.5, 6.2, 0], [13.2, 7.4, 0], [16, 8.4, 0], [18.6, 9.4, 0], [20.4, 10.2, 0]];
    S.push(...chain(neck, [1.7, 1.3, 1.0, 0.85, 0.75], paint));
    const h = neck[neck.length - 1];
    S.push(ell(h[0] + 0.9, h[1] + 0.25, 0, 1.4, 0.7, 0.75, p.skin));
    S.push(ell(h[0] + 1.6, h[1] - 0.05, 0, 0.9, 0.45, 0.6, p.belly));
    S.push(...eyes(h[0] + 0.7, h[1] + 0.55, 0.62, 'yellow'));
    if (tall) S.push(ell(h[0] + 0.5, h[1] + 0.95, 0, 0.7, 0.45, 0.45, p.acc));
    S.push(...chain([[1.2, 5.6, 0], [-2.5, 5.1, 0], [-6.5, 4.2, 0], [-10.5, 3.2, 0], [-14, 2.6, 0]], [2.0, 1.55, 1.05, 0.6, 0.28], paint));
    return { S, feet: [], spine: v.spikes ? [[-6, 6], [10, 7]] : null, base: v.base || 'jungle' };
  },
  triceratops: (p, v) => {
    const paint = painter(p, () => 3.2, v.pattern || 'back');
    const S = [];
    for (const [x, zs] of [[9.6, 1], [9.6, -1], [3.6, 1], [3.6, -1]]) {
      S.push(cap([x, 3.4, zs * 1.9], [x, 0.5, zs * 2.0], 1.0, 0.85, paint));
      S.push(ell(x + 0.2, 0.4, zs * 2.0, 1.0, 0.4, 0.95, p.dark));
    }
    S.push(ell(6.5, 4.0, 0, 4.6, 2.2, 2.5, paint));
    S.push(ell(11.7, 3.9, 0, 2.0, 1.45, 1.5, p.skin));
    S.push(ell(13.5, 3.3, 0, 1.0, 0.85, 0.75, 'dgray'));
    S.push(ell(10.3, 5.6, 0, 0.6, 2.3, 2.7, (x, y, z) => (Math.hypot(y - 5.6, z) > 1.9 ? p.acc : (hash(x, y, z) % 4 === 0 ? p.dark : p.skin))));
    S.push(cap([12.0, 5.0, 0.8], [14.2, 6.5, 0.95], 0.38, 0.12, 'white'), cap([12.0, 5.0, -0.8], [14.2, 6.5, -0.95], 0.38, 0.12, 'white'));
    S.push(cap([13.1, 4.4, 0], [13.6, 5.7, 0], 0.32, 0.1, 'white'));
    S.push(...eyes(12.1, 4.5, 1.25, 'orange'));
    S.push(...chain([[2, 4.2, 0], [-1.5, 3.6, 0], [-4.5, 2.8, 0]], [1.6, 0.9, 0.35], paint));
    return { S, feet: [], base: v.base || 'jungle' };
  },
  stegosaurus: (p, v) => {
    const paint = painter(p, () => 3.8, v.pattern || 'spots');
    const S = [];
    for (const [x, zs, top] of [[9.2, 1, 3.6], [9.2, -1, 3.6], [3.4, 1, 4.6], [3.4, -1, 4.6]]) {
      S.push(cap([x, top, zs * 1.6], [x, 0.5, zs * 1.7], 1.0, 0.8, paint));
      S.push(ell(x + 0.2, 0.4, zs * 1.7, 0.95, 0.4, 0.9, p.dark));
    }
    S.push(ell(6.1, 4.8, 0, 4.7, 2.4, 2.0, paint));
    S.push(cap([10.2, 4.0, 0], [12.3, 2.9, 0], 1.2, 0.8, paint));
    S.push(ell(13.2, 2.7, 0, 1.3, 0.7, 0.75, p.skin));
    S.push(...eyes(13.0, 3.0, 0.62, 'yellow'));
    S.push(...chain([[1.5, 5.1, 0], [-2, 4.7, 0], [-5, 3.9, 0], [-7.8, 3.3, 0]], [1.6, 1.1, 0.7, 0.4], paint));
    // back plates: tall thin fins alternating left/right
    for (let i = 0; i < 7; i++) {
      const x = -3.5 + i * 2.0;
      const spineY = 4.8 + 2.4 * Math.sqrt(Math.max(0, 1 - ((x - 6.1) / 5.8) ** 2)) - (x < 1 ? (1 - x) * 0.25 : 0);
      const hgt = 1.1 + 0.6 * Math.sin((i + 1) / 8 * Math.PI);
      S.push(ell(x, spineY + hgt * 0.7, i % 2 ? 0.45 : -0.45, 0.85, hgt, 0.32, (xx, y) => (y > spineY + hgt ? p.acc : p.dark)));
    }
    for (const zs of [1, -1]) S.push(cap([-7.4, 3.5, zs * 0.3], [-8.6, 4.8, zs * 1.6], 0.28, 0.08, 'white'), cap([-6.4, 3.7, zs * 0.3], [-7.2, 5.0, zs * 1.6], 0.28, 0.08, 'white'));
    return { S, feet: [], base: v.base || 'jungle' };
  },
  ankylosaur: (p, v) => {
    const paint = painter(p, () => 2.2, 'none');
    const S = [];
    for (const [x, zs] of [[9.4, 1], [9.4, -1], [3.4, 1], [3.4, -1]]) {
      S.push(cap([x, 2.4, zs * 2.2], [x, 0.4, zs * 2.3], 0.9, 0.8, paint));
      S.push(ell(x + 0.2, 0.35, zs * 2.3, 0.9, 0.35, 0.85, p.dark));
    }
    S.push(ell(6.4, 2.9, 0, 4.8, 1.7, 3.1, (x, y, z) => (y < 2.1 ? p.belly : (hash(x, y, z) % 5 === 0 ? p.acc : p.skin))));
    S.push(ell(11.6, 2.4, 0, 1.4, 0.95, 1.3, p.skin));
    S.push(ell(12.1, 3.1, 0.9, 0.5, 0.4, 0.4, p.dark), ell(12.1, 3.1, -0.9, 0.5, 0.4, 0.4, p.dark));
    S.push(...eyes(12.0, 2.7, 1.1, 'orange'));
    for (let i = 0; i < 4; i++) { const x = 3 + i * 2.3; S.push(cap([x, 2.7, 2.6], [x - 0.4, 2.6, 3.9], 0.32, 0.08, 'white'), cap([x, 2.7, -2.6], [x - 0.4, 2.6, -3.9], 0.32, 0.08, 'white')); }
    S.push(...chain([[1.6, 2.9, 0], [-2, 2.6, 0], [-5.2, 2.2, 0]], [1.5, 0.8, 0.5], paint));
    S.push(ell(-6.4, 2.2, 0, 1.3, 0.85, 1.3, p.acc));
    return { S, feet: [], studsOnTop: true, base: v.base || 'desert' };
  },
  spinosaurus: (p, v) => {
    const paint = painter(p, () => 5.0, 'none');
    const S = [];
    for (const zs of [1, -1]) {
      S.push(cap([7, 5.2, zs * 1.3], [7.6, 3.1, zs * 1.5], 1.2, 0.9, paint));
      S.push(cap([7.6, 3.1, zs * 1.5], [6.6, 0.9, zs * 1.5], 0.75, 0.55, paint));
      S.push(ell(7.4, 0.45, zs * 1.5, 1.5, 0.45, 0.7, p.skin));
      S.push(cap([10.6, 5.2, zs * 1.2], [11.8, 4.0, zs * 1.5], 0.5, 0.4, paint));
    }
    S.push(ell(7, 5.7, 0, 4.2, 1.9, 1.8, paint));
    S.push(cap([10.5, 6.2, 0], [12.4, 7.2, 0], 1.3, 1.0, paint));
    S.push(ell(15.0, 7.3, 0, 3.2, 0.75, 0.85, p.skin));
    S.push(ell(14.8, 6.75, 0, 2.9, 0.4, 0.75, p.belly));
    S.push(...mouth(13.4, 18.0, 7.0, 0.75));
    S.push(...eyes(13.2, 7.85, 0.68, 'yellow'));
    // sail: thin wall shaped like a hump, with stripes
    for (let x = 3; x <= 11; x += 0.5) {
      const h = 3.6 * Math.sin((x - 2.5) / 9 * Math.PI);
      if (h > 0.3) S.push(boxS(x, 6.8, -0.5, x + 0.5, 6.8 + h, 0.5, (xx, y) => (Math.floor(xx) % 2 === 0 ? p.acc : (y > 6.8 + h - 0.9 ? p.dark : p.acc === 'black' ? 'dred' : 'red'))));
    }
    S.push(...chain([[3.5, 5.9, 0], [0, 5.5, 0], [-4, 4.9, 0], [-8, 4.2, 0], [-11, 3.8, 0]], [1.7, 1.3, 0.9, 0.55, 0.25], paint));
    return { S, feet: [], base: v.base || 'swamp' };
  },
  crested: (p, v) => {
    const paint = painter(p, () => 3.6, v.pattern || 'stripes');
    const S = [];
    for (const zs of [1, -1]) {
      S.push(cap([5.2, 4.4, zs * 1.2], [5.9, 2.4, zs * 1.3], 1.1, 0.75, paint));
      S.push(cap([5.9, 2.4, zs * 1.3], [5.0, 0.6, zs * 1.3], 0.65, 0.5, paint));
      S.push(ell(5.7, 0.4, zs * 1.3, 1.2, 0.4, 0.6, p.skin));
      S.push(cap([8.8, 4.0, zs * 1.1], [9.4, 0.6, zs * 1.2], 0.5, 0.4, paint));
    }
    S.push(ell(6.3, 4.7, 0, 3.6, 1.8, 1.7, paint));
    S.push(cap([8.8, 5.3, 0], [10.6, 7.6, 0], 1.0, 0.75, paint));
    S.push(ell(11.6, 7.9, 0, 1.6, 0.7, 0.75, p.skin));
    S.push(ell(12.6, 7.6, 0, 0.8, 0.45, 0.6, p.belly));
    S.push(cap([11.0, 8.4, 0], [8.3, 10.2, 0], 0.5, 0.42, p.acc));
    S.push(...eyes(11.3, 8.1, 0.62, 'yellow'));
    S.push(...chain([[3, 4.8, 0], [-0.5, 4.5, 0], [-4, 3.8, 0], [-7, 3.2, 0]], [1.4, 1.0, 0.6, 0.25], paint));
    return { S, feet: [], base: v.base || 'swamp' };
  },
  pachy: (p, v) => {
    const paint = painter(p, () => 3.0, v.pattern || 'spots');
    const S = [];
    for (const zs of [1, -1]) {
      S.push(cap([5, 3.6, zs], [5.6, 1.9, zs * 1.1], 0.95, 0.65, paint));
      S.push(cap([5.6, 1.9, zs * 1.1], [4.8, 0.5, zs * 1.1], 0.55, 0.42, paint));
      S.push(ell(5.4, 0.35, zs * 1.1, 1.0, 0.35, 0.55, p.skin));
      S.push(cap([7.4, 3.6, zs], [8.2, 2.8, zs * 1.2], 0.35, 0.3, paint));
    }
    S.push(ell(5.2, 3.9, 0, 3.0, 1.6, 1.5, paint));
    S.push(cap([7.4, 4.4, 0], [8.6, 5.3, 0], 0.95, 0.8, paint));
    S.push(ell(9.6, 5.4, 0, 1.3, 1.0, 1.0, p.skin));
    S.push(ell(9.5, 6.2, 0, 1.4, 1.0, 1.15, p.acc));
    for (const [x, z] of [[8.4, 0.9], [8.4, -0.9], [8.2, 0]]) S.push(ell(x, 6.1, z, 0.35, 0.35, 0.35, 'white'));
    S.push(...eyes(10.0, 5.6, 0.8, 'yellow'));
    S.push(...chain([[2.5, 4.1, 0], [-1, 3.9, 0], [-4, 3.6, 0], [-6, 3.5, 0]], [1.2, 0.8, 0.45, 0.2], paint));
    return { S, feet: [[7, 1.1], [7, -1.1]], base: v.base || 'desert' };
  },
  dimetrodon: (p, v) => {
    const paint = painter(p, () => 1.9, 'none');
    const S = [];
    for (const [x, zs] of [[9, 1], [9, -1], [3.6, 1], [3.6, -1]]) {
      S.push(cap([x, 2.0, zs * 1.4], [x + 0.4, 1.0, zs * 2.6], 0.6, 0.5, paint));
      S.push(cap([x + 0.4, 1.0, zs * 2.6], [x + 0.6, 0.3, zs * 2.7], 0.45, 0.35, paint));
    }
    S.push(ell(6.4, 2.3, 0, 4.4, 1.1, 1.6, paint));
    S.push(ell(11.6, 2.4, 0, 1.6, 0.7, 0.8, p.skin));
    S.push(...mouth(10.8, 13.1, 2.2, 0.75));
    S.push(...eyes(11.2, 2.9, 0.65, 'orange'));
    for (let x = 2.5; x <= 10; x += 0.5) {
      const h = 3.6 * Math.sin((x - 2) / 8.5 * Math.PI);
      if (h > 0.3) S.push(boxS(x, 3.2, -0.5, x + 0.5, 3.2 + h, 0.5, (xx, y) => (Math.floor(xx * 2) % 3 === 0 ? p.dark : (y > 3.2 + h * 0.65 ? p.acc : p.skin))));
    }
    S.push(...chain([[2, 2.4, 0], [-1.5, 2.1, 0], [-5, 1.6, 0], [-8, 1.2, 0]], [1.1, 0.8, 0.5, 0.2], paint));
    return { S, feet: [], base: v.base || 'desert' };
  },
  mosasaur: (p, v) => {
    const paint = painter(p, () => 3.6, 'back');
    const S = [];
    S.push(boxS(5, 0, -1, 8, 2.6, 1, 'dgray'), ell(6.5, 2.4, 0, 2, 0.9, 1.4, 'dgray'));
    S.push(...chain([[13, 5.2, 0], [9, 4.4, 0], [5, 4.2, 0], [0, 4.8, 0], [-4.5, 5.8, 0], [-8, 7.2, 0]], [1.0, 1.6, 1.7, 1.3, 0.8, 0.4], paint));
    S.push(ell(14.8, 5.6, 0, 2.6, 0.8, 1.0, p.skin));
    S.push(ell(14.6, 4.9, 0, 2.4, 0.45, 0.85, p.belly));
    S.push(...mouth(13.2, 17.3, 5.25, 0.9));
    S.push(...eyes(13.8, 6.1, 0.8, 'yellow'));
    for (const zs of [1, -1]) { S.push(ell(9.6, 3.8, zs * 2.4, 1.5, 0.25, 1.4, p.dark), ell(2.6, 4.0, zs * 2.0, 1.2, 0.25, 1.1, p.dark)); }
    S.push(ell(-8.6, 8.0, 0, 0.7, 1.6, 0.3, p.acc), ell(-8.4, 6.6, 0, 0.6, 0.9, 0.3, p.acc));
    return { S, feet: [], base: 'sea' };
  },
  pterosaur: (p, v) => {
    const S = [];
    S.push(boxS(3.5, 0, -1, 6.5, 3.2, 1, 'dgray'), ell(5, 3.2, 0, 2, 0.8, 1.3, 'lgray'));
    S.push(ell(5.2, 4.8, 0, 2.4, 0.9, 1.0, p.belly));
    S.push(cap([7.2, 5.2, 0], [8.4, 6.2, 0], 0.6, 0.5, p.skin));
    S.push(ell(9.4, 6.4, 0, 1.0, 0.55, 0.55, p.skin));
    S.push(cap([10.0, 6.3, 0], [12.4, 5.9, 0], 0.4, 0.12, 'yellow'));
    S.push(cap([8.8, 6.7, 0], [6.6, 7.8, 0], 0.4, 0.2, p.acc));
    S.push(...eyes(9.5, 6.6, 0.45, 'orange'));
    for (const zs of [1, -1]) {
      S.push(cap([5.6, 5.2, zs * 0.8], [6.6, 6.2, zs * 4.5], 0.3, 0.25, p.dark));
      S.push(cap([6.6, 6.2, zs * 4.5], [5.0, 5.6, zs * 8.5], 0.25, 0.15, p.dark));
      S.push(ell(5.1, 5.4, zs * 4.6, 1.6, 0.22, 3.7, (x, y, z) => (Math.abs(z) > 7.2 ? p.acc : p.skin)));
    }
    S.push(...chain([[3, 4.9, 0], [1.5, 4.6, 0]], [0.4, 0.15], p.skin));
    return { S, feet: [], base: v.base || 'volcano' };
  },
  mammoth: (p, v) => {
    const fur = (x, y, z) => (hash(x, y, z) % 6 === 0 ? p.dark : p.skin);
    const S = [];
    for (const [x, zs] of [[9, 1], [9, -1], [3.4, 1], [3.4, -1]]) {
      S.push(cap([x, 5.2, zs * 1.7], [x, 0.5, zs * 1.8], 1.2, 1.05, fur));
      S.push(ell(x, 0.4, zs * 1.8, 1.1, 0.4, 1.05, 'dgray'));
    }
    S.push(ell(6.2, 6.4, 0, 4.8, 3.0, 2.8, fur));
    S.push(ell(10.8, 8.0, 0, 2.2, 2.4, 2.1, fur));
    S.push(ell(9.8, 10.0, 0, 1.4, 1.0, 1.3, fur));
    S.push(...chain([[12.4, 7.4, 0], [13.4, 5.6, 0], [13.6, 3.5, 0], [13.2, 2.0, 0], [12.6, 1.6, 0]], [0.9, 0.75, 0.6, 0.5, 0.45], fur));
    for (const zs of [1, -1]) S.push(...chain([[12.4, 6.6, zs * 1.1], [14.0, 5.2, zs * 1.6], [15.6, 5.6, zs * 1.8], [16.4, 7.0, zs * 1.4]], [0.42, 0.38, 0.3, 0.15], 'white'));
    for (const zs of [1, -1]) S.push(ell(10.3, 8.6, zs * 2.0, 0.6, 1.2, 0.8, p.dark));
    S.push(...eyes(12.1, 8.6, 1.1, 'black'));
    S.push(...chain([[1.6, 6.8, 0], [0.7, 5.6, 0]], [0.5, 0.25], fur));
    return { S, feet: [], base: 'snow' };
  },
  sabretooth: (p, v) => {
    const paint = (x, y, z) => (y < 3.0 && Math.abs(z) < 1.2 ? 'white' : (Math.floor(x * 0.9) % 3 === 0 && y > 3.6 ? p.dark : p.skin));
    const S = [];
    for (const [x, zs] of [[8.4, 1], [8.4, -1], [3.2, 1], [3.2, -1]]) {
      S.push(cap([x, 3.6, zs * 1.2], [x + 0.3, 0.5, zs * 1.3], 0.75, 0.55, paint));
      S.push(ell(x + 0.5, 0.35, zs * 1.3, 0.8, 0.35, 0.6, p.skin));
    }
    S.push(ell(5.8, 4.2, 0, 3.8, 1.5, 1.5, paint));
    S.push(cap([8.8, 4.6, 0], [10.0, 5.6, 0], 1.1, 0.95, paint));
    S.push(ell(11.0, 5.8, 0, 1.4, 1.1, 1.2, p.skin));
    S.push(ell(12.2, 5.4, 0, 0.8, 0.6, 0.8, 'white'));
    for (const zs of [1, -1]) { S.push(cap([12.3, 5.0, zs * 0.5], [12.4, 3.6, zs * 0.5], 0.28, 0.1, 'white')); S.push(ell(10.4, 6.9, zs * 0.8, 0.4, 0.45, 0.35, p.skin)); }
    S.push(...eyes(11.6, 6.2, 0.75, 'yellow'));
    S.push(...chain([[2.1, 4.6, 0], [0.8, 4.0, 0]], [0.5, 0.35], p.skin));
    return { S, feet: [], base: 'snow' };
  },
};
export const DINO_SPECIES = Object.keys(SPECIES);

function scaleShape(s, k) {
  const m = v => v * k;
  if (s.k === 'e') return { ...s, cx: m(s.cx), cy: m(s.cy), cz: m(s.cz), rx: m(s.rx), ry: m(s.ry), rz: m(s.rz), c: wrap(s.c, k) };
  if (s.k === 'b') return { ...s, x0: m(s.x0), y0: m(s.y0), z0: m(s.z0), x1: m(s.x1), y1: m(s.y1), z1: m(s.z1), c: wrap(s.c, k) };
  return { ...s, a: s.a.map(m), b: s.b.map(m), ra: m(s.ra), rb: m(s.rb), c: wrap(s.c, k) };
}
const wrap = (c, k) => (typeof c === 'function' ? (x, y, z) => c(x / k, y / k, z / k) : c);

export function genDinosaurDetailed(b, rng, o = {}) {
  const species = o.species || rng.pick(DINO_SPECIES);
  const p = o.palette || (species === 'mammoth' ? { skin: rng.pick(['brown', 'dred']), belly: 'brown', dark: 'black', acc: 'white' }
    : species === 'sabretooth' ? { skin: rng.pick(['tan', 'orange', 'gold']), belly: 'white', dark: 'brown', acc: 'white' }
    : rng.pick(SKINS));
  const k = o.scale || 1;
  const def = SPECIES[species](p, { ...o, iris: rng.pick(['yellow', 'orange', 'lime']) });
  const shapes = def.S.map(s => scaleShape(s, k));
  // base sized to the creature
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const s of shapes) {
    const xs = s.k === 'e' ? [s.cx - s.rx, s.cx + s.rx] : s.k === 'b' ? [s.x0, s.x1] : [Math.min(s.a[0], s.b[0]), Math.max(s.a[0], s.b[0])];
    const zs = s.k === 'e' ? [s.cz - s.rz, s.cz + s.rz] : s.k === 'b' ? [s.z0, s.z1] : [Math.min(s.a[2], s.b[2]) - s.ra, Math.max(s.a[2], s.b[2]) + s.ra];
    x0 = Math.min(x0, xs[0]); x1 = Math.max(x1, xs[1]); z0 = Math.min(z0, zs[0]); z1 = Math.max(z1, zs[1]);
  }
  const bx0 = Math.floor(x0) - 2, bz0 = Math.floor(Math.min(z0, -3)) - 2;
  const bw = Math.ceil(x1) + 2 - bx0;
  let bd = Math.ceil(Math.max(z1, 3)) + 2 - bz0;
  const want = Math.round(bw * 0.5);
  let bzz = bz0;
  if (bd < want) { bzz -= Math.floor((want - bd) / 2); bd = want; }
  const showBase = o.base !== false;
  const baseStyle = o.baseStyle || def.base;
  let blob = () => true;
  if (showBase) ({ blob } = terrainBase(b, rng, bx0, bzz, bw, bd, baseStyle));
  sculpt(b, shapes, showBase ? 1 : 0);
  // armour studs on top of armoured dinosaurs
  if (def.studsOnTop) {
    for (let x = Math.floor(2 * k); x <= Math.floor(10 * k); x += 2) for (let z = Math.floor(-2.4 * k); z <= Math.floor(2.4 * k); z += 2) {
      const y = topAt(b, x, z, 80); if (y > 3) b.add('round_plate_1x1', x, y, z, 0, p.acc);
    }
  }
  if (def.spine) {
    for (let x = Math.floor(def.spine[0][0] * k); x <= Math.floor(def.spine[1][0] * k); x += 2) { const y = topAt(b, x, 0, 80); if (y > 3) b.add('spike_1x1', x, y, 0, 0, p.acc); }
  }
  // toe claws
  for (const [fx, fz] of def.feet) { const x = Math.floor(fx * k), z = Math.floor(fz * k); if (b.isFree(x, 1, z)) b.add('spike_1x1', x, showBase ? 1 : 0, z, 0, 'white'); }
  if (showBase) decorate(b, rng, bx0, bzz, bw, bd, blob, baseStyle, Math.round(6 + k * 3));
  if (showBase && baseStyle === 'volcano') {
    const vx = bx0 + 1, vz = bzz + 1;
    for (let l = 0; l < 3; l++) b.fill(1 + l * 3, vx + l, vz + l, 6 - 2 * l, 6 - 2 * l, l === 2 ? 'dred' : 'dgray', 'brick');
    b.add('cone_1x1', vx + 2, 10, vz + 2, 0, 'tred'); b.add('cone_1x1', vx + 3, 10, vz + 3, 0, 'tyellow');
  }
  return { style: species, main: p.skin };
}
