// Морський бій на 2–4 гравці + бот. Pure JS (page + server).
// Board: 10×10, cell index = y*10 + x. Shots: 0 unknown, 1 miss, 2 hit, 3 sunk.

export const SIZE = 10;
export const FLEET = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
export const delay = { bot: 650, advance: 0 };

function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }

export function around(c) {
  const x = c % SIZE, y = (c / SIZE) | 0, out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, ny = y + dy;
    if ((dx || dy) && nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE) out.push(ny * SIZE + nx);
  }
  return out;
}

export function randomFleet() {
  for (;;) {
    const own = new Array(SIZE * SIZE).fill(-1), ships = [];
    let ok = true;
    for (const len of FLEET) {
      let placed = false;
      for (let t = 0; t < 300 && !placed; t++) {
        const hor = rnd(2) === 0;
        const x = rnd(hor ? SIZE - len + 1 : SIZE), y = rnd(hor ? SIZE : SIZE - len + 1);
        const cells = [];
        for (let k = 0; k < len; k++) cells.push((y + (hor ? 0 : k)) * SIZE + x + (hor ? k : 0));
        if (cells.every(c => own[c] === -1 && around(c).every(a => own[a] === -1))) {
          cells.forEach(c => { own[c] = ships.length; });
          ships.push({ cells, hits: 0 });
          placed = true;
        }
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return { own, ships };
  }
}

const sunk = s => s.hits >= s.cells.length;
const shipsLeft = f => f.ships.filter(s => !sunk(s)).length;

export function create(cfg, players) {
  const G = {
    game: 'battle', num: 1,
    players: players.map(p => ({ name: p.name, bot: !!p.bot })),
    fleets: players.map(() => randomFleet()),
    shots: players.map(() => new Array(SIZE * SIZE).fill(0)),
    alive: players.map(() => true),
    ready: players.map(p => !!p.bot),
    phase: 'place', turn: rnd(players.length), over: false, winner: null, ev: null,
  };
  startIfReady(G);
  return G;
}

function nextAlive(G, i) {
  const n = G.players.length;
  for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (G.alive[j]) return j; }
  return i;
}
function startIfReady(G) {
  if (G.phase === 'place' && G.ready.every(Boolean)) { G.phase = 'play'; G.ev = { kind: 'start' }; }
}

export function act(G, seat, m) {
  if (!G || G.over || !m || !(seat >= 0 && seat < G.players.length)) return false;
  if (G.phase === 'place') {
    if (G.ready[seat]) return false;
    if (m.t === 'shuffle') { G.fleets[seat] = randomFleet(); return true; }
    if (m.t === 'ready') { G.ready[seat] = true; startIfReady(G); return true; }
    return false;
  }
  if (m.t !== 'shoot' || seat !== G.turn || !G.alive[seat]) return false;
  const t = m.target, c = m.cell;
  if (!(t >= 0 && t < G.players.length) || t === seat || !G.alive[t]) return false;
  if (!Number.isInteger(c) || c < 0 || c >= SIZE * SIZE || G.shots[t][c]) return false;
  const f = G.fleets[t], sh = G.shots[t], si = f.own[c];
  const ev = { kind: 'shot', by: seat, target: t, cell: c, res: 'miss', dead: null };
  if (si < 0) {
    sh[c] = 1;
    G.turn = nextAlive(G, seat);
  } else {
    const ship = f.ships[si];
    ship.hits++;
    sh[c] = 2;
    ev.res = 'hit';
    if (sunk(ship)) {
      ev.res = 'sunk';
      ship.cells.forEach(x => { sh[x] = 3; });
      ship.cells.forEach(x => around(x).forEach(a => { if (!sh[a]) sh[a] = 1; }));
      if (!shipsLeft(f)) {
        G.alive[t] = false;
        ev.dead = t;
        if (G.alive.filter(Boolean).length === 1) { G.over = true; G.winner = seat; }
      }
    }
  }
  G.ev = ev;
  return true;
}

export const pendingAdvance = () => false;
export function advance() {}

export function view(G, seat) {
  return {
    game: 'battle', seat, num: G.num, phase: G.phase, turn: G.turn, over: G.over, winner: G.winner, ev: G.ev,
    players: G.players.map((p, i) => ({ name: p.name, bot: p.bot, alive: G.alive[i], ready: G.ready[i], left: shipsLeft(G.fleets[i]) })),
    boards: G.players.map((_, i) => ({
      shots: G.shots[i],
      ships: i === seat || G.over ? G.fleets[i].own.map(v => v >= 0) : null,
    })),
  };
}

export function waiting(G) {
  if (G.over) return [];
  if (G.phase === 'place') return G.ready.map((r, i) => (r ? -1 : i)).filter(i => i >= 0);
  return [G.turn];
}

// ---------- bot ----------
function botShot(G, seat) {
  const opps = G.players.map((_, i) => i).filter(i => i !== seat && G.alive[i]);
  let target = opps.find(i => G.shots[i].includes(2));
  if (target == null) target = opps[rnd(opps.length)];
  const sh = G.shots[target];
  const free = c => c >= 0 && c < SIZE * SIZE && sh[c] === 0;
  let cands = [];
  const h = sh.indexOf(2);
  if (h >= 0) {
    const x = h % SIZE, y = (h / SIZE) | 0;
    let l = x, r = x, u = y, d = y;
    while (l > 0 && sh[y * SIZE + l - 1] === 2) l--;
    while (r < SIZE - 1 && sh[y * SIZE + r + 1] === 2) r++;
    while (u > 0 && sh[(u - 1) * SIZE + x] === 2) u--;
    while (d < SIZE - 1 && sh[(d + 1) * SIZE + x] === 2) d++;
    if (r > l) {
      if (l > 0) cands.push(y * SIZE + l - 1);
      if (r < SIZE - 1) cands.push(y * SIZE + r + 1);
    } else if (d > u) {
      if (u > 0) cands.push((u - 1) * SIZE + x);
      if (d < SIZE - 1) cands.push((d + 1) * SIZE + x);
    } else {
      if (x > 0) cands.push(h - 1);
      if (x < SIZE - 1) cands.push(h + 1);
      if (y > 0) cands.push(h - SIZE);
      if (y < SIZE - 1) cands.push(h + SIZE);
    }
    cands = cands.filter(free);
  }
  if (!cands.length) {
    for (let c = 0; c < SIZE * SIZE; c++) if (sh[c] === 0) cands.push(c);
    const parity = cands.filter(c => ((c % SIZE) + ((c / SIZE) | 0)) % 2 === 0);
    if (parity.length) cands = parity;
  }
  return { t: 'shoot', target, cell: cands[rnd(cands.length)] };
}

export function botAction(G, seat) {
  if (G.over) return null;
  if (G.phase === 'place') return G.ready[seat] ? null : { t: 'ready' };
  if (G.turn !== seat || !G.alive[seat]) return null;
  return botShot(G, seat);
}
