/* ============ interface: menu, HUD, sheets, game over, share card, photo & capture ============ */
const ico = (id, cls) => `<svg class="ic ${cls || ''}"><use href="#i-${id}"/></svg>`;
const shardIco = () => '<svg class="ic shard-ic"><use href="#i-shard"/></svg>';

const UI = {
  kind: null, back: null, hudCache: {}, reviveTimer: 0, lastRun: null, cardBlob: null, cardUrl: '', boardTab: 'today',
  init() {
    this.ov = $('#overlay');
    $('#playFree').addEventListener('click', () => { Sound.play('click'); this.closeSheet(true); startRun('free'); });
    $('#playDaily').addEventListener('click', () => { Sound.play('click'); this.closeSheet(true); startRun('daily'); });
    $$('[data-open]').forEach((b) => b.addEventListener('click', () => { Sound.unlock(); Sound.play('click'); this.openSheet(b.dataset.open); }));
    $('#langBtn').addEventListener('click', () => { this.setLang(LANG === 'en' ? 'ru' : 'en'); Sound.unlock(); Sound.play('click'); });
    $('#soundBtn').addEventListener('click', () => { Sound.unlock(); this.toggleMute(); });
    $('#pauseBtn').addEventListener('click', () => this.pause());
    $('#phExit').addEventListener('click', () => this.exitPhoto());
    $('#phShoot').addEventListener('click', () => this.shoot());
    $('#phRatio').addEventListener('click', () => this.toggleCapture());
    this.ov.addEventListener('click', (ev) => { if (ev.target === this.ov && this.kind && this.kind.startsWith('sheet')) this.closeSheet(); });
    this.refreshSound();
    this.refreshMenu();
  },
  setLang(l) {
    LANG = l; S.lang = l; save();
    applyI18n(); this.refreshMenu();
    $('#langBtn').textContent = l.toUpperCase();
    if (this.kind === 'sheet:settings') this.openSheet('settings', true);
  },
  refreshSound() {
    $('#soundBtn').innerHTML = ico(S.settings.muted ? 'mute' : 'sound');
    $('#soundBtn').classList.toggle('on', !S.settings.muted);
  },
  toggleMute() { S.settings.muted = !S.settings.muted; save(); Sound.volumes(); this.refreshSound(); this.toast(t('sound') + ': ' + (S.settings.muted ? 'off' : 'on')); },
  refreshMenu() {
    ensureMissions();
    $('#walletVal').textContent = fmt(S.wallet);
    $('#freeMeta').textContent = S.bestFree.score ? t('best') + ' ' + fmt(S.bestFree.score) : t('freeFlight');
    const day = dayKey(), dn = dayNumber(day);
    const d = S.daily.day === day ? S.daily : null;
    $('#dailyMeta').textContent = '#' + dn + ' · ' + (d && d.score ? t('best') + ' ' + fmt(d.score) : dayLabel(day, LANG));
    const left = S.missions.list.filter((m) => !m.done).length;
    const dot = $('#missionDot'); dot.hidden = left === 0; dot.textContent = left;
    $('#langBtn').textContent = LANG.toUpperCase();
  },

  /* ---------- state switches ---------- */
  enterMenu() {
    G.state = 'menu'; G.camMode = 'menu';
    clearEnts(); FX.clear();
    Ship.root.visible = true; Ship.ghost.grp.visible = false; Ship.resetTrails();
    Object.assign(G.ship, { roll: 0, inv: 0, air: false, vy: 0 });
    G.fever = 0; G.comet = 0; G.shield = false; G.magnet = 0; G.ts = 1;
    Sound.setIntensity(0); Sound.setFever(false);
    $('#hud').hidden = true; $('#menu').hidden = false; $('#photo').hidden = true;
    this.hideOverlay(); this.hint(null);
    $('#fx-speed').classList.remove('on'); $('#fx-fever').classList.remove('on');
    this.refreshMenu();
  },
  enterPlay(revived) {
    $('#menu').hidden = true; $('#hud').hidden = false; $('#photo').hidden = true;
    this.hideOverlay(); this.hudCache = {};
    if (!revived) { this.flash(); this.hint(null); $('#popups').innerHTML = ''; }
  },
  hideOverlay() { this.ov.hidden = true; this.ov.innerHTML = ''; this.ov.className = 'overlay'; this.kind = null; clearInterval(this.reviveTimer); },
  showOverlay(kind, html, cls) {
    clearInterval(this.reviveTimer);
    this.ov.className = 'overlay ' + (cls || '');
    this.ov.innerHTML = html; this.ov.hidden = false; this.kind = kind;
    const f = this.ov.querySelector('[data-focus]') || this.ov.querySelector('button');
    if (f && !INPUT.touchUI) setTimeout(() => f.focus({ preventScroll: true }), 30);
  },
  flash() { const f = $('#flash'); f.classList.remove('hit'); void f.offsetWidth; f.classList.add('hit'); },

  /* ---------- HUD ---------- */
  hud() {
    if (G.state !== 'play' && G.state !== 'crash') return;
    const c = this.hudCache, set = (id, v) => { if (c[id] !== v) { c[id] = v; $('#' + id).textContent = v; } };
    set('hScore', fmt(G.score));
    set('hDist', fmt(G.dist));
    set('hClock', clockAt(G.dist));
    set('hShards', fmt(G.shards));
    const showCombo = G.mult > 1 || G.fever > 0;
    if (c.combo !== showCombo) { c.combo = showCombo; $('#hCombo').hidden = !showCombo; }
    if (showCombo) {
      set('hMult', '×' + G.mult);
      const p = G.fever > 0 ? G.fever / 7 : G.comboT / 4;
      $('#hComboBar').style.transform = 'scaleX(' + clamp(p, 0, 1).toFixed(3) + ')';
    }
    const fev = G.fever > 0;
    if (c.fev !== fev) { c.fev = fev; $('#hFever').hidden = !fev; $('#fx-fever').classList.toggle('on', fev); }
    const speedFx = G.comet > 0 && !reducedMotion();
    if (c.spd !== speedFx) { c.spd = speedFx; $('#fx-speed').classList.toggle('on', speedFx); }
    const rp = G.ship.rollCd > 0 ? 1 - G.ship.rollCd / 2.2 : 1;
    const rk = rp.toFixed(2);
    if (c.roll !== rk) { c.roll = rk; const r = $('#hRoll'); r.style.setProperty('--p', rk); r.classList.toggle('ready', rp >= 1); }
    const pw = [];
    if (G.magnet > 0) pw.push(['magnet', G.magnet / 9, '#FF7A6B', t('pwMagnet')]);
    if (G.shield) pw.push(['shield', 1, '#8FD9C1', t('pwShield')]);
    if (G.comet > 0) pw.push(['comet', G.comet / 4.5, '#FFE07A', t('pwComet')]);
    const key = pw.map((p) => p[0]).join();
    if (c.pw !== key) {
      c.pw = key;
      $('#hPower').innerHTML = pw.map((p) => `<div class="pw" data-k="${p[0]}"><span class="sw" style="background:${p[2]}">${ico(p[0])}</span>${esc(p[3])}<i><span></span></i></div>`).join('');
    }
    pw.forEach((p) => { const el = $('#hPower [data-k="' + p[0] + '"] i span'); if (el) el.style.transform = 'scaleX(' + clamp(p[1], 0, 1).toFixed(3) + ')'; });
  },
  scoreBump() { const el = $('#hScore'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); },
  multBump() { const el = $('#hMult'); el.classList.remove('up'); void el.offsetWidth; el.classList.add('up'); },
  banner(text, sub) {
    const b = $('#banner');
    b.innerHTML = esc(text) + (sub ? '<small>' + esc(sub) + '</small>' : '');
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  },
  hint(text, cls) {
    const h = $('#hint');
    if (!text) { h.classList.remove('show'); return; }
    h.className = 'hint ' + (cls || '');
    $('#hintText').textContent = text;
    void h.offsetWidth; h.classList.add('show');
  },
  toast(text, sub, badge) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = (badge ? `<span class="hex" style="--c:${badge.c}">${esc(badge.code)}</span>` : '') + '<div>' + esc(text) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 3700);
  },
  toastAch(a) { Sound.play('badge'); this.toast(t('achUnlocked') + ': ' + a[LANG][0], a[LANG][1], a); },

  /* ---------- pause ---------- */
  pause() {
    if (G.state !== 'play') return;
    G.state = 'paused'; INPUT.ptr = null; INPUT.left = INPUT.right = false;
    Sound.setIntensity(0.1);
    this.showOverlay('pause', `<div class="card"><div class="card-head"><div><div class="eyebrow">${fmt(G.dist)} m · ${clockAt(G.dist)}</div><h2>${esc(t('paused'))}</h2></div></div>
      <div class="pause-grid">
        <button class="btn btn-coral btn-xl" data-a="resume" data-focus><span class="big">${esc(t('resume'))}</span></button>
        <div class="row"><button class="btn btn-butter" data-a="photo">${ico('camera')}${esc(t('photoMode'))}</button><button class="btn btn-lilac" data-a="capture">${ico('frame')}${esc(t('captureMode'))}</button></div>
        <div class="row"><button class="btn" data-a="settings">${ico('sliders')}${esc(t('settings'))}</button><button class="btn" data-a="restart">${ico('again')}${esc(t('restart'))}</button><button class="btn" data-a="menu">${ico('home')}${esc(t('toMenu'))}</button></div>
      </div></div>`);
    this.ov.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
      Sound.play('click');
      const a = b.dataset.a;
      if (a === 'resume') this.resume();
      if (a === 'photo') this.enterPhoto();
      if (a === 'capture') { this.toggleCapture(); this.resume(); }
      if (a === 'settings') { this.back = () => { G.state = 'play'; this.pause(); }; this.openSheet('settings'); }
      if (a === 'restart') { const m = G.mode; startRun(m); }
      if (a === 'menu') this.enterMenu();
    }));
  },
  resume() {
    if (G.state !== 'paused') return;
    this.hideOverlay();
    G.state = 'play';
    Sound.setIntensity(0.4);
  },

  /* ---------- revive ---------- */
  showRevive() {
    const can = S.wallet + G.shards >= REVIVE_COST;
    this.showOverlay('revive', `<div class="card" style="text-align:center"><div class="eyebrow">${fmt(G.dist)} m</div><h2>${esc(t('secondChance'))}</h2>
      <div class="revive-ring"><svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="52"/><circle class="bar" id="rvBar" cx="60" cy="60" r="52"/></svg><b id="rvNum">4</b></div>
      <p class="note">${esc(t('reviveNote'))}</p>
      <div class="stack" style="margin-top:14px"><button class="btn btn-mint btn-xl" data-a="yes" data-focus ${can ? '' : 'disabled'} style="align-items:center"><span class="big">${esc(t('reviveFor', { n: REVIVE_COST }))}</span><small>${shardIco()} ${fmt(S.wallet + G.shards)}</small></button>
      <button class="btn" data-a="no">${esc(t('skip'))}</button></div></div>`);
    const t0 = performance.now(), T = 4000;
    const bar = $('#rvBar'), num = $('#rvNum');
    this.reviveTimer = setInterval(() => {
      const u = clamp((performance.now() - t0) / T, 0, 1);
      bar.style.strokeDashoffset = (327 * u).toFixed(1);
      num.textContent = Math.ceil(4 - u * 4);
      if (u >= 1) { clearInterval(this.reviveTimer); this.hideOverlay(); endRun(); }
    }, 50);
    this.ov.querySelector('[data-a="yes"]').addEventListener('click', () => { clearInterval(this.reviveTimer); Sound.play('power'); revive(); });
    this.ov.querySelector('[data-a="no"]').addEventListener('click', () => { clearInterval(this.reviveTimer); this.hideOverlay(); endRun(); });
  },

  /* ---------- game over ---------- */
  showOver(run) {
    this.lastRun = run;
    $('#hud').hidden = true; this.hint(null);
    $('#fx-speed').classList.remove('on'); $('#fx-fever').classList.remove('on');
    const z = ZONE_DEF[zoneAt(run.dist).i];
    const eyebrow = run.mode === 'daily' ? t('dailyRunLabel', { n: dayNumber(run.day), date: dayLabel(run.day, LANG) }) : t('free');
    this.showOverlay('over', `<div class="card">
      <div class="over-top"><div><div class="eyebrow">${esc(eyebrow)}</div><h2>${esc(t('crashedIn', { zone: t(z.key), time: clockAt(run.dist) }))}</h2></div>${run.isBest ? `<div class="stamp">${esc(t('newBest'))}</div>` : ''}</div>
      <div class="big-score">${fmt(run.score)}</div>
      <div class="stats">
        <div class="stat"><b>${fmt(run.dist)}</b><span>${esc(t('distance'))}</span></div>
        <div class="stat"><b>${fmt(run.shards)}</b><span>${esc(t('shards'))}</span></div>
        <div class="stat"><b>${fmt(run.grazes)}</b><span>${esc(t('grazes'))}</span></div>
        <div class="stat"><b>×${run.mult}</b><span>${esc(t('combo'))}</span></div>
      </div>
      <div class="lb-note" id="lbNote"></div>
      <div class="card-preview"><img id="cardImg" alt="Result card"><div><p class="note" style="margin:0 0 8px">${esc(t('cardHint'))}</p>
        <div class="row"><button class="btn btn-butter" data-a="save">${ico('save')}${esc(t('saveCard'))}</button><button class="btn" data-a="copy">${ico('copy')}${esc(t('copyText'))}</button></div></div></div>
      <div class="row" style="flex-wrap:nowrap"><button class="btn btn-coral btn-xl" data-a="again" data-focus style="flex:2;align-items:center"><span class="big">${esc(t('flyAgain'))}</span></button><button class="btn" data-a="menu" style="flex:1;white-space:nowrap;padding-inline:.7em">${ico('home')}${esc(t('toMenu'))}</button></div>
      <p class="note" style="text-align:center;margin-top:12px">${shardIco()} ${esc(t('wallet'))}: ${fmt(S.wallet)}</p>
    </div>`);
    this.ov.querySelector('[data-a="again"]').addEventListener('click', () => this.again());
    this.ov.querySelector('[data-a="menu"]').addEventListener('click', () => { Sound.play('click'); this.enterMenu(); });
    this.ov.querySelector('[data-a="save"]').addEventListener('click', () => this.saveCard());
    this.ov.querySelector('[data-a="copy"]').addEventListener('click', () => {
      const txt = run.mode === 'daily' ? t('shareDaily', { n: dayNumber(run.day), score: fmt(run.score), dist: fmt(run.dist) }) + ' ' + t('shareText', { dist: fmt(run.dist), score: fmt(run.score) }) : t('shareText', { dist: fmt(run.dist), score: fmt(run.score) });
      copyText(txt);
    });
    run.missions.forEach((m, i) => setTimeout(() => { Sound.play('buy'); this.toast(t('missionDone') + ' · +' + m.reward, missionText(m)); }, 500 + i * 700));
    this.setBoardNote(Net.db ? '' : '');
    makeCard(run).then((blob) => {
      this.cardBlob = blob;
      if (this.cardUrl) URL.revokeObjectURL(this.cardUrl);
      this.cardUrl = URL.createObjectURL(blob);
      const img = $('#cardImg'); if (img) img.src = this.cardUrl;
    }).catch(() => {});
  },
  setBoardNote(text) { const n = $('#lbNote'); if (n) { n.textContent = text; n.hidden = !text; } },
  again() { if (G.state !== 'over') return; Sound.play('click'); startRun(G.mode); },
  saveCard() {
    if (!this.cardBlob) return;
    const r = this.lastRun;
    saveFile(this.cardBlob, 'sunskip-' + r.score + '.png').then((ok) => { if (ok !== null) this.toast(ok ? t('cardSaved') : t('saveFail')); });
  },

  /* ---------- sheets ---------- */
  sheetOpen() { return !!(this.kind && this.kind.startsWith('sheet')); },
  openSheet(name, keep) {
    const body = this['sheet_' + name]();
    this.showOverlay('sheet:' + name, `<div class="card"><div class="card-head"><div><div class="eyebrow">${esc(body.eyebrow || '')}</div><h2>${esc(body.title)}</h2></div>
      <button class="btn btn-icon" data-a="close" aria-label="${esc(t('close'))}">${ico('close')}</button></div>${body.html}</div>`, 'sheet' + (name === 'hangar' ? ' clear compact' : ''));
    this.ov.querySelector('[data-a="close"]').addEventListener('click', () => { Sound.play('click'); this.closeSheet(); });
    if (body.bind) body.bind(this.ov);
    if (name === 'hangar') { G.camMode = 'hangar'; $('#menu').hidden = true; }
    void keep;
  },
  closeSheet(silent) {
    if (!this.sheetOpen()) return;
    if (this.kind === 'sheet:hangar') { G.camMode = G.state === 'menu' ? 'menu' : G.camMode; if (Ship.skin.id !== S.skin) Ship.setSkin(S.skin); if (G.state === 'menu') $('#menu').hidden = false; }
    this.hideOverlay();
    this.refreshMenu();
    if (this.back && !silent) { const b = this.back; this.back = null; b(); }
    this.back = null;
  },

  sheet_hangar() {
    const html = `<p class="skin-desc" id="skinDesc"></p><div class="skins" style="margin-top:12px">${SKINS.map((s) => {
      const own = S.owned.includes(s.id), sel = S.skin === s.id;
      return `<button class="skin ${sel ? 'sel' : ''} ${own ? '' : 'locked'}" data-skin="${s.id}" type="button">
        <span class="sw"><i style="background:${s.body}"></i><i style="background:${s.wing}"></i><i style="background:${s.accent}"></i></span>
        <b>${esc(s.name[LANG])}</b>
        <small>${sel ? esc(t('selected')) : own ? esc(t('select')) : ico('lock') + ' ' + shardIco() + ' ' + fmt(s.price)}</small></button>`;
    }).join('')}</div>
      <div class="row" style="margin-top:14px;align-items:center;justify-content:space-between"><span class="wallet">${shardIco()}<span>${fmt(S.wallet)}</span></span><button class="btn btn-coral" id="skinAct" hidden></button></div>
      <p class="note" style="margin-top:10px">${esc(t('skinsNote'))}</p>`;
    return {
      title: t('hangar'), eyebrow: S.owned.length + ' / ' + SKINS.length, html,
      bind: (root) => {
        let preview = S.skin;
        const desc = $('#skinDesc', root), act = $('#skinAct', root);
        const show = (id) => {
          preview = id; const s = skinById(id); Ship.setSkin(id);
          desc.textContent = s.name[LANG] + '. ' + s.desc[LANG];
          const own = S.owned.includes(id);
          root.querySelectorAll('.skin').forEach((b) => b.classList.toggle('sel', b.dataset.skin === id));
          if (own) { act.hidden = true; if (S.skin !== id) { S.skin = id; save(); root.querySelectorAll('.skin small').forEach((sm) => { const bid = sm.parentElement.dataset.skin; if (S.owned.includes(bid)) sm.textContent = bid === id ? t('selected') : t('select'); }); } }
          else {
            act.hidden = false;
            const need = s.price - S.wallet;
            act.disabled = need > 0;
            act.innerHTML = need > 0 ? esc(t('needMore', { n: fmt(need) })) + ' ' + shardIco() : ico('lock') + esc(t('unlock')) + ' · ' + fmt(s.price);
          }
        };
        root.querySelectorAll('.skin').forEach((b) => b.addEventListener('click', () => { Sound.play('click'); show(b.dataset.skin); }));
        act.addEventListener('click', () => {
          const s = skinById(preview);
          if (S.wallet < s.price || S.owned.includes(s.id)) return;
          S.wallet -= s.price; S.owned.push(s.id); S.skin = s.id; save();
          Sound.play('buy'); this.toast(t('unlocked') + ': ' + s.name[LANG]);
          this.openSheet('hangar');
          const b = this.ov.querySelector('[data-skin="' + s.id + '"]'); if (b) b.click();
        });
        show(S.skin);
      },
    };
  },
  sheet_missions() {
    ensureMissions();
    const html = `<div class="stack">${S.missions.list.map((m) => `<div class="mission ${m.done ? 'done' : ''}">
        <div class="mission-top"><span>${esc(missionText(m))}</span><span class="reward">${shardIco()} ${m.reward}</span></div>
        <div class="bar"><span style="width:${(100 * m.p / m.goal).toFixed(1)}%"></span></div>
        <small>${m.done ? esc(t('done')) : fmt(m.p) + ' / ' + fmt(m.goal)}</small></div>`).join('')}</div>
      <p class="note" style="margin-top:12px">${esc(t('missionsNote'))}</p>`;
    return { title: t('dailyMissions'), eyebrow: dayLabel(dayKey(), LANG), html };
  },
  sheet_board() {
    const online = !!Net.db;
    const html = `${online ? `<div class="tabs" role="tablist"><button class="tab" data-tab="today" role="tab">${esc(t('today'))}</button><button class="tab" data-tab="all" role="tab">${esc(t('allTime'))}</button></div>` : `<p class="note" style="margin:0 0 12px">${esc(t('boardLocal'))}</p>`}
      <ol class="lb" id="lbList"></ol>
      ${online ? `<div class="nick-row"><input class="field" id="nickIn" maxlength="14" placeholder="${esc(t('pilotName'))}" aria-label="${esc(t('pilotName'))}" value="${esc(S.nick || Net.defaultNick())}"><button class="btn btn-butter" id="nickSave">${esc(t('saveName'))}</button></div>` : ''}`;
    return {
      title: t('board'), eyebrow: online ? '#' + dayNumber(dayKey()) + ' · ' + dayLabel(dayKey(), LANG) : t('yourDevice'), html,
      bind: (root) => {
        const list = $('#lbList', root);
        const renderLocal = () => {
          list.innerHTML = S.local.length ? S.local.map((r, i) => `<li><span class="rk">${i + 1}</span><span class="nm"><i style="background:${skinById(r.skin).body}"></i>${esc(r.mode === 'daily' ? t('dailyRun') + ' ' + dayLabel(r.day, LANG) : t('free'))}</span><span class="sc">${fmt(r.score)}<small>${fmt(r.dist)} m</small></span></li>`).join('') : `<li class="empty" style="display:block">${esc(t('noBest'))}</li>`;
        };
        if (!online) { renderLocal(); return; }
        const load = async (tab) => {
          this.boardTab = tab;
          root.querySelectorAll('.tab').forEach((b) => { b.classList.toggle('on', b.dataset.tab === tab); b.setAttribute('aria-selected', b.dataset.tab === tab); });
          list.innerHTML = `<li class="empty" style="display:block">${esc(t('boardLoading'))}</li>`;
          const rows = await Net.board(tab);
          if (!rows) { list.innerHTML = `<li class="empty" style="display:block">${esc(t('boardErr'))}</li>`; return; }
          if (!rows.length) { list.innerHTML = `<li class="empty" style="display:block">${esc(t('boardEmpty'))}</li>`; return; }
          list.innerHTML = '';
          rows.forEach((r, i) => {
            const li = document.createElement('li'); if (r.me) li.className = 'me';
            li.innerHTML = `<span class="rk">${i + 1}</span><span class="nm"><i style="background:${skinById(r.skin).body}"></i><span></span></span><span class="sc">${fmt(r.score)}<small>${fmt(r.dist)} m</small></span>`;
            li.querySelector('.nm span').textContent = r.nick;
            list.appendChild(li);
          });
        };
        root.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { Sound.play('click'); load(b.dataset.tab); }));
        load(this.boardTab);
        $('#nickSave', root).addEventListener('click', async () => {
          const v = Net.cleanNick($('#nickIn', root).value);
          if (!v) return;
          S.nick = v; save();
          const ok = await Net.saveNick();
          this.toast(ok ? t('nameSaved') : t('viewOnly'));
          load(this.boardTab);
        });
      },
    };
  },
  sheet_log() {
    const st = S.stats;
    const cells = [[st.runs, 'stRuns'], [st.dist, 'stDist'], [st.bestScore, 'stBest'], [st.bestDist, 'stBestDist'], [st.shards, 'stShards'], [st.grazes, 'stGrazes'], [st.perfects, 'stPerfect'], [Math.round(st.time / 60), 'stTime']];
    const html = `<div class="log-stats">${cells.map((c) => `<div><b>${fmt(c[0])}</b><span>${esc(t(c[1]))}</span></div>`).join('')}</div>
      <div class="section-title">${esc(t('achievements'))} · ${Object.keys(S.ach).length}/${ACH.length}</div>
      <div class="badges">${ACH.map((a) => `<div class="badge ${S.ach[a.id] ? '' : 'off'}"><span class="hex"><span style="--c:${a.c}">${esc(a.code)}</span></span>${esc(a[LANG][0])}<small>${esc(a[LANG][1])}</small></div>`).join('')}</div>`;
    return { title: t('pilotLog'), eyebrow: t('courier'), html };
  },
  sheet_settings() {
    const st = S.settings;
    const tog = (id, on) => `<button class="toggle" id="${id}" role="switch" aria-checked="${on ? 'true' : 'false'}" type="button"></button>`;
    const html = `<div class="set-list">
      <div class="set"><span class="lbl">${esc(t('language'))}</span><div class="seg" id="setLang"><button data-v="en" class="${LANG === 'en' ? 'on' : ''}">EN</button><button data-v="ru" class="${LANG === 'ru' ? 'on' : ''}">RU</button></div></div>
      <div class="set"><label for="setMusic">${esc(t('music'))}</label><input type="range" id="setMusic" min="0" max="1" step="0.05" value="${st.music}"></div>
      <div class="set"><label for="setSfx">${esc(t('sfx'))}</label><input type="range" id="setSfx" min="0" max="1" step="0.05" value="${st.sfx}"></div>
      <div class="set"><span class="lbl">${esc(t('haptics'))}<small>${esc(t('hapticsSub'))}</small></span>${tog('setHaptics', st.haptics)}</div>
      <div class="set"><span class="lbl">${esc(t('quality'))}</span><div class="seg" id="setQuality">${['auto', 'low', 'high'].map((q) => `<button data-v="${q}" class="${st.quality === q ? 'on' : ''}">${esc(t('q' + q[0].toUpperCase() + q.slice(1)))}</button>`).join('')}</div></div>
      <div class="set"><span class="lbl">${esc(t('reduced'))}<small>${esc(t('reducedSub'))}</small></span>${tog('setReduced', reducedMotion())}</div>
      <div class="set"><span class="lbl">${esc(t('contrast'))}<small>${esc(t('contrastSub'))}</small></span>${tog('setContrast', st.contrast)}</div>
      <div class="set"><label for="setSens">${esc(t('sens'))}</label><input type="range" id="setSens" min="0.6" max="1.6" step="0.05" value="${st.sens}"></div>
      <div class="set"><span class="lbl">${esc(t('tutorial'))}</span><button class="btn" id="setTut">${ico('play', 'fill')}</button></div>
      <div class="set"><span class="lbl">${esc(t('resetData'))}</span><button class="btn" id="setReset">${ico('close')}</button></div>
    </div>`;
    return {
      title: t('settings'), eyebrow: 'Sunskip v1.0', html,
      bind: (root) => {
        const st2 = S.settings;
        root.querySelectorAll('#setLang button').forEach((b) => b.addEventListener('click', () => this.setLang(b.dataset.v)));
        $('#setMusic', root).addEventListener('input', (e) => { st2.music = +e.target.value; Sound.volumes(); save(); });
        $('#setSfx', root).addEventListener('input', (e) => { st2.sfx = +e.target.value; Sound.volumes(); save(); Sound.play('shard', 3); });
        $('#setSens', root).addEventListener('input', (e) => { st2.sens = +e.target.value; save(); });
        const bindTog = (id, get, setv) => { const b = $('#' + id, root); b.addEventListener('click', () => { const v = !get(); setv(v); b.setAttribute('aria-checked', v); save(); Sound.play('click'); }); };
        bindTog('setHaptics', () => st2.haptics, (v) => { st2.haptics = v; if (v) haptic(20); });
        bindTog('setReduced', () => reducedMotion(), (v) => { st2.reduced = v; document.documentElement.classList.toggle('reduced', v); });
        bindTog('setContrast', () => st2.contrast, (v) => { st2.contrast = v; });
        root.querySelectorAll('#setQuality button').forEach((b) => b.addEventListener('click', () => {
          st2.quality = b.dataset.v; save(); root.querySelectorAll('#setQuality button').forEach((x) => x.classList.toggle('on', x === b)); applyQuality(true); Sound.play('click');
        }));
        $('#setTut', root).addEventListener('click', () => { S.tutorialDone = false; save(); this.toast(t('tutorialQueued')); });
        let armed = false;
        $('#setReset', root).addEventListener('click', () => {
          if (!armed) { armed = true; this.toast(t('resetConfirm')); setTimeout(() => { armed = false; }, 3000); return; }
          const lang = S.lang; S = DEFAULT_SAVE(); S.lang = lang; save(); Ship.setSkin(S.skin); this.toast(t('resetDone')); this.refreshMenu(); this.openSheet('settings');
        });
      },
    };
  },

  /* ---------- 9:16 capture ---------- */
  toggleCapture() {
    const on = !$('#app').classList.contains('capture');
    $('#app').classList.toggle('capture', on);
    onResize();
    this.toast(on ? t('captureOn') : t('captureOff'));
  },

  /* ---------- photo mode ---------- */
  filters: [['fNatural', 'none'], ['fFilm', 'contrast(1.08) saturate(1.2) sepia(0.2)'], ['fDream', 'saturate(1.35) brightness(1.05) hue-rotate(-10deg)'], ['fMono', 'grayscale(1) contrast(1.2) brightness(1.03)']],
  enterPhoto() {
    G.state = 'photo';
    this.hideOverlay();
    $('#hud').hidden = true; $('#photo').hidden = false;
    const cp = W.camera.position, sp = Ship.root.position;
    const dx = cp.x - sp.x, dy = cp.y - sp.y, dz = cp.z - sp.z;
    G.photo.r = clamp(Math.hypot(dx, dy, dz), 3, 16);
    G.photo.yaw = clamp(Math.atan2(dx, dz), -1.75, 1.75); G.photo.pitch = clamp(Math.asin(dy / G.photo.r), -0.1, 1.3);
    $('#phHint').textContent = t('photoHint');
    const host = $('#phFilters');
    host.innerHTML = this.filters.map((f, i) => `<button class="chip ${i === G.photo.filter ? 'on' : ''}" data-f="${i}" type="button">${esc(t(f[0]))}</button>`).join('');
    host.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
      G.photo.filter = +b.dataset.f; host.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b));
      W.renderer.domElement.style.filter = this.filters[G.photo.filter][1];
    }));
    W.renderer.domElement.style.filter = this.filters[G.photo.filter][1];
    this.ptrs = new Map();
  },
  exitPhoto() {
    W.renderer.domElement.style.filter = '';
    $('#photo').hidden = true; $('#hud').hidden = false;
    G.state = 'play'; this.pause();
  },
  photoPointer(ev, phase) {
    const P = this.ptrs || (this.ptrs = new Map());
    if (phase === 'down') { P.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); try { ev.target.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ } return; }
    if (phase === 'up') { P.delete(ev.pointerId); this.pinch = 0; return; }
    const p = P.get(ev.pointerId); if (!p) return;
    if (P.size >= 2) {
      const pts = Array.from(P.values());
      p.x = ev.clientX; p.y = ev.clientY;
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this.pinch) G.photo.r = clamp(G.photo.r * this.pinch / d, 3, 16);
      this.pinch = d; return;
    }
    G.photo.yaw = clamp(G.photo.yaw - (ev.clientX - p.x) * 0.008, -1.75, 1.75);
    G.photo.pitch = clamp(G.photo.pitch + (ev.clientY - p.y) * 0.006, -0.08, 1.35);
    p.x = ev.clientX; p.y = ev.clientY;
  },
  shoot() {
    Sound.play('shutter'); this.flash();
    G.shotWanted = true;
  },
  finishShot(src) {
    const w = src.width, h = src.height;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    try { x.filter = this.filters[G.photo.filter][1]; } catch (e) { /* older Safari */ }
    x.drawImage(src, 0, 0);
    x.filter = 'none';
    const s = Math.max(1, w / 1080);
    x.font = `400 ${Math.round(34 * s)}px "Dela Gothic One", sans-serif`;
    x.lineJoin = 'round'; x.lineWidth = 8 * s; x.strokeStyle = '#2F2A55'; x.fillStyle = '#FFF9F1';
    const label = 'SUNSKIP · ' + fmt(G.dist) + ' m · ' + clockAt(G.dist);
    x.strokeText(label, 28 * s, h - 32 * s); x.fillText(label, 28 * s, h - 32 * s);
    c.toBlob((blob) => {
      if (!blob) return;
      saveFile(blob, 'sunskip-photo-' + Math.floor(G.dist) + '.png').then((ok) => {
        if (ok === null) return;
        this.toast(ok ? t('photoSaved') : t('saveFail'));
        if (ok) { S.stats.photos++; save(); checkAch(null, S.stats); }
      });
    }, 'image/png');
  },
};

/* ---------- result card, 1080×1350 ---------- */
async function makeCard(run) {
  try { await Promise.all([document.fonts.load('400 80px "Dela Gothic One"'), document.fonts.load('800 40px "M PLUS Rounded 1c"')]); } catch (e) { /* fallback fonts */ }
  const W1 = 1080, H1 = 1350;
  const c = document.createElement('canvas'); c.width = W1; c.height = H1;
  const x = c.getContext('2d');
  const snap = G.snap;
  const g = x.createLinearGradient(0, 0, 0, H1); g.addColorStop(0, '#C4B2F0'); g.addColorStop(0.6, '#FFD8BF'); g.addColorStop(1, '#F7D0B2');
  x.fillStyle = g; x.fillRect(0, 0, W1, H1);
  if (snap) {
    // scale so the crash point lands in the open area above the sticker panel
    const frac = G.snapFrac || 0.65;
    const s = Math.max(W1 / snap.width, (H1 + 420) / snap.height);
    const w = snap.width * s, h = snap.height * s;
    const y = clamp(560 - frac * h, H1 - h, 0);
    x.drawImage(snap, (W1 - w) / 2, y, w, h);
  }
  const fade = x.createLinearGradient(0, H1 * 0.45, 0, H1); fade.addColorStop(0, 'rgba(255,243,226,0)'); fade.addColorStop(1, 'rgba(255,243,226,0.85)');
  x.fillStyle = fade; x.fillRect(0, 0, W1, H1);
  const INK = '#2F2A55';
  x.lineJoin = 'round';
  // logo
  const letters = 'SUNSKIP', cols = ['#FF7A6B', '#FFE07A', '#8FD9C1', '#B9A8F5', '#FFC9A3', '#FF7A6B', '#FFE07A'];
  x.font = '400 92px "Dela Gothic One", "Arial Black", sans-serif';
  let lx = 64;
  for (let i = 0; i < letters.length; i++) {
    const ch = letters[i], w = x.measureText(ch).width;
    x.fillStyle = INK; x.fillText(ch, lx, 150 + 9);
    x.lineWidth = 14; x.strokeStyle = INK; x.strokeText(ch, lx, 150);
    x.fillStyle = cols[i]; x.fillText(ch, lx, 150);
    lx += w + 2;
  }
  // sticker panel
  const px = 56, py = 760, pw = W1 - 112, ph = 520, r = 44;
  const rr = (X, Y, Wd, Hd) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + Wd, Y, X + Wd, Y + Hd, r); x.arcTo(X + Wd, Y + Hd, X, Y + Hd, r); x.arcTo(X, Y + Hd, X, Y, r); x.arcTo(X, Y, X + Wd, Y, r); x.closePath(); };
  x.fillStyle = INK; rr(px, py + 14, pw, ph); x.fill();
  x.fillStyle = '#FFF3E2'; rr(px, py, pw, ph); x.fill();
  x.lineWidth = 7; x.strokeStyle = INK; rr(px, py, pw, ph); x.stroke();
  const eyebrow = (run.mode === 'daily' ? t('dailyRunLabel', { n: dayNumber(run.day), date: dayLabel(run.day, LANG) }) : t('free')).toUpperCase();
  x.fillStyle = INK; x.font = '800 30px "M PLUS Rounded 1c", sans-serif';
  x.fillText(eyebrow, px + 44, py + 70);
  x.font = '400 170px "Dela Gothic One", "Arial Black", sans-serif';
  const sc = fmt(run.score);
  x.fillStyle = INK; x.fillText(sc, px + 44, py + 250 + 12);
  x.lineWidth = 16; x.strokeStyle = INK; x.strokeText(sc, px + 44, py + 250);
  x.fillStyle = '#FF7A6B'; x.fillText(sc, px + 44, py + 250);
  if (run.isBest) {
    x.save(); x.translate(px + pw - 150, py + 60); x.rotate(0.14);
    x.fillStyle = INK; rr(-110, -34 + 6, 220, 68); x.fill();
    x.fillStyle = '#FFE07A'; rr(-110, -34, 220, 68); x.fill(); x.lineWidth = 5; x.stroke();
    x.fillStyle = INK; x.font = '400 32px "Dela Gothic One", sans-serif'; x.textAlign = 'center'; x.fillText(t('newBest'), 0, 12); x.textAlign = 'left';
    x.restore();
  }
  const stats = [[fmt(run.dist), t('distance')], [fmt(run.shards), t('shards')], [fmt(run.grazes), t('grazes')], ['×' + run.mult, t('combo')]];
  const cw = (pw - 88) / 4;
  stats.forEach((s, i) => {
    const sx = px + 44 + i * cw;
    x.fillStyle = INK; x.font = '800 50px "M PLUS Rounded 1c", sans-serif'; x.fillText(s[0], sx, py + 360);
    x.globalAlpha = 0.72; x.font = '700 26px "M PLUS Rounded 1c", sans-serif'; x.fillText(s[1], sx, py + 400); x.globalAlpha = 1;
  });
  x.strokeStyle = 'rgba(47,42,85,.25)'; x.setLineDash([10, 10]); x.lineWidth = 3;
  x.beginPath(); x.moveTo(px + 44, py + 440); x.lineTo(px + pw - 44, py + 440); x.stroke(); x.setLineDash([]);
  const z = ZONE_DEF[zoneAt(run.dist).i];
  x.fillStyle = INK; x.font = '700 28px "M PLUS Rounded 1c", sans-serif';
  x.fillText(t('courier') + ' · ' + t(z.key) + ' ' + clockAt(run.dist), px + 44, py + 488);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/png'));
}
