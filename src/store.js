// store.js — the Brick Store: browse, search, filter and buy sets; plus a Parts Shop
// for unlocking advanced pieces for the Build Studio.
import { CATEGORIES, CATEGORY_BY_ID, RARITIES, RARITY_BY_ID } from './catalog.js';
import { PARTS, PART_BY_ID, COLOR_BY_ID } from './parts.js';
import { el, clear, toast, modal, money, rarityBadge, difficultyStars } from './ui.js';
import { boxArtUrl } from './boxArt.js';

const RARITY_ORDER = Object.fromEntries(RARITIES.map((r, i) => [r.id, i]));

export class Store {
  constructor(game) {
    this.g = game;
    this.el = document.getElementById('screen-store');
    this.cat = 'all';
    this.query = '';
    this.sort = 'featured';
    this.filter = 'all';
    this.rarity = 'any';
    this.build();
    this.observer = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) {
        const img = e.target;
        this.observer.unobserve(img);
        const set = this.g.setById(img.dataset.set);
        if (!set) continue;
        if (img.dataset.kind === 'box') boxArtUrl(this.g, set, url => { if (url) { img.src = url; img.classList.add('loaded'); } });
        else this.g.thumb(set, url => { if (url) { img.src = url; img.classList.add('loaded'); } });
      }
    }, { rootMargin: '300px' });
    game.on('owned', () => { if (game.currentId === 'store') this.renderGrid(); });
    game.on('money', () => { if (game.currentId === 'store') this.refreshButtons(); });
  }

  build() {
    this.cats = el('nav', { class: 'cat-list' });
    this.search = el('input', { class: 'input', type: 'search', placeholder: 'Search sets…', 'aria-label': 'Search sets', oninput: () => { this.query = this.search.value.trim().toLowerCase(); this.renderGrid(); } });
    const sel = (opts, val, fn, label) => { const s = el('select', { class: 'input select', 'aria-label': label, onchange: () => fn(s.value) }, ...opts.map(([v, t]) => el('option', { value: v, text: t, selected: v === val }))); return s; };
    this.grid = el('div', { class: 'card-grid' });
    this.count = el('span', { class: 'muted' });
    this.title = el('h2', { text: 'All sets' });
    this.el.append(
      el('div', { class: 'page store-page' },
        el('aside', { class: 'page-side' }, el('h3', { class: 'side-title', text: 'Categories' }), this.cats),
        el('div', { class: 'page-main' },
          el('div', { class: 'page-head' }, el('div', {}, this.title, this.count),
            el('div', { class: 'filters' }, this.search,
              sel([['featured', 'Featured'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['pieces', 'Most pieces'], ['rarity', 'Rarest first'], ['name', 'Name A–Z']], this.sort, v => { this.sort = v; this.renderGrid(); }, 'Sort'),
              sel([['all', 'All sets'], ['afford', 'I can afford'], ['notowned', 'Not owned'], ['owned', 'Owned'], ['unlocked', 'Unlocked']], this.filter, v => { this.filter = v; this.renderGrid(); }, 'Filter'),
              sel([['any', 'Any rarity'], ...RARITIES.map(r => [r.id, r.name])], this.rarity, v => { this.rarity = v; this.renderGrid(); }, 'Rarity'))),
          this.grid)));
  }

  async enter(params = {}) {
    this.g.engine.setStage(null);
    if (params.category) this.cat = params.category;
    this.renderCats();
    this.renderGrid();
  }
  leave() { return true; }

  renderCats() {
    const c = clear(this.cats);
    const item = (id, icon, name, n) => el('button', { class: 'cat-btn' + (this.cat === id ? ' on' : ''), onclick: () => { this.cat = id; this.renderCats(); this.renderGrid(); } }, el('span', { class: 'cat-ico', text: icon }), el('span', { class: 'cat-name', text: name }), n != null ? el('span', { class: 'cat-n', text: n }) : null);
    c.appendChild(item('all', '🧱', 'All sets', this.g.catalog.length));
    for (const cat of CATEGORIES) c.appendChild(item(cat.id, cat.icon, cat.name, this.g.catalog.filter(s => s.category === cat.id).length));
    c.appendChild(el('div', { class: 'cat-sep' }));
    c.appendChild(item('parts', '🔧', 'Parts Shop', PARTS.filter(p => p.unlock && !this.g.save.unlockedParts.includes(p.id)).length));
  }

  visibleSets() {
    const s = this.g.save;
    let list = this.g.catalog.filter(x => this.cat === 'all' || x.category === this.cat);
    if (this.query) list = list.filter(x => (x.name + ' ' + CATEGORY_BY_ID[x.category].name + ' ' + x.style + ' ' + x.rarity).toLowerCase().includes(this.query));
    if (this.rarity !== 'any') list = list.filter(x => x.rarity === this.rarity);
    if (this.filter === 'afford') list = list.filter(x => !s.owned[x.id] && x.price <= s.money && this.g.prog.canUnlockSet(x).ok);
    if (this.filter === 'notowned') list = list.filter(x => !s.owned[x.id]);
    if (this.filter === 'owned') list = list.filter(x => s.owned[x.id]);
    if (this.filter === 'unlocked') list = list.filter(x => this.g.prog.canUnlockSet(x).ok);
    const by = {
      featured: (a, b) => (a.unlock.level - b.unlock.level) || (a.price - b.price),
      'price-asc': (a, b) => a.price - b.price, 'price-desc': (a, b) => b.price - a.price,
      pieces: (a, b) => b.brickCount - a.brickCount, rarity: (a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity] || b.price - a.price,
      name: (a, b) => a.name.localeCompare(b.name),
    }[this.sort];
    return list.slice().sort(by);
  }

  renderGrid() {
    const grid = clear(this.grid);
    if (this.cat === 'parts') return this.renderParts();
    this.title.textContent = this.cat === 'all' ? 'All sets' : CATEGORY_BY_ID[this.cat].icon + ' ' + CATEGORY_BY_ID[this.cat].name;
    const list = this.visibleSets();
    this.count.textContent = `${list.length} set${list.length === 1 ? '' : 's'}`;
    if (!list.length) grid.appendChild(el('div', { class: 'empty', text: 'No sets match your filters.' }));
    // add cards in pages as you scroll, so huge lists stay smooth
    this.pending = list;
    this.shown = 0;
    this.morePage();
  }

  morePage() {
    if (this.sentinel) { this.moreObs.disconnect(); this.sentinel.remove(); this.sentinel = null; }
    const frag = document.createDocumentFragment();
    const next = this.pending.slice(this.shown, this.shown + 40);
    for (const set of next) frag.appendChild(this.card(set));
    this.shown += next.length;
    this.grid.appendChild(frag);
    if (this.shown < this.pending.length) {
      this.sentinel = el('div', { class: 'sentinel' });
      this.grid.appendChild(this.sentinel);
      this.moreObs = this.moreObs || new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) this.morePage(); }, { rootMargin: '600px' });
      this.moreObs.observe(this.sentinel);
    }
  }

  card(set) {
    const rar = RARITY_BY_ID[set.rarity];
    // the box is on the shelf; hover to see the model inside
    const blank = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
    const img = el('img', { class: 'thumb model', alt: set.name, dataset: { set: set.id, kind: 'model' }, src: blank });
    const box = el('img', { class: 'thumb box', alt: set.name + ' box', dataset: { set: set.id, kind: 'box' }, src: blank });
    this.observer.observe(box);
    this.observer.observe(img);
    const btn = el('button', { class: 'btn buy-btn', dataset: { set: set.id }, onclick: e => { e.stopPropagation(); this.buyOrOpen(set); } });
    this.setButton(btn, set);
    return el('article', { class: `set-card rarity-${set.rarity}`, tabIndex: 0, onclick: () => this.details(set), onkeydown: e => { if (e.key === 'Enter') this.details(set); } },
      el('div', { class: 'thumb-wrap box-wrap' }, img, box, rarityBadge(rar), this.ownBadge(set)),
      el('div', { class: 'card-body' },
        el('div', { class: 'card-cat', text: CATEGORY_BY_ID[set.category].icon + ' ' + CATEGORY_BY_ID[set.category].name }),
        el('h3', { class: 'card-title', text: set.name }),
        el('div', { class: 'card-meta' }, el('span', { text: `${set.brickCount.toLocaleString()} pcs` }), difficultyStars(set.difficulty)),
        el('div', { class: 'card-foot' }, el('span', { class: 'price', text: money(set.price) }), btn)));
  }

  ownBadge(set) {
    const o = this.g.ownership(set.id);
    if (!o) return null;
    const label = { unopened: '📦 Unopened', opened: `🔨 ${Math.round(this.g.completion(set.id) * 100)}%`, completed: '✅ Built' }[o.state];
    return el('span', { class: 'own-badge', text: label });
  }

  setButton(btn, set) {
    const o = this.g.ownership(set.id);
    const lock = this.g.prog.canUnlockSet(set);
    btn.className = 'btn buy-btn';
    btn.disabled = false;
    if (o) { btn.textContent = o.state === 'unopened' ? 'Open box' : o.state === 'completed' ? 'View' : 'Continue'; btn.classList.add('owned'); }
    else if (!lock.ok) { btn.textContent = '🔒 ' + lock.why; btn.classList.add('locked'); btn.disabled = true; }
    else if (this.g.save.money < set.price) { btn.textContent = 'Need ' + money(set.price - this.g.save.money); btn.classList.add('poor'); btn.disabled = true; }
    else { btn.textContent = 'Buy'; btn.classList.add('primary'); }
  }
  refreshButtons() { for (const b of this.grid.querySelectorAll('.buy-btn')) { const s = this.g.setById(b.dataset.set); if (s) this.setButton(b, s); } }

  buyOrOpen(set) {
    const o = this.g.ownership(set.id);
    if (o) { this.g.show(o.state === 'unopened' ? 'opening' : 'studio', { setId: set.id }); return; }
    this.confirmBuy(set);
  }

  confirmBuy(set) {
    const after = this.g.save.money - set.price;
    modal({
      title: 'Buy this set?',
      body: el('div', { class: 'buy-confirm' }, el('p', {}, el('b', { text: set.name }), ` — ${set.brickCount.toLocaleString()} pieces`), el('p', { class: 'muted', text: `Price ${money(set.price)}. You'll have ${money(after)} left. The box will wait in My Collection until you open it.` })),
      actions: [{ label: 'Cancel' }, { label: `Buy for ${money(set.price)}`, kind: 'primary', onClick: () => { if (this.g.buySet(set)) this.afterBuy(set); } }],
    });
  }

  afterBuy(set) {
    this.renderGrid();
    modal({
      title: '🛍️ Purchased!', body: `${set.name} is in your collection. Open the box now?`,
      actions: [{ label: 'Keep shopping' }, { label: 'Open the box', kind: 'primary', onClick: () => this.g.show('opening', { setId: set.id }) }],
    });
  }

  details(set) {
    const rar = RARITY_BY_ID[set.rarity];
    const img = el('img', { class: 'detail-thumb', alt: set.name });
    const showBox = () => { boxArtUrl(this.g, set, u => { if (u) img.src = u; }); bBox.classList.add('on'); bModel.classList.remove('on'); };
    const showModel = () => { this.g.thumb(set, u => { if (u) img.src = u; }); bModel.classList.add('on'); bBox.classList.remove('on'); };
    const bBox = el('button', { class: 'seg-btn', text: '📦 Box', onclick: showBox });
    const bModel = el('button', { class: 'seg-btn', text: '🧱 Model', onclick: showModel });
    showBox();
    const parts = el('div', { class: 'parts-mini' });
    for (const p of set.parts.slice(0, 18)) {
      const pi = el('img', { alt: '' });
      this.g.thumbFor(`part:${p.t}:${p.c}`, () => [{ t: p.t, x: 0, y: 0, z: 0, r: p.t.startsWith('wheel') || p.t.startsWith('slope') ? 1 : 0, c: p.c }], u => { if (u) pi.src = u; });
      parts.appendChild(el('div', { class: 'pm', title: `${PART_BY_ID[p.t].name} (${COLOR_BY_ID[p.c].name})` }, pi, el('span', { text: '×' + p.n })));
    }
    if (set.parts.length > 18) parts.appendChild(el('div', { class: 'pm more', text: `+${set.parts.length - 18} more` }));
    const o = this.g.ownership(set.id);
    const lock = this.g.prog.canUnlockSet(set);
    const body = el('div', { class: 'detail' },
      el('div', { class: 'detail-left' }, img, el('div', { class: 'seg detail-seg' }, bBox, bModel)),
      el('div', { class: 'detail-right' },
        el('div', { class: 'detail-tags' }, rarityBadge(rar), el('span', { class: 'badge', text: CATEGORY_BY_ID[set.category].icon + ' ' + CATEGORY_BY_ID[set.category].name })),
        el('p', { text: set.desc }),
        el('div', { class: 'stat-grid' },
          stat('Pieces', set.brickCount.toLocaleString()), stat('Steps', set.steps.length), stat('Difficulty', difficultyStars(set.difficulty)),
          stat('Size', `${set.dims.w} × ${set.dims.d} studs`), stat('Price', money(set.price)), stat('Unlocks at', `Level ${set.unlock.level}${set.unlock.completedSets ? ` + ${set.unlock.completedSets} builds` : ''}`)),
        el('div', { class: 'palette-row' }, el('span', { class: 'muted', text: 'Colours: ' }), ...set.palette.map(c => el('span', { class: 'swatch', title: COLOR_BY_ID[c].name, style: { background: COLOR_BY_ID[c].hex } }))),
        el('h4', { text: 'Included pieces' }), parts));
    const actions = [{ label: 'Close' }];
    if (o) actions.push({ label: o.state === 'unopened' ? 'Open the box' : o.state === 'completed' ? 'View model' : 'Continue building', kind: 'primary', onClick: () => this.g.show(o.state === 'unopened' ? 'opening' : 'studio', { setId: set.id }) });
    else if (!lock.ok) actions.push({ label: `🔒 ${lock.why}`, disabled: true });
    else actions.push({ label: this.g.save.money >= set.price ? `Buy for ${money(set.price)}` : `Need ${money(set.price - this.g.save.money)} more`, kind: 'primary', disabled: this.g.save.money < set.price, onClick: () => { if (this.g.buySet(set)) this.afterBuy(set); } });
    modal({ title: set.name, body, wide: true, actions });
  }

  renderParts() {
    const grid = clear(this.grid);
    this.title.textContent = '🔧 Parts Shop';
    const locked = PARTS.filter(p => p.unlock);
    this.count.textContent = 'Unlock special pieces for the Build Studio. Completing a set that uses a piece also unlocks it for free.';
    for (const p of locked) {
      const owned = this.g.save.unlockedParts.includes(p.id);
      const img = el('img', { class: 'thumb loaded', alt: p.name });
      this.g.thumbFor(`part:${p.id}:azure`, () => [{ t: p.id, x: 0, y: 0, z: 0, r: 0, c: 'azure' }], u => { if (u) img.src = u; });
      const btn = el('button', { class: 'btn ' + (owned ? 'owned' : 'primary'), text: owned ? 'Unlocked ✓' : `Unlock ${money(p.unlock.cost)}`, disabled: owned || this.g.save.money < p.unlock.cost,
        onclick: () => {
          if (!this.g.prog.spend(p.unlock.cost)) { toast('Not enough money.', 'error'); return; }
          this.g.save.unlockedParts.push(p.id);
          this.g.audio.play('buy');
          toast(`${p.name} unlocked in the Build Studio!`, 'success');
          this.g.requestSave(true);
          this.renderParts(); this.renderCats();
        } });
      grid.appendChild(el('article', { class: 'set-card part-card' }, el('div', { class: 'thumb-wrap' }, img), el('div', { class: 'card-body' }, el('div', { class: 'card-cat', text: p.group }), el('h3', { class: 'card-title', text: p.name }), el('div', { class: 'card-foot' }, el('span', { class: 'price', text: owned ? '' : money(p.unlock.cost) }), btn))));
    }
  }
}

function stat(label, value) { return el('div', { class: 'stat' }, el('span', { class: 'stat-label', text: label }), typeof value === 'string' || typeof value === 'number' ? el('b', { text: String(value) }) : value); }
