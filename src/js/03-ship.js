/* ============ ships, trails, ghost ============ */
const SKINS = [
  { id: 'kite', price: 0, body: '#FFF3E2', wing: '#FFFAF2', accent: '#FF7A6B', glass: '#5B5590', trail: '#FFFFFF', flame: '#FFE07A', span: 1.25, sweep: 0.55, fins: 1,
    name: { en: 'Paper Kite', ru: 'Бумажный змей' }, desc: { en: 'The courier line’s trusty default. Light, cheerful, easy to spot.', ru: 'Надёжная классика курьерской линии. Лёгкий, весёлый, заметный.' } },
  { id: 'mint', price: 150, body: '#8FD9C1', wing: '#EAFBF3', accent: '#2F2A55', glass: '#2F2A55', trail: '#D2F6EA', flame: '#FFF3E2', span: 1.35, sweep: 0.3, fins: 2,
    name: { en: 'Mint Julep', ru: 'Мятный джулеп' }, desc: { en: 'Twin fins and a straight wing. Looks fast even parked.', ru: 'Два киля и прямое крыло. Выглядит быстрым даже на стоянке.' } },
  { id: 'moth', price: 400, body: '#B9A8F5', wing: '#E6DDFF', accent: '#FFE07A', glass: '#2F2A55', trail: '#E6DDFF', flame: '#FFE07A', span: 1.6, sweep: 0.15, fins: 1,
    name: { en: 'Lilac Moth', ru: 'Сиреневая моль' }, desc: { en: 'Broad soft wings for night shifts under the rings.', ru: 'Широкие мягкие крылья для ночных смен под кольцами.' } },
  { id: 'comet', price: 800, body: '#FF7A6B', wing: '#FFC9A3', accent: '#FFF3E2', glass: '#2F2A55', trail: '#FFD3C4', flame: '#FFF3E2', span: 1.05, sweep: 0.95, fins: 2,
    name: { en: 'Coral Comet', ru: 'Коралловая комета' }, desc: { en: 'Swept back like an arrow. Leaves a peach-pink wake.', ru: 'Стреловидные крылья и персиково-розовый след.' } },
  { id: 'gold', price: 1500, body: '#FFE07A', wing: '#FFF6D2', accent: '#FF7A6B', glass: '#2F2A55', trail: '#FFF0A8', flame: '#FF7A6B', span: 1.42, sweep: 0.62, fins: 2,
    name: { en: 'Golden Hour', ru: 'Золотой час' }, desc: { en: 'For couriers who have seen every sunset on Nectar.', ru: 'Для курьеров, видевших все закаты Нектара.' } },
];
const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

function flatGeo(g) { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; }
function wingGeo(pts, depth) {
  const sh = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
  g.rotateX(Math.PI / 2); g.translate(0, depth / 2, 0);
  return flatGeo(g);
}

function buildShipMesh(skin, ghostMat) {
  const grp = new THREE.Group();
  const M = ghostMat ? () => ghostMat : (hex, o) => lam(hex, o);
  const mBody = M(skin.body), mWing = M(skin.wing, { side: THREE.DoubleSide }), mAcc = M(skin.accent, { side: THREE.DoubleSide }), mGlass = M(skin.glass), mInk = M('#2F2A55');
  const nose = new THREE.CylinderGeometry(0.06, 0.34, 1.6, 6); nose.rotateX(-Math.PI / 2); nose.scale(1, 0.62, 1); nose.translate(0, 0, -0.35);
  const tail = new THREE.CylinderGeometry(0.34, 0.24, 0.5, 6); tail.rotateX(-Math.PI / 2); tail.scale(1, 0.62, 1); tail.translate(0, 0, 0.7);
  grp.add(new THREE.Mesh(flatGeo(nose), mBody), new THREE.Mesh(flatGeo(tail), mBody));
  const dome = new THREE.SphereGeometry(0.22, 7, 4, 0, TAU, 0, Math.PI / 2); dome.scale(1, 0.85, 1.7);
  const cockpit = new THREE.Mesh(flatGeo(dome), mGlass); cockpit.position.set(0, 0.1, -0.2);
  grp.add(cockpit);
  const sp = skin.span, sw = skin.sweep;
  const wing = [[0.16, -0.28], [sp, 0.08 + sw * 0.45], [sp - 0.06, 0.34 + sw * 0.45], [0.16, 0.62]];
  const f = 0.7, tf = [sp, 0.08 + sw * 0.45], tb = [sp - 0.06, 0.34 + sw * 0.45];
  const tipA = [[0.16 + (tf[0] - 0.16) * f, -0.28 + (tf[1] + 0.28) * f], tf, tb, [0.16 + (tb[0] - 0.16) * f, 0.62 + (tb[1] - 0.62) * f]];
  const wr = wingGeo(wing, 0.06), ta = wingGeo(tipA, 0.075);
  const L = new THREE.Group(), R = new THREE.Group();
  R.add(new THREE.Mesh(wr, mWing), new THREE.Mesh(ta, mAcc));
  L.add(new THREE.Mesh(wr, mWing), new THREE.Mesh(ta, mAcc)); L.scale.x = -1;
  R.rotation.z = 0.08; L.rotation.z = -0.08;
  grp.add(L, R);
  // fin lives in the y/z plane
  const finShape = new THREE.Shape([new THREE.Vector2(0.25, 0), new THREE.Vector2(0.95, 0), new THREE.Vector2(0.85, 0.5)]);
  const fg = new THREE.ExtrudeGeometry(finShape, { depth: 0.045, bevelEnabled: false }); fg.rotateY(-Math.PI / 2); fg.translate(0.022, 0.12, 0);
  const finGeo = flatGeo(fg);
  if (skin.fins === 1) { const f = new THREE.Mesh(finGeo, mAcc); grp.add(f); }
  else { [-1, 1].forEach((s) => { const f = new THREE.Mesh(finGeo, mAcc); f.position.x = s * 0.26; f.rotation.z = s * -0.3; grp.add(f); }); }
  const eng = new THREE.CylinderGeometry(0.2, 0.25, 0.14, 6); eng.rotateX(Math.PI / 2); eng.translate(0, 0, 0.98);
  grp.add(new THREE.Mesh(flatGeo(eng), ghostMat ? mInk : M(skin.accent)));
  let flame = null;
  if (!ghostMat) {
    const fl = new THREE.ConeGeometry(0.13, 0.5, 6); fl.rotateX(Math.PI / 2); fl.translate(0, 0, 0.25);
    flame = new THREE.Mesh(fl, basic(skin.flame, { transparent: true, opacity: 0.75, depthWrite: false }));
    flame.position.z = 1.05;
    grp.add(flame);
  }
  grp.traverse((o) => { o.frustumCulled = false; });
  return { grp, flame, tips: [new THREE.Vector3(-sp + 0.03, 0.05, 0.25 + sw * 0.45), new THREE.Vector3(sp - 0.03, 0.05, 0.25 + sw * 0.45)] };
}

class Trail {
  constructor(n, color) {
    this.n = n; this.c = []; this.o = []; this.count = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3); this.col = new Float32Array(n * 2 * 4);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.mat = basic(0xffffff, { transparent: true, vertexColors: true, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false;
    this.color = new THREE.Color(color);
    for (let i = 0; i < n; i++) { this.c.push(new THREE.Vector3()); this.o.push(new THREE.Vector3()); }
  }
  reset() { this.count = 0; this.col.fill(0); this.mesh.geometry.attributes.color.needsUpdate = true; }
  push(p, side, w) {
    const last = this.c.pop(), lo = this.o.pop();
    last.copy(p); lo.copy(side).multiplyScalar(w);
    this.c.unshift(last); this.o.unshift(lo);
    this.count = Math.min(this.n, this.count + 1);
    const P = this.pos, C = this.col, col = this.color, maxLen = this.maxLen || 6.5;
    let cum = 0;
    for (let i = 0; i < this.n; i++) {
      if (i > 0 && i < this.count) cum += this.c[i].distanceTo(this.c[i - 1]);
      const k = clamp(cum / maxLen, 0, 1), taper = 1 - k, a = i < this.count ? Math.pow(1 - k, 1.6) * 0.85 : 0;
      const c = this.c[i], o = this.o[i];
      P[i * 6] = c.x + o.x * taper; P[i * 6 + 1] = c.y + o.y * taper; P[i * 6 + 2] = c.z + o.z * taper;
      P[i * 6 + 3] = c.x - o.x * taper; P[i * 6 + 4] = c.y - o.y * taper; P[i * 6 + 5] = c.z - o.z * taper;
      for (let s = 0; s < 2; s++) { const j = (i * 2 + s) * 4; C[j] = col.r; C[j + 1] = col.g; C[j + 2] = col.b; C[j + 3] = a; }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }
}

const Ship = {
  root: null, model: null, skin: null, trails: [], shadow: null, shield: null, ghost: null, ghostTag: null,
  init() {
    this.root = new THREE.Group();
    W.scene.add(this.root);
    this.trails = [new Trail(26, '#ffffff'), new Trail(26, '#ffffff')];
    this.trails.forEach((tr) => W.scene.add(tr.mesh));
    const sh = new THREE.CircleGeometry(0.7, 18); sh.rotateX(-Math.PI / 2); sh.scale(1.6, 1, 0.9);
    this.shadow = new THREE.Mesh(sh, W.mats.shadow); this.shadow.frustumCulled = false;
    W.scene.add(this.shadow);
    this.shieldMat = basic(0x8fd9c1, { transparent: true, opacity: 0.3, depthWrite: false });
    this.shield = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 1), this.shieldMat);
    this.shield.scale.set(1.4, 0.8, 1.2); this.shield.visible = false; this.shield.frustumCulled = false;
    this.root.add(this.shield);
    this.ghostMat = basic(0xffffff, { transparent: true, opacity: 0.38, depthWrite: false });
    this.setSkin(S.skin);
  },
  setSkin(id) {
    this.skin = skinById(id);
    if (this.model) this.root.remove(this.model.grp);
    this.model = buildShipMesh(this.skin);
    this.root.add(this.model.grp);
    this.trails.forEach((tr) => { tr.color.set(this.skin.trail); tr.reset(); });
    // ghost uses the same silhouette
    if (this.ghost) W.scene.remove(this.ghost.grp);
    this.ghost = buildShipMesh(this.skin, this.ghostMat);
    this.ghost.grp.visible = false;
    W.scene.add(this.ghost.grp);
  },
  pose(x, y, z, bank, pitch, roll) {
    const r = this.root;
    r.position.set(x, y, z);
    r.rotation.set(pitch, 0, bank + roll, 'YXZ');
  },
  updateTrails(visible) {
    const m = this.model;
    this.root.updateMatrixWorld(true);
    const side = W.tmpS.set(1, 0, 0).applyQuaternion(this.root.quaternion).normalize();
    m.tips.forEach((tp, i) => {
      const p = W.tmpV.copy(tp).applyMatrix4(this.root.matrixWorld);
      this.trails[i].mesh.visible = visible;
      this.trails[i].push(p, side, 0.055);
    });
  },
  resetTrails() { this.trails.forEach((tr) => tr.reset()); },
};
