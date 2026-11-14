// Ігри — multiplayer server (Cloudflare Worker + Durable Objects).
//   /ws/room?room=CODE              one table (Room, one object per code), 2–6 seats, bots allowed
//   /ws/match?game=durak&variant=…  random opponent queue (Lobby, one object per game/variant)
// Each socket first sends {t:"hello", init:<Telegram initData>} (or a guest when ALLOW_GUEST=1),
// plus {create:{game, variant}} when it opens a new room. Game rules live in ../../js/*-engine.js,
// shared with the page, so hidden cards never leave the server.
import * as durak from '../../js/durak-engine.js';
import * as battle from '../../js/battle-engine.js';
import * as mafia from '../../js/mafia-engine.js';
import * as thousand from '../../js/thousand-engine.js';
import * as spy from '../../js/spy-engine.js';
import * as goat from '../../js/goat-engine.js';
import * as rpoker from '../../js/rpoker-engine.js';
import * as svara from '../../js/svara-engine.js';
import { Host } from '../../js/host.js';
import { tg, handleUpdate, statsCall, joinUrl, cfgLabel, esc, GAMES } from './telegram.js';
export { Stats } from './stats.js';

const ENGINES = { durak, battle, mafia, thousand, spy, goat, rpoker, svara };
const MIN = { durak: 2, battle: 2, mafia: 5, thousand: 3, spy: 3, goat: 4, rpoker: 2, svara: 2 };
const MAX = { durak: 6, battle: 4, mafia: 12, thousand: 3, spy: 10, goat: 4, rpoker: 8, svara: 8 };   // durak, rpoker: depend on the deck
const NO_RANDOM = new Set(['mafia', 'thousand', 'spy', 'goat', 'rpoker', 'svara']);
const NO_BOTS = new Set();   // games where the host may not add bots (none at the moment)
const REACTIONS = new Set(['😂', '👏', '😮', '😡', '🤝', '🔥', '😭', '🤔']);
const BOT_NAMES = ['Тарас', 'Оксана', 'Марко', 'Соломія', 'Богдан', 'Ірина', 'Остап', 'Дарина', 'Назар', 'Леся', 'Петро'];
const IDLE_MS = 45000;       // a human who does not move for this long gets an automatic move
const LEFT_MS = 60000;       // a human offline for this long is replaced by a bot
const LOBBY_KEEP_MS = 180000; // before the start, an offline player keeps the seat this long
const ADVERTISE_MS = 60000;  // one «looking for players» post per room per minute
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// A room prepared by the server (group command): the first player to open the link becomes the host.
async function makeRoom(env, create) {
  const code = genCode();
  await env.ROOM.get(env.ROOM.idFromName(code)).fetch(`https://room/init?room=${code}`, { method: 'POST', body: JSON.stringify({ create }) });
  return code;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/health') return new Response('ok', { headers: CORS });
    if (url.pathname === '/tg/hook') {
      if (!env.WEBHOOK_SECRET || req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
      const update = await req.json();
      ctx.waitUntil(handleUpdate(update, env, create => makeRoom(env, create)).catch(e => console.log('update failed', e && e.message)));
      return new Response('ok');
    }
    if (url.pathname === '/api/top') return json(await statsCall(env, '/top?period=' + (url.searchParams.get('period') === 'week' ? 'week' : 'all')));
    if (url.pathname === '/api/tour' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const user = body.init ? await authenticate({ init: body.init }, env) : null;
      return json(await statsCall(env, '/tour' + (user && user.id.startsWith('tg:') ? '?id=' + encodeURIComponent(user.id) : '')));
    }
    if (url.pathname === '/api/profile' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const user = await authenticate({ init: body.init }, env);
      if (!user) return json({ error: 'not telegram' }, 401);
      return json(await statsCall(env, '/profile', { id: user.id }));
    }
    if (url.pathname === '/api/hello' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const user = await authenticate({ init: body.init }, env);
      if (!user || !user.id.startsWith('tg:')) return json({ error: 'not telegram' }, 401);
      const r = await statsCall(env, '/hello', { id: user.id, name: user.name, ref: body.ref });
      if (r.inviter) {
        // tell the friend who invited (works if they have ever opened a chat with the bot)
        ctx.waitUntil(tg(env, 'sendMessage', {
          chat_id: r.inviter.slice(3), parse_mode: 'HTML',
          text: `🎉 Ваш друг <b>${esc(user.name)}</b> прийшов за вашим запрошенням — вам <b>+${r.inviterBonus}</b> очок!`,
        }).catch(() => {}));
      }
      return json({ ok: r.ok, welcome: r.welcome, bonus: r.bonus, invitedBy: r.invitedBy });
    }
    if (url.pathname === '/api/daily' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const user = await authenticate({ init: body.init }, env);
      if (!user || !user.id.startsWith('tg:')) return json({ error: 'not telegram' }, 401);
      return json(await statsCall(env, '/daily', { id: user.id, name: user.name }));
    }
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Ігри server', { headers: CORS });
    if (url.pathname === '/ws/match') {
      const game = url.searchParams.get('game') || 'durak';
      const variant = game === 'durak' ? durak.variantOf({ variant: url.searchParams.get('variant') }) : '';
      if (!ENGINES[game] || NO_RANDOM.has(game)) return new Response('bad game', { status: 400 });
      const deck = game === 'durak' ? durak.deckOf({ deck: url.searchParams.get('deck') }) : '';
      return env.LOBBY.get(env.LOBBY.idFromName(`${game}:${variant}:${deck}`)).fetch(req);
    }
    if (url.pathname === '/ws/room') {
      const code = (url.searchParams.get('room') || '').toUpperCase();
      if (!/^[A-Z0-9]{4,8}$/.test(code)) return new Response('bad room', { status: 400 });
      return env.ROOM.get(env.ROOM.idFromName(code)).fetch(req);
    }
    return new Response('not found', { status: 404 });
  },
  // weekly top in the news channel (cron in wrangler.toml)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(statsCall(env, '/weekly', {}));
  },
};

// ---------- auth ----------
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? enc.encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(data));
}
async function verifyTelegram(init, token) {
  if (!init || !token) return null;
  const p = new URLSearchParams(init);
  const hash = p.get('hash');
  if (!hash) return null;
  p.delete('hash');
  const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = await hmac('WebAppData', token);
  if (hex(await hmac(secret, dcs)) !== hash) return null;
  if (Date.now() / 1000 - Number(p.get('auth_date') || 0) > 7 * 86400) return null;
  let u;
  try { u = JSON.parse(p.get('user')); } catch { return null; }
  if (!u || !u.id) return null;
  return { id: 'tg:' + u.id, name: clean(u.first_name || u.username) };
}
const clean = s => String(s || '').replace(/[<>&"]/g, '').trim().slice(0, 24) || 'Гравець';
async function authenticate(msg, env) {
  if (msg.init) {
    // BOT_TOKEN_2 = @IgryUA_bot. BOT_TOKEN (old @DurenUA_bot) was deleted with that bot; unset secrets are skipped.
    for (const token of [env.BOT_TOKEN_2, env.BOT_TOKEN]) {
      const u = await verifyTelegram(msg.init, token);
      if (u) return u;
    }
    return null;
  }
  if (msg.guest && env.ALLOW_GUEST === '1') {
    const id = String(msg.guest.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
    if (id.length < 8) return null;
    return { id: 'g:' + id, name: clean(msg.guest.name) };
  }
  return null;
}
const send = (ws, obj) => { try { ws.send(JSON.stringify(obj)); return true; } catch { return false; } };
function fail(ws, text, code) { send(ws, { type: 'error', text }); try { ws.close(code, 'error'); } catch {} }

// Accept a socket and call onReady(ws, user, helloMsg) after a valid hello (5 s to say it).
function acceptWithHello(env, onReady) {
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();
  let done = false;
  const timer = setTimeout(() => { if (!done) { try { server.close(4001, 'no hello'); } catch {} } }, 5000);
  server.addEventListener('message', async e => {
    if (done) return;
    let msg; try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.t !== 'hello') return;
    done = true; clearTimeout(timer);
    const user = await authenticate(msg, env);
    if (!user) return fail(server, 'Не вдалося перевірити гравця', 4003);
    onReady(server, user, msg);
  });
  return new Response(null, { status: 101, webSocket: client });
}

// ---------- matchmaking ----------
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => ALPHABET[b % ALPHABET.length]).join('');

export class Lobby {
  constructor(state, env) { this.env = env; this.waiting = null; }
  async fetch() {
    return acceptWithHello(this.env, (ws, user) => {
      const w = this.waiting;
      if (w && w.user.id !== user.id && send(w.ws, { type: 'ping' })) {
        this.waiting = null;
        const room = genCode();
        for (const s of [w.ws, ws]) { send(s, { type: 'matched', room }); try { s.close(1000, 'matched'); } catch {} }
        return;
      }
      if (w) { try { w.ws.close(1000, 'replaced'); } catch {} }
      this.waiting = { ws, user };
      send(ws, { type: 'waiting' });
      const drop = () => { if (this.waiting && this.waiting.ws === ws) this.waiting = null; };
      ws.addEventListener('close', drop);
      ws.addEventListener('error', drop);
    });
  }
}

// ---------- rooms ----------
function roomConfig(c) {
  if (!c || !ENGINES[c.game]) return null;
  const cfg = { game: c.game, min: MIN[c.game], max: MAX[c.game] };
  if (c.game === 'durak') {
    cfg.variant = durak.variantOf(c);
    cfg.deck = durak.deckOf(c);
    cfg.max = durak.DECKS[cfg.deck].max;
  }
  if (c.game === 'rpoker') {
    cfg.deck = rpoker.deckOf(c);
    cfg.length = c.length === 'short' ? 'short' : 'full';
    cfg.max = rpoker.DECKS[cfg.deck].max;
  }
  if (c.game === 'svara') cfg.length = svara.lengthOf(c);
  if (c.auto === 2) cfg.auto = 2;
  return cfg;
}

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.cfg = null;
    this.reported = 0;
    this.advertisedAt = 0;
    this.seats = [];          // {id, name, ws, bot, botOnly}
    this.hostId = null;
    this.G = null;
    this.host = null;
    this.num = 0;
    this.again = new Set();
    this.timers = new Map();
  }
  async fetch(req) {
    // the config is stored so a room prepared from a group command survives until someone opens it
    if (!this.cfg) this.cfg = (await this.state.storage.get('cfg')) || null;
    const url = new URL(req.url);
    if (url.searchParams.get('room')) this.code = url.searchParams.get('room').toUpperCase();
    if (url.pathname === '/init') {
      const { create } = await req.json();
      if (!this.cfg) { this.cfg = roomConfig(create); await this.state.storage.put('cfg', this.cfg); }
      return new Response('ok');
    }
    return acceptWithHello(this.env, (ws, user, msg) => this.join(ws, user, msg.create));
  }

  humans() { return this.seats.filter(s => !s.botOnly); }
  fixHost() {
    if (!this.seats.some(s => !s.botOnly && s.id === this.hostId)) {
      const h = this.seats.find(s => !s.botOnly && s.ws) || this.humans()[0];
      this.hostId = h ? h.id : null;
    }
    if (!this.humans().length) { this.seats = []; this.hostId = null; }
  }

  join(ws, user, create) {
    if (!this.cfg) {
      const cfg = roomConfig(create);
      if (!cfg) return fail(ws, 'Кімнату не знайдено або гра вже закінчилась. Попросіть нове посилання.', 4004);
      this.cfg = cfg;
      this.state.storage.put('cfg', cfg);
    }
    let s = this.seats.find(x => !x.botOnly && x.id === user.id);
    if (!s) {
      if (this.G) return fail(ws, 'Гра вже почалася — приєднатися не можна', 4009);
      if (this.seats.length >= this.cfg.max) return fail(ws, 'Кімната заповнена', 4009);
      s = { id: user.id, name: user.name, ws: null, bot: false, botOnly: false };
      this.seats.push(s);
      if (!this.hostId) this.hostId = s.id;
    }
    if (s.ws && s.ws !== ws) { try { s.ws.close(4000, 'replaced'); } catch {} }
    s.ws = ws; s.name = user.name;
    if (s.lvl == null && s.id.startsWith('tg:')) {
      // the player's level (for the ⭐🏅👑 mark others see); looked up once per seat
      s.lvl = 0;
      statsCall(this.env, '/profile', { id: s.id }).then(p => { s.lvl = (p.level && p.level.idx) || 0; if (s.lvl >= 3) this.broadcast(); }).catch(() => {});
    }
    clearTimeout(this.timers.get(s.id));
    if (s.bot && this.G) {           // came back: take the seat back from the bot
      s.bot = false;
      this.G.players[this.seats.indexOf(s)].bot = false;
    }
    ws.addEventListener('message', e => { if (s.ws === ws) this.onMsg(s, e.data); });
    const gone = () => this.onClose(s, ws);
    ws.addEventListener('close', gone);
    ws.addEventListener('error', gone);
    if (!this.G && this.cfg.auto && this.humans().length >= this.cfg.auto) return this.start();
    this.broadcast();
  }

  onClose(s, ws) {
    if (s.ws !== ws) return;
    s.ws = null;
    if (!this.G) {
      // lobby: keep the seat for a while — Telegram often closes the app while the host shares the invite
      clearTimeout(this.timers.get(s.id));
      this.timers.set(s.id, setTimeout(() => { if (!s.ws && !this.G) this.removeSeat(s); }, LOBBY_KEEP_MS));
      return this.broadcast();
    }
    if (s.id === this.hostId) this.fixHost();
    this.broadcast();
    if (this.G.over || s.bot) return;
    clearTimeout(this.timers.get(s.id));
    this.timers.set(s.id, setTimeout(() => { if (!s.ws) this.toBot(s); }, LEFT_MS));
  }

  removeSeat(s) {
    const i = this.seats.indexOf(s);
    if (i < 0) return;
    this.seats.splice(i, 1);
    clearTimeout(this.timers.get(s.id));
    this.fixHost();
    this.broadcast();
  }

  toBot(s) {
    const i = this.seats.indexOf(s);
    if (i < 0 || !this.G || this.G.over || s.bot) return;
    s.bot = true;
    this.G.players[i].bot = true;
    this.G.ev = { kind: 'left', who: i };
    this.host.changed();
  }

  start() {
    if (this.host) this.host.stop();
    this.num++;
    const E = ENGINES[this.cfg.game];
    this.G = E.create(this.cfg, this.seats.map(s => ({ name: s.name, bot: s.bot || s.botOnly })));
    this.G.num = this.num;
    this.again.clear();
    this.host = new Host(E, this.G, { onChange: () => { this.broadcast(); this.report(); }, idleMs: IDLE_MS });
    this.host.changed();
  }

  restart() {
    // keep bots and humans who are still here
    this.seats = this.seats.filter(s => s.botOnly || s.ws);
    this.seats.forEach(s => { s.bot = false; });
    this.fixHost();
    if (this.seats.length >= this.cfg.min && this.humans().length) return this.start();
    if (this.host) this.host.stop();
    this.G = null; this.host = null; this.again.clear();
    this.broadcast();
  }

  onMsg(s, data) {
    let m; try { m = JSON.parse(data); } catch { return; }
    const i = this.seats.indexOf(s);
    if (i < 0) return;
    if (m.t === 'leave') {
      if (!this.G) this.removeSeat(s);
      else if (!this.G.over) this.toBot(s);
      return;
    }
    if (m.t === 'advertise') return this.advertise(s);
    if (m.t === 'react') {
      // quick emoji reactions: shown to everyone at the table, at most one per second per player
      if (!REACTIONS.has(m.e) || Date.now() - (s.lastReact || 0) < 1000) return;
      s.lastReact = Date.now();
      return this.seats.forEach(x => { if (x.ws) send(x.ws, { type: 'react', from: i, e: m.e }); });
    }
    if (!this.G) {                   // lobby commands (host only)
      if (s.id !== this.hostId) return;
      if (m.t === 'addBot' && this.seats.length < this.cfg.max && !NO_BOTS.has(this.cfg.game)) {
        const used = new Set(this.seats.map(x => x.name));
        const name = BOT_NAMES.find(n => !used.has(n)) || 'Бот';
        this.seats.push({ id: 'bot:' + genCode(), name, ws: null, bot: true, botOnly: true });
      } else if (m.t === 'removeBot') {
        const k = this.seats.map(x => x.botOnly).lastIndexOf(true);
        if (k >= 0) this.seats.splice(k, 1);
      } else if (m.t === 'start' && this.seats.length >= this.cfg.min) {
        return this.start();
      }
      return this.broadcast();
    }
    if (m.t === 'again') {
      if (!this.G.over) return;
      this.again.add(s.id);
      const here = this.seats.filter(x => !x.botOnly && x.ws);
      if (here.every(x => this.again.has(x.id))) return this.restart();
      return this.broadcast();
    }
    if (!this.host.act(i, m) && s.ws) send(s.ws, this.view(i));   // rejected move: resync this player
  }

  view(i) {
    const cfg = this.cfg;
    if (!this.G) {
      return {
        type: 'lobby', game: cfg.game, cfg, you: i,
        host: this.seats.findIndex(x => x.id === this.hostId),
        seats: this.seats.map(x => ({ name: x.name, bot: x.botOnly, online: x.botOnly || !!x.ws, lvl: x.lvl || 0 })),
      };
    }
    const v = ENGINES[cfg.game].view(this.G, i);
    v.type = 'state';
    v.cfg = cfg;
    v.online = this.seats.map(x => x.botOnly || x.bot || !!x.ws);
    v.again = this.seats.map(x => this.again.has(x.id));
    v.levels = this.seats.map(x => x.lvl || 0);
    return v;
  }
  broadcast() { this.seats.forEach((s, i) => { if (s.ws) send(s.ws, this.view(i)); }); }

  // Rating: only games with at least two Telegram players count (no farming against bots).
  report() {
    const G = this.G;
    if (!G || !G.over || this.reported === G.num) return;
    this.reported = G.num;
    const players = [];
    this.seats.forEach((s, i) => {
      if (s.botOnly || s.bot || !s.id.startsWith('tg:')) return;
      let res, don = false;
      if (G.game === 'durak') res = G.loser === -1 ? 'draw' : G.loser === i ? 'lose' : 'win';
      else if (G.game === 'battle' || G.game === 'thousand') res = G.winner === i ? 'win' : 'lose';
      else if (G.game === 'mafia') {
        const team = G.roles[i] === 'mafia' ? 'mafia' : 'town';
        res = G.winner === team ? 'win' : 'lose';
        don = team === 'mafia';
      } else if (G.game === 'rpoker' || G.game === 'svara') {
        res = G.winners.includes(i) ? (G.winners.length > 1 ? 'draw' : 'win') : 'lose';
      } else if (G.game === 'goat') {
        res = G.winner === i % 2 ? 'win' : 'lose';
      } else if (G.game === 'spy') {
        res = G.winner === (i === G.spy ? 'spy' : 'town') ? 'win' : 'lose';
        don = i === G.spy;   // counted as «won as the spy» for the badge
      } else return;
      players.push({ id: s.id, name: s.name, res, don });
    });
    if (players.length < 2) return;
    this.state.waitUntil(statsCall(this.env, '/report', { game: G.game, players }).catch(() => {}));
  }

  // «Шукаю гравців у чаті»: post the room to the players' chat with a join button.
  async advertise(s) {
    const toast = text => s.ws && send(s.ws, { type: 'toast', text });
    if (this.G) return toast('Гра вже почалася');
    if (Date.now() - this.advertisedAt < ADVERTISE_MS) return toast('Оголошення вже надіслано — зачекайте хвилину');
    this.advertisedAt = Date.now();
    const { groupId } = await statsCall(this.env, '/community');
    if (!groupId) { this.advertisedAt = 0; return toast('Чат гравців ще не підключено'); }
    const g = GAMES[this.cfg.game], code = this.code;
    const label = cfgLabel(this.cfg);
    const host = this.seats.find(x => x.id === this.hostId);
    const text = `${g.icon} <b>${esc(host ? host.name : s.name)}</b> збирає гру «${g.title}»${label ? ` (${esc(label)})` : ''}\n` +
      `Гравців: ${this.seats.length}/${this.cfg.max}${this.cfg.min > 2 ? `, потрібно щонайменше ${this.cfg.min}` : ''}. Заходьте! 👇`;
    const r = await tg(this.env, 'sendMessage', {
      chat_id: groupId, text, parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '▶ Приєднатися', url: joinUrl(code) }]] },
    });
    if (!r.ok) { this.advertisedAt = 0; return toast(r.description && r.description.includes('not a member') ? 'Бота ще не додано в чат гравців' : 'Не вдалося надіслати оголошення'); }
    toast('📣 Оголошення надіслано в чат гравців');
  }
}
