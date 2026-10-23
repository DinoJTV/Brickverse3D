// brickRenderer.js — draws a list of pieces efficiently with InstancedMesh.
// All pieces that share a part type + sub-mesh + opacity are drawn in ONE draw call,
// so even large models stay smooth. Also handles mouse picking and highlighting.
import * as THREE from 'three';
import { PART_BY_ID, PLATE_H, COLOR_BY_ID, isTransColor, footprint } from './parts.js';
import { partGeometry } from './geometry.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);
const colorCache = new Map();
export function threeColor(id) {
  let c = colorCache.get(id);
  if (!c) { c = new THREE.Color(COLOR_BY_ID[id] ? COLOR_BY_ID[id].hex : '#ff00ff'); colorCache.set(id, c); }
  return c;
}

export const MATERIALS = {
  // glossy ABS plastic: a little clear-coat gives the bright highlights real bricks have
  opaque: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.24, metalness: 0.0, clearcoat: 0.55, clearcoatRoughness: 0.16, specularIntensity: 0.7, envMapIntensity: 0.9 }),
  trans: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, metalness: 0.0, transparent: true, opacity: 0.5, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6 }),
};

/** Matrix that places a piece at its grid position. */
export function brickMatrix(b, out = _m) {
  const part = PART_BY_ID[b.t];
  const f = footprint(part, b.r);
  _p.set(b.x + f.w / 2, b.y * PLATE_H, b.z + f.d / 2);
  _q.setFromAxisAngle(_up, b.r * Math.PI / 2);
  return out.compose(_p, _q, _s);
}

export class BrickRenderer {
  constructor(parent, opts = {}) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.detail = opts.detail ?? 2;
    this.shadows = opts.shadows ?? true;
    this.bricks = [];
    this.meshes = [];
    this.highlighted = new Set();
    this.tint = null;       // optional per-brick colour override fn
    this.highlightLerp = 0.45;          // how much highlighted pieces are tinted blue
    this.outlineColor = 0x1e90ff;       // outline colour for highlighted pieces
    this.hidden = new Set();   // pieces temporarily not drawn (e.g. while dropping in)
    this.outline = new THREE.Group();
    this.group.add(this.outline);
  }

  setDetail(detail, shadows) {
    this.detail = detail; this.shadows = shadows;
    this.rebuild();
  }

  setBricks(bricks) { this.bricks = bricks; this.rebuild(); }

  /** Rebuild all instanced meshes from this.bricks. Cheap enough to call per edit. */
  rebuild() {
    for (const m of this.meshes) { this.group.remove(m); m.dispose(); }
    this.meshes = [];
    const groups = new Map();
    // Level of detail: very large models use simpler studs so they stay smooth.
    const detail = this.detail >= 2 && this.bricks.length > 1200 ? 1 : this.detail;
    this.effectiveDetail = detail;
    for (let i = 0; i < this.bricks.length; i++) {
      const b = this.bricks[i];
      if (!PART_BY_ID[b.t] || this.hidden.has(b)) continue;
      const subs = partGeometry(b.t, detail);
      for (let s = 0; s < subs.length; s++) {
        const colorId = subs[s].color === 'own' ? b.c : subs[s].color;
        const trans = isTransColor(colorId);
        const key = b.t + '|' + s + '|' + (trans ? 1 : 0);
        let g = groups.get(key);
        if (!g) { g = { geo: subs[s].geo, trans, items: [] }; groups.set(key, g); }
        g.items.push({ b, colorId });
      }
    }
    for (const g of groups.values()) {
      const mesh = new THREE.InstancedMesh(g.geo, g.trans ? MATERIALS.trans : MATERIALS.opaque, g.items.length);
      mesh.castShadow = this.shadows && !g.trans;
      mesh.receiveShadow = this.shadows;
      mesh.userData.bricks = g.items.map(it => it.b);
      const hiCol = new THREE.Color();
      g.items.forEach((it, i) => {
        mesh.setMatrixAt(i, brickMatrix(it.b));
        let col = threeColor(it.colorId);
        if (this.highlighted.has(it.b) && this.highlightLerp) col = hiCol.copy(col).lerp(new THREE.Color('#5ab0ff'), this.highlightLerp);
        if (this.tint) { const t = this.tint(it.b); if (t) col = hiCol.copy(t); }
        mesh.setColorAt(i, col);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();      // lets three.js skip meshes outside the camera view
      mesh.frustumCulled = true;
      if (g.trans) mesh.renderOrder = 2;
      this.group.add(mesh);
      this.meshes.push(mesh);
    }
    this.updateOutline();
  }

  setHighlighted(set) {
    this.highlighted = new Set(set);
    this.rebuild();
  }

  updateOutline() {
    for (const c of [...this.outline.children]) { this.outline.remove(c); c.geometry.dispose(); }
    if (!this.highlighted.size) return;
    const mat = new THREE.LineBasicMaterial({ color: this.outlineColor, depthTest: false, transparent: true, opacity: 0.9 });
    for (const b of this.highlighted) {
      const part = PART_BY_ID[b.t]; if (!part) continue;
      const f = footprint(part, b.r);
      const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(f.w + 0.06, part.h * PLATE_H + 0.06, f.d + 0.06));
      const line = new THREE.LineSegments(geo, mat);
      line.position.set(b.x + f.w / 2, b.y * PLATE_H + part.h * PLATE_H / 2, b.z + f.d / 2);
      line.renderOrder = 10;
      this.outline.add(line);
    }
  }

  /** Raycast the pieces. Returns {brick, point, normal} or null. */
  pick(raycaster) {
    const hits = raycaster.intersectObjects(this.meshes, false);
    for (const h of hits) {
      const b = h.object.userData.bricks[h.instanceId];
      if (!b) continue;
      const n = h.face ? h.face.normal.clone() : new THREE.Vector3(0, 1, 0);
      h.object.getMatrixAt(h.instanceId, _m);
      n.transformDirection(_m).transformDirection(h.object.matrixWorld);
      return { brick: b, point: h.point.clone(), normal: n };
    }
    return null;
  }

  dispose() {
    for (const m of this.meshes) { this.group.remove(m); m.dispose(); }
    this.meshes = [];
    this.group.parent && this.group.parent.remove(this.group);
  }
}

/** A see-through copy of one piece (used for the placement ghost and instruction targets). */
export function makeGhost(partId, color, detail = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.5, depthWrite: false, roughness: 0.4, emissive: new THREE.Color(color), emissiveIntensity: 0.35 });
  for (const s of partGeometry(partId, detail)) {
    const m = new THREE.Mesh(s.geo, mat);
    m.renderOrder = 5;
    g.add(m);
  }
  g.userData.material = mat;
  return g;
}

export function placeObject(obj, b) {
  brickMatrix(b, _m);
  _m.decompose(obj.position, obj.quaternion, obj.scale);
}
