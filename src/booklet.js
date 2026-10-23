// booklet.js — instruction booklets you can flick through, like a real set.
// Every set gets: a cover, one page per construction step (big step number, a
// "pieces you need" callout and a picture of the model with the new pieces outlined),
// a "finished!" page and a parts list at the back. All pictures are drawn from the
// set's own brick list from one fixed viewpoint, so page after page lines up.
import * as THREE from 'three';
import { ThumbnailMaker, frameModel } from './engine.js';
import { threeColor } from './brickRenderer.js';
import { PART_BY_ID, COLOR_BY_ID } from './parts.js';
import { CATEGORY_BY_ID, RARITY_BY_ID } from './catalog.js';
import { el, clear } from './ui.js';
import { bagsOf } from './bags.js';

const PAGE_SIZE = [640, 480];
const views = new Map();
const dimCache = new Map();
const WHITE = new THREE.Color('#ffffff');

function pageMaker(game) {
  if (!game.pageMaker) {
    game.pageMaker = new ThumbnailMaker(game.engine.envMap, PAGE_SIZE, { fancy: game.engine.quality.ao, bgInner: '#fdfdfb', bgOuter: '#eef3f9' });
    game.pageMaker.maxCache = 160;
  }
  return game.pageMaker;
}

/** One camera position per set, framing the finished model. */
function viewFor(set) {
  let v = views.get(set.id);
  if (!v) {
    const cam = new THREE.PerspectiveCamera(30, PAGE_SIZE[0] / PAGE_SIZE[1], 0.1, 1000);
    const { target, bb } = frameModel(cam, set.bricks, new THREE.Vector3(), 1.18);
    v = { position: cam.position.clone(), target: target.clone(), near: cam.near, far: cam.far, bb };
    views.set(set.id, v);
  }
  return v;
}

/** Earlier pieces are drawn slightly paler so the new pieces stand out. */
function dim(c) {
  let d = dimCache.get(c);
  if (!d) { d = threeColor(c).clone().lerp(WHITE, 0.28); dimCache.set(c, d); }
  return d;
}

/** Picture for a step page (or the finished model when step === 'final'). */
export function stepImage(game, set, step, cb, urgent = false) {
  const key = `book:${set.id}:${step}`;
  const last = step === 'final' ? set.steps.length - 1 : step;
  pageMaker(game).request(key, () => {
    const out = [];
    for (let s = 0; s <= last; s++) for (const i of set.steps[s]) out.push(set.bricks[i]);
    return out;
  }, url => cb(url), () => {
    if (step === 'final') return { view: viewFor(set), detail: 1 };
    const fresh = new Set(set.steps[step].map(i => set.bricks[i]));
    return { view: viewFor(set), detail: 1, highlight: fresh, outlineColor: 0xff8a00, tint: b => (fresh.has(b) ? null : dim(b.c)) };
  }, urgent);
}

function partIcon(game, t, c) {
  const img = el('img', { alt: '' });
  game.thumbFor(`part:${t}:${c}`, () => [{ t, x: 0, y: 0, z: 0, r: t.startsWith('wheel') || t.startsWith('slope') || t === 'windscreen_2x4' ? 1 : 0, c }], u => { if (u) img.src = u; });
  return img;
}

function stepPieces(set, step) {
  const m = new Map();
  for (const i of set.steps[step]) {
    const b = set.bricks[i];
    const k = b.t + '|' + b.c;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].map(([k, n]) => { const [t, c] = k.split('|'); return { t, c, n }; });
}

/** Total pages: cover + steps + finished + parts list. */
export const pageCount = set => set.steps.length + 3;
export const pageOfStep = step => step + 1;
export const stepOfPage = (set, page) => (page >= 1 && page <= set.steps.length ? page - 1 : null);

/**
 * Build the DOM for one booklet page.
 * opts.built(stepIndex) -> true if that step is already built (shows a tick).
 */
export function renderPage(game, set, page, opts = {}) {
  const total = pageCount(set);
  const foot = el('div', { class: 'bp-foot' }, el('span', { text: set.name }), el('b', { text: `${page + 1}` }));
  const rar = RARITY_BY_ID[set.rarity];
  if (page === 0) {
    const img = el('img', { class: 'bp-cover-img', alt: set.name });
    game.thumb(set, u => { if (u) img.src = u; });
    return el('div', { class: 'bpage cover', style: { '--rar': rar.color } },
      el('div', { class: 'bp-cover-top' }, el('span', { class: 'bp-logo' }, 'Brick', el('b', { text: 'Verse' })), el('span', { class: 'bp-age', text: `${set.brickCount.toLocaleString()} pcs` })),
      el('div', { class: 'bp-cover-cat', text: CATEGORY_BY_ID[set.category].icon + ' ' + CATEGORY_BY_ID[set.category].name }),
      el('h2', { class: 'bp-cover-title', text: set.name }),
      img,
      el('div', { class: 'bp-cover-foot' }, el('span', { class: 'badge rarity-' + set.rarity, text: rar.name }), el('span', { text: `${set.steps.length} steps` }), el('span', { text: 'Instruction booklet' })));
  }
  if (page === total - 1) {
    const grid = el('div', { class: 'bp-parts' });
    for (const p of set.parts) grid.appendChild(el('div', { class: 'bp-part', title: `${PART_BY_ID[p.t].name} — ${COLOR_BY_ID[p.c].name}` }, partIcon(game, p.t, p.c), el('b', { text: `${p.n}×` }), el('span', { text: PART_BY_ID[p.t].name })));
    return el('div', { class: 'bpage parts-page' }, el('h3', { class: 'bp-title', text: 'Parts list' }), el('p', { class: 'bp-sub', text: `${set.brickCount.toLocaleString()} pieces • ${set.parts.length} kinds` }), grid, foot);
  }
  if (page === total - 2) {
    const img = el('img', { class: 'bp-img', alt: 'Finished model' });
    stepImage(game, set, 'final', u => { if (u) { img.src = u; img.classList.add('loaded'); } }, true);
    return el('div', { class: 'bpage final' }, el('h3', { class: 'bp-title', text: 'Finished! 🎉' }), el('p', { class: 'bp-sub', text: 'Great building — find a nice spot for it in your Display Room.' }), el('div', { class: 'bp-img-wrap' }, img, el('div', { class: 'bp-loading', text: 'Drawing…' })), foot);
  }
  const step = page - 1;
  const callout = el('div', { class: 'callout' });
  for (const p of stepPieces(set, step)) callout.appendChild(el('div', { class: 'co-piece', title: `${PART_BY_ID[p.t].name} — ${COLOR_BY_ID[p.c].name}` }, partIcon(game, p.t, p.c), el('b', { text: `${p.n}×` })));
  const img = el('img', { class: 'bp-img', alt: `Step ${step + 1}` });
  stepImage(game, set, step, u => { if (u) { img.src = u; img.classList.add('loaded'); } }, true);
  // quietly draw the next page too, so flicking forward feels instant
  if (step + 1 < set.steps.length) stepImage(game, set, step + 1, () => {});
  const built = opts.built && opts.built(step);
  const bag = bagsOf(set).find(bg => bg.firstStep === step);
  return el('div', { class: 'bpage step' + (opts.current === step ? ' current' : '') },
    el('div', { class: 'bp-head' }, el('span', { class: 'bp-step', text: String(step + 1) }), callout, built ? el('span', { class: 'bp-done', text: '✓' }) : null),
    bag && bagsOf(set).length > 1 ? el('div', { class: 'bp-bag', title: `Open bag ${bag.index + 1} now` }, el('span', { text: String(bag.index + 1) }), el('small', { text: 'Open bag' })) : null,
    el('div', { class: 'bp-img-wrap' }, img, el('div', { class: 'bp-loading', text: 'Drawing…' })),
    foot);
}

/**
 * A flippable book that lives inside any container element.
 * It animates page turns forwards and backwards.
 */
export class BookView {
  constructor(game, set, opts = {}) {
    this.g = game; this.set = set; this.opts = opts;
    this.page = opts.page ?? 0;
    this.el = el('div', { class: 'book' + (opts.compact ? ' compact' : '') });
    this.current = renderPage(game, set, this.page, opts);
    this.el.appendChild(this.current);
  }
  get total() { return pageCount(this.set); }

  go(page, animate = true) {
    page = Math.max(0, Math.min(this.total - 1, page));
    if (page === this.page && this.current) { this.refresh(); return; }
    const forward = page > this.page;
    this.page = page;
    const next = renderPage(this.g, this.set, page, this.opts);
    const old = this.current;
    this.current = next;
    if (!animate || !old) { clear(this.el); this.el.appendChild(next); return; }
    this.g.audio.play('page');
    // clear any page still mid-turn
    for (const c of [...this.el.children]) if (c !== old) c.remove();
    if (forward) {
      this.el.insertBefore(next, old);
      old.classList.add('turn-away');
    } else {
      this.el.appendChild(next);
      next.classList.add('turn-in');
    }
    setTimeout(() => { if (old.isConnected) old.remove(); next.classList.remove('turn-in'); }, 480);
  }
  refresh() { const n = renderPage(this.g, this.set, this.page, this.opts); clear(this.el); this.el.appendChild(n); this.current = n; }
}

/** Full-screen booklet reader with page buttons, a page slider and keyboard arrows. */
export function openBooklet(game, set, opts = {}) {
  const book = new BookView(game, set, { page: opts.page ?? 0, built: opts.built, current: opts.current });
  const label = el('span', { class: 'bk-label' });
  const slider = el('input', { type: 'range', min: 0, max: book.total - 1, value: book.page, 'aria-label': 'Page', class: 'bk-slider' });
  const goStep = el('button', { class: 'btn primary small', text: 'Build this step' });
  const update = () => {
    const st = stepOfPage(set, book.page);
    label.textContent = book.page === 0 ? 'Cover' : st != null ? `Step ${st + 1} of ${set.steps.length}` : book.page === book.total - 1 ? 'Parts list' : 'Finished';
    slider.value = book.page;
    prev.disabled = book.page === 0; next.disabled = book.page === book.total - 1;
    goStep.style.display = opts.onGoToStep && st != null && (opts.maxStep == null || st <= opts.maxStep) ? '' : 'none';
  };
  const turn = d => { book.go(book.page + d); update(); };
  const prev = el('button', { class: 'bk-nav prev', 'aria-label': 'Previous page', text: '‹', onclick: () => turn(-1) });
  const next = el('button', { class: 'bk-nav next', 'aria-label': 'Next page', text: '›', onclick: () => turn(1) });
  slider.addEventListener('input', () => { book.go(Number(slider.value), false); update(); });
  const close = () => { back.classList.remove('show'); window.removeEventListener('keydown', onKey, true); setTimeout(() => back.remove(), 200); opts.onClose && opts.onClose(); };
  goStep.addEventListener('click', () => { const st = stepOfPage(set, book.page); close(); opts.onGoToStep(st); });
  const jump = (label2, page) => el('button', { class: 'btn ghost small', text: label2, onclick: () => { book.go(page); update(); } });
  const onKey = e => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); turn(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); e.stopPropagation(); turn(-1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Home') { book.go(0); update(); }
    else if (e.key === 'End') { book.go(book.total - 1); update(); }
    if (e.key !== 'Tab') e.stopPropagation();   // don't let the studio react while reading
  };
  // click the right or left half of the page to turn it
  book.el.addEventListener('click', e => { if (e.target.closest('button')) return; const r = book.el.getBoundingClientRect(); turn(e.clientX > r.left + r.width / 2 ? 1 : -1); });
  const back = el('div', { class: 'booklet-back' },
    el('div', { class: 'booklet-frame' },
      el('div', { class: 'bk-top' }, el('b', { text: '📖 ' + set.name }), el('div', { class: 'bk-jumps' }, jump('Cover', 0), opts.current != null ? jump('My step', pageOfStep(opts.current)) : null, jump('Parts list', book.total - 1)), el('button', { class: 'icon-btn', 'aria-label': 'Close booklet', text: '✕', onclick: close })),
      el('div', { class: 'bk-stage' }, prev, book.el, next),
      el('div', { class: 'bk-bottom' }, label, slider, goStep, el('span', { class: 'muted bk-tip', text: '← → keys or click the page to turn' }))));
  back.addEventListener('pointerdown', e => { if (e.target === back) close(); });
  window.addEventListener('keydown', onKey, true);
  document.body.appendChild(back);
  requestAnimationFrame(() => back.classList.add('show'));
  update();
  return { close, book };
}
