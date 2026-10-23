// effects.js — the "juice" that makes placing a brick feel good:
// the piece drops in, squashes and bounces as it clicks onto the studs, a ring of
// air puffs out from underneath and a few sparkles fly off. The landing callback
// fires at the exact moment of contact so the click sound lines up.
import * as THREE from 'three';
import { partGeometry } from './geometry.js';
import { placeObject, threeColor } from './brickRenderer.js';
import { PART_BY_ID, PLATE_H, COLOR_BY_ID, footprint } from './parts.js';

const spark = new THREE.OctahedronGeometry(0.09, 0);
const ring = new THREE.RingGeometry(0.42, 0.5, 40);
ring.rotateX(-Math.PI / 2);

export class PlaceFX {
  constructor(world) {
    this.world = world;
    this.items = [];
  }

  /** Animate a piece dropping into place. onLand() fires on contact, onDone() when settled. */
  drop(b, detail, { onLand, onDone, height = 1.3 } = {}) {
    const grp = new THREE.Group();
    const mats = [];
    for (const s of partGeometry(b.t, detail)) {
      const cid = s.color === 'own' ? b.c : s.color;
      const trans = !!(COLOR_BY_ID[cid] && COLOR_BY_ID[cid].trans);
      const m = new THREE.MeshStandardMaterial({ color: threeColor(cid), roughness: 0.3, transparent: trans, opacity: trans ? 0.55 : 1, depthWrite: !trans });
      mats.push(m);
      const mesh = new THREE.Mesh(s.geo, m);
      mesh.castShadow = !trans;
      grp.add(mesh);
    }
    placeObject(grp, b);
    const y0 = grp.position.y;
    grp.position.y = y0 + height;
    this.world.add(grp);
    this.items.push({ kind: 'drop', obj: grp, y0, height, t: 0, landed: false, b, mats, onLand, onDone });
  }

  /** Ring of air + sparkles at the base of a piece. */
  burst(b, strength = 1) {
    const part = PART_BY_ID[b.t];
    const f = footprint(part, b.r);
    const cx = b.x + f.w / 2, cz = b.z + f.d / 2, y = b.y * PLATE_H + 0.02;
    const size = Math.max(f.w, f.d);
    // expanding ring
    const rm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false });
    const r = new THREE.Mesh(ring, rm);
    r.position.set(cx, y, cz);
    r.scale.setScalar(size * 0.7 + 0.4);
    r.renderOrder = 6;
    this.world.add(r);
    this.items.push({ kind: 'ring', obj: r, mat: rm, t: 0, s0: size * 0.7 + 0.4 });
    // sparkles in white, gold and the brick's own colour
    const n = Math.round((6 + Math.min(10, size * 2)) * strength);
    const cols = [0xffffff, 0xffe066, threeColor(b.c).getHex()];
    for (let i = 0; i < n; i++) {
      const m = new THREE.MeshBasicMaterial({ color: cols[i % 3], transparent: true, opacity: 1, depthWrite: false });
      const p = new THREE.Mesh(spark, m);
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const rad = size * 0.5 + 0.2;
      p.position.set(cx + Math.cos(a) * rad, y + 0.15, cz + Math.sin(a) * rad);
      const sp = 2.2 + Math.random() * 2.2;
      this.world.add(p);
      this.items.push({ kind: 'spark', obj: p, mat: m, t: 0, life: 0.45 + Math.random() * 0.25, v: new THREE.Vector3(Math.cos(a) * sp, 2.5 + Math.random() * 2.5, Math.sin(a) * sp), spin: (Math.random() - 0.5) * 20 });
    }
  }

  /** Confetti fountain for finishing a step or a model. */
  celebrate(center, count = 40) {
    const cols = [0xf43f5e, 0xfacc15, 0x22c55e, 0x3b82f6, 0xa855f7, 0xfb923c];
    for (let i = 0; i < count; i++) {
      const m = new THREE.MeshBasicMaterial({ color: cols[i % cols.length], transparent: true, opacity: 1, depthWrite: false });
      const p = new THREE.Mesh(spark, m);
      p.scale.set(1.6, 0.5, 1.2);
      p.position.copy(center);
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 4;
      this.world.add(p);
      this.items.push({ kind: 'spark', obj: p, mat: m, t: 0, life: 1.1 + Math.random() * 0.6, v: new THREE.Vector3(Math.cos(a) * sp, 6 + Math.random() * 6, Math.sin(a) * sp), spin: (Math.random() - 0.5) * 14 });
    }
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      let done = false;
      if (it.kind === 'drop') {
        const fall = 0.12;
        if (it.t < fall) {
          const k = it.t / fall;
          it.obj.position.y = it.y0 + it.height * (1 - k * k);       // accelerate down
        } else {
          if (!it.landed) { it.landed = true; it.obj.position.y = it.y0; it.onLand && it.onLand(); }
          // squash and stretch on landing, like the piece is pressed onto the studs
          const s = it.t - fall;
          const sq = Math.exp(-s * 14) * Math.cos(s * 38) * 0.14;
          it.obj.scale.set(1 + sq * 0.35, 1 - sq, 1 + sq * 0.35);
          if (s > 0.22) done = true;
        }
        if (done) { this.world.remove(it.obj); it.mats.forEach(m => m.dispose()); it.onDone && it.onDone(); }
      } else if (it.kind === 'ring') {
        const k = Math.min(1, it.t / 0.35);
        it.obj.scale.setScalar(it.s0 * (1 + k * 1.4));
        it.mat.opacity = 0.7 * (1 - k);
        done = k >= 1;
        if (done) { this.world.remove(it.obj); it.mat.dispose(); }
      } else if (it.kind === 'spark') {
        it.v.y -= 14 * dt;
        it.obj.position.addScaledVector(it.v, dt);
        it.obj.rotation.x += it.spin * dt; it.obj.rotation.y += it.spin * dt;
        const k = it.t / it.life;
        it.mat.opacity = Math.max(0, 1 - k * k);
        done = k >= 1;
        if (done) { this.world.remove(it.obj); it.mat.dispose(); }
      }
      if (done) this.items.splice(i, 1);
    }
  }

  clear() {
    for (const it of this.items) { this.world.remove(it.obj); if (it.mats) it.mats.forEach(m => m.dispose()); if (it.mat) it.mat.dispose(); }
    this.items = [];
  }
}
