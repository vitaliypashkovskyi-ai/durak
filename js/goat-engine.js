// Козел: 4 гравці, дві пари (партнер навпроти: 0+2 проти 1+3), 36 карт по 9.
// Козирі: усі вальти (♣ > ♠ > ♥ > ♦), далі вся масть треф. Масть треба підтримати, інакше — будь-яка карта.
// Очки карт: туз 11, 10 — 10, король 4, дама 3, валет 2 (разом 120). За роздачу: 61+ очок → +2,
// суперники < 31 → +4, суперники без жодної взятки → +6; 60:60 — «яйця», наступна роздача подвоюється.
// Гра до 12; хто програв — «козли». Pure JS (page + server).

export const LABELS = ['6', '7', '8', '9', 'В', 'Д', 'К', '10', 'Т'];   // index = r
export const SUITS = ['♠', '♣', '♥', '♦'];
export const TRUMP = 1;                                                   // ♣
const J = 4;
const POINTS = [0, 0, 0, 0, 2, 3, 4, 10, 11];
const ORDER = [0, 1, 2, 3, -1, 4, 5, 6, 7];                               // strength inside a suit (jack is a trump)
const JACK_RANK = { 1: 4, 0: 3, 2: 2, 3: 1 };                             // ♣ ♠ ♥ ♦
export const GOAL = 12;
export const delay = { bot: 800, advance: 0 };

function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export const points = c => POINTS[c.r];
export const isTrump = c => c.r === J || c.s === TRUMP;
export const suitOf = c => (isTrump(c) ? 'T' : c.s);                       // jacks belong to the trump suit
export const team = seat => seat % 2;
export function strength(c) {
  if (c.r === J) return 200 + JACK_RANK[c.s];
  if (c.s === TRUMP) return 100 + ORDER[c.r];
  return ORDER[c.r];
}
// c beats the best card so far (which is always of the led suit or a trump)
function beats(c, b) {
  if (isTrump(c) !== isTrump(b)) return isTrump(c);
  if (isTrump(c)) return strength(c) > strength(b);
  return c.s === b.s && strength(c) > strength(b);
}
export function trickWinner(trick) {
  let best = trick[0];
  for (const x of trick.slice(1)) if (beats(x.c, best.c)) best = x;
  return best.seat;
}
export const trickPoints = t => t.reduce((s, x) => s + points(x.c), 0);

export function legal(S, seat, c) {
  if (S.phase !== 'play' || S.turn !== seat || S.over || S.trick.length >= 4 || S.waitUntil) return false;
  if (!S.trick.length) return true;
  const hand = S.hands ? S.hands[seat] : S.hand;
  const led = suitOf(S.trick[0].c);
  return hand.some(x => suitOf(x) === led) ? suitOf(c) === led : true;
}

export function create(cfg, players) {
  const G = {
    game: 'goat', num: 1,
    players: players.map(p => ({ name: p.name, bot: !!p.bot })),
    score: [0, 0], dealer: rnd(4), deal: 0, eggs: 0,
    over: false, winner: null, ev: null, waitUntil: null,
  };
  startDeal(G, true);
  return G;
}

function startDeal(G, first) {
  if (!first) G.dealer = (G.dealer + 1) % 4;
  G.deal++;
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 0; r < 9; r++) deck.push({ s, r, id: s * 9 + r });
  shuffle(deck);
  G.hands = [0, 1, 2, 3].map(i => deck.slice(i * 9, i * 9 + 9));
  G.phase = 'play';
  G.turn = (G.dealer + 1) % 4;
  G.trick = []; G.lastTrick = null;
  G.taken = [0, 0]; G.tricks = [0, 0];
  G.result = null; G.waitUntil = null;
}

export function act(G, seat, m) {
  if (!G || G.over || !m || m.t !== 'play' || !(seat >= 0 && seat < 4) || G.waitUntil) return false;
  const hand = G.hands[seat];
  const c = hand.find(x => x.id === m.id);
  if (!c || !legal(G, seat, c)) return false;
  hand.splice(hand.indexOf(c), 1);
  G.trick.push({ seat, c });
  G.turn = (seat + 1) % 4;
  if (G.trick.length === 4) G.waitUntil = Date.now() + 1300;
  return true;
}

export const pendingAdvance = G => !G.over && G.waitUntil != null;
export const advanceIn = G => (G.waitUntil || 0) - Date.now();
export function advance(G) {
  if (G.over || G.waitUntil == null) return;
  G.waitUntil = null;
  if (G.phase === 'score') return startDeal(G, false);
  if (G.trick.length < 4) return;
  const w = trickWinner(G.trick);
  G.taken[team(w)] += trickPoints(G.trick);
  G.tricks[team(w)]++;
  G.lastTrick = G.trick;
  G.trick = [];
  G.turn = w;
  G.ev = { kind: 'trick', who: w, pts: trickPoints(G.lastTrick) };
  if (G.hands.every(h => !h.length)) scoreDeal(G);
}

function scoreDeal(G) {
  const [a, b] = G.taken;
  let res;
  if (a === b) {
    G.eggs++;
    res = { team: null, gain: 0, eggs: true };
  } else {
    const w = a > b ? 0 : 1, lose = 1 - w;
    let gain = G.tricks[lose] === 0 ? 6 : G.taken[lose] < 31 ? 4 : 2;
    if (G.eggs) gain *= 2;
    G.eggs = 0;
    G.score[w] += gain;
    res = { team: w, gain, eggs: false };
  }
  G.result = { ...res, taken: G.taken.slice(), tricks: G.tricks.slice() };
  G.phase = 'score';
  G.ev = { kind: 'deal' };
  const top = G.score[0] >= GOAL || G.score[1] >= GOAL;
  if (top) { G.over = true; G.winner = G.score[0] >= G.score[1] ? 0 : 1; }
  else G.waitUntil = Date.now() + 5000;
}

export function view(G, seat) {
  return {
    game: 'goat', seat, num: G.num, deal: G.deal, phase: G.phase, over: G.over, winner: G.winner, ev: G.ev,
    hand: G.hands[seat] ? G.hands[seat].slice() : [],
    players: G.players.map((p, i) => ({ name: p.name, bot: p.bot, count: G.hands[i].length, team: team(i) })),
    score: G.score.slice(), eggs: G.eggs, dealer: G.dealer, turn: G.turn,
    trick: G.trick, lastTrick: G.lastTrick, tricks: G.tricks.slice(), waitUntil: G.waitUntil ? 1 : 0, result: G.result,
  };
}

export function waiting(G) { return G.over || G.waitUntil ? [] : [G.turn]; }

// ---------- bot ----------
export function botAction(G, seat) {
  if (G.over || G.waitUntil || G.phase !== 'play' || G.turn !== seat) return null;
  const hand = G.hands[seat];
  const L = hand.filter(c => legal(G, seat, c));
  if (!L.length) return null;
  const cheap = (a, b) => (points(a) + (isTrump(a) ? 20 : 0) + strength(a) / 1000) - (points(b) + (isTrump(b) ? 20 : 0) + strength(b) / 1000);
  if (!G.trick.length) {
    const ace = L.find(c => !isTrump(c) && c.r === 8);
    if (ace) return { t: 'play', id: ace.id };
    const plain = L.filter(c => !isTrump(c)).sort(cheap);
    return { t: 'play', id: (plain[0] || [...L].sort(cheap)[0]).id };
  }
  const winner = trickWinner(G.trick);
  const partnerWins = team(winner) === team(seat);
  const last = G.trick.length === 3;
  if (partnerWins && (last || strength(G.trick.find(x => x.seat === winner).c) >= 200)) {
    // the partner holds the trick: give him points, but not trumps
    const give = L.filter(c => !isTrump(c)).sort((a, b) => points(b) - points(a))[0];
    if (give) return { t: 'play', id: give.id };
  }
  const wins = L.filter(c => trickWinner([...G.trick, { seat, c }]) === seat).sort(cheap);
  if (!partnerWins && wins.length && (last || trickPoints(G.trick) >= 10 || wins[0].r !== J)) return { t: 'play', id: wins[0].id };
  return { t: 'play', id: [...L].sort(cheap)[0].id };
}
