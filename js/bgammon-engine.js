// Короткі нарди (з боєм): 2 гравці, по 15 шашок, ідуть назустріч одне одному. Стартова розстановка:
// 2 шашки на 24-му пункті, 5 — на 13-му, 3 — на 8-му, 5 — на 6-му (рахуючи від свого дому).
// Одинока шашка суперника («блот») — її можна побити: вона йде на бар і має знову ввійти в гру з чужого дому.
// На пункт із 2+ шашками суперника ставати не можна. Поки є шашки на барі — спершу вводите їх.
// Дубль — 4 ходи. Треба зіграти якнайбільше кубиків (якщо лише один — більший). Коли всі 15 у домі (пункти 1–6),
// викидаєте. Перемога — 1, «марс» (суперник не викинув жодної) — 2, «кокс» (до того ж має шашку на барі
// або в домі переможця) — 3. Pure JS (page + server).
import { levelOf, slip, pickAny } from './level.js';

export const delay = { bot: 750, advance: 0 };
const BAR = 25;

function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
const die = () => rnd(6) + 1;

// p = 1..24 along the player's own path (24 = farthest, 1..6 = home), 25 = bar, 0 = borne off.
// absolute point a = seat 0: p; seat 1: 25 - p (so the players move towards each other)
export const absOf = (seat, p) => (seat === 0 ? p : 25 - p);
export const posOf = (seat, a) => (seat === 0 ? a : 25 - a);
const START = [24, 24, 13, 13, 13, 13, 13, 8, 8, 8, 6, 6, 6, 6, 6];

export function create(cfg, players) {
  const G = {
    game: 'bgammon', level: levelOf(cfg), num: 1,
    players: players.map(p => ({ name: p.name, bot: !!p.bot })),
    pos: [START.slice(), START.slice()],
    turn: rnd(2), dice: [], left: [],
    over: false, winner: null, points: 0, ev: null, waitUntil: null, last: null,
  };
  roll(G);
  return G;
}
function roll(G) {
  const a = die(), b = die();
  G.dice = [a, b];
  G.left = a === b ? [a, a, a, a] : [a, b];
  G.last = null;
  G.ev = { kind: 'roll', seat: G.turn, dice: G.dice.slice() };
  if (!steps(G).length) { G.waitUntil = Date.now() + 1800; G.ev.none = true; }
}

// how many checkers of each seat stand on each absolute point (1..24)
function board(S) {
  const pts = Array.from({ length: 25 }, () => [0, 0]);
  for (let s = 0; s < 2; s++) for (const p of S.pos[s]) if (p >= 1 && p <= 24) pts[absOf(s, p)][s]++;
  return pts;
}
const allHome = (S, seat) => S.pos[seat].every(p => p <= 6);

function stepsFor(S, seat, d, pts) {
  const out = [], seen = new Set(), mine = S.pos[seat], opp = 1 - seat;
  const onBar = mine.includes(BAR);
  for (const p of mine) {
    if (p === 0 || seen.has(p) || (onBar && p !== BAR)) continue;
    seen.add(p);
    const to = p - d;
    if (to >= 1) {
      const n = pts[absOf(seat, to)][opp];
      if (n >= 2) continue;
      out.push({ from: p, to, die: d, hit: n === 1 });
    } else {
      if (!allHome(S, seat)) continue;
      if (to < 0 && mine.some(q => q > p && q <= 6)) continue;     // a farther checker must go first
      out.push({ from: p, to: 0, die: d, hit: false });
    }
  }
  return out;
}
const cloneS = S => ({ pos: [S.pos[0].slice(), S.pos[1].slice()], left: S.left.slice() });
function doStep(S, seat, st) {
  const i = S.pos[seat].indexOf(st.from);
  S.pos[seat][i] = st.to;
  if (st.hit) { const opp = 1 - seat, j = S.pos[opp].indexOf(posOf(opp, absOf(seat, st.to))); S.pos[opp][j] = BAR; }
  S.left.splice(S.left.indexOf(st.die), 1);
}

// longest playable sequences (memo per first step so every possible first step is found)
function sequences(S, seat, cap = 3000) {
  let best = 0; const seqs = []; const memo = new Set();
  const walk = (s, path) => {
    const key = (path[0] ? path[0].from + ':' + path[0].die : '') + '|' + s.pos[seat].slice().sort((a, b) => a - b).join(',') + '|' + s.pos[1 - seat].slice().sort((a, b) => a - b).join(',') + '|' + s.left.join(',');
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
  for (const q of pool) { const st = q.path[0], k = st.from + ':' + st.die; if (!seen.has(k)) { seen.add(k); out.push(st); } }
  return out;
}

export function act(G, seat, m) {
  if (!G || G.over || G.waitUntil || seat !== G.turn || !m || m.t !== 'move') return false;
  const st = steps(G).find(s => s.from === m.from && s.die === m.die);
  if (!st) return false;
  doStep(G, seat, st);
  G.last = { seat, from: st.from, to: st.to, hit: st.hit };
  G.ev = { kind: st.hit ? 'hit' : st.to === 0 ? 'off' : 'move', seat };
  if (G.pos[seat].every(p => p === 0)) {
    const opp = 1 - seat, off = G.pos[opp].filter(p => p === 0).length;
    const backgammon = !off && G.pos[opp].some(p => p === BAR || p >= 19);      // a checker on the bar or in the winner's home
    G.over = true; G.winner = seat; G.points = off ? 1 : backgammon ? 3 : 2;
    G.ev = { kind: 'end', seat };
    return true;
  }
  if (!G.left.length || !steps(G).length) nextTurn(G);
  return true;
}
function nextTurn(G) { G.turn = 1 - G.turn; G.num++; roll(G); }

export const pendingAdvance = G => !G.over && G.waitUntil != null;
export const advanceIn = G => (G.waitUntil || 0) - Date.now();
export function advance(G) { if (G.over || G.waitUntil == null) return; G.waitUntil = null; nextTurn(G); }

export function view(G, seat) {
  const pts = board(G);
  return {
    game: 'bgammon', seat, num: G.num, over: G.over, winner: G.winner, points: G.points, ev: G.ev,
    players: G.players.map((p, i) => ({ name: p.name, bot: p.bot, off: G.pos[i].filter(x => x === 0).length,
      bar: G.pos[i].filter(x => x === BAR).length, pips: G.pos[i].reduce((s, x) => s + x, 0) })),
    pts, turn: G.turn, dice: G.dice.slice(), left: G.left.slice(), last: G.last,
    waitUntil: G.waitUntil ? 1 : 0, steps: steps(G),
  };
}
export function waiting(G) { return G.over || G.waitUntil ? [] : [G.turn]; }

// ---------- bot ----------
function evaluate(S, seat) {
  const opp = 1 - seat, pts = board(S);
  const pip = s => S.pos[s].reduce((a, p) => a + p, 0);
  let v = (pip(opp) - pip(seat)) * 1.0;
  v += S.pos[seat].filter(p => p === 0).length * 2;
  v -= S.pos[seat].filter(p => p === BAR).length * 12;
  v += S.pos[opp].filter(p => p === BAR).length * 10;
  for (let a = 1; a <= 24; a++) {
    const mine = pts[a][seat];
    const p = posOf(seat, a);
    if (mine >= 2) v += p <= 6 ? 3 : p <= 11 ? 1.5 : 0.8;          // made points, the home board the most
    if (mine === 1) {
      // a blot: how many opponent checkers can reach it (they move towards lower own positions)
      const q = posOf(opp, a);
      const hunters = S.pos[opp].filter(x => x !== 0 && (x === BAR ? 25 : x) > q && (x === BAR ? 25 : x) - q <= 12).length;
      if (hunters) v -= (p <= 6 ? 4 : 2.5) + Math.min(hunters, 3);
    }
  }
  return v;
}
export function botAction(G, seat) {
  if (G.over || G.waitUntil || G.turn !== seat) return null;
  const legal = steps(G);
  if (!legal.length) return null;
  if (slip(G, 0.45)) { const st = pickAny(legal); return { t: 'move', from: st.from, die: st.die }; }
  const { seqs } = sequences(G, seat);
  let best = -Infinity, pick = null;
  for (const q of seqs) {
    if (!legal.some(st => st.from === q.path[0].from && st.die === q.path[0].die)) continue;
    const v = evaluate(q.state, seat) + Math.random() * (G.level === 'hard' ? 0.05 : 0.4);
    if (v > best) { best = v; pick = q.path[0]; }
  }
  pick = pick || legal[0];
  return { t: 'move', from: pick.from, die: pick.die };
}
