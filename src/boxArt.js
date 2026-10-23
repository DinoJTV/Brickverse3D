// boxArt.js — box artwork for every set, painted with the 2D canvas from the set's own
// render: a front panel (logo, name, rarity, piece count, model picture), a side panel
// and a lid. boxShot() turns the panels into a 3D-looking box picture for the store,
// your collection and the shelves.
import * as THREE from 'three';
import { CATEGORY_BY_ID, RARITY_BY_ID } from './catalog.js';
import { bagsOf } from './bags.js';
import { cacheGet, cacheSet } from './saveSystem.js';

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

/** Paint box artwork onto canvases (front, sides, lid). */
export function boxArt(set, thumbImg, asCanvas = false) {
  const rar = RARITY_BY_ID[set.rarity];
  const cat = CATEGORY_BY_ID[set.category];
  const front = document.createElement('canvas'); front.width = 1024; front.height = 768;
  const c = front.getContext('2d');
  const g = c.createLinearGradient(0, 0, 1024, 768);
  g.addColorStop(0, '#1b2a5c'); g.addColorStop(1, '#0d1430');
  c.fillStyle = g; c.fillRect(0, 0, 1024, 768);
  c.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 12; i++) { c.beginPath(); c.arc(820 + Math.sin(i) * 160, 120 + i * 50, 30 + (i % 3) * 18, 0, Math.PI * 2); c.fill(); }
  // the model picture sits in its own framed window on the right, so it never covers the words
  const px = 404, py = 168, pw = 592, ph = 444;
  c.save(); c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 40; c.fillStyle = '#fff'; roundRect(c, px - 8, py - 8, pw + 16, ph + 16, 26); c.fill(); c.restore();
  if (thumbImg) { c.save(); roundRect(c, px, py, pw, ph, 20); c.clip(); c.drawImage(thumbImg, px, py, pw, ph); c.restore(); }
  c.fillStyle = rar.color; c.fillRect(0, 0, 1024, 18); c.fillRect(0, 750, 1024, 18);
  // logo
  c.fillStyle = '#e3342f'; roundRect(c, 40, 46, 300, 92, 18); c.fill();
  c.fillStyle = '#ffd43b'; c.font = '900 54px Fredoka, system-ui, Segoe UI, sans-serif'; c.fillText('BrickVerse', 62, 110);
  c.fillStyle = '#fff'; c.font = '700 26px Fredoka, system-ui, Segoe UI, sans-serif'; c.fillText(cat.name.toUpperCase(), 40, 196, 340);
  // the set name: biggest size that fits the left column in at most 4 lines
  const maxW = 340, words = set.name.split(' ');
  let size = 62, lines = [];
  for (; size >= 30; size -= 2) {
    c.font = `900 ${size}px Fredoka, system-ui, Segoe UI, sans-serif`;
    lines = []; let line = '';
    for (const w of words) { const test = line ? line + ' ' + w : w; if (c.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; }
    lines.push(line);
    if (lines.length <= 4 && lines.every(l => c.measureText(l).width <= maxW)) break;
  }
  lines.forEach((l, i) => c.fillText(l, 40, 262 + i * size * 1.12));
  c.font = '800 40px Fredoka, system-ui, Segoe UI, sans-serif';
  const bw = c.measureText(rar.name.toUpperCase()).width + 36;
  c.fillStyle = rar.color; roundRect(c, 40, 640, bw, 70, 14); c.fill();
  c.fillStyle = '#fff'; c.fillText(rar.name.toUpperCase(), 58, 690);
  c.fillStyle = 'rgba(255,255,255,0.9)'; c.font = '800 46px Fredoka, system-ui, Segoe UI, sans-serif'; c.fillText(`${set.brickCount.toLocaleString()} pcs`, 40 + bw + 26, 692);

  const side = document.createElement('canvas'); side.width = 512; side.height = 768;
  const s = side.getContext('2d');
  s.fillStyle = '#16224d'; s.fillRect(0, 0, 512, 768);
  s.fillStyle = rar.color; s.fillRect(0, 0, 512, 18); s.fillRect(0, 750, 512, 18);
  s.save(); s.translate(256, 384); s.rotate(-Math.PI / 2);
  s.fillStyle = '#ffd43b'; s.font = '900 64px Fredoka, system-ui, Segoe UI, sans-serif'; s.textAlign = 'center'; s.fillText('BrickVerse', 0, -30);
  s.fillStyle = '#fff'; s.font = '700 36px Fredoka, system-ui, Segoe UI, sans-serif'; s.fillText(set.name, 0, 40);
  s.restore();

  const top = document.createElement('canvas'); top.width = 1024; top.height = 512;
  const t = top.getContext('2d');
  t.fillStyle = '#e3342f'; t.fillRect(0, 0, 1024, 512);
  t.fillStyle = 'rgba(0,0,0,0.12)';
  for (let x = 64; x < 1024; x += 128) for (let yy = 64; yy < 512; yy += 128) { t.beginPath(); t.arc(x, yy, 38, 0, Math.PI * 2); t.fill(); }
  t.fillStyle = '#ffd43b'; t.font = '900 110px Fredoka, system-ui, Segoe UI, sans-serif'; t.textAlign = 'center'; t.fillText('BrickVerse', 512, 290);
  if (asCanvas) return { front, side, top };
  const tex = cv => { const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return tx; };
  return { front: tex(front), side: tex(side), top: tex(top) };
}


/** A 3D-looking picture of the closed box (front + side + top), as a canvas. */
export function boxShot(set, thumbImg) {
  const { front, side, top } = boxArt(set, thumbImg, true);
  const c = document.createElement('canvas'); c.width = 640; c.height = 480;
  const x = c.getContext('2d');
  const fx = 70, fy = 120, fw = 430, fh = 322, depth = 92, rise = 62;
  // soft shadow on the "table"
  const g = x.createRadialGradient(330, 452, 10, 330, 452, 300);
  g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 380, 640, 100);
  // side panel (skewed back to the right)
  x.save();
  x.setTransform(depth / side.width, -rise / side.width, 0, fh / side.height, fx + fw, fy);
  x.drawImage(side, 0, 0);
  x.restore();
  x.fillStyle = 'rgba(0,0,0,0.28)';
  x.beginPath(); x.moveTo(fx + fw, fy); x.lineTo(fx + fw + depth, fy - rise); x.lineTo(fx + fw + depth, fy - rise + fh); x.lineTo(fx + fw, fy + fh); x.closePath(); x.fill();
  // lid
  x.save();
  x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx + depth, fy - rise); x.lineTo(fx + fw + depth, fy - rise); x.lineTo(fx + fw, fy); x.closePath(); x.clip();
  x.setTransform(fw / top.width, 0, -depth / top.height, rise / top.height, fx + depth, fy - rise);
  x.drawImage(top, 0, 0);
  x.restore();
  x.fillStyle = 'rgba(255,255,255,0.12)';
  x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx + depth, fy - rise); x.lineTo(fx + fw + depth, fy - rise); x.lineTo(fx + fw, fy); x.closePath(); x.fill();
  // front panel
  x.drawImage(front, fx, fy, fw, fh);
  // edges & a little gloss
  x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 2; x.strokeRect(fx, fy, fw, fh);
  const gl = x.createLinearGradient(fx, fy, fx + fw, fy + fh);
  gl.addColorStop(0, 'rgba(255,255,255,0.16)'); gl.addColorStop(0.4, 'rgba(255,255,255,0)');
  x.fillStyle = gl; x.fillRect(fx, fy, fw, fh);
  return c;
}

const mem = new Map();
/** Cached box picture as a data URL; cb(url). */
export function boxArtUrl(game, set, cb) {
  const key = 'boxart:v4:' + set.id;
  if (mem.has(key)) { cb(mem.get(key)); return; }
  cacheGet(key).then(cached => {
    if (cached && typeof cached === 'string' && cached.startsWith('data:image/')) { mem.set(key, cached); cb(cached); return; }
    game.thumb(set, url => {
      const done = img => {
        try {
          const u = boxShot(set, img).toDataURL('image/webp', 0.86);
          mem.set(key, u); cacheSet(key, u); cb(u);
        } catch (e) { console.warn('Box art failed', e); cb(null); }
      };
      if (!url) return done(null);
      const img = new Image(); img.onload = () => done(img); img.onerror = () => done(null); img.src = url;
    });
  });
}
