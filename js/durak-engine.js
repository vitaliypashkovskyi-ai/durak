// Дурень: підкидний / переводний, 2–6 гравців, + бот.
// Pure JS with no DOM: the page uses it for games with bots, the server for online games.
// Rule helpers accept either the full state G or a player's view V (see cnt/isDone/hasPassed).

export const RANKS = ['6', '7', '8', '9', '10', 'В', 'Д', 'К', 'Т'];
export const SUITS = ['♠', '♣', '♥', '♦'];
export const delay = { bot: 750, advance: 900 };

function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const cnt = (S, i) => (S.hands ? S.hands[i].length : S.players[i].count);
const isDone = (S, i) => (S.done ? S.done[i] : S.players[i].done);
const hasPassed = (S, i) => (S.passed ? S.passed[i] : S.players[i].passed);

export const beats = (trump, a, d) => (d.s === a.s && d.r > a.r) || (d.s === trump && a.s !== trump);
export const undefended = S => S.table.filter(p => !p.d).length;
export const limit = S => (S.firstBout ? 5 : 6);

export function nextActive(S, i) {
  const n = S.players.length;
  for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (!isDone(S, j)) return j; }
  return i;
}
export function canLead(S, seat) { return !S.over && !S.table.length && seat === S.attacker; }
export function canAdd(S, seat, c) {
  if (S.over || !S.table.length || seat === S.defender || isDone(S, seat)) return false;
  if (S.table.length >= limit(S) || undefended(S) >= cnt(S, S.defender)) return false;
  return S.table.some(p => p.a.r === c.r || (p.d && p.d.r === c.r));
}
export function coverTargets(S, seat, c) {
  if (S.over || seat !== S.defender || S.taking) return [];
  const out = [];
  S.table.forEach((p, i) => { if (!p.d && beats(S.trump, p.a, c)) out.push(i); });
  return out;
}
export function canTransfer(S, seat, c) {
  if (S.over || S.variant !== 'perevod' || seat !== S.defender || S.taking || !S.table.length) return false;
  if (!S.table.every(p => !p.d && p.a.r === c.r)) return false;
  const next = nextActive(S, seat);
  return S.table.length + 1 <= limit(S) && cnt(S, next) >= S.table.length + 1;
}
// A thrower may say «Бито» (or «Пас» while the defender takes)
export function canPass(S, seat) {
  return !S.over && S.table.length > 0 && seat !== S.defender && !isDone(S, seat) && !hasPassed(S, seat) &&
    (S.taking || !undefended(S));
}

export function create(cfg, players) {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 0; r < 9; r++) deck.push({ s, r, id: s * 9 + r });
  shuffle(deck);
  const n = players.length;
  const G = {
    game: 'durak', variant: cfg && cfg.variant === 'perevod' ? 'perevod' : 'podkidnoy',
    players: players.map(p => ({ name: p.name, bot: !!p.bot })),
    deck, trump: deck[0].s, trumpCard: deck[0], hands: players.map(() => []), table: [],
    attacker: 0, defender: 1, taking: false,
    passed: players.map(() => false), done: players.map(() => false),
    out: 0, firstBout: true, over: false, loser: null, ev: null, endAt: false, num: 1,
  };
  for (let k = 0; k < 6; k++) for (let i = 0; i < n; i++) if (G.deck.length) G.hands[i].push(G.deck.pop());
  let best = 99, who = rnd(n);
  G.hands.forEach((h, i) => h.forEach(c => { if (c.s === G.trump && c.r < best) { best = c.r; who = i; } }));
  G.attacker = who;
  G.defender = nextActive(G, who);
  return G;
}

function drawUp(G, i) { while (G.hands[i].length < 6 && G.deck.length) G.hands[i].push(G.deck.pop()); }
function removeCard(hand, c) { hand.splice(hand.indexOf(c), 1); }

export function act(G, seat, m) {
  if (!G || G.over || G.endAt || !m || !(seat >= 0 && seat < G.players.length)) return false;
  const hand = G.hands[seat];
  const card = m.id != null ? hand.find(c => c.id === m.id) : null;
  let ok = false;
  if (m.t === 'play') {
    if (card && (canLead(G, seat) || canAdd(G, seat, card))) {
      removeCard(hand, card); G.table.push({ a: card, d: null }); G.passed.fill(false); ok = true;
    }
  } else if (m.t === 'cover') {
    if (card && coverTargets(G, seat, card).includes(m.i)) {
      removeCard(hand, card); G.table[m.i].d = card; G.passed.fill(false); ok = true;
    }
  } else if (m.t === 'transfer') {
    if (card && canTransfer(G, seat, card)) {
      removeCard(hand, card); G.table.push({ a: card, d: null });
      G.attacker = seat; G.defender = nextActive(G, seat); G.passed.fill(false);
      G.ev = { kind: 'transfer', who: seat, to: G.defender }; ok = true;
    }
  } else if (m.t === 'take') {
    if (seat === G.defender && !G.taking && undefended(G)) { G.taking = true; G.passed.fill(false); ok = true; }
  } else if (m.t === 'pass') {
    if (canPass(G, seat)) { G.passed[seat] = true; ok = true; }
  }
  if (ok) G.endAt = boutOver(G);
  return ok;
}

// The bout is over when every thrower has passed or has nothing to add
function boutOver(G) {
  if (!G.table.length || (!G.taking && undefended(G))) return false;
  for (let i = 0; i < G.players.length; i++) {
    if (i === G.defender || G.done[i] || G.passed[i]) continue;
    if (G.hands[i].some(c => canAdd(G, i, c))) return false;
  }
  return true;
}
export const pendingAdvance = G => !G.over && G.endAt;
export function advance(G) { if (G.endAt && !G.over) endBout(G); }

function endBout(G) {
  G.endAt = false;
  const att = G.attacker, def = G.defender, took = G.taking, n = G.players.length;
  const cards = G.table.flatMap(p => (p.d ? [p.a, p.d] : [p.a]));
  if (took) G.hands[def].push(...cards); else G.out += cards.length;
  G.table = []; G.taking = false; G.firstBout = false; G.passed.fill(false);
  for (let k = 0; k < n; k++) { const i = (att + k) % n; if (i !== def) drawUp(G, i); }
  drawUp(G, def);
  const out = [];
  if (!G.deck.length) G.hands.forEach((h, i) => { if (!h.length && !G.done[i]) { G.done[i] = true; out.push(i); } });
  G.ev = { kind: took ? 'took' : 'bito', who: def, out };
  G.bouts = (G.bouts || 0) + 1;
  const active = [];
  G.done.forEach((d, i) => { if (!d) active.push(i); });
  if (active.length <= 1) { G.over = true; G.loser = active.length ? active[0] : -1; return; }
  if (G.bouts > 300) {   // safety net: an endless game ends, the most cards loses
    G.over = true;
    G.loser = active.reduce((a, b) => (G.hands[b].length > G.hands[a].length ? b : a));
    return;
  }
  const a = took || G.done[def] ? nextActive(G, def) : def;
  G.attacker = a;
  G.defender = nextActive(G, a);
}

export function view(G, seat) {
  return {
    game: 'durak', variant: G.variant, seat, num: G.num,
    players: G.players.map((p, i) => ({ name: p.name, bot: p.bot, count: G.hands[i].length, done: G.done[i], passed: G.passed[i] })),
    hand: G.hands[seat] ? G.hands[seat].slice() : [],
    table: G.table, deck: G.deck.length, trump: G.trump, trumpCard: G.trumpCard,
    attacker: G.attacker, defender: G.defender, taking: G.taking, out: G.out, firstBout: G.firstBout,
    over: G.over, loser: G.loser, ev: G.ev,
  };
}

// Seats the game is waiting for (used to auto-play for idle online players)
export function waiting(G) {
  if (G.over || G.endAt) return [];
  if (!G.table.length) return [G.attacker];
  if (!G.taking && undefended(G)) return [G.defender];
  const w = [];
  G.players.forEach((_, i) => { if (canPass(G, i) && G.hands[i].some(c => canAdd(G, i, c))) w.push(i); });
  return w;
}

// ---------- bot ----------
const val = (G, c) => c.r + (c.s === G.trump ? 10 : 0);
function planDefense(G, seat) {
  const hand = [...G.hands[seat]], plan = [];
  const targets = G.table.map((p, i) => ({ p, i })).filter(t => !t.p.d).sort((u, v) => val(G, v.p.a) - val(G, u.p.a));
  for (const { p, i } of targets) {
    const opts = hand.filter(c => beats(G.trump, p.a, c)).sort((a, b) => val(G, a) - val(G, b));
    if (!opts.length) return null;
    removeCard(hand, opts[0]);
    plan.push({ i, c: opts[0] });
  }
  return plan;
}
export function botAction(G, seat) {
  if (G.over || G.endAt || G.done[seat]) return null;
  const hand = G.hands[seat], by = (a, b) => val(G, a) - val(G, b);
  if (!G.table.length) {
    if (seat !== G.attacker || !hand.length) return null;
    // endgame: sometimes lead a random card, otherwise bots can pass the same cards around forever
    const c = !G.deck.length && rnd(10) < 4 ? hand[rnd(hand.length)] : [...hand].sort(by)[0];
    return { t: 'play', id: c.id };
  }
  if (seat === G.defender) {
    if (G.taking || !undefended(G)) return null;
    const transfers = hand.filter(c => canTransfer(G, seat, c)).sort(by);
    if (transfers.length && transfers[0].s !== G.trump) return { t: 'transfer', id: transfers[0].id };
    const plan = planDefense(G, seat);
    const costly = plan && G.deck.length > 8 &&
      plan.some(m => m.c.s === G.trump && G.table[m.i].a.s !== G.trump && m.c.r >= 7);
    if (!plan || costly) return transfers.length ? { t: 'transfer', id: transfers[0].id } : { t: 'take' };
    return { t: 'cover', i: plan[0].i, id: plan[0].c.id };
  }
  if (G.passed[seat] || (!G.taking && undefended(G))) return null;   // let the defender answer first
  const add = hand.filter(c => canAdd(G, seat, c))
    .filter(c => !G.deck.length || (c.s !== G.trump && c.r <= 6)).sort(by)[0];
  return add ? { t: 'play', id: add.id } : { t: 'pass' };
}
