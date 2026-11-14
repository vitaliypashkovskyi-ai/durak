// Довгі нарди: 2 гравці, по 15 шашок, усі стартують на «голові» й ідуть по колу в один бік (суперник — з протилежної
// половини). Бити не можна: на пункт із шашкою суперника ставати заборонено. З голови за хід можна зняти одну шашку
// (лише першим кидком 6-6, 4-4 чи 3-3 — дві). Дубль — чотири ходи. Треба зіграти якнайбільше очок кубиків
// (якщо можна лише один кубик — більший). Не можна будувати «паркан» із 6 пунктів поспіль, якщо попереду нього
// немає жодної шашки суперника. Коли всі 15 у «домі» (останні 6 пунктів) — викидаєте. Хто перший викинув усі — виграв;
// якщо суперник не викинув жодної — «марс» (подвійна перемога). Pure JS (page + server).

export const delay = { bot: 750, advance: 0 };
const N = 15;

function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
const die = () => rnd(6) + 1;

// position p = 0..23 along the player's own path (0 = head, 18..23 = home), 24 = borne off.
// absolute point a = (p + 12 * seat) % 24
export const absOf = (seat, p) => (p + 12 * seat) % 24;
export const posOf = (seat, a) => (a - 12 * seat + 24) % 24;

export function create(cfg, players) {
  const G = {
    game: 'nardy', num: 1,
    players: players.map(p => ({ name: p.name, bot: !!p.bot })),
    pos: [Array(N).fill(0), Array(N).fill(0)],      // each checker's path position
    turn: rnd(2), first: [true, true], dice: [], left: [], headUsed: 0, headLimit: 1,
    over: false, winner: null, mars: false, ev: null, waitUntil: null, last: null,
  };
  roll(G);
  return G;
}

function roll(G) {
  const a = die(), b = die();
  G.dice = [a, b];
  G.left = a === b ? [a, a, a, a] : [a, b];
  G.headUsed = 0;
  G.headLimit = G.first[G.turn] && a === b && [3, 4, 6].includes(a) ? 2 : 1;
  G.first[G.turn] = false;
  G.last = null;
  G.ev = { kind: 'roll', seat: G.turn, dice: G.dice.slice() };
  if (!steps(G).length) { G.waitUntil = Date.now() + 1800; G.ev.none = true; }
}

// occupancy of absolute points: [{o, n}]
function board(S) {
  const pts = Array.from({ length: 24 }, () => ({ o: -1, n: 0 }));
  for (let s = 0; s < 2; s++) for (const p of S.pos[s]) if (p < 24) { const a = absOf(s, p); pts[a].o = s; pts[a].n++; }
  return pts;
}

// six own points in a row with no opponent checker in front of them
function badFence(S, seat) {
  const own = Array(24).fill(false);
  for (const p of S.pos[seat]) if (p < 24) own[p] = true;
  const opp = 1 - seat;
  for (let p = 0; p + 5 < 24; p++) {
    let ok = true;
    for (let k = 0; k < 6; k++) if (!own[p + k]) { ok = false; break; }
    if (!ok) continue;
    // the fence's last point, seen on the opponent's path; someone of theirs must be further along
    const qEnd = posOf(opp, absOf(seat, p + 5)), qStart = posOf(opp, absOf(seat, p));
    const ahead = S.pos[opp].some(q => q < 24 && (qStart <= qEnd ? q > qEnd : q > qEnd && q < qStart));
    if (!ahead) return true;
  }
  return false;
}

function canBearOff(S, seat) { return S.pos[seat].every(p => p >= 18); }

// single steps for a given die (dedup by source position)
function stepsFor(S, seat, d, pts) {
  const out = [], seen = new Set();
  const bear = canBearOff(S, seat);
  for (let i = 0; i < N; i++) {
    const p = S.pos[seat][i];
    if (p >= 24 || seen.has(p)) continue;
    seen.add(p);
    if (p === 0 && S.headUsed >= S.headLimit) continue;
    const to = p + d;
    if (to < 24) {
      const t = pts[absOf(seat, to)];
      if (t.n && t.o !== seat) continue;
    } else {
      if (!bear) continue;
      if (to > 24 && S.pos[seat].some(q => q >= 18 && q < p)) continue;   // a checker further from the exit must go first
    }
    const st = { from: p, to: Math.min(to, 24), die: d };
    // the fence rule
    const n = cloneS(S); doStep(n, seat, st);
    if (to < 24 && badFence(n, seat)) continue;
    out.push(st);
  }
  return out;
}
const cloneS = S => ({ pos: [S.pos[0].slice(), S.pos[1].slice()], left: S.left.slice(), headUsed: S.headUsed, headLimit: S.headLimit });
function doStep(S, seat, st) {
  const i = S.pos[seat].indexOf(st.from);
  S.pos[seat][i] = st.to;
  if (st.from === 0) S.headUsed++;
  S.left.splice(S.left.indexOf(st.die), 1);
}

// Longest playable sequences from S (seat to move); returns {len, seqs:[[step...]]} (seqs capped)
function sequences(S, seat, cap = 4000) {
  let best = 0; const seqs = []; const memo = new Set();
  const walk = (s, path) => {
    // per first step, so every first step that can start a longest sequence is found
    const key = (path[0] ? path[0].from + ':' + path[0].die : '') + '|' + s.pos[seat].slice().sort((a, b) => a - b).join(',') + '|' + s.left.join(',') + '|' + s.headUsed;
    if (memo.has(key)) return;
    memo.add(key);
    const pts = board(s);
    let any = false;
    for (const d of [...new Set(s.left)]) {
      for (const st of stepsFor(s, seat, d, pts)) {
        any = true;
        const n = cloneS(s); doStep(n, seat, st);
        walk(n, path.concat(st));
        if (seqs.length >= cap) return;
      }
    }
    if (!any) {
      if (path.length > best) { best = path.length; seqs.length = 0; }
      if (path.length === best) seqs.push({ path, state: s });
    }
  };
  walk(cloneS(S), []);
  return { len: best, seqs };
}

// Legal next steps: those that start a longest sequence; with one die playable of two different, the larger one.
export function steps(S) {
  const seat = S.turn;
  if (S.over || S.waitUntil || !S.left.length) return [];
  const { len, seqs } = sequences(S, seat);
  if (!len) return [];
  let pool = seqs;
  if (len === 1 && S.left.length === 2 && S.left[0] !== S.left[1]) {
    const big = Math.max(...S.left);
    if (pool.some(q => q.path[0].die === big)) pool = pool.filter(q => q.path[0].die === big);
  }
  const out = [], seen = new Set();
  for (const q of pool) {
    const st = q.path[0], k = st.from + ':' + st.die;
    if (!seen.has(k)) { seen.add(k); out.push(st); }
  }
  return out;
}

export function act(G, seat, m) {
  if (!G || G.over || G.waitUntil || seat !== G.turn || !m || m.t !== 'move') return false;
  const st = steps(G).find(s => s.from === m.from && s.die === m.die);
  if (!st) return false;
  doStep(G, seat, st);
  G.last = { seat, from: st.from, to: st.to };
  G.ev = { kind: st.to === 24 ? 'off' : 'move', seat };
  if (G.pos[seat].every(p => p === 24)) {
    G.over = true; G.winner = seat; G.mars = G.pos[1 - seat].every(p => p < 24);
    G.ev = { kind: 'end', seat };
    return true;
  }
  if (!G.left.length || !steps(G).length) nextTurn(G);
  return true;
}
function nextTurn(G) { G.turn = 1 - G.turn; G.num++; roll(G); }

export const pendingAdvance = G => !G.over && G.waitUntil != null;
export const advanceIn = G => (G.waitUntil || 0) - Date.now();
export function advance(G) {
  if (G.over || G.waitUntil == null) return;
  G.waitUntil = null;
  nextTurn(G);
}

export function view(G, seat) {
  const pts = board(G);
  return {
    game: 'nardy', seat, num: G.num, over: G.over, winner: G.winner, mars: G.mars, ev: G.ev,
    players: G.players.map((p, i) => ({ name: p.name, bot: p.bot, off: G.pos[i].filter(x => x === 24).length,
      pips: G.pos[i].reduce((s, x) => s + (24 - x), 0) })),
    pts, turn: G.turn, dice: G.dice.slice(), left: G.left.slice(), last: G.last,
    waitUntil: G.waitUntil ? 1 : 0,
    steps: steps(G),
  };
}
export function waiting(G) { return G.over || G.waitUntil ? [] : [G.turn]; }

// ---------- bot ----------
function evaluate(S, seat) {
  const opp = 1 - seat, mine = S.pos[seat];
  let s = 0;
  for (const p of mine) s += p === 24 ? 30 : p;
  if (mine.every(p => p >= 18)) s += 15;
  // stacks are clumsy, spread is flexible
  const cnt = Array(25).fill(0); for (const p of mine) cnt[p]++;
  for (let p = 1; p < 24; p++) if (cnt[p] > 3) s -= (cnt[p] - 3) * 1.5;
  s -= Math.max(0, cnt[0] - 1) * 0.6;
  // own points standing in front of the opponent's checkers slow them down
  const oppMin = Math.min(...S.pos[opp].filter(q => q < 24), 24);
  for (let p = 0; p < 24; p++) {
    if (!cnt[p] || p === 0) continue;
    const q = posOf(opp, absOf(seat, p));
    if (q > oppMin && q < oppMin + 13) s += 1.6;
  }
  return s;
}
export function botAction(G, seat) {
  if (G.over || G.waitUntil || G.turn !== seat) return null;
  const legal = steps(G);
  if (!legal.length) return null;
  const { seqs } = sequences(G, seat);
  let best = -Infinity, pick = null;
  for (const q of seqs) {
    if (!legal.some(st => st.from === q.path[0].from && st.die === q.path[0].die)) continue;
    const v = evaluate(q.state, seat) + Math.random() * 0.2;
    if (v > best) { best = v; pick = q.path[0]; }
  }
  pick = pick || legal[0];
  return { t: 'move', from: pick.from, die: pick.die };
}
