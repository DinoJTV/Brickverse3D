// inventory.js — "My Collection": every set you own, with filters for unopened /
// in progress / completed, category and rarity, and completion percentages.
import { CATEGORIES, CATEGORY_BY_ID, RARITIES, RARITY_BY_ID } from './catalog.js';
import { el, clear, money, rarityBadge, difficultyStars } from './ui.js';
import { openBooklet } from './booklet.js';
import { boxArtUrl } from './boxArt.js';
import { bagsOf, bagsOpened } from './bags.js';

export class Collection {
  constructor(game) {
    this.g = game;
    this.el = document.getElementById('screen-collection');
    this.state = 'all'; this.cat = 'all'; this.rarity = 'any';
    this.build();
    this.observer = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) {
        this.observer.unobserve(e.target);
        const set = this.g.setById(e.target.dataset.set);
        const show = url => { if (url) { e.target.src = url; e.target.classList.add('loaded'); } };
        if (set) { if (e.target.dataset.kind === 'box') boxArtUrl(this.g, set, show); else this.g.thumb(set, show); }
      }
    }, { rootMargin: '300px' });
  }

  build() {
    this.tabs = el('div', { class: 'seg' });
    const sel = (opts, fn, label) => { const s = el('select', { class: 'input select', 'aria-label': label, onchange: () => fn(s.value) }, ...opts.map(([v, t]) => el('option', { value: v, text: t }))); return s; };
    this.grid = el('div', { class: 'card-grid' });
    this.summary = el('div', { class: 'summary-row' });
    this.el.append(el('div', { class: 'page collection-page' }, el('div', { class: 'page-main full' },
      el('div', { class: 'page-head' }, el('div', {}, el('h2', { text: 'My Collection' }), this.summary),
        el('div', { class: 'filters' }, this.tabs,
          sel([['all', 'All categories'], ...CATEGORIES.map(c => [c.id, c.icon + ' ' + c.name])], v => { this.cat = v; this.render(); }, 'Category'),
          sel([['any', 'Any rarity'], ...RARITIES.map(r => [r.id, r.name])], v => { this.rarity = v; this.render(); }, 'Rarity'))),
      this.grid)));
  }

  async enter() { this.g.engine.setStage(null); this.render(); }
  leave() { return true; }

  render() {
    const owned = this.g.ownedSets();
    const s = this.g.save.owned;
    const counts = { all: owned.length, unopened: 0, opened: 0, completed: 0 };
    for (const set of owned) counts[s[set.id].state]++;
    const t = clear(this.tabs);
    for (const [id, label] of [['all', 'All'], ['unopened', '📦 Unopened'], ['opened', '🔨 In progress'], ['completed', '✅ Completed']]) {
      t.appendChild(el('button', { class: 'seg-btn' + (this.state === id ? ' on' : ''), onclick: () => { this.state = id; this.render(); } }, label, el('span', { class: 'seg-n', text: counts[id] })));
    }
    const sm = clear(this.summary);
    const pieces = owned.filter(x => s[x.id].state === 'completed').reduce((a, x) => a + x.brickCount, 0);
    sm.append(el('span', { class: 'muted', text: `${owned.length} owned • ${counts.completed} built • ${pieces.toLocaleString()} pieces on display` }));

    let list = owned.filter(x => (this.state === 'all' || s[x.id].state === this.state) && (this.cat === 'all' || x.category === this.cat) && (this.rarity === 'any' || x.rarity === this.rarity));
    const order = { opened: 0, unopened: 1, completed: 2 };
    list.sort((a, b) => order[s[a.id].state] - order[s[b.id].state] || s[b.id].boughtAt - s[a.id].boughtAt);
    const grid = clear(this.grid);
    if (!owned.length) {
      grid.appendChild(el('div', { class: 'empty big' }, el('p', { text: "You don't own any sets yet." }), el('p', { class: 'muted', text: 'Visit the Brick Store — Beginner Sets are a great place to start!' }), el('button', { class: 'btn primary', text: 'Go to the Brick Store', onclick: () => this.g.show('store', { category: 'beginner' }) })));
      return;
    }
    if (!list.length) grid.appendChild(el('div', { class: 'empty', text: 'Nothing matches these filters.' }));
    for (const set of list) grid.appendChild(this.card(set));
  }

  /** Read a booklet from the shelf; "Build this step" jumps into the studio. */
  readBooklet(set) {
    const o = this.g.save.owned[set.id];
    const placed = new Set(o.placed);
    const built = st => o.state === 'completed' || set.steps[st].every(i => placed.has(i));
    let cur = set.steps.findIndex((st, i) => !built(i));
    if (cur < 0) cur = null;
    openBooklet(this.g, set, {
      page: cur != null ? cur + 1 : 0, current: cur, built, maxStep: o.state === 'completed' ? -1 : cur,
      onGoToStep: o.state === 'completed' ? null : () => this.g.show('studio', { setId: set.id }),
    });
  }

  card(set) {
    const o = this.g.save.owned[set.id];
    const pct = Math.round(this.g.completion(set.id) * 100);
    const img = el('img', { class: 'thumb', alt: set.name, dataset: { set: set.id, kind: o.state === 'unopened' ? 'box' : 'model' }, src: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==' });
    this.observer.observe(img);
    const actions = el('div', { class: 'card-actions' });
    const go = (label, kind, fn) => actions.appendChild(el('button', { class: 'btn small ' + kind, text: label, onclick: e => { e.stopPropagation(); fn(); } }));
    if (o.state === 'unopened') go('📦 Open box', 'primary', () => this.g.show('opening', { setId: set.id }));
    else if (o.state === 'opened') go(pct ? '🔨 Continue building' : '🔨 Start building', 'primary', () => this.g.show('studio', { setId: set.id }));
    else { go('🔍 Inspect', 'primary', () => this.g.show('studio', { setId: set.id })); go('🏛️ Display', '', () => this.g.show('room', { focus: set.id })); }
    if (o.state !== 'unopened') go('📖 Booklet', '', () => this.readBooklet(set));
    const nb = bagsOf(set).length;
    const status = { unopened: `Unopened box • ${nb} bag${nb > 1 ? 's' : ''}`, opened: `In progress — ${pct}% • bag ${Math.max(1, bagsOpened(set, o))}/${nb}`, completed: 'Completed' }[o.state];
    return el('article', { class: `set-card coll-card state-${o.state} rarity-${set.rarity}` },
      el('div', { class: 'thumb-wrap' + (o.state === 'unopened' ? ' box-wrap sealed' : '') }, img, rarityBadge(RARITY_BY_ID[set.rarity])),
      el('div', { class: 'card-body' },
        el('div', { class: 'card-cat', text: CATEGORY_BY_ID[set.category].icon + ' ' + CATEGORY_BY_ID[set.category].name }),
        el('h3', { class: 'card-title', text: set.name }),
        el('div', { class: 'card-meta' }, el('span', { text: `${set.brickCount.toLocaleString()} pcs` }), difficultyStars(set.difficulty)),
        el('div', { class: 'status-line' }, el('span', { text: status }), el('span', { class: 'muted', text: money(set.price) })),
        el('div', { class: 'progress small' }, el('div', { class: 'progress-fill', style: { width: pct + '%' } })),
        actions));
  }
}
