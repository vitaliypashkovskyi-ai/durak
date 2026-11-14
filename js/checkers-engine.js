// Шашки (класичні, як в Україні): дошка 8×8, по 12 шашок, грають на темних клітинках.
// Проста шашка ходить по діагоналі вперед на 1, б'є вперед і назад. Бити обов'язково; після удару,
// якщо можна бити далі, — б'є далі тією ж шашкою (збиті знімаються після ходу, двічі через одну не перескакують).
// Дійшла до останнього ряду — дамка (якщо під час удару — далі б'є вже як дамка). Дамка ходить і б'є
// на будь-яку відстань. Хто не може зробити хід (або без шашок) — програв.
// Нічия: 30 ходів поспіль лише дамками без взяття, або 300 ходів усього. Pure JS (page + server).

export const delay = { bot: 700, advance: 0 };
const DIRS = [-9, -7, 7, 9];
const MAX_QUIET = 30, MAX_PLIES = 300;

// cell: 0 empty, 1 white man, 2 white king, 3 black man, 4 black king. Seat 0 = white (bottom, moves up).
export const owner = v => (v === 1 || v === 2 ? 0 : v === 3 || v === 4 ? 1 : -1);
export const isKing = v => v === 2 || v === 4;
const rc = sq => [sq >> 3, sq & 7];
const onBoard = (sq, d) => { const [r, c] = rc(sq); const dr = d < 0 ? -1 : 1, dc = d === -9 || d === 7 ? -1 : 1; const nr = r + dr, nc = c + dc; return nr >= 0 && nr < 8 && nc >= 0 && nc < 8 ? nr * 8 + nc : -1; };
const lastRow = seat => (seat === 0 ? 0 : 7);
const forward = seat => (seat === 0 ? [-9, -7] : [7, 9]);

function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }

export function create(cfg, players) {
  const B = Array(64).fill(0);
  for (let sq = 0; sq < 64; sq++) {
    const [r, c] = rc(sq);
    if ((r + c) % 2 !== 1) continue;
    if (r < 3) B[sq] = 3; else if (r > 4) B[sq] = 1;
  }
  return {
    game: 'checkers', num: 1,
    players: players.map(p => ({ name: p.name, bot: !!p.bot })),
    B, turn: 0, chain: null, taken: [], quiet: 0, plies: 0,
    last: null, over: false, winner: null, ev: null,
  };
}

// Captures from one square. taken = squares already jumped in this move (still on the board, cannot be jumped again).
function capturesFrom(B, sq, taken) {
  const v = B[sq], me = owner(v), out = [];
  for (const d of DIRS) {
    if (isKing(v)) {
      let s = onBoard(sq, d);
      while (s >= 0 && B[s] === 0) s = onBoard(s, d);
      if (s < 0 || owner(B[s]) !== 1 - me || taken.includes(s)) continue;
      // a king must land where it can capture further, if there is such a square
      const lands = [];
      let t = onBoard(s, d);
      while (t >= 0 && B[t] === 0) { lands.push(t); t = onBoard(t, d); }
      const tk = taken.concat(s);
      const more = lands.filter(l => { B[l] = v; B[sq] = 0; const ok = capturesFrom(B, l, tk).length > 0; B[l] = 0; B[sq] = v; return ok; });
      for (const l of more.length ? more : lands) out.push({ from: sq, to: l, cap: s });
    } else {
      const s = onBoard(sq, d); if (s < 0 || owner(B[s]) !== 1 - me || taken.includes(s)) continue;
      const t = onBoard(s, d); if (t >= 0 && B[t] === 0) out.push({ from: sq, to: t, cap: s });
    }
  }
  return out;
}
function quietFrom(B, sq) {
  const v = B[sq], me = owner(v), out = [];
  for (const d of isKing(v) ? DIRS : forward(me)) {
    let t = onBoard(sq, d);
    while (t >= 0 && B[t] === 0) { out.push({ from: sq, to: t }); if (!isKing(v)) break; t = onBoard(t, d); }
  }
  return out;
}
// All legal single steps for the side to move (a capture chain continues with the same piece).
export function steps(S) {
  const B = S.B, me = S.turn;
  if (S.chain != null) return capturesFrom(B, S.chain, S.taken);
  let caps = [];
  for (let sq = 0; sq < 64; sq++) if (owner(B[sq]) === me) caps = caps.concat(capturesFrom(B, sq, []));
  if (caps.length) return caps;
  let q = [];
  for (let sq = 0; sq < 64; sq++) if (owner(B[sq]) === me) q = q.concat(quietFrom(B, sq));
  return q;
}

// Applies one step to a plain state {B, turn, chain, taken, quiet, plies}; returns true when the move (turn) ended.
function apply(S, st) {
  const B = S.B, v = B[st.from], me = owner(v);
  B[st.to] = v; B[st.from] = 0;
  let promoted = false;
  if (!isKing(v) && (st.to >> 3) === lastRow(me)) { B[st.to] = v + 1; promoted = true; }
  if (st.cap != null) {
    S.taken.push(st.cap);
    if (capturesFrom(B, st.to, S.taken).length) { S.chain = st.to; return false; }
    for (const s of S.taken) B[s] = 0;
    S.quiet = 0;
  } else {
    S.quiet = isKing(v) && !promoted ? S.quiet + 1 : 0;
  }
  S.taken = []; S.chain = null;
  S.turn = 1 - me; S.plies++;
  return true;
}

function checkEnd(G) {
  if (G.quiet >= MAX_QUIET || G.plies >= MAX_PLIES) { G.over = true; G.winner = -1; G.ev = { kind: 'end', why: 'draw' }; return; }
  if (!steps(G).length) { G.over = true; G.winner = 1 - G.turn; G.ev = { kind: 'end', why: 'nomoves' }; }
}

export function act(G, seat, m) {
  if (!G || G.over || seat !== G.turn || !m || m.t !== 'move') return false;
  const st = steps(G).find(s => s.from === m.from && s.to === m.to);
  if (!st) return false;
  const ended = apply(G, st);
  G.last = { from: st.from, to: st.to, seat, cap: st.cap != null };
  G.ev = { kind: st.cap != null ? 'capture' : 'move', seat, more: !ended };
  if (ended) checkEnd(G);
  return true;
}

export const pendingAdvance = () => false;
export function advance() {}

export function view(G, seat) {
  return {
    game: 'checkers', seat, num: G.num, over: G.over, winner: G.winner, ev: G.ev,
    players: G.players.map((p, i) => ({ name: p.name, bot: p.bot, pieces: G.B.filter(v => owner(v) === i).length })),
    B: G.B.slice(), turn: G.turn, chain: G.chain, taken: G.taken.slice(), last: G.last, quiet: G.quiet,
    steps: !G.over ? steps(G) : [],
  };
}
export function waiting(G) { return G.over ? [] : [G.turn]; }

// ---------- bot: alpha-beta over whole moves ----------
const clone = S => ({ B: S.B.slice(), turn: S.turn, chain: S.chain, taken: S.taken.slice(), quiet: S.quiet, plies: S.plies });
// whole moves = sequences of steps until the turn passes; returns [{first, state}]
function moves(S) {
  const out = [];
  const walk = (s, first) => {
    for (const st of steps(s)) {
      const n = clone(s);
      const ended = apply(n, st);
      if (ended) out.push({ first: first || st, state: n });
      else walk(n, first || st);
    }
  };
  walk(S, null);
  return out;
}
function evaluate(B, me) {
  let s = 0;
  for (let sq = 0; sq < 64; sq++) {
    const v = B[sq]; if (!v) continue;
    const o = owner(v), [r, c] = rc(sq);
    let x = isKing(v) ? 32 : 10 + (o === 0 ? 7 - r : r) * 0.6;
    if (!isKing(v) && c > 1 && c < 6 && r > 1 && r < 6) x += 0.5;     // centre
    if (!isKing(v) && r === (o === 0 ? 7 : 0)) x += 0.4;               // back row guards
    s += o === me ? x : -x;
  }
  return s;
}
function search(S, depth, alpha, beta, me) {
  const ms = moves(S);
  if (!ms.length) return S.turn === me ? -1000 - depth : 1000 + depth;
  if (depth === 0) return evaluate(S.B, me);
  if (S.turn === me) {
    let best = -Infinity;
    for (const m of ms) { best = Math.max(best, search(m.state, depth - 1, alpha, beta, me)); alpha = Math.max(alpha, best); if (alpha >= beta) break; }
    return best;
  }
  let best = Infinity;
  for (const m of ms) { best = Math.min(best, search(m.state, depth - 1, alpha, beta, me)); beta = Math.min(beta, best); if (alpha >= beta) break; }
  return best;
}
export function botAction(G, seat) {
  if (G.over || G.turn !== seat) return null;
  const S = clone(G);
  const ms = moves(S);
  if (!ms.length) return null;
  const pieces = G.B.filter(v => v).length;
  const depth = pieces > 16 ? 4 : pieces > 8 ? 5 : 6;
  let best = -Infinity, pick = [];
  for (const m of ms) {
    const v = search(m.state, depth - 1, -Infinity, Infinity, seat) + Math.random() * 0.3;
    if (v > best) { best = v; pick = [m]; }
  }
  const st = pick[0].first;
  return { t: 'move', from: st.from, to: st.to };
}
