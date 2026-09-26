'use strict';
/* ============ helpers ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const TAU = Math.PI * 2;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function hashStr(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}
function mulberry(seed) {
  let a = seed >>> 0;
  const f = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.range = (a1, b1) => a1 + (b1 - a1) * f();
  f.int = (a1, b1) => Math.floor(a1 + (b1 - a1 + 1) * f());
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.sign = () => (f() < 0.5 ? -1 : 1);
  return f;
}

/* value noise for the terrain */
function hash2(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
}

/* dates: the daily run is shared worldwide, so it follows UTC */
function dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }
function dayLabel(key, lang) {
  const [y, m, dd] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd));
  return dt.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '');
}
function dayNumber(key) { return Math.floor((Date.parse(key + 'T00:00:00Z') - Date.parse('2026-01-01T00:00:00Z')) / 864e5) + 1; }

function fmt(n) { return Math.floor(n).toLocaleString(LANG === 'ru' ? 'ru-RU' : 'en-US'); }

function haptic(ms) {
  if (!S.settings.haptics) return;
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not allowed here */ }
}

/* ============ persistent save (per device) ============ */
const SAVE_KEY = 'sunskip.v1';
const DEFAULT_SAVE = () => ({
  lang: (navigator.language || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en',
  nick: '',
  wallet: 0,
  skin: 'kite',
  owned: ['kite'],
  tutorialDone: false,
  settings: { music: 0.7, sfx: 0.8, muted: false, haptics: true, quality: 'auto', reduced: null, contrast: false, sens: 1 },
  stats: { runs: 0, dist: 0, shards: 0, grazes: 0, perfects: 0, rings: 0, bestScore: 0, bestDist: 0, bestCombo: 0, time: 0, showers: 0, fevers: 0, dailyDays: [], photos: 0 },
  ach: {},
  bestFree: { score: 0, dist: 0 },
  daily: { day: '', score: 0, dist: 0, ghost: null, tries: 0 },
  missions: { day: '', list: [] },
  local: [],
});
let S = DEFAULT_SAVE();
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const d = JSON.parse(raw), base = DEFAULT_SAVE();
      S = Object.assign(base, d);
      S.settings = Object.assign(base.settings, d.settings || {});
      S.stats = Object.assign(base.stats, d.stats || {});
    }
  } catch (e) { S = DEFAULT_SAVE(); }
}
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage blocked */ } }, 120);
}

/* ============ i18n ============ */
let LANG = 'en';
const I18N = {
  en: {
    courier: 'Nectar moon · courier line',
    tagline: 'Skim the dunes of Nectar, a tiny moon where one day lasts <em>3,000 metres</em>.',
    fly: 'FLY', freeFlight: 'Free flight', daily: 'DAILY', dailyRun: 'Daily run',
    hangar: 'Hangar', missions: 'Missions', board: 'Board', log: 'Log', settings: 'Settings',
    keys: '<kbd>←</kbd><kbd>→</kbd> steer · <kbd>Space</kbd> hop · <kbd>Shift</kbd> roll · <kbd>C</kbd> 9:16',
    best: 'Best', bestShort: 'Best', tries: 'tries', noBest: 'No run yet',
    pause: 'Pause', sound: 'Sound', close: 'Close', takePhoto: 'Take photo', capture: '9:16 capture mode',
    fever: 'FEVER',
    paused: 'Paused', resume: 'Resume', photoMode: 'Photo mode', restart: 'Restart', toMenu: 'Menu', captureMode: '9:16 capture',
    captureOn: 'Capture mode on · C to exit', captureOff: 'Capture mode off',
    crashed: 'Crashed', crashedIn: 'Crashed at {zone} · {time}', newBest: 'NEW BEST', flyAgain: 'Fly again',
    distance: 'metres', shards: 'shards', grazes: 'grazes', combo: 'best combo',
    saveCard: 'Save card', copyText: 'Copy text', copied: 'Copied to clipboard', copyFail: 'Copy blocked here. Select the text and copy it yourself.',
    cardSaved: 'Card saved', cardHint: 'Your result card, 1080×1350. Long-press the image to save it on a phone.',
    shareText: 'I skimmed {dist} m on Nectar in Sunskip and scored {score}. Beat me?',
    shareDaily: 'Sunskip daily #{n}: {score} pts, {dist} m.',
    secondChance: 'Second chance?', reviveFor: 'Continue for {n}', skip: 'No, finish',
    reviveNote: 'The moon clears the road ahead.',
    zoneDawn: 'Dawn', zoneNoon: 'Noon', zoneDusk: 'Dusk', zoneNight: 'Moonrise', localTime: 'local time',
    meteor: 'Meteor shower', meteorSub: 'watch the ground markers',
    graze: 'GRAZE', perfect: 'PERFECT', skim: 'SKIM', ring: 'RING', smash: 'SMASH', saved: 'SAVED',
    pwMagnet: 'Magnet', pwShield: 'Shield', pwComet: 'Comet',
    hintSteer: 'Drag to steer', hintSteerKeys: '← → or A D to steer',
    hintHop: 'Tap to hop over ridges', hintHopKeys: 'Space to hop over ridges',
    hintRoll: 'Swipe down to barrel-roll through anything', hintRollKeys: 'Shift to barrel-roll through anything',
    hintGo: 'Graze obstacles for combo. Good luck, courier.',
    today: 'Today', allTime: 'All time', yourDevice: 'This device',
    boardLocal: 'The shared board lights up on the published page. Here are your best runs on this device.',
    boardEmpty: 'Nobody has flown today yet. Take the first spot.',
    boardLoading: 'Loading the board…', boardErr: 'The board did not load. Try again in a moment.',
    pilotName: 'Pilot name', saveName: 'Save', nameSaved: 'Name saved',
    posted: 'Posted to the board', postedRank: 'Posted · #{n} today', postFail: 'Could not post this score.', viewOnly: 'You can view the board but not post to it.',
    dailyMissions: 'Today’s missions', missionsNote: 'New missions every day at 00:00 UTC. Rewards land in your wallet automatically.',
    done: 'Done', reward: 'Reward',
    select: 'Select', selected: 'Flying', unlock: 'Unlock', needMore: 'Need {n} more',
    unlocked: 'Unlocked', skinsNote: 'Shards buy ships. Every ship flies the same, just prettier.',
    pilotLog: 'Pilot log', achievements: 'Badges',
    stRuns: 'runs', stDist: 'metres flown', stBest: 'best score', stBestDist: 'longest flight', stShards: 'shards collected', stGrazes: 'grazes', stPerfect: 'perfect rings', stTime: 'minutes in the air',
    language: 'Language', music: 'Music', sfx: 'Effects', haptics: 'Vibration', hapticsSub: 'Android phones only',
    quality: 'Graphics', qAuto: 'Auto', qLow: 'Low', qHigh: 'High',
    reduced: 'Reduced motion', reducedSub: 'No slow-mo, shake or speed lines',
    contrast: 'High-contrast hazards', contrastSub: 'Obstacles turn dark ink',
    sens: 'Steering sensitivity', tutorial: 'Replay tutorial', tutorialQueued: 'The tutorial will play on your next flight',
    resetData: 'Reset progress', resetConfirm: 'Tap again to erase everything', resetDone: 'Progress erased',
    photoHint: 'Drag to orbit · scroll or pinch to zoom', photoSaved: 'Photo saved',
    fNatural: 'Natural', fFilm: 'Film', fDream: 'Dream', fMono: 'Ink',
    loading: 'Warming up the moon', noGL: 'This browser cannot start WebGL, so the moon stays dark. Try a recent Chrome, Safari or Firefox.',
    achUnlocked: 'Badge unlocked', missionDone: 'Mission complete', dailyRunLabel: 'Daily run #{n} · {date}',
    free: 'Free flight', wallet: 'Wallet', ghostBest: 'your best',
    saveFail: 'Saving is blocked here. Long-press the image to keep it.',
  },
  ru: {
    courier: 'Луна Нектар · курьерская линия',
    tagline: 'Скользи над дюнами Нектара, крошечной луны, где сутки длятся <em>3000 метров</em>.',
    fly: 'ЛЕТИМ', freeFlight: 'Свободный полёт', daily: 'ДЕНЬ', dailyRun: 'Заезд дня',
    hangar: 'Ангар', missions: 'Задания', board: 'Рейтинг', log: 'Журнал', settings: 'Опции',
    keys: '<kbd>←</kbd><kbd>→</kbd> руль · <kbd>Пробел</kbd> прыжок · <kbd>Shift</kbd> бочка · <kbd>C</kbd> 9:16',
    best: 'Рекорд', bestShort: 'Рекорд', tries: 'попыт.', noBest: 'Ещё не летали',
    pause: 'Пауза', sound: 'Звук', close: 'Закрыть', takePhoto: 'Сделать фото', capture: 'Режим съёмки 9:16',
    fever: 'ЖАР',
    paused: 'Пауза', resume: 'Продолжить', photoMode: 'Фоторежим', restart: 'Заново', toMenu: 'В меню', captureMode: 'Съёмка 9:16',
    captureOn: 'Режим съёмки включён · C — выйти', captureOff: 'Режим съёмки выключен',
    crashed: 'Разбился', crashedIn: 'Крушение: {zone} · {time}', newBest: 'РЕКОРД', flyAgain: 'Ещё раз',
    distance: 'метров', shards: 'осколков', grazes: 'впритирку', combo: 'макс. комбо',
    saveCard: 'Сохранить', copyText: 'Текст', copied: 'Скопировано', copyFail: 'Копирование здесь заблокировано. Выделите текст и скопируйте вручную.',
    cardSaved: 'Карточка сохранена', cardHint: 'Карточка результата 1080×1350. На телефоне зажмите картинку, чтобы сохранить.',
    shareText: 'Пролетел {dist} м над Нектаром в Sunskip и набрал {score}. Сможешь больше?',
    shareDaily: 'Sunskip, заезд дня №{n}: {score} очков, {dist} м.',
    secondChance: 'Второй шанс?', reviveFor: 'Продолжить за {n}', skip: 'Нет, закончить',
    reviveNote: 'Луна расчистит дорогу впереди.',
    zoneDawn: 'Рассвет', zoneNoon: 'Полдень', zoneDusk: 'Закат', zoneNight: 'Лунная ночь', localTime: 'местное время',
    meteor: 'Метеоритный дождь', meteorSub: 'следи за метками на земле',
    graze: 'ВПРИТИРКУ', perfect: 'ИДЕАЛЬНО', skim: 'НА ВОЛОСОК', ring: 'КОЛЬЦО', smash: 'ВДРЕБЕЗГИ', saved: 'СПАСЁН',
    pwMagnet: 'Магнит', pwShield: 'Щит', pwComet: 'Комета',
    hintSteer: 'Веди пальцем, чтобы рулить', hintSteerKeys: '← → или A D — руль',
    hintHop: 'Тапни, чтобы перепрыгнуть гряду', hintHopKeys: 'Пробел — прыжок через гряду',
    hintRoll: 'Свайп вниз — бочка сквозь препятствия', hintRollKeys: 'Shift — бочка сквозь препятствия',
    hintGo: 'Пролетай впритирку ради комбо. Удачи, курьер.',
    today: 'Сегодня', allTime: 'За всё время', yourDevice: 'Это устройство',
    boardLocal: 'Общий рейтинг работает на опубликованной странице. Здесь лучшие забеги с этого устройства.',
    boardEmpty: 'Сегодня ещё никто не летал. Займи первое место.',
    boardLoading: 'Загружаю рейтинг…', boardErr: 'Рейтинг не загрузился. Попробуйте чуть позже.',
    pilotName: 'Имя пилота', saveName: 'OK', nameSaved: 'Имя сохранено',
    posted: 'Результат в рейтинге', postedRank: 'В рейтинге · №{n} сегодня', postFail: 'Не удалось отправить результат.', viewOnly: 'Рейтинг можно смотреть, но не отправлять в него.',
    dailyMissions: 'Задания на сегодня', missionsNote: 'Новые задания каждый день в 03:00 по Москве. Награда приходит в кошелёк сама.',
    done: 'Готово', reward: 'Награда',
    select: 'Выбрать', selected: 'В полёте', unlock: 'Открыть', needMore: 'Ещё {n}',
    unlocked: 'Открыто', skinsNote: 'Осколки покупают корабли. Летают все одинаково, просто красивее.',
    pilotLog: 'Журнал пилота', achievements: 'Значки',
    stRuns: 'полётов', stDist: 'метров всего', stBest: 'лучший счёт', stBestDist: 'дальний полёт', stShards: 'осколков собрано', stGrazes: 'впритирку', stPerfect: 'идеальных колец', stTime: 'минут в воздухе',
    language: 'Язык', music: 'Музыка', sfx: 'Эффекты', haptics: 'Вибрация', hapticsSub: 'Только Android',
    quality: 'Графика', qAuto: 'Авто', qLow: 'Низко', qHigh: 'Высоко',
    reduced: 'Меньше движения', reducedSub: 'Без замедлений, тряски и линий скорости',
    contrast: 'Контрастные препятствия', contrastSub: 'Препятствия становятся тёмными',
    sens: 'Чувствительность руля', tutorial: 'Пройти обучение снова', tutorialQueued: 'Обучение начнётся в следующем полёте',
    resetData: 'Сбросить прогресс', resetConfirm: 'Нажмите ещё раз, чтобы стереть всё', resetDone: 'Прогресс стёрт',
    photoHint: 'Тяни, чтобы вращать · колесо или щипок — зум', photoSaved: 'Фото сохранено',
    fNatural: 'Как есть', fFilm: 'Плёнка', fDream: 'Мечта', fMono: 'Чернила',
    loading: 'Разогреваем луну', noGL: 'Браузер не запустил WebGL, поэтому луна не видна. Попробуйте свежий Chrome, Safari или Firefox.',
    achUnlocked: 'Новый значок', missionDone: 'Задание выполнено', dailyRunLabel: 'Заезд дня №{n} · {date}',
    free: 'Свободный полёт', wallet: 'Кошелёк', ghostBest: 'твой рекорд',
    saveFail: 'Сохранение здесь заблокировано. Зажмите картинку, чтобы оставить её.',
  },
};
function t(key, vars) {
  let s = (I18N[LANG] && I18N[LANG][key]) || I18N.en[key] || key;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}
function applyI18n() {
  document.documentElement.lang = LANG;
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  $$('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); el.title = t(el.dataset.i18nAria); });
}
