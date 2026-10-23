// Developer check for Big City sets: pieces that failed to fit, floating pieces,
// pieces off the baseplate, and plants/flowers standing on hard ground.
// Run: node tools/audit-city.mjs [kind]
import { ModelBuilder, makeRng } from '../src/models.js';
import { genBigCity, BIG_CITY } from '../src/generators/city.js';
import { Occupancy, boundsOf } from '../src/grid.js';
import { PART_BY_ID, footprint } from '../src/parts.js';

const only = process.argv[2];
// count attempted-but-blocked placements with their reasons
const origAdd = ModelBuilder.prototype.add;
for (const kind of BIG_CITY.filter(k => !only || k === only)) {
  const b = new ModelBuilder();
  const blocked = [];
  b.add = function (t, x, y, z, r = 0, c = 'white') {
    const ok = origAdd.call(this, t, x, y, z, r, c);
    if (!ok) { const st = new Error().stack.split('\n')[2].trim().replace(/.*city\.js:/, 'line ').replace(/\)$/, ''); blocked.push(`${t}@${x},${y},${z} ${c} [${st}]`); }
    return ok;
  };
  genBigCity(b, makeRng('bv-bigcity-audit-' + kind), { kind });
  const bricks = b.bricks;
  const occ = new Occupancy(bricks);
  const floating = bricks.filter(br => !occ.supported(br));
  // base footprint = pieces at y=0
  const base = new Set(); for (const br of bricks) if (br.y === 0) { const f = footprint(PART_BY_ID[br.t], br.r); for (let i = 0; i < f.w; i++) for (let j = 0; j < f.d; j++) base.add((br.x + i) + ',' + (br.z + j)); }
  const off = bricks.filter(br => { const f = footprint(PART_BY_ID[br.t], br.r); for (let i = 0; i < f.w; i++) for (let j = 0; j < f.d; j++) if (!base.has((br.x + i) + ',' + (br.z + j))) return true; return false; });
  const plantsOnHard = bricks.filter(br => (br.t === 'flower_1x1') && (() => { const below = occ.at(br.x, br.y - 1, br.z); return below && !['green', 'dgreen', 'brown', 'lime'].includes(below.c) && below.t !== 'round_1x1'; })());
  console.log(`\n== ${kind}: ${bricks.length} pieces, ${blocked.length} blocked, ${floating.length} floating, ${off.length} off-base, ${plantsOnHard.length} flowers on hard ground`);
  const show = (label, list, f = x => x) => { if (list.length) console.log('  ' + label + ': ' + list.slice(0, 40).map(f).join('\n    ')); };
  show('blocked', blocked);
  show('floating', floating, br => `${br.t}@${br.x},${br.y},${br.z} ${br.c}`);
  show('off-base', off, br => `${br.t}@${br.x},${br.y},${br.z} ${br.c}`);
  show('flowers on hard ground', plantsOnHard, br => `${br.t}@${br.x},${br.y},${br.z}`);
}
