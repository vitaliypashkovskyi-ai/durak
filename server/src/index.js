// Ігри — multiplayer server (Cloudflare Worker + Durable Objects).
//   /ws/room?room=CODE              one table (Room, one object per code), 2–6 seats, bots allowed
//   /ws/match?game=durak&variant=…  random opponent queue (Lobby, one object per game/variant)
// Each socket first sends {t:"hello", init:<Telegram initData>} (or a guest when ALLOW_GUEST=1),
// plus {create:{game, variant}} when it opens a new room. Game rules live in ../../js/*-engine.js,
// shared with the page, so hidden cards never leave the server.
import * as durak from '../../js/durak-engine.js';
import * as battle from '../../js/battle-engine.js';
import * as mafia from '../../js/mafia-engine.js';
import { Host } from '../../js/host.js';

const ENGINES = { durak, battle, mafia };
const MIN = { durak: 2, battle: 2, mafia: 5 };
const MAX = { durak: 6, battle: 4, mafia: 12 };
const NO_RANDOM = new Set(['mafia']);
const BOT_NAMES = ['Тарас', 'Оксана', 'Марко', 'Соломія', 'Богдан', 'Ірина', 'Остап', 'Дарина', 'Назар', 'Леся', 'Петро'];
const IDLE_MS = 45000;       // a human who does not move for this long gets an automatic move
const LEFT_MS = 60000;       // a human offline for this long is replaced by a bot
const LOBBY_KEEP_MS = 180000; // before the start, an offline player keeps the seat this long
const CORS = { 'Access-Control-Allow-Origin': '*' };

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/health') return new Response('ok', { headers: CORS });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Ігри server', { headers: CORS });
    if (url.pathname === '/ws/match') {
      const game = url.searchParams.get('game') || 'durak';
      const variant = url.searchParams.get('variant') === 'perevod' ? 'perevod' : '';
      if (!ENGINES[game] || NO_RANDOM.has(game)) return new Response('bad game', { status: 400 });
      return env.LOBBY.get(env.LOBBY.idFromName(`${game}:${variant}`)).fetch(req);
    }
    if (url.pathname === '/ws/room') {
      const code = (url.searchParams.get('room') || '').toUpperCase();
      if (!/^[A-Z0-9]{4,8}$/.test(code)) return new Response('bad room', { status: 400 });
      return env.ROOM.get(env.ROOM.idFromName(code)).fetch(req);
    }
    return new Response('not found', { status: 404 });
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
  if (msg.init) return verifyTelegram(msg.init, env.BOT_TOKEN);
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
  if (c.game === 'durak') cfg.variant = c.variant === 'perevod' ? 'perevod' : 'podkidnoy';
  if (c.auto === 2) cfg.auto = 2;
  return cfg;
}

export class Room {
  constructor(state, env) {
    this.env = env;
    this.cfg = null;
    this.seats = [];          // {id, name, ws, bot, botOnly}
    this.hostId = null;
    this.G = null;
    this.host = null;
    this.num = 0;
    this.again = new Set();
    this.timers = new Map();
  }
  async fetch() { return acceptWithHello(this.env, (ws, user, msg) => this.join(ws, user, msg.create)); }

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
    this.host = new Host(E, this.G, { onChange: () => this.broadcast(), idleMs: IDLE_MS });
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
    if (!this.G) {                   // lobby commands (host only)
      if (s.id !== this.hostId) return;
      if (m.t === 'addBot' && this.seats.length < this.cfg.max) {
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
        seats: this.seats.map(x => ({ name: x.name, bot: x.botOnly, online: x.botOnly || !!x.ws })),
      };
    }
    const v = ENGINES[cfg.game].view(this.G, i);
    v.type = 'state';
    v.cfg = cfg;
    v.online = this.seats.map(x => x.botOnly || x.bot || !!x.ws);
    v.again = this.seats.map(x => this.again.has(x.id));
    return v;
  }
  broadcast() { this.seats.forEach((s, i) => { if (s.ws) send(s.ws, this.view(i)); }); }
}
