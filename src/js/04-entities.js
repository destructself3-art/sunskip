/* ============ entities: hazards, pickups, meteors, milestones — all placed by distance ============ */
const GEO = {};
function initGeo() {
  const spire = new THREE.OctahedronGeometry(1, 0); spire.scale(1, 2.6, 1); spire.translate(0, 2.3, 0);
  GEO.spire = spire;
  const spireB = new THREE.OctahedronGeometry(1, 0); spireB.scale(0.55, 1.3, 0.55); spireB.translate(0.7, 1.1, 0.3);
  GEO.spireB = spireB;
  const pillar = new THREE.DodecahedronGeometry(1, 0); pillar.scale(1.35, 1.9, 1.35); pillar.translate(0, 1.6, 0);
  GEO.pillar = pillar;
  GEO.boulder = new THREE.IcosahedronGeometry(1.15, 0);
  const ridge = new THREE.BoxGeometry(1, 0.7, 1.1); ridge.translate(0, 0.35, 0);
  GEO.ridge = flatGeo(ridge);
  const ridgeTop = new THREE.CylinderGeometry(0.55, 0.55, 1, 3); ridgeTop.rotateZ(Math.PI / 2); ridgeTop.scale(1, 0.5, 1); ridgeTop.translate(0, 0.7, 0);
  GEO.ridgeTop = flatGeo(ridgeTop);
  const wall = new THREE.BoxGeometry(1, 3.4, 0.9); wall.translate(0, 1.7, 0);
  GEO.wall = flatGeo(wall);
  const post = new THREE.CylinderGeometry(0.45, 0.55, 4.2, 6); post.translate(0, 2.1, 0);
  GEO.post = flatGeo(post);
  GEO.shard = new THREE.OctahedronGeometry(0.34, 0);
  GEO.shardCore = new THREE.OctahedronGeometry(0.16, 0);
  GEO.ring = flatGeo(new THREE.TorusGeometry(1.3, 0.16, 5, 18));
  GEO.orb = new THREE.IcosahedronGeometry(0.62, 1);
  const mk = new THREE.RingGeometry(0.9, 1.25, 20); mk.rotateX(-Math.PI / 2); mk.translate(0, 0.06, 0);
  GEO.marker = mk;
  const mkIn = new THREE.CircleGeometry(0.55, 16); mkIn.rotateX(-Math.PI / 2); mkIn.translate(0, 0.05, 0);
  GEO.markerIn = mkIn;
  GEO.meteor = new THREE.DodecahedronGeometry(0.95, 0);
  const tail = new THREE.ConeGeometry(0.7, 5, 6, 1, true); tail.translate(0, 2.5, 0);
  GEO.meteorTail = tail;
  const arch = new THREE.TorusGeometry(12.5, 0.7, 5, 28, Math.PI); GEO.arch = flatGeo(arch);
  const pole = new THREE.CylinderGeometry(0.07, 0.07, 4, 5); pole.translate(0, 2, 0); GEO.pole = pole;
  const dust = new THREE.CircleGeometry(1, 14); dust.rotateX(-Math.PI / 2); GEO.shadow = dust;
}

const POOL = {};
function pooled(kind, make) {
  const p = POOL[kind] || (POOL[kind] = []);
  const o = p.find((m) => !m.userData.live);
  if (o) { o.userData.live = true; o.visible = true; return o; }
  const m = make(); m.userData.live = true; m.frustumCulled = false;
  m.traverse((c) => { c.frustumCulled = false; });
  W.scene.add(m); p.push(m);
  return m;
}
function release(m) { m.userData.live = false; m.visible = false; }

const MK = {
  spire() { const g = new THREE.Group(); g.add(new THREE.Mesh(GEO.spire, W.mats.hazard), new THREE.Mesh(GEO.spireB, W.mats.hazard)); return g; },
  pillar() { return new THREE.Mesh(GEO.pillar, W.mats.rock); },
  boulder() { return new THREE.Mesh(GEO.boulder, W.mats.rock); },
  ridge() { const g = new THREE.Group(); g.add(new THREE.Mesh(GEO.ridge, W.mats.wall), new THREE.Mesh(GEO.ridgeTop, W.mats.wall)); return g; },
  wall() { return new THREE.Mesh(GEO.wall, W.mats.wall); },
  post() { return new THREE.Mesh(GEO.post, W.mats.hazard); },
  shard() { const g = new THREE.Group(); g.add(new THREE.Mesh(GEO.shard, W.mats.shard), new THREE.Mesh(GEO.shardCore, W.mats.shardCore)); return g; },
  ring() { return new THREE.Mesh(GEO.ring, W.mats.ring); },
  orb() {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(GEO.orb, basic(0xffffff, { transparent: true, opacity: 0.55, depthWrite: false }));
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), lam(0xff7a6b));
    g.add(shell, core); g.userData.core = core; return g;
  },
  marker() { const g = new THREE.Group(); g.add(new THREE.Mesh(GEO.marker, W.mats.marker), new THREE.Mesh(GEO.markerIn, W.mats.marker)); return g; },
  meteor() {
    const g = new THREE.Group(); const rock = new THREE.Mesh(GEO.meteor, W.mats.ink);
    const tail = new THREE.Mesh(GEO.meteorTail, basic(0xffc98a, { transparent: true, opacity: 0.55, depthWrite: false }));
    tail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.35, 1.2, -0.35).normalize());
    g.add(rock, tail); g.userData.tail = tail; g.userData.rock = rock; return g;
  },
  ember() { const g = new THREE.Group(); const rock = new THREE.Mesh(GEO.meteor, W.mats.ink); rock.scale.set(1, 0.7, 1); rock.position.y = 0.55; const glow = new THREE.Mesh(GEO.markerIn, W.mats.ember); glow.scale.setScalar(2); g.add(rock, glow); return g; },
  shadow() { return new THREE.Mesh(GEO.shadow, W.mats.shadow); },
};

/* label planes (milestones, best flag) */
function labelTex(text, sub, bg, fg) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.strokeStyle = '#2F2A55'; x.lineWidth = 14;
  const r = 60; x.beginPath(); x.moveTo(r, 10); x.arcTo(502, 10, 502, 246, r); x.arcTo(502, 246, 10, 246, r); x.arcTo(10, 246, 10, 10, r); x.arcTo(10, 10, 502, 10, r); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '400 92px "Dela Gothic One", "Arial Black", sans-serif'; x.fillText(text, 256, sub ? 110 : 128);
  if (sub) { x.font = '800 38px "M PLUS Rounded 1c", sans-serif'; x.fillText(sub, 256, 196); }
  const tx = new THREE.CanvasTexture(c); tx.anisotropy = 4; return tx;
}
function labelMesh(tex, w) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), basic(0xffffff, { map: tex, transparent: true })); m.frustumCulled = false; return m; }

/* ---------- entity list ---------- */
const ENT = [];
function addEnt(e) { ENT.push(e); return e; }
function clearEnts() { for (const e of ENT) { if (e.mesh) release(e.mesh); if (e.extra) e.extra.forEach(release); } ENT.length = 0; }

function E_spire(d, x, s = 1) { const m = pooled('spire', MK.spire); m.position.set(x, 0, -d); m.scale.setScalar(s * 0.85); m.rotation.y = hash2(d * 10, x * 10) * 3; return addEnt({ t: 'spire', d, x, r: 0.95 * s * 0.85, h: 99, mesh: m }); }
function E_pillar(d, x) { const m = pooled('pillar', MK.pillar); m.position.set(x, 0, -d); m.rotation.y = hash2(d, x) * 3; return addEnt({ t: 'pillar', d, x, r: 1.35, h: 99, mesh: m }); }
function E_post(d, x) { const m = pooled('post', MK.post); m.position.set(x, 0, -d); return addEnt({ t: 'post', d, x, r: 0.5, h: 99, mesh: m }); }
function E_boulder(d, x0, amp, k, ph) { const m = pooled('boulder', MK.boulder); m.position.set(x0, 1.15, -d); const sh = pooled('shadow', MK.shadow); sh.position.set(x0, 0.04, -d); sh.scale.setScalar(1.2); return addEnt({ t: 'boulder', d, x: x0, x0, amp, k, ph, r: 1.1, h: 99, mesh: m, extra: [sh] }); }
function E_ridge(d, x1 = -TRACK - 1, x2 = TRACK + 1) { const m = pooled('ridge', MK.ridge); const w = x2 - x1; m.position.set((x1 + x2) / 2, 0, -d); m.scale.set(w, 1, 1); return addEnt({ t: 'ridge', d, x1, x2, h: 0.95, mesh: m }); }
function E_gate(d, gx, gw) {
  const L = pooled('wall', MK.wall), R = pooled('wall', MK.wall);
  const a = -TRACK - 1.5, b = gx - gw / 2, c = gx + gw / 2, e = TRACK + 1.5;
  L.position.set((a + b) / 2, 0, -d); L.scale.set(Math.max(0.01, b - a), 1, 1);
  R.position.set((c + e) / 2, 0, -d); R.scale.set(Math.max(0.01, e - c), 1, 1);
  const pl = pooled('post', MK.post), pr = pooled('post', MK.post);
  pl.position.set(b - 0.3, 0, -d); pr.position.set(c + 0.3, 0, -d);
  return addEnt({ t: 'gate', d, gx, gw, h: 99, mesh: L, extra: [R, pl, pr] });
}
function E_shard(d, x, y = 0.95) { const m = pooled('shard', MK.shard); m.position.set(x, y, -d); m.scale.setScalar(1); return addEnt({ t: 'shard', d, x, y, mesh: m }); }
function E_ring(d, x) { const m = pooled('ring', MK.ring); m.position.set(x, 1.05, -d); m.scale.setScalar(1); return addEnt({ t: 'ring', d, x, mesh: m }); }
function E_power(d, x, kind) {
  const m = pooled('orb', MK.orb);
  const col = { magnet: 0xff7a6b, shield: 0x8fd9c1, comet: 0xffe07a }[kind];
  m.userData.core.material.color.setHex(col);
  m.position.set(x, 1.1, -d);
  return addEnt({ t: 'power', d, x, kind, mesh: m });
}
function E_meteor(d, x) {
  const mk = pooled('marker', MK.marker); mk.position.set(x, 0, -d); mk.scale.setScalar(0.01);
  const mt = pooled('meteor', MK.meteor); mt.visible = false; mt.userData.tail.visible = true; mt.userData.rock.scale.setScalar(1); mt.userData.rock.position.set(0, 0, 0);
  return addEnt({ t: 'meteor', d, x, landed: false, mesh: mk, extra: [mt], r: 1.0, h: 0.95 });
}
function E_arch(d, n) {
  const a = pooled('arch', () => new THREE.Mesh(GEO.arch, W.mats.cream)); a.position.set(0, 0, -d);
  const lb = labelMesh(labelTex(fmt(n), 'm', '#FFE07A', '#2F2A55'), 7);
  lb.position.set(0, 12.6, -d + 0.8); W.scene.add(lb);
  return addEnt({ t: 'arch', d, mesh: a, label: lb, n });
}
function E_flag(d, text) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(GEO.pole, W.mats.ink);
  const lb = labelMesh(labelTex(text, t('ghostBest').toUpperCase(), '#FF7A6B', '#2F2A55'), 3.2);
  lb.position.set(1.5, 3.2, 0);
  g.add(pole, lb); g.position.set(TRACK + 1.6, 0, -d);
  g.traverse((o) => { o.frustumCulled = false; });
  W.scene.add(g);
  return addEnt({ t: 'flag', d, group: g });
}
function disposeLabel(e) {
  if (e.label) { W.scene.remove(e.label); e.label.material.map.dispose(); e.label.material.dispose(); e.label.geometry.dispose(); }
  if (e.group) { e.group.traverse((o) => { if (o.material && o.material.map) { o.material.map.dispose(); o.material.dispose(); } }); W.scene.remove(e.group); }
}

/* ---------- spawner: deterministic patterns keyed on distance ---------- */
const PATTERNS = {
  spires(d, r, k) {
    const n = r.int(2, 3 + Math.round(k * 2));
    let len = 0;
    for (let i = 0; i < n; i++) {
      const dd = d + i * r.range(9, 15) * (1.15 - k * 0.3); len = dd - d;
      E_spire(dd, r.range(-TRACK + 1, TRACK - 1), r.range(0.9, 1.25));
    }
    for (let i = 0; i < 5; i++) E_shard(d + len / 2 - 8 + i * 4, Math.sin(i * 0.9 + r() * 3) * 3.5);
    return len + 6;
  },
  gate(d, r, k) {
    const gw = lerp(4.8, 3.2, k), gx = r.range(-TRACK + gw / 2 + 0.6, TRACK - gw / 2 - 0.6);
    E_gate(d + 4, gx, gw);
    for (let i = 0; i < 4; i++) E_shard(d - 4 + i * 3, lerp(0, gx, i / 3));
    return 8;
  },
  ridge(d, r) {
    E_ridge(d + 6);
    for (let i = 0; i < 5; i++) { const u = i / 4; E_shard(d + 6 - 4.4 + u * 8.8, r.range(-0.4, 0.4), 1.0 + Math.sin(u * Math.PI) * 1.35); }
    return 12;
  },
  doubleRidge(d, r) {
    E_ridge(d + 4); E_ridge(d + 4 + r.range(16, 20));
    E_shard(d + 14, r.range(-4, 4)); E_shard(d + 15.5, r.range(-4, 4));
    return 26;
  },
  slalom(d, r, k) {
    const n = 4 + Math.round(k * 3), s = r.sign();
    for (let i = 0; i < n; i++) {
      const side = (i % 2 ? 1 : -1) * s;
      E_post(d + i * lerp(11, 8, k), side * r.range(1.2, 3.2));
      E_shard(d + i * lerp(11, 8, k) + 4, -side * 3.5);
    }
    return n * lerp(11, 8, k);
  },
  boulders(d, r, k) {
    const n = k > 0.4 ? 2 : 1;
    for (let i = 0; i < n; i++) E_boulder(d + i * 16, r.range(-3, 3), r.range(3, 5.5), r.range(0.1, 0.18), r() * TAU);
    for (let i = 0; i < 3; i++) E_shard(d + 8 + i * 3, r.range(-5, 5));
    return n * 16;
  },
  rings(d, r) {
    const n = r.int(3, 5), a = r.range(-3, 3), ph = r() * TAU;
    for (let i = 0; i < n; i++) E_ring(d + i * 13, clamp(a + Math.sin(ph + i * 0.9) * 3.8, -TRACK + 1.5, TRACK - 1.5));
    return n * 13;
  },
  field(d, r, k) {
    // a crystal field with a winding safe lane
    const len = 44 + k * 20; let lane = r.range(-3, 3);
    for (let dd = 0; dd < len; dd += 7) {
      lane = clamp(lane + r.range(-2.2, 2.2), -TRACK + 2.2, TRACK - 2.2);
      for (let x = -TRACK + 0.8; x <= TRACK - 0.8; x += r.range(2.4, 3.4)) {
        if (Math.abs(x - lane) > 2.3) E_spire(d + dd + r.range(-1, 1), x, r.range(0.55, 0.8));
      }
      E_shard(d + dd + 3.5, lane);
    }
    return len;
  },
  gateRidge(d, r, k) {
    PATTERNS.gate(d, r, k); E_ridge(d + 18);
    return 22;
  },
  shardSnake(d, r) {
    const a = r.range(-2, 2), ph = r() * TAU;
    for (let i = 0; i < 10; i++) E_shard(d + i * 3.2, clamp(a + Math.sin(ph + i * 0.45) * 4.5, -TRACK + 0.8, TRACK - 0.8));
    E_spire(d + 16, r.sign() * (TRACK - 0.8), 1);
    return 32;
  },
};
const PAT_TABLE = [
  // [name, weight at start, weight at max difficulty, unlock distance]
  ['spires', 3, 2, 0], ['gate', 2, 3, 150], ['ridge', 2, 2, 250], ['slalom', 2, 2, 350], ['rings', 1.5, 1.2, 200],
  ['shardSnake', 1.5, 0.6, 0], ['boulders', 0, 2, 900], ['field', 0, 2, 1200], ['doubleRidge', 0, 1.5, 700], ['gateRidge', 0, 2, 1600],
];
function pickPattern(r, d) {
  const k = clamp(d / 6000, 0, 1);
  const opts = PAT_TABLE.filter((p) => d >= p[3]).map((p) => [p[0], lerp(p[1], p[2], k)]);
  let total = opts.reduce((s, o) => s + o[1], 0), x = r() * total;
  for (const o of opts) { x -= o[1]; if (x <= 0) return o[0]; }
  return opts[0][0];
}

const TUTORIAL_SCRIPT = [
  [70, (d) => { for (let i = 0; i < 6; i++) E_shard(d + i * 3.5, Math.sin(i * 0.8) * 3); return 22; }],
  [140, (d) => { E_spire(d, -3.2); E_spire(d + 14, 3.2); for (let i = 0; i < 4; i++) E_shard(d + 6 + i * 2, 0); return 20; }],
  [240, (d) => { for (let i = 0; i < 5; i++) E_shard(d + i * 3, 3 - i * 1.5); return 15; }],
  [320, (d, r) => PATTERNS.ridge(d, r)],
  [400, (d) => { E_ridge(d); E_shard(d, 0, 2.2); return 8; }],
  [470, (d) => { E_gate(d, 0, 4.8); E_shard(d, 0); return 10; }],
  [560, (d, r) => PATTERNS.rings(d, r)],
];

const Spawner = {
  next: 0, rng: null, powerNext: 0, showerNext: 0, archNext: 1000, tutorialIdx: 0, flagDone: false,
  reset(seed, tutorial) {
    this.rng = mulberry(seed);
    this.prng = mulberry(seed ^ 0x9e3779b9);
    this.next = tutorial ? 70 : 60;
    this.tutorial = tutorial;
    this.tutorialIdx = 0;
    this.powerNext = 420 + this.prng() * 200;
    this.showerNext = 1500 + this.prng() * 300;
    this.archNext = 1000;
    this.flagDone = false;
    this.inShower = 0;
  },
  update(dist) {
    const lim = dist + AHEAD - 10;
    while (this.next < lim) {
      const d = this.next;
      if (this.tutorial && d < 640) {
        const step = TUTORIAL_SCRIPT[this.tutorialIdx];
        if (step && d >= step[0] - 1) { const len = step[1](Math.max(d, step[0]), this.rng); this.tutorialIdx++; this.next = Math.max(d, step[0]) + len + 20; }
        else this.next = step ? step[0] : 640;
        continue;
      }
      const k = clamp(d / 6000, 0, 1);
      if (d >= this.powerNext) {
        const kinds = ['magnet', 'shield', 'comet'];
        E_power(d + 4, this.prng.range(-4.5, 4.5), kinds[Math.floor(this.prng() * 3)]);
        this.powerNext += 620 + this.prng() * 260;
        this.next = d + 18;
        continue;
      }
      if (d >= this.showerNext) {
        const n = 9 + Math.round(k * 6);
        for (let i = 0; i < n; i++) E_meteor(d + 30 + i * (240 / n) + this.prng.range(-6, 6), this.prng.range(-TRACK + 1, TRACK - 1));
        addEnt({ t: 'showerStart', d: d + 10 });
        addEnt({ t: 'showerEnd', d: d + 290 });
        this.showerNext += 1300 + this.prng() * 300;
        this.next = d + 30;
        this.inShower = d + 290;
        continue;
      }
      const name = pickPattern(this.rng, d);
      const len = PATTERNS[name](d, this.rng, k);
      const gap = lerp(34, 17, k) + this.rng() * 10 + (d < this.inShower ? 22 : 0);
      this.next = d + len + gap;
    }
    while (this.archNext < lim) { E_arch(this.archNext, this.archNext); this.archNext += 1000; }
    if (!this.flagDone && G.bestDistForFlag > 200 && G.bestDistForFlag < lim) { E_flag(G.bestDistForFlag, fmt(G.bestDistForFlag) + ' m'); this.flagDone = true; }
  },
};
