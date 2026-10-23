// engine.js — owns the WebGL renderer, lighting/environment and the render loop.
// Screens that need 3D (studio, box opening, collection room, menu backdrop) each own a
// "stage" ({scene, camera, update(dt)}); the engine renders whichever stage is active.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BrickRenderer } from './brickRenderer.js';
import { boundsOf } from './grid.js';
import { PLATE_H } from './parts.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Graphics presets. "ultra" is for gaming PCs: soft contact shadows between bricks
// (ambient occlusion), a gentle glow on lights and glass, 4K shadow maps and MSAA.
export const QUALITY = {
  ultra:  { pixelRatio: 2,    shadows: true,  shadowSize: 4096, detail: 2, ao: true,  bloom: true,  msaa: 4 },
  high:   { pixelRatio: 1.5,  shadows: true,  shadowSize: 2048, detail: 2, ao: true,  bloom: false, msaa: 4 },
  medium: { pixelRatio: 1.25, shadows: true,  shadowSize: 1024, detail: 1, ao: false, bloom: false, msaa: 0 },
  low:    { pixelRatio: 1,    shadows: false, shadowSize: 512,  detail: 0, ao: false, bloom: false, msaa: 0 },
};

/** Ambient occlusion that ignores see-through things (ghost previews, glass, effects). */
class BrickAOPass extends GTAOPass {
  overrideVisibility() {
    const cache = this._visibilityCache;
    this.scene.traverse(o => {
      cache.set(o, o.visible);
      if (o.isPoints || o.isLine || o.userData.noAO) o.visible = false;
      else if (o.isMesh && o.material && !Array.isArray(o.material) && o.material.transparent) o.visible = false;
    });
  }
}

/** Build the effects chain for a renderer: render → AO → bloom → tone mapping. */
export function makeComposer(renderer, q, w, h) {
  if (!q.ao && !q.bloom) return null;
  const pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(Math.max(1, w * pr), Math.max(1, h * pr), { type: THREE.HalfFloatType, samples: q.msaa || 0 });
  const composer = new EffectComposer(renderer, rt);
  const dummyScene = new THREE.Scene(), dummyCam = new THREE.PerspectiveCamera();
  const render = new RenderPass(dummyScene, dummyCam);
  composer.addPass(render);
  let ao = null, bloom = null;
  if (q.ao) {
    ao = new BrickAOPass(dummyScene, dummyCam, w, h);
    ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.25, samples: 16, distanceFallOff: 1.0 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 16 });
    ao.blendIntensity = 0.95;
    composer.addPass(ao);
  }
  if (q.bloom) {
    bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.16, 0.35, 1.35);   // only really bright things (lights, glass highlights) glow
    composer.addPass(bloom);
  }
  composer.addPass(new OutputPass());
  composer.setSize(w, h);
  return {
    composer, render, ao, bloom,
    setView(scene, camera) { render.scene = scene; render.camera = camera; if (ao) { ao.scene = scene; ao.camera = camera; } },
    dispose() { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); },
  };
}

export class Engine {
  constructor(canvas, quality = 'ultra') {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;   // keeps plastic colours bright and saturated
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
    pmrem.dispose();
    this.stage = null;
    this.fx = null;
    this.clock = new THREE.Clock();
    this.setQuality(quality);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.running = true;
    this.frameHooks = new Set();
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.1, this.clock.getDelta());
      if (!this.running || !this.stage || document.hidden) return;
      try {
        this.stage.update && this.stage.update(dt);
        for (const f of this.frameHooks) f(dt);
        this.draw(dt);
      } catch (e) {
        this.running = false;
        window.dispatchEvent(new CustomEvent('bv-fatal', { detail: e }));
      }
    };
    loop();
  }

  draw(dt = 0) {
    if (this.fx) { this.fx.setView(this.stage.scene, this.stage.camera); this.fx.composer.render(dt); }
    else this.renderer.render(this.stage.scene, this.stage.camera);
  }

  setQuality(q) {
    this.qualityName = QUALITY[q] ? q : 'ultra';
    this.quality = QUALITY[this.qualityName];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio));
    this.renderer.shadowMap.enabled = this.quality.shadows;
    if (this.fx) { this.fx.dispose(); this.fx = null; }
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    try { this.fx = makeComposer(this.renderer, this.quality, w, h); }
    catch (e) { console.warn('Effects unavailable, using plain rendering', e); this.fx = null; }
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.fx) this.fx.composer.setSize(w, h);
    if (this.stage && this.stage.camera.isPerspectiveCamera) {
      this.stage.camera.aspect = w / h;
      this.stage.camera.updateProjectionMatrix();
    }
  }

  setStage(stage) {
    this.stage = stage;
    if (stage) {
      stage.scene.environment = this.envMap;
      stage.scene.environmentIntensity = stage.scene.environmentIntensity ?? 1;
      this.resize();
    }
  }

  /** Grab the current view as a PNG data URL. */
  screenshot() {
    if (!this.stage) return null;
    this.draw();
    return this.canvas.toDataURL('image/png');
  }
}

/** A neutral studio: soft key light with shadows, fill light, gradient-ish backdrop. */
export function makeStudioScene(opts = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(opts.background || '#e8edf3');
  scene.fog = new THREE.Fog(scene.background, 120, 260);
  scene.environmentIntensity = 0.85;
  // warm key light (like a sunny window), cool fill, and a rim light for shiny edges
  const hemi = new THREE.HemisphereLight(0xfff7ea, 0x8a7a68, 0.45);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1dc, 2.1);
  key.position.set(18, 30, 14);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.025;
  scene.add(key);
  scene.add(key.target);
  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.55);
  fill.position.set(-20, 12, -10);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.9);
  rim.position.set(-6, 14, -30);
  scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.ShadowMaterial({ opacity: 0.18 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.001;
  floor.receiveShadow = true;
  scene.add(floor);
  return { scene, key, hemi, fill, rim, floor };
}

/** Point the shadow camera at a box so shadows stay crisp for any model size. */
export function fitShadow(key, bb, size = 2048) {
  const cx = (bb.minX + bb.maxX) / 2, cz = (bb.minZ + bb.maxZ) / 2;
  const r = Math.max(8, Math.hypot(bb.maxX - bb.minX, bb.maxZ - bb.minZ, (bb.maxY - bb.minY) * PLATE_H) * 0.65 + 2);
  key.target.position.set(cx, 0, cz);
  key.position.set(cx + r * 0.9, r * 1.6 + 6, cz + r * 0.7);
  const c = key.shadow.camera;
  c.left = -r; c.right = r; c.top = r; c.bottom = -r; c.near = 0.5; c.far = r * 5 + 40;
  c.updateProjectionMatrix();
  if (key.shadow.mapSize.x !== size) { key.shadow.mapSize.set(size, size); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
}

/** Camera position that frames a brick model nicely from the front-right. */
export function frameModel(camera, bricks, target = new THREE.Vector3(), fill = 1.0) {
  const bb = boundsOf(bricks);
  const cx = (bb.minX + bb.maxX) / 2, cz = (bb.minZ + bb.maxZ) / 2;
  const cy = (bb.maxY * PLATE_H) / 2;
  const radius = Math.max(2.5, Math.hypot(bb.maxX - bb.minX, bb.maxZ - bb.minZ, bb.maxY * PLATE_H) / 2);
  const fov = camera.fov * Math.PI / 180;
  const dist = radius / Math.sin(fov / 2) * 0.92 / fill;
  const dir = new THREE.Vector3(0.75, 0.62, 1).normalize();
  target.set(cx, cy, cz);
  camera.position.copy(target).addScaledVector(dir, dist);
  camera.near = Math.max(0.05, dist / 200); camera.far = dist * 20 + 200;
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  return { target, dist, bb };
}

// ------------------------------------------------------------------ thumbnails
/**
 * Renders model previews into small images using a separate, tiny renderer.
 * Work is queued and done a few at a time so the page stays responsive.
 */
export class ThumbnailMaker {
  constructor(envMap, size = [320, 240], opts = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = size[0]; this.canvas.height = size[1];
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: true, alpha: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size[0], size[1], false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const st = makeStudioScene();
    this.scene = st.scene; this.key = st.key;
    this.scene.fog = null;
    this.scene.environment = envMap;
    this.camera = new THREE.PerspectiveCamera(30, size[0] / size[1], 0.1, 1000);
    // a soft "product photo" backdrop
    const bg = document.createElement('canvas'); bg.width = 256; bg.height = 192;
    const bx = bg.getContext('2d');
    const gr = bx.createRadialGradient(128, 110, 10, 128, 110, 190);
    gr.addColorStop(0, opts.bgInner || '#ffffff'); gr.addColorStop(1, opts.bgOuter || '#cdd6e3');
    bx.fillStyle = gr; bx.fillRect(0, 0, 256, 192);
    this.backdrop = new THREE.CanvasTexture(bg); this.backdrop.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = opts.transparent ? null : this.backdrop;
    st.floor.material.opacity = 0.22;
    this.fx = null;
    if (opts.fancy) {
      try { this.fx = makeComposer(this.renderer, { ao: true, bloom: false, msaa: 4 }, size[0], size[1]); }
      catch (e) { console.warn('Thumbnail effects unavailable', e); }
    }
    this.cache = new Map();
    this.queue = [];
    this.busy = false;
  }

  /** Render immediately and return a data URL. */
  render(bricks, opts = {}) {
    const br = new BrickRenderer(this.scene, { detail: opts.detail ?? 1, shadows: true });
    if (opts.tint) br.tint = opts.tint;
    if (opts.highlight) { br.highlightLerp = 0; br.outlineColor = opts.outlineColor ?? 0xff9900; br.highlighted = new Set(opts.highlight); }
    br.setBricks(bricks);
    let bb;
    if (opts.view) {
      // fixed camera (instruction booklet pages all share one viewpoint)
      this.camera.position.copy(opts.view.position);
      this.camera.near = opts.view.near; this.camera.far = opts.view.far;
      this.camera.lookAt(opts.view.target);
      this.camera.updateProjectionMatrix();
      bb = opts.view.bb;
    } else ({ bb } = frameModel(this.camera, bricks, undefined, opts.fill || 1.3));
    fitShadow(this.key, bb, 1024);
    if (this.fx) { this.fx.setView(this.scene, this.camera); this.fx.composer.render(); }
    else this.renderer.render(this.scene, this.camera);
    const url = this.canvas.toDataURL('image/webp', 0.85);
    br.dispose();
    return url;
  }

  /** Get a cached thumbnail, or queue one; cb(url) is called when ready. */
  request(key, bricksFn, cb, opts, urgent = false) {
    if (this.cache.has(key)) { cb(this.cache.get(key)); return; }
    const job = { key, bricksFn, cb, opts };
    if (urgent) this.queue.unshift(job); else this.queue.push(job);
    this.pump();
  }

  pump() {
    if (this.busy) return;
    this.busy = true;
    const step = () => {
      const t0 = performance.now();
      while (this.queue.length && performance.now() - t0 < 12) {
        const job = this.queue.shift();
        if (this.cache.has(job.key)) { job.cb(this.cache.get(job.key)); continue; }
        try {
          const url = this.render(job.bricksFn(), typeof job.opts === 'function' ? job.opts() : job.opts);
          this.cache.set(job.key, url);
          if (this.maxCache && this.cache.size > this.maxCache) this.cache.delete(this.cache.keys().next().value);
          job.cb(url);
        } catch (e) { console.warn('Thumbnail failed', e); job.cb(null); }
      }
      if (this.queue.length) requestAnimationFrame(step); else this.busy = false;
    };
    requestAnimationFrame(step);
  }
}
