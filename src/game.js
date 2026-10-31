import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';

const Q = new URLSearchParams(location.search);
const GOD = Q.has('god');
const IS_MOBILE = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const LANES = [-2.2, 0, 2.2];
const OUTLINE = [0x3a / 255, 0x1d / 255, 0x08 / 255];
const WALL_X = 5.1;

// ---------- Renderer ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let pixelRatio = Math.min(devicePixelRatio, IS_MOBILE ? 1.5 : 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const outline = new OutlineEffect(renderer, { defaultThickness: 0.0045, defaultColor: OUTLINE, defaultAlpha: 1 });
let useOutline = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffd9a0);
scene.fog = new THREE.Fog(0xffd9a0, 60, 230);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 900);
camera.position.set(0, 4.2, 7.5);

// ---------- Textures ----------
const loader = new THREE.TextureLoader();
const aniso = renderer.capabilities.getMaxAnisotropy();
const SPR_NAMES = ['run0', 'run1', 'run2', 'jump', 'slide', 'drop', 'star', 'boots', 'hardhat', 'shield', 'magnet', 'barrel', 'hoses', 'pumpjack', 'dryer', 'barricade', 'mesquite', 'tank', 'derrick', 'longhorn', 'fence', 'refinery'];
const NAMES_ALL = ['tex_road.jpg', ...SPR_NAMES.map(n => n + '.png')];
const CACHE = {};
await Promise.all(NAMES_ALL.map(async n => { CACHE[n] = await loader.loadAsync('assets/' + n); }));
function load(name, rx = 1, ry = 1) {
  const t = CACHE[name]; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (rx !== 1 || ry !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); }
  return t;
}
function makeCanvas(size, draw, h) { const c = document.createElement('canvas'); c.width = size; c.height = h || size; draw(c.getContext('2d'), size, h || size); return c; }
const TX = { ground: load('tex_road.jpg', 2, 60) };
const SPR = {}; for (const n of SPR_NAMES) SPR[n] = load(n + '.png');

// Toon gradient (soft 3-band painted shading)
const grad = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
const toon = (o) => new THREE.MeshToonMaterial({ gradientMap: grad, ...o });
const noOutline = m => { m.userData.outlineParameters = { visible: false }; return m; };

// ---------- Materials ----------
const M = {
  steel: toon({ color: 0xb8c4c8 }), teal: toon({ color: 0x2f9a9c }), yellow: toon({ color: 0xffc83a }), red: toon({ color: 0xd8442c }),
  dark: toon({ color: 0x3a2a22 }), wood: toon({ color: 0xb57a44 }), darkWood: toon({ color: 0x6b4a2e }), white: toon({ color: 0xfff4dc }),
  ground: toon({ map: TX.ground }), grass: toon({ color: 0xd7b765 }), shoulder: toon({ color: 0xc99a58 }),
  win: noOutline(new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true, opacity: 0 })),
  wire: new THREE.LineBasicMaterial({ color: 0x3a1d08 }),
};
const SPRITE_MATS = [];
function spriteMat(tex) { const m = noOutline(new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, fog: true, toneMapped: false })); SPRITE_MATS.push(m); return m; }
const planeG = new THREE.PlaneGeometry(1, 1); planeG.translate(0, 0.5, 0);
const planeC = new THREE.PlaneGeometry(1, 1);
const billboards = [];
function billboard(name, h, parent, x = 0, z = 0, center = false) {
  const m = new THREE.Mesh(center ? planeC : planeG, spriteMat(SPR[name])); m.castShadow = true;
  const img = SPR[name].image; const asp = img && img.width ? img.width / img.height : 0.75;
  m.scale.set(h * asp, h, 1); m.userData.h = h; m.position.set(x, 0, z);
  billboards.push(m); if (parent) parent.add(m); return m;
}
const aspect = n => { const i = SPR[n].image; return i && i.width ? i.width / i.height : 1; };

// ---------- Lighting ----------
const sunDir = new THREE.Vector3(-0.55, 0.6, 0.3).normalize();
const hemi = new THREE.HemisphereLight(0xfff6dc, 0xd9a86a, 1.5); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d0, 2.0);
sun.castShadow = true;
sun.shadow.mapSize.set(IS_MOBILE ? 1024 : 2048, IS_MOBILE ? 1024 : 2048);
const sc = sun.shadow.camera; sc.left = -18; sc.right = 18; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 140;
sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
scene.add(sun, sun.target);
sun.target.position.set(0, 0, -20); sun.position.copy(sun.target.position).addScaledVector(sunDir, 60);
const lampLight = new THREE.PointLight(0xffc070, 0, 16, 1.6); lampLight.position.set(0, 4.5, -3); scene.add(lampLight);

// ---------- Sky (day/night) ----------
const skyU = { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() } };
const skyMat = noOutline(new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h=vP.y; vec3 c=mix(bot, top, smoothstep(-0.02,.5,h)); gl_FragColor=vec4(c,1.); }` }));
const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 12), skyMat); sky.renderOrder = -3; scene.add(sky);
// stars
const ST = 500, stPos = new Float32Array(ST * 3);
for (let i = 0; i < ST; i++) { const th = Math.random() * Math.PI * 2, y = rand(0.08, 1); const r = Math.sqrt(1 - y * y); stPos[i * 3] = Math.cos(th) * r * 650; stPos[i * 3 + 1] = y * 650; stPos[i * 3 + 2] = Math.sin(th) * r * 650; }
const stGeo = new THREE.BufferGeometry(); stGeo.setAttribute('position', new THREE.BufferAttribute(stPos, 3));
let _glow; function glowTex() { if (_glow) return _glow; const c = makeCanvas(64, (g, s) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }); _glow = new THREE.CanvasTexture(c); return _glow; }
const stars = new THREE.Points(stGeo, new THREE.PointsMaterial({ map: glowTex(), color: 0xfff8d0, size: 9, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
stars.renderOrder = -2; sky.add(stars);
const moonTex = new THREE.CanvasTexture(makeCanvas(256, (g, s) => {
  const gr = g.createRadialGradient(128, 128, 40, 128, 128, 128); gr.addColorStop(0, 'rgba(255,248,208,.55)'); gr.addColorStop(1, 'rgba(255,248,208,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
  g.fillStyle = '#fff6b0'; g.strokeStyle = '#6b4a2e'; g.lineWidth = 5; g.beginPath(); g.arc(128, 128, 46, 0, 7); g.fill(); g.stroke();
  g.fillStyle = 'rgba(233,201,126,.6)'; for (const [x, y, r] of [[112, 116, 9], [140, 140, 7], [124, 150, 5], [146, 112, 5]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
})); moonTex.colorSpace = THREE.SRGBColorSpace;
const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, opacity: 0, depthWrite: false, fog: false }));
moon.scale.setScalar(110); moon.position.set(90, 190, -560); moon.renderOrder = -2; sky.add(moon);
const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xfff0b0, transparent: true, opacity: 0.9, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
sunDisc.scale.setScalar(160); sunDisc.position.set(-330, 200, -480); sunDisc.renderOrder = -2; sky.add(sunDisc);
// Refinery skyline on the horizon (always ahead), with lights that come on at dusk
const skylineMat = noOutline(new THREE.MeshBasicMaterial({ map: SPR.refinery, transparent: true, alphaTest: 0.5, fog: false, depthWrite: false }));
const SKW = 420, SKH = SKW / aspect('refinery');
const skyline = new THREE.Mesh(new THREE.PlaneGeometry(SKW, SKH), skylineMat);
skyline.position.set(0, SKH / 2 - 4, -380); skyline.renderOrder = -1; scene.add(skyline);
const skyGlows = [];
for (let i = 0; i < 26; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: pick([0xffd070, 0xffb050, 0xfff0a0]), transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); s.position.set(rand(-SKW * 0.42, SKW * 0.42), rand(4, SKH * 0.55), -378); s.scale.setScalar(rand(5, 9)); s.renderOrder = -1; s.userData.ph = Math.random() * 6; scene.add(s); skyGlows.push(s); }
const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff9a40, transparent: true, opacity: 0.6, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
flare.position.set(SKW * 0.08, SKH * 0.62, -377); flare.scale.setScalar(22); flare.renderOrder = -1; scene.add(flare);
const prairieFar = new THREE.Mesh(new THREE.PlaneGeometry(1200, 200), noOutline(new THREE.MeshBasicMaterial({ color: 0xd2ad5e, fog: true })));
prairieFar.rotation.x = -Math.PI / 2; prairieFar.position.set(0, -0.05, -300); scene.add(prairieFar);

// ---------- Ground ----------
const ground = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 300), M.ground);
ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -130); ground.receiveShadow = true; scene.add(ground);
const sideGround = new THREE.Mesh(new THREE.PlaneGeometry(400, 600), M.grass); sideGround.receiveShadow = true;
sideGround.rotation.x = -Math.PI / 2; sideGround.position.set(0, -0.02, -200); scene.add(sideGround);
for (const s of [-1, 1]) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 300), M.shoulder); g.position.set(s * (WALL_X - 0.1), 0.07, -130); g.receiveShadow = true; scene.add(g); }
// lane stripes (painted, scroll with the road)
const stripeTex = new THREE.CanvasTexture(makeCanvas(64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(255,246,200,.85)'; g.fillRect(24, 0, 16, h * 0.55); }, 256)); stripeTex.wrapS = stripeTex.wrapT = THREE.RepeatWrapping; stripeTex.repeat.set(1, 40);
for (const sx of [-1.1, 1.1]) { const st = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 300), noOutline(new THREE.MeshBasicMaterial({ map: stripeTex, transparent: true, depthWrite: false }))); st.rotation.x = -Math.PI / 2; st.position.set(sx, 0.012, -130); scene.add(st); }

// ---------- Helpers ----------
function mesh(geo, mat, x = 0, y = 0, z = 0, parent, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  if (parent) parent.add(m); return m;
}
function rbox(w, h, d, r = 0.12) {
  const sh = new THREE.Shape(); const x = -w / 2, y = -h / 2; r = Math.min(r, w / 2, h / 2);
  sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h); sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.01, d - 2 * r), bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -(d - 2 * r) / 2); return g;
}
function boxM(w, h, d, mat, x, y, z, p, sh = true, r) { return mesh(rbox(w, h, d, r ?? Math.min(0.15, Math.min(w, h, d) * 0.25)), mat, x, y, z, p, sh); }
const glows = []; // additive glow sprites that fade in at night
function glowAt(parent, x, y, z, color, size) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); s.position.set(x, y, z); s.scale.setScalar(size); parent.add(s); glows.push(s); return s; }

// ---------- Oilfield decor: mesquite, tanks, derricks, pumpjacks, fences, poles, billboards ----------
const SEG_LEN = 14, SEG_N = 16;
const signTexCache = {};
function signTex(line1, line2) {
  const key = line1 + '|' + line2; if (signTexCache[key]) return signTexCache[key];
  const c = makeCanvas(512, (g, w, h) => {
    g.fillStyle = '#fff4cf'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f8a8c'; g.fillRect(0, 0, w, 26); g.fillRect(0, h - 26, w, 26);
    g.strokeStyle = '#3a1d08'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    let f1 = 78; for (; f1 > 30; f1 -= 2) { g.font = `900 ${f1}px "Arial Rounded MT Bold","Trebuchet MS",sans-serif`; if (g.measureText(line1).width < w - 70) break; }
    g.lineWidth = 12; g.strokeStyle = '#3a1d08'; g.strokeText(line1, w / 2, h * 0.42); g.fillStyle = '#ff6040'; g.fillText(line1, w / 2, h * 0.42);
    for (let f2 = 40; f2 > 20; f2 -= 2) { g.font = `800 ${f2}px "Arial Rounded MT Bold","Trebuchet MS",sans-serif`; if (g.measureText(line2).width < w - 70) break; } g.fillStyle = '#6b4a2e'; g.fillText(line2, w / 2, h * 0.74);
  }, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return (signTexCache[key] = t);
}
const SIGN_TEXTS = [['DRYAIRE', 'CLEAN DRY AIR'], ['BEAUMONT TX', 'RENTALS 24/7'], ['DRYAIRE', '1-855-4-DRYAIR'], ['TWR SERIES', 'DRYERS READY'], ['HOWDY!', 'KEEP ON RUNNIN\'']];
function billboardSign(g, side, z) {
  const sg = new THREE.Group(); sg.position.set(side * (WALL_X + 3.2), 0, z); sg.rotation.y = -side * 0.35; g.add(sg);
  for (const dx of [-1.3, 1.3]) boxM(0.22, 3.2, 0.22, M.darkWood, dx, 1.6, -0.22, sg, true, 0.05); // posts sit BEHIND the board face
  mesh(new THREE.BoxGeometry(3.6, 1.8, 0.16), [M.wood, M.wood, M.wood, M.wood, toon({ map: signTex(...pick(SIGN_TEXTS)) }), M.wood], 0, 3.4, 0, sg);
  g.userData.board = sg; return sg;
}
function pole(g, side, z) { const x = side * (WALL_X + 1.4); const pg = new THREE.Group(); pg.position.z = z; g.add(pg); g = pg; z = 0; boxM(0.22, 7, 0.22, M.darkWood, x, 3.5, z, g, true, 0.04); boxM(1.8, 0.16, 0.16, M.darkWood, x, 6.6, z, g, true, 0.04); return pg; }
function buildDecor(side, kind) {
  const g = new THREE.Group();
  const far = side * (WALL_X + rand(5, 9));
  if (kind === 'mesquite') { billboard('mesquite', rand(5, 6.5), g, side * (WALL_X + 2.6), rand(-4, 4)); billboard('mesquite', rand(4, 5), g, far + side * 4, rand(-5, 5)); }
  if (kind === 'tank') { billboard('tank', rand(5.5, 7), g, side * (WALL_X + 6.5), rand(-3, 3)); billboard('tank', 4.6, g, side * (WALL_X + 11), rand(-5, -2)); }
  if (kind === 'derrick') { const z = rand(-3, 3); billboard('derrick', rand(8.1, 9.9), g, side * (WALL_X + 5), z); glowAt(g, side * (WALL_X + 5), 8.6, z + 0.1, 0xffd070, 2.2); }
  if (kind === 'pumpjack') { const b = billboard('pumpjack', rand(3.6, 4.4), g, side * (WALL_X + 4), rand(-3, 3)); b.userData.nod = true; billboard('pumpjack', 3.2, g, far + side * 3, rand(-5, 5)).userData.nod = true; }
  if (kind === 'longhorn') { billboard('longhorn', 1.9, g, side * (WALL_X + 3.4), rand(-3, 3)); billboard('fence', 1.5, g, side * (WALL_X + 1.6), rand(-4, 4)); }
  if (kind === 'fence') { for (const z of [-5, -0.5, 4]) billboard('fence', 1.5, g, side * (WALL_X + 1.6), z); }
  if (kind === 'sign') billboardSign(g, side, rand(-0.8, 0.8));
  return g;
}
const segments = [];
const decorRoot = new THREE.Group(); scene.add(decorRoot);
const KINDS = ['none', 'mesquite', 'tank', 'derrick', 'pumpjack', 'longhorn', 'fence', 'sign'];
// zone weights: which decor shows up most in each stretch of the run
const ZONES = [
  { name: 'Ranch Road', w: { mesquite: 4, longhorn: 3, fence: 3, sign: 1, pumpjack: 1, none: 1 } },
  { name: 'Pumpjack Flats', w: { pumpjack: 5, mesquite: 2, derrick: 2, sign: 1, fence: 1 } },
  { name: 'Tank Farm', w: { tank: 5, pumpjack: 1, sign: 2, mesquite: 1, derrick: 1 } },
  { name: 'Refinery Row', w: { tank: 3, derrick: 3, sign: 2, pumpjack: 2 } },
];
let zoneIdx = 0;
function pickKind() { const w = ZONES[zoneIdx].w; let tot = 0; for (const k in w) tot += w[k]; let r = Math.random() * tot; for (const k in w) { r -= w[k]; if (r <= 0) return k; } return 'none'; }
const nodders = [];
for (let i = 0; i < SEG_N; i++) {
  const seg = { g: new THREE.Group(), L: {}, R: {} };
  for (const [obj, s] of [[seg.L, -1], [seg.R, 1]]) { for (const k of KINDS) { obj[k] = buildDecor(s, k); seg.g.add(obj[k]); } obj.pole = pole(seg.g, s, rand(-5.5, 5.5)); }
  seg.g.position.z = 10 - i * SEG_LEN;
  randomizeSeg(seg); decorRoot.add(seg.g); segments.push(seg);
}
fixPoles();
for (const b of billboards) if (b.userData.nod) nodders.push(b);
// sagging telephone wires between poles (one continuous line per side)
for (const s of [-1, 1]) {
  const pts = []; for (let i = 0; i <= SEG_N * 8; i++) { const z = 10 - i * (SEG_LEN / 8); pts.push(new THREE.Vector3(s * (WALL_X + 1.4) + 0.7, 6.5, z)); }
  const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), M.wire); ln.userData.wire = true; scene.add(ln);
}
function randomizeSeg(seg) {
  const a = pickKind(), b = pickKind();
  for (const k of KINDS) { seg.L[k].visible = k === a; seg.R[k].visible = k === b; }
  fixPoles();
}
// prop spacing: a telephone pole may never stand inside a billboard's footprint or in front of it
// from the camera's view (poles sit nearer the road, so any pole up to ~30 units nearer can cover the board)
function fixPoles() {
  for (const seg of segments) for (const side of ['L', 'R']) {
    const pz = seg.g.position.z + seg[side].pole.position.z; let ok = true;
    for (const o of segments) { if (!o[side].sign.visible) continue; const d = pz - (o.g.position.z + o[side].sign.userData.board.position.z); if (d > -3 && d < 32) { ok = false; break; } }
    seg[side].pole.visible = ok;
  }
}

// ---------- Player (painted cut-out sprite, seen from behind) ----------
const HERO = { run: 2.05, jump: 2.15, slide: 1.25 };
const player = new THREE.Group(); scene.add(player);
const P = {};
(function buildPlayer() {
  P.body = new THREE.Group(); player.add(P.body);
  P.sprite = new THREE.Mesh(planeG, spriteMat(SPR.run0)); P.sprite.castShadow = true; P.body.add(P.sprite);
  P.setFrame = (pose) => { const t = SPR[pose]; if (P.sprite.material.map !== t) { P.sprite.material.map = t; P.sprite.material.needsUpdate = true; }
    const h = HERO[pose.startsWith('run') ? 'run' : pose]; P.sprite.scale.set(h * aspect(pose), h, 1); };
  P.shield = new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 16), noOutline(new THREE.MeshBasicMaterial({ color: 0x5fd8e0, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })));
  P.shield.position.y = 0.95; P.shield.visible = false; player.add(P.shield);
  P.magRing = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.06, 6, 40), noOutline(new THREE.MeshBasicMaterial({ color: 0xb06ee8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending })));
  P.magRing.rotation.x = Math.PI / 2; P.magRing.position.y = 0.1; P.magRing.visible = false; player.add(P.magRing);
  P.blob = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), noOutline(new THREE.MeshBasicMaterial({ color: 0x3a1d08, transparent: true, opacity: 0.28, depthWrite: false })));
  P.blob.rotation.x = -Math.PI / 2; P.blob.position.y = 0.03; scene.add(P.blob);
  P.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd060, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  P.halo.position.set(0, 1.0, -0.15); P.halo.scale.set(3.2, 2.8, 1); player.add(P.halo);
})();

// ---------- Obstacles ----------
// Jump physics: apex = JUMP_V^2 / (2*GRAV). Every jump-type obstacle top (y1) is checked against it at startup.
const BASE_SPEED = 15, MAX_SPEED = 36, GRAV = 40, JUMP_V = 13.2, BOOT_V = 17.6;
const JUMP_APEX = JUMP_V * JUMP_V / (2 * GRAV); // 2.178
function spriteOb(name, h, box, extra = {}) {
  const g = new THREE.Group(); const b = billboard(name, h, g);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(1, 20), P.blob.material); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; sh.scale.set(box.hw * 1.1, box.hd * 0.9 + 0.3, 1); g.add(sh);
  g.userData.spr = b; return { g, box, ...extra };
}
const CRASH = { barrel: 'Spill!', rollbarrel: 'Spill!', hoses: 'Tripped!', barricade: 'Whoa Nelly!', dryer: 'Tanked!', pumpjack: 'Clobbered!', derrick: 'Timber!', piperack: 'Bonked!' };
const mkBarrel = () => spriteOb('barrel', 1.25, { hw: 0.5, hd: 0.6, y0: 0, y1: 1.1 }, { jump: true });
const mkRoll = () => spriteOb('barrel', 1.25, { hw: 0.5, hd: 0.6, y0: 0, y1: 1.1 }, { jump: true, moving: true });
const mkHoses = () => spriteOb('hoses', 0.75, { hw: 0.85, hd: 0.6, y0: 0, y1: 0.7 }, { jump: true });
const mkBarricade = () => spriteOb('barricade', 1.15, { hw: 0.9, hd: 0.6, y0: 0, y1: 1.05 }, { jump: true });
const mkDryer = () => spriteOb('dryer', 2.7, { hw: 0.95, hd: 0.7, y0: 0, y1: 2.6 }, { boots: true });
const mkJack = () => spriteOb('pumpjack', 3.2, { hw: 0.95, hd: 0.7, y0: 0, y1: 3.1 }, { nod: true });
const mkDerrick = () => spriteOb('derrick', 6.75, { hw: 0.81, hd: 0.63, y0: 0, y1: 6.66 });
const PIPE_MATS = [toon({ color: 0x2f9a9c }), toon({ color: 0xffc83a }), toon({ color: 0xb8c4c8 })];
const hazardTex = new THREE.CanvasTexture(makeCanvas(128, (g, w, h) => { g.fillStyle = '#ffc83a'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a1d08'; for (let x = -h; x < w; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.fill(); } }, 32));
hazardTex.wrapS = THREE.RepeatWrapping; hazardTex.repeat.set(8, 1); hazardTex.colorSpace = THREE.SRGBColorSpace;
function mkPipeRack() { // full-width overhead pipe rack -> slide under it
  const g = new THREE.Group();
  for (const s of [-1, 1]) { boxM(0.3, 3.6, 0.3, M.steel, s * (WALL_X - 0.3), 1.8, 0, g, true, 0.06); boxM(0.6, 0.12, 0.6, M.dark, s * (WALL_X - 0.3), 0.06, 0, g, true, 0.03); }
  const pg = new THREE.CylinderGeometry(0.2, 0.2, 2 * WALL_X - 0.2, 14); pg.rotateZ(Math.PI / 2);
  mesh(pg, PIPE_MATS[0], 0, 1.62, 0.12, g); mesh(pg, PIPE_MATS[2], 0, 1.98, -0.18, g); mesh(pg, PIPE_MATS[1], 0, 2.34, 0.08, g);
  mesh(new THREE.BoxGeometry(2 * WALL_X - 0.2, 0.28, 0.12), toon({ map: hazardTex }), 0, 1.36, 0.36, g);
  for (const x of [-3, 0, 3]) { const fl = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 14), M.dark, x, 1.62, 0.12, g); fl.rotation.z = Math.PI / 2; }
  const v = mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 16), toon({ color: 0xd8442c }), 1.6, 2.68, 0.08, g); v.rotation.x = Math.PI / 2;
  return { g, box: { hw: 5, hd: 0.45, y0: 1.2, y1: 3.0 }, wide: true, slide: true };
}
const OB_TYPES = { barrel: mkBarrel, rollbarrel: mkRoll, hoses: mkHoses, barricade: mkBarricade, dryer: mkDryer, pumpjack: mkJack, derrick: mkDerrick, piperack: mkPipeRack };
// numeric jump check: obstacle top must be well below apex AND clearable at the slowest speed with the time spent above it
{
  const pDepth = 0.7;
  for (const k in OB_TYPES) {
    const o = OB_TYPES[k](); if (!o.jump) continue; const y1 = o.box.y1;
    const disc = JUMP_V * JUMP_V - 2 * GRAV * y1; const tAbove = disc > 0 ? 2 * Math.sqrt(disc) / GRAV : 0;
    const need = (2 * o.box.hd + pDepth) / (BASE_SPEED);
    const ok = y1 < JUMP_APEX - 0.6 && tAbove > need * 1.5;
    console.info(`[jumpcheck] ${k}: top ${y1.toFixed(2)} apex ${JUMP_APEX.toFixed(2)} airtime-above ${tAbove.toFixed(3)}s need ${need.toFixed(3)}s ${ok ? 'OK' : 'TOO TALL'}`);
    if (!ok) console.error('[jumpcheck] obstacle not jumpable:', k);
    o.g.traverse(m => { if (m.isMesh) { const i = billboards.indexOf(m); if (i >= 0) billboards.splice(i, 1); } });
  }
  const bootApex = BOOT_V * BOOT_V / (2 * GRAV);
  for (const k in OB_TYPES) { const o = OB_TYPES[k](); if (o.boots) console.info(`[jumpcheck] ${k} (Boot Scoot only): top ${o.box.y1} boot apex ${bootApex.toFixed(2)} ${o.box.y1 < bootApex - 0.6 ? 'OK' : 'TOO TALL'}`); o.g.traverse(m => { const i = billboards.indexOf(m); if (i >= 0) billboards.splice(i, 1); }); }
}
const obPool = {}, obstacles = [];
for (const k in OB_TYPES) { obPool[k] = []; for (let i = 0; i < 5; i++) { const o = OB_TYPES[k](); o.type = k; o.g.visible = false; scene.add(o.g); obPool[k].push(o); } }
function spawnOb(type, lane, z) {
  const o = obPool[type].pop() || Object.assign(OB_TYPES[type](), { type });
  if (!o.g.parent) scene.add(o.g);
  o.lane = lane; o.x = o.wide ? 0 : LANES[lane]; o.z = z; o.pz = z; o.hitFx = 0; o.passed = false; o.g.visible = true; o.g.position.set(o.x, 0, z); obstacles.push(o); return o;
}

// ---------- Collectibles ----------
const PCOL = { hardhat: 0xffb030, shield: 0x5fd8e0, magnet: 0xb06ee8, boots: 0xffe066 };
const ISZ = { drop: 0.8, star: 1.0, hardhat: 1.15, shield: 1.15, magnet: 1.1, boots: 1.15 };
function mkItem(kind) {
  const g = new THREE.Group();
  if (kind !== 'drop') { const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: PCOL[kind] || 0xff6040, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 })); glow.scale.setScalar(kind in PCOL ? 2.4 : 1.9); g.add(glow); }
  const b = billboard(kind, ISZ[kind], g, 0, 0, true); b.castShadow = false;
  g.userData.spr = b; return { g, kind };
}
const items = [];
const itemPool = { drop: [], star: [], hardhat: [], shield: [], magnet: [], boots: [] };
for (let i = 0; i < 90; i++) { const c = mkItem('drop'); c.g.visible = false; scene.add(c.g); itemPool.drop.push(c); }
function spawnItem(kind, x, y, z) {
  const it = itemPool[kind].pop() || mkItem(kind); it.kind = kind;
  if (!it.g.parent) scene.add(it.g);
  it.x = x; it.y = y; it.z = z; it.g.visible = true; it.g.position.set(x, y, z); it.phase = Math.random() * 6; it.mag = false; items.push(it); return it;
}
// ---------- Particles ----------
const PMAX = 600;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), pSize = new Float32Array(PMAX);
const pVel = new Float32Array(PMAX * 3), pLife = new Float32Array(PMAX), pMaxLife = new Float32Array(PMAX), pBase = new Float32Array(PMAX);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3)); pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
const pMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
  uniforms: { map: { value: glowTex() } },
  vertexShader: `attribute float size; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = size * 300. / -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `uniform sampler2D map; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC*t.a, t.a); }`
});
const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; scene.add(points);
let pIdx = 0;
function emit(x, y, z, n, color, speed = 4, size = 0.35, life = 0.7, up = 2) {
  const c = new THREE.Color(color);
  for (let k = 0; k < n; k++) {
    const i = pIdx = (pIdx + 1) % PMAX;
    pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
    const th = Math.random() * 6.28, ph = Math.random() * 3.14, s = speed * rand(0.4, 1);
    pVel[i * 3] = Math.cos(th) * Math.sin(ph) * s; pVel[i * 3 + 1] = Math.cos(ph) * s + up; pVel[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * s;
    pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
    pLife[i] = pMaxLife[i] = life * rand(0.6, 1.2); pBase[i] = size * rand(0.6, 1.3);
  }
}
function updateParticles(dt, worldDz) {
  for (let i = 0; i < PMAX; i++) {
    if (pLife[i] <= 0) { pSize[i] = 0; continue; }
    pLife[i] -= dt; pVel[i * 3 + 1] -= 6 * dt;
    pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt + worldDz;
    pSize[i] = pBase[i] * Math.max(0, pLife[i] / pMaxLife[i]);
  }
  pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = pGeo.attributes.size.needsUpdate = true;
}
// fireflies / dust motes (dust by day, fireflies at night)
const DM = 140; const dGeo = new THREE.BufferGeometry(); const dPos = new Float32Array(DM * 3);
for (let i = 0; i < DM; i++) { dPos[i * 3] = rand(-5, 5); dPos[i * 3 + 1] = rand(0.5, 7); dPos[i * 3 + 2] = rand(-80, 10); }
dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({ map: glowTex(), color: 0xffd9a0, size: 0.14, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
dust.frustumCulled = false; scene.add(dust);

// ---------- Golden hour -> dusk -> starry night -> sunrise ----------
const KEYS = [
  { t: 0.00, top: 0x7fb8e8, bot: 0xffe2a8, fog: 0xffdca8, hs: 0xfff0d0, hg: 0xb08a50, hi: 1.45, sc: 0xffe0b0, si: 2.0, tint: 0xffffff, sky: 0xffffff, night: 0 },
  { t: 0.30, top: 0x8aa8e0, bot: 0xffc880, fog: 0xffcf98, hs: 0xffe4b8, hg: 0xa8804a, hi: 1.4, sc: 0xffc070, si: 2.0, tint: 0xfff0dc, sky: 0xfff0e0, night: 0.05 },
  { t: 0.45, top: 0x7a6ab8, bot: 0xff9a60, fog: 0xffa878, hs: 0xffc898, hg: 0x8a6048, hi: 1.25, sc: 0xff9a50, si: 1.8, tint: 0xffdcc0, sky: 0xffc8a8, night: 0.3 },
  { t: 0.60, top: 0x2a2a60, bot: 0x8a5a8a, fog: 0x6a5078, hs: 0xa8a8e0, hg: 0x504060, hi: 1.05, sc: 0xb0b8ff, si: 0.9, tint: 0xc8c4f0, sky: 0x7c7cb0, night: 0.9 },
  { t: 0.78, top: 0x2a2a60, bot: 0x8a5a8a, fog: 0x6a5078, hs: 0xa8a8e0, hg: 0x504060, hi: 1.05, sc: 0xb0b8ff, si: 0.9, tint: 0xc8c4f0, sky: 0x7c7cb0, night: 0.9 },
  { t: 0.90, top: 0x8a90d0, bot: 0xffb888, fog: 0xffc0a0, hs: 0xffd8b8, hg: 0x9a7a58, hi: 1.3, sc: 0xffb080, si: 1.7, tint: 0xffe8d8, sky: 0xffd8c8, night: 0.2 },
  { t: 1.00, top: 0x7fb8e8, bot: 0xffe2a8, fog: 0xffdca8, hs: 0xfff0d0, hg: 0xb08a50, hi: 1.45, sc: 0xffe0b0, si: 2.0, tint: 0xffffff, sky: 0xffffff, night: 0 },
];
for (const k of KEYS) for (const p of ['top', 'bot', 'fog', 'hs', 'hg', 'sc', 'tint', 'sky']) k[p] = new THREE.Color(k[p]);
const CYCLE_SECS = 180; let timeOfDay = Q.has('t') ? +Q.get('t') : 0.12; const ENV = { night: 0 };
const _c = new THREE.Color(), _tint = new THREE.Color(), _white = new THREE.Color(1, 1, 1);
function applyTime(t) {
  t = ((t % 1) + 1) % 1; let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
  const a = KEYS[i], b = KEYS[i + 1]; let f = (t - a.t) / (b.t - a.t); f = f * f * (3 - 2 * f);
  const L = p => _c.copy(a[p]).lerp(b[p], f);
  skyU.top.value.copy(L('top')); skyU.bot.value.copy(L('bot'));
  scene.fog.color.copy(L('fog')); scene.background.copy(scene.fog.color);
  hemi.color.copy(L('hs')); hemi.groundColor.copy(L('hg')); hemi.intensity = a.hi + (b.hi - a.hi) * f;
  sun.color.copy(L('sc')); sun.intensity = a.si + (b.si - a.si) * f;
  const n = ENV.night = a.night + (b.night - a.night) * f;
  _tint.copy(L('tint')); for (const m of SPRITE_MATS) m.color.copy(_tint);
  P.sprite.material.color.copy(_tint).lerp(_white, 0.6);
  skylineMat.color.copy(L('sky'));
  stars.material.opacity = Math.max(0, n * 1.2 - 0.2); moon.material.opacity = Math.max(0, n * 1.3 - 0.3);
  sunDisc.material.opacity = (1 - n) * 0.95; sunDisc.position.y = 120 - 300 * n; sunDisc.material.color.copy(L('sc'));
  const glowN = Math.max(0, Math.min(1, (n - 0.1) / 0.5));
  for (const g of glows) g.material.opacity = glowN * 0.85;
  ENV.glowN = glowN;
  dust.material.color.set(n > 0.5 ? 0xfff07a : 0xffd9a0); dust.material.size = n > 0.5 ? 0.2 : 0.14;
  scene.fog.near = 60 - 25 * n; scene.fog.far = 230 - 70 * n;
}
sunDisc.position.set(-60, 120, -560); sunDisc.scale.setScalar(200);

// ---------- Audio (synthesized; 120 Hz high-pass, nothing below ~130 Hz, no drones) ----------
const Sfx = {
  ctx: null, master: null, muted: localStorage.getItem('tor_muted') === '1', musicT: null, live: 0, feverOn: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.6;
    this.hp = this.ctx.createBiquadFilter(); this.hp.type = 'highpass'; this.hp.frequency.value = 120; this.hp.Q.value = 0.7;
    this.comp = this.ctx.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 3;
    this.master.connect(this.hp); this.hp.connect(this.comp); this.comp.connect(this.ctx.destination);
    this.music = this.ctx.createGain(); this.music.gain.value = 0.3; this.music.connect(this.master);
    const len = this.ctx.sampleRate; this.noise = this.ctx.createBuffer(1, len, len); const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },
  _track(node, ...chain) { this.live++; node.onended = () => { this.live--; node.disconnect(); chain.forEach(n => n.disconnect()); }; },
  tone(f, dur, type = 'sine', vol = 0.2, f2, delay = 0, dest) {
    if (!this.ctx) return; const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    o.connect(g); g.connect(dest || this.master); o.start(t); o.stop(t + dur + 0.04); this._track(o, g);
  },
  pluck(f, t, vol = 0.12, dur = 0.5, type = 'triangle') {
    const c = this.ctx, o1 = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
    o1.type = type; o1.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(9000, f * 8), t); lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 1.6), t + dur * 0.7); lp.Q.value = 2;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    o1.connect(lp); lp.connect(g); g.connect(this.music); o1.start(t); o1.stop(t + dur + 0.05); this._track(o1, lp, g);
  },
  fiddle(f, t, dur, vol = 0.035) { // bowed saw with delayed vibrato and a soft attack (short notes, no sustain pad)
    const c = this.ctx, o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), lp = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; lfo.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.6);
    lfo.connect(lg); lg.connect(o.frequency);
    lp.type = 'lowpass'; lp.frequency.value = Math.min(6000, f * 5); lp.Q.value = 1.5;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.04); g.gain.setValueAtTime(vol * 0.85, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    o.connect(lp); lp.connect(g); g.connect(this.music); o.start(t); lfo.start(t); o.stop(t + dur + 0.12); lfo.stop(t + dur + 0.12); this._track(o, lp, g, lg); this._track(lfo);
  },
  drum(t, f, q, vol, dur) {
    const c = this.ctx, s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(this.music); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02); this._track(s, bp, g);
  },
  noiseHit(dur, f, vol = 0.3, type = 'lowpass', f2, delay = 0) {
    if (!this.ctx) return; const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; const fl = this.ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + 0.02); this._track(s, fl, g);
  },
  moo(delay = 0) { // friendly longhorn "moo": nasal saw through a sliding formant, pitched above the high-pass
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), f1 = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(190, t); o.frequency.linearRampToValueAtTime(240, t + 0.25); o.frequency.linearRampToValueAtTime(170, t + 0.75);
    f1.type = 'bandpass'; f1.frequency.setValueAtTime(500, t); f1.frequency.linearRampToValueAtTime(900, t + 0.35); f1.frequency.linearRampToValueAtTime(600, t + 0.75); f1.Q.value = 4;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t + 0.08); g.gain.setValueAtTime(0.28, t + 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    o.connect(f1); f1.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.85); this._track(o, f1, g);
  },
  whoosh(delay = 0) { this.noiseHit(0.22, 900, 0.16, 'bandpass', 3200, delay); this.tone(392, 0.18, 'triangle', 0.07, 784, delay); },
  coin(n = 0) { const k = Math.pow(2, Math.min(n, 12) / 24); this.tone(1046 * k, 0.07, 'sine', 0.1); this.tone(1568 * k, 0.16, 'sine', 0.08, null, 0.045); this.noiseHit(0.04, 5000, 0.04, 'highpass'); },
  star() { [1318, 1760, 2093].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.09, null, i * 0.05)); this.noiseHit(0.25, 6000, 0.05, 'highpass'); },
  jump(big) { this.whoosh(); if (big) this.tone(523, 0.35, 'triangle', 0.08, 1568, 0.02); },
  slide() { this.noiseHit(0.32, 1800, 0.13, 'bandpass', 400); },
  lane() { this.noiseHit(0.1, 1500, 0.06, 'bandpass', 3000); },
  land() { this.noiseHit(0.08, 700, 0.12, 'lowpass', 300); },
  shave() { this.tone(1760, 0.08, 'square', 0.04); this.tone(2349, 0.12, 'square', 0.04, null, 0.06); },
  power() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.3, 'square', 0.05, null, i * 0.07)); this.tone(1568, 0.5, 'triangle', 0.08, null, 0.4); },
  fanfare() { [[784, 0], [784, 0.12], [988, 0.24], [1175, 0.36], [1568, 0.56]].forEach(([f, d]) => { this.tone(f, 0.22, 'square', 0.05, null, d); this.tone(f * 1.5, 0.22, 'triangle', 0.04, null, d); }); this.noiseHit(0.8, 7000, 0.06, 'highpass', null, 0.56); },
  fever() { [659, 784, 988, 1318, 1568, 1976].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.08, null, i * 0.05)); },
  smash() { this.noiseHit(0.25, 1200, 0.3, 'lowpass', 200); this.tone(440, 0.2, 'triangle', 0.08, 880); },
  crash() { this.noiseHit(0.5, 900, 0.45, 'lowpass', 140); this.tone(660, 0.35, 'triangle', 0.12, 280, 0.05); this.tone(330, 0.5, 'square', 0.05, 170, 0.12); },
  shieldBreak() { this.noiseHit(0.4, 4000, 0.25, 'highpass', 800); this.tone(880, 0.4, 'sine', 0.12, 220); },
  setMuted(m) { this.muted = m; localStorage.setItem('tor_muted', m ? '1' : '0'); if (this.master) this.master.gain.value = m ? 0 : 0.6; },
  startMusic() {
    if (!this.ctx || this.musicT) return;
    // ORIGINAL "Oilfield Shuffle": up-tempo country train-beat in A, 144 bpm. Banjo rolls, boom-chick, fiddle hook. Everything >= 130 Hz.
    const NN = n => 220 * Math.pow(2, n / 12); // semitones from A3
    const prog = [[0, 4, 7], [0, 4, 7], [5, 9, 12], [5, 9, 12], [7, 11, 14], [7, 11, 14], [0, 4, 7], [7, 11, 14]];
    const roots = [12, 12, 5, 5, 7, 7, 12, 7];
    const mel = [19, '-', 16, 19, 21, '-', 19, 16,  14, '-', 12, '-', 16, '-', '-', '-',  17, '-', 21, 17, 24, '-', 21, '-',  19, '-', 16, 14, 16, '-', '-', '-',
                 23, '-', 21, 19, 21, '-', 23, '-',  26, '-', 23, '-', 19, '-', '-', '-',  24, 23, 21, 19, 16, '-', 19, '-',  21, '-', 19, '-', 12, '-', '-', '-'];
    const roll = [0, 2, 1, 0, 2, 1, 0, 2]; // forward banjo roll over the chord tones
    const step = 60 / 144 / 4; let i = 0, next = this.ctx.currentTime + 0.1;
    const tick = () => {
      while (next < this.ctx.currentTime + 0.3) {
        const bar = (i / 16 | 0) % 8, s = i % 16, ch = prog[bar];
        if (s % 2 === 0) this.pluck(NN(ch[roll[(s / 2) % 8]] + 12), next, 0.05, 0.22, 'square'); // banjo roll
        if (s % 8 === 0) this.pluck(NN(roots[bar]), next, 0.1, 0.25, 'triangle'); // boom (root, above HP)
        if (s % 8 === 4) this.pluck(NN(roots[bar] + 7 - (roots[bar] >= 12 ? 12 : 0)), next, 0.08, 0.22, 'triangle'); // alternating fifth
        if (s % 4 === 2) ch.forEach((n, k) => this.pluck(NN(n + 12), next + k * 0.008, 0.025, 0.12, 'sawtooth')); // chick (guitar strum)
        if (s % 2 === 0) { const n = mel[((i / 2) | 0) % mel.length]; if (n !== '-') { let len = 1; while (len < 4 && mel[(((i / 2) | 0) + len) % mel.length] === '-') len++; this.fiddle(NN(n + 12), next, step * 2 * len * 0.92, this.feverOn ? 0.045 : 0.035); } }
        this.drum(next, 3200, 0.9, s % 4 === 2 ? 0.12 : 0.04, 0.05); // train-beat brushes
        if (s % 8 === 4) this.drum(next, 1700, 0.8, 0.22, 0.12); // snare backbeat
        if (s % 8 === 0) this.drum(next, 240, 1.4, 0.18, 0.08); // kick tap
        if (s === 0 && bar % 4 === 0) this.drum(next, 6500, 0.6, 0.1, 0.5);
        i++; next += step;
      }
    };
    tick(); this.musicT = setInterval(tick, 100);
  },
  stopMusic() { if (this.musicT) { clearInterval(this.musicT); this.musicT = null; } },
};
// ---------- Game state ----------
const S = {
  state: 'loading', lane: 1, x: 0, y: 0, vy: 0, sliding: 0, speed: 0, dist: 0, score: 0, coins: 0, stars: 0, starMeter: 0, mult: 1, runT: 0,
  power: { hardhat: 0, shield: 0, magnet: 0, boots: 0 }, fever: 0, nextRow: 0, dead: 0, shake: 0, best: +localStorage.getItem('tor_best') || 0, far: +localStorage.getItem('tor_far') || 0, invuln: 0,
  combo: 0, comboT: 0, bestCombo: 0, shaves: 0, nextMile: 1000, prevLane: 1, laneT: -9, hitstop: 0,
};
const DUR = { hardhat: 6, shield: 12, magnet: 10, boots: 9 };
const FEVER_DUR = 10;
const THOUGHTS = [
  ['Dry air never quits, and neither do you.', 'DryAire Crew'],
  ['Hard hat on, boots laced, eyes on the road.', 'Shift Supervisor'],
  ['Every drop counts. So does every second shift.', 'The Foreman'],
  ['Mesquite shade and a cold drink: earned.', 'Roughneck Wisdom'],
  ['Big Tex says: get back out there, partner!', 'The Longhorn'],
  ['Clean air in, good work out.', 'DryAire Rentals, Beaumont TX'],
];
function clearWorld() {
  for (const o of obstacles) { o.g.visible = false; obPool[o.type].push(o); } obstacles.length = 0;
  for (const it of items) { it.g.visible = false; itemPool[it.kind].push(it); } items.length = 0;
  gushers.forEach(g => g.on = false);
}
function resetRun() {
  clearWorld();
  Object.assign(S, { lane: 1, x: 0, y: 0, vy: 0, sliding: 0, speed: BASE_SPEED, dist: 0, score: 0, coins: 0, stars: 0, starMeter: 0, mult: 1, runT: 0, dead: 0, shake: 0, invuln: 0, nextRow: -45, fever: 0,
    combo: 0, comboT: 0, bestCombo: 0, shaves: 0, nextMile: 1000, prevLane: 1, laneT: -9, hitstop: 0, setPiece: 0 });
  S.power = { hardhat: 0, shield: 0, magnet: 0, boots: 0 };
  zoneIdx = 0; $('zone').textContent = ZONES[0].name; segments.forEach(randomizeSeg);
  player.position.set(0, 0, 0); P.body.rotation.set(0, 0, 0);
  let z = -45; while (z > -170) { spawnRow(z); z -= rowGap(); } S.nextRow = z;
}
const rowGap = () => 15 + S.speed * 0.42;
function dropLine(lane, z0, n, arcOver, y0 = 0.9) {
  for (let i = 0; i < n; i++) {
    const z = z0 + i * 2.2; let y = y0;
    if (arcOver != null) { const t = (z - (arcOver - 6)) / 12; if (t > 0 && t < 1) y = y0 + Math.sin(t * Math.PI) * 1.4; }
    spawnItem('drop', LANES[lane], y, z);
  }
}
// ---- set pieces ----
function pipelineRun(z) { // rhythmic slide / jump corridor with a reward lane of drops
  const pat = ['piperack', 'barrel', 'piperack', 'hoses', 'piperack'];
  pat.forEach((t, k) => { const zz = z - k * (10 + S.speed * 0.18); if (t === 'piperack') { spawnOb(t, 1, zz); dropLine(1, zz - 2, 3, null, 0.55); } else { for (const l of [0, 1, 2]) if (l !== (k % 3)) spawnOb(t, l, zz); dropLine(k % 3, zz - 3, 3); } });
  toastSoon('Pipeline Run!');
  return z - pat.length * (10 + S.speed * 0.18);
}
function gusherRow(z) { // an oil gusher erupts at the roadside: a golden zig-zag stream of drops + a rare star
  const side = Math.random() < 0.5 ? -1 : 1; startGusher(side, z);
  let lane = side < 0 ? 0 : 2;
  for (let i = 0; i < 14; i++) { if (i % 4 === 3) lane = Math.max(0, Math.min(2, lane - side)); spawnItem(i === 13 ? 'star' : 'drop', LANES[lane], 0.9 + Math.sin(i * 0.7) * 0.4, z - i * 2.2); }
  toastSoon('Gusher! Follow the flow!');
  return z - 34;
}
function stampede(z) { // Big Tex leads the herd: tall obstacles in two lanes, swap-swap
  spawnOb('dryer', 0, z); spawnOb('pumpjack', 2, z); dropLine(1, z + 4, 5);
  spawnOb('derrick', 1, z - 14 - S.speed * 0.25); spawnOb('barricade', 0, z - 14 - S.speed * 0.25); dropLine(2, z - 10 - S.speed * 0.25, 5);
  return z - 30 - S.speed * 0.25;
}
function spawnRow(z) {
  const d = S.dist, r = Math.random();
  const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
  const hard = Math.min(1, d / 3000);
  if (d > 600 && r < 0.06) { S.nextRowOverride = pipelineRun(z); return; }
  if (d > 300 && r < 0.12) { S.nextRowOverride = gusherRow(z); return; }
  if (d > 900 && r < 0.17) { S.nextRowOverride = stampede(z); return; }
  if (r < 0.28 && d > 150) { // overhead pipe rack -> slide
    spawnOb('piperack', 1, z); dropLine(lanes[0], z - 3, 4, null, 0.55);
  } else if (r < 0.40 && d > 250) { // runaway barrel rolling at you
    spawnOb('rollbarrel', lanes[0], z - 28); dropLine(lanes[1], z - 6, 6);
    if (Math.random() < 0.5) spawnOb(pick(['dryer', 'pumpjack']), lanes[2], z);
  } else {
    const nObs = Math.random() < 0.35 + hard * 0.4 ? 2 : 1;
    const types = ['barrel', 'hoses', 'barricade', 'dryer', 'pumpjack', 'barrel', 'hoses', 'derrick'];
    for (let k = 0; k < nObs; k++) {
      const t = pick(types); spawnOb(t, lanes[k], z);
      if (k === 0 && OB_TYPES[t] && ['barrel', 'hoses', 'barricade'].includes(t) && Math.random() < 0.6) dropLine(lanes[k], z - 6, 6, z);
    }
    if (Math.random() < 0.8) dropLine(lanes[2], z - 6, 7);
  }
  const rr = Math.random(), free = LANES[lanes[2]];
  if (rr < 0.075) spawnItem(pick(['hardhat', 'shield', 'magnet', 'boots']), free, 1.1, z + 7);
  else if (rr < 0.16) spawnItem('star', free, 1.0, z + 7);
}

// ---------- Gusher set-piece visual ----------
const gushers = [];
const wellG = new THREE.CylinderGeometry(0.35, 0.5, 1.2, 12);
for (let i = 0; i < 2; i++) { const g = new THREE.Group(); mesh(wellG, M.dark, 0, 0.6, 0, g); mesh(new THREE.TorusGeometry(0.4, 0.08, 6, 14), M.red, 0, 1.2, 0, g).rotation.x = Math.PI / 2; g.visible = false; scene.add(g); gushers.push({ g, on: false, z: 0, side: 1 }); }
function startGusher(side, z) { const gu = gushers.find(g => !g.on) || gushers[0]; gu.on = true; gu.side = side; gu.z = z; gu.g.visible = true; gu.g.position.set(side * (WALL_X + 1.2), 0, z); }

// ---------- Big Tex the longhorn cameo (crosses well ahead; harmless) ----------
const TEX = { g: new THREE.Group(), on: false, t: 0, next: 22 };
TEX.b = billboard('longhorn', 2.1, TEX.g, 0, 0); TEX.g.visible = false; scene.add(TEX.g);
const TEX_VX = 7;
function startTex(z) { TEX.on = true; TEX.t = 0; TEX.x = -WALL_X - 4; TEX.z = z ?? -(S.speed * ((2 * WALL_X + 10) / TEX_VX) + 24); TEX.g.visible = true; TEX.g.position.set(TEX.x, 0, TEX.z); Sfx.moo(); }
function updateTex(dt, dz, playing) {
  if (playing && !S.dead && !TEX.on && S.dist > 200) { TEX.next -= dt; if (TEX.next <= 0) { startTex(); TEX.next = rand(30, 45); } }
  if (!TEX.on) return;
  TEX.t += dt; TEX.x += TEX_VX * dt; TEX.z += dz; TEX.g.position.set(TEX.x, Math.abs(Math.sin(TEX.t * 8)) * 0.12, TEX.z); TEX.b.rotation.z = Math.sin(TEX.t * 8) * 0.04;
  if (TEX.x > WALL_X + 6) { TEX.on = false; TEX.g.visible = false; if (playing && !S.dead) { S.score += 100 * S.mult; toast('Big Tex says howdy! +' + 100 * S.mult); } }
}

// ---------- Input ----------
function act(a) {
  if (S.state !== 'play' || S.dead) return;
  if (a === 'left' && S.lane > 0) { S.prevLane = S.lane; S.laneT = S.runT; S.lane--; Sfx.lane(); P.lean = 1; }
  if (a === 'right' && S.lane < 2) { S.prevLane = S.lane; S.laneT = S.runT; S.lane++; Sfx.lane(); P.lean = -1; }
  if (a === 'up' && S.y <= 0.001) { const big = S.power.boots > 0; S.vy = big ? BOOT_V : JUMP_V; S.sliding = 0; Sfx.jump(big); P.squash = -1; emit(S.x, 0.1, 0, big ? 22 : 12, big ? 0xffe066 : 0xffe6b0, 3, 0.4, 0.5, 1); }
  if (a === 'down') { if (S.y > 0.01) S.vy = -26; S.sliding = 0.75; Sfx.slide(); emit(S.x, 0.1, 0.3, 10, 0xf0d0a0, 2.5, 0.4, 0.5, 0.6); }
}
addEventListener('keydown', e => {
  const k = e.key;
  if (['ArrowLeft', 'a', 'A'].includes(k)) act('left');
  else if (['ArrowRight', 'd', 'D'].includes(k)) act('right');
  else if (['ArrowUp', 'w', 'W', ' '].includes(k)) { act('up'); if ((S.state === 'menu' || S.state === 'over') && k === ' ') startGame(); }
  else if (['ArrowDown', 's', 'S'].includes(k)) act('down');
  else if (k === 'p' || k === 'P' || k === 'Escape') togglePause();
  else if (k === 'm' || k === 'M') toggleMute();
  else if (k === 'Enter' && (S.state === 'menu' || S.state === 'over')) startGame();
  if (k.startsWith('Arrow') || k === ' ') e.preventDefault();
});
let tStart = null;
addEventListener('touchstart', e => { const t = e.touches[0]; tStart = { x: t.clientX, y: t.clientY, used: false }; }, { passive: true });
addEventListener('touchmove', e => {
  if (!tStart || tStart.used) return; const t = e.touches[0]; const dx = t.clientX - tStart.x, dy = t.clientY - tStart.y;
  if (Math.hypot(dx, dy) > 30) { tStart.used = true; if (Math.abs(dx) > Math.abs(dy)) act(dx > 0 ? 'right' : 'left'); else act(dy > 0 ? 'down' : 'up'); }
}, { passive: true });
addEventListener('touchend', () => { tStart = null; });

// ---------- UI ----------
function show(id, on) { $(id).classList.toggle('hidden', !on); }
function startGame() {
  Sfx.init(); Sfx.startMusic();
  resetRun(); S.state = 'play'; timeOfDay = Q.has('t') ? +Q.get('t') : 0.12;
  show('menu', false); show('over', false); show('paused', false); show('hud', true);
}
function gameOver() {
  S.state = 'over'; Sfx.stopMusic(); Sfx.feverOn = false; show('feverFx', false);
  const sc = Math.floor(S.score), nb = sc > S.best; if (nb) { S.best = sc; localStorage.setItem('tor_best', sc); }
  if (S.dist > S.far) { S.far = Math.floor(S.dist); localStorage.setItem('tor_far', S.far); }
  $('fScore').textContent = sc.toLocaleString(); $('fCoins').textContent = S.coins; $('fStars').textContent = S.stars; $('fDist').textContent = Math.floor(S.dist) + ' ft';
  $('fExtra').textContent = `Best combo x${S.bestCombo} \u00b7 Close shaves ${S.shaves} \u00b7 Reached ${ZONES[zoneIdx].name}`;
  $('crashWord').textContent = CRASH[S.killer] || 'Shift Over!';
  $('bestOver').textContent = S.best.toLocaleString(); $('bestMenu').textContent = S.best.toLocaleString(); $('farMenu').textContent = S.far.toLocaleString(); show('newBest', nb);
  const showV = localStorage.getItem('tor_verse') !== '0'; $('verseToggle').checked = showV;
  const v = pick(THOUGHTS); $('verse').innerHTML = `&ldquo;${v[0]}&rdquo;<cite>${v[1]}</cite>`; show('verse', showV);
  show('over', true);
}
function togglePause() {
  if (S.state === 'play') { S.state = 'paused'; show('paused', true); if (Sfx.ctx) Sfx.ctx.suspend(); }
  else if (S.state === 'paused') { S.state = 'play'; show('paused', false); if (Sfx.ctx) Sfx.ctx.resume(); }
}
function toggleMute() { Sfx.init(); Sfx.setMuted(!Sfx.muted); $('muteBtn').style.opacity = Sfx.muted ? 0.4 : 1; }
$('playBtn').onclick = startGame; $('againBtn').onclick = startGame;
$('menuBtn').onclick = () => { show('over', false); show('hud', false); show('menu', true); S.state = 'menu'; clearWorld(); };
$('resumeBtn').onclick = togglePause; $('pauseBtn').onclick = togglePause; $('muteBtn').onclick = toggleMute;
$('muteBtn').style.opacity = Sfx.muted ? 0.4 : 1;
$('verseToggle').onchange = e => { localStorage.setItem('tor_verse', e.target.checked ? '1' : '0'); show('verse', e.target.checked); };
$('bestMenu').textContent = S.best.toLocaleString(); $('farMenu').textContent = S.far.toLocaleString();
let toastT = 0; const toastQ = [];
function toast(msg) { if (toastT > 0.5) { if (toastQ.length < 3) toastQ.push(msg); return; } const t = $('toast'); t.textContent = msg; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); toastT = 1.4; }
let toastSoonMsg = null; function toastSoon(m) { toastSoonMsg = m; }
const _pv = new THREE.Vector3();
function pop(text, x, y, z, big) { // floating score popup anchored to a 3D point
  _pv.set(x, y, z).project(camera); const el = document.createElement('div'); el.className = 'pop' + (big ? ' big' : ''); el.textContent = text;
  el.style.left = ((_pv.x * 0.5 + 0.5) * 100).toFixed(1) + '%'; el.style.top = ((-_pv.y * 0.5 + 0.5) * 100).toFixed(1) + '%';
  $('pops').appendChild(el); setTimeout(() => el.remove(), 950);
}
const NAMES = { hardhat: 'Hard Hat Boost', shield: 'Dryer Shield', magnet: 'Wrench Magnet', boots: 'Boot Scoot Jump' };
let lastPowHTML = '', lastStars = -1;
function updateHUD() {
  $('score').textContent = Math.floor(S.score).toLocaleString();
  $('dist').textContent = Math.floor(S.dist) + ' ft';
  $('coins').textContent = S.coins; $('mult').textContent = S.mult;
  let h = '';
  for (const k in S.power) if (S.power[k] > 0) h += `<div class="pbar" style="border-color:#${PCOL[k].toString(16)}">${NAMES[k]}<div class="fill" style="width:${(S.power[k] / DUR[k] * 100).toFixed(0)}%;background:#${PCOL[k].toString(16)}"></div></div>`;
  if (S.fever > 0) h += `<div class="pbar" style="border-color:#ff4a3a">Lone Star Fever x2<div class="fill" style="width:${(S.fever / FEVER_DUR * 100).toFixed(0)}%;background:#ff4a3a"></div></div>`;
  if (h !== lastPowHTML) { $('powers').innerHTML = h; lastPowHTML = h; }
  const sm = S.fever > 0 ? 5 : S.starMeter;
  if (sm !== lastStars) { lastStars = sm; [...$('starmeter').children].forEach((e, i) => e.classList.toggle('on', i < sm)); }
  $('starmeter').classList.toggle('fever', S.fever > 0);
  const c = $('combo'); if (S.combo >= 5) { c.textContent = 'Drop Combo x' + S.combo; c.classList.add('on'); } else c.classList.remove('on');
}

// ---------- Main loop ----------
const clock = new THREE.Clock();
let lowN = 0, highN = 0, fpsAcc = 0, fpsN = 0, qualityLevel = 0, animT = 0, wallT = 0;
const camTarget = new THREE.Vector3(), lookTarget = new THREE.Vector3(0, 1.2, -8), curLook = new THREE.Vector3(0, 1.2, -8);
function playerBox() { const h = S.sliding > 0 ? 0.8 : 1.5; return { x0: S.x - 0.38, x1: S.x + 0.38, y0: S.y, y1: S.y + h, z0: -0.35, z1: 0.35 }; }
function fillRows() { while (S.nextRow > -170) { S.nextRowOverride = null; spawnRow(S.nextRow); S.nextRow = S.nextRowOverride != null ? S.nextRowOverride - rowGap() * 0.6 : S.nextRow - rowGap(); } }
function checkMilestone() {
  if (S.dist < S.nextMile) return;
  const n = S.nextMile; S.nextMile += 1000;
  const bonus = 500 * S.mult; S.score += bonus; Sfx.fanfare();
  zoneIdx = Math.min(ZONES.length - 1, Math.floor(n / 1000)) ; if (n >= 4000) zoneIdx = (n / 1000) % ZONES.length;
  $('zone').textContent = ZONES[zoneIdx].name;
  toast(`${n.toLocaleString()} ft! ${ZONES[zoneIdx].name} +${bonus}`);
  emit(S.x, 2.4, -2, 60, 0xffd34d, 8, 0.6, 1.0, 3); emit(S.x, 2.4, -2, 30, 0xff6040, 7, 0.5, 0.9, 3);
}
function update(dt) {
  const playing = S.state === 'play';
  let speed = 0;
  if (S.hitstop > 0) { S.hitstop -= dt; dt *= 0.15; } // brief impact freeze on smashes
  if (playing && !S.dead) {
    S.runT += dt;
    S.speed = Math.min(MAX_SPEED, BASE_SPEED + S.dist * 0.0075);
    speed = S.speed * (S.power.hardhat > 0 ? 1.45 : 1);
    S.dist += speed * dt;
    S.mult = (1 + Math.floor(S.dist / 1000) + (S.power.hardhat > 0 ? 1 : 0)) * (S.fever > 0 ? 2 : 1);
    S.score += speed * dt * 0.5 * S.mult;
    for (const k in S.power) S.power[k] = Math.max(0, S.power[k] - dt);
    if (S.fever > 0) { S.fever -= dt; if (S.fever <= 0) { S.fever = 0; show('feverFx', false); Sfx.feverOn = false; } }
    if (S.invuln > 0) S.invuln -= dt;
    if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) S.combo = 0; }
    if (!Q.has('t')) timeOfDay += dt / CYCLE_SECS;
    checkMilestone();
    if (toastSoonMsg) { toast(toastSoonMsg); toastSoonMsg = null; }
  } else if (S.state === 'menu' || S.state === 'loading') speed = 7;
  applyTime(timeOfDay);
  const dz = speed * dt;
  animT += dt * (speed > 0 ? speed * 0.55 : 2); wallT += dt;

  TX.ground.offset.y = (TX.ground.offset.y + dz / (300 / 60)) % 1;
  stripeTex.offset.y = (stripeTex.offset.y + dz / (300 / 40)) % 1;
  for (const seg of segments) { seg.g.position.z += dz; if (seg.g.position.z > 10 + SEG_LEN) { seg.g.position.z -= SEG_N * SEG_LEN; randomizeSeg(seg); } }
  for (const b of nodders) b.rotation.z = Math.sin(wallT * 2.2 + b.position.x) * 0.035;
  for (let i = 0; i < DM; i++) { dPos[i * 3 + 2] += dz * 0.9; dPos[i * 3 + 1] += Math.sin(animT * 0.05 + i) * 0.003; if (dPos[i * 3 + 2] > 10) dPos[i * 3 + 2] -= 90; }
  dGeo.attributes.position.needsUpdate = true;
  for (const s of skyGlows) s.material.opacity = (ENV.glowN || 0) * (0.6 + 0.4 * Math.sin(wallT * 1.5 + s.userData.ph));
  flare.scale.setScalar(20 + Math.sin(wallT * 9) * 2 + Math.sin(wallT * 13) * 1.5); flare.material.opacity = 0.45 + (ENV.glowN || 0) * 0.5;
  for (const gu of gushers) if (gu.on) {
    gu.z += dz; gu.g.position.z = gu.z;
    if (gu.z > -150 && gu.z < 8) { emit(gu.g.position.x, 1.3, gu.z, 3, 0xffc020, 3, 0.55, 1.1, 9); emit(gu.g.position.x, 1.3, gu.z, 1, 0x3a1d08, 2, 0.5, 1.0, 8); }
    if (gu.z > 14) { gu.on = false; gu.g.visible = false; }
  }

  if (playing || S.state === 'over' || S.state === 'paused') {
    if (playing && !S.dead) { S.nextRow += dz; fillRows(); }
    if (!S.dead) {
      const tx = LANES[S.lane]; S.x += (tx - S.x) * (1 - Math.exp(-14 * dt));
      S.vy -= GRAV * dt; S.y += S.vy * dt;
      if (S.y < 0) { if (S.vy < -5 && playing) { emit(S.x, 0.1, 0.2, 8, 0xffe6b0, 2.2, 0.38, 0.45, 0.5); Sfx.land(); P.squash = 1; } S.y = 0; S.vy = 0; }
      if (S.sliding > 0) S.sliding -= dt;
    }
    const pb = playerBox();
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.pz = o.z; o.z += dz + (o.moving && playing && !S.dead ? 6 * dt : 0); o.g.position.z = o.z;
      const sp = o.g.userData.spr;
      if (o.moving && sp) { sp.position.y = Math.abs(Math.sin(wallT * 9)) * 0.1; sp.rotation.z = Math.sin(wallT * 9) * 0.12; }
      if (o.nod && sp) sp.rotation.z = Math.sin(wallT * 2.6) * 0.04;
      if (o.z > 2.5 && !o.wide) o.g.visible = false;
      if (o.z > 18) { o.g.visible = false; obPool[o.type].push(o); obstacles.splice(i, 1); continue; }
      if (!playing || S.dead) continue;
      const b = o.box;
      // swept z-range: covers the whole step this frame so fast frames can't tunnel
      const zMin = Math.min(o.pz, o.z) - b.hd, zMax = Math.max(o.pz, o.z) + b.hd;
      if (pb.x1 > o.x - b.hw && pb.x0 < o.x + b.hw && pb.z1 > zMin && pb.z0 < zMax && pb.y1 > b.y0 && pb.y0 < b.y1) {
        if (GOD || S.god || S.power.hardhat > 0 || S.invuln > 0) { if (S.power.hardhat > 0 && !o.hitFx) { o.hitFx = 1; o.g.visible = false; S.hitstop = 0.06; S.shake = Math.max(S.shake, 0.25); Sfx.smash(); emit(o.x, 1, o.z, 34, 0xffb050, 7, 0.5, 0.6); emit(o.x, 1, o.z, 12, 0x6b4a2e, 6, 0.4, 0.6); S.score += 25 * S.mult; pop('SMASH +' + 25 * S.mult, o.x, 2, o.z); } continue; }
        if (S.power.shield > 0) { S.power.shield = 0; S.invuln = 1.2; Sfx.shieldBreak(); emit(S.x, 1.2, 0, 50, 0x5fd8e0, 8, 0.5, 0.8); S.shake = 0.4; toast('Dryer Shield saved you!'); continue; }
        S.dead = 1; S.deadT = 0; S.killer = o.type; S.hitstop = 0.12; Sfx.crash(); S.shake = 0.8; emit(S.x, 1, -0.5, 40, 0xffe6b0, 6, 0.6, 0.9);
        if (o.type.includes('barrel')) emit(o.x, 0.4, o.z, 40, 0x3a1d08, 5, 0.6, 1.0, 1);
        continue;
      }
      // passing: close shaves & clean hops
      if (!o.passed && o.z > 0.6) {
        o.passed = true;
        if (!o.wide && o.lane === S.prevLane && S.runT - S.laneT < 0.45 && S.lane !== o.lane) { S.shaves++; const v = 50 * S.mult; S.score += v; Sfx.shave(); pop('Close Shave! +' + v, S.x, 2.6, 0); }
        else if (o.jump && o.lane === S.lane && S.y > b.y1) { const v = 25 * S.mult; S.score += v; pop('Hop +' + v, S.x, 2.6, 0); }
        else if (o.slide && S.sliding > 0) { const v = 25 * S.mult; S.score += v; pop('Duck +' + v, S.x, 2.0, 0); }
      }
    }
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.z += dz;
      if (S.power.magnet > 0 && (it.kind === 'drop' || it.kind === 'star') && it.z > -18 && it.z < 2) it.mag = true;
      if (it.mag && !S.dead) { const k = (1 - Math.exp(-10 * dt)); it.x += (S.x - it.x) * k; it.y += (S.y + 0.8 - it.y) * k; it.z += (0 - it.z) * k; }
      it.phase += dt;
      it.g.position.set(it.x, it.y + Math.sin(it.phase * 3) * 0.1, it.z);
      const spr = it.g.userData.spr; spr.rotation.z = it.kind === 'drop' ? Math.sin(it.phase * 2.5) * 0.18 : Math.sin(it.phase * 2) * 0.12;
      spr.scale.x = spr.userData.h * aspect(it.kind) * (it.kind === 'star' ? Math.cos(it.phase * 3) : 1); // star "spins" by squashing width (no camera-facing rotation)
      if (it.z > 2.5) it.g.visible = false;
      if (it.z > 12) { it.g.visible = false; itemPool[it.kind].push(it); items.splice(i, 1); continue; }
      if (!playing || S.dead) continue;
      if (Math.abs(it.x - S.x) < 0.95 && Math.abs(it.z) < 1.0 && it.y > S.y - 0.3 && it.y < S.y + 2.0) {
        collect(it); it.g.visible = false; itemPool[it.kind].push(it); items.splice(i, 1);
      }
    }
  }
  if (S.dead) { S.deadT += dt; if (S.deadT > 1.3 && S.state === 'play') gameOver(); }
  updateTex(dt, dz, playing);
  updateParticles(dt, dz);
  if (S.power.hardhat > 0 && playing) { emit(S.x + rand(-0.3, 0.3), 0.3 + S.y + rand(0, 1.4), 0.4, 2, 0xffa040, 1, 0.3, 0.35, 0.3); emit(rand(-4, 4), rand(0.5, 4), -6, 1, 0xfff6b0, 0, 0.18, 0.25, 0); }
  if (S.fever > 0 && playing && Math.random() < 0.5) emit(S.x + rand(-0.6, 0.6), 0.5 + S.y + rand(0, 1.5), 0.2, 1, pick([0xffd34d, 0xff6040]), 1.5, 0.35, 0.5, 1);
  if (playing && S.y === 0 && !S.dead && Math.random() < 0.3) emit(S.x, 0.05, 0.4, 1, 0xf0d0a0, 0.6, 0.3, 0.5, 0.6);

  // player animation (fixed facing; squash & stretch by scale only)
  player.position.set(S.x, S.y, 0);
  P.blob.position.x = S.x;
  P.lean = (P.lean || 0) * Math.exp(-4 * dt);
  P.squash = (P.squash || 0) * Math.exp(-12 * dt);
  if (S.dead) { P.setFrame('jump'); P.body.rotation.z = Math.min(0.35, S.deadT * 2); player.position.z = Math.min(0.8, S.deadT * 2); }
  else {
    const air = S.y > 0.01, sl = S.sliding > 0;
    if (sl) { P.setFrame('slide'); P.body.position.y = 0; }
    else if (air) { P.setFrame('jump'); P.body.position.y = 0; }
    else { const f = [0, 1, 2, 1][Math.floor(animT / 0.95) % 4]; P.setFrame('run' + f); P.body.position.y = Math.abs(Math.sin(animT * 1.12)) * 0.07; }
    P.body.rotation.z = P.lean * 0.08;
    const sq = P.squash; P.body.scale.set(1 + sq * 0.12, 1 - sq * 0.12, 1);
  }
  P.blob.scale.setScalar(1 - Math.min(0.6, S.y * 0.2));
  P.shield.visible = S.power.shield > 0 || S.invuln > 0; P.shield.material.opacity = 0.16 + Math.sin(wallT * 5) * 0.06;
  P.magRing.visible = S.power.magnet > 0; P.magRing.scale.setScalar(1 + Math.sin(wallT * 6) * 0.15);
  P.halo.material.opacity = S.fever > 0 ? 0.55 + Math.sin(wallT * 10) * 0.15 : (S.power.boots > 0 ? 0.35 : 0);
  player.visible = !(S.invuln > 0 && Math.floor(S.invuln * 12) % 2);

  const fovT = 60 + (speed - BASE_SPEED) * 0.45;
  camera.fov += (Math.min(78, Math.max(58, fovT)) - camera.fov) * (1 - Math.exp(-1.5 * dt)); camera.updateProjectionMatrix();
  const portrait = innerHeight > innerWidth;
  if (S.state === 'menu' || S.state === 'loading') { const t = performance.now() * 0.00015; camTarget.set(Math.sin(t) * 1.2, 3.2, 6.5); lookTarget.set(0, 3.5, -40); }
  else { camTarget.set(S.x * 0.65, (portrait ? 3.9 : 3.4) + S.y * 0.35, portrait ? 7.6 : 6.4); lookTarget.set(S.x * 0.45, 1.1 + S.y * 0.25, -9); }
  camera.position.lerp(camTarget, (1 - Math.exp(-6 * dt))); curLook.lerp(lookTarget, (1 - Math.exp(-7 * dt)));
  if (S.shake > 0) { S.shake -= dt; camera.position.x += rand(-1, 1) * S.shake * 0.4; camera.position.y += rand(-1, 1) * S.shake * 0.3; }
  camera.lookAt(curLook);
  sky.position.copy(camera.position);

  if (toastT > 0) { toastT -= dt; if (toastT <= 0) { $('toast').classList.remove('show'); if (toastQ.length) setTimeout(() => toast(toastQ.shift()), 120); } }
  if (playing) updateHUD();
}

function collect(it) {
  const x = it.x, y = it.y, z = it.z;
  switch (it.kind) {
    case 'drop': {
      S.coins++; S.combo++; S.comboT = 0.9; S.bestCombo = Math.max(S.bestCombo, S.combo);
      const v = 10 * S.mult * (1 + Math.floor(S.combo / 10)); S.score += v; Sfx.coin(S.combo); emit(x, y, z, 10, 0xffd34d, 3, 0.35, 0.45, 1.5);
      if (S.combo % 25 === 0) { const b = 250 * S.mult; S.score += b; toast(`Gusher Combo x${S.combo}! +${b}`); Sfx.fanfare(); }
      break;
    }
    case 'star':
      S.stars++; S.score += 150 * S.mult; Sfx.star(); emit(x, y, z, 30, 0xff4a3a, 5, 0.45, 0.8); emit(x, y, z, 20, 0xffd34d, 4, 0.4, 0.7); pop('+' + 150 * S.mult, x, y + 1, z);
      if (S.fever <= 0) { S.starMeter++; if (S.starMeter >= 5) { S.starMeter = 0; S.fever = FEVER_DUR; Sfx.fever(); Sfx.feverOn = true; show('feverFx', true); toast('LONE STAR FEVER! x2'); } }
      break;
    default: S.power[it.kind] = DUR[it.kind]; Sfx.power(); emit(x, y, z, 50, PCOL[it.kind], 7, 0.55, 0.9); toast(NAMES[it.kind] + '!');
  }
}

// quality hysteresis: drop only after 2 consecutive slow windows, restore only after 4 consecutive fast ones
function adaptQuality(dt) {
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 2.5) {
    const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    lowN = fps < 45 ? lowN + 1 : 0; highN = fps > 58 ? highN + 1 : 0;
    if (lowN >= 2 && qualityLevel < 3 && S.state === 'play') { lowN = 0; highN = 0; setQuality(qualityLevel + 1); console.info('[quality] lowered to', qualityLevel, fps.toFixed(1)); }
    else if (highN >= 4 && qualityLevel > 0 && S.state === 'play') { highN = 0; setQuality(qualityLevel - 1); console.info('[quality] raised to', qualityLevel, fps.toFixed(1)); }
  }
}
const basePR = pixelRatio;
function setQuality(q) {
  qualityLevel = q;
  const sm = q >= 1 ? 1024 : (IS_MOBILE ? 1024 : 2048); if (sun.shadow.mapSize.x !== sm) { sun.shadow.mapSize.set(sm, sm); sun.shadow.map?.dispose(); sun.shadow.map = null; }
  const pr = q >= 2 ? Math.max(1, basePR * 0.75) : basePR; if (pr !== pixelRatio) { pixelRatio = pr; renderer.setPixelRatio(pr); onResize(); }
  useOutline = q < 3 && !Q.has('nooutline');
}
function onResize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }
addEventListener('resize', onResize);
document.addEventListener('visibilitychange', () => { if (document.hidden && S.state === 'play') togglePause(); });

let sdt = 1 / 60; if (Q.has('nooutline')) useOutline = false;
function frame() {
  const rawDt = Math.min(1 / 30, clock.getDelta()); sdt += (rawDt - sdt) * 0.2; const dt = sdt;
  if (S.state !== 'paused') update(dt);
  for (const b of billboards) b.rotation.y = b.userData.fixed ?? 0; // fixed facing: no per-frame wobble
  if (useOutline) outline.render(scene, camera); else renderer.render(scene, camera);
  adaptQuality(dt);
  requestAnimationFrame(frame);
}
S.state = 'menu'; show('loading', false);
frame();
window.__game = { segments, fixPoles, P, player, camera, S, startGame, act, Sfx, spawnOb, spawnItem, obstacles, items, setTime: t => { timeOfDay = t; }, JUMP_APEX, OB_TYPES, toast, startTex, TEX, startGusher, pipelineRun, gusherRow, stampede, collect };
