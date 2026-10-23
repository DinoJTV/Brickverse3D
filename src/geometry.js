// geometry.js — builds the 3D shape of every part type, procedurally.
// Each part becomes one or more "sub-meshes". A sub-mesh is coloured either by the
// piece's own colour ('own') or by a fixed colour (e.g. black tyres on a wheel).
// Geometry is built centred on the footprint in X/Z with y=0 at the bottom, in
// UN-rotated part space; the renderer rotates it by r × 90° around Y.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PART_BY_ID, PLATE_H, studCells } from './parts.js';

const GAP = 0.02;         // tiny gap between pieces so edges read clearly
const STUD_R = 0.3, STUD_H = 0.17;

// --------------------------------------------------------------- primitives
function box(w, h, d, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y + h / 2, z);
  return g;
}
function cyl(rTop, rBot, h, seg, x = 0, y = 0, z = 0, axis = 'y') {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, false);
  if (axis === 'x') { g.rotateZ(Math.PI / 2); g.translate(x, y, z); }
  else if (axis === 'z') { g.rotateX(Math.PI / 2); g.translate(x, y, z); }
  else g.translate(x, y + h / 2, z);
  return g;
}

/**
 * Prism along X: `poly` is a convex polygon of [z, y] points (counter-clockwise when
 * viewed from +X), extruded from x=-w/2 to x=+w/2. Flat-shaded.
 */
function prismX(poly, w) {
  const pos = [];
  const x0 = -w / 2, x1 = w / 2;
  const P = (x, p) => [x, p[1], p[0]];
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);
  for (let i = 1; i < poly.length - 1; i++) {
    tri(P(x1, poly[0]), P(x1, poly[i]), P(x1, poly[i + 1]));
    tri(P(x0, poly[0]), P(x0, poly[i + 1]), P(x0, poly[i]));
  }
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    tri(P(x0, a), P(x1, a), P(x1, b));
    tri(P(x0, a), P(x1, b), P(x0, b));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  fixWinding(g);
  g.computeVertexNormals();
  return g;
}

/** Prism along Y of a convex polygon of [x, z] points, from y0 to y1. */
function prismY(poly, y0, y1) {
  const pos = [];
  const P = (y, p) => [p[0], y, p[1]];
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);
  for (let i = 1; i < poly.length - 1; i++) {
    tri(P(y1, poly[0]), P(y1, poly[i]), P(y1, poly[i + 1]));
    tri(P(y0, poly[0]), P(y0, poly[i + 1]), P(y0, poly[i]));
  }
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    tri(P(y0, a), P(y1, a), P(y1, b));
    tri(P(y0, a), P(y1, b), P(y0, b));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  fixWinding(g);
  g.computeVertexNormals();
  return g;
}

/** Make every triangle face away from the shape's centre (works for convex prisms). */
function fixWinding(g) {
  const p = g.attributes.position.array;
  let cx = 0, cy = 0, cz = 0; const n = p.length / 3;
  for (let i = 0; i < p.length; i += 3) { cx += p[i]; cy += p[i + 1]; cz += p[i + 2]; }
  cx /= n; cy /= n; cz /= n;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nn = new THREE.Vector3(), m = new THREE.Vector3();
  for (let i = 0; i < p.length; i += 9) {
    a.set(p[i], p[i + 1], p[i + 2]); b.set(p[i + 3], p[i + 4], p[i + 5]); c.set(p[i + 6], p[i + 7], p[i + 8]);
    nn.subVectors(b, a).cross(m.subVectors(c, a));
    m.set((a.x + b.x + c.x) / 3 - cx, (a.y + b.y + c.y) / 3 - cy, (a.z + b.z + c.z) / 3 - cz);
    if (nn.dot(m) < 0) {
      for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
    }
  }
}

function rbox(w, h, d, x, y, z, detail) {
  // Moulded-plastic box: every edge softly rounded, like a real brick.
  if (detail >= 1) {
    const r = Math.min(detail >= 2 ? 0.055 : 0.04, h / 3, w / 4, d / 4);
    const g = new RoundedBoxGeometry(w, h, d, detail >= 2 ? 3 : 1, r);
    g.translate(x, y + h / 2, z);
    return g;
  }
  if (detail < 2) return box(w, h, d, x, y, z);
  const b = 0.035;
  const top = prismY([[-w / 2 + b, -d / 2], [w / 2 - b, -d / 2], [w / 2, -d / 2 + b], [w / 2, d / 2 - b], [w / 2 - b, d / 2], [-w / 2 + b, d / 2], [-w / 2, d / 2 - b], [-w / 2, -d / 2 + b]], 0, h);
  top.translate(x, y, z);
  return top;
}

const studCache = new Map();
/** One stud: a cylinder with a softly bevelled top edge. */
function studGeo(detail) {
  let g = studCache.get(detail);
  if (!g) {
    const b = detail >= 2 ? 0.035 : 0.02;
    const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(STUD_R, 0), new THREE.Vector2(STUD_R, STUD_H - b), new THREE.Vector2(STUD_R - b * 0.3, STUD_H - b * 0.3), new THREE.Vector2(STUD_R - b, STUD_H), new THREE.Vector2(0, STUD_H)];
    g = new THREE.LatheGeometry(pts, detail >= 2 ? 18 : 8);
    studCache.set(detail, g);
  }
  return g;
}
function studs(part, y, detail, cells = studCells(part)) {
  if (detail === 0 || !cells.length) return [];
  const out = [];
  for (const [cx, cz] of cells) { const g = studGeo(detail).clone(); g.translate(cx - part.w / 2 + 0.5, y - 0.005, cz - part.d / 2 + 0.5); out.push(g); }
  return out;
}

function merged(list) {
  const ok = list.filter(Boolean).map(g => (g.index ? g.toNonIndexed() : g));
  for (const g of ok) { if (g.attributes.uv) g.deleteAttribute('uv'); if (!g.attributes.normal) g.computeVertexNormals(); }
  const m = mergeGeometries(ok, false);
  ok.forEach(g => g.dispose());
  return m;
}

// --------------------------------------------------------------- recipes
// Each returns an array of {geo, color} where color is 'own' or a fixed colour id.
function recipe(part, detail) {
  const W = part.w, D = part.d, H = part.h * PLATE_H;
  const w = W - GAP * 2, d = D - GAP * 2, h = H - GAP;
  const own = (...g) => ({ geo: merged(g.flat()), color: 'own' });
  const fixed = (c, ...g) => ({ geo: merged(g.flat()), color: c });
  switch (part.kind) {
    case 'box':
      return [own(rbox(w, h, d, 0, 0, 0, detail), studs(part, h, detail))];
    case 'tile':
      return [own(rbox(w, h * 0.92, d, 0, 0, 0, detail))];
    case 'slope': {
      const lip = Math.min(0.4, h * 0.3);
      const back = Math.min(1, D / 2);
      const g = prismX([[-d / 2, 0], [d / 2, 0], [d / 2, lip], [-D / 2 + back, h], [-d / 2, h]], w);
      return [own(g, studs(part, h, detail))];
    }
    case 'invslope': {
      const g = prismX([[-d / 2, h * 0.0 + 0.0], [-D / 2 + 1 - GAP, 0], [d / 2, h * 0.66], [d / 2, h], [-d / 2, h]], w);
      return [own(g, studs(part, h, detail))];
    }
    case 'curve': {
      // quarter-ellipse top: flat at the back, curving down to a thin lip at the front
      const lip = 0.08;
      const poly = [[-d / 2, 0], [d / 2, 0], [d / 2, lip]];
      const n = detail >= 2 ? 10 : 5;
      for (let i = n - 1; i >= 0; i--) {
        const a = (i / n) * Math.PI / 2;
        poly.push([-d / 2 + Math.sin(a) * d, lip + Math.cos(a) * (h - lip)]);
      }
      return [own(prismX(poly, w))];
    }
    case 'wedge': {
      const g = prismY([[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, 0], [0, d / 2], [-w / 2, d / 2]], 0, h);
      return [own(g, studs(part, h, detail, [[0, 0], [1, 0], [0, 1]]))];
    }
    case 'windscreen': {
      const t = 0.12;
      const g = prismX([[-d / 2, 0], [d / 2, 0], [d / 2, 0.12], [-d / 2 + t + 0.25, h], [-d / 2, h]], w);
      return [own(g)];
    }
    case 'window': {
      const f = 0.14;
      const frame = [
        box(w, f, d, 0, 0, 0), box(w, f, d, 0, h - f, 0),
        box(f, h - 2 * f, d, -w / 2 + f / 2, f, 0), box(f, h - 2 * f, d, w / 2 - f / 2, f, 0),
        box(0.08, h - 2 * f, 0.18, 0, f, 0),
      ];
      return [own(frame, studs(part, h, detail)), fixed('tclear', box(w - 2 * f, h - 2 * f, 0.08, 0, f, 0))];
    }
    case 'door': {
      const f = 0.14;
      const frame = [box(w, f, d, 0, h - f, 0), box(f, h - f, d, -w / 2 + f / 2, 0, 0), box(f, h - f, d, w / 2 - f / 2, 0, 0)];
      const panel = [box(w - 2 * f - 0.04, h - f - 0.02, 0.3, 0, 0, 0)];
      for (let i = 0; i < 3; i++) panel.push(box(w - 2 * f - 0.4, (h - f) / 3 - 0.25, 0.36, 0, 0.15 + i * (h - f) / 3, 0));
      return [fixed('white', frame, studs(part, h, detail)), own(panel), fixed('gold', cyl(0.07, 0.07, 0.42, 8, w / 2 - f - 0.25, h / 2 - 0.1, 0, 'z'))];
    }
    case 'wheel': {
      const R = D / 2 * 0.96, seg = detail >= 2 ? 28 : 14;
      const tyre = cyl(R, R, w * 0.92, seg, 0, H / 2, 0, 'x');
      const rim = cyl(R * 0.62, R * 0.62, w * 0.96, seg, 0, H / 2, 0, 'x');
      const hub = cyl(R * 0.22, R * 0.22, w * 1.04, 10, 0, H / 2, 0, 'x');
      const treads = [];
      if (detail >= 2) for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2;
        const g = new THREE.BoxGeometry(w * 0.9, 0.06, 0.18);
        g.translate(0, R, 0); g.rotateX(a); g.translate(0, H / 2, 0);
        treads.push(g);
      }
      return [fixed('black', tyre, treads), own(rim), fixed('lgray', hub)];
    }
    case 'axle': {
      return [own(rbox(w, h, d, 0, 0, 0, detail), studs(part, h, detail)), fixed('dgray', cyl(0.12, 0.12, W + 0.7, 8, 0, h / 2, 0, 'x'))];
    }
    case 'trainwheel': {
      const g = [box(w, 0.45, d, 0, h - 0.45, 0), box(w * 0.85, h - 0.45, d * 0.5, 0, 0, 0)];
      const wheels = [];
      for (const x of [-w / 4 - 0.15, w / 4 + 0.15]) for (const z of [-d / 2 + 0.12, d / 2 - 0.12]) wheels.push(cyl(0.48, 0.48, 0.16, detail >= 2 ? 20 : 10, x, 0.5, z, 'z'));
      return [own(g, studs(part, h, detail)), fixed('dgray', wheels), fixed('lgray', cyl(0.06, 0.06, w * 0.7, 6, 0, 0.5, -d / 2 + 0.05, 'x'), cyl(0.06, 0.06, w * 0.7, 6, 0, 0.5, d / 2 - 0.05, 'x'))];
    }
    case 'hinge': {
      const base = H > 0.5 ? rbox(w, h, d, 0, 0, 0, detail) : rbox(w, h, d, 0, 0, 0, detail);
      const knuckles = [];
      for (let i = 0; i < 3; i++) knuckles.push(cyl(0.16, 0.16, w / 3 - 0.06, 10, -w / 3 + i * w / 3, h * 0.5, d / 2 + 0.06, 'x'));
      return [own(base, studs(part, h, detail)), fixed('dgray', knuckles)];
    }
    case 'technic': {
      const holes = [];
      for (let i = 0; i < W - 1; i++) holes.push(cyl(0.24, 0.24, d + 0.03, 12, -W / 2 + 1 + i, h * 0.5, 0, 'z'));
      return [own(rbox(w, h, d, 0, 0, 0, detail), studs(part, h, detail)), fixed('black', holes)];
    }
    case 'connector': {
      return [own(cyl(0.38, 0.38, h * 0.7, 12, 0, h * 0.15, 0)), fixed('dgray', box(1.0, 0.16, 0.16, 0, h * 0.42, 0), box(0.16, 0.16, 1.0, 0, h * 0.42, 0), cyl(0.12, 0.12, 0.25, 8, 0, h * 0.85, 0))];
    }
    case 'round': {
      const r = Math.min(w, d) / 2;
      return [own(cyl(r, r, h, detail >= 2 ? 24 : 12, 0, 0, 0), studs(part, h, detail))];
    }
    case 'cone':
      return [own(cyl(0.16, 0.48, h * 0.9, detail >= 2 ? 20 : 10, 0, 0, 0), cyl(0.2, 0.2, h * 0.1, 10, 0, h * 0.9, 0))];
    case 'dish': {
      const pts = [new THREE.Vector2(0, 0.05), new THREE.Vector2(0.3, 0), new THREE.Vector2(1.0, h + 0.05), new THREE.Vector2(0.95, h + 0.1), new THREE.Vector2(0.3, 0.1), new THREE.Vector2(0, 0.14)];
      const g = new THREE.LatheGeometry(pts, detail >= 2 ? 24 : 12);
      return [own(g), fixed('lgray', cyl(0.06, 0.06, 0.6, 6, 0, 0, 0))];
    }
    case 'antenna':
      return [own(cyl(0.3, 0.34, 0.3, 12, 0, 0, 0), cyl(0.05, 0.05, h - 0.3, 6, 0, 0.3, 0)), fixed('dgray', new THREE.SphereGeometry(0.1, 8, 6).translate(0, h, 0))];
    case 'grille': {
      const bars = [];
      for (let i = 0; i < D * 3; i++) bars.push(box(w * 0.86, 0.12, 0.14, 0, h * 0.75, -d / 2 + 0.17 + i * (d - 0.34) / (D * 3 - 1)));
      return [own(box(w, h * 0.75, d, 0, 0, 0), bars)];
    }
    case 'eye':
      return [fixed('white', cyl(0.42, 0.42, h * 0.8, 16, 0, 0, 0)), own(cyl(0.2, 0.2, h * 0.86, 12, 0.08, 0, 0))];
    case 'flower': {
      const petals = [];
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; petals.push(new THREE.SphereGeometry(0.2, 8, 6).scale(1, 0.5, 1).translate(Math.cos(a) * 0.22, h - 0.12, Math.sin(a) * 0.22)); }
      return [fixed('green', cyl(0.07, 0.07, h - 0.15, 6, 0, 0, 0), new THREE.SphereGeometry(0.12, 6, 4).scale(2, 0.5, 1).translate(0.15, h * 0.4, 0)), own(petals), fixed('yellow', new THREE.SphereGeometry(0.12, 8, 6).translate(0, h - 0.08, 0))];
    }
    case 'arch': {
      const g = [box(w, 0.4, d, 0, h - 0.4, 0), box(0.9, h - 0.4, d, -w / 2 + 0.45, 0, 0), box(0.9, h - 0.4, d, w / 2 - 0.45, 0, 0)];
      const n = detail >= 2 ? 10 : 5, span = w - 1.8, rise = Math.min(h - 0.4, span / 2);
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        const xa = -span / 2 + t0 * span, xb = -span / 2 + t1 * span, xm = (xa + xb) / 2;
        const yArc = (h - 0.4) - rise * Math.sqrt(Math.max(0, 1 - (xm / (span / 2)) ** 2));
        g.push(box(xb - xa + 0.01, h - 0.4 - yArc, d, xm, yArc, 0));
      }
      return [own(g, studs(part, h, detail))];
    }
    case 'crenel':
      return [own(box(w, h * 0.45, d, 0, 0, 0), box(w / 2 - 0.25, h * 0.55, d, -w / 4 - 0.12, h * 0.45, 0), box(w / 2 - 0.25, h * 0.55, d, w / 4 + 0.12, h * 0.45, 0))];
    case 'spike':
      return [own(cyl(0.02, 0.36, h, detail >= 2 ? 16 : 8, 0, 0, 0))];
    case 'propeller': {
      const blades = [];
      for (let i = 0; i < 3; i++) { const g = new THREE.BoxGeometry(0.08, 0.95, 0.2); g.translate(0, 0.5, 0); g.rotateX(i / 3 * Math.PI * 2); g.translate(0.1, h / 2, 0); blades.push(g); }
      return [own(blades), fixed('dgray', cyl(0.18, 0.18, 0.35, 10, 0, h / 2, 0, 'x'))];
    }
    case 'light':
      return [own(cyl(0.42, 0.42, h * 0.85, detail >= 2 ? 18 : 10, 0, 0, 0))];
    case 'figure':
      return figureRecipe(part.fig, detail, own, fixed);
    default:
      return [own(box(w, h, d))];
  }
}

// --------------------------------------------------------------- figures
// A little toy person: chunky legs, a tapered body, round arms with mitten hands and a
// rounded head with a friendly face. Height 8 plates (3.2 units); faces +Z.
const SKIN = 'yellow';
function sph(r, x, y, z, ws = 14, hs = 10, sy = 1) { return new THREE.SphereGeometry(r, ws, hs).scale(1, sy, 1).translate(x, y, z); }
function dome(r, y, sy = 1, seg = 16) { return new THREE.SphereGeometry(r, seg, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, sy, 1).translate(0, y, 0); }
function figureRecipe(f, detail, own, fixed) {
  const seg = detail >= 2 ? 18 : 10;
  const out = [];
  // legs, feet and hips
  const legs = [];
  for (const sx of [-0.42, 0.42]) { legs.push(box(0.76, 1.1, 0.6, sx, 0.12, 0)); legs.push(box(0.8, 0.14, 0.74, sx, 0, 0.05)); }
  legs.push(box(1.66, 0.24, 0.62, 0, 1.18, 0));
  out.push(fixed(f.legs, legs));
  // body: wider at the bottom, like a real toy figure
  const torso = new THREE.CylinderGeometry(0.86, 1.12, 1.02, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.44).translate(0, 1.42 + 0.51, 0);
  // arms angle out a little from the shoulders
  const arms = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.CylinderGeometry(0.16, 0.19, 0.92, seg).rotateZ(sx * 0.18).rotateX(-0.12).translate(sx * 0.83, 1.95, 0.05);
    arms.push(a, sph(0.19, sx * 0.83, 2.38, 0.0, seg, 8));
  }
  out.push(own(torso, arms));
  // hands, neck, head
  const skin = [sph(0.2, -0.92, 1.44, 0.14, seg, 8), sph(0.2, 0.92, 1.44, 0.14, seg, 8), cyl(0.2, 0.22, 0.1, seg, 0, 2.43, 0)];
  if (f.hat !== 'knight') skin.push(new THREE.CapsuleGeometry(0.36, 0.14, 6, seg).scale(1, 0.78, 1).translate(0, 2.8, 0));
  out.push(fixed(SKIN, skin));
  // face: two eyes and a smile
  if (f.hat !== 'knight' && f.hat !== 'space') {
    out.push(fixed('black', sph(0.055, -0.13, 2.86, 0.33, 8, 6), sph(0.055, 0.13, 2.86, 0.33, 8, 6),
      new THREE.TorusGeometry(0.12, 0.024, 5, 12, Math.PI).rotateZ(Math.PI).translate(0, 2.74, 0.34)));
  }
  // what's printed on the body
  const dc = f.detailC || 'white';
  const fz = 0.33;
  switch (f.detail) {
    case 'stripes': out.push(fixed(dc, box(1.62, 0.1, 0.72, 0, 1.6, 0), box(1.4, 0.1, 0.62, 0, 2.05, 0))); break;
    case 'badge': out.push(fixed(dc, box(0.2, 0.22, 0.04, 0.32, 2.05, fz))); break;
    case 'tie': out.push(fixed(dc, box(0.14, 0.62, 0.04, 0, 1.62, fz), box(0.22, 0.1, 0.05, 0, 2.18, fz))); break;
    case 'buttons': out.push(fixed(dc, sph(0.05, 0, 1.68, 0.36, 6, 4), sph(0.05, 0, 1.9, 0.33, 6, 4), sph(0.05, 0, 2.12, 0.31, 6, 4))); break;
    case 'cross': out.push(fixed(dc, box(0.12, 0.5, 0.04, 0, 1.68, fz), box(0.42, 0.12, 0.04, 0, 1.88, fz))); break;
    case 'star': out.push(fixed(dc, new THREE.CylinderGeometry(0.2, 0.2, 0.04, 5).rotateX(Math.PI / 2).translate(0, 1.92, fz))); break;
    case 'stetho': out.push(fixed(dc, new THREE.TorusGeometry(0.28, 0.025, 5, 16, Math.PI).rotateZ(Math.PI).translate(0, 2.3, fz - 0.02), sph(0.06, 0, 2.0, fz + 0.02, 8, 6))); break;
  }
  // head wear
  const hc = f.hatC || 'white', hair = f.hairC || 'brown';
  const hairCap = () => [dome(0.4, 2.86, 0.85, seg), box(0.74, 0.34, 0.2, 0, 2.6, -0.24)];
  switch (f.hat) {
    case 'hair': out.push(fixed(hair, hairCap())); break;
    case 'ponytail': out.push(fixed(hair, hairCap(), sph(0.17, 0, 2.7, -0.42, 10, 8, 1.4))); break;
    case 'fire': out.push(fixed(hc, dome(0.45, 2.86, 0.95, seg), cyl(0.56, 0.56, 0.05, seg, 0, 2.84, -0.04), box(0.6, 0.3, 0.2, 0, 2.55, -0.38)), fixed('gold', box(0.22, 0.26, 0.05, 0, 2.95, 0.41))); break;
    case 'cap': out.push(fixed(hc, cyl(0.42, 0.4, 0.22, seg, 0, 2.95, 0), box(0.6, 0.05, 0.3, 0, 2.95, 0.4)), fixed('gold', box(0.16, 0.12, 0.04, 0, 3.04, 0.42)), fixed(hair, box(0.72, 0.22, 0.16, 0, 2.62, -0.26))); break;
    case 'tophat': out.push(fixed(hc, cyl(0.52, 0.52, 0.05, seg, 0, 3.0, 0), cyl(0.32, 0.32, 0.4, seg, 0, 3.02, 0)), fixed(hair, box(0.74, 0.24, 0.18, 0, 2.62, -0.25))); break;
    case 'chef': out.push(fixed(hc, cyl(0.39, 0.39, 0.2, seg, 0, 2.98, 0), sph(0.42, 0, 3.32, 0, seg, 8, 0.6))); break;
    case 'hardhat': out.push(fixed(hc, dome(0.43, 2.9, 0.9, seg), cyl(0.52, 0.52, 0.05, seg, 0, 2.88, 0.03), box(0.08, 0.36, 0.86, 0, 2.94, 0))); break;
    case 'nursecap': out.push(fixed(hair, hairCap()), fixed(hc, box(0.5, 0.18, 0.3, 0, 3.12, 0.05))); break;
    case 'space': out.push(fixed('tblue', sph(0.5, 0, 2.8, 0.04, seg, 12)), fixed(hc, new THREE.TorusGeometry(0.42, 0.07, 6, seg).rotateX(Math.PI / 2).translate(0, 2.42, 0), box(1.1, 0.7, 0.3, 0, 1.55, -0.42))); break;
    case 'knight': out.push(fixed(hc, cyl(0.42, 0.42, 0.62, seg, 0, 2.48, 0), dome(0.42, 3.1, 0.5, seg)), fixed('black', box(0.5, 0.06, 0.06, 0, 2.82, 0.41))); break;
    case 'bandana': out.push(fixed(hc, dome(0.41, 2.86, 0.8, seg), sph(0.1, 0.2, 2.82, -0.38, 8, 6))); break;
    case 'straw': out.push(fixed(hc, cyl(0.7, 0.7, 0.05, seg, 0, 2.95, 0), cyl(0.34, 0.38, 0.24, seg, 0, 2.97, 0)), fixed(hair, box(0.74, 0.22, 0.16, 0, 2.62, -0.26))); break;
    case 'racing': out.push(fixed(hc, sph(0.47, 0, 2.82, -0.02, seg, 12)), fixed('black', box(0.6, 0.18, 0.08, 0, 2.78, 0.43))); break;
    case 'wizard': out.push(fixed(hc, cyl(0.6, 0.6, 0.05, seg, 0, 2.98, 0), cyl(0.02, 0.38, 0.75, seg, 0, 3.0, 0)), fixed(hair, box(0.5, 0.32, 0.1, 0, 2.4, 0.33))); break;
    case 'safari': out.push(fixed(hc, cyl(0.58, 0.58, 0.05, seg, 0, 2.95, 0), dome(0.38, 2.98, 0.75, seg)), fixed(hair, box(0.74, 0.22, 0.16, 0, 2.62, -0.26))); break;
  }
  return out;
}

const cache = new Map();
/** Cached sub-mesh list for a part at a detail level (0 = no studs, 1 = low, 2 = high). */
export function partGeometry(partId, detail = 2) {
  const key = partId + '@' + detail;
  let g = cache.get(key);
  if (!g) {
    const part = PART_BY_ID[partId];
    g = recipe(part, detail);
    for (const s of g) { s.geo.computeBoundingSphere(); s.geo.computeBoundingBox(); }
    cache.set(key, g);
  }
  return g;
}

/** World-space size of a part's bounding box (unrotated). */
export function partSize(partId) {
  const p = PART_BY_ID[partId];
  return { x: p.w, y: p.h * PLATE_H, z: p.d };
}
