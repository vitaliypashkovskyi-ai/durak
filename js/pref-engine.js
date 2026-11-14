// Преферанс (спрощений підрахунок): 3 гравці, 32 карти (7…туз), по 10 карт, 2 — прикуп.
// Торг: 6♠ < 6♣ < 6♦ < 6♥ < 6БК < 7♠ … < 8БК < мізер < 9♠ … < 10БК. Хто сказав «пас» — вибуває з торгу.
// Переможець торгу (розігрувач) бере прикуп, скидає 2 карти й оголошує гру не нижчу за свою ставку.
// Масть треба підтримати; немає — бити козирем; немає й козиря — будь-яка карта. БК — без козиря.
// Очки: розігрувач узяв не менше взяток, ніж замовив, — +5×ціна; недобрав k взяток — −5×ціна×k.
// Захисники — +ціна за кожну свою взятку. Ціна: 6 — 2, 7 — 4, 8 — 6, 9 — 8, 10 — 10.
// Мізер (не взяти жодної, без козиря): так — +50, кожна взятка — −50. Розпаси (усі спасували):
// кожна взятка — −5, хто не взяв жодної — +10. Гра на 12 (коротка) або 24 роздачі; перемагає найбільше очок.
import { levelOf, slip, pickAny } from './level.js';

export const LABELS = ['7', '8', '9', '10', 'В', 'Д', 'К', 'Т'];   // r = 0..7
export const SUITS = ['♠', '♣', '♦', '♥'];                          // order for bids
export const delay = { bot: 850, advance: 0 };
export const LENGTHS = { short: { label: 'Коротка', deals: 12 }, full: { label: 'Повна', deals: 24 } };
export const lengthOf = cfg => (cfg && cfg.length === 'full' ? 'full' : 'short');
const PRICE = { 6: 2, 7: 4, 8: 6, 9: 8, 10: 10 };

// bids in order; mizer sits between 8БК and 9♠
export const BIDS = [];
for (let lvl = 6; lvl <= 10; lvl++) {
  if (lvl === 9) BIDS.push({ mizer: true });
  for (let s = 0; s <= 4; s++) BIDS.push({ lvl, s });     // s = 4: без козиря
}
export const bidName = b => (!b ? '' : b.mizer ? 'мізер' : `${b.lvl}${b.s === 4 ? ' БК' : SUITS[b.s]}`);

function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function create(cfg, players) {
  const G = {
    game: 'pref', level: levelOf(cfg), num: 1,
    players: players.map(p => ({ name: p.name, bot: !!p.bot })),
    score: [0, 0, 0], dealer: rnd(3), deal: 0, deals: LENGTHS[lengthOf(cfg)].deals,
    over: false, winners: [], ev: null, waitUntil: null,
  };
  startDeal(G, true);
  return G;
}

function startDeal(G, first) {
  if (!first) G.dealer = (G.dealer + 1) % 3;
  G.deal++;
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 0; r < 8; r++) deck.push({ s, r, id: s * 8 + r });
  shuffle(deck);
  G.hands = [0, 1, 2].map(i => deck.slice(i * 10, i * 10 + 10));
  G.talon = deck.slice(30);
  G.phase = 'bid';
  G.turn = (G.dealer + 1) % 3;
  G.bid = -1;                 // index in BIDS of the highest bid
  G.bids = [null, null, null];  // last word of each: index or 'pass'
  G.declarer = null; G.contract = null; G.trump = null;
  G.trick = []; G.lastTrick = null; G.tricks = [0, 0, 0];
  G.result = null; G.waitUntil = null; G.showTalon = false;
}

const nextIn = (G, i) => { for (let k = 1; k <= 3; k++) { const j = (i + k) % 3; if (G.bids[j] !== 'pass') return j; } return -1; };
export const canBid = (G, seat, b) => G.phase === 'bid' && G.turn === seat && b > G.bid && b < BIDS.length;

export function legal(S, seat, c) {
  if (S.phase !== 'play' || S.turn !== seat || S.trick.length >= 3 || S.waitUntil) return false;
  if (!S.trick.length) return true;
  const hand = S.hands ? S.hands[seat] : S.hand;
  const led = S.trick[0].c.s;
  if (hand.some(x => x.s === led)) return c.s === led;
  if (S.trump != null && hand.some(x => x.s === S.trump)) return c.s === S.trump;
  return true;
}
export function trickWinner(trick, trump) {
  let best = trick[0];
  for (const x of trick.slice(1)) {
    const b = best.c, c = x.c;
    if (c.s === b.s ? c.r > b.r : trump != null && c.s === trump) best = x;
  }
  return best.seat;
}

export function act(G, seat, m) {
  if (!G || G.over || !m || G.waitUntil || G.turn !== seat) return false;
  const hand = G.hands[seat];
  if (G.phase === 'bid') {
    if (m.t === 'pass') G.bids[seat] = 'pass';
    else if (m.t === 'bid' && canBid(G, seat, m.v)) { G.bid = m.v; G.bids[seat] = m.v; }
    else return false;
    G.ev = { kind: 'bid', seat, v: m.t === 'pass' ? null : m.v };
    const active = [0, 1, 2].filter(i => G.bids[i] !== 'pass');
    if (!active.length) return startPlay(G, null), true;                       // all passed: розпаси
    if (active.length === 1 && G.bid >= 0) return takeTalon(G, active[0]), true;
    G.turn = nextIn(G, seat);
    // one left who has not bid yet: he may still bid once, so his turn stays
    return true;
  }
  if (G.phase === 'discard') {
    if (m.t !== 'discard' || !Array.isArray(m.ids) || m.ids.length !== 2 || m.ids[0] === m.ids[1]) return false;
    const cards = m.ids.map(id => hand.find(c => c.id === id));
    if (cards.some(c => !c)) return false;
    for (const c of cards) hand.splice(hand.indexOf(c), 1);
    const b = BIDS[G.bid];
    if (b.mizer) { G.contract = G.bid; return startPlay(G, seat), true; }
    G.phase = 'contract';
    G.ev = { kind: 'discard', seat };
    return true;
  }
  if (G.phase === 'contract') {
    if (m.t !== 'contract' || !(m.v >= G.bid) || !BIDS[m.v] || BIDS[m.v].mizer) return false;
    G.contract = m.v;
    return startPlay(G, seat), true;
  }
  if (G.phase === 'play') {
    if (m.t !== 'play') return false;
    const c = hand.find(x => x.id === m.id);
    if (!c || !legal(G, seat, c)) return false;
    hand.splice(hand.indexOf(c), 1);
    G.trick.push({ seat, c });
    G.turn = (seat + 1) % 3;
    if (G.trick.length === 3) G.waitUntil = Date.now() + 1200;
    G.ev = { kind: 'card' };
    return true;
  }
  return false;
}

function takeTalon(G, seat) {
  G.declarer = seat;
  G.hands[seat].push(...G.talon);
  G.showTalon = true;
  G.phase = 'discard';
  G.turn = seat;
  G.ev = { kind: 'talon', seat };
}
function startPlay(G, declarer) {
  G.phase = 'play';
  G.declarer = declarer;
  const b = declarer == null ? null : BIDS[G.contract];
  G.trump = b && !b.mizer && b.s < 4 ? b.s : null;
  G.turn = (G.dealer + 1) % 3;
  G.showTalon = declarer != null;
  G.ev = { kind: declarer == null ? 'raspas' : 'play', seat: declarer };
}

export const pendingAdvance = G => !G.over && G.waitUntil != null;
export const advanceIn = G => (G.waitUntil || 0) - Date.now();
export function advance(G) {
  if (G.over || G.waitUntil == null) return;
  G.waitUntil = null;
  if (G.phase === 'score') return startDeal(G, false);
  if (G.trick.length < 3) return;
  const w = trickWinner(G.trick, G.trump);
  G.tricks[w]++;
  G.lastTrick = G.trick; G.trick = []; G.turn = w;
  G.ev = { kind: 'trick', who: w };
  if (G.hands.every(h => !h.length)) scoreDeal(G);
}

function scoreDeal(G) {
  const d = G.declarer, gain = [0, 0, 0];
  let note;
  if (d == null) {
    G.tricks.forEach((t, i) => { gain[i] = t ? -5 * t : 10; });
    note = 'Розпаси';
  } else {
    const b = BIDS[G.contract];
    if (b.mizer) {
      gain[d] = G.tricks[d] ? -50 * G.tricks[d] : 50;
      note = G.tricks[d] ? 'Мізер не зіграв' : 'Мізер зіграв!';
    } else {
      const price = PRICE[b.lvl], miss = b.lvl - G.tricks[d];
      gain[d] = miss <= 0 ? 5 * price : -5 * price * miss;
      [0, 1, 2].forEach(i => { if (i !== d) gain[i] = price * G.tricks[i]; });
      note = miss <= 0 ? `Гра ${bidName(b)} зіграна` : `Недобір ${miss}`;
    }
  }
  gain.forEach((g, i) => { G.score[i] += g; });
  G.result = { gain, tricks: G.tricks.slice(), declarer: d, contract: G.contract, note };
  G.phase = 'score';
  G.ev = { kind: 'deal' };
  if (G.deal >= G.deals) {
    G.over = true;
    const top = Math.max(...G.score);
    G.winners = [0, 1, 2].filter(i => G.score[i] === top);
  } else G.waitUntil = Date.now() + 5000;
}

export function view(G, seat) {
  return {
    game: 'pref', seat, num: G.num, phase: G.phase, over: G.over, winners: G.winners, ev: G.ev,
    hand: G.hands[seat] ? G.hands[seat].slice() : [],
    players: G.players.map((p, i) => ({ name: p.name, bot: p.bot, count: G.hands[i].length, score: G.score[i], tricks: G.tricks[i],
      word: G.bids[i] === 'pass' ? 'пас' : G.bids[i] != null ? bidName(BIDS[G.bids[i]]) : null })),
    dealer: G.dealer, deal: G.deal, deals: G.deals, turn: G.turn, bid: G.bid, declarer: G.declarer,
    contract: G.contract, trump: G.trump, trick: G.trick, lastTrick: G.lastTrick,
    talon: G.showTalon && G.phase !== 'play' && G.phase !== 'score' ? G.talon.slice() : null,
    waitUntil: G.waitUntil ? 1 : 0, result: G.result,
  };
}
export function waiting(G) { return G.over || G.waitUntil ? [] : [G.turn]; }

// ---------- bot ----------
// tricks a hand can expect with trump t (0-3, 4 = no trump)
function estimate(hand, t) {
  let e = 0;
  for (let s = 0; s < 4; s++) {
    const cs = hand.filter(c => c.s === s).map(c => c.r).sort((a, b) => b - a);
    if (!cs.length) continue;
    if (cs[0] === 7) e += 1;                                         // ace
    if (cs.includes(6) && cs.length >= 2) e += cs[0] === 7 ? 0.9 : 0.6;   // king
    if (cs.includes(5) && cs.length >= 3) e += 0.4;                   // queen
    if (s === t) e += Math.max(0, cs.length - 3) * 0.9 + (cs.length >= 3 ? 0.3 : 0);   // long trumps
    else if (t !== 4 && t != null && cs.length >= 5) e += 0.5;
  }
  if (t !== 4) e += hand.filter(c => c.s !== t).length <= 6 ? 0.3 : 0;   // short side suits ruff
  return e;
}
const bestTrump = hand => [0, 1, 2, 3, 4].map(t => ({ t, e: estimate(hand, t) - (t === 4 ? 0.6 : 0) })).sort((a, b) => b.e - a.e)[0];
const mizerHand = hand => hand.every(c => c.r <= 4 || (c.r <= 5 && hand.filter(x => x.s === c.s && x.r < c.r).length >= 2)) && hand.filter(c => c.r <= 1).length >= 3;
const bidIndex = (lvl, s) => BIDS.findIndex(b => !b.mizer && b.lvl === lvl && b.s === s);

export function botAction(G, seat) {
  if (G.over || G.waitUntil || G.turn !== seat) return null;
  const hand = G.hands[seat];
  if (G.phase === 'bid') {
    const next = G.bid + 1;
    if (next >= BIDS.length) return { t: 'pass' };
    if (mizerHand(hand) && BIDS[next] && (BIDS[next].mizer || next < BIDS.findIndex(b => b.mizer))) return { t: 'bid', v: BIDS.findIndex(b => b.mizer) };
    const best = bestTrump(hand);
    const tricks = Math.floor(best.e + 2.2 + (slip(G, 0.4) ? 1 : 0));     // the talon helps; an easy bot overbids
    const maxIdx = tricks >= 6 ? bidIndex(Math.min(10, tricks), best.t) : -1;
    return maxIdx >= next && !BIDS[next].mizer ? { t: 'bid', v: next } : { t: 'pass' };
  }
  if (G.phase === 'discard') {
    const b = BIDS[G.bid];
    const t = b.mizer ? null : bestTrump(hand).t;
    // drop the two most useless cards: for mizer the highest, otherwise the lowest of short side suits
    const len = s => hand.filter(c => c.s === s).length;
    const sorted = [...hand].sort((a, b2) => b.mizer ? b2.r - a.r : ((a.s === t) - (b2.s === t)) || (len(a.s) - len(b2.s)) || (a.r - b2.r));
    const drop = sorted.filter(c => b.mizer || c.r < 7).slice(0, 2);
    return { t: 'discard', ids: (drop.length === 2 ? drop : sorted.slice(0, 2)).map(c => c.id) };
  }
  if (G.phase === 'contract') {
    const best = bestTrump(hand), est = Math.floor(best.e + 0.4);
    let v = bidIndex(Math.max(6, Math.min(10, est)), best.t);
    if (!(v >= G.bid) || BIDS[v].mizer) v = G.bid;
    return { t: 'contract', v };
  }
  if (G.phase === 'play') {
    const L = hand.filter(c => legal(G, seat, c));
    if (!L.length) return null;
    if (slip(G)) return { t: 'play', id: pickAny(L).id };
    const raspas = G.declarer == null, mizer = G.declarer != null && BIDS[G.contract].mizer;
    const avoid = raspas || (mizer && seat === G.declarer);
    const asc = [...L].sort((a, b) => (a.r + (a.s === G.trump ? 10 : 0)) - (b.r + (b.s === G.trump ? 10 : 0)));
    const wins = c => trickWinner([...G.trick, { seat, c }], G.trump) === seat;
    if (avoid) {
      const losing = asc.filter(c => !G.trick.length || !wins(c));
      return { t: 'play', id: (losing.length ? losing[losing.length - 1] : asc[0]).id };
    }
    // defenders against a mizer: lead low cards and try to make the declarer win
    if (mizer) return { t: 'play', id: asc[0].id };
    if (!G.trick.length) {
      const ace = L.find(c => c.r === 7 && c.s !== G.trump);
      if (ace) return { t: 'play', id: ace.id };
      const trumps = L.filter(c => c.s === G.trump).sort((a, b) => b.r - a.r);
      if (seat === G.declarer && trumps.length >= 3) return { t: 'play', id: trumps[0].id };
      return { t: 'play', id: asc[0].id };
    }
    // a fellow defender already holds the trick: no need to spend a high card
    const w = trickWinner(G.trick, G.trump);
    if (seat !== G.declarer && w !== G.declarer && G.trick.length === 2) return { t: 'play', id: asc[0].id };
    const win = asc.filter(wins);
    return { t: 'play', id: (win[0] || asc[0]).id };
  }
  return null;
}
