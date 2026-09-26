/* ============ procedural audio: music that grows with speed + synth sfx ============ */
const Sound = (() => {
  let ctx = null, master, musicBus, sfxBus, delay, noiseBuf;
  let started = false, nextTime = 0, step = 0, timer = 0;
  let intensity = 0, target = 0, fever = false;
  const BPM = 100, STEP = 60 / BPM / 4;
  // F major: Fmaj7 · Dm7 · Bbmaj7 · C6 — two bars each
  const CHORDS = [[53, 57, 60, 64], [50, 53, 57, 60], [46, 50, 53, 57], [48, 52, 55, 57]];
  const ROOTS = [41, 38, 34, 36];
  const PENTA = [77, 79, 81, 84, 86, 89, 91, 93, 96, 98, 101];
  const ARP = [0, 1, 2, 3, 2, 1, 3, 2];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); sfxBus = ctx.createGain();
    musicBus.connect(master); sfxBus.connect(master);
    delay = ctx.createDelay(1); delay.delayTime.value = STEP * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.33;
    const wet = ctx.createGain(); wet.gain.value = 0.3;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    delay.connect(dlp); dlp.connect(fb); fb.connect(delay); dlp.connect(wet); wet.connect(musicBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    volumes();
    return true;
  }
  function volumes() {
    if (!ctx) return;
    const m = S.settings.muted ? 0 : S.settings.music * 0.85;
    const f = S.settings.muted ? 0 : S.settings.sfx;
    musicBus.gain.setTargetAtTime(m, ctx.currentTime, 0.1);
    sfxBus.gain.setTargetAtTime(f, ctx.currentTime, 0.05);
  }
  function unlock() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (!started) { started = true; nextTime = ctx.currentTime + 0.1; timer = setInterval(schedule, 25); }
  }
  function suspend(on) {
    if (!ctx) return;
    if (on) ctx.suspend().catch(() => {}); else if (started) ctx.resume().catch(() => {});
  }

  function tone(o) {
    const t = o.t != null ? o.t : ctx.currentTime;
    const a = o.a || 0.005, d = o.d || 0.2, g = o.g || 0.1;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + a + d);
    if (o.detune) osc.detune.value = o.detune;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(g, t + a);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    let node = osc;
    if (o.lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; osc.connect(fl); node = fl; }
    node.connect(gn); gn.connect(o.bus || sfxBus);
    if (o.send) { const s = ctx.createGain(); s.gain.value = o.send; gn.connect(s); s.connect(delay); }
    osc.start(t); osc.stop(t + a + d + 0.05);
  }
  function noise(o) {
    const t = o.t != null ? o.t : ctx.currentTime, d = o.d || 0.2;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = o.type || 'bandpass';
    fl.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t + d);
    fl.Q.value = o.q || 1;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(o.g || 0.1, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(fl); fl.connect(gn); gn.connect(o.bus || sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + d + 0.05);
  }

  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    while (nextTime < ctx.currentTime + 0.12) { playStep(step, nextTime); nextTime += STEP; step = (step + 1) % 128; }
  }
  function playStep(s, t) {
    intensity = lerp(intensity, target, 0.08);
    const ci = Math.floor(s / 32), chord = CHORDS[ci], bs = s % 16;
    const M = musicBus;
    if (s % 32 === 0) {
      const cut = 700 + intensity * 1500;
      chord.forEach((n, i) => {
        tone({ type: 'triangle', f: mtof(n), t, a: 0.9, d: 4.2, g: 0.028, lp: cut, bus: M, detune: -7 });
        tone({ type: 'triangle', f: mtof(n + (i === 0 ? 12 : 0)), t, a: 1.1, d: 4.0, g: 0.022, lp: cut, bus: M, detune: 7 });
      });
    }
    if (intensity > 0.15 && (bs === 0 || bs === 7 || bs === 8 || bs === 14)) {
      const f = mtof(ROOTS[ci] + (bs === 14 ? 12 : 0));
      tone({ type: 'sine', f, t, a: 0.005, d: 0.32, g: 0.2 * smooth(0.15, 0.4, intensity), bus: M });
      tone({ type: 'triangle', f: f * 2, t, a: 0.005, d: 0.12, g: 0.05, lp: 900, bus: M });
    }
    if (intensity > 0.3 && (bs === 0 || bs === 8 || (intensity > 0.78 && bs === 10))) {
      tone({ type: 'sine', f: 130, f2: 42, t, a: 0.002, d: 0.24, g: 0.42 * smooth(0.3, 0.5, intensity), bus: M });
    }
    if (intensity > 0.36 && (bs % 4 === 2 || (intensity > 0.7 && bs % 2 === 0))) {
      noise({ t, d: bs % 4 === 2 ? 0.05 : 0.03, g: bs % 4 === 2 ? 0.06 : 0.03, type: 'highpass', f: 7500, bus: M });
    }
    if (intensity > 0.6 && (bs === 4 || bs === 12)) {
      noise({ t, d: 0.14, g: 0.13, type: 'bandpass', f: 1700, q: 0.8, bus: M });
    }
    const arpOn = intensity > 0.45 && (s % 2 === 0 || intensity > 0.82 || fever);
    if (arpOn) {
      const n = chord[ARP[s % 8] % 4] + 12 + (fever ? 12 : 0) + (s % 16 >= 8 ? 12 : 0);
      tone({ type: 'sine', f: mtof(n), t, a: 0.004, d: 0.16, g: 0.045, bus: M, send: 0.6 });
    }
    if (fever && s % 4 === 0) tone({ type: 'triangle', f: mtof(chord[(s / 4) % 4] + 24), t, a: 0.003, d: 0.4, g: 0.028, bus: M, send: 0.8 });
  }

  const fx = {
    click() { tone({ f: 880, f2: 1100, d: 0.05, g: 0.05 }); },
    shard(k) { const n = PENTA[clamp(k, 0, PENTA.length - 1)]; tone({ f: mtof(n), d: 0.14, g: 0.09 }); tone({ type: 'triangle', f: mtof(n + 12), d: 0.08, g: 0.03 }); },
    graze() { noise({ d: 0.28, g: 0.2, f: 700, f2: 3400, q: 2.5 }); tone({ f: 660, f2: 990, d: 0.12, g: 0.04 }); },
    hop() { tone({ f: 280, f2: 620, d: 0.13, g: 0.12 }); },
    land() { tone({ f: 150, f2: 60, d: 0.1, g: 0.14 }); noise({ d: 0.08, g: 0.06, type: 'lowpass', f: 600 }); },
    roll() { noise({ d: 0.36, g: 0.16, f: 2600, f2: 400, q: 2 }); },
    ring(perfect) {
      const base = perfect ? 84 : 79;
      [0, 4, 7].forEach((iv, i) => tone({ f: mtof(base + iv), t: ctx.currentTime + i * 0.045, d: 0.25, g: 0.06 }));
      if (perfect) tone({ type: 'triangle', f: mtof(base + 12), t: ctx.currentTime + 0.14, d: 0.4, g: 0.05 });
    },
    power() { [0, 4, 7, 12, 16].forEach((iv, i) => tone({ type: 'triangle', f: mtof(72 + iv), t: ctx.currentTime + i * 0.05, d: 0.16, g: 0.07 })); },
    shieldBreak() { noise({ d: 0.3, g: 0.2, type: 'highpass', f: 2500 }); tone({ type: 'triangle', f: 900, f2: 200, d: 0.35, g: 0.09 }); },
    smash() { noise({ d: 0.25, g: 0.2, type: 'bandpass', f: 1200, f2: 300 }); },
    crash() { noise({ d: 0.7, g: 0.42, type: 'lowpass', f: 1600, f2: 200 }); tone({ f: 95, f2: 30, d: 0.6, g: 0.4 }); },
    fever() { tone({ type: 'triangle', f: 380, f2: 1300, d: 0.45, g: 0.07 }); [0, 4, 7, 11].forEach((iv, i) => tone({ f: mtof(77 + iv), t: ctx.currentTime + 0.1 + i * 0.06, d: 0.3, g: 0.05 })); },
    impact() { noise({ d: 0.5, g: 0.25, type: 'lowpass', f: 500, f2: 80 }); tone({ f: 70, f2: 35, d: 0.4, g: 0.2 }); },
    milestone() { tone({ f: mtof(84), d: 0.3, g: 0.07 }); tone({ f: mtof(91), t: ctx.currentTime + 0.12, d: 0.5, g: 0.07 }); },
    zone() { [65, 69, 72, 76].forEach((n, i) => tone({ type: 'triangle', f: mtof(n + 12), t: ctx.currentTime + i * 0.09, d: 0.9, g: 0.035 })); },
    shutter() { noise({ d: 0.06, g: 0.2, type: 'highpass', f: 3000 }); noise({ t: ctx.currentTime + 0.08, d: 0.05, g: 0.12, type: 'highpass', f: 2000 }); },
    buy() { [0, 7, 12].forEach((iv, i) => tone({ f: mtof(79 + iv), t: ctx.currentTime + i * 0.07, d: 0.2, g: 0.07 })); },
    badge() { [0, 4, 7, 12].forEach((iv, i) => tone({ type: 'triangle', f: mtof(76 + iv), t: ctx.currentTime + i * 0.08, d: 0.35, g: 0.05 })); },
  };

  return {
    unlock, volumes, suspend,
    setIntensity(v) { target = clamp(v, 0, 1); },
    setFever(v) { fever = v; },
    play(name, arg) { if (!ctx || ctx.state !== 'running' || S.settings.muted) return; try { fx[name](arg); } catch (e) { /* ignore */ } },
  };
})();
