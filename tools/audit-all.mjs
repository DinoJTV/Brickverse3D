// Developer check for EVERY set: which generator lines make floating pieces or
// pieces that could not be placed (blocked). Run: node tools/audit-all.mjs [category]
import { ModelBuilder } from '../src/models.js';
import { Occupancy } from '../src/grid.js';

const only = process.argv[2];
const where = () => {
  const lines = new Error().stack.split('\n').filter(l => l.includes('/generators/') || l.includes('catalog.js'));
  return lines.slice(0, 2).map(l => l.replace(/.*\/(generators\/)?([a-zA-Z]+\.js):(\d+):\d+\)?/, '$2:$3')).join(' < ');
};
const blocked = new Map();
const orig = ModelBuilder.prototype.add;
ModelBuilder.prototype.add = function (t, x, y, z, r = 0, c = 'white') {
  const ok = orig.call(this, t, x, y, z, r, c);
  const src = where();
  if (ok) this.bricks[this.bricks.length - 1].src = src;
  else if (y >= 0) blocked.set(src + ' ' + t, (blocked.get(src + ' ' + t) || 0) + 1);
  return ok;
};
const { buildCatalog } = await import('../src/catalog.js');
const sets = await buildCatalog(null, async () => {});
const floatBy = new Map();
let bad = 0;
for (const s of sets) {
  if (only && s.category !== only) continue;
  const occ = new Occupancy(s.bricks);
  const fl = s.bricks.filter(b => !occ.supported(b));
  if (fl.length) bad++;
  for (const b of fl) {
    const k = (b.src || '?') + ' ' + b.t;
    const e = floatBy.get(k) || { n: 0, sets: new Set() };
    e.n++; e.sets.add(s.name); floatBy.set(k, e);
  }
}
console.log(`${bad} sets with floating pieces`);
console.log('FLOATING by source line:');
for (const [k, e] of [...floatBy].sort((a, b) => b[1].n - a[1].n).slice(0, 80)) console.log(`  ${String(e.n).padStart(4)} pcs ${String(e.sets.size).padStart(3)} sets  ${k}   e.g. ${[...e.sets][0]}`);
if (!only) {
  console.log('BLOCKED by source line:');
  for (const [k, n] of [...blocked].sort((a, b) => b[1] - a[1]).slice(0, 60)) console.log(`  ${String(n).padStart(4)}  ${k}`);
}
