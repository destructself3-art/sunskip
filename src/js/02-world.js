/* ============ world: renderer, curved-horizon shader, sky, terrain, decor, zones ============ */
const TRACK = 7.0;          // half-width of the flyable road
const AHEAD = 175;          // how far ahead the world is built
const DAY_M = 3000;         // one Nectar day, in metres
const ZONE_M = DAY_M / 4;
const BEND = { uBendY: { value: 0.0019 }, uBendX: { value: 0 } };

const BEND_VERT = `
  vec4 mvPosition = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
  #endif
  mvPosition = modelViewMatrix * mvPosition;
  float bz = min( mvPosition.z + 2.0, 0.0 );
  mvPosition.y -= bz * bz * uBendY;
  mvPosition.x += bz * bz * uBendX;
  gl_Position = projectionMatrix * mvPosition;`;

function bendify(mat, tag) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uBendY = BEND.uBendY; sh.uniforms.uBendX = BEND.uBendX;
    sh.vertexShader = 'uniform float uBendY;\nuniform float uBendX;\n' + sh.vertexShader.replace('#include <project_vertex>', BEND_VERT);
  };
  mat.customProgramCacheKey = () => 'bend-' + (tag || mat.type);
  return mat;
}
const lam = (hex, opts) => bendify(new THREE.MeshLambertMaterial(Object.assign({ color: hex }, opts || {})), 'lam' + (opts && opts.transparent ? 't' : ''));
const basic = (hex, opts) => bendify(new THREE.MeshBasicMaterial(Object.assign({ color: hex }, opts || {})), 'bas' + (opts && opts.transparent ? 't' : '') + (opts && opts.vertexColors ? 'v' : ''));

/* ---- zone palettes: a Nectar day is dawn → noon → dusk → moonrise ---- */
const ZONE_DEF = [
  { key: 'zoneDawn', clock: 5.5, skyTop: '#C4B2F0', skyHor: '#FFD8BF', gA: '#F7D0B2', gB: '#E8A696', track: '#FFE6D0', hazard: '#9A86E8', wall: '#E9837B', rock: '#DC8C86', decor: '#B9A8F5', tree: '#FF9E8F', beacon: '#FFF4E0', hemiS: '#FFEDE2', hemiG: '#CDBDF4', sun: '#FFE2BE', sunI: 0.5, hemiI: 0.92, stars: 0.0, sunDir: [-0.6, 0.16, -1], planet: 1.0, cloud: '#FFF1E6' },
  { key: 'zoneNoon', clock: 11.5, skyTop: '#93D1EA', skyHor: '#FFF4E4', gA: '#C3EBD7', gB: '#86CDB3', track: '#EEF9EF', hazard: '#FF8574', wall: '#9C88EC', rock: '#EE9F8C', decor: '#FFB9A0', tree: '#FFE07A', beacon: '#FFFFFF', hemiS: '#F6FFFB', hemiG: '#B8DCE0', sun: '#FFF7E6', sunI: 0.5, hemiI: 0.9, stars: 0.0, sunDir: [0.25, 0.8, -1], planet: 0.8, cloud: '#FFFFFF' },
  { key: 'zoneDusk', clock: 17.5, skyTop: '#FF998D', skyHor: '#FFE59E', gA: '#FFD0A3', gB: '#EE977D', track: '#FFEAC6', hazard: '#8872E2', wall: '#5FB8A0', rock: '#D98272', decor: '#FF9E8F', tree: '#B9A8F5', beacon: '#FFF3C8', hemiS: '#FFE6BE', hemiG: '#E6ADC4', sun: '#FFC98A', sunI: 0.55, hemiI: 0.9, stars: 0.12, sunDir: [0.65, 0.1, -1], planet: 1.05, cloud: '#FFD9C4' },
  { key: 'zoneNight', clock: 23.5, skyTop: '#3E3979', skyHor: '#A999E6', gA: '#AFA6E2', gB: '#8C80CF', track: '#D2CCF5', hazard: '#FF8C9C', wall: '#FFD36B', rock: '#7B70BE', decor: '#8FE3C8', tree: '#8FE3C8', beacon: '#FFE07A', hemiS: '#DCD5FF', hemiG: '#958CD6', sun: '#DCD6FF', sunI: 0.45, hemiI: 1.0, stars: 1.0, sunDir: [-0.3, 0.5, -1], planet: 1.35, cloud: '#C9BEF5' },
];
const GOLD = { skyTop: '#FFC66B', skyHor: '#FFF0B8', gA: '#FFE49A', gB: '#F5B96A', track: '#FFF2C4', hemiS: '#FFF1C2', cloud: '#FFF3C4' };
const INK_HAZ = '#3A3366';
const COLOR_KEYS = ['skyTop', 'skyHor', 'gA', 'gB', 'track', 'hazard', 'wall', 'rock', 'decor', 'tree', 'beacon', 'hemiS', 'hemiG', 'sun', 'cloud'];

const W = {
  renderer: null, scene: null, camera: null, clock: 0, zoneF: 0, zoneIdx: 0,
  pal: {}, mats: {}, chunks: [], inst: {}, decorNext: 0, beaconNext: 0, cloudNext: 0, drng: mulberry(7),
};

function initWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
  renderer.setClearColor(0xffe9d2, 1);
  W.renderer = renderer;
  const scene = new THREE.Scene();
  W.scene = scene;
  scene.fog = new THREE.Fog(0xffdcc6, 60, 175);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
  W.camera = camera;

  // palettes as THREE.Color
  W.zones = ZONE_DEF.map((z) => { const o = {}; COLOR_KEYS.forEach((k) => { o[k] = new THREE.Color(z[k]); }); return o; });
  W.gold = {}; Object.keys(GOLD).forEach((k) => { W.gold[k] = new THREE.Color(GOLD[k]); });
  COLOR_KEYS.forEach((k) => { W.pal[k] = new THREE.Color(); });
  W.inkHaz = new THREE.Color(INK_HAZ);
  W.sunDir = new THREE.Vector3();

  // lights
  W.hemi = new THREE.HemisphereLight(0xffe8da, 0xa996e8, 0.9);
  scene.add(W.hemi);
  W.sunLight = new THREE.DirectionalLight(0xffe2be, 0.95);
  scene.add(W.sunLight); scene.add(W.sunLight.target);

  buildSky();
  buildTerrain();
  buildDecor();
  // shared entity materials, recoloured per zone
  W.mats.hazard = lam(0x9a86e8);
  W.mats.wall = lam(0xe9837b);
  W.mats.rock = lam(0xdc8c86);
  W.mats.marker = basic(0xff7a6b, { transparent: true, opacity: 0.8, depthWrite: false });
  W.mats.shadow = basic(0x2f2a55, { transparent: true, opacity: 0.16, depthWrite: false });
  W.mats.shard = basic(0xffe07a);
  W.mats.shardCore = basic(0xfffbe8);
  W.mats.ring = lam(0xffc94d, { emissive: 0x6b4a10 });
  W.mats.cream = lam(0xfff3e2);
  W.mats.ink = lam(0x3a3366);
  W.mats.ember = basic(0xff9a6b);
  applyZone(0, 0);
}

/* ---- sky dome, stars, gas giant with rings ---- */
function buildSky() {
  const skyGeo = new THREE.SphereGeometry(900, 32, 16);
  W.skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 0.2, -1) }, night: { value: 0 } };
  const sky = new THREE.Mesh(skyGeo, new THREE.ShaderMaterial({
    uniforms: W.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunCol; uniform vec3 sunDir; uniform float night; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = clamp(d.y * 1.5 + 0.02, 0.0, 1.0);
        vec3 c = mix(hor, top, pow(h, 0.62));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += sunCol * (smoothstep(0.9975, 0.9985, s) * 0.9 + pow(s, 28.0) * 0.28 + pow(s, 4.0) * 0.08);
        c = mix(c, hor, smoothstep(0.08, -0.05, d.y));
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  sky.renderOrder = -10; sky.frustumCulled = false;
  W.sky = sky; W.scene.add(sky);

  // stars
  const N = 520, pos = new Float32Array(N * 3), tw = new Float32Array(N);
  const r = mulberry(99);
  for (let i = 0; i < N; i++) {
    const th = r() * TAU, y = r() * 0.9 + 0.05, rr = Math.sqrt(1 - y * y);
    pos[i * 3] = Math.cos(th) * rr * 800; pos[i * 3 + 1] = y * 800; pos[i * 3 + 2] = Math.sin(th) * rr * 800;
    tw[i] = r() * 10;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('tw', new THREE.BufferAttribute(tw, 1));
  W.starU = { op: { value: 0 }, time: { value: 0 }, pr: { value: 1 } };
  W.stars = new THREE.Points(sg, new THREE.ShaderMaterial({
    uniforms: W.starU, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'attribute float tw; uniform float time; uniform float pr; varying float vA; void main(){ vA = 0.55 + 0.45 * sin(time * 2.0 + tw); gl_PointSize = (1.6 + fract(tw) * 2.2) * pr; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float op; varying float vA; void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard; gl_FragColor = vec4(1.0, 0.97, 0.9, op * vA * smoothstep(0.5, 0.1, d)); }',
  }));
  W.stars.renderOrder = -9; W.stars.frustumCulled = false;
  W.scene.add(W.stars);

  // the gas giant "Apricot" with rings
  W.planet = new THREE.Group();
  W.planetU = { lightDir: { value: new THREE.Vector3(0.3, 0.4, 1).normalize() }, bright: { value: 1 }, time: { value: 0 } };
  const pm = new THREE.Mesh(new THREE.SphereGeometry(95, 48, 32), new THREE.ShaderMaterial({
    uniforms: W.planetU, fog: false,
    vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 lightDir; uniform float bright; uniform float time; varying vec3 vN; varying vec3 vP;
      void main(){ float lat = vP.y / 95.0;
        float b = sin(lat * 15.0 + sin(vP.x * 0.05 + time * 0.05) * 0.6) * 0.5 + 0.5;
        float b2 = sin(lat * 38.0 + 1.3) * 0.5 + 0.5;
        vec3 c = mix(vec3(1.0, 0.86, 0.72), vec3(1.0, 0.64, 0.55), b);
        c = mix(c, vec3(0.99, 0.93, 0.8), b2 * 0.35);
        float spot = smoothstep(0.16, 0.0, length(vec2(vP.x / 95.0 - 0.25, lat + 0.22)));
        c = mix(c, vec3(1.0, 0.5, 0.45), spot * 0.6);
        float l = clamp(dot(vN, normalize(lightDir)) * 0.9 + 0.25, 0.0, 1.0);
        vec3 shade = mix(vec3(0.55, 0.48, 0.82), vec3(1.0), l);
        float rim = pow(1.0 - max(vN.z, 0.0), 3.0);
        gl_FragColor = vec4(c * shade * bright + rim * vec3(1.0, 0.9, 0.95) * 0.35, 1.0); }`,
  }));
  W.planet.add(pm);
  const ringGeo = new THREE.RingGeometry(125, 205, 128, 1);
  const rm = new THREE.Mesh(ringGeo, new THREE.ShaderMaterial({
    uniforms: W.planetU, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false,
    vertexShader: 'varying float vR; void main(){ vR = length(position.xy); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float bright; varying float vR;
      void main(){ float t = (vR - 125.0) / 80.0;
        float bands = smoothstep(0.2, 0.8, sin(t * 42.0) * 0.5 + 0.5) * 0.5 + 0.5;
        float gap = smoothstep(0.02, 0.0, abs(t - 0.62)) ;
        float a = smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.85, t) * (0.62 * bands) * (1.0 - gap);
        vec3 c = mix(vec3(1.0, 0.93, 0.82), vec3(0.85, 0.78, 1.0), t);
        gl_FragColor = vec4(c * bright, a); }`,
  }));
  rm.rotation.x = -Math.PI / 2 + 0.38; rm.rotation.y = 0.22;
  W.planet.add(rm);
  // a small companion moon
  const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff3e2, fog: false }));
  moon.position.set(210, 60, -40);
  W.planet.add(moon);
  W.planet.position.set(-300, 250, -700);
  W.planet.rotation.z = 0.28;
  W.planet.traverse((o) => { o.renderOrder = -8; o.frustumCulled = false; });
  W.scene.add(W.planet);
}

/* ---- terrain: recycled chunks, heights from continuous noise ---- */
const XS = [-68, -52, -41, -33, -26.5, -21.5, -17.5, -14.2, -11.6, -9.6, -8.1, -5.4, -2.7, 0, 2.7, 5.4, 8.1, 9.6, 11.6, 14.2, 17.5, 21.5, 26.5, 33, 41, 52, 68];
const CH_L = 24, CH_NZ = 6, CH_N = 10;
function terrainH(x, d) {
  const ax = Math.abs(x);
  const e = smooth(TRACK + 1.0, TRACK + 8.5, ax);
  const n1 = noise2(x * 0.045 + 100, d * 0.028), n2 = noise2(x * 0.14 + 40, d * 0.1);
  let h = e * (0.8 + n1 * 7.8 + n2 * 2.6 + smooth(26, 60, ax) * (4 + n1 * 8));
  h += (1 - e) * (noise2(x * 0.35, d * 0.22) - 0.5) * 0.16;
  return h;
}
function buildTerrain() {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  W.terrU = { uGA: { value: new THREE.Color() }, uGB: { value: new THREE.Color() }, uTrack: { value: new THREE.Color() } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, W.terrU, BEND);
    sh.vertexShader = 'uniform float uBendY;\nuniform float uBendX;\nattribute vec2 aT;\nvarying vec2 vT;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vT = aT;').replace('#include <project_vertex>', BEND_VERT);
    sh.fragmentShader = 'uniform vec3 uGA;\nuniform vec3 uGB;\nuniform vec3 uTrack;\nvarying vec2 vT;\n' +
      sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( vT.y > 0.01 ? uTrack * vT.y : mix( uGA, uGB, vT.x ), opacity );');
  };
  mat.customProgramCacheKey = () => 'terrain';
  W.terrMat = mat;
  const nx = XS.length - 1, tris = nx * CH_NZ * 2;
  for (let i = 0; i < CH_N; i++) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris * 9), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(tris * 9), 3));
    g.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(tris * 6), 2));
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    W.scene.add(m);
    W.chunks.push({ mesh: m, d0: -1e9 });
  }
}
function fillChunk(ch, d0) {
  ch.d0 = d0;
  const g = ch.mesh.geometry, P = g.attributes.position.array, T = g.attributes.aT.array;
  const nx = XS.length - 1, dz = CH_L / CH_NZ;
  const vx = (xi, d) => { const x = XS[xi]; const j = Math.abs(x) > TRACK + 3 && Math.abs(x) < 66 ? (hash2(xi * 7, Math.round(d * 10)) - 0.5) * 2.2 : 0; return x + j; };
  let p = 0, q = 0;
  for (let zi = 0; zi < CH_NZ; zi++) {
    const da = d0 + zi * dz, db = da + dz;
    for (let xi = 0; xi < nx; xi++) {
      const x00 = vx(xi, da), x10 = vx(xi + 1, da), x01 = vx(xi, db), x11 = vx(xi + 1, db);
      const h00 = terrainH(x00, da), h10 = terrainH(x10, da), h01 = terrainH(x01, db), h11 = terrainH(x11, db);
      const onTrack = Math.abs(XS[xi]) <= TRACK + 1.2 && Math.abs(XS[xi + 1]) <= TRACK + 1.2;
      const stripe = Math.floor(da / 8) % 2;
      const quad = [[x00, h00, da, x01, h01, db, x10, h10, da], [x10, h10, da, x01, h01, db, x11, h11, db]];
      for (let k = 0; k < 2; k++) {
        const v = quad[k];
        for (let s = 0; s < 9; s += 3) { P[p++] = v[s]; P[p++] = v[s + 1]; P[p++] = -v[s + 2]; }
        const hAvg = (v[1] + v[4] + v[7]) / 3;
        const tone = clamp(hAvg / 10 + (hash2(xi * 3 + k, Math.round(da * 3)) - 0.5) * 0.16, 0, 1);
        for (let s = 0; s < 3; s++) { T[q++] = tone; T[q++] = onTrack ? (stripe ? 0.955 : 1.0) : 0; }
      }
    }
  }
  g.attributes.position.needsUpdate = true;
  g.attributes.aT.needsUpdate = true;
  g.computeVertexNormals();
}
function resetTerrain(dist) {
  const start = Math.floor((dist - 38) / CH_L) * CH_L;
  W.chunks.forEach((ch, i) => fillChunk(ch, start + i * CH_L));
}
function updateTerrain(dist) {
  // recycle the chunk that has fallen behind the camera
  for (const ch of W.chunks) {
    if (ch.d0 + CH_L < dist - 38) {
      let maxD = -1e9;
      for (const c of W.chunks) maxD = Math.max(maxD, c.d0);
      fillChunk(ch, maxD + CH_L);
      break; // one per frame keeps the frame time flat
    }
  }
}

/* ---- decor: instanced crystals, boulders, puff trees, beacons, clouds ---- */
function makeInst(geo, mat, n) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const c = new THREE.Color(1, 1, 1);
  for (let i = 0; i < n; i++) { m.setMatrixAt(i, hidden); m.setColorAt(i, c); }
  m.userData = { n, next: 0 };
  W.scene.add(m);
  return m;
}
function buildDecor() {
  W.mats.decor = lam(0xb9a8f5);
  W.mats.decorRock = lam(0xe3928a);
  W.mats.stem = lam(0xfff3e2);
  W.mats.tree = lam(0xff9e8f);
  W.mats.beacon = basic(0xfff4e0);
  W.mats.cloud = lam(0xfff1e6, { emissive: 0x6b5a60 });
  const cr = new THREE.OctahedronGeometry(1, 0); cr.scale(0.55, 2.1, 0.55);
  W.inst.crystal = makeInst(cr, W.mats.decor, 40);
  W.inst.rock = makeInst(new THREE.DodecahedronGeometry(1, 0), W.mats.decorRock, 30);
  const stem = new THREE.CylinderGeometry(0.16, 0.28, 1.8, 5); stem.translate(0, 0.9, 0);
  W.inst.stem = makeInst(stem.toNonIndexed(), W.mats.stem, 24);
  const cap = new THREE.IcosahedronGeometry(1, 0); cap.scale(1.2, 0.8, 1.2); cap.translate(0, 2.1, 0);
  W.inst.cap = makeInst(cap, W.mats.tree, 24);
  W.inst.beacon = makeInst(new THREE.OctahedronGeometry(0.2, 0), W.mats.beacon, 44);
  const cl = new THREE.IcosahedronGeometry(1, 1); cl.scale(1, 0.55, 0.8);
  W.inst.cloud = makeInst(cl, W.mats.cloud, 36);
  W.tmpM = new THREE.Matrix4(); W.tmpQ = new THREE.Quaternion(); W.tmpE = new THREE.Euler(); W.tmpV = new THREE.Vector3(); W.tmpS = new THREE.Vector3(); W.tmpC = new THREE.Color();
}
function placeInst(im, x, y, z, rx, ry, rz, sx, sy, sz, tint) {
  const u = im.userData, i = u.next; u.next = (u.next + 1) % u.n;
  W.tmpE.set(rx, ry, rz); W.tmpQ.setFromEuler(W.tmpE);
  W.tmpM.compose(W.tmpV.set(x, y, z), W.tmpQ, W.tmpS.set(sx, sy, sz));
  im.setMatrixAt(i, W.tmpM); im.instanceMatrix.needsUpdate = true;
  if (tint != null) { W.tmpC.setScalar(tint); im.setColorAt(i, W.tmpC); im.instanceColor.needsUpdate = true; }
}
function resetDecor(dist) {
  W.drng = mulberry(hashStr('decor' + (G.seed || 1)));
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  Object.values(W.inst).forEach((im) => { for (let i = 0; i < im.userData.n; i++) im.setMatrixAt(i, hidden); im.userData.next = 0; im.instanceMatrix.needsUpdate = true; });
  W.decorNext = dist - 12; W.beaconNext = Math.ceil((dist - 12) / 10) * 10; W.cloudNext = dist - 10;
  updateDecor(dist);
}
function updateDecor(dist) {
  const r = W.drng, lim = dist + AHEAD, low = S.settings.quality === 'low' || G.lowGfx;
  while (W.decorNext < lim) {
    const d = W.decorNext; W.decorNext += low ? r.range(4, 7) : r.range(2.2, 4);
    const side = r.sign(), x = side * r.range(TRACK + 4.5, 58), y = terrainH(x, d);
    const k = r();
    if (k < 0.4) {
      const s = r.range(0.7, 2.2);
      placeInst(W.inst.crystal, x, y + s * 0.8, -d, r.range(-0.25, 0.25), r() * 3, r.range(-0.3, 0.3), s, s * r.range(0.8, 1.5), s, r.range(0.85, 1.12));
      if (r() < 0.5) placeInst(W.inst.crystal, x + r.range(-2, 2), y + s * 0.4, -d - r.range(-2, 2), r.range(-0.5, 0.5), r() * 3, r.range(-0.5, 0.5), s * 0.5, s * 0.6, s * 0.5, r.range(0.9, 1.15));
    } else if (k < 0.7) {
      const s = r.range(0.8, 2.6);
      placeInst(W.inst.rock, x, y + s * 0.3, -d, r() * 3, r() * 3, r() * 3, s * 1.2, s * 0.8, s, r.range(0.85, 1.1));
    } else {
      const s = r.range(0.8, 1.6), ry = r() * 3;
      placeInst(W.inst.stem, x, y - 0.1, -d, 0, ry, r.range(-0.12, 0.12), s, s, s, 1);
      placeInst(W.inst.cap, x, y - 0.1, -d, 0, ry, r.range(-0.12, 0.12), s, s, s, r.range(0.88, 1.1));
    }
  }
  while (W.beaconNext < lim) {
    const d = W.beaconNext; W.beaconNext += 10;
    placeInst(W.inst.beacon, -(TRACK + 1.1), 0.35, -d, 0, 0, 0, 1, 1.6, 1, null);
    placeInst(W.inst.beacon, TRACK + 1.1, 0.35, -d, 0, 0, 0, 1, 1.6, 1, null);
  }
  while (W.cloudNext < lim + 40) {
    const d = W.cloudNext; W.cloudNext += r.range(16, 30);
    const x = r.sign() * r.range(18, 90), y = r.range(16, 34), s = r.range(3, 6);
    for (let i = 0; i < 3; i++) placeInst(W.inst.cloud, x + (i - 1) * s * 0.9, y + (i === 1 ? s * 0.25 : 0), -d + r.range(-1, 1), 0, r() * 0.4, 0, s * (i === 1 ? 1.2 : 0.85), s * (i === 1 ? 1.2 : 0.85), s, 1);
  }
}

/* ---- zones: blend palettes by distance ---- */
function zoneAt(dist) {
  const f = dist / ZONE_M;
  const i = Math.floor(f), local = (f - i) * ZONE_M;
  return { i: ((i % 4) + 4) % 4, next: (((i + 1) % 4) + 4) % 4, t: smooth(ZONE_M - 110, ZONE_M, local) };
}
function applyZone(dist, feverMix) {
  const z = zoneAt(dist);
  W.zoneIdx = z.t > 0.5 ? z.next : z.i;
  const A = W.zones[z.i], B = W.zones[z.next], P = W.pal;
  for (const k of COLOR_KEYS) P[k].lerpColors(A[k], B[k], z.t);
  if (feverMix > 0) for (const k in W.gold) P[k].lerp(W.gold[k], feverMix * 0.5);
  const da = ZONE_DEF[z.i], db = ZONE_DEF[z.next];
  const sunI = lerp(da.sunI, db.sunI, z.t), hemiI = lerp(da.hemiI, db.hemiI, z.t);
  const stars = lerp(da.stars, db.stars, z.t), planet = lerp(da.planet, db.planet, z.t);
  W.sunDir.set(lerp(da.sunDir[0], db.sunDir[0], z.t), lerp(da.sunDir[1], db.sunDir[1], z.t), -1).normalize();

  W.skyU.top.value.copy(P.skyTop); W.skyU.hor.value.copy(P.skyHor); W.skyU.sunCol.value.copy(P.sun); W.skyU.sunDir.value.copy(W.sunDir);
  W.scene.fog.color.copy(P.skyHor);
  W.renderer.setClearColor(P.skyHor, 1);
  W.terrU.uGA.value.copy(P.gA); W.terrU.uGB.value.copy(P.gB); W.terrU.uTrack.value.copy(P.track);
  W.hemi.color.copy(P.hemiS); W.hemi.groundColor.copy(P.hemiG); W.hemi.intensity = hemiI;
  W.sunLight.color.copy(P.sun); W.sunLight.intensity = sunI;
  W.starU.op.value = stars;
  W.planetU.bright.value = planet;
  const hc = S.settings.contrast;
  W.mats.hazard.color.copy(hc ? W.inkHaz : P.hazard);
  W.mats.wall.color.copy(hc ? W.inkHaz : P.wall);
  W.mats.rock.color.copy(hc ? W.inkHaz : P.rock);
  W.mats.decor.color.copy(P.decor);
  W.mats.decorRock.color.copy(P.rock).lerp(P.gB, 0.35);
  W.mats.tree.color.copy(P.tree);
  W.mats.beacon.color.copy(P.beacon);
  W.mats.cloud.color.copy(P.cloud);
  W.mats.stem.color.copy(P.track);
  return z;
}
function clockAt(dist) {
  const h = (5.5 + (dist / DAY_M) * 24) % 24;
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 6) * 10;
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

function skyFollow(cam) {
  W.sky.position.copy(cam.position);
  W.stars.position.copy(cam.position);
  // the gas giant drifts right in the menu so it frames the logo instead of hiding behind it
  const menu = G.state === 'menu' || G.state === 'boot';
  W.planetX = W.planetX == null ? (menu ? 260 : -300) : lerp(W.planetX, menu ? 260 : -300, 0.02);
  W.planet.position.set(cam.position.x + W.planetX, 250, cam.position.z - 700);
  W.sunLight.position.copy(cam.position).addScaledVector(W.sunDir, 50);
  W.sunLight.target.position.copy(cam.position);
  W.nm = W.nm || new THREE.Matrix3();
  W.planetU.lightDir.value.copy(W.sunDir).applyMatrix3(W.nm.getNormalMatrix(cam.matrixWorldInverse)).normalize();
}
