/* ============ game state, rules, input ============ */
const REVIVE_COST = 30;
const BASE_Y = 0.85;
const G = {
  state: 'boot', mode: 'free', seed: 1, day: '', tutorial: false,
  dist: 0, prev: 0, speed: 0, runT: 0, score: 0, bonus: 0,
  shards: 0, grazes: 0, rings: 0, perfects: 0, ridges: 0, rolls: 0, powers: 0, showers: 0, fevers: 0, smashes: 0,
  combo: 0, comboT: 0, mult: 1, bestMult: 1, streak: 0, fever: 0, feverMix: 0,
  ship: { x: 0, vx: 0, tx: 0, y: 0, vy: 0, air: false, roll: 0, rollDir: 1, rollCd: 0, bank: 0, inv: 0, squash: 0, visible: true },
  magnet: 0, shield: false, comet: 0, reviveUsed: false, inShower: false,
  ts: 1, slow: 0, shake: 0, lowGfx: false, menuT: 0, camBlend: 0, camMode: 'menu',
  ghostRec: [], ghost: null, ghostDone: false, bestDistForFlag: 0,
  crashT: 0, snapWanted: false, snap: null, zoneShown: 0, hintStage: 0, achT: 0, runAch: [],
  photo: { yaw: 0.6, pitch: 0.25, r: 7, filter: 0 },
};
const INPUT = { left: false, right: false, ptr: null, touchUI: false, gpPrev: [] };

function reducedMotion() {
  if (S.settings.reduced != null) return S.settings.reduced;
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ---------- missions ---------- */
const MISSION_POOL = [
  { id: 'shards', goals: [60, 90, 130], stat: 'shards', reward: 60, en: 'Collect {n} shards', ru: 'Собрать осколки: {n}' },
  { id: 'dist', goals: [1200, 1800, 2600], stat: 'dist', single: true, reward: 80, en: 'Fly {n} m in one run', ru: 'Пролететь за раз: {n} м' },
  { id: 'grazes', goals: [8, 12, 18], stat: 'grazes', reward: 70, en: 'Graze obstacles {n} times', ru: 'Пролететь впритирку: {n}' },
  { id: 'rings', goals: [6, 10, 15], stat: 'rings', reward: 60, en: 'Fly through {n} rings', ru: 'Пролететь сквозь кольца: {n}' },
  { id: 'perfects', goals: [3, 5, 8], stat: 'perfects', reward: 80, en: 'Hit {n} perfect rings', ru: 'Идеальные кольца: {n}' },
  { id: 'ridges', goals: [6, 10, 15], stat: 'ridges', reward: 50, en: 'Hop over {n} ridges', ru: 'Прыжки через гряды: {n}' },
  { id: 'rolls', goals: [4, 7, 10], stat: 'rolls', reward: 50, en: 'Barrel-roll {n} times', ru: 'Бочки: {n}' },
  { id: 'fevers', goals: [1, 2, 3], stat: 'fevers', reward: 90, en: 'Reach fever {n} times', ru: 'Разогреться до жара: {n}' },
  { id: 'powers', goals: [2, 3, 5], stat: 'powers', reward: 60, en: 'Pick up {n} power-ups', ru: 'Подобрать усилители: {n}' },
  { id: 'showers', goals: [1, 2, 3], stat: 'showers', reward: 100, en: 'Survive {n} meteor showers', ru: 'Пережить метеоритные дожди: {n}' },
  { id: 'daily', goals: [1, 1, 1], stat: 'dailyRuns', reward: 40, en: 'Finish today’s daily run', ru: 'Пройти заезд дня' },
];
function ensureMissions() {
  const day = dayKey();
  if (S.missions.day === day && S.missions.list.length) return;
  const r = mulberry(hashStr('missions-' + day));
  const pool = MISSION_POOL.slice(), list = [];
  while (list.length < 3) {
    const m = pool.splice(Math.floor(r() * pool.length), 1)[0];
    const tier = Math.floor(r() * 3);
    list.push({ id: m.id, goal: m.goals[tier], reward: m.reward + tier * 20, p: 0, done: false });
  }
  S.missions = { day, list };
  save();
}
function missionText(m) { const def = MISSION_POOL.find((x) => x.id === m.id); return (LANG === 'ru' ? def.ru : def.en).replace('{n}', fmt(m.goal)); }
function applyMissions(run) {
  ensureMissions();
  const out = [];
  for (const m of S.missions.list) {
    if (m.done) continue;
    const def = MISSION_POOL.find((x) => x.id === m.id);
    const v = def.stat === 'dailyRuns' ? (run.mode === 'daily' ? 1 : 0) : run[def.stat] || 0;
    m.p = def.single ? Math.max(m.p, v) : m.p + v;
    if (m.p >= m.goal) { m.p = m.goal; m.done = true; S.wallet += m.reward; out.push(m); }
  }
  save();
  return out;
}

/* ---------- badges ---------- */
const ACH = [
  { id: 'first', code: '01', c: '#8FD9C1', en: ['First flight', 'Finish your first run'], ru: ['Первый полёт', 'Закончить первый полёт'], test: (r, s) => s.runs >= 1 },
  { id: 'k1', code: '1K', c: '#FFC9A3', en: ['Kilometre', 'Fly 1,000 m in one run'], ru: ['Километр', '1000 м за один полёт'], test: (r) => r.dist >= 1000 },
  { id: 'k3', code: '3K', c: '#FFE07A', en: ['Full day', 'Fly 3,000 m, a whole Nectar day'], ru: ['Целые сутки', '3000 м — полные сутки Нектара'], test: (r) => r.dist >= 3000 },
  { id: 'k5', code: '5K', c: '#FF7A6B', en: ['Long haul', 'Fly 5,000 m in one run'], ru: ['Дальнобой', '5000 м за один полёт'], test: (r) => r.dist >= 5000 },
  { id: 'graze', code: '×10', c: '#B9A8F5', en: ['Close shave', 'Graze 10 times in one run'], ru: ['На волоске', '10 раз впритирку за полёт'], test: (r) => r.grazes >= 10 },
  { id: 'fever', code: 'AU', c: '#FFE07A', en: ['Golden hour', 'Reach fever'], ru: ['Золотой час', 'Разогреться до жара'], test: (r) => r.fevers >= 1 },
  { id: 'rings', code: 'R20', c: '#FFC9A3', en: ['Ringmaster', '20 perfect rings in total'], ru: ['Повелитель колец', '20 идеальных колец всего'], test: (r, s) => s.perfects >= 20 },
  { id: 'shards', code: 'S1K', c: '#8FD9C1', en: ['Collector', 'Collect 1,000 shards in total'], ru: ['Коллекционер', '1000 осколков всего'], test: (r, s) => s.shards >= 1000 },
  { id: 'night', code: '23h', c: '#B9A8F5', en: ['Night owl', 'Reach moonrise'], ru: ['Сова', 'Долететь до лунной ночи'], test: (r) => r.dist >= ZONE_M * 3 },
  { id: 'meteor', code: 'M3', c: '#FF7A6B', en: ['Meteorologist', 'Survive 3 meteor showers'], ru: ['Метеоролог', 'Пережить 3 метеоритных дождя'], test: (r, s) => s.showers >= 3 },
  { id: 'daily', code: 'D3', c: '#8FD9C1', en: ['Regular', 'Finish daily runs on 3 days'], ru: ['Постоянный клиент', 'Заезды дня в 3 разных дня'], test: (r, s) => s.dailyDays.length >= 3 },
  { id: 'photo', code: 'PH', c: '#FFC9A3', en: ['Photographer', 'Save a photo in photo mode'], ru: ['Фотограф', 'Сохранить фото в фоторежиме'], test: (r, s) => s.photos >= 1 },
];
function checkAch(run, stats) {
  for (const a of ACH) {
    if (S.ach[a.id]) continue;
    let ok = false;
    try { ok = a.test(run || {}, stats || S.stats); } catch (e) { ok = false; }
    if (ok) { S.ach[a.id] = Date.now(); save(); UI.toastAch(a); }
  }
}
function runStats() {
  G.score = Math.floor(G.dist) + G.bonus;
  return { mode: G.mode, dist: Math.floor(G.dist), score: G.score, shards: G.shards, grazes: G.grazes, rings: G.rings, perfects: G.perfects, ridges: G.ridges, rolls: G.rolls, powers: G.powers, showers: G.showers, fevers: G.fevers, mult: G.bestMult };
}

/* ---------- run lifecycle ---------- */
function startRun(mode) {
  Sound.unlock();
  G.mode = mode;
  G.day = dayKey();
  G.seed = mode === 'daily' ? hashStr('sunskip-daily-' + G.day) : (Math.random() * 4294967296) >>> 0;
  G.tutorial = !S.tutorialDone;
  Object.assign(G, {
    dist: 0, prev: 0, speed: 16, runT: 0, score: 0, bonus: 0, shards: 0, grazes: 0, rings: 0, perfects: 0, ridges: 0, rolls: 0, powers: 0, showers: 0, fevers: 0, smashes: 0,
    combo: 0, comboT: 0, mult: 1, bestMult: 1, streak: 0, fever: 0, feverMix: 0, magnet: 0, shield: false, comet: 0, reviveUsed: false, inShower: false,
    ts: 1, slow: 0, shake: 0, crashT: 0, snap: null, snapWanted: false, zoneShown: 0, hintStage: 0, achT: 0, ghostRec: [], ghostDone: false, camBlend: 0, camMode: 'play',
  });
  Object.assign(G.ship, { x: 0, vx: 0, tx: 0, y: 0, vy: 0, air: false, roll: 0, rollCd: 0, bank: 0, inv: 0, squash: 0, visible: true });
  if (mode === 'daily') {
    if (S.daily.day !== G.day) S.daily = { day: G.day, score: 0, dist: 0, ghost: null, tries: 0 };
    S.daily.tries++; save();
    G.ghost = S.daily.ghost;
    G.bestDistForFlag = S.daily.dist;
  } else { G.ghost = null; G.bestDistForFlag = S.stats.bestDist; }
  clearEnts(); FX.clear();
  resetTerrain(0); resetDecor(0);
  Spawner.reset(G.seed, G.tutorial);
  Spawner.update(0);
  Ship.root.visible = true; Ship.resetTrails();
  Ship.ghost.grp.visible = !!G.ghost;
  G.state = 'play';
  UI.enterPlay();
  Sound.setIntensity(0.3);
  Sound.setFever(false);
}

function comboAdd(n) {
  G.combo += n; G.comboT = 4;
  const m = Math.min(5, 1 + Math.floor(G.combo / 4));
  if (m > G.mult) { G.mult = m; UI.multBump(); }
  G.bestMult = Math.max(G.bestMult, G.mult);
  if (G.mult >= 5 && G.fever <= 0) startFever();
}
function startFever() {
  G.fever = 7; G.fevers++;
  Sound.play('fever'); Sound.setFever(true);
  UI.banner(t('fever') + '!', '×2 ◆');
  haptic(40);
}
function addBonus(v) { G.bonus += Math.round(v * G.mult * (G.fever > 0 ? 2 : 1)); UI.scoreBump(); }

function doHop() {
  if (G.state !== 'play' || G.ship.air) return;
  G.ship.air = true; G.ship.vy = 10.2; G.ship.squash = -0.25;
  Sound.play('hop'); haptic(8);
}
function doRoll() {
  if (G.state !== 'play' || G.ship.roll > 0 || G.ship.rollCd > 0) return;
  const s = G.ship;
  const dir = (INPUT.right ? 1 : 0) - (INPUT.left ? 1 : 0) || Math.sign(s.vx) || Math.sign(s.tx - s.x) || (s.x > 0 ? -1 : 1);
  s.roll = 0.5; s.rollDir = dir; s.rollCd = 2.2; G.rolls++;
  Sound.play('roll'); haptic(15);
}

function crash(e) {
  G.state = 'crash'; G.crashT = 0;
  const s = G.ship;
  Sound.play('crash'); haptic([60, 40, 90]);
  FX.crash(s.x, BASE_Y + s.y, -G.dist, Ship.skin);
  G.crashPos = [s.x, BASE_Y + s.y, -G.dist];
  Ship.root.visible = false;
  Ship.trails.forEach((tr) => { tr.mesh.visible = false; });
  G.shake = 1; if (!reducedMotion()) G.slow = 0.9;
  UI.flash();
  Sound.setIntensity(0.05); Sound.setFever(false);
  G.crashCause = e ? e.t : '';
}
function smash(e, idx) {
  const col = e.t === 'ridge' || e.t === 'gate' ? '#' + W.mats.wall.color.getHexString() : '#' + W.mats.hazard.color.getHexString();
  const x = e.t === 'ridge' || e.t === 'gate' ? G.ship.x : e.x;
  FX.emit(x, 1.2, -e.d, { n: 18, color: col, speed: 8, life: 0.9, size: 0.7 });
  Sound.play('smash'); G.smashes++; addBonus(30);
  popup(t('smash'), x, 2.2, -e.d, 'coral');
  removeEnt(idx);
  G.shake = Math.max(G.shake, 0.3);
}
function removeEnt(i) {
  const e = ENT[i];
  if (e.mesh) release(e.mesh);
  if (e.extra) e.extra.forEach(release);
  disposeLabel(e);
  ENT.splice(i, 1);
}
function hit(e, idx) {
  const s = G.ship;
  if (G.comet > 0) { smash(e, idx); return true; }
  if (s.roll > 0 || s.inv > 0) {
    if (s.roll > 0 && !e.rolled) { e.rolled = true; addBonus(25); popup(t('graze'), s.x, 2, -G.dist, 'mint'); comboAdd(1); }
    return false;
  }
  if (G.shield) {
    G.shield = false; s.inv = 1.1; Sound.play('shieldBreak'); haptic(30);
    popup(t('saved'), s.x, 2.4, -G.dist, 'mint');
    smash(e, idx); return true;
  }
  crash(e); return true;
}
function graze(e, clear) {
  G.grazes++; addBonus(25); comboAdd(1);
  Sound.play('graze'); haptic(12);
  popup(t('graze') + ' +' + Math.round(25 * G.mult * (G.fever > 0 ? 2 : 1)), G.ship.x, 2.3, -G.dist, '');
  if (!reducedMotion() && clear < 0.45) G.slow = Math.max(G.slow, 0.28);
}
function activatePower(kind) {
  G.powers++; addBonus(50); Sound.play('power'); haptic(20);
  if (kind === 'magnet') G.magnet = 9;
  if (kind === 'shield') G.shield = true;
  if (kind === 'comet') { G.comet = 4.5; G.ship.inv = Math.max(G.ship.inv, 4.5); }
  UI.banner(t(kind === 'magnet' ? 'pwMagnet' : kind === 'shield' ? 'pwShield' : 'pwComet'), '');
}

function revive() {
  S.wallet -= REVIVE_COST; save();
  G.reviveUsed = true;
  for (let i = ENT.length - 1; i >= 0; i--) {
    const e = ENT[i], rel = e.d - G.dist;
    if (rel > -3 && rel < 70 && e.t !== 'arch' && e.t !== 'flag' && e.t !== 'showerEnd') removeEnt(i);
  }
  const s = G.ship;
  Object.assign(s, { y: 0, vy: 0, air: false, roll: 0, inv: 2.4, visible: true });
  Ship.root.visible = true; Ship.resetTrails();
  G.state = 'play'; G.ts = 1; G.slow = 0;
  Sound.setIntensity(0.4);
  UI.enterPlay(true);
}

function endRun() {
  G.state = 'over';
  const run = runStats();
  run.day = G.day; run.skin = S.skin;
  const st = S.stats;
  st.runs++; st.dist += run.dist; st.shards += run.shards; st.grazes += run.grazes; st.perfects += run.perfects; st.rings += run.rings;
  st.showers += run.showers; st.fevers += run.fevers; st.time += G.runT;
  st.bestCombo = Math.max(st.bestCombo, run.mult);
  let isBest = false;
  if (run.score > st.bestScore) st.bestScore = run.score;
  if (run.dist > st.bestDist) st.bestDist = run.dist;
  if (G.mode === 'daily') {
    if (!st.dailyDays.includes(G.day)) st.dailyDays.push(G.day);
    if (st.dailyDays.length > 60) st.dailyDays = st.dailyDays.slice(-60);
    if (run.score > S.daily.score) {
      isBest = S.daily.score > 0;
      S.daily.score = run.score; S.daily.dist = run.dist; S.daily.ghost = G.ghostRec.slice();
    }
  } else if (run.score > S.bestFree.score) { isBest = S.bestFree.score > 0; S.bestFree = { score: run.score, dist: run.dist }; }
  S.wallet += run.shards;
  if (G.tutorial) S.tutorialDone = true;
  S.local.push({ score: run.score, dist: run.dist, mode: run.mode, day: run.day, skin: run.skin });
  S.local.sort((a, b) => b.score - a.score); S.local = S.local.slice(0, 10);
  const doneMissions = applyMissions(run);
  save();
  checkAch(run, st);
  run.isBest = isBest;
  run.missions = doneMissions;
  UI.showOver(run);
  Net.submit(run);
}

/* ---------- main update ---------- */
function update(dt) {
  G.menuT += dt;
  pollGamepad();
  if (G.state === 'menu' || G.state === 'boot') { updateMenu(dt); return; }
  if (G.state === 'paused' || G.state === 'photo') { return; }
  if (G.state === 'crash' || G.state === 'revive' || G.state === 'over') { updateAfterCrash(dt); return; }
  if (G.state !== 'play') return;

  // time scale for slow-mo moments
  if (G.slow > 0) { G.slow -= dt; G.ts = damp(G.ts, 0.42, 18, dt); } else G.ts = damp(G.ts, 1, 6, dt);
  const gdt = dt * G.ts;
  G.runT += gdt;
  const s = G.ship;

  // speed ramps up over a couple of minutes
  let target = 21 + 26 * (1 - Math.exp(-G.runT / 95));
  if (G.tutorial && G.dist < 640) target = Math.min(target, 20);
  if (G.comet > 0) target *= 1.55;
  G.speed = damp(G.speed, target, 2.2, gdt);
  G.prev = G.dist;
  G.dist += G.speed * gdt;

  // steering
  const sens = S.settings.sens;
  const dir = clamp((INPUT.right ? 1 : 0) - (INPUT.left ? 1 : 0) + INPUT.gpX, -1, 1);
  const px = s.x;
  if (INPUT.ptr) {
    s.x = damp(s.x, s.tx, 16, gdt);
    s.vx = (s.x - px) / Math.max(gdt, 1e-4);
  } else {
    s.vx = dir !== 0 ? damp(s.vx, dir * 15.5 * sens, 11, gdt) : damp(s.vx, 0, 9, gdt);
    s.x += s.vx * gdt; s.tx = s.x;
  }
  if (s.roll > 0) { s.x += s.rollDir * 8.5 * gdt; s.tx = s.x; s.roll -= gdt; }
  s.x = clamp(s.x, -TRACK + 0.55, TRACK - 0.55);
  s.tx = clamp(s.tx, -TRACK + 0.55, TRACK - 0.55);
  const lat = (s.x - px) / Math.max(gdt, 1e-4);
  s.bank = damp(s.bank, clamp(-lat * 0.045, -0.75, 0.75), 10, dt);
  s.rollCd = Math.max(0, s.rollCd - gdt);
  s.inv = Math.max(0, s.inv - gdt);
  s.squash = damp(s.squash, 0, 8, dt);

  // hop physics
  if (s.air) {
    s.vy -= 30 * gdt; s.y += s.vy * gdt;
    if (s.y <= 0) {
      s.y = 0; s.vy = 0; s.air = false; s.squash = 0.35;
      Sound.play('land');
      FX.emit(s.x, 0.2, -G.dist + 0.6, { n: 12, color: '#' + W.pal.track.getHexString(), speed: 3.5, life: 0.6, size: 0.7, grav: 1, flat: true, drag: 3 });
    }
  }

  // combo / fever / power-ups
  if (G.fever > 0) {
    G.fever -= gdt;
    if (G.fever <= 0) { G.combo = 0; G.mult = 1; G.comboT = 0; Sound.setFever(false); }
  } else if (G.comboT > 0) {
    G.comboT -= gdt;
    if (G.comboT <= 0) { G.combo = 0; G.mult = 1; }
  }
  G.feverMix = damp(G.feverMix, G.fever > 0 ? 1 : 0, 3, dt);
  if (G.magnet > 0) G.magnet -= gdt;
  if (G.comet > 0) { G.comet -= gdt; if (G.comet <= 0) s.inv = Math.max(s.inv, 0.8); }

  // world streaming
  Spawner.update(G.dist);
  updateDecor(G.dist);
  updateTerrain(G.dist);
  updateEntities(dt, gdt);
  if (G.state !== 'play') return;

  // ghost of today's best run
  if (G.ghost && !G.ghostDone) {
    const f = G.dist / 2, i = Math.floor(f), n = G.ghost.length / 2;
    if (i + 1 < n) {
      const u = f - i, gx = lerp(G.ghost[i * 2], G.ghost[i * 2 + 2], u), gy = lerp(G.ghost[i * 2 + 1], G.ghost[i * 2 + 3], u);
      const gg = Ship.ghost.grp; gg.visible = true;
      gg.position.set(gx, BASE_Y + 0.1 + gy, -G.dist - 1.4);
      gg.rotation.set(0, 0, clamp(-(gx - (gg.userData.px || gx)) / Math.max(gdt, 1e-3) * 0.04, -0.6, 0.6));
      gg.userData.px = gx;
    } else {
      G.ghostDone = true;
      const gg = Ship.ghost.grp; gg.visible = false;
      FX.emit(gg.position.x, gg.position.y, gg.position.z, { n: 20, color: '#FFFFFF', speed: 5, life: 0.8, size: 0.6 });
    }
  }
  // record this run for a future ghost
  while (G.ghostRec.length / 2 <= G.dist / 2) G.ghostRec.push(Math.round(s.x * 100) / 100, Math.round(s.y * 100) / 100);

  G.score = Math.floor(G.dist) + G.bonus;

  // zone banners
  const zi = Math.floor(G.dist / ZONE_M);
  if (zi > G.zoneShown) {
    G.zoneShown = zi;
    const z = ZONE_DEF[zi % 4];
    UI.banner(t(z.key), clockAt(G.dist) + ' · ' + t('localTime'));
    Sound.play('zone');
  }
  // tutorial hints
  if (G.tutorial) tutorialHints();
  // badges mid-run
  G.achT -= dt;
  if (G.achT <= 0) { G.achT = 0.5; checkAch(runStats(), S.stats); }

  Sound.setIntensity(0.32 + clamp((G.speed - 21) / 26, 0, 1) * 0.68);
}

function updateEntities(dt, gdt) {
  const s = G.ship, sy = BASE_Y + s.y;
  for (let i = ENT.length - 1; i >= 0; i--) {
    const e = ENT[i];
    const rel = e.d - G.dist;
    if (rel < -14) { removeEnt(i); continue; }
    if (rel > AHEAD) continue;
    // closest approach this frame (swept, so fast frames can't tunnel)
    const near = e.d - clamp(e.d, G.prev, G.dist);
    const crossed = e.d > G.prev - 0.01 && e.d <= G.dist;
    switch (e.t) {
      case 'spire': case 'pillar': case 'post': case 'boulder': {
        if (e.t === 'boulder') {
          e.x = e.x0 + Math.sin(rel * e.k + e.ph) * e.amp;
          e.x = clamp(e.x, -TRACK + 0.5, TRACK - 0.5);
          e.mesh.position.x = e.x; e.mesh.rotation.z = -e.x / 1.15; e.mesh.rotation.x = rel * 0.9;
          e.extra[0].position.x = e.x;
        }
        const dx = s.x - e.x, rr = e.r + 0.42;
        if (!e.done && dx * dx + near * near < rr * rr) { e.done = true; if (hit(e, i)) { if (G.state !== 'play') return; continue; } }
        if (!e.passed && rel < 0) {
          e.passed = true;
          const clear = Math.abs(dx) - rr;
          if (!e.done && clear < 0.7 && clear > -0.05) graze(e, clear);
        }
        break;
      }
      case 'ridge': {
        if (crossed && !e.done) {
          e.done = true;
          if (s.y < 0.5) { if (hit(e, i)) { if (G.state !== 'play') return; continue; } }
          else { G.ridges++; addBonus(10); if (s.y < 0.85) { popup(t('skim'), s.x, 2.4, -G.dist, 'mint'); G.grazes++; comboAdd(1); Sound.play('graze'); } }
        }
        break;
      }
      case 'gate': {
        if (crossed && !e.done) {
          e.done = true;
          const lo = e.gx - e.gw / 2, hi = e.gx + e.gw / 2;
          if (s.x - 0.42 < lo || s.x + 0.42 > hi) { if (hit(e, i)) { if (G.state !== 'play') return; continue; } }
          else { const clear = Math.min(s.x - 0.42 - lo, hi - s.x - 0.42); if (clear < 0.55) graze(e, clear); }
        }
        break;
      }
      case 'shard': {
        e.mesh.rotation.y += gdt * 3; e.mesh.position.y = e.y + Math.sin(G.runT * 4 + e.d) * 0.08;
        if (G.magnet > 0 && rel < 16 && rel > -1.5) {
          e.x = damp(e.x, s.x, 7, gdt); e.y = damp(e.y, sy, 7, gdt); e.d = damp(e.d, G.dist + 0.3, 5, gdt);
          e.mesh.position.set(e.x, e.y, -e.d);
        }
        const dy = sy - e.y, dx = s.x - e.x;
        if (Math.abs(near) < 0.9 && Math.abs(dx) < 0.95 && Math.abs(dy) < 1.05) {
          G.shards += G.fever > 0 ? 2 : 1; G.streak++;
          if (G.streak % 5 === 0) comboAdd(1);
          addBonus(10);
          Sound.play('shard', G.streak % 11);
          FX.emit(e.x, e.y, -e.d, { n: 7, color: '#FFE07A', speed: 3.5, life: 0.45, size: 0.45, grav: 0 });
          removeEnt(i); continue;
        }
        if (!e.passed && rel < -1) { e.passed = true; G.streak = 0; }
        break;
      }
      case 'ring': {
        e.mesh.rotation.z += gdt * 0.8;
        if (e.got) e.mesh.scale.multiplyScalar(Math.max(0, 1 - gdt * 7));
        if (crossed && !e.done) {
          e.done = true;
          const dx = Math.abs(s.x - e.x);
          if (dx < 1.2 && s.y < 1.25) {
            const perfect = dx < 0.42;
            G.rings++; if (perfect) G.perfects++;
            addBonus(perfect ? 80 : 40); comboAdd(perfect ? 2 : 1);
            Sound.play('ring', perfect);
            popup(perfect ? t('perfect') : t('ring'), e.x, 2.6, -e.d, perfect ? 'gold' : '');
            FX.emit(e.x, 1.05, -e.d, { n: perfect ? 22 : 12, color: '#FFC94D', speed: 6, life: 0.6, size: 0.5, grav: 0 });
            e.got = true;
          }
        }
        break;
      }
      case 'power': {
        e.mesh.rotation.y += gdt * 1.5; e.mesh.position.y = 1.1 + Math.sin(G.runT * 3) * 0.15;
        e.mesh.userData.core.rotation.x += gdt * 2;
        const dx = s.x - e.x;
        if (Math.abs(near) < 1.1 && Math.abs(dx) < 1.25 && Math.abs(sy - 1.1) < 1.3) {
          activatePower(e.kind);
          FX.emit(e.x, 1.1, -e.d, { n: 20, color: '#' + e.mesh.userData.core.material.color.getHexString(), speed: 6, life: 0.7, size: 0.6, grav: 0 });
          removeEnt(i); continue;
        }
        break;
      }
      case 'meteor': {
        const mk = e.mesh, mt = e.extra[0];
        if (!e.landed) {
          if (rel < 120) {
            const p = clamp(1 - (rel - 24) / 96, 0, 1);
            mk.scale.setScalar(0.4 + p * 0.7 + Math.sin(G.runT * 10) * 0.05);
            mt.visible = true;
            const u = Math.max(rel - 24, 0);
            mt.position.set(e.x + u * 0.35, 0.9 + u * 1.2, -(e.d + u * 0.35));
            mt.userData.rock.rotation.x += gdt * 4;
          }
          if (rel <= 24) {
            e.landed = true;
            release(mk); e.mesh = null;
            mt.position.set(e.x, 0.55, -e.d); mt.userData.tail.visible = false; mt.userData.rock.scale.set(1, 0.75, 1);
            FX.emit(e.x, 0.4, -e.d, { n: 22, colors: ['#FFC98A', '#FF7A6B', '#FFF3E2'], speed: 7, life: 0.8, size: 0.8, grav: -4 });
            Sound.play('impact'); G.shake = Math.max(G.shake, 0.22); haptic(10);
          }
        } else {
          const dx = s.x - e.x, rr = e.r + 0.42;
          if (!e.done && dx * dx + near * near < rr * rr) {
            e.done = true;
            if (s.y < 0.62) { if (hit(e, i)) { if (G.state !== 'play') return; continue; } }
          }
          if (!e.passed && rel < 0) { e.passed = true; const clear = Math.abs(dx) - rr; if (!e.done && clear < 0.6 && clear > -0.05) graze(e, clear); }
        }
        break;
      }
      case 'showerStart':
        if (rel < 0) { G.inShower = true; UI.banner(t('meteor'), t('meteorSub')); removeEnt(i); continue; }
        break;
      case 'showerEnd':
        if (rel < 0) { G.inShower = false; G.showers++; addBonus(100); removeEnt(i); continue; }
        break;
      case 'arch':
        if (!e.passed && rel < 0) { e.passed = true; Sound.play('milestone'); popup(fmt(e.n) + ' m', s.x, 3, -G.dist, 'gold'); addBonus(50); }
        break;
      default: break;
    }
  }
}

function tutorialHints() {
  const d = G.dist, k = INPUT.touchUI;
  const st = [
    [15, () => UI.hint(k ? t('hintSteer') : t('hintSteerKeys'), '')],
    [200, () => UI.hint(null)],
    [255, () => UI.hint(k ? t('hintHop') : t('hintHopKeys'), 'tap')],
    [440, () => UI.hint(null)],
    [455, () => UI.hint(k ? t('hintRoll') : t('hintRollKeys'), 'down')],
    [560, () => UI.hint(null)],
    [580, () => UI.hint(t('hintGo'), 'tap')],
    [690, () => UI.hint(null)],
  ];
  while (G.hintStage < st.length && d >= st[G.hintStage][0]) { st[G.hintStage][1](); G.hintStage++; }
}

function updateAfterCrash(dt) {
  G.crashT += dt;
  if (G.slow > 0) { G.slow -= dt; G.ts = damp(G.ts, 0.25, 20, dt); } else G.ts = damp(G.ts, 1, 3, dt);
  if (G.state === 'crash') {
    if (G.crashT > 0.3 && !G.snap && !G.snapWanted) G.snapWanted = true;
    if (G.crashT > 1.05) {
      if (!G.reviveUsed && S.wallet + G.shards >= REVIVE_COST && G.dist > 150) { G.state = 'revive'; UI.showRevive(); }
      else endRun();
    }
  }
}

function updateMenu(dt) {
  // attract mode: glide over the moon while the day turns
  const s = G.ship;
  G.dist += 7 * dt;
  s.x = Math.sin(G.menuT * 0.35) * 1.6; s.y = Math.sin(G.menuT * 1.3) * 0.12;
  s.bank = -Math.cos(G.menuT * 0.35) * 0.25;
  updateDecor(G.dist);
  updateTerrain(G.dist);
  G.feverMix = damp(G.feverMix, 0, 3, dt);
}

/* ---------- camera ---------- */
const CAM = { pos: new THREE.Vector3(), look: new THREE.Vector3(), p2: new THREE.Vector3(), l2: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), fov: 62, init: false };
const portraitK = () => clamp((1 - W.camera.aspect) / 0.55, 0, 1);
function baseFov() {
  // keep enough of the road in view on tall phones without fisheye
  const a = W.camera.aspect, pk = portraitK();
  const hfov = lerp(76, 58, pk) * Math.PI / 180;
  const vfov = 2 * Math.atan(Math.tan(hfov / 2) / a) * 180 / Math.PI;
  return clamp(vfov, 52, 80);
}
function updateCamera(dt) {
  const s = G.ship, z = -G.dist, sy = BASE_Y + s.y;
  const cam = W.camera, wide = W.camera.aspect > 1.15;
  // chase camera
  const pk = portraitK();
  const chP = CAM.p2.set(s.x * lerp(0.62, 0.72, pk), 3.25 + pk * 1.3 + s.y * 0.35, z + 7.1 + pk * 2.0);
  const chL = CAM.l2.set(s.x * 0.85, 1.0 + s.y * 0.3, z - 14 - pk * 4);
  let fov = baseFov() + clamp((G.speed - 21) / 26, 0, 1) * (reducedMotion() ? 3 : 9) + (G.comet > 0 ? 7 : 0);
  if (G.state === 'menu' || G.state === 'boot' || G.camMode === 'hangar') {
    const hang = G.camMode === 'hangar';
    let mp, lk;
    if (hang) {
      const yaw = 0.9 + G.menuT * 0.3, r = wide ? 6.2 : 7.4;
      mp = CAM.a.set(s.x + Math.sin(yaw) * r, sy + 1.6, z + Math.cos(yaw) * r);
      lk = CAM.c.set(s.x, sy + 0.1, z);
      const right = CAM.b.set(Math.cos(yaw), 0, -Math.sin(yaw));
      if (wide) lk.addScaledVector(right, 2.4); else lk.y -= 1.5;
    } else {
      // rear three-quarter view: the ship sits on the right third, the road and the gas giant ahead
      const sw = Math.sin(G.menuT * 0.16) * 0.4, cx = wide ? -2.0 : -0.3;
      mp = CAM.a.set(s.x + cx + sw, sy + (wide ? 0.75 : 1.4), z + (wide ? 5.8 : 7.2));
      lk = CAM.c.set(s.x + cx * 1.3 + sw, sy + (wide ? 1.5 : 0.6), z - 20);
    }
    if (!CAM.init) { CAM.pos.copy(mp); CAM.look.copy(lk); CAM.init = true; }
    CAM.pos.lerp(mp, 1 - Math.exp(-3 * dt));
    CAM.look.lerp(lk, 1 - Math.exp(-4 * dt));
    fov = baseFov() - 4;
    G.camBlend = 0;
  } else if (G.state === 'photo') {
    const p = G.photo;
    CAM.pos.set(s.x + Math.sin(p.yaw) * Math.cos(p.pitch) * p.r, sy + Math.sin(p.pitch) * p.r, z + Math.cos(p.yaw) * Math.cos(p.pitch) * p.r);
    CAM.look.set(s.x, sy, z);
  } else {
    G.camBlend = Math.min(1, G.camBlend + dt / 0.9);
    const b = smooth(0, 1, G.camBlend);
    if (G.state === 'over' || G.state === 'revive' || G.state === 'crash') {
      chP.y += Math.min(G.crashT, 3) * 0.6; chP.z += Math.min(G.crashT, 3) * 0.8;
    }
    CAM.pos.lerp(chP, b < 1 ? b * 0.2 + 0.02 : 1);
    CAM.look.lerp(chL, b < 1 ? b * 0.2 + 0.02 : 1);
  }
  cam.position.copy(CAM.pos);
  if (G.shake > 0 && !reducedMotion()) {
    cam.position.x += (Math.random() - 0.5) * G.shake * 0.5;
    cam.position.y += (Math.random() - 0.5) * G.shake * 0.4;
  }
  G.shake = Math.max(0, G.shake - dt * 2.2);
  cam.lookAt(CAM.look);
  cam.rotation.z += (G.state === 'play' ? -s.bank * 0.12 : 0);
  CAM.fov = damp(CAM.fov, fov, 4, dt);
  if (Math.abs(cam.fov - CAM.fov) > 0.01) { cam.fov = CAM.fov; cam.updateProjectionMatrix(); }
  cam.updateMatrixWorld();
  // gentle winding of the world
  BEND.uBendX.value = Math.sin(G.dist * 0.0042) * 0.0011;
}

function updateShipVisual(dt) {
  const s = G.ship, sy = BASE_Y + s.y;
  const rollA = s.roll > 0 ? (1 - s.roll / 0.5) * TAU * s.rollDir * -1 : 0;
  const pitch = s.air ? clamp(s.vy * 0.03, -0.25, 0.3) : 0;
  Ship.pose(s.x, sy + (G.state === 'menu' ? 0 : Math.sin(G.menuT * 5) * 0.03), -G.dist, s.bank, pitch, rollA);
  const sq = s.squash;
  Ship.model.grp.scale.set(1 + sq * 0.4, 1 - sq, 1 + sq * 0.2);
  // invulnerability blink
  const blink = s.inv > 0 && G.comet <= 0 && G.state === 'play' ? (Math.floor(G.menuT * 16) % 2 === 0) : true;
  Ship.model.grp.visible = blink;
  if (Ship.model.flame) {
    const f = 0.8 + Math.random() * 0.4 + (G.comet > 0 ? 1.2 : 0) + clamp((G.speed - 21) / 26, 0, 1) * 0.5;
    Ship.model.flame.scale.set(1, 1, f);
  }
  Ship.shield.visible = G.shield && G.state === 'play';
  if (Ship.shield.visible) { Ship.shield.rotation.y += dt; Ship.shieldMat.opacity = 0.22 + Math.sin(G.menuT * 6) * 0.06; }
  Ship.shadow.visible = Ship.root.visible;
  Ship.shadow.position.set(s.x, 0.04, -G.dist + 0.2);
  Ship.shadow.scale.setScalar(clamp(1 - s.y * 0.25, 0.45, 1));
  if (Ship.root.visible) Ship.updateTrails(true);
  if (G.comet > 0 && G.state === 'play') FX.emit(s.x, sy, -G.dist + 1.2, { n: 2, colors: ['#FFE07A', '#FFF3E2', '#FF7A6B'], speed: 2, life: 0.5, size: 0.7, grav: 0, vz: 6 });
  if (G.fever > 0 && G.state === 'play' && Math.random() < 0.5) FX.emit(s.x + (Math.random() - 0.5) * 3, sy + Math.random(), -G.dist - 2, { n: 1, color: '#FFE07A', speed: 1, life: 0.8, size: 0.5, grav: 1 });
}

/* ---------- input ---------- */
function bindInput() {
  const cv = W.renderer.domElement;
  const toWorld = (px) => (TRACK * 2 * 1.08) / (Math.min(cv.clientWidth, 560) * 0.72) * px * S.settings.sens;
  cv.addEventListener('pointerdown', (ev) => {
    INPUT.touchUI = ev.pointerType !== 'mouse';
    Sound.unlock();
    if (G.state === 'photo') { UI.photoPointer(ev, 'down'); return; }
    if (G.camMode === 'hangar' || G.state !== 'play') return;
    if (INPUT.ptr && INPUT.ptr.id !== ev.pointerId) { doHop(); return; }
    try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ }
    INPUT.ptr = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, t0: performance.now(), sx0: G.ship.x, moved: false, gest: false };
  });
  cv.addEventListener('pointermove', (ev) => {
    if (G.state === 'photo') { UI.photoPointer(ev, 'move'); return; }
    const p = INPUT.ptr; if (!p || p.id !== ev.pointerId) return;
    const dx = ev.clientX - p.x0, dy = ev.clientY - p.y0, el = performance.now() - p.t0;
    if (Math.abs(dx) > 6) p.moved = true;
    if (!p.gest && el < 380 && Math.abs(dy) > 42 && Math.abs(dy) > Math.abs(dx) * 1.3) {
      p.gest = true; p.moved = true;
      if (dy > 0) doRoll(); else doHop();
    }
    G.ship.tx = clamp(p.sx0 + toWorld(dx), -TRACK + 0.55, TRACK - 0.55);
  });
  const up = (ev) => {
    if (G.state === 'photo') { UI.photoPointer(ev, 'up'); return; }
    const p = INPUT.ptr; if (!p || p.id !== ev.pointerId) return;
    if (!p.moved && !p.gest && performance.now() - p.t0 < 300) doHop();
    INPUT.ptr = null;
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (ev) => { if (G.state === 'photo') { ev.preventDefault(); G.photo.r = clamp(G.photo.r + ev.deltaY * 0.01, 3, 16); } }, { passive: false });

  window.addEventListener('keydown', (ev) => {
    if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT')) return;
    const k = ev.code;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(k) && (G.state === 'play' || G.state === 'photo')) ev.preventDefault();
    if (k !== 'Tab') INPUT.touchUI = false;
    Sound.unlock();
    if (k === 'ArrowLeft' || k === 'KeyA') INPUT.left = true;
    if (k === 'ArrowRight' || k === 'KeyD') INPUT.right = true;
    if (ev.repeat) return;
    if (G.state === 'play') {
      if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW') doHop();
      if (k === 'ShiftLeft' || k === 'ShiftRight' || k === 'ArrowDown' || k === 'KeyS') doRoll();
      if (k === 'KeyP' || k === 'Escape') UI.pause();
    } else if (G.state === 'paused' && (k === 'KeyP' || k === 'Escape')) { UI.resume(); ev.preventDefault(); }
    else if (G.state === 'over' && (k === 'Space' || k === 'Enter') && !UI.sheetOpen()) { ev.preventDefault(); UI.again(); }
    else if (G.state === 'photo' && k === 'Escape') UI.exitPhoto();
    else if (G.state === 'menu' && k === 'Escape' && UI.sheetOpen()) UI.closeSheet();
    if (k === 'KeyC' && (G.state === 'play' || G.state === 'menu' || G.state === 'paused')) UI.toggleCapture();
    if (k === 'KeyM') UI.toggleMute();
  });
  window.addEventListener('keyup', (ev) => {
    const k = ev.code;
    if (k === 'ArrowLeft' || k === 'KeyA') INPUT.left = false;
    if (k === 'ArrowRight' || k === 'KeyD') INPUT.right = false;
  });
  window.addEventListener('blur', () => { INPUT.left = INPUT.right = false; if (G.state === 'play') UI.pause(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (G.state === 'play') UI.pause(); Sound.suspend(true); }
    else Sound.suspend(false);
  });
}
INPUT.gpX = 0;
function pollGamepad() {
  INPUT.gpX = 0;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads && Array.from(pads).find((p) => p && p.connected);
  if (!gp) return;
  const ax = gp.axes[0] || 0;
  INPUT.gpX = Math.abs(ax) > 0.2 ? ax : 0;
  if (gp.buttons[14] && gp.buttons[14].pressed) INPUT.gpX = -1;
  if (gp.buttons[15] && gp.buttons[15].pressed) INPUT.gpX = 1;
  const pressed = (i) => gp.buttons[i] && gp.buttons[i].pressed && !INPUT.gpPrev[i];
  if (pressed(0)) { if (G.state === 'play') doHop(); else if (G.state === 'menu' && !UI.sheetOpen()) startRun('free'); else if (G.state === 'over') UI.again(); }
  if (pressed(1) || pressed(2)) doRoll();
  if (pressed(9)) { if (G.state === 'play') UI.pause(); else if (G.state === 'paused') UI.resume(); }
  INPUT.gpPrev = gp.buttons.map((b) => b.pressed);
}
