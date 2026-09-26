/* ============ effects: particles, debris, screen popups ============ */
const FX = {
  N: 600, i: 0,
  init() {
    const N = this.N;
    this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 3); this.alpha = new Float32Array(N); this.size = new Float32Array(N);
    this.vel = new Float32Array(N * 3); this.life = new Float32Array(N); this.max = new Float32Array(N); this.grav = new Float32Array(N); this.drag = new Float32Array(N); this.s0 = new Float32Array(N);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('pcol', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1));
    this.u = { pr: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: Object.assign(this.u, BEND), transparent: true, depthWrite: false,
      vertexShader: `attribute vec3 pcol; attribute float alpha; attribute float psize; uniform float uBendY; uniform float uBendX; uniform float pr; varying vec3 vC; varying float vA;
        void main(){ vC = pcol; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); float bz = min(mv.z + 2.0, 0.0); mv.y -= bz * bz * uBendY; mv.x += bz * bz * uBendX;
          gl_PointSize = psize * pr * (240.0 / max(-mv.z, 0.5)); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard; float a = smoothstep(0.5, 0.18, d); gl_FragColor = vec4(mix(vC, vec3(1.0), smoothstep(0.25, 0.0, d) * 0.5), a * vA); }',
    });
    this.points = new THREE.Points(g, mat); this.points.frustumCulled = false; this.points.renderOrder = 5;
    W.scene.add(this.points);
    this.c = new THREE.Color();
    // debris for the crash
    this.debris = [];
    const dg = new THREE.TetrahedronGeometry(0.28, 0);
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(dg, lam(0xffffff)); m.visible = false; m.frustumCulled = false;
      W.scene.add(m); this.debris.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), life: 0 });
    }
  },
  emit(x, y, z, o) {
    const n = o.n || 8, col = this.c.set(o.color || '#ffffff');
    for (let k = 0; k < n; k++) {
      const i = this.i; this.i = (this.i + 1) % this.N;
      const sp = (o.speed || 4) * (0.4 + Math.random() * 0.6), th = Math.random() * TAU, ph = (o.flat ? 0.08 : 1) * (Math.random() - 0.35) * Math.PI;
      this.pos[i * 3] = x + (Math.random() - 0.5) * (o.jitter || 0.3);
      this.pos[i * 3 + 1] = y + (Math.random() - 0.5) * (o.jitter || 0.3);
      this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * (o.jitter || 0.3);
      this.vel[i * 3] = Math.cos(th) * Math.cos(ph) * sp + (o.vx || 0);
      this.vel[i * 3 + 1] = Math.sin(ph) * sp + (o.vy || 0);
      this.vel[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * sp + (o.vz || 0);
      const cc = o.colors ? this.c.set(o.colors[k % o.colors.length]) : col;
      this.col[i * 3] = cc.r; this.col[i * 3 + 1] = cc.g; this.col[i * 3 + 2] = cc.b;
      this.max[i] = this.life[i] = (o.life || 0.7) * (0.6 + Math.random() * 0.6);
      this.grav[i] = o.grav != null ? o.grav : -6; this.drag[i] = o.drag || 1.5;
      this.s0[i] = (o.size || 0.5) * (0.6 + Math.random() * 0.7);
    }
  },
  crash(x, y, z, skin) {
    const cols = [skin.body, skin.wing, skin.accent, '#2F2A55'];
    this.debris.forEach((p, i) => {
      p.m.visible = true; p.life = 2.2;
      p.m.material.color.set(cols[i % cols.length]);
      p.m.position.set(x + (Math.random() - 0.5), y + Math.random() * 0.4, z + (Math.random() - 0.5));
      p.v.set((Math.random() - 0.5) * 12, 4 + Math.random() * 7, -4 - Math.random() * 10);
      p.w.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
      p.m.scale.setScalar(0.6 + Math.random() * 1.2);
    });
    this.emit(x, y, z, { n: 40, colors: ['#FFF3E2', '#FFE07A', '#FF7A6B', '#B9A8F5'], speed: 9, life: 1.1, size: 0.8, grav: -5 });
  },
  update(dt) {
    const N = this.N;
    for (let i = 0; i < N; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k + this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.05) { this.pos[i * 3 + 1] = 0.05; this.vel[i * 3 + 1] *= -0.3; }
      const u = clamp(this.life[i] / this.max[i], 0, 1);
      this.alpha[i] = u < 0.3 ? u / 0.3 : 1;
      this.size[i] = this.s0[i] * (0.4 + u * 0.6);
    }
    const g = this.points.geometry.attributes;
    g.position.needsUpdate = true; g.alpha.needsUpdate = true; g.psize.needsUpdate = true; g.pcol.needsUpdate = true;
    for (const p of this.debris) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.v.y -= 18 * dt;
      p.m.position.addScaledVector(p.v, dt);
      if (p.m.position.y < 0.15) { p.m.position.y = 0.15; p.v.y *= -0.35; p.v.x *= 0.7; p.v.z *= 0.7; }
      p.m.rotation.x += p.w.x * dt; p.m.rotation.y += p.w.y * dt; p.m.rotation.z += p.w.z * dt;
      if (p.life <= 0) p.m.visible = false;
    }
  },
  clear() { this.life.fill(0); this.alpha.fill(0); this.debris.forEach((p) => { p.life = 0; p.m.visible = false; }); },
};

/* project a world point with the same bend the shaders use */
const _pv = new THREE.Vector3();
function toScreen(x, y, z) {
  const cam = W.camera, el = W.renderer.domElement;
  _pv.set(x, y, z).applyMatrix4(cam.matrixWorldInverse);
  const bz = Math.min(_pv.z + 2, 0);
  _pv.y -= bz * bz * BEND.uBendY.value; _pv.x += bz * bz * BEND.uBendX.value;
  _pv.applyMatrix4(cam.projectionMatrix);
  return { x: (_pv.x * 0.5 + 0.5) * el.clientWidth, y: (-_pv.y * 0.5 + 0.5) * el.clientHeight };
}
function popup(text, x, y, z, cls) {
  const host = $('#popups'); if (!host || host.childElementCount > 12) return;
  const p = toScreen(x, y, z);
  const el = document.createElement('div');
  el.className = 'pop ' + (cls || '');
  el.textContent = text;
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  host.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
