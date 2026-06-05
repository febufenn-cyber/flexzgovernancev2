/*  Fusion Center — "Grid Acquisition" login intro.
 *
 *  Plays ONCE, right after login (server-gated via body[data-intro="1"]). A dark
 *  command-grid globe rises with India shown straight and upright; its neon
 *  boundary ignites; the camera zooms to fit Tamil Nadu; then the live 2D TN grid
 *  fades in exactly over it and FLIPs down onto the dashboard map — one continuous
 *  move from globe to working dashboard, no gap. Skippable (click / Esc / Skip).
 *  Three.js via importmap; GSAP via global; honours prefers-reduced-motion.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const gsap = window.gsap;
const WORLD_URL = '/static/dashboard/vendor/geo/world-110m.json';
const INDIA = { lat: 22.0, lon: 79.0 };          // orient straight on India first
const TN = { lat: 11.13, lon: 78.66 };           // then zoom to fit Tamil Nadu

const COL = {
  ocean:   0x081521,
  land:    0x2f6f6a,   // dim continents
  india:   0x6cf0ff,   // neon India boundary
  reticle: 0xff6a3d,
  atm:     0x2bb6c8,
  star:    0x9fc7d6,
};

function ll2v(lat, lon, R) {
  const phi = lat * Math.PI / 180, lam = lon * Math.PI / 180;
  return new THREE.Vector3(
    R * Math.cos(phi) * Math.cos(lam),
    R * Math.sin(phi),
    -R * Math.cos(phi) * Math.sin(lam),
  );
}

/* Quaternion that brings (lat,lon) to face the camera (+Z) with north pointing up. */
function orientNorthUp(lat, lon) {
  const f = ll2v(lat, lon, 1).normalize();
  const north = new THREE.Vector3(0, 1, 0);
  const y = north.clone().sub(f.clone().multiplyScalar(north.dot(f)));
  if (y.lengthSq() < 1e-6) y.set(0, 0, 1);
  y.normalize();
  const x = new THREE.Vector3().crossVectors(y, f).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, f);
  return new THREE.Quaternion().setFromRotationMatrix(m).invert();
}

function linesFromFeatures(features, keep, R, material) {
  const verts = [];
  const pushRing = (ring) => {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ll2v(ring[i][1], ring[i][0], R);
      const b = ll2v(ring[i + 1][1], ring[i + 1][0], R);
      verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  };
  for (const f of features) {
    if (!keep(f)) continue;
    if (f.g.t === 'P') f.g.c.forEach(pushRing);
    else f.g.c.forEach((poly) => poly.forEach(pushRing));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return new THREE.LineSegments(geo, material);
}

class GridIntro {
  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'grid-intro';
    this.root.innerHTML = `
      <div class="gi-bg"></div>
      <canvas class="gi-canvas"></canvas>
      <svg class="gi-tn" viewBox="0 0 1000 1200" preserveAspectRatio="xMidYMid meet" aria-hidden="true"></svg>
      <div class="gi-hud" aria-hidden="true">
        <span class="gi-corner tl"></span><span class="gi-corner tr"></span>
        <span class="gi-corner bl"></span><span class="gi-corner br"></span>
        <div class="gi-top">
          <div class="gi-brand">FLEXZ // FUSION CENTER</div>
          <div class="gi-seq">GRID ACQUISITION SEQUENCE</div>
        </div>
        <div class="gi-reticle"><span></span><span></span><i></i></div>
        <div class="gi-readout">
          <div class="gi-acq">INITIALISING<span class="gi-dots">…</span></div>
          <div class="gi-coord"><b id="gi-lat">--.--°N</b><b id="gi-lon">--.--°E</b></div>
        </div>
        <div class="gi-scan"></div>
      </div>
      <button class="gi-skip" type="button">SKIP <span aria-hidden="true">▸</span></button>`;
    document.body.appendChild(this.root);

    this.bg = this.root.querySelector('.gi-bg');
    this.canvas = this.root.querySelector('.gi-canvas');
    this.svg = this.root.querySelector('.gi-tn');
    this.acq = this.root.querySelector('.gi-acq');
    this.latEl = this.root.querySelector('#gi-lat');
    this.lonEl = this.root.querySelector('#gi-lon');
    this.done = false;
  }

  async run() {
    try { await this._initScene(); } catch (e) {
      console.error('[grid-intro] init failed:', e); this._cleanup(); return;
    }
    await this._loadTN();
    this._renderLoop();
    this._buildTimeline();

    const skip = () => this.tl && this.tl.progress(0.97);
    this.root.querySelector('.gi-skip').addEventListener('click', (e) => { e.stopPropagation(); skip(); });
    this.root.addEventListener('click', skip);
    this._onKey = (e) => { if (e.key === 'Escape') skip(); };
    window.addEventListener('keydown', this._onKey);
  }

  async _initScene() {
    const data = await fetch(WORLD_URL).then((r) => r.json());
    const feats = data.features;

    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 0, 3.8);

    this.globe = new THREE.Group();
    this.scene.add(this.globe);

    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.992, 64, 64),
      new THREE.MeshBasicMaterial({ color: COL.ocean }));
    this.globe.add(ball);

    // subtle graticule
    const grat = [];
    for (let lat = -60; lat <= 60; lat += 30)
      for (let lon = -180; lon < 180; lon += 4) grat.push(ll2v(lat, lon, 1.0), ll2v(lat, lon + 4, 1.0));
    for (let lon = -180; lon < 180; lon += 30)
      for (let lat = -90; lat < 90; lat += 4) grat.push(ll2v(lat, lon, 1.0), ll2v(lat + 4, lon, 1.0));
    this.globe.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(grat),
      new THREE.LineBasicMaterial({ color: 0x123236, transparent: true, opacity: 0.3 })));

    this.otherMat = new THREE.LineBasicMaterial({ color: COL.land, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.indiaMat = new THREE.LineBasicMaterial({ color: COL.india, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.other = linesFromFeatures(feats, (f) => f.n !== 'India', 1.004, this.otherMat);
    this.india = linesFromFeatures(feats, (f) => f.n === 'India', 1.006, this.indiaMat);
    this.globe.add(this.other, this.india);

    const atm = new THREE.Mesh(new THREE.SphereGeometry(1.16, 48, 48),
      new THREE.ShaderMaterial({
        uniforms: { c: { value: new THREE.Color(COL.atm) }, o: { value: 0.0 } },
        vertexShader: 'varying vec3 vN; void main(){ vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 c; uniform float o; varying vec3 vN; void main(){ float i=pow(1.0-abs(dot(vN,vec3(0.,0.,1.))),3.0); gl_FragColor=vec4(c, i*o); }',
        blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true, depthWrite: false }));
    this.atm = atm; this.scene.add(atm);

    const ring = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.047, 48),
      new THREE.MeshBasicMaterial({ color: COL.reticle, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }));
    const tnPos = ll2v(TN.lat, TN.lon, 1.012);
    ring.position.copy(tnPos);
    ring.lookAt(tnPos.clone().multiplyScalar(2));
    this.globe.add(ring); this.reticle = ring;

    const sp = [];
    for (let i = 0; i < 1400; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(14 + Math.random() * 22);
      sp.push(v.x, v.y, v.z);
    }
    this.stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)),
      new THREE.PointsMaterial({ color: COL.star, size: 0.06, transparent: true, opacity: 0.0, depthWrite: false }));
    this.scene.add(this.stars);

    // orientation targets (north-up)
    this.qIndia = orientNorthUp(INDIA.lat, INDIA.lon);
    this.qTN = orientNorthUp(TN.lat, TN.lon);
    this.globe.quaternion.copy(this.qIndia);

    // bloom -> neon
    const composer = new EffectComposer(r);
    composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.75, 0.5, 0.22);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.composer = composer;

    this._resize();
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
  }

  async _loadTN() {
    try {
      const data = await fetch('/api/map/?department=police', { credentials: 'same-origin' }).then((r) => r.json());
      const ns = 'http://www.w3.org/2000/svg';
      for (const d of (data.districts || [])) {
        const p = document.createElementNS(ns, 'path');
        p.setAttribute('d', d.svg_path);
        p.setAttribute('class', `gi-d s-${d.status}`);
        this.svg.appendChild(p);
      }
    } catch (e) { /* optional */ }
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  _renderLoop = () => {
    if (this.done) return;
    this.stars.rotation.y += 0.0003;
    this.composer.render();
    requestAnimationFrame(this._renderLoop);
  };

  _buildTimeline() {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, onComplete: () => this._cleanup() });
    this.tl = tl;
    window.__giTL = tl;   // debug/verify handle
    const lock = { t: 0 };
    const coord = { lat: INDIA.lat, lon: INDIA.lon };
    this.globe.scale.setScalar(0.9);

    // 0.0 — rise + spinning globe that DECELERATES and settles exactly straight on India
    const yAxis = new THREE.Vector3(0, 1, 0);
    const spin = { a: Math.PI * 2.6 };
    const applySpin = () => this.globe.quaternion.copy(this.qIndia)
      .multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, spin.a));
    applySpin();
    tl.to(this.stars.material, { opacity: 0.9, duration: 1.2 }, 0);
    tl.to(this.otherMat, { opacity: 0.5, duration: 1.3 }, 0.1);
    tl.to(this.atm.material.uniforms.o, { value: 0.85, duration: 1.5 }, 0.1);
    tl.to(this.globe.scale, { x: 1, y: 1, z: 1, duration: 1.6, ease: 'power3.out' }, 0);
    tl.to(spin, { a: 0, duration: 2.0, ease: 'power3.out', onUpdate: applySpin }, 0);  // ends STRAIGHT on India
    tl.fromTo('.gi-top', { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.8 }, 0.3);
    tl.call(() => { this.acq.firstChild.textContent = 'ORIENTING ▸ INDIA'; }, null, 0.5);

    // 1.6 — neon India boundary ignites (globe now straight)
    tl.to(this.indiaMat, { opacity: 1.0, duration: 0.7 }, 1.6);
    tl.call(() => { this.acq.firstChild.textContent = 'ACQUIRING ▸ TAMIL NADU GRID'; }, null, 1.9);
    tl.fromTo('.gi-readout', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6 }, 1.8);

    // 2.2 — zoom to fit Tamil Nadu (orient India -> TN straight, dolly in, world dims)
    tl.to(lock, { t: 1, duration: 1.6, ease: 'power3.inOut',
      onUpdate: () => this.globe.quaternion.copy(this.qIndia).slerp(this.qTN, lock.t) }, 2.2);
    tl.to(this.camera.position, { z: 1.42, duration: 1.7, ease: 'power3.inOut' }, 2.2);
    tl.to(this.otherMat, { opacity: 0.05, duration: 1.0 }, 2.5);
    tl.to(this.reticle.material, { opacity: 0.95, duration: 0.5 }, 2.5);
    tl.fromTo('.gi-reticle', { opacity: 0, scale: 1.5 }, { opacity: 1, scale: 1, duration: 0.7 }, 2.5);
    tl.to(coord, { lat: TN.lat, lon: TN.lon, duration: 1.3, ease: 'power1.inOut',
      onUpdate: () => { this.latEl.textContent = coord.lat.toFixed(2) + '°N'; this.lonEl.textContent = coord.lon.toFixed(2) + '°E'; } }, 2.2);

    // 3.55 — pin the neon TN at the dashboard map's box, but TRANSFORMED to appear centred
    //         on screen (uniform scale, so it never warps). It fades in right over the globe's
    //         TN at screen centre — continuous.
    tl.call(() => this._placeNeon(), null, 3.55);
    tl.call(() => { this.acq.firstChild.textContent = 'TAMIL NADU GRID LOCKED'; }, null, 3.7);
    tl.fromTo(this.svg, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 3.7);
    // globe outline recedes behind the neon TN
    tl.to([this.otherMat, this.indiaMat, this.reticle.material], { opacity: 0.0, duration: 0.55 }, 4.1);
    tl.to(this.atm.material.uniforms.o, { value: 0.0, duration: 0.55 }, 4.1);
    tl.to(this.canvas, { opacity: 0, duration: 0.7 }, 4.2);

    // 4.6 — FLIP: the centred neon TN slides + uniformly scales DOWN onto the real map exactly
    //        (transform -> identity = the map box), while the backdrop dissolves so the live
    //        dashboard fades up underneath the settling borders. No jump, no warp.
    tl.call(() => { this.acq.firstChild.textContent = 'GRID ONLINE'; }, null, 4.5);
    tl.to(this.svg, { x: 0, y: 0, scale: 1, duration: 0.95, ease: 'power3.inOut' }, 4.6);
    tl.to('.gi-hud', { opacity: 0, duration: 0.6 }, 4.7);
    tl.to(this.bg, { opacity: 0, duration: 1.3, ease: 'power2.inOut' }, 4.7);   // dashboard gradually appears
    // neon borders linger inside the real TN, then cross-dissolve into the live colours
    tl.to(this.svg, { opacity: 0, duration: 0.8, ease: 'power2.inOut' }, 5.7);
    tl.set(this.root, { pointerEvents: 'none' }, 4.7);

    if (window.__giPauseForTest) tl.pause();   // harmless seam: lets the verifier scrub
  }

  /* FLIP: morph the centred neon TN to the dashboard map's exact box (same viewBox +
   * same paths => the shape lands precisely on the real map). */
  // The dashboard map's content box (border box minus padding) in viewport coords.
  _mapContentBox() {
    const t = document.getElementById('tn-map') || document.querySelector('.svg-stage');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    if (!r.width) return null;
    const cs = getComputedStyle(t);
    const pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
    const pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
    return { left: r.left + pl, top: r.top + pt, width: r.width - pl - pr, height: r.height - pt - pb };
  }

  // Pin the neon SVG to the map box (its identity/rest state), then translate+uniformly
  // scale it so it APPEARS centred on screen over the globe's TN. The FLIP later just
  // animates the transform back to identity -> lands exactly on the map, never warps.
  _placeNeon() {
    const box = this._mapContentBox();
    if (!box) return;                       // no map yet -> stays CSS-centred (graceful)
    gsap.set(this.svg, {
      position: 'fixed', margin: 0, right: 'auto', bottom: 'auto',
      left: box.left, top: box.top, width: box.width, height: box.height,
      transformOrigin: '50% 50%',
    });
    const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    const scx = window.innerWidth / 2, scy = window.innerHeight / 2;   // where the globe's TN sat
    gsap.set(this.svg, { x: scx - cx, y: scy - cy, scale: 1.32 });
  }

  _cleanup() {
    if (this.done) return;
    this.done = true;
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('resize', this._onResize);
    try { this.renderer && this.renderer.dispose(); } catch {}
    this.root.remove();
  }
}

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

function boot() {
  if (window.__gridIntroActive) return;
  if (document.body.dataset.view !== 'status') return;
  if (document.body.dataset.intro !== '1') return;     // only the first load after login
  if (!gsap || !webglOK()) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  window.__gridIntroActive = true;
  new GridIntro().run();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
