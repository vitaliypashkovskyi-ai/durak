// Кості — покер на костях: 2–6 гравців, 5 кубиків. За хід до 3 кидків: після кожного можна відкласти
// будь-які кубики й перекинути решту. Потім результат записується в одну з 13 вільних клітинок таблиці
// (можна й нуль). Верх: одиниці…шістки (сума цих граней), за 63+ у верху — бонус 35. Низ: трійка й каре
// (сума всіх кубиків), фул-хаус 25, мала стріт 30, велика стріт 40, покер (5 однакових) 50, шанс (сума).
// Після 13 раундів перемагає найбільша сума. Pure JS (page + server).

export const CATS = [
  ['n1', 'Одиниці'], ['n2', 'Двійки'], ['n3', 'Трійки'], ['n4', 'Четвірки'], ['n5', "П'ятірки"], ['n6', 'Шістки'],
  ['three', 'Трійка'], ['four', 'Каре'], ['full', 'Фул-хаус'], ['small', 'Мала стріт'], ['large', 'Велика стріт'],
  ['poker', 'Покер'], ['chance', 'Шанс'],
];
export const HINT = {
  n1: 'сума одиниць', n2: 'сума двійок', n3: 'сума трійок', n4: 'сума четвірок', n5: "сума п'ятірок", n6: 'сума шісток',
  three: '3 однакові — сума всіх', four: '4 однакові — сума всіх', full: '3 + 2 однакові — 25', small: '4 поспіль — 30',
  large: '5 поспіль — 40', poker: '5 однакових — 50', chance: 'сума всіх',
};
const UPPER = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'];
export const BONUS_AT = 63, BONUS = 35;
export const delay = { bot: 900, advance: 0 };

function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }

const counts = d => { const c = [0, 0, 0, 0, 0, 0, 0]; for (const x of d) c[x]++; return c; };
const sum = d => d.reduce((a, b) => a + b, 0);
export function value(cat, d) {
  if (!d || d.length !== 5 || d.some(x => !x)) return 0;
  const c = counts(d);
  if (cat[0] === 'n' && cat.length === 2) { const f = Number(cat[1]); return c[f] * f; }
  const mx = Math.max(...c);
  const has = s => s.every(x => c[x] > 0);
  switch (cat) {
    case 'three': return mx >= 3 ? sum(d) : 0;
    case 'four': return mx >= 4 ? sum(d) : 0;
    case 'full': return c.includes(3) && c.includes(2) ? 25 : 0;
    case 'small': return has([1, 2, 3, 4]) || has([2, 3, 4, 5]) || has([3, 4, 5, 6]) ? 30 : 0;
    case 'large': return has([1, 2, 3, 4, 5]) || has([2, 3, 4, 5, 6]) ? 40 : 0;
    case 'poker': return mx === 5 ? 50 : 0;
    case 'chance': return sum(d);
  }
  return 0;
}
export function totals(sheet) {
  const up = UPPER.reduce((s, k) => s + (sheet[k] || 0), 0);
  const bonus = up >= BONUS_AT ? BONUS : 0;
  const all = CATS.reduce((s, [k]) => s + (sheet[k] || 0), 0) + bonus;
  return { up, bonus, all };
}

export function create(cfg, players) {
  const G = {
    game: 'dice', num: 1,
    players: players.map(p => ({ name: p.name, bot: !!p.bot })),
    sheets: players.map(() => ({})),
    turn: rnd(players.length), round: 1,
    dice: [0, 0, 0, 0, 0], held: [false, false, false, false, false], rolls: 0,
    last: null, over: false, winners: [], ev: null,
  };
  G.starter = G.turn;
  return G;
}

export function act(G, seat, m) {
  if (!G || G.over || seat !== G.turn || !m) return false;
  if (m.t === 'roll') {
    if (G.rolls >= 3) return false;
    const hold = G.rolls && Array.isArray(m.hold) ? m.hold.map(Boolean) : [false, false, false, false, false];
    if (hold.length !== 5 || hold.every(Boolean)) return false;
    G.held = hold;
    G.dice = G.dice.map((x, i) => (hold[i] ? x : rnd(6) + 1));
    G.rolls++;
    G.ev = { kind: 'roll', seat };
    return true;
  }
  if (m.t === 'score') {
    const sh = G.sheets[seat];
    if (!G.rolls || !CATS.some(([k]) => k === m.cat) || sh[m.cat] != null) return false;
    sh[m.cat] = value(m.cat, G.dice);
    G.last = { seat, cat: m.cat, pts: sh[m.cat], dice: G.dice.slice() };
    G.ev = { kind: 'score', seat, cat: m.cat, pts: sh[m.cat] };
    nextTurn(G);
    return true;
  }
  return false;
}
function nextTurn(G) {
  const n = G.players.length;
  G.dice = [0, 0, 0, 0, 0]; G.held = [false, false, false, false, false]; G.rolls = 0;
  G.turn = (G.turn + 1) % n;
  G.num++;
  if (G.turn === G.starter) G.round++;
  if (G.sheets.every(s => Object.keys(s).length === CATS.length)) {
    G.over = true;
    const t = G.sheets.map(s => totals(s).all), top = Math.max(...t);
    G.winners = t.map((x, i) => (x === top ? i : -1)).filter(i => i >= 0);
  }
}

export const pendingAdvance = () => false;
export function advance() {}

export function view(G, seat) {
  return {
    game: 'dice', seat, num: G.num, over: G.over, winners: G.winners, ev: G.ev,
    players: G.players.map((p, i) => ({ name: p.name, bot: p.bot, total: totals(G.sheets[i]).all })),
    sheets: G.sheets.map(s => ({ ...s })), turn: G.turn, round: Math.min(G.round, CATS.length), rounds: CATS.length,
    dice: G.dice.slice(), held: G.held.slice(), rolls: G.rolls, last: G.last,
  };
}
export function waiting(G) { return G.over ? [] : [G.turn]; }

// ---------- bot: one-roll look-ahead with a value for every free cell ----------
const BASE = { n1: 2, n2: 5, n3: 8, n4: 11, n5: 14, n6: 17, three: 15, four: 7, full: 10, small: 14, large: 9, poker: 4, chance: 21 };
function cellGain(sheet, cat, d) {
  const v = value(cat, d);
  let g = v - BASE[cat];
  if (UPPER.includes(cat)) {
    const f = Number(cat[1]);
    if (v >= 3 * f) g += 6;                     // on track for the upper bonus
    const up = totals(sheet).up;
    if (up < BONUS_AT && up + v >= BONUS_AT) g += 20;
  }
  if (cat === 'chance') g -= 4;                 // keep the chance for later
  return g;
}
function bestCell(sheet, d) {
  let best = -Infinity, cat = null;
  for (const [k] of CATS) if (sheet[k] == null) { const g = cellGain(sheet, k, d); if (g > best) { best = g; cat = k; } }
  return { cat, g: best };
}
export function botAction(G, seat) {
  if (G.over || G.turn !== seat) return null;
  if (!G.rolls) return { t: 'roll' };
  const sheet = G.sheets[seat];
  const now = bestCell(sheet, G.dice);
  if (G.rolls >= 3) return { t: 'score', cat: now.cat };
  let bestHold = null, bestExp = now.g;
  for (let mask = 0; mask < 31; mask++) {        // 31 = keep everything = stop
    const hold = [0, 1, 2, 3, 4].map(i => !!(mask & (1 << i)));
    let s = 0; const T = 36;
    for (let t = 0; t < T; t++) {
      const d = G.dice.map((x, i) => (hold[i] ? x : 1 + Math.floor(Math.random() * 6)));
      s += bestCell(sheet, d).g;
    }
    const exp = s / T + (G.rolls === 1 ? 2.5 : 0);   // one more roll after this one is worth a bit more
    if (exp > bestExp) { bestExp = exp; bestHold = hold; }
  }
  if (!bestHold) return { t: 'score', cat: now.cat };
  return { t: 'roll', hold: bestHold };
}
