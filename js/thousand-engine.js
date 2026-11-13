// Тисяча на 3 гравці + бот. Pure JS (page + server).
// 24 карти (9…туз), по 7 у руку, 3 у прикуп. Торг від 100 (крок 5, понад 120 — лише з марьяжем),
// прикуп → по карті суперникам → замовлення. Марьяжі ♠40 ♣60 ♦80 ♥100 (оголошуються автоматично,
// коли ходите королем/дамою з пари й уже маєте взятку). Болт (0 очок) ×3 = −120. Бочка з 880:
// виграти можна лише взявши гру, 3 невдалі роздачі на бочці = −120. Гра до 1000.

// strength order: 9 < В < Д < К < 10 < Т
export const LABELS = ['9', 'В', 'Д', 'К', '10', 'Т'];
export const POINTS = [0, 2, 3, 4, 10, 11];
export const SUITS = ['♠', '♣', '♥', '♦'];
export const MARRIAGE = { 0: 40, 1: 60, 3: 80, 2: 100 };   // ♠ ♣ ♦ ♥
const K = 3, Q = 2;
export const BARREL = 880, GOAL = 1000, MAX_BID = 300;
export const delay = { bot: 800, advance: 0 };

function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export const marriages = hand => [0, 1, 2, 3].filter(s => hand.some(c => c.s === s && c.r === K) && hand.some(c => c.s === s && c.r === Q));
export const marriageSum = hand => marriages(hand).reduce((t, s) => t + MARRIAGE[s], 0);
export const handPoints = hand => hand.reduce((t, c) => t + POINTS[c.r], 0);
export const trickPoints = trick => trick.reduce((t, x) => t + POINTS[x.c.r], 0);
const round5 = x => Math.round(x / 5) * 5;

export function trickWinner(trick, trump) {
  let best = trick[0];
  for (const x of trick.slice(1)) {
    const b = best.c, c = x.c;
    if (c.s === b.s) { if (c.r > b.r) best = x; }
    else if (trump != null && c.s === trump && b.s !== trump) best = x;
  }
  return best.seat;
}

// ---------- rule helpers (state G or a player's view V with V.hand) ----------
export function canBid(S, seat, v) {
  if (S.phase !== 'bid' || S.turn !== seat || S.over) return false;
  if (!(v > S.bid && v % 5 === 0 && v <= MAX_BID)) return false;
  const hand = S.hands ? S.hands[seat] : S.hand;
  return v <= 120 || marriages(hand).length > 0;
}
export function canContract(S, seat, v) {
  if (S.phase !== 'contract' || S.declarer !== seat || S.over) return false;
  if (!(v >= S.bid && v % 5 === 0 && v <= MAX_BID)) return false;
  const hand = S.hands ? S.hands[seat] : S.hand;
  return v <= 120 || v === S.bid || marriages(hand).length > 0;
}
export function legal(S, seat, c) {
  if (S.phase !== 'play' || S.turn !== seat || S.over || S.trick.length >= 3 || S.waitUntil) return false;
  const hand = S.hands ? S.hands[seat] : S.hand;
  if (!S.trick.length) return true;
  const led = S.trick[0].c.s;
  if (hand.some(x => x.s === led)) return c.s === led;
  if (S.trump != null && hand.some(x => x.s === S.trump)) return c.s === S.trump;
  return true;
}
export function canMarry(S, seat, c) {
  if (S.trick.length || (c.r !== K && c.r !== Q)) return false;
  const hand = S.hands ? S.hands[seat] : S.hand;
  const tricks = S.tricks ? S.tricks[seat] : S.players[seat].tricks;
  return tricks > 0 && hand.some(x => x.s === c.s && x.r === (c.r === K ? Q : K));
}

// ---------- game ----------
export function create(cfg, players) {
  const G = {
    game: 'thousand', num: 1,
    players: players.map(p => ({ name: p.name, bot: !!p.bot })),
    scores: [0, 0, 0], bolts: [0, 0, 0], barrel: [0, 0, 0],
    dealer: rnd(3), deal: 0, over: false, winner: null, ev: null, waitUntil: null,
  };
  startDeal(G, true);
  return G;
}

function startDeal(G, first) {
  if (!first) G.dealer = (G.dealer + 1) % 3;
  G.deal++;
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 0; r < 6; r++) deck.push({ s, r, id: s * 6 + r });
  shuffle(deck);
  G.hands = [deck.slice(0, 7), deck.slice(7, 14), deck.slice(14, 21)];
  G.talon = deck.slice(21);
  G.phase = 'bid';
  const firstBidder = (G.dealer + 1) % 3;
  G.bid = 100; G.holder = firstBidder;               // the first player is on 100 by default
  G.passed = [false, false, false];
  G.turn = (firstBidder + 1) % 3;
  G.declarer = null; G.contract = null; G.given = [];
  G.trick = []; G.lastTrick = null; G.trump = null;
  G.taken = [0, 0, 0]; G.tricks = [0, 0, 0]; G.marr = [0, 0, 0];
  G.talonShown = null; G.result = null; G.waitUntil = null;
}

function nextBidder(G, from) {
  for (let k = 1; k <= 3; k++) { const j = (from + k) % 3; if (!G.passed[j]) return j; }
  return from;
}
function endBidding(G) {
  const d = G.holder;
  G.declarer = d;
  G.phase = 'talon';
  G.talonShown = G.talon.slice();
  G.hands[d].push(...G.talon);
  G.talon = [];
  G.turn = d;
  G.ev = { kind: 'talon', who: d, bid: G.bid };
}

export function act(G, seat, m) {
  if (!G || G.over || !m || !(seat >= 0 && seat < 3) || G.waitUntil) return false;
  const hand = G.hands[seat];
  if (G.phase === 'bid') {
    if (seat !== G.turn) return false;
    if (m.t === 'bid') {
      if (!canBid(G, seat, m.v)) return false;
      G.bid = m.v; G.holder = seat;
    } else if (m.t === 'pass') {
      G.passed[seat] = true;
    } else return false;
    if (G.passed.filter(p => !p).length === 1) {
      G.holder = G.passed.findIndex(p => !p);
      endBidding(G);
      return true;
    }
    // the turn goes round the players still bidding; the holder's turn comes only after someone outbids him
    G.turn = nextBidder(G, seat);
    return true;
  }
  if (G.phase === 'talon') {
    if (m.t !== 'give' || seat !== G.declarer) return false;
    const c = hand.find(x => x.id === m.id);
    const to = m.to;
    if (!c || to === seat || !(to >= 0 && to < 3) || G.given.includes(to)) return false;
    hand.splice(hand.indexOf(c), 1);
    G.hands[to].push(c);
    G.given.push(to);
    if (G.given.length === 2) { G.phase = 'contract'; G.talonShown = null; }
    return true;
  }
  if (G.phase === 'contract') {
    if (m.t !== 'contract' || !canContract(G, seat, m.v)) return false;
    G.contract = m.v;
    G.phase = 'play';
    G.turn = G.declarer;
    G.ev = { kind: 'contract', who: seat, v: m.v };
    return true;
  }
  if (G.phase === 'play') {
    if (m.t !== 'play') return false;
    const c = hand.find(x => x.id === m.id);
    if (!c || !legal(G, seat, c)) return false;
    if (canMarry(G, seat, c)) {
      G.trump = c.s;
      G.marr[seat] += MARRIAGE[c.s];
      G.ev = { kind: 'marriage', who: seat, s: c.s, v: MARRIAGE[c.s] };
    }
    hand.splice(hand.indexOf(c), 1);
    G.trick.push({ seat, c });
    G.turn = (seat + 1) % 3;
    if (G.trick.length === 3) G.waitUntil = Date.now() + 1200;   // let everyone see the trick
    return true;
  }
  return false;
}

export const pendingAdvance = G => !G.over && G.waitUntil != null;
export const advanceIn = G => (G.waitUntil || 0) - Date.now();
export function advance(G) {
  if (G.over || G.waitUntil == null) return;
  G.waitUntil = null;
  if (G.phase === 'score') return startDeal(G, false);
  if (G.phase !== 'play' || G.trick.length < 3) return;
  const w = trickWinner(G.trick, G.trump);
  G.taken[w] += trickPoints(G.trick);
  G.tricks[w]++;
  G.lastTrick = G.trick;
  G.trick = [];
  G.turn = w;
  G.ev = { kind: 'trick', who: w };
  if (G.hands.every(h => !h.length)) scoreDeal(G);
}

function scoreDeal(G) {
  const d = G.declarer, res = [];
  for (let i = 0; i < 3; i++) {
    const pts = G.taken[i] + G.marr[i];
    const before = G.scores[i], onBarrel = before >= BARREL;
    let delta, made = null, bolt = false;
    if (i === d) {
      made = pts >= G.contract;
      delta = made ? G.contract : -G.contract;
    } else {
      delta = round5(pts);
      if (onBarrel) delta = 0;   // on the barrel only a won game counts
    }
    if (pts === 0 && i !== d) {
      bolt = true;
      G.bolts[i]++;
      if (G.bolts[i] >= 3) { delta -= 120; G.bolts[i] = 0; }
    }
    let score = before + delta;
    if (score >= GOAL && i === d && made) { G.over = true; G.winner = d; }
    else if (score > BARREL && score < GOAL) score = i === d && made && onBarrel ? score : BARREL;
    else if (score >= GOAL) score = BARREL;
    if (onBarrel && !(i === d && made) && !G.over) {
      G.barrel[i]++;
      if (G.barrel[i] >= 3) { score -= 120; G.barrel[i] = 0; }
    }
    if (score < BARREL) G.barrel[i] = 0;
    G.scores[i] = score;
    res.push({ pts, delta: score - before, score, made, bolt });
  }
  G.result = res;
  G.phase = 'score';
  G.ev = { kind: 'deal' };
  if (!G.over) G.waitUntil = Date.now() + 6000;
}

export function view(G, seat) {
  return {
    game: 'thousand', seat, num: G.num, deal: G.deal, phase: G.phase, over: G.over, winner: G.winner, ev: G.ev,
    hand: G.hands[seat] ? G.hands[seat].slice() : [],
    players: G.players.map((p, i) => ({
      name: p.name, bot: p.bot, count: G.hands[i].length, score: G.scores[i], bolts: G.bolts[i],
      barrel: G.scores[i] >= BARREL ? G.barrel[i] + 1 : 0, passed: G.passed[i], tricks: G.tricks[i], marr: G.marr[i],
    })),
    dealer: G.dealer, turn: G.turn, bid: G.bid, holder: G.holder, declarer: G.declarer, contract: G.contract,
    given: G.given.slice(), talonShown: G.talonShown, trick: G.trick, lastTrick: G.lastTrick, trump: G.trump,
    waitUntil: G.waitUntil ? 1 : 0, result: G.result,
  };
}

export function waiting(G) {
  if (G.over || G.waitUntil) return [];
  return [G.turn];
}

// ---------- bot ----------
// What the bot expects to take: card points it holds (aces and tens mostly win) plus marriages.
function estimate(hand, extra) {
  const strong = hand.filter(c => c.r >= 4).reduce((t, c) => t + POINTS[c.r], 0);   // aces and tens
  return Math.floor((strong * 1.2 + marriageSum(hand) * 0.8 + extra) / 5) * 5;
}
const keepsMarriage = (hand, c) => (c.r === K || c.r === Q) && marriages(hand).includes(c.s);

export function botAction(G, seat) {
  if (G.over || G.waitUntil || G.turn !== seat) return null;
  const hand = G.hands[seat];
  if (G.phase === 'bid') {
    const next = G.bid + 5, est = estimate(hand, 30);
    return next <= est && canBid(G, seat, next) && G.holder !== seat ? { t: 'bid', v: next } : { t: 'pass' };
  }
  if (G.phase === 'talon') {
    const to = [0, 1, 2].find(i => i !== seat && !G.given.includes(i));
    const give = [...hand].sort((a, b) => (keepsMarriage(hand, a) - keepsMarriage(hand, b)) || (POINTS[a.r] - POINTS[b.r]))[0];
    return { t: 'give', id: give.id, to };
  }
  if (G.phase === 'contract') {
    const est = estimate(hand, 0);
    let v = est - 10 > G.bid ? Math.min(est - 10, MAX_BID) : G.bid;
    if (!canContract(G, seat, v)) v = G.bid;
    return { t: 'contract', v };
  }
  if (G.phase === 'play') {
    const L = hand.filter(c => legal(G, seat, c));
    if (!L.length) return null;
    const val = c => POINTS[c.r] + (c.s === G.trump ? 15 : 0);
    if (!G.trick.length) {
      const marry = L.filter(c => c.r === Q && canMarry(G, seat, c)).sort((a, b) => MARRIAGE[b.s] - MARRIAGE[a.s])[0];
      if (marry) return { t: 'play', id: marry.id };
      const ace = L.find(c => c.r === 5 && c.s !== G.trump && !keepsMarriage(hand, c)) || L.find(c => c.r === 5);
      if (ace) return { t: 'play', id: ace.id };
      const low = [...L].sort((a, b) => (keepsMarriage(hand, a) - keepsMarriage(hand, b)) || val(a) - val(b))[0];
      return { t: 'play', id: low.id };
    }
    const wins = L.filter(c => trickWinner([...G.trick, { seat, c }], G.trump) === seat).sort((a, b) => val(a) - val(b));
    const worth = trickPoints(G.trick);
    if (wins.length && (G.trick.length === 2 || worth >= 10 || seat === G.declarer)) return { t: 'play', id: wins[0].id };
    const low = [...L].sort((a, b) => (keepsMarriage(hand, a) - keepsMarriage(hand, b)) || val(a) - val(b))[0];
    return { t: 'play', id: low.id };
  }
  return null;
}
