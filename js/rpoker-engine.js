// Розписний покер: 2–8 гравців, замовлення взяток. Колода 36 (джокер — 7♠) або 54 (два джокери).
// Роздачі: 1, 2 … до максимуму, (у повній грі — ще по колу на максимумі), назад до 1; у повній грі
// далі особливі раунди по колу: темна (замовлення наосліп), безкозирка, золота (×2), мізер.
// Роздавач замовляє останнім і не може зробити суму замовлень рівною кількості карт.
// Масть треба підтримати, інакше бити козирем, інакше будь-яка. Джокер можна покласти будь-коли:
// першим — «забираю» або «по старших [масть]», не першим — «забираю» або «скидаю».
// Очки: точно — 10 за взятку (0 із 0 — 5), зайві — +1 за кожну, недобір — −10 за кожну;
// золота ×2; мізер: −10 за взятку, жодної — +50. Pure JS (page + server).

export const LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'В', 'Д', 'К', 'Т'];
export const SUITS = ['♠', '♣', '♥', '♦'];
export const DECKS = { 36: { max: 6, label: '36 карт' }, 54: { max: 8, label: '54 карти' } };
export const deckOf = cfg => (cfg && Number(cfg.deck) === 54 ? 54 : 36);
export const fullGame = cfg => !(cfg && cfg.length === 'short');
export const TYPES = {
  normal: { name: 'Звичайна', icon: '' }, dark: { name: 'Темна', icon: '🌑' }, notrump: { name: 'Безкозирка', icon: '🚫' },
  golden: { name: 'Золота', icon: '💰' }, mizer: { name: 'Мізер', icon: '❄️' },
};
const CAP = 10;   // at most 10 cards per player, so a deal stays short
export const delay = { bot: 800, advance: 0 };

function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function makeDeck(size) {
  const d = [];
  const from = size === 36 ? 4 : 0;
  for (let s = 0; s < 4; s++) for (let r = from; r < 13; r++) d.push({ s, r, id: s * 13 + r });
  if (size === 36) { const seven = d.find(c => c.s === 0 && c.r === 5); seven.joker = true; }   // 7♠ is the joker
  else d.push({ s: 4, r: 13, id: 52, joker: true }, { s: 4, r: 13, id: 53, joker: true });
  return d;
}

export function buildRounds(n, size, full) {
  const M = Math.min(CAP, Math.floor(size / n));
  const R = [];
  for (let k = 1; k <= M; k++) R.push({ k, type: 'normal' });
  if (full) for (let i = 1; i < n; i++) R.push({ k: M, type: 'normal' });
  for (let k = M - 1; k >= 1; k--) R.push({ k, type: 'normal' });
  if (full) for (const t of ['dark', 'notrump', 'golden', 'mizer']) for (let i = 0; i < n; i++) R.push({ k: M, type: t });
  return R;
}

// ---------- rules (state G or a player's view V) ----------
const handOf = (S, seat) => (S.hands ? S.hands[seat] : S.hand);
export function canBid(S, seat, v) {
  if (S.phase !== 'bid' || S.turn !== seat || S.over) return false;
  if (!Number.isInteger(v) || v < 0 || v > S.k) return false;
  if (seat === S.dealer) {
    const sum = S.bids.reduce((t, b, i) => t + (i !== seat && b != null ? b : 0), 0);
    if (sum + v === S.k) return false;
  }
  return true;
}
export function legal(S, seat, c) {
  if (S.phase !== 'play' || S.turn !== seat || S.over || S.waitUntil || S.trick.length >= S.players.length) return false;
  if (!S.trick.length || c.joker) return true;
  const hand = handOf(S, seat).filter(x => !x.joker);
  const lead = S.trick[0];
  const trumpOk = () => (S.trump != null && hand.some(x => x.s === S.trump) ? c.s === S.trump : true);
  if (lead.c.joker) {
    if (lead.mode !== 'high') return true;
    const own = hand.filter(x => x.s === lead.suit);
    if (own.length) return c.s === lead.suit && c.r === Math.max(...own.map(x => x.r));   // the highest of that suit
    return trumpOk();
  }
  if (hand.some(x => x.s === lead.c.s)) return c.s === lead.c.s;
  return trumpOk();
}
export function trickWinner(trick, trump) {
  const jokers = trick.filter(x => x.c.joker && x.mode !== 'drop');
  if (jokers.length) return jokers[jokers.length - 1].seat;
  const cards = trick.filter(x => !x.c.joker);
  let best = cards[0];
  for (const x of cards.slice(1)) {
    const c = x.c, b = best.c;
    if (trump != null && c.s === trump && b.s !== trump) best = x;
    else if (c.s === b.s && c.r > b.r) best = x;
  }
  return best.seat;
}

export function create(cfg, players) {
  const n = players.length, size = deckOf(cfg);
  const G = {
    game: 'rpoker', num: 1, size, full: fullGame(cfg),
    players: players.map(p => ({ name: p.name, bot: !!p.bot })),
    rounds: buildRounds(n, size, fullGame(cfg)), round: -1,
    scores: players.map(() => 0), dealer: rnd(n),
    over: false, winners: null, ev: null, waitUntil: null,
  };
  startDeal(G);
  return G;
}

function startDeal(G) {
  const n = G.players.length;
  G.round++;
  if (G.round > 0) G.dealer = (G.dealer + 1) % n;
  const { k, type } = G.rounds[G.round];
  G.k = k; G.type = type;
  const deck = shuffle(makeDeck(G.size));
  G.hands = G.players.map(() => []);
  for (let j = 0; j < k; j++) for (let s = 1; s <= n; s++) G.hands[(G.dealer + s) % n].push(deck.pop());
  // trump: the next card of the deck, or the dealer's last card when everything was dealt
  G.trumpCard = deck.length ? deck[deck.length - 1] : G.hands[G.dealer][G.hands[G.dealer].length - 1];
  G.trump = type === 'notrump' || G.trumpCard.joker ? null : G.trumpCard.s;
  if (type === 'notrump') G.trumpCard = null;
  G.bids = G.players.map(() => null);
  G.taken = G.players.map(() => 0);
  G.trick = []; G.lastTrick = null; G.result = null; G.waitUntil = null;
  G.turn = (G.dealer + 1) % n;
  G.phase = type === 'mizer' ? 'play' : 'bid';
  G.ev = { kind: 'deal' };
}

export function act(G, seat, m) {
  if (!G || G.over || !m || !(seat >= 0 && seat < G.players.length) || G.waitUntil) return false;
  const n = G.players.length;
  if (G.phase === 'bid') {
    if (m.t !== 'bid' || !canBid(G, seat, m.v)) return false;
    G.bids[seat] = m.v;
    if (G.bids.every(b => b != null)) { G.phase = 'play'; G.turn = (G.dealer + 1) % n; G.ev = { kind: 'bids' }; }
    else G.turn = (seat + 1) % n;
    return true;
  }
  if (G.phase !== 'play' || m.t !== 'play') return false;
  const hand = G.hands[seat];
  const c = hand.find(x => x.id === m.id);
  if (!c || !legal(G, seat, c)) return false;
  const x = { seat, c };
  if (c.joker) {
    const first = !G.trick.length;
    if (first && m.mode === 'high' && m.suit >= 0 && m.suit < 4) { x.mode = 'high'; x.suit = m.suit; }
    else if (!first && m.mode === 'drop') x.mode = 'drop';
    else x.mode = 'take';
  }
  hand.splice(hand.indexOf(c), 1);
  G.trick.push(x);
  G.turn = (seat + 1) % n;
  if (G.trick.length === n) G.waitUntil = Date.now() + 1300;
  return true;
}

export const pendingAdvance = G => !G.over && G.waitUntil != null;
export const advanceIn = G => (G.waitUntil || 0) - Date.now();
export function advance(G) {
  if (G.over || G.waitUntil == null) return;
  G.waitUntil = null;
  if (G.phase === 'score') {
    if (G.round + 1 >= G.rounds.length) return finish(G);
    return startDeal(G);
  }
  const w = trickWinner(G.trick, G.trump);
  G.taken[w]++;
  G.lastTrick = G.trick;
  G.trick = [];
  G.turn = w;
  G.ev = { kind: 'trick', who: w };
  if (G.hands.every(h => !h.length)) scoreDeal(G);
}

export function dealPoints(type, bid, took) {
  if (type === 'mizer') return took === 0 ? 50 : -10 * took;
  let p;
  if (took === bid) p = bid === 0 ? 5 : 10 * bid;
  else if (took > bid) p = took - bid;
  else p = -10 * (bid - took);
  return type === 'golden' ? p * 2 : p;
}
function scoreDeal(G) {
  G.result = G.players.map((_, i) => {
    const pts = dealPoints(G.type, G.bids[i] ?? 0, G.taken[i]);
    G.scores[i] += pts;
    return { bid: G.type === 'mizer' ? null : G.bids[i], took: G.taken[i], pts, score: G.scores[i] };
  });
  G.phase = 'score';
  G.ev = { kind: 'score' };
  G.waitUntil = Date.now() + 5000;
}
function finish(G) {
  const best = Math.max(...G.scores);
  G.winners = G.scores.map((s, i) => (s === best ? i : -1)).filter(i => i >= 0);
  G.over = true;
  G.phase = 'over';
}

export function view(G, seat) {
  const dark = G.phase === 'bid' && G.type === 'dark';
  return {
    game: 'rpoker', seat, num: G.num, size: G.size, full: G.full, phase: G.phase, over: G.over, winners: G.winners, ev: G.ev,
    round: G.round, rounds: G.rounds.length, k: G.k, type: G.type, dealer: G.dealer, turn: G.turn,
    hand: dark ? [] : G.hands[seat].slice(), darkCount: dark ? G.hands[seat].length : 0,
    trump: G.trump, trumpCard: G.trumpCard, bids: G.bids.slice(),
    players: G.players.map((p, i) => ({ name: p.name, bot: p.bot, count: G.hands[i].length, bid: G.bids[i], taken: G.taken[i], score: G.scores[i] })),
    trick: G.trick, lastTrick: G.lastTrick, waitUntil: G.waitUntil ? 1 : 0, result: G.result,
    upcoming: G.rounds.slice(G.round + 1, G.round + 4),
  };
}

export function waiting(G) { return G.over || G.waitUntil ? [] : [G.turn]; }

// ---------- bot: tries to take exactly what it bid ----------
function estimate(hand, trump) {
  let e = 0;
  for (const c of hand) {
    if (c.joker) e += 1;
    else if (trump != null && c.s === trump) e += c.r >= 11 ? 0.9 : c.r >= 8 ? 0.5 : 0.25;
    else if (c.r === 12) e += 0.75;
    else if (c.r === 11) e += 0.3;
  }
  return Math.round(e);
}
export function botAction(G, seat) {
  if (G.over || G.waitUntil || G.turn !== seat) return null;
  const n = G.players.length, hand = G.hands[seat];
  if (G.phase === 'bid') {
    // strong cards in hand, pulled towards the average share of tricks (k / n)
    let v = G.type === 'dark' ? Math.round(G.k / n) : Math.min(G.k, Math.round(0.6 * estimate(hand, G.trump) + 0.4 * G.k / n));
    if (!canBid(G, seat, v)) v = v > 0 ? v - 1 : v + 1;
    if (!canBid(G, seat, v)) v = [...Array(G.k + 1).keys()].find(x => canBid(G, seat, x));
    return { t: 'bid', v };
  }
  if (G.phase !== 'play') return null;
  const L = hand.filter(c => legal(G, seat, c));
  if (!L.length) return null;
  const need = G.type === 'mizer' ? -1 : (G.bids[seat] ?? 0) - G.taken[seat];
  const val = c => (c.joker ? 100 : c.r + (G.trump != null && c.s === G.trump ? 20 : 0));
  const asc = [...L].sort((a, b) => val(a) - val(b));
  const plain = asc.filter(c => !c.joker);
  if (!G.trick.length) {
    if (need > 0) {
      const j = L.find(c => c.joker);
      if (j) return { t: 'play', id: j.id, mode: 'take' };
      return { t: 'play', id: (plain[plain.length - 1] || asc[asc.length - 1]).id };
    }
    const low = plain[0] || asc[0];
    return { t: 'play', id: low.id, mode: low.joker ? 'high' : undefined, suit: low.joker ? 0 : undefined };
  }
  const wins = c => trickWinner([...G.trick, { seat, c, mode: c.joker ? 'take' : undefined }], G.trump) === seat;
  if (need > 0) {
    const w = plain.find(wins);
    if (w) return { t: 'play', id: w.id };
    const j = L.find(c => c.joker);
    if (j) return { t: 'play', id: j.id, mode: 'take' };
    return { t: 'play', id: asc[0].id };
  }
  // do not take: dump the highest card that still loses, or drop the joker
  const losing = plain.filter(c => !wins(c));
  if (losing.length) return { t: 'play', id: losing[losing.length - 1].id };
  const j = L.find(c => c.joker);
  if (j) return { t: 'play', id: j.id, mode: 'drop' };
  return { t: 'play', id: asc[0].id };
}
