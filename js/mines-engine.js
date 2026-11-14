// Сапер: відкрийте всі клітинки без мін. Число — скільки мін поруч (з 8 сусідніх клітинок).
// Перший хід завжди безпечний (міни розставляються після нього, не поруч). Прапорець — «тут міна».
// Торкання відкритого числа, навколо якого вже стоять усі прапорці, відкриває решту сусідів.
// Pure JS (page; online it is not offered).
export const delay = { bot: 0, advance: 0 };
export const SIZES = {
  easy: { label: 'Легкий', w: 9, h: 9, mines: 10 },
  medium: { label: 'Середній', w: 12, h: 16, mines: 30 },
  hard: { label: 'Складний', w: 14, h: 22, mines: 60 },
};
export const sizeOf = cfg => (cfg && SIZES[cfg.size] ? cfg.size : 'easy');

function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }

export function create(cfg, players) {
  const size = sizeOf(cfg), S = SIZES[size];
  return {
    game: 'mines', num: 1, size, w: S.w, h: S.h, mines: S.mines,
    players: players.slice(0, 1).map(p => ({ name: p.name, bot: false })),
    mine: null, open: Array(S.w * S.h).fill(false), flag: Array(S.w * S.h).fill(false),
    started: 0, ended: 0, opened: 0, boom: -1, over: false, won: false, winner: null, ev: null,
  };
}
export const neighbours = (G, i) => {
  const x = i % G.w, y = (i / G.w) | 0, out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && nx < G.w && ny >= 0 && ny < G.h) out.push(ny * G.w + nx);
  }
  return out;
};
const count = (G, i) => neighbours(G, i).filter(j => G.mine[j]).length;

function plant(G, first) {
  const safe = new Set([first, ...neighbours(G, first)]);
  const cells = [];
  for (let i = 0; i < G.w * G.h; i++) if (!safe.has(i)) cells.push(i);
  G.mine = Array(G.w * G.h).fill(false);
  for (let k = 0; k < G.mines && cells.length; k++) { const j = rnd(cells.length); G.mine[cells[j]] = true; cells.splice(j, 1); }
  G.started = Date.now();
}
// opens a cell; empty ones (0) open their neighbours too
function reveal(G, i) {
  const stack = [i];
  while (stack.length) {
    const c = stack.pop();
    if (G.open[c] || G.flag[c]) continue;
    G.open[c] = true; G.opened++;
    if (G.mine[c]) { G.boom = c; return false; }
    if (!count(G, c)) for (const n of neighbours(G, c)) if (!G.open[n]) stack.push(n);
  }
  return true;
}
function finish(G, won) {
  G.over = true; G.won = won; G.winner = won ? 0 : -2; G.ended = Date.now();
  G.ev = { kind: won ? 'win' : 'boom' };
}

export function act(G, seat, m) {
  if (!G || G.over || seat !== 0 || !m || !(m.i >= 0 && m.i < G.w * G.h)) return false;
  const i = m.i;
  if (m.t === 'flag') {
    if (G.open[i]) return false;
    G.flag[i] = !G.flag[i];
    G.ev = { kind: 'flag' };
    return true;
  }
  if (m.t !== 'open') return false;
  if (!G.mine) plant(G, i);
  let ok = true;
  if (G.open[i]) {
    // an opened number with all its flags placed: open the other neighbours
    const ns = neighbours(G, i), flags = ns.filter(n => G.flag[n]).length;
    if (!count(G, i) || flags !== count(G, i)) return false;
    for (const n of ns) if (!G.open[n] && !G.flag[n]) { ok = reveal(G, n) && ok; if (!ok) break; }
  } else {
    if (G.flag[i]) return false;
    ok = reveal(G, i);
  }
  G.ev = { kind: 'open' };
  if (!ok) finish(G, false);
  else if (G.opened === G.w * G.h - G.mines) finish(G, true);
  return true;
}
export const pendingAdvance = () => false;
export function advance() {}
export function view(G, seat) {
  return {
    game: 'mines', seat, num: G.num, over: G.over, won: G.won, winner: G.winner, ev: G.ev, turn: 0,
    players: G.players, size: G.size, w: G.w, h: G.h, mines: G.mines, started: G.started, ended: G.ended,
    flags: G.flag.filter(Boolean).length, boom: G.boom,
    // what the player can see: -1 hidden, -2 flag, -3 mine (after the end), 0..8 numbers
    cells: G.open.map((o, i) => (o ? (G.mine && G.mine[i] ? -3 : count(G, i)) : G.over && G.mine && G.mine[i] ? (G.flag[i] ? -2 : -3) : G.flag[i] ? -2 : -1)),
    wrongFlags: G.over ? G.flag.map((f, i) => f && !(G.mine && G.mine[i])) : null,
  };
}
export function waiting(G) { return G.over ? [] : [0]; }
export function botAction() { return null; }
