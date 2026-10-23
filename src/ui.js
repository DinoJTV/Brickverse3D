// ui.js — small DOM helpers: element builder, toasts, modals, confirms, number formatting.
// All text is inserted with textContent (never innerHTML from data), which keeps the
// game safe from injected HTML in imported files.

export function el(tag, props = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k in e && typeof v !== 'string') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return e;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

export const money = n => '$' + Math.round(n).toLocaleString('en-US');
export const num = n => Math.round(n).toLocaleString('en-US');

// ------------------------------------------------------------------ toasts
let toastHost;
export function toast(message, kind = 'info', ms = 2600) {
  if (!toastHost) { toastHost = el('div', { class: 'toasts', 'aria-live': 'polite' }); document.body.appendChild(toastHost); }
  const icon = { info: 'ℹ️', success: '✅', error: '⚠️', money: '💰', xp: '⭐', achievement: '🏆', save: '💾' }[kind] || '';
  const t = el('div', { class: 'toast toast-' + kind }, el('span', { class: 'toast-icon', text: icon }), el('span', { text: message }));
  toastHost.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
  while (toastHost.children.length > 5) toastHost.firstChild.remove();
}

// ------------------------------------------------------------------ modals
const modalStack = [];
export function modal({ title, body, actions = [], wide = false, onClose, closable = true, className = '' }) {
  const back = el('div', { class: 'modal-back' });
  const box = el('div', { class: `modal ${wide ? 'modal-wide' : ''} ${className}`, role: 'dialog', 'aria-modal': 'true' });
  const close = () => {
    if (!back.isConnected) return;
    back.classList.remove('show');
    setTimeout(() => back.remove(), 200);
    const i = modalStack.indexOf(api); if (i >= 0) modalStack.splice(i, 1);
    onClose && onClose();
  };
  const head = el('div', { class: 'modal-head' }, el('h2', { text: title || '' }),
    closable ? el('button', { class: 'icon-btn modal-x', 'aria-label': 'Close', text: '✕', onclick: close }) : null);
  const content = el('div', { class: 'modal-body' });
  if (typeof body === 'string') content.textContent = body; else if (body) content.appendChild(body);
  const foot = el('div', { class: 'modal-foot' });
  for (const a of actions) {
    foot.appendChild(el('button', {
      class: 'btn ' + (a.kind || ''), text: a.label, disabled: a.disabled,
      onclick: async () => { const r = a.onClick ? await a.onClick(api) : undefined; if (r !== false && a.close !== false) close(); },
    }));
  }
  box.append(head, content);
  if (actions.length) box.append(foot);
  back.appendChild(box);
  if (closable) back.addEventListener('pointerdown', e => { if (e.target === back) close(); });
  document.body.appendChild(back);
  requestAnimationFrame(() => back.classList.add('show'));
  const api = { close, el: box, body: content };
  modalStack.push(api);
  return api;
}
export function closeTopModal() { const m = modalStack[modalStack.length - 1]; if (m) { m.close(); return true; } return false; }
export function anyModalOpen() { return modalStack.length > 0; }

export function confirmBox(title, message, okLabel = 'OK', kind = 'primary') {
  return new Promise(res => {
    let done = false;
    modal({
      title, body: message,
      actions: [{ label: 'Cancel', onClick: () => { done = true; res(false); } }, { label: okLabel, kind, onClick: () => { done = true; res(true); } }],
      onClose: () => { if (!done) res(false); },
    });
  });
}

export function promptBox(title, label, value = '', okLabel = 'Save') {
  return new Promise(res => {
    let done = false;
    const input = el('input', { class: 'input', type: 'text', value, maxLength: 40, 'aria-label': label });
    const body = el('div', {}, el('label', { class: 'label', text: label }), input);
    const m = modal({
      title, body,
      actions: [{ label: 'Cancel', onClick: () => { done = true; res(null); } }, { label: okLabel, kind: 'primary', onClick: () => { done = true; res(input.value.trim() || value || 'Untitled'); } }],
      onClose: () => { if (!done) res(null); },
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { done = true; res(input.value.trim() || value || 'Untitled'); m.close(); } });
    setTimeout(() => { input.focus(); input.select(); }, 50);
  });
}

/** Animate a number in an element from its current value to `to`. */
export function tweenNumber(node, to, format = num, ms = 600) {
  const from = Number(node.dataset.value || 0);
  node.dataset.value = to;
  const t0 = performance.now();
  const step = t => {
    const k = Math.min(1, (t - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    node.textContent = format(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Ask the browser to download a text or blob as a file. */
export function download(filename, data, type = 'application/json') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Let the user pick a local file; resolves with its text (or null). Size-limited for safety. */
export function pickTextFile(accept = '.json,application/json', maxBytes = 5 * 1024 * 1024) {
  return new Promise(res => {
    const input = el('input', { type: 'file', accept, style: { display: 'none' } });
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      input.remove();
      if (!f) return res(null);
      if (f.size > maxBytes) { toast(`That file is too big (${Math.round(f.size / 1024)} KB). The limit is ${Math.round(maxBytes / 1024)} KB.`, 'error', 4000); return res(null); }
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => { toast('Could not read that file.', 'error'); res(null); };
      r.readAsText(f);
    });
    document.body.appendChild(input);
    input.click();
  });
}

export function rarityBadge(r) { return el('span', { class: 'badge rarity-' + r.id, text: r.name }); }
export function difficultyStars(n) { return el('span', { class: 'stars', title: `Difficulty ${n} of 5`, text: '★'.repeat(n) + '☆'.repeat(5 - n) }); }
