// bags.js — splits every set into numbered bags, like a real box.
// Bag 1 holds the pieces for the first steps, bag 2 the next steps, and so on.
// You open (and sort) a bag before building the steps that use it.
const cache = new Map();

export function bagsOf(set) {
  let bags = cache.get(set.id);
  if (bags) return bags;
  const n = Math.max(1, Math.min(8, set.steps.length, Math.round(set.brickCount / 45)));
  const per = set.brickCount / n;
  bags = [];
  let cur = { index: 0, firstStep: 0, lastStep: 0, pieces: [] };
  let acc = 0;
  set.steps.forEach((st, si) => {
    if (cur.pieces.length && acc >= per * (bags.length + 1) && bags.length < n - 1) {
      bags.push(cur);
      cur = { index: bags.length, firstStep: si, lastStep: si, pieces: [] };
    }
    cur.pieces.push(...st);
    cur.lastStep = si;
    acc += st.length;
  });
  bags.push(cur);
  cache.set(set.id, bags);
  return bags;
}

export function bagOfStep(set, step) {
  const bags = bagsOf(set);
  for (const b of bags) if (step >= b.firstStep && step <= b.lastStep) return b.index;
  return bags.length - 1;
}

/** How many bags are open for an owned set (older saves didn't track this). */
export function bagsOpened(set, own) {
  if (!own) return 0;
  const total = bagsOf(set).length;
  if (own.state === 'completed') return total;
  if (typeof own.bags === 'number') return Math.max(0, Math.min(total, own.bags));
  if (own.state === 'unopened') return 0;
  // progress from before bags existed: open everything needed so far
  const placed = new Set(own.placed);
  let cur = set.steps.findIndex(st => st.some(i => !placed.has(i)));
  if (cur < 0) cur = set.steps.length - 1;
  return own.placed.length ? bagOfStep(set, cur) + 1 : 0;
}
