// Дурень — multiplayer server (Cloudflare Worker + Durable Objects).
//   /ws/room?room=CODE  one game table for two players (Room, one object per code)
//   /ws/match           random opponent queue (Lobby, single object)
// Every socket must first send {t:"hello", init:<Telegram initData>} or, when ALLOW_GUEST=1,
// {t:"hello", guest:{id,name}}. The server keeps the deck and both hands, clients only see their own cards.

const CORS = { 'Access-Control-Allow-Origin': '*' };

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/health') return new Response('ok', { headers: CORS });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Дурень server', { status: 200, headers: CORS });
    if (url.pathname === '/ws/match') return env.LOBBY.get(env.LOBBY.idFromName('main')).fetch(req);
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
  const age = Date.now() / 1000 - Number(p.get('auth_date') || 0);
  if (age > 7 * 86400) return null;
  let u;
  try { u = JSON.parse(p.get('user')); } catch { return null; }
  if (!u || !u.id) return null;
  return { id: 'tg:' + u.id, name: clean(u.first_name || u.username || 'Гравець') };
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

// Accept a socket and call onReady(user) after a valid hello (5 s to say it).
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
    if (!user) { send(server, { type: 'error', text: 'Не вдалося перевірити гравця' }); try { server.close(4003, 'auth'); } catch {} return; }
    onReady(server, user);
  });
  return new Response(null, { status: 101, webSocket: client });
}

// ---------- matchmaking ----------
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const genCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => ALPHABET[b % ALPHABET.length]).join('');

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

// ---------- game rules ----------
const val = (G, c) => c.r + (c.s === G.trump ? 10 : 0);
const beats = (G, a, d) => (d.s === a.s && d.r > a.r) || (d.s === G.trump && a.s !== G.trump);
const undefended = G => G.table.filter(p => !p.d).length;
function canAdd(G, c) {
  if (!G.table.length) return true;
  if (G.table.length >= 6) return false;
  if (undefended(G) >= G.hands[1 - G.attacker].length) return false;
  return G.table.some(p => p.a.r === c.r || (p.d && p.d.r === c.r));
}
function actor(G) {
  if (!G.table.length || G.taking) return G.attacker;
  return undefended(G) ? 1 - G.attacker : G.attacker;
}
function drawUp(G, p) { while (G.hands[p].length < 6 && G.deck.length) G.hands[p].push(G.deck.pop()); }
function newGame(num) {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 0; r < 9; r++) deck.push({ s, r, id: s * 9 + r });
  const rnd = crypto.getRandomValues(new Uint32Array(deck.length));
  for (let i = deck.length - 1; i > 0; i--) { const j = rnd[i] % (i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const G = { num, deck, trump: deck[0].s, trumpCard: deck[0], hands: [[], []], table: [], attacker: 0, taking: false, out: 0, over: false, loser: null, forfeit: false };
  drawUp(G, 0); drawUp(G, 1);
  const low = h => Math.min(99, ...h.filter(c => c.s === G.trump).map(c => c.r));
  const l0 = low(G.hands[0]), l1 = low(G.hands[1]);
  G.attacker = l0 === l1 ? (rnd[0] & 1) : (l0 < l1 ? 0 : 1);
  return G;
}

export class Room {
  constructor(state, env) {
    this.env = env;
    this.seats = [null, null];   // {id, name, ws}
    this.G = null;
    this.games = 0;
    this.again = new Set();
    this.leaveTimers = [null, null];
    this.finishTimer = null;
    this.ev = null;
  }
  async fetch() { return acceptWithHello(this.env, (ws, user) => this.join(ws, user)); }

  join(ws, user) {
    let seat = this.seats.findIndex(s => s && s.id === user.id);
    if (seat < 0) {
      seat = this.seats.findIndex(s => !s);
      if (seat < 0) { send(ws, { type: 'error', text: 'Кімната вже зайнята' }); try { ws.close(4009, 'full'); } catch {} return; }
      this.seats[seat] = { id: user.id, name: user.name, ws: null };
    }
    const s = this.seats[seat];
    if (s.ws && s.ws !== ws) { try { s.ws.close(4000, 'replaced'); } catch {} }
    s.ws = ws; s.name = user.name;
    clearTimeout(this.leaveTimers[seat]);
    ws.addEventListener('message', e => { if (s.ws === ws) this.onMsg(seat, e.data); });
    const gone = () => this.onClose(seat, ws);
    ws.addEventListener('close', gone);
    ws.addEventListener('error', gone);
    if (!this.G && this.seats[0] && this.seats[1]) this.start();
    this.broadcast();
  }

  onClose(seat, ws) {
    const s = this.seats[seat];
    if (!s || s.ws !== ws) return;
    s.ws = null;
    if (!this.G) { this.seats[seat] = null; this.broadcast(); return; }  // left before the start: free the seat
    this.broadcast();
    if (this.G.over) return;
    clearTimeout(this.leaveTimers[seat]);
    this.leaveTimers[seat] = setTimeout(() => {
      if (this.seats[seat] && !this.seats[seat].ws && this.G && !this.G.over) {
        this.G.over = true; this.G.loser = seat; this.G.forfeit = true;
        this.broadcast();
      }
    }, 60000);
  }

  start() {
    this.games++;
    this.G = newGame(this.games);
    this.again.clear();
    clearTimeout(this.finishTimer);
  }

  onMsg(seat, data) {
    let m; try { m = JSON.parse(data); } catch { return; }
    if (m.t === 'again') {
      if (!this.G || !this.G.over) return;
      this.again.add(seat);
      if (this.again.size === 2 && this.seats[0] && this.seats[1]) this.start();
      return this.broadcast();
    }
    const r = this.apply(seat, m);
    if (r === 'finish') return this.finish();
    if (r) { this.broadcast(); this.autoFinish(); }
    else if (this.seats[seat] && this.seats[seat].ws) send(this.seats[seat].ws, this.view(seat));  // rejected: resync
  }

  apply(seat, m) {
    const G = this.G;
    if (!G || G.over || actor(G) !== seat) return false;
    const hand = G.hands[seat];
    const card = m.id != null ? hand.find(c => c.id === m.id) : null;
    const def = 1 - G.attacker;
    if (m.t === 'play') {
      if (!card || seat !== G.attacker || !canAdd(G, card)) return false;
      hand.splice(hand.indexOf(card), 1);
      G.table.push({ a: card, d: null });
      return true;
    }
    if (m.t === 'cover') {
      const p = G.table[m.i];
      if (!card || seat !== def || G.taking || !p || p.d || !beats(G, p.a, card)) return false;
      hand.splice(hand.indexOf(card), 1);
      p.d = card;
      return true;
    }
    if (m.t === 'take') {
      if (seat !== def || G.taking || !undefended(G)) return false;
      G.taking = true;
      return true;
    }
    if (m.t === 'done') {
      if (seat !== G.attacker || !G.table.length || (!G.taking && undefended(G))) return false;
      return 'finish';
    }
    return false;
  }

  // The attacker has nothing to throw in: close the bout after a short pause.
  autoFinish() {
    const G = this.G;
    clearTimeout(this.finishTimer);
    if (!G || G.over || !G.table.length || actor(G) !== G.attacker) return;
    if (G.hands[G.attacker].some(c => canAdd(G, c))) return;
    const num = G.num, len = G.table.length, taking = G.taking;
    this.finishTimer = setTimeout(() => {
      if (this.G === G && G.num === num && G.table.length === len && G.taking === taking && !G.over) this.finish();
    }, 900);
  }

  finish() {
    const G = this.G, att = G.attacker, def = 1 - att, took = G.taking;
    clearTimeout(this.finishTimer);
    const cards = G.table.flatMap(p => (p.d ? [p.a, p.d] : [p.a]));
    if (took) G.hands[def].push(...cards); else G.out += cards.length;
    this.ev = { kind: took ? 'took' : 'bito', who: def };
    G.table = []; G.taking = false;
    drawUp(G, att); drawUp(G, def);
    if (!took) G.attacker = def;
    if (!G.deck.length) {
      const e0 = !G.hands[0].length, e1 = !G.hands[1].length;
      if (e0 || e1) { G.over = true; G.loser = e0 && e1 ? -1 : e0 ? 1 : 0; }
    }
    this.broadcast();
    this.autoFinish();
  }

  view(seat) {
    const G = this.G, other = 1 - seat;
    const base = {
      type: 'state', seat,
      names: this.seats.map(s => (s ? s.name : null)),
      online: this.seats.map(s => !!(s && s.ws)),
      started: !!G, again: [...this.again], ev: this.ev,
    };
    if (!G) return base;
    return Object.assign(base, {
      game: G.num, hand: G.hands[seat], opp: G.hands[other].length, table: G.table,
      deck: G.deck.length, trump: G.trump, trumpCard: G.trumpCard, attacker: G.attacker,
      taking: G.taking, out: G.out, over: G.over, loser: G.loser, forfeit: G.forfeit,
    });
  }
  broadcast() {
    this.seats.forEach((s, i) => { if (s && s.ws) send(s.ws, this.view(i)); });
    this.ev = null;
  }
}
