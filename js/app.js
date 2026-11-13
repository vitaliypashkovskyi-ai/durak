// Games hub: menu, games with bots (in the page) and online rooms (Cloudflare server).
import { $, tg, inTelegram, haptic, toast, showPanel, hidePanel, panelKind, sfx, sound, setSound, levels, LVL_MARK } from './common.js';
import * as durakE from './durak-engine.js';
import * as battleE from './battle-engine.js';
import * as durakUI from './durak-ui.js';
import * as battleUI from './battle-ui.js';
import * as mafiaE from './mafia-engine.js';
import * as mafiaUI from './mafia-ui.js';
import * as thousandE from './thousand-engine.js';
import * as thousandUI from './thousand-ui.js';
import * as spyE from './spy-engine.js';
import * as spyUI from './spy-ui.js';
import * as goatE from './goat-engine.js';
import * as goatUI from './goat-ui.js';
import * as rpokerE from './rpoker-engine.js';
import * as rpokerUI from './rpoker-ui.js';
import { Host } from './host.js';

const SERVER = 'wss://durak.durak-server.workers.dev';
const APP_LINK = 'https://t.me/IgryUA_bot';    // bot's main Mini App: ?startapp=CODE
const PAGE_URL = 'https://vitaliypashkovskyi-ai.github.io/durak/';
const COMMUNITY = 'https://t.me/UAIgry';                 // news channel
const CHAT = 'https://t.me/ua_Igry';                     // players' chat (public group linked to the channel)
const BOT_NAMES = ['Тарас', 'Оксана', 'Марко', 'Соломія', 'Богдан', 'Ірина', 'Остап', 'Дарина', 'Назар', 'Леся', 'Петро'];

const GAMES = {
  durak: { title: 'Дурень', icon: '🃏', sub: '2–12 гравців', E: durakE, UI: durakUI, minP: 2, maxP: 12, variants: true },
  battle: { title: 'Морський бій', icon: '🚢', sub: '2–4 гравці', E: battleE, UI: battleUI, minP: 2, maxP: 4 },
  mafia: { title: 'Мафія', icon: '🎭', sub: '5–12 гравців', E: mafiaE, UI: mafiaUI, minP: 5, maxP: 12, defP: 7, noRandom: true },
};
GAMES.thousand = { title: 'Тисяча', icon: '🂡', sub: '3 гравці', E: thousandE, UI: thousandUI, minP: 3, maxP: 3, noRandom: true };
GAMES.spy = { title: 'Шпигун', icon: '🕵️', sub: '3–10 гравців', E: spyE, UI: spyUI, minP: 3, maxP: 10, defP: 5, noRandom: true };
GAMES.goat = { title: 'Козел', icon: '🐐', sub: '4 гравці, 2 на 2', E: goatE, UI: goatUI, minP: 4, maxP: 4, noRandom: true };
GAMES.rpoker = { title: 'Розписний покер', icon: '🎯', sub: '2–8 гравців', E: rpokerE, UI: rpokerUI, minP: 2, maxP: 8, defP: 4, noRandom: true };
const SOON = [['🎴', 'Свара'], ['⚪', 'Шашки'], ['🎲', 'Нарди'], ['⚀', 'Кості']];

if (tg) { try { tg.ready(); tg.expand(); } catch (e) {} }

// ---------- looks unlocked by level: card backs and tables ----------
const LEVEL_NAMES = ['Новачок 🌱', 'Аматор 🙂', 'Гравець 🎯', 'Досвідчений 💪', 'Майстер 🏅', 'Легенда 👑'];
const LEVEL_AT = [0, 15, 40, 90, 180, 350];
const LOOKS = {
  back: [
    ['vysh', 'Вишиванка', 0, 'repeating-linear-gradient(45deg,#fffdf7 0 4px,#b3201f 4px 6px)'],
    ['petr', 'Петриківка', 1, 'radial-gradient(circle,#e8541e 0 30%,transparent 32%) 0 0/12px 12px,#fff6e0'],
    ['gold', 'Золота', 4, 'repeating-linear-gradient(45deg,#b8860b 0 3px,#f5d76e 3px 7px)'],
  ],
  table: [
    ['green', 'Зелений', 0, 'radial-gradient(#21603e,#143a27)', '#143a27'],
    ['blue', 'Синій', 2, 'radial-gradient(#1f4f8a,#11294a)', '#11294a'],
    ['wine', 'Бордовий', 3, 'radial-gradient(#7a2232,#3a0e17)', '#3a0e17'],
    ['night', 'Нічний', 5, 'radial-gradient(#2f2c22,#0c0c0f)', '#0c0c0f'],
  ],
};
function applyLook() {
  const l = pref('look', {});
  const back = LOOKS.back.find(x => x[0] === l.back) || LOOKS.back[0];
  const table = LOOKS.table.find(x => x[0] === l.table) || LOOKS.table[0];
  document.body.dataset.back = back[0];
  document.body.dataset.table = table[0];
  if (tg) { try { tg.setHeaderColor(table[4]); tg.setBackgroundColor(table[4]); } catch (e) {} }
}
applyLook();

async function showLooks() {
  showPanel({ kind: 'looks', icon: '🎨', title: 'Оформлення', text: 'Завантаження…', buttons: [{ text: 'Закрити', sec: true, fn: hidePanel }] });
  let lvl = 0, points = 0;
  if (inTelegram) {
    try {
      const r = await fetch(`${httpBase()}/api/profile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ init: tg.initData }) });
      if (r.ok) { const me = await r.json(); lvl = me.level.idx || 0; points = me.points || 0; }
    } catch (e) {}
  }
  if (panelKind() !== 'looks') return;
  drawLooks(lvl, points);
}
function drawLooks(lvl, points) {
  const cur = pref('look', {});
  const body = document.createElement('div');
  const section = (title, key) => {
    const l = document.createElement('div'); l.className = 'lbl'; l.textContent = title;
    const grid = document.createElement('div'); grid.className = 'looks';
    LOOKS[key].forEach(([id, name, need, swatch]) => {
      const open = lvl >= need, on = (cur[key] || LOOKS[key][0][0]) === id;
      const b = document.createElement('button');
      b.className = 'look' + (on ? ' on' : '') + (open ? '' : ' locked');
      const sw = document.createElement('span'); sw.className = 'sw' + (key === 'back' ? ' card' : ''); sw.style.background = swatch;
      const n = document.createElement('b'); n.textContent = name;
      const s = document.createElement('small');
      s.textContent = !open ? `🔒 ${LEVEL_NAMES[need]} · ${LEVEL_AT[need]} оч.` : on ? '✓ обрано' : 'обрати';
      b.append(sw, n, s);
      b.onclick = () => {
        if (!open) return toast(`Відкриється на рівні «${LEVEL_NAMES[need]}»`);
        setPref('look', Object.assign({}, pref('look', {}), { [key]: id }));
        applyLook(); sfx('pop'); drawLooks(lvl, points);
      };
      grid.appendChild(b);
    });
    body.append(l, grid);
  };
  section('Сорочка карт', 'back');
  section('Стіл', 'table');
  const m = document.createElement('p'); m.className = 'muted';
  m.textContent = 'Позначка біля імені, яку бачать суперники: ⭐ з рівня «Досвідчений», 🏅 «Майстер», 👑 «Легенда».';
  body.appendChild(m);
  const next = LEVEL_AT[lvl + 1];
  showPanel({
    kind: 'looks', icon: '🎨', title: 'Оформлення', body,
    text: inTelegram ? `Ваш рівень: ${LEVEL_NAMES[lvl]} · ${points} оч.` + (next ? `\nДо наступного: ${next - points} оч. — грайте онлайн і забирайте 🎁 бонус дня` : '')
      : 'Нові сорочки й столи відкриваються з рівнем — грайте в Telegram (@IgryUA_bot).',
    buttons: [{ text: 'Готово', fn: hidePanel }],
  });
}

// ---------- storage ----------
function pref(k, d) { try { const v = localStorage.getItem('games.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function setPref(k, v) { try { localStorage.setItem('games.' + k, JSON.stringify(v)); } catch (e) {} }
function stat(game) {
  let s = pref('stats.' + game, null);
  if (!s && game === 'durak') { try { s = JSON.parse(localStorage.getItem('durak.stats')); } catch (e) {} }
  return s && typeof s.win === 'number' ? s : { win: 0, lose: 0, draw: 0 };
}
function addStat(game, res) { const s = stat(game); s[res] = (s[res] || 0) + 1; setPref('stats.' + game, s); }
const LOSE_ICON = { durak: '🙃', battle: '⚓', mafia: '💀', thousand: '📉', spy: '🔍', goat: '🐐', rpoker: '💸' };
function updStats(game) { const s = stat(game); $('stats').textContent = `🏆 ${s.win} · ${LOSE_ICON[game] || '✖'} ${s.lose}`; }

// ---------- session ----------
let S = null;           // {kind:'local'|'online'|'match', game, act(m)}
let overShown = null;
let NETGEN = 0, waitTimer = null, localNum = 0, lastView = null;
const api = { act: m => (S && S.act ? S.act(m) : false), online: null };

function leave() {
  clearInterval(waitTimer);
  if (!S) return;
  const s = S; S = null; overShown = null; NETGEN++;
  if (s.kind === 'online') setPref('lastRoom', null);   // left on purpose: nothing to come back to
  if (s.host) s.host.stop();
  if (s.ws) {
    try { if (s.ws.readyState === 1 && s.kind === 'online') s.ws.send(JSON.stringify({ t: 'leave' })); s.ws.close(1000); } catch (e) {}
  }
}

function showHub() {
  const wasLocal = S && S.kind === 'local' && S.host && !S.host.G.over;
  leave(); hidePanel();
  if (wasLocal) toast('Партію збережено — її можна продовжити');
  $('game').hidden = true; $('game').innerHTML = '';
  $('hub').hidden = false;
  $('backBtn').hidden = true; $('rulesBtn').hidden = true;
  $('soundBtn').hidden = true; $('reactBtn').hidden = true; $('reactBar').hidden = true;
  $('title').innerHTML = 'Ігри <span>♦</span>';
  $('stats').textContent = '';
  if (tg && tg.BackButton) tg.BackButton.hide();
  const h = $('hub');
  h.innerHTML = '<div class="hubtop"></div><div class="hubhead">Оберіть гру</div><div class="hubgrid"></div>';
  const top = h.querySelector('.hubtop');
  const last = pref('lastRoom', null);
  if (last && Date.now() - last.t < 6 * 3600 * 1000) {
    const b = document.createElement('button');
    b.className = 'hubact main';
    b.textContent = `↩ Повернутися до кімнати ${last.code}`;
    b.onclick = () => joinRoom(last.code, null);
    top.appendChild(b);
  }
  const saved = savedGame();
  if (saved) {
    const g = GAMES[saved.game], detail = savedDetail(saved);
    const b = document.createElement('button');
    b.className = 'hubact main';
    b.textContent = `▶ Продовжити: ${g.icon} ${g.title}${detail ? ' · ' + detail : ''}`;
    b.onclick = resumeLocal;
    top.appendChild(b);
  }
  const row0 = document.createElement('div');
  row0.className = 'hubrow';
  const codeBtn = document.createElement('button');
  codeBtn.className = 'hubact';
  codeBtn.textContent = '🔑 Код кімнати';
  codeBtn.onclick = askCode;
  const lookBtn = document.createElement('button');
  lookBtn.className = 'hubact';
  lookBtn.textContent = '🎨 Оформлення';
  lookBtn.onclick = showLooks;
  row0.append(codeBtn, lookBtn);
  top.appendChild(row0);
  const open = url => { if (inTelegram && tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, '_blank'); };
  const row = document.createElement('div');
  row.className = 'hubrow';
  for (const [text, url] of [['💬 Чат гравців', CHAT], ['📢 Новини', COMMUNITY]]) {
    const b = document.createElement('button');
    b.className = 'hubact';
    b.textContent = text;
    b.onclick = () => open(url);
    row.appendChild(b);
  }
  top.appendChild(row);
  const row2 = document.createElement('div');
  row2.className = 'hubrow';
  const rateBtn = document.createElement('button');
  rateBtn.className = 'hubact';
  rateBtn.textContent = '🏆 Рейтинг';
  rateBtn.onclick = () => showRating('week');
  const giftBtn = document.createElement('button');
  const claimedToday = pref('dailyDay', '') === new Date().toLocaleDateString('en-CA');
  giftBtn.className = 'hubact' + (inTelegram && !claimedToday ? ' gift' : '');
  giftBtn.textContent = '🎁 Бонус дня';
  giftBtn.onclick = claimDaily;
  row2.append(rateBtn, giftBtn);
  top.appendChild(row2);
  const grid = h.querySelector('.hubgrid');
  // menu order: Дурень, then Розписний покер, then the rest as they were added
  const order = ['durak', 'rpoker', ...Object.keys(GAMES).filter(k => k !== 'durak' && k !== 'rpoker')];
  for (const [id, g] of order.map(k => [k, GAMES[k]])) {
    const b = document.createElement('button');
    b.className = 'gcard';
    b.innerHTML = `<span class="ic">${g.icon}</span><b>${g.title}</b><small>${g.sub}</small>`;
    b.onclick = () => showSetup(id);
    grid.appendChild(b);
  }
  for (const [ic, t] of SOON) {
    const d = document.createElement('div');
    d.className = 'gcard soon';
    d.innerHTML = `<span class="ic">${ic}</span><b>${t}</b><small>скоро</small>`;
    grid.appendChild(d);
  }
}

function askCode() {
  const body = document.createElement('div');
  const input = document.createElement('input');
  input.className = 'codein';
  input.maxLength = 8;
  input.placeholder = 'КОД';
  input.autocapitalize = 'characters';
  input.autocomplete = 'off';
  body.appendChild(input);
  const go = () => {
    const code = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-Z0-9]{4,8}$/.test(code)) { toast('Код — це 6 літер і цифр'); input.focus(); return; }
    joinRoom(code, null);
  };
  input.onkeydown = e => { if (e.key === 'Enter') go(); };
  showPanel({ kind: 'code', icon: '🔑', title: 'Код кімнати', text: 'Введіть код, який вам надіслав друг.', body, buttons: [
    { text: 'Увійти', fn: go }, { text: 'Скасувати', sec: true, fn: hidePanel }] });
  setTimeout(() => input.focus(), 50);
}

function openGame(game) {
  const g = GAMES[game];
  $('hub').hidden = true; $('game').hidden = false;
  $('backBtn').hidden = false; $('rulesBtn').hidden = false;
  $('soundBtn').hidden = false; $('soundBtn').textContent = sound.on ? '🔊' : '🔇';
  $('reactBtn').hidden = !(S && S.kind === 'online'); $('reactBar').hidden = true;
  $('title').textContent = `${g.icon} ${g.title}`;
  $('game').className = 'g-' + game;
  updStats(game);
  g.UI.mount($('game'), api);
  if (tg && tg.BackButton) tg.BackButton.show();
}

function showRules(game, back) {
  const body = document.createElement('div');
  body.className = 'rules';
  body.innerHTML = GAMES[game].UI.rules;
  showPanel({ kind: 'rules', title: `${GAMES[game].title}: правила`, body, buttons: [{ text: 'Зрозуміло', fn: back || hidePanel }] });
}

// ---------- setup ----------
function showSetup(game) {
  const g = GAMES[game];
  const cfg = Object.assign({ variant: 'podkidnoy', deck: 36, n: g.defP || 2 }, pref('cfg.' + game, {}));
  const maxP = g.variants ? durakE.DECKS[durakE.deckOf(cfg)].max : game === 'rpoker' ? rpokerE.DECKS[rpokerE.deckOf(cfg)].max : g.maxP;
  cfg.n = Math.min(Math.max(cfg.n, g.minP), maxP);
  const body = document.createElement('div');
  const chips = (label, opts, cur, pick) => {
    const l = document.createElement('div'); l.className = 'lbl'; l.textContent = label;
    const box = document.createElement('div'); box.className = 'chips';
    opts.forEach(([v, text]) => {
      const b = document.createElement('button');
      b.className = 'chip' + (v === cur ? ' on' : '');
      b.textContent = text;
      b.onclick = () => { pick(v); [...box.children].forEach(x => x.classList.toggle('on', x === b)); setPref('cfg.' + game, cfg); };
      box.appendChild(b);
    });
    body.append(l, box);
  };
  if (g.variants) {
    chips('Варіант', Object.entries(durakE.VARIANTS).map(([k, x]) => [k, x.label]), durakE.variantOf(cfg), v => { cfg.variant = v; });
    const decks = Object.entries(durakE.DECKS).map(([size, d]) => [Number(size), `${d.label} · до ${d.max}`]);
    // the player count depends on the deck, so redraw the panel
    chips('Колода', decks, durakE.deckOf(cfg), v => { cfg.deck = v; setPref('cfg.' + game, cfg); showSetup(game); });
  }
  if (game === 'rpoker') {
    const decks = Object.entries(rpokerE.DECKS).map(([size, d]) => [Number(size), `${d.label} · до ${d.max}`]);
    chips('Колода', decks, rpokerE.deckOf(cfg), v => { cfg.deck = v; setPref('cfg.' + game, cfg); showSetup(game); });
    chips('Тривалість', [['full', 'Повна (з особливими раундами)'], ['short', 'Коротка']], cfg.length === 'short' ? 'short' : 'full', v => { cfg.length = v; });
  }
  const ns = [];
  for (let k = g.minP; k <= maxP; k++) ns.push([k, String(k)]);
  if (ns.length > 1 && !g.noBots) chips('Гравців у грі з ботами', ns, cfg.n, v => { cfg.n = v; });
  if (g.noBots) { const l = document.createElement('div'); l.className = 'lbl'; l.textContent = `Гра для живих людей: ${g.minP}–${g.maxP} гравців. Створіть кімнату й запросіть друзів.`; body.appendChild(l); }
  const s = stat(game);
  const c = () => (g.variants ? { variant: durakE.variantOf(cfg), deck: durakE.deckOf(cfg) }
    : game === 'rpoker' ? { deck: rpokerE.deckOf(cfg), length: cfg.length === 'short' ? 'short' : 'full' } : {});
  showPanel({
    kind: 'setup', icon: g.icon, title: g.title, text: `Перемог: ${s.win} · Поразок: ${s.lose}`, body,
    buttons: [
      ...(g.noBots ? [] : [{ text: '🤖 Грати з ботами', fn: () => startLocal(game, c(), cfg.n) }]),
      { text: '👥 Кімната для друзів', fn: () => joinRoom(genCode(), Object.assign({ game }, c())) },
      ...(g.noRandom ? [] : [{ text: '🎲 Випадковий суперник', fn: () => findMatch(game, c()) }]),
      { text: '📖 Правила', sec: true, fn: () => showRules(game, () => showSetup(game)) },
      { text: 'Назад', sec: true, fn: hidePanel },
    ],
  });
}

// ---------- games with bots ----------
function myName() {
  const u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
  return (u && u.first_name) || 'Ви';
}
function startLocal(game, cfg, n, force) {
  const s = savedGame();
  if (s && !force) {
    const old = GAMES[s.game];
    return showPanel({
      kind: 'choice', icon: '💾', title: 'Є незакінчена партія',
      text: `${old.icon} ${old.title}${savedDetail(s) ? ' · ' + savedDetail(s) : ''}\nЯкщо почати нову, вона пропаде.`,
      buttons: [
        { text: `▶ Продовжити ${old.title}`, fn: resumeLocal },
        { text: 'Почати нову гру', sec: true, fn: () => startLocal(game, cfg, n, true) },
        { text: 'Скасувати', sec: true, fn: hidePanel },
      ],
    });
  }
  const g = GAMES[game];
  const players = [{ name: myName() }];
  for (let i = 1; i < n; i++) players.push({ name: BOT_NAMES[i - 1], bot: true });
  const G = g.E.create(cfg, players);
  G.num = ++localNum;
  runLocal(game, cfg, n, G);
}

// A game with bots, new or restored. It is saved on this device after every move.
function runLocal(game, cfg, n, G) {
  leave(); hidePanel();
  const g = GAMES[game];
  const host = new Host(g.E, G, {
    onChange: () => {
      onView(g.E.view(G, 0));
      saveLocal(game, cfg, n, G);
    },
  });
  S = { kind: 'local', game, cfg, n, host, act: m => host.act(0, m) };
  levels.list = null;
  api.online = null;
  openGame(game);
  host.changed();
}

// ---------- saved game with bots ----------
function saveLocal(game, cfg, n, G) {
  if (G.over) return setPref('saved', null);
  try { localStorage.setItem('games.saved', JSON.stringify({ game, cfg, n, G, at: Date.now() })); } catch (e) {}
}
// timers inside the game (phase deadlines, pauses between tricks) continue from where they stopped
function shiftTimes(G, dt) {
  for (const k of ['deadline', 'waitUntil', 'talkStart']) if (typeof G[k] === 'number' && G[k] > 1e12) G[k] += dt;
  if (G.botNext) for (const k in G.botNext) G.botNext[k] += dt;
  if (G.ask) for (const k in G.ask) if (G.ask[k]) G.ask[k].at += dt;
  if (G.lastSay) for (const k in G.lastSay) G.lastSay[k] += dt;
}
function savedGame() {
  const s = pref('saved', null);
  return s && s.G && GAMES[s.game] && !s.G.over ? s : null;
}
function savedDetail(s) {
  const G = s.G;
  if (Array.isArray(G.rounds)) return `роздача ${G.round + 1}/${G.rounds.length}`;
  if (G.deal) return `роздача ${G.deal}`;
  if (G.game === 'durak') return `у колоді ${G.deck.length}`;
  if (G.day) return `${G.phase === 'night' ? 'ніч' : 'день'} ${G.day}`;
  return '';
}
function resumeLocal() {
  const s = savedGame();
  if (!s) return showHub();
  const G = s.G;
  shiftTimes(G, Date.now() - s.at);
  G.ev = null;
  localNum = Math.max(localNum, G.num || 0);
  runLocal(s.game, s.cfg, s.n, G);
  toast('Продовжуємо з того самого місця');
}

function onView(v) {
  lastView = v;
  const g = GAMES[v.game];
  g.UI.render(v);
  if (!v.over) { if (panelKind() === 'result') hidePanel(); return; }
  const key = S.kind + ':' + v.num;
  if (overShown !== key) {
    overShown = key;
    const r = g.UI.result(v);
    addStat(v.game, r.res); updStats(v.game);
    haptic(r.res === 'lose' ? 'error' : 'success');
    sfx(r.res === 'lose' ? 'lose' : 'win');
    setTimeout(() => { if (S && overShown === key) showResult(v); }, 700);
  } else if (panelKind() === 'result') showResult(v);
}

function showResult(v) {
  const r = GAMES[v.game].UI.result(v);
  let text = r.text || '';
  const buttons = [];
  if (S.kind === 'local') {
    const { game, cfg, n } = S;
    buttons.push({ text: 'Ще раз', fn: () => startLocal(game, cfg, n) });
  } else {
    const me = v.seat, mine = v.again && v.again[me];
    const others = (v.again || []).filter((a, i) => a && i !== me).length;
    if (others) text += (text ? '\n' : '') + `Ще раз хочуть: ${others}`;
    buttons.push({ text: mine ? 'Чекаємо інших…' : 'Ще раз', disabled: mine, fn: () => netSend({ t: 'again' }) });
  }
  buttons.push({ text: 'Меню ігор', sec: true, fn: showHub });
  showPanel({ kind: 'result', icon: r.icon, title: r.title, text, buttons });
}

// ---------- online ----------
let GID = null;
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => ALPH[b % ALPH.length]).join('');
const serverBase = () => new URLSearchParams(location.search).get('server') || SERVER;
const httpBase = () => serverBase().replace(/^ws/, 'http');

// ---------- daily bonus ----------
async function claimDaily() {
  if (!inTelegram) {
    return showPanel({ kind: 'daily', icon: '🎁', title: 'Бонус дня', text: 'Щоденний бонус — для гравців у Telegram. Відкрийте гру в @IgryUA_bot.', buttons: [{ text: 'Зрозуміло', sec: true, fn: hidePanel }] });
  }
  showPanel({ kind: 'daily', icon: '🎁', title: 'Бонус дня', text: 'Відкриваємо…', buttons: [{ text: 'Закрити', sec: true, fn: hidePanel }] });
  let r;
  try {
    r = await (await fetch(`${httpBase()}/api/daily`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ init: tg.initData }) })).json();
  } catch (e) { r = null; }
  if (!r || !r.ok) return showPanel({ kind: 'daily', icon: '🎁', title: 'Бонус дня', text: 'Не вдалося. Спробуйте пізніше.', buttons: [{ text: 'Закрити', sec: true, fn: hidePanel }] });
  setPref('dailyDay', new Date().toLocaleDateString('en-CA'));
  document.querySelectorAll('.hubact.gift').forEach(b => b.classList.remove('gift'));
  const fire = '🔥'.repeat(Math.min(r.streak, 7));
  if (r.claimed) { sfx('win'); haptic('success'); }
  showPanel({
    kind: 'daily', icon: r.claimed ? '🎁' : '⏳', title: r.claimed ? `+${r.bonus} очок!` : 'Сьогодні вже отримано',
    text: `Серія: ${r.streak} ${r.streak === 1 ? 'день' : r.streak < 5 ? 'дні' : 'днів'} ${fire}\n` +
      `Завтра: +${r.next}${r.next < 7 ? ' (до +7 за тиждень поспіль)' : ''}\nУсього очок: ${r.points}`,
    buttons: [{ text: '🏆 Рейтинг', fn: () => showRating('week') }, { text: 'Закрити', sec: true, fn: hidePanel }],
  });
}

// ---------- rating ----------
async function showRating(period) {
  showPanel({ kind: 'rating', icon: '🏆', title: 'Рейтинг', text: 'Завантаження…', buttons: [{ text: 'Закрити', sec: true, fn: hidePanel }] });
  let top = [], me = null;
  try {
    top = await (await fetch(`${httpBase()}/api/top?period=${period}`)).json();
    if (inTelegram) {
      const r = await fetch(`${httpBase()}/api/profile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ init: tg.initData }) });
      if (r.ok) me = await r.json();
    }
  } catch (e) {
    return showPanel({ kind: 'rating', icon: '🏆', title: 'Рейтинг', text: 'Не вдалося завантажити. Перевірте інтернет.', buttons: [{ text: 'Закрити', sec: true, fn: hidePanel }] });
  }
  if (panelKind() !== 'rating') return;
  const body = document.createElement('div');
  const add = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = text; body.appendChild(e); return e; };
  if (me) {
    const box = document.createElement('div'); box.className = 'mecard';
    const line = (t, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; d.textContent = t; box.appendChild(d); };
    line(me.level.name, 'lvl');
    line(`${me.points} очок · ${me.wins} перемог з ${me.games}` + (me.rank ? ` · місце ${me.rank}` : ''));
    line(`Цього тижня: ${me.week} очок`);
    if (me.level.next) line(`До «${me.level.next.name}»: ще ${me.level.next.at - me.points} очок`, 'sub');
    if (me.daily) line(`🔥 Серія бонусів: ${me.daily.streak} дн.` + (me.daily.available ? ` · сьогодні чекає +${me.daily.next}` : ''), 'sub');
    body.appendChild(box);
    if (me.achievements) {
      const done = me.achievements.filter(a => a.done).length;
      const l = document.createElement('div'); l.className = 'lbl'; l.textContent = `Досягнення: ${done} з ${me.achievements.length}`;
      const grid = document.createElement('div'); grid.className = 'ach';
      me.achievements.forEach(a => {
        const d = document.createElement('div');
        d.className = 'achi' + (a.done ? ' done' : '');
        const ic = document.createElement('span'); ic.className = 'ai'; ic.textContent = a.icon;
        const nmEl = document.createElement('b'); nmEl.textContent = a.name;
        const how = document.createElement('small'); how.textContent = a.done ? a.how : `${a.how} (${a.have}/${a.goal})`;
        d.append(ic, nmEl, how);
        grid.appendChild(d);
      });
      body.append(l, grid);
    }
  } else if (!inTelegram) {
    add('p', 'muted', 'Свої очки побачите, коли відкриєте гру в Telegram (@IgryUA_bot).');
  }
  const tabs = document.createElement('div'); tabs.className = 'chips';
  for (const [p, t] of [['week', 'Цього тижня'], ['all', 'За весь час']]) {
    const b = document.createElement('button'); b.className = 'chip' + (p === period ? ' on' : ''); b.textContent = t;
    b.onclick = () => showRating(p); tabs.appendChild(b);
  }
  body.appendChild(tabs);
  const ol = document.createElement('ol'); ol.className = 'plist top';
  if (!top.length) { const li = document.createElement('li'); li.className = 'free'; li.textContent = 'Поки порожньо — зіграйте онлайн з друзями!'; ol.appendChild(li); }
  top.forEach((r, i) => {
    const li = document.createElement('li');
    li.textContent = `${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} ${r.name} — ${r.points} оч.`;
    ol.appendChild(li);
  });
  body.appendChild(ol);
  add('p', 'muted', 'Очки: перемога +3, нічия +1. Рахуються онлайн-ігри, де грають щонайменше двоє людей.');
  showPanel({ kind: 'rating', icon: '🏆', title: 'Рейтинг', body, buttons: [{ text: 'Закрити', sec: true, fn: hidePanel }] });
}

function hello(extra) {
  if (inTelegram) return Object.assign({ t: 'hello', init: tg.initData }, extra);
  if (!GID) {
    try { GID = sessionStorage.getItem('games.gid'); } catch (e) {}
    if (!GID) {
      GID = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
      try { sessionStorage.setItem('games.gid', GID); } catch (e) {}
    }
  }
  return Object.assign({ t: 'hello', guest: { id: GID, name: 'Гість ' + GID.slice(0, 4).toUpperCase() } }, extra);
}
function openSocket(path, extra, onMsg, onClose) {
  const ws = new WebSocket(serverBase() + path);
  ws.onopen = () => ws.send(JSON.stringify(hello(extra)));
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } onMsg(m); };
  ws.onclose = e => onClose && onClose(e);
  return ws;
}
function netSend(o) {
  if (S && S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(o));
  else toast('Немає з’єднання');
}

function joinRoom(code, create) {
  leave();
  const sess = S = { kind: 'online', code, create, game: null, ws: null, mounted: false, act: m => { netSend(m); return null; } };
  const gen = NETGEN;
  let attempts = 0;
  showPanel({ kind: 'connect', title: 'Підключення…', buttons: [{ text: 'Скасувати', sec: true, fn: showHub }] });
  const connect = () => {
    if (gen !== NETGEN) return;
    sess.ws = openSocket('/ws/room?room=' + code, { create }, m => { attempts = 0; onRoomMsg(m); }, e => {
      if (gen !== NETGEN) return;
      if (e.code === 4003 || e.code === 4004 || e.code === 4009) return;   // the reason was already shown
      if (e.code === 4000) return showPanel({ kind: 'error', title: 'Гра відкрита в іншому вікні', buttons: [{ text: 'Меню ігор', fn: showHub }] });
      attempts++;
      if (attempts > 8) {
        return showPanel({ kind: 'error', title: 'Немає з’єднання', text: 'Не вдалося підключитися до сервера.', buttons: [
          { text: 'Спробувати ще', fn: () => joinRoom(code, create) }, { text: 'Меню ігор', sec: true, fn: showHub }] });
      }
      toast('Перепідключення…');
      setTimeout(connect, Math.min(5000, 800 * attempts));
    });
  };
  connect();
}

function onRoomMsg(m) {
  if (!S || S.kind !== 'online') return;
  if (m.type === 'toast') return toast(m.text);
  if (m.type === 'react') return showReact(m);
  if (m.type === 'error') {
    setPref('lastRoom', null);
    return showPanel({ kind: 'error', icon: '😕', title: 'Не вийшло', text: m.text, buttons: [{ text: 'Меню ігор', fn: showHub }] });
  }
  if (m.type === 'lobby' || m.type === 'state') setPref('lastRoom', { code: S.code, game: m.game, t: Date.now() });
  if (m.type === 'lobby') { S.game = m.game; S.lobby = m; return showLobby(m); }
  if (m.type !== 'state') return;
  if (!S.mounted || S.game !== m.game) { S.game = m.game; S.mounted = true; openGame(m.game); }
  if (['lobby', 'connect'].includes(panelKind())) hidePanel();
  api.online = m.online;
  levels.list = m.levels || null;
  onView(m);
}

function showLobby(m) {
  const g = GAMES[m.game], me = m.you, isHost = m.host === me;
  const body = document.createElement('div');
  if (m.cfg.variant) { const l = document.createElement('div'); l.className = 'lbl'; l.textContent = `${durakE.VARIANTS[durakE.variantOf(m.cfg)].label} · ${durakE.DECKS[durakE.deckOf(m.cfg)].label}`; body.appendChild(l); }
  if (m.game === 'rpoker') { const l = document.createElement('div'); l.className = 'lbl'; l.textContent = `${rpokerE.DECKS[rpokerE.deckOf(m.cfg)].label} · ${m.cfg.length === 'short' ? 'коротка' : 'повна'} гра`; body.appendChild(l); }
  if (m.game === 'mafia') { const l = document.createElement('div'); l.className = 'lbl'; l.textContent = `Від ${m.cfg.min} до ${m.cfg.max} гравців. Вільні місця можна заповнити ботами.`; body.appendChild(l); }
  const ul = document.createElement('ul'); ul.className = 'plist';
  m.seats.forEach((s, i) => {
    const li = document.createElement('li');
    li.textContent = `${s.bot ? '🤖 ' : '👤 '}${s.name}${LVL_MARK[s.lvl] ? ' ' + LVL_MARK[s.lvl] : ''}${i === me ? ' (ви)' : ''}${i === m.host ? ' (ведучий)' : ''}${s.online ? '' : ' 📴'}`;
    ul.appendChild(li);
  });
  for (let i = m.seats.length; i < m.cfg.max; i++) {
    const li = document.createElement('li'); li.className = 'free'; li.textContent = '— вільне місце'; ul.appendChild(li);
  }
  body.appendChild(ul);
  const buttons = [
    { text: '📨 Запросити в Telegram', fn: shareInvite },
    { text: '📋 Скопіювати посилання', sec: true, fn: copyInvite },
  ];
  if (isHost) {
    const bots = m.seats.filter(s => s.bot).length, noBots = GAMES[m.game].noBots;
    if (!noBots) buttons.push({ text: '➕ Додати бота', sec: true, disabled: m.seats.length >= m.cfg.max, fn: () => netSend({ t: 'addBot' }) });
    if (bots) buttons.push({ text: '➖ Прибрати бота', sec: true, fn: () => netSend({ t: 'removeBot' }) });
    const min = m.cfg.min || 2;
    if (!noBots && m.seats.length < min && m.seats.length < m.cfg.max) {
      buttons.push({ text: `🤖 Доповнити ботами до ${min}`, sec: true, fn: () => { for (let k = m.seats.length; k < min; k++) netSend({ t: 'addBot' }); } });
    }
    buttons.push({ text: m.seats.length < min ? `▶ Почати (потрібно ${min}+)` : `▶ Почати гру (${m.seats.length})`, disabled: m.seats.length < min, fn: () => netSend({ t: 'start' }) });
  }
  if (m.seats.length < m.cfg.max) buttons.push({ text: '📣 Шукаю гравців у чаті', sec: true, fn: () => netSend({ t: 'advertise' }) });
  buttons.push({ text: 'Вийти', sec: true, fn: showHub });
  const hostName = m.seats[m.host] ? m.seats[m.host].name : '';
  showPanel({
    kind: 'lobby', icon: g.icon, title: `${g.title}: кімната`, code: S.code, body, buttons,
    text: (isHost ? 'Запросіть друзів або додайте ботів, потім почніть гру.' : `Чекаємо, поки ${hostName} почне гру.`) +
      '\nДруг може відкрити посилання або ввести цей код: бот → «Грати» → «Увійти за кодом».',
  });
}

function inviteLink() { return inTelegram || !location.search.includes('server=') ? `${APP_LINK}?startapp=${S.code}` : `${location.origin}${location.pathname}?room=${S.code}&server=${encodeURIComponent(serverBase())}`; }
function shareInvite() {
  if (!S || !S.code) return;
  const g = GAMES[S.game] || GAMES.durak;
  const url = 'https://t.me/share/url?url=' + encodeURIComponent(inviteLink()) + '&text=' + encodeURIComponent(`Зіграймо: ${g.icon} ${g.title}! Код кімнати: ${S.code}\n(@IgryUA_bot → «Грати» → «Увійти за кодом»)`);
  if (inTelegram && tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, '_blank');
}
function copyInvite() {
  if (!S || !S.code) return;
  const t = inviteLink();
  const done = () => toast('Посилання скопійовано');
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, () => prompt('Посилання:', t));
  else prompt('Посилання:', t);
}

function findMatch(game, cfg) {
  leave();
  const sess = S = { kind: 'match', ws: null };
  const gen = NETGEN, t0 = Date.now(), g = GAMES[game];
  const p = showPanel({ kind: 'match', icon: g.icon, title: 'Пошук суперника', text: ' ', buttons: [
    { text: '🤖 Грати з ботом', sec: true, fn: () => startLocal(game, cfg, 2) },
    { text: 'Скасувати', sec: true, fn: () => { leave(); hidePanel(); } },
  ] });
  const textEl = p.querySelector('.muted');
  const upd = () => {
    const s = Math.floor((Date.now() - t0) / 1000);
    textEl.textContent = `Шукаємо суперника… ${s} с` + (s >= 20 ? '\nПоки нікого немає — можна зіграти з ботом.' : '');
  };
  upd(); waitTimer = setInterval(upd, 1000);
  sess.ws = openSocket(`/ws/match?game=${game}&variant=${cfg.variant || ''}&deck=${cfg.deck || ''}`, {}, m => {
    if (m.type === 'matched') joinRoom(m.room, Object.assign({ game, auto: 2 }, cfg));
    else if (m.type === 'error') { leave(); showPanel({ kind: 'error', title: 'Не вийшло', text: m.text, buttons: [{ text: 'Меню ігор', fn: showHub }] }); }
  }, e => {
    if (gen !== NETGEN || e.code === 1000) return;
    leave();
    showPanel({ kind: 'error', title: 'Немає з’єднання', text: 'Не вдалося підключитися до сервера.', buttons: [
      { text: 'Спробувати ще', fn: () => findMatch(game, cfg) }, { text: 'Меню ігор', sec: true, fn: showHub }] });
  });
}

// ---------- start ----------
$('backBtn').onclick = showHub;
if (tg && tg.BackButton) tg.BackButton.onClick(showHub);
$('rulesBtn').onclick = () => { if (S && S.game) showRules(S.game); };

// ---------- sound switch and quick reactions ----------
$('soundBtn').onclick = () => { setSound(!sound.on); $('soundBtn').textContent = sound.on ? '🔊' : '🔇'; if (sound.on) sfx('pop'); };
const REACTIONS = ['😂', '👏', '😮', '😡', '🤝', '🔥', '😭', '🤔'];
REACTIONS.forEach(e => {
  const b = document.createElement('button');
  b.textContent = e;
  b.onclick = () => { netSend({ t: 'react', e }); $('reactBar').hidden = true; };
  $('reactBar').appendChild(b);
});
$('reactBtn').onclick = () => { $('reactBar').hidden = !$('reactBar').hidden; };
function showReact(m) {
  const v = lastView;
  let name = 'Гравець';
  if (v && v.players && v.players[m.from]) name = m.from === v.seat ? 'Ви' : v.players[m.from].name;
  else if (S && S.lobby && S.lobby.seats[m.from]) name = S.lobby.seats[m.from].name;
  const d = document.createElement('div');
  d.className = 'rx';
  d.textContent = name;
  const b = document.createElement('b'); b.textContent = m.e; d.appendChild(b);
  $('reacts').appendChild(d);
  setTimeout(() => d.remove(), 2700);
  sfx('pop');
}

const startCode = ((tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || new URLSearchParams(location.search).get('room') || '').toUpperCase();
showHub();
if (/^[A-Z0-9]{4,8}$/.test(startCode)) joinRoom(startCode, null);

// test hook: window.games.start('durak', {variant:'perevod'}, 4)
window.games = { start: startLocal, showHub, act: m => api.act(m), get session() { return S; }, get view() { return lastView; } };
