// instructions.js — step-by-step instruction mode for a purchased set.
// Targets come straight from the set's brick list (the same data that defines the
// finished model), shifted onto the building plate. Steps are the set's step list.
import { samePlacement } from './grid.js';
import { PART_BY_ID } from './parts.js';

export class InstructionSession {
  constructor(set, ownership, offset) {
    this.set = set;
    this.own = ownership;
    this.offset = offset;
    this.targets = set.bricks.map(b => ({ ...b, x: b.x + offset.x, z: b.z + offset.z }));
    this.placed = new Set(ownership.placed);
    this.order = ownership.placed.slice();     // placement history for undo
    this.redoStack = [];
    this.mistakes = 0;
    this.stepOf = new Array(this.targets.length);
    set.steps.forEach((st, si) => st.forEach(i => { this.stepOf[i] = si; }));
  }
  get steps() { return this.set.steps; }
  /** First step that still has pieces to place (== steps.length when finished). */
  currentStep() {
    for (let s = 0; s < this.steps.length; s++) if (this.steps[s].some(i => !this.placed.has(i))) return s;
    return this.steps.length;
  }
  isComplete() { return this.placed.size === this.targets.length; }
  remaining(stepIndex) { return (this.steps[stepIndex] || []).filter(i => !this.placed.has(i)); }
  placedBricks() { return [...this.placed].map(i => this.targets[i]); }
  progress() { return this.placed.size / this.targets.length; }

  /** Pieces needed for a step, grouped by part + colour. */
  stepPieces(stepIndex) {
    const m = new Map();
    for (const i of this.steps[stepIndex] || []) {
      const t = this.targets[i];
      const k = t.t + '|' + t.c;
      if (!m.has(k)) m.set(k, { t: t.t, c: t.c, total: 0, remaining: 0, r: t.r });
      const e = m.get(k); e.total++; if (!this.placed.has(i)) { e.remaining++; e.r = t.r; }
    }
    return [...m.values()].sort((a, b) => (b.remaining > 0) - (a.remaining > 0) || PART_BY_ID[a.t].name.localeCompare(PART_BY_ID[b.t].name));
  }

  /** Index of an unplaced target in the current step matching this placement, or -1. */
  match(b) {
    const st = this.currentStep();
    for (const i of this.remaining(st)) {
      const t = this.targets[i];
      if (t.c === b.c && samePlacement(t, b)) return i;
    }
    return -1;
  }
  /** Same as match() but ignoring colour/part — used to explain mistakes. */
  nearMiss(b) {
    const st = this.currentStep();
    for (const i of this.remaining(st)) {
      const t = this.targets[i];
      if (t.x === b.x && t.y === b.y && t.z === b.z) return i;
    }
    return -1;
  }

  place(i) {
    if (this.placed.has(i)) return false;
    const before = this.currentStep();
    this.placed.add(i); this.order.push(i); this.redoStack = [];
    this.sync();
    return { stepDone: this.currentStep() !== before, finished: this.isComplete() };
  }
  undo() {
    const i = this.order.pop();
    if (i === undefined) return null;
    this.placed.delete(i); this.redoStack.push(i);
    this.sync();
    return i;
  }
  redo() {
    const i = this.redoStack.pop();
    if (i === undefined) return null;
    this.placed.add(i); this.order.push(i);
    this.sync();
    return i;
  }
  reset() { this.placed.clear(); this.order = []; this.redoStack = []; this.mistakes = 0; this.sync(); }
  sync() { this.own.placed = this.order.slice(); }
}
