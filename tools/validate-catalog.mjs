// Run with:  node tools/validate-catalog.mjs
// Checks every set in the catalogue: unique ids/names, no overlapping pieces, every
// instruction step points at a real piece, every piece appears in exactly one step,
// all pieces are connected, and no two sets have the same shape.
import { buildCatalog, CATEGORIES } from '../src/catalog.js';
import { Occupancy } from '../src/grid.js';
import { PART_BY_ID, COLOR_BY_ID } from '../src/parts.js';
import { shapeSignature } from '../src/models.js';

const t0 = Date.now();
const sets = await buildCatalog(null, async () => {});
const ms = Date.now() - t0;
let errors = 0, warnings = 0;
const err = m => { errors++; console.log('  ERROR ' + m); };
const ids = new Set(), names = new Set(), sigs = new Map();
let totalBricks = 0;
const perCat = {};
const loose = [];
for (const s of sets) {
  perCat[s.category] = (perCat[s.category] || 0) + 1;
  if (ids.has(s.id)) err('duplicate id ' + s.id); ids.add(s.id);
  if (names.has(s.name)) err('duplicate name ' + s.name); names.add(s.name);
  const sig = shapeSignature(s.bricks);
  if (sigs.has(sig)) err(`${s.name} has the same shape as ${sigs.get(sig)}`); sigs.set(sig, s.name);
  if (s.bricks.length < 8) err(`${s.name} has only ${s.bricks.length} pieces`);
  totalBricks += s.bricks.length;
  const occ = new Occupancy();
  for (const b of s.bricks) {
    if (!PART_BY_ID[b.t]) err(`${s.name}: unknown part ${b.t}`);
    if (!COLOR_BY_ID[b.c]) err(`${s.name}: unknown colour ${b.c}`);
    if (occ.collides(b)) err(`${s.name}: overlapping piece ${b.t}`);
    occ.add(b);
  }
  const seen = new Set();
  for (const st of s.steps) for (const i of st) {
    if (!(i in s.bricks)) err(`${s.name}: step refers to missing piece ${i}`);
    if (seen.has(i)) err(`${s.name}: piece ${i} in two steps`); seen.add(i);
  }
  if (seen.size !== s.bricks.length) err(`${s.name}: ${s.bricks.length - seen.size} pieces never appear in a step`);
  let unsup = 0;
  for (const b of s.bricks) if (!occ.supported(b)) unsup++;
  if (unsup) loose.push([s.name, unsup, s.bricks.length]);
  const partsN = s.parts.reduce((a, p) => a + p.n, 0);
  if (partsN !== s.bricks.length) err(`${s.name}: parts list count mismatch`);
}
console.log(`Built ${sets.length} sets, ${totalBricks} pieces in ${ms} ms`);
console.log('Per category:', CATEGORIES.map(c => `${c.id}:${perCat[c.id] || 0}`).join(' '));
const sizes = sets.map(s => s.brickCount).sort((a, b) => a - b);
console.log(`Pieces per set: min ${sizes[0]}, median ${sizes[sizes.length >> 1]}, max ${sizes[sizes.length - 1]}`);
const rar = {}; for (const s of sets) rar[s.rarity] = (rar[s.rarity] || 0) + 1; console.log('Rarity:', JSON.stringify(rar));
if (loose.length) {
  warnings += loose.length;
  console.log(`Sets with floating (unconnected) pieces: ${loose.length}`);
  for (const [n, u, t] of loose.sort((a, b) => b[1] / b[2] - a[1] / a[2]).slice(0, 25)) console.log(`   ${n}: ${u}/${t}`);
}
if (process.argv.includes('--list')) for (const s of sets) console.log(`${s.id.padEnd(16)} ${s.name.padEnd(30)} ${String(s.brickCount).padStart(4)} pcs  $${s.price}  ${s.rarity}`);
console.log(errors ? `FAILED with ${errors} errors` : `OK (${warnings} warnings)`);
process.exit(errors ? 1 : 0);
