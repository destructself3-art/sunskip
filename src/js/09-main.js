/* ============ boot & frame loop ============ */
const PERF = { pr: 1.5, acc: 0, n: 0, drops: 0 };
function applyQuality(reset) {
  const dpr = window.devicePixelRatio || 1, q = S.settings.quality;
  if (reset) { PERF.drops = 0; G.lowGfx = false; }
  if (q === 'high') PERF.pr = Math.min(dpr, 2);
  else if (q === 'low') { PERF.pr = Math.min(dpr, 1); G.lowGfx = true; }
  else PERF.pr = Math.min(dpr, 1.75) - PERF.drops * 0.25;
  PERF.pr = Math.max(PERF.pr, 0.75);
  W.renderer.setPixelRatio(PERF.pr);
  FX.u.pr.value = PERF.pr; W.starU.pr.value = PERF.pr;
  onResize();
}
function onResize() {
  const st = $('#stage');
  const w = Math.max(1, st.clientWidth), h = Math.max(1, st.clientHeight);
  W.renderer.setSize(w, h, false);
  W.camera.aspect = w / h;
  W.camera.updateProjectionMatrix();
}
function watchPerf(dt) {
  if (S.settings.quality !== 'auto' || G.state !== 'play') { PERF.acc = PERF.n = 0; return; }
  PERF.acc += dt; PERF.n++;
  if (PERF.n >= 120) {
    const fps = PERF.n / PERF.acc; PERF.acc = PERF.n = 0;
    if (fps < 46 && PERF.drops < 3) { PERF.drops++; if (PERF.drops >= 2) G.lowGfx = true; applyQuality(false); }
  }
}

function grabSnap() {
  const src = W.renderer.domElement;
  const k = Math.min(1, 1080 / src.width);
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  G.snap = c;
  // where the crash sits on screen, so the result card can frame it
  const p = G.crashPos ? toScreen(G.crashPos[0], G.crashPos[1], G.crashPos[2]) : null;
  G.snapFrac = p ? clamp(p.y / Math.max(1, src.clientHeight), 0.2, 0.95) : 0.65;
}

let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - (last || now)) / 1000));
  last = now;
  update(dt);
  updateShipVisual(dt);
  FX.update(dt * G.ts);
  applyZone(G.dist, G.feverMix);
  updateCamera(dt);
  skyFollow(W.camera);
  W.starU.time.value += dt; W.planetU.time.value += dt;
  W.renderer.render(W.scene, W.camera);
  if (G.snapWanted) { G.snapWanted = false; grabSnap(); }
  if (G.shotWanted) { G.shotWanted = false; UI.finishShot(W.renderer.domElement); }
  UI.hud();
  watchPerf(dt);
}

function setLoader(p, msg) {
  $('#ldSun').style.setProperty('--p', p);
  $('#ldMsg').textContent = (msg || t('loading')) + ' · ' + Math.round(p * 100) + '%';
}

async function boot() {
  loadSave();
  LANG = S.lang;
  applyI18n();
  document.documentElement.classList.toggle('reduced', S.settings.reduced === true);
  INPUT.touchUI = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  setLoader(0.1);
  if (typeof THREE === 'undefined') { $('#ldMsg').textContent = t('noGL'); return; }
  try {
    initWorld($('#gl'));
  } catch (e) {
    $('#ldMsg').textContent = t('noGL'); return;
  }
  setLoader(0.35);
  initGeo();
  Ship.init();
  FX.init();
  bindInput();
  UI.init();
  applyQuality(true);
  window.addEventListener('resize', onResize);
  G.dist = 0; resetTerrain(0); resetDecor(0);
  setLoader(0.6);
  // warm up the shader programs before the first visible frame
  try { W.renderer.compile(W.scene, W.camera); } catch (e) { /* compile lazily */ }
  setLoader(0.8);
  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* ok */ }
  setLoader(1);
  UI.enterMenu();
  requestAnimationFrame(frame);
  setTimeout(() => $('#loader').classList.add('done'), 350);
  Net.init();
}
boot();
