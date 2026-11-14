// Свара: 2–8 гравців, 36 карт, кожному по 3. Джокер «шаха» — 7♣ (стає будь-якою картою).
// Очки руки: сума карт однієї масті (туз 11, К/Д/В/10 — 10, 9…6 за номіналом; шаха — 11 до будь-якої масті),
// два тузи — 22, три однакові — тричі номінал (три тузи 33), три шістки — 34 (найстарша рука).
// Кожен ставить анте 1 фішку, далі торг: пас / підтримати / підняти. Хто лишився сам — забирає банк.
// На відкритті найбільше очок забирає банк; нічия — «свара»: ті, хто зрівнявся, переграють за той самий банк.
// У кожного на старті 50 фішок; без фішок — вибуває. Гра до останнього з фішками або до ліміту роздач
// (коротка 10, повна 20) — тоді перемагає найбагатший. Pure JS (page + server).

export const LABELS = ['6', '7', '8', '9', '10', 'В', 'Д', 'К', 'Т'];   // index = r
export const SUITS = ['♠', '♣', '♥', '♦'];
const VALUE = [6, 7, 8, 9, 10, 10, 10, 10, 11];
export const START = 50, ANTE = 1;
export const RAISES = [1, 2, 5, 10];
export const LENGTHS = { short: { label: 'Коротка', hands: 10 }, full: { label: 'Повна', hands: 20 } };
export const lengthOf = cfg => (cfg && cfg.length === 'full' ? 'full' : 'short');
export const delay = { bot: 900, advance: 0 };

function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export const isJoker = c => c.s === 1 && c.r === 1;                     // 7♣
export const value = c => VALUE[c.r];

// Best score of 3 cards.
export function score(cards) {
  const joker = cards.some(isJoker);
  const rest = cards.filter(c => !isJoker(c));
  let best = 0;
  // same suit (the joker joins the best suit as 11)
  const sums = [0, 0, 0, 0];
  for (const c of rest) sums[c.s] += value(c);
  best = Math.max(...sums) + (joker ? 11 : 0);
  if (!rest.length) best = 11;
  // two aces (or ace + joker)
  const aces = rest.filter(c => c.r === 8).length + (joker ? 1 : 0);
  if (aces >= 2) best = Math.max(best, 22);
  // three of a kind (the joker completes a pair)
  if (rest.length + (joker ? 1 : 0) === 3 && rest.every(c => c.r === rest[0].r)) {
    const r = rest[0].r;
    best = Math.max(best, r === 0 ? 34 : VALUE[r] * 3);
  }
  return best;
}

export function create(cfg, players) {
  const G = {
    game: 'svara', num: 1,
    players: players.map(p => ({ name: p.name, bot: !!p.bot })),
    chips: players.map(() => START),
    hands: players.map(() => []),
    length: lengthOf(cfg), maxHands: LENGTHS[lengthOf(cfg)].hands,
    dealer: rnd(players.length), handNo: 0,
    pot: 0, over: false, winners: [], ev: null, waitUntil: null,
  };
  startHand(G, null);
  return G;
}

const alive = G => G.players.map((_, i) => i).filter(i => G.chips[i] > 0);
const nextFrom = (G, i, ok) => { const n = G.players.length; for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (ok(j)) return j; } return -1; };

// svara = list of tied seats replaying for the same pot (no new ante)
function startHand(G, svara) {
  const n = G.players.length;
  if (!svara) {
    G.handNo++;
    G.dealer = nextFrom(G, G.dealer, i => G.chips[i] > 0);
    G.pot = 0;
  }
  const seats = svara || alive(G);
  G.inHand = Array.from({ length: n }, (_, i) => seats.includes(i));
  G.folded = Array(n).fill(false);
  G.bet = Array(n).fill(0);
  if (!svara) for (const i of seats) { const a = Math.min(ANTE, G.chips[i]); G.chips[i] -= a; G.pot += a; }
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 0; r < 9; r++) deck.push({ s, r, id: s * 9 + r });
  shuffle(deck);
  G.hands = Array.from({ length: n }, (_, i) => (G.inHand[i] ? deck.splice(0, 3) : []));
  G.cur = 0;
  G.cap = Math.min(...seats.map(i => G.chips[i]));     // nobody can be asked for more than the poorest has: no side pots
  G.acted = Array(n).fill(false);
  G.svara = !!svara;
  G.phase = 'bet';
  G.turn = nextFrom(G, G.dealer, i => G.inHand[i]);
  G.result = null; G.waitUntil = null;
  G.lastMove = null;
}

const active = G => G.players.map((_, i) => i).filter(i => G.inHand[i] && !G.folded[i]);
export const toCall = (G, seat) => (G.cur || 0) - (G.bet[seat] || 0);
export function canRaise(G, seat, v) {
  return G.phase === 'bet' && G.turn === seat && RAISES.includes(v) && G.cur + v <= G.cap;
}

export function act(G, seat, m) {
  if (!G || G.over || G.waitUntil || G.phase !== 'bet' || G.turn !== seat || !m) return false;
  if (m.t === 'fold') {
    G.folded[seat] = true;
    G.lastMove = { seat, t: 'fold' };
  } else if (m.t === 'call') {
    const pay = toCall(G, seat);
    G.chips[seat] -= pay; G.bet[seat] += pay; G.pot += pay;
    G.lastMove = { seat, t: pay ? 'call' : 'check', v: pay };
  } else if (m.t === 'raise') {
    if (!canRaise(G, seat, m.v)) return false;
    G.cur += m.v;
    const pay = G.cur - G.bet[seat];
    G.chips[seat] -= pay; G.bet[seat] += pay; G.pot += pay;
    G.acted = G.acted.map(() => false);
    G.lastMove = { seat, t: 'raise', v: m.v };
  } else return false;
  G.acted[seat] = true;
  G.ev = { kind: 'move', ...G.lastMove };
  const left = active(G);
  if (left.length === 1) return finish(G, left), true;
  if (left.every(i => G.acted[i] && G.bet[i] === G.cur)) return finish(G, left), true;
  G.turn = nextFrom(G, seat, i => G.inHand[i] && !G.folded[i]);
  return true;
}

function finish(G, left) {
  G.phase = 'show';
  const scores = G.players.map((_, i) => (left.includes(i) && left.length > 1 ? score(G.hands[i]) : null));
  let winners = left;
  if (left.length > 1) {
    const top = Math.max(...left.map(i => scores[i]));
    winners = left.filter(i => scores[i] === top);
  }
  const svara = winners.length > 1;
  G.result = { winners, scores, pot: G.pot, svara, shown: left.length > 1 ? left : [] };
  if (!svara) { G.chips[winners[0]] += G.pot; G.pot = 0; }
  G.ev = { kind: svara ? 'svara' : 'won', who: winners };
  const stillIn = alive(G);
  if (!svara && (stillIn.length < 2 || G.handNo >= G.maxHands)) {
    G.over = true;
    const top = Math.max(...G.chips);
    G.winners = G.players.map((_, i) => i).filter(i => G.chips[i] === top);
    return;
  }
  G.waitUntil = Date.now() + (left.length > 1 ? 5000 : 2500);
}

export const pendingAdvance = G => !G.over && G.waitUntil != null;
export const advanceIn = G => (G.waitUntil || 0) - Date.now();
export function advance(G) {
  if (G.over || G.waitUntil == null) return;
  G.waitUntil = null;
  G.num++;
  startHand(G, G.result && G.result.svara ? G.result.winners : null);
  G.ev = { kind: G.svara ? 'svaraDeal' : 'deal' };
}

export function view(G, seat) {
  const shown = G.phase === 'show' && G.result ? G.result.shown : [];
  return {
    game: 'svara', seat, num: G.num, phase: G.phase, over: G.over, winners: G.winners, ev: G.ev,
    hand: G.hands[seat] ? G.hands[seat].slice() : [],
    players: G.players.map((p, i) => ({
      name: p.name, bot: p.bot, chips: G.chips[i], bet: G.bet[i], inHand: G.inHand[i], folded: G.folded[i],
      out: G.chips[i] <= 0 && !G.inHand[i], count: G.hands[i].length,
      cards: shown.includes(i) || (seat === i) ? G.hands[i].slice() : null,
    })),
    pot: G.pot, cur: G.cur, cap: G.cap, turn: G.turn, dealer: G.dealer, svara: G.svara,
    handNo: G.handNo, maxHands: G.maxHands, lastMove: G.lastMove,
    waitUntil: G.waitUntil ? 1 : 0, result: G.result,
  };
}

export function waiting(G) { return G.over || G.waitUntil || G.phase !== 'bet' ? [] : [G.turn]; }

// ---------- bot ----------
export function botAction(G, seat) {
  if (G.over || G.waitUntil || G.phase !== 'bet' || G.turn !== seat) return null;
  const s = score(G.hands[seat]);
  const need = toCall(G, seat);
  const others = active(G).length - 1;
  const r = rnd(100);
  // strength 0..1 (≈ 15 weak, 21 average, 25+ strong, 30+ very strong)
  const k = Math.min(1, Math.max(0, (s - 14) / 18)) - (others - 1) * 0.04;
  const raiseBy = RAISES.filter(v => G.cur + v <= G.cap);
  const pick = () => raiseBy[Math.min(raiseBy.length - 1, k > 0.8 ? 2 + rnd(2) : k > 0.6 ? 1 + rnd(2) : rnd(2))];
  if (raiseBy.length && G.cur < 25 && (k > 0.6 && r < 65 || k > 0.4 && r < 20 || r < 4)) return { t: 'raise', v: pick() };
  if (!need) return { t: 'call' };
  // how much of the stack the call costs vs. the hand strength
  const price = need / Math.max(1, G.chips[seat]);
  if (k > 0.45 || (k > 0.3 && price < 0.15) || (need <= 2 && k > 0.15) || r < 5) return { t: 'call' };
  return { t: 'fold' };
}
