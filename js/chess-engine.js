// Шахи: повні правила — рокіровка, взяття на проході, перетворення пішака, шах і мат, пат,
// нічия за 50 ходами, триразовим повтором і нестачею матеріалу. Можна здатися.
// Кольори розігруються. Бот — альфа-бета з оцінкою позиції (глибина залежить від рівня). Pure JS (page + server).
import { levelOf } from './level.js';

export const delay = { bot: 600, advance: 0 };
// board: 64 cells, index = row * 8 + col, row 0 = rank 8 (black's back rank). 'PNBRQK' white, 'pnbrqk' black.
const START = 'rnbqkbnrpppppppp' + '.'.repeat(32) + 'PPPPPPPPRNBQKBNR';
const isW = p => p >= 'A' && p <= 'Z';
const colorOf = p => (!p || p === '.' ? null : isW(p) ? 'w' : 'b');
const N = [-17, -15, -10, -6, 6, 10, 15, 17], KD = [-9, -8, -7, -1, 1, 7, 8, 9];
const rc = i => [i >> 3, i & 7];
const ok = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
export const sqName = i => 'abcdefgh'[i & 7] + (8 - (i >> 3));

function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }

export function create(cfg, players) {
  const white = rnd(2);
  const G = {
    game: 'chess', level: levelOf(cfg), num: 1,
    players: players.map(p => ({ name: p.name, bot: !!p.bot })),
    B: START.split(''), side: 'w', castle: 'KQkq', ep: -1, half: 0, full: 1,
    white, rep: {}, last: null, captured: { w: [], b: [] },
    over: false, winner: null, why: null, ev: null,
  };
  G.rep[key(G)] = 1;
  return G;
}
export const seatOf = (G, color) => (color === 'w' ? G.white : 1 - G.white);
export const colorOfSeat = (G, seat) => (seat === G.white ? 'w' : 'b');
const key = S => S.B.join('') + S.side + S.castle + S.ep;

// is square i attacked by color c?
function attacked(B, i, c) {
  const [r, col] = rc(i);
  const pawn = c === 'w' ? 'P' : 'p', dr = c === 'w' ? 1 : -1;     // a white pawn attacks upwards (row - 1)
  for (const dc of [-1, 1]) { const rr = r + dr, cc = col + dc; if (ok(rr, cc) && B[rr * 8 + cc] === pawn) return true; }
  const kn = c === 'w' ? 'N' : 'n';
  for (const [a, b] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) if (ok(r + a, col + b) && B[(r + a) * 8 + col + b] === kn) return true;
  const kg = c === 'w' ? 'K' : 'k';
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if ((a || b) && ok(r + a, col + b) && B[(r + a) * 8 + col + b] === kg) return true;
  const rook = c === 'w' ? 'RQ' : 'rq', bish = c === 'w' ? 'BQ' : 'bq';
  for (const [a, b, set] of [[-1, 0, rook], [1, 0, rook], [0, -1, rook], [0, 1, rook], [-1, -1, bish], [-1, 1, bish], [1, -1, bish], [1, 1, bish]]) {
    let rr = r + a, cc = col + b;
    while (ok(rr, cc)) { const p = B[rr * 8 + cc]; if (p !== '.') { if (set.includes(p)) return true; break; } rr += a; cc += b; }
  }
  return false;
}
const kingSq = (B, c) => B.indexOf(c === 'w' ? 'K' : 'k');
export const inCheck = (S, c = S.side) => attacked(S.B, kingSq(S.B, c), c === 'w' ? 'b' : 'w');

// pseudo-legal moves {from, to, promo?, ep?, castle?}
function pseudo(S) {
  const B = S.B, me = S.side, out = [];
  const enemy = p => p !== '.' && colorOf(p) !== me;
  for (let i = 0; i < 64; i++) {
    const p = B[i]; if (p === '.' || colorOf(p) !== me) continue;
    const [r, c] = rc(i), t = p.toUpperCase();
    if (t === 'P') {
      const dr = me === 'w' ? -1 : 1, startRow = me === 'w' ? 6 : 1, lastRow = me === 'w' ? 0 : 7;
      const push = (to, extra) => { if ((to >> 3) === lastRow) for (const q of 'qrbn') out.push({ from: i, to, promo: q, ...extra }); else out.push({ from: i, to, ...extra }); };
      if (ok(r + dr, c) && B[(r + dr) * 8 + c] === '.') {
        push((r + dr) * 8 + c);
        if (r === startRow && B[(r + 2 * dr) * 8 + c] === '.') out.push({ from: i, to: (r + 2 * dr) * 8 + c, dbl: true });
      }
      for (const dc of [-1, 1]) {
        if (!ok(r + dr, c + dc)) continue;
        const to = (r + dr) * 8 + c + dc;
        if (enemy(B[to])) push(to);
        else if (to === S.ep) out.push({ from: i, to, ep: true });
      }
    } else if (t === 'N') {
      for (const [a, b] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
        if (!ok(r + a, c + b)) continue; const to = (r + a) * 8 + c + b;
        if (B[to] === '.' || enemy(B[to])) out.push({ from: i, to });
      }
    } else if (t === 'K') {
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        if (!(a || b) || !ok(r + a, c + b)) continue; const to = (r + a) * 8 + c + b;
        if (B[to] === '.' || enemy(B[to])) out.push({ from: i, to });
      }
      // castling: rights, empty squares, king not in / through / into check
      const row = me === 'w' ? 7 : 0, opp = me === 'w' ? 'b' : 'w';
      if (i === row * 8 + 4 && !attacked(B, i, opp)) {
        const k = me === 'w' ? 'K' : 'k', q = me === 'w' ? 'Q' : 'q';
        if (S.castle.includes(k) && B[row * 8 + 5] === '.' && B[row * 8 + 6] === '.' && !attacked(B, row * 8 + 5, opp) && !attacked(B, row * 8 + 6, opp))
          out.push({ from: i, to: row * 8 + 6, castle: 'k' });
        if (S.castle.includes(q) && B[row * 8 + 3] === '.' && B[row * 8 + 2] === '.' && B[row * 8 + 1] === '.' && !attacked(B, row * 8 + 3, opp) && !attacked(B, row * 8 + 2, opp))
          out.push({ from: i, to: row * 8 + 2, castle: 'q' });
      }
    } else {
      const dirs = t === 'R' ? [[-1, 0], [1, 0], [0, -1], [0, 1]] : t === 'B' ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
        : [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [a, b] of dirs) {
        let rr = r + a, cc = c + b;
        while (ok(rr, cc)) { const to = rr * 8 + cc; if (B[to] === '.') out.push({ from: i, to }); else { if (enemy(B[to])) out.push({ from: i, to }); break; } rr += a; cc += b; }
      }
    }
  }
  return out;
}

// apply a move to a plain state {B, side, castle, ep, half, full}; returns the captured piece
function make(S, m) {
  const B = S.B, p = B[m.from], me = S.side;
  let cap = B[m.to];
  if (m.ep) { const capSq = m.to + (me === 'w' ? 8 : -8); cap = B[capSq]; B[capSq] = '.'; }
  B[m.to] = m.promo ? (me === 'w' ? m.promo.toUpperCase() : m.promo) : p;
  B[m.from] = '.';
  if (m.castle) {
    const row = me === 'w' ? 7 : 0;
    if (m.castle === 'k') { B[row * 8 + 5] = B[row * 8 + 7]; B[row * 8 + 7] = '.'; }
    else { B[row * 8 + 3] = B[row * 8 + 0]; B[row * 8 + 0] = '.'; }
  }
  // castling rights: a king or rook moved, or a rook was captured on its corner
  const drop = sq => ({ 63: 'K', 56: 'Q', 7: 'k', 0: 'q' }[sq]);
  if (p === 'K') S.castle = S.castle.replace(/[KQ]/g, '');
  if (p === 'k') S.castle = S.castle.replace(/[kq]/g, '');
  for (const sq of [m.from, m.to]) { const d = drop(sq); if (d) S.castle = S.castle.replace(d, ''); }
  S.ep = m.dbl ? (m.from + m.to) / 2 : -1;
  S.half = p.toUpperCase() === 'P' || cap !== '.' ? 0 : S.half + 1;
  if (me === 'b') S.full++;
  S.side = me === 'w' ? 'b' : 'w';
  return cap === '.' ? null : cap;
}
const clone = S => ({ B: S.B.slice(), side: S.side, castle: S.castle, ep: S.ep, half: S.half, full: S.full });

export function legalMoves(S) {
  const me = S.side, out = [];
  for (const m of pseudo(S)) { const n = clone(S); make(n, m); if (!attacked(n.B, kingSq(n.B, me), n.side)) out.push(m); }
  return out;
}

function insufficient(B) {
  const pcs = B.filter(p => p !== '.' && p.toUpperCase() !== 'K');
  if (!pcs.length) return true;
  return pcs.length === 1 && 'NBnb'.includes(pcs[0]);
}

export function act(G, seat, m) {
  if (!G || G.over || !m) return false;
  if (m.t === 'resign') {
    if (seat !== 0 && seat !== 1) return false;
    G.over = true; G.winner = 1 - seat; G.why = 'resign'; G.ev = { kind: 'end', why: 'resign', seat };
    return true;
  }
  if (m.t !== 'move' || seat !== seatOf(G, G.side)) return false;
  const mv = legalMoves(G).find(x => x.from === m.from && x.to === m.to && (!x.promo || x.promo === (m.promo || 'q')));
  if (!mv) return false;
  const piece = G.B[m.from], color = G.side;
  const cap = make(G, mv);
  if (cap) G.captured[color].push(cap);
  G.last = { from: mv.from, to: mv.to, piece, cap: !!cap, castle: mv.castle || null, promo: mv.promo || null };
  const k = key(G);
  G.rep[k] = (G.rep[k] || 0) + 1;
  const check = inCheck(G);
  const moves = legalMoves(G);
  G.ev = { kind: cap ? 'capture' : 'move', check, seat };
  if (!moves.length) {
    G.over = true;
    if (check) { G.winner = seat; G.why = 'mate'; } else { G.winner = -1; G.why = 'stalemate'; }
    G.ev = { kind: 'end', why: G.why, seat };
  } else if (G.half >= 100 || G.rep[k] >= 3 || insufficient(G.B)) {
    G.over = true; G.winner = -1; G.why = G.half >= 100 ? 'fifty' : G.rep[k] >= 3 ? 'repeat' : 'material';
    G.ev = { kind: 'end', why: G.why };
  }
  return true;
}

export const pendingAdvance = () => false;
export function advance() {}

export function view(G, seat) {
  return {
    game: 'chess', seat, num: G.num, over: G.over, winner: G.winner, why: G.why, ev: G.ev,
    players: G.players.map(p => ({ name: p.name, bot: p.bot })),
    B: G.B.slice(), side: G.side, white: G.white, turn: seatOf(G, G.side), last: G.last,
    check: !G.over && inCheck(G), captured: { w: G.captured.w.slice(), b: G.captured.b.slice() },
    moves: !G.over && seat === seatOf(G, G.side) ? legalMoves(G).map(m => ({ from: m.from, to: m.to, promo: m.promo })) : [],
    full: G.full,
  };
}
export function waiting(G) { return G.over ? [] : [seatOf(G, G.side)]; }

// ---------- bot ----------
const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
// piece-square bonuses from white's point of view (row 0 = rank 8)
const PST = {
  P: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  N: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  B: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  R: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  Q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  K: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};
function evaluate(B) {   // from white's point of view
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const p = B[i]; if (p === '.') continue;
    const t = p.toUpperCase();
    if (isW(p)) s += VAL[t] + PST[t][i]; else s -= VAL[t] + PST[t][(7 - (i >> 3)) * 8 + (i & 7)];
  }
  return s;
}
function order(S, ms) {
  const v = m => { const c = S.B[m.to]; return (c !== '.' ? 10 * VAL[c.toUpperCase()] - VAL[S.B[m.from].toUpperCase()] / 10 : 0) + (m.promo === 'q' ? 800 : 0); };
  return ms.sort((a, b) => v(b) - v(a));
}
let nodes = 0;
function search(S, depth, alpha, beta) {
  nodes++;
  const ms = legalMoves(S);
  if (!ms.length) return inCheck(S) ? -100000 - depth : 0;
  if (depth <= 0) return quiesce(S, alpha, beta, 4);
  for (const m of order(S, ms)) {
    const n = clone(S); make(n, m);
    const v = -search(n, depth - 1, -beta, -alpha);
    if (v > alpha) alpha = v;
    if (alpha >= beta || nodes > 60000) break;
  }
  return alpha;
}
// captures only, so the bot does not stop in the middle of an exchange
function quiesce(S, alpha, beta, d) {
  const stand = (S.side === 'w' ? 1 : -1) * evaluate(S.B);
  if (stand >= beta || d === 0) return stand;
  if (stand > alpha) alpha = stand;
  const caps = order(S, legalMoves(S).filter(m => S.B[m.to] !== '.' || m.ep));
  for (const m of caps) {
    const n = clone(S); make(n, m);
    const v = -quiesce(n, -beta, -alpha, d - 1);
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return alpha;
}
export function botAction(G, seat) {
  if (G.over || seat !== seatOf(G, G.side)) return null;
  const S = clone(G);
  const ms = order(S, legalMoves(S));
  if (!ms.length) return null;
  const depth = G.level === 'easy' ? 1 : G.level === 'hard' ? 3 : 2;
  const noise = G.level === 'easy' ? 120 : G.level === 'hard' ? 4 : 15;
  nodes = 0;
  let best = -Infinity, pick = ms[0];
  for (const m of ms) {
    const n = clone(S); make(n, m);
    // avoid repeating a position (draw) unless losing
    const rep = G.rep[key(n)] || 0;
    const v = -search(n, depth - 1, -Infinity, Infinity) + Math.random() * noise - rep * 30;
    if (v > best) { best = v; pick = m; }
  }
  return { t: 'move', from: pick.from, to: pick.to, promo: pick.promo };
}
