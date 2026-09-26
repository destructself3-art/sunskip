/* ============ shared leaderboard (claude.ai runtime), file saves, clipboard ============ */
const NICK_A = { en: ['Peach', 'Mint', 'Lilac', 'Coral', 'Butter', 'Dune', 'Ring', 'Comet', 'Nectar', 'Apricot'], ru: ['Персик', 'Мята', 'Сирень', 'Коралл', 'Масло', 'Дюна', 'Кольцо', 'Комета', 'Нектар', 'Абрикос'] };
const NICK_B = { en: ['Pilot', 'Courier', 'Skipper', 'Glider', 'Kite', 'Moth'], ru: ['Пилот', 'Курьер', 'Шкипер', 'Планер', 'Змей', 'Мотылёк'] };

const Net = {
  db: null, uid: null, dl: null, remote: null, canWrite: true,
  async init() {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    try {
      const [db, user, dl] = await Promise.all([
        window.claude.use('db').catch(() => null),
        window.claude.use('user').catch(() => null),
        window.claude.use('downloads').catch(() => null),
      ]);
      this.dl = dl;
      if (db && user) {
        const id = await user.id();
        if (id) {
          this.db = db; this.uid = id;
          try { const snap = await db.doc('scores/' + id).get(); this.remote = snap.exists ? Object.assign({}, snap.data()) : null; } catch (e) { this.remote = null; }
          try { const w = await user.can('data.write'); if (w === false) this.canWrite = false; } catch (e) { /* unknown: let writes decide */ }
          if (!S.nick && this.remote && this.remote.nick) { S.nick = this.remote.nick; save(); }
        }
      }
    } catch (e) { /* the page works offline too */ }
    if (UI.kind === 'sheet:board') UI.openSheet('board');
  },
  defaultNick() {
    const r = mulberry(hashStr(this.uid || 'local'));
    const L = LANG === 'ru' ? 'ru' : 'en';
    return NICK_A[L][Math.floor(r() * 10)] + ' ' + NICK_B[L][Math.floor(r() * 6)];
  },
  cleanNick(v) { return String(v || '').replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 14); },
  async write(doc) {
    if (!this.db || !this.canWrite) return false;
    try { await this.db.doc('scores/' + this.uid).set(doc); this.remote = doc; return true; }
    catch (e) {
      if (e && e.code === 'unavailable') {
        await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
        try { await this.db.doc('scores/' + this.uid).set(doc); this.remote = doc; return true; } catch (e2) { /* give up */ }
      }
      if (e && e.code === 'invalid_argument') this.canWrite = false;
      return false;
    }
  },
  async saveNick() {
    if (!this.db) return false;
    const doc = Object.assign({ best: 0, bestDist: 0, skin: S.skin }, this.remote || {}, { nick: S.nick || this.defaultNick(), updatedAt: Date.now() });
    return this.write(doc);
  },
  async submit(run) {
    if (!this.db) return;
    if (!this.canWrite) { UI.setBoardNote(t('viewOnly')); return; }
    const today = dayKey();
    const doc = Object.assign({ best: 0, bestDist: 0 }, this.remote || {});
    let changed = false;
    const nick = S.nick || this.defaultNick();
    if (doc.nick !== nick) { doc.nick = nick; changed = true; }
    if (run.score > (doc.best || 0)) { doc.best = run.score; doc.bestDist = run.dist; doc.skin = run.skin; changed = true; }
    if (run.mode === 'daily') {
      if (doc.day !== today) { doc.day = today; doc.dayScore = 0; doc.dayDist = 0; }
      if (run.score > (doc.dayScore || 0)) { doc.dayScore = run.score; doc.dayDist = run.dist; doc.daySkin = run.skin; changed = true; }
    }
    if (!changed) return;
    doc.updatedAt = Date.now();
    const ok = await this.write(doc);
    if (!ok) { UI.setBoardNote(this.canWrite ? t('postFail') : t('viewOnly')); return; }
    if (run.mode === 'daily') {
      const rows = await this.board('today');
      const idx = rows ? rows.findIndex((r) => r.me) : -1;
      UI.setBoardNote(idx >= 0 ? t('postedRank', { n: idx + 1 }) : t('posted'));
    } else UI.setBoardNote(t('posted'));
  },
  async board(tab) {
    if (!this.db) return null;
    try {
      const col = this.db.collection('scores');
      const q = tab === 'today' ? col.where('day', '==', dayKey()).orderBy('dayScore', 'desc').limit(25) : col.orderBy('best', 'desc').limit(25);
      const snap = await q.get();
      return snap.docs.filter((d) => d.exists).map((d) => {
        const v = d.data() || {};
        const score = Number(tab === 'today' ? v.dayScore : v.best) || 0;
        return { nick: this.cleanNick(v.nick) || '—', score, dist: Number(tab === 'today' ? v.dayDist : v.bestDist) || 0, skin: String((tab === 'today' ? v.daySkin : v.skin) || 'kite'), me: d.id === this.uid };
      }).filter((r) => r.score > 0);
    } catch (e) { return null; }
  },
};

/* save a generated file: platform download prompt when available, plain link locally */
async function saveFile(blob, name) {
  if (Net.dl) {
    try { await Net.dl.save({ filename: name, data: blob }); return true; }
    catch (e) { if (e && (e.code === 'declined' || e.code === 'rate_limited')) return null; }
  }
  if (window.claude && typeof window.claude.use === 'function' && window.self !== window.top) return false;
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return true;
  } catch (e) { return false; }
}
function copyText(text) {
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    UI.toast(ok ? t('copied') : t('copyFail'), ok ? '' : text);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => UI.toast(t('copied')), fallback);
  else fallback();
}
