// Games hub: menu, games with bots (in the page) and online rooms (Cloudflare server).
import { $, tg, inTelegram, haptic, toast, showPanel, hidePanel, panelKind } from './common.js';
import * as durakE from './durak-engine.js';
import * as battleE from './battle-engine.js';
import * as durakUI from './durak-ui.js';
import * as battleUI from './battle-ui.js';
import { Host } from './host.js';

const SERVER = 'wss://durak.durak-server.workers.dev';
const APP_LINK = 'https://t.me/DurenUA_bot';   // bot's main Mini App: ?startapp=CODE
const PAGE_URL = 'https://vitaliypashkovskyi-ai.github.io/durak/';
const BOT_NAMES = ['Тарас', 'Оксана', 'Марко', 'Соломія', 'Богдан'];

const GAMES = {
  durak: { title: 'Дурень', icon: '🃏', sub: '2–6 гравців', E: durakE, UI: durakUI, minP: 2, maxP: 6, variants: true },
  battle: { title: 'Морський бій', icon: '🚢', sub: '2–4 гравці', E: battleE, UI: battleUI, minP: 2, maxP: 4 },
};
const SOON = [['🎭', 'Мафія'], ['🂡', 'Тисяча'], ['🐐', 'Козел'], ['🎴', 'Свара']];

if (tg) { try { tg.ready(); tg.expand(); tg.setHeaderColor('#143a27'); tg.setBackgroundColor('#143a27'); } catch (e) {} }

// ---------- storage ----------
function pref(k, d) { try { const v = localStorage.getItem('games.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function setPref(k, v) { try { localStorage.setItem('games.' + k, JSON.stringify(v)); } catch (e) {} }
function stat(game) {
  let s = pref('stats.' + game, null);
  if (!s && game === 'durak') { try { s = JSON.parse(localStorage.getItem('durak.stats')); } catch (e) {} }
  return s && typeof s.win === 'number' ? s : { win: 0, lose: 0, draw: 0 };
}
function addStat(game, res) { const s = stat(game); s[res] = (s[res] || 0) + 1; setPref('stats.' + game, s); }
function updStats(game) { const s = stat(game); $('stats').textContent = `🏆 ${s.win} · ${game === 'durak' ? '🙃' : '⚓'} ${s.lose}`; }

// ---------- session ----------
let S = null;           // {kind:'local'|'online'|'match', game, act(m)}
let overShown = null;
let NETGEN = 0, waitTimer = null, localNum = 0, lastView = null;
const api = { act: m => (S && S.act ? S.act(m) : false), online: null };

function leave() {
  clearInterval(waitTimer);
  if (!S) return;
  const s = S; S = null; overShown = null; NETGEN++;
  if (s.host) s.host.stop();
  if (s.ws) {
    try { if (s.ws.readyState === 1 && s.kind === 'online') s.ws.send(JSON.stringify({ t: 'leave' })); s.ws.close(1000); } catch (e) {}
  }
}

function showHub() {
  leave(); hidePanel();
  $('game').hidden = true; $('game').innerHTML = '';
  $('hub').hidden = false;
  $('backBtn').hidden = true; $('rulesBtn').hidden = true;
  $('title').innerHTML = 'Ігри <span>♦</span>';
  $('stats').textContent = '';
  if (tg && tg.BackButton) tg.BackButton.hide();
  const h = $('hub');
  h.innerHTML = '<div class="hubhead">Оберіть гру</div><div class="hubgrid"></div>';
  const grid = h.querySelector('.hubgrid');
  for (const [id, g] of Object.entries(GAMES)) {
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

function openGame(game) {
  const g = GAMES[game];
  $('hub').hidden = true; $('game').hidden = false;
  $('backBtn').hidden = false; $('rulesBtn').hidden = false;
  $('title').textContent = `${g.icon} ${g.title}`;
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
  const cfg = Object.assign({ variant: 'podkidnoy', n: 2 }, pref('cfg.' + game, {}));
  cfg.n = Math.min(Math.max(cfg.n, g.minP), g.maxP);
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
  if (g.variants) chips('Варіант', [['podkidnoy', 'Підкидний'], ['perevod', 'Переводний']], cfg.variant, v => { cfg.variant = v; });
  const ns = [];
  for (let k = g.minP; k <= g.maxP; k++) ns.push([k, String(k)]);
  chips('Гравців у грі з ботами', ns, cfg.n, v => { cfg.n = v; });
  const s = stat(game);
  const c = () => (g.variants ? { variant: cfg.variant } : {});
  showPanel({
    kind: 'setup', icon: g.icon, title: g.title, text: `Перемог: ${s.win} · Поразок: ${s.lose}`, body,
    buttons: [
      { text: '🤖 Грати з ботами', fn: () => startLocal(game, c(), cfg.n) },
      { text: '👥 Кімната для друзів', fn: () => joinRoom(genCode(), Object.assign({ game }, c())) },
      { text: '🎲 Випадковий суперник', fn: () => findMatch(game, c()) },
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
function startLocal(game, cfg, n) {
  leave(); hidePanel();
  const g = GAMES[game];
  const players = [{ name: myName() }];
  for (let i = 1; i < n; i++) players.push({ name: BOT_NAMES[i - 1], bot: true });
  const G = g.E.create(cfg, players);
  G.num = ++localNum;
  const host = new Host(g.E, G, { onChange: () => onView(g.E.view(G, 0)) });
  S = { kind: 'local', game, cfg, n, host, act: m => host.act(0, m) };
  api.online = null;
  openGame(game);
  host.changed();
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
  if (m.type === 'error') {
    return showPanel({ kind: 'error', icon: '😕', title: 'Не вийшло', text: m.text, buttons: [{ text: 'Меню ігор', fn: showHub }] });
  }
  if (m.type === 'lobby') { S.game = m.game; return showLobby(m); }
  if (m.type !== 'state') return;
  if (!S.mounted || S.game !== m.game) { S.game = m.game; S.mounted = true; openGame(m.game); }
  if (['lobby', 'connect'].includes(panelKind())) hidePanel();
  api.online = m.online;
  onView(m);
}

function showLobby(m) {
  const g = GAMES[m.game], me = m.you, isHost = m.host === me;
  const body = document.createElement('div');
  if (m.cfg.variant) { const l = document.createElement('div'); l.className = 'lbl'; l.textContent = m.cfg.variant === 'perevod' ? 'Переводний' : 'Підкидний'; body.appendChild(l); }
  const ul = document.createElement('ul'); ul.className = 'plist';
  m.seats.forEach((s, i) => {
    const li = document.createElement('li');
    li.textContent = `${s.bot ? '🤖 ' : '👤 '}${s.name}${i === me ? ' (ви)' : ''}${i === m.host ? ' 👑' : ''}`;
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
    const bots = m.seats.filter(s => s.bot).length;
    buttons.push({ text: '➕ Додати бота', sec: true, disabled: m.seats.length >= m.cfg.max, fn: () => netSend({ t: 'addBot' }) });
    if (bots) buttons.push({ text: '➖ Прибрати бота', sec: true, fn: () => netSend({ t: 'removeBot' }) });
    buttons.push({ text: m.seats.length < 2 ? '▶ Почати (потрібно 2+)' : `▶ Почати гру (${m.seats.length})`, disabled: m.seats.length < 2, fn: () => netSend({ t: 'start' }) });
  }
  buttons.push({ text: 'Вийти', sec: true, fn: showHub });
  const hostName = m.seats[m.host] ? m.seats[m.host].name : '';
  showPanel({
    kind: 'lobby', icon: g.icon, title: `${g.title}: кімната`, code: S.code, body, buttons,
    text: isHost ? 'Запросіть друзів або додайте ботів, потім почніть гру.' : `Чекаємо, поки ${hostName} почне гру.`,
  });
}

function inviteLink() { return inTelegram || !location.search.includes('server=') ? `${APP_LINK}?startapp=${S.code}` : `${location.origin}${location.pathname}?room=${S.code}&server=${encodeURIComponent(serverBase())}`; }
function shareInvite() {
  if (!S || !S.code) return;
  const g = GAMES[S.game] || GAMES.durak;
  const url = 'https://t.me/share/url?url=' + encodeURIComponent(inviteLink()) + '&text=' + encodeURIComponent(`Зіграймо: ${g.icon} ${g.title}!`);
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
  sess.ws = openSocket(`/ws/match?game=${game}&variant=${cfg.variant || ''}`, {}, m => {
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

const startCode = ((tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || new URLSearchParams(location.search).get('room') || '').toUpperCase();
showHub();
if (/^[A-Z0-9]{4,8}$/.test(startCode)) joinRoom(startCode, null);

// test hook: window.games.start('durak', {variant:'perevod'}, 4)
window.games = { start: startLocal, showHub, act: m => api.act(m), get session() { return S; }, get view() { return lastView; } };
