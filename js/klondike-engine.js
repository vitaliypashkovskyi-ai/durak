// Косинка (Klondike): пасьянс для одного гравця. 52 карти: 7 стовпчиків (у кожному відкрита лише верхня),
// колода й скид, 4 «доми» — по мастях від туза до короля. У стовпчиках карти кладуться на одну старшу іншого
// кольору; на порожнє місце — лише король. З колоди — по 1 або по 3 карти. Перемога — усі 52 карти в домах.
// Pure JS (page; online it is not offered).
export const delay = { bot: 0, advance: 0 };
export const LABELS = ['Т', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'В', 'Д', 'К'];   // r = 0..12
export const SUITS = ['♠', '♥', '♦', '♣'];
export const red = c => c.s === 1 || c.s === 2;

function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }

export function create(cfg, players) {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) deck.push({ s, r, id: s * 13 + r, up: false });
  for (let i = deck.length - 1; i > 0; i--) { const j = rnd(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const tab = [];
  for (let k = 0; k < 7; k++) { const col = deck.splice(0, k + 1); col[col.length - 1].up = true; tab.push(col); }
  return {
    game: 'klondike', num: 1, players: players.slice(0, 1).map(p => ({ name: p.name, bot: false })),
    draw3: !!(cfg && cfg.draw === 3), stock: deck, waste: [], found: [[], [], [], []], tab,
    moves: 0, passes: 0, started: Date.now(), over: false, winner: null, won: false, ev: null,
  };
}

const top = a => a[a.length - 1];
export function canFound(G, c, f) {
  const pile = G.found[f];
  return pile.length ? top(pile).s === c.s && top(pile).r === c.r - 1 : c.r === 0;
}
export function canTab(G, c, t) {
  const col = G.tab[t];
  if (!col.length) return c.r === 12;
  const b = top(col);
  return b.up && red(b) !== red(c) && b.r === c.r + 1;
}
// cards picked from a place: {from:'w'} top of waste, {from:'f', i} top of a foundation, {from:'t', i, k} column i from index k
function picked(G, src) {
  if (src.from === 'w') return G.waste.length ? [top(G.waste)] : [];
  if (src.from === 'f') return G.found[src.i] && G.found[src.i].length ? [top(G.found[src.i])] : [];
  if (src.from === 't') { const col = G.tab[src.i]; if (!col || src.k < 0 || src.k >= col.length || !col[src.k].up) return []; return col.slice(src.k); }
  return [];
}
// where can these cards go? [{to:'f'|'t', i}]
export function targets(G, src) {
  const cards = picked(G, src);
  if (!cards.length) return [];
  const out = [];
  if (cards.length === 1 && src.from !== 'f') for (let f = 0; f < 4; f++) if (canFound(G, cards[0], f)) out.push({ to: 'f', i: f });
  for (let t = 0; t < 7; t++) if (!(src.from === 't' && src.i === t) && canTab(G, cards[0], t)) out.push({ to: 't', i: t });
  // only one empty foundation is offered for an ace
  const firstEmpty = out.findIndex(x => x.to === 'f' && !G.found[x.i].length);
  return out.filter((x, k) => !(x.to === 'f' && !G.found[x.i].length && k !== firstEmpty));
}

export function act(G, seat, m) {
  if (!G || G.over || seat !== 0 || !m) return false;
  if (m.t === 'giveup') { G.over = true; G.winner = -2; G.ev = { kind: 'end' }; return true; }
  if (m.t === 'draw') {
    if (!G.stock.length) {
      if (!G.waste.length) return false;
      G.stock = G.waste.reverse().map(c => ({ ...c, up: false })); G.waste = []; G.passes++;
    } else {
      const k = G.draw3 ? Math.min(3, G.stock.length) : 1;
      for (let j = 0; j < k; j++) { const c = G.stock.pop(); c.up = true; G.waste.push(c); }
    }
    G.moves++; G.ev = { kind: 'draw' };
    return true;
  }
  if (m.t !== 'move') return false;
  const src = m.src || {}, dst = m.dst || {};
  if (!targets(G, src).some(x => x.to === dst.to && x.i === dst.i)) return false;
  let cards;
  if (src.from === 'w') cards = [G.waste.pop()];
  else if (src.from === 'f') cards = [G.found[src.i].pop()];
  else { cards = G.tab[src.i].splice(src.k); const col = G.tab[src.i]; if (col.length && !top(col).up) top(col).up = true; }
  if (dst.to === 'f') G.found[dst.i].push(cards[0]); else G.tab[dst.i].push(...cards);
  G.moves++;
  G.ev = { kind: dst.to === 'f' ? 'found' : 'move' };
  if (G.found.every(p => p.length === 13)) { G.over = true; G.won = true; G.winner = 0; G.ev = { kind: 'end' }; }
  return true;
}

// the next useful move (for the hint button and «auto-finish»)
export function hint(G) {
  const srcs = [{ from: 'w' }];
  for (let t = 0; t < 7; t++) { const col = G.tab[t]; const k = col.findIndex(c => c.up); if (k >= 0) { srcs.push({ from: 't', i: t, k: col.length - 1 }); if (k < col.length - 1) srcs.push({ from: 't', i: t, k }); } }
  for (const s of srcs) { const f = targets(G, s).find(x => x.to === 'f'); if (f) return { t: 'move', src: s, dst: f }; }
  for (const s of srcs) {
    if (s.from !== 't') continue;
    const col = G.tab[s.i];
    // moving a whole column is useful when it uncovers a card or frees a king onto an empty spot
    if (s.k === 0 && col[0].r === 12) continue;
    const t = targets(G, s).find(x => x.to === 't');
    if (t && (s.k > 0 || col[0].r !== 12)) return { t: 'move', src: s, dst: t };
  }
  const w = targets(G, { from: 'w' }).find(x => x.to === 't');
  if (w) return { t: 'move', src: { from: 'w' }, dst: w };
  if (nStock(G) || nWaste(G)) return { t: 'draw' };
  return null;
}
const nStock = G => (typeof G.stock === 'number' ? G.stock : G.stock.length);
const nWaste = G => (G.wasteAll != null ? G.wasteAll : G.waste.length);
export const canAutoFinish = G => !nStock(G) && !nWaste(G) && G.tab.every(c => c.every(x => x.up));

export const pendingAdvance = () => false;
export function advance() {}
export function view(G, seat) {
  return {
    game: 'klondike', seat, num: G.num, over: G.over, won: G.won, winner: G.winner, ev: G.ev,
    players: G.players, draw3: G.draw3, stock: G.stock.length, waste: G.waste.slice(-3),
    wasteAll: G.waste.length, found: G.found.map(p => p.slice(-1)), foundN: G.found.map(p => p.length),
    tab: G.tab.map(col => col.map(c => (c.up ? c : { up: false }))), moves: G.moves, started: G.started, turn: 0,
  };
}
export function waiting(G) { return G.over ? [] : [0]; }
export function botAction() { return null; }
