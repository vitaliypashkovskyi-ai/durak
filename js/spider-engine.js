// Павук: пасьянс для одного, дві колоди (104 карти), 10 стовпчиків. Будь-яку відкриту карту можна покласти
// на старшу на одиницю (масть не важлива), але переносити разом можна лише ряд однієї масті за спаданням.
// Зібраний ряд від короля до туза однієї масті прибирається сам. З колоди — по одній карті в кожен
// стовпчик (якщо немає порожніх). Перемога — 8 зібраних рядів. Режими: 1 масть, 2 масті, 4 масті.
// Pure JS (page; online it is not offered).
export const delay = { bot: 0, advance: 0 };
export const LABELS = ['Т', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'В', 'Д', 'К'];
export const SUITS = ['♠', '♥', '♦', '♣'];
export const red = c => c.s === 1 || c.s === 2;
export const MODES = { 1: '1 масть (легко)', 2: '2 масті', 4: '4 масті (складно)' };
export const suitsOf = cfg => (cfg && [1, 2, 4].includes(Number(cfg.suits)) ? Number(cfg.suits) : 1);

function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }

export function create(cfg, players) {
  const suits = suitsOf(cfg), use = [[0], [0, 1], [0, 1, 2, 3]][[1, 2, 4].indexOf(suits)];
  const deck = [];
  let id = 0;
  for (let k = 0; k < 8; k++) { const s = use[k % use.length]; for (let r = 0; r < 13; r++) deck.push({ s, r, id: id++, up: false }); }
  for (let i = deck.length - 1; i > 0; i--) { const j = rnd(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const tab = [];
  for (let c = 0; c < 10; c++) { const col = deck.splice(0, c < 4 ? 6 : 5); col[col.length - 1].up = true; tab.push(col); }
  return {
    game: 'spider', num: 1, suits, players: players.slice(0, 1).map(p => ({ name: p.name, bot: false })),
    tab, stock: deck, done: 0, moves: 0, started: Date.now(), ended: 0, over: false, won: false, winner: null, ev: null,
  };
}
const top = a => a[a.length - 1];
// can the cards from index k down be carried together? (open, same suit, each one lower)
export function movable(col, k) {
  if (k < 0 || k >= col.length || !col[k].up) return false;
  for (let i = k; i < col.length - 1; i++) if (col[i + 1].s !== col[i].s || col[i + 1].r !== col[i].r - 1) return false;
  return true;
}
export function canDrop(G, card, to) { const col = G.tab[to]; return !col.length || top(col).r === card.r + 1; }
export function targets(G, from, k) {
  const col = G.tab[from];
  if (!col || !movable(col, k)) return [];
  const out = [];
  for (let t = 0; t < 10; t++) if (t !== from && canDrop(G, col[k], t)) out.push(t);
  // prefer a column whose top has the same suit, then a non-empty one, then an empty one
  return out.sort((a, b) => score(G, col[k], b) - score(G, col[k], a));
}
const score = (G, card, t) => { const c = G.tab[t]; return !c.length ? 0 : top(c).s === card.s ? 2 : 1; };

function collect(G, t) {
  // a full K..A run of one suit on top of a column goes away
  const col = G.tab[t];
  if (col.length < 13) return false;
  const k = col.length - 13;
  if (col[k].r !== 12 || !movable(col, k)) return false;
  col.splice(k); G.done++;
  if (col.length && !top(col).up) top(col).up = true;
  return true;
}

export function act(G, seat, m) {
  if (!G || G.over || seat !== 0 || !m) return false;
  if (m.t === 'giveup') { G.over = true; G.winner = -2; G.ended = Date.now(); G.ev = { kind: 'end' }; return true; }
  if (m.t === 'deal') {
    if (!G.stock.length || G.tab.some(c => !c.length)) return false;
    for (let t = 0; t < 10; t++) { const c = G.stock.pop(); c.up = true; G.tab[t].push(c); }
    G.moves++; G.ev = { kind: 'deal' };
    let got = false; for (let t = 0; t < 10; t++) got = collect(G, t) || got;
    if (got) G.ev = { kind: 'collect' };
  } else if (m.t === 'move') {
    const col = G.tab[m.from];
    if (!col || !movable(col, m.k) || !(m.to >= 0 && m.to < 10) || m.to === m.from || !canDrop(G, col[m.k], m.to)) return false;
    const cards = col.splice(m.k);
    if (col.length && !top(col).up) top(col).up = true;
    G.tab[m.to].push(...cards);
    G.moves++; G.ev = { kind: 'move' };
    if (collect(G, m.to)) G.ev = { kind: 'collect' };
  } else return false;
  if (G.done === 8) { G.over = true; G.won = true; G.winner = 0; G.ended = Date.now(); G.ev = { kind: 'end' }; }
  return true;
}
// a useful move for the hint button
export function hint(G) {
  let best = null, bs = -1;
  for (let f = 0; f < 10; f++) {
    const col = G.tab[f];
    for (let k = 0; k < col.length; k++) {
      if (!movable(col, k)) continue;
      for (const t of targets(G, f, k)) {
        const sc = score(G, col[k], t) * 10 + (k > 0 && !col[k - 1].up ? 5 : 0) + (k === 0 ? -8 : 0) + (k > 0 && col[k - 1].r === col[k].r + 1 && col[k - 1].s === col[k].s ? -20 : 0);
        if (G.tab[t].length || k > 0) if (sc > bs) { bs = sc; best = { t: 'move', from: f, k, to: t }; }
      }
      break;   // only the longest movable run from each column
    }
  }
  if (best && bs > 0) return best;
  if ((Array.isArray(G.stock) ? G.stock.length : G.stock) && !G.tab.some(c => !c.length)) return { t: 'deal' };
  return best;
}
export const pendingAdvance = () => false;
export function advance() {}
export function view(G, seat) {
  return {
    game: 'spider', seat, num: G.num, over: G.over, won: G.won, winner: G.winner, ev: G.ev, turn: 0, players: G.players,
    suits: G.suits, tab: G.tab.map(col => col.map(c => (c.up ? c : { up: false }))), stock: G.stock.length,
    done: G.done, moves: G.moves, started: G.started, ended: G.ended,
  };
}
export function waiting(G) { return G.over ? [] : [0]; }
export function botAction() { return null; }
