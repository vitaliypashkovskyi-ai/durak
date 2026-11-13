// Шпигун, 3–10 гравців (лише люди). Усі, крім шпигуна, знають локацію. Розмова в чаті за таймером,
// потім голосування. Спіймали шпигуна — перемогли агенти; помилились — переміг шпигун.
// Шпигун може будь-коли назвати локацію: вгадав — перемога, ні — поразка. Pure JS (page + server).

export const LOCATIONS = [
  'Лікарня', 'Школа', 'Пляж', 'Літак', 'Потяг', 'Ресторан', 'Кінотеатр', 'Банк', 'Піцерія', 'Супермаркет',
  'Цирк', 'Космічна станція', 'Підводний човен', 'Поліцейська дільниця', 'Посольство', 'Готель', 'Університет',
  'Вокзал', 'Театр', 'Стадіон', 'Зоопарк', 'Музей', 'Базар', 'Автосервіс', 'Круїзний лайнер', 'Військова база',
  'Нічний клуб', 'Бібліотека', 'Аеропорт', 'Перукарня', 'Ферма', 'Дитячий табір', 'Спортзал', 'Метро',
  'Гірськолижний курорт', 'Пошта', 'Кав\'ярня', 'Весілля', 'Пожежна частина', 'Кораблетроща на острові',
];
export const delay = { bot: 1500, advance: 0 };
export const DUR = { intro: 8000, vote: 60000 };
export const talkMs = n => Math.min(8, Math.max(4, n)) * 60000;   // a minute per player, 4–8 min

function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }

function say(G, from, text) {
  G.chat.push({ id: ++G.msgId, from, ch: from < 0 ? 'sys' : 'all', text });
  if (G.chat.length > 120) G.chat.splice(0, G.chat.length - 120);
}
const sys = (G, t) => say(G, -1, t);
function setPhase(G, ph, ms) { G.phase = ph; G.deadline = Date.now() + ms; }

export function create(cfg, players) {
  const n = players.length;
  const G = {
    game: 'spy', num: 1,
    players: players.map(p => ({ name: p.name, bot: !!p.bot })),
    loc: LOCATIONS[rnd(LOCATIONS.length)], spy: rnd(n),
    phase: 'intro', deadline: 0, wantVote: players.map(() => false), votes: players.map(() => null),
    chat: [], msgId: 0, lastSay: {}, over: false, winner: null, reason: null, guess: null, accused: null, ev: null,
  };
  setPhase(G, 'intro', DUR.intro);
  sys(G, `Гра почалась: ${n} гравців, один із вас — шпигун. Подивіться свою картку.`);
  return G;
}

function finish(G, winner, reason) {
  G.over = true; G.winner = winner; G.reason = reason; G.phase = 'over';
  sys(G, `${winner === 'spy' ? '🕵️ Переміг шпигун' : '🎉 Перемогли агенти'}! Шпигун — ${G.players[G.spy].name}, локація — «${G.loc}».`);
}
function startVote(G) {
  setPhase(G, 'vote', DUR.vote);
  sys(G, '🗳 Голосування! Торкніться того, кого вважаєте шпигуном.');
  G.ev = { kind: 'phase' };
}

export const pendingAdvance = G => !G.over;
export const advanceIn = G => G.deadline - Date.now();
export function advance(G) {
  if (G.over) return;
  if (G.phase === 'intro') {
    setPhase(G, 'talk', talkMs(G.players.length));
    sys(G, '💬 Ставте одне одному питання про локацію — так, щоб шпигун не здогадався, де ви. Шпигун, не видайте себе!');
    G.ev = { kind: 'phase' };
    return;
  }
  if (G.phase === 'talk') return startVote(G);
  if (G.phase === 'vote') {
    const tally = {};
    G.votes.forEach(v => { if (v != null) tally[v] = (tally[v] || 0) + 1; });
    const max = Math.max(0, ...Object.values(tally));
    const top = Object.keys(tally).filter(k => tally[k] === max).map(Number);
    if (max === 0 || top.length > 1) return finish(G, 'spy', 'tie');
    G.accused = top[0];
    sys(G, `⚖️ Більшість обрала: ${G.players[top[0]].name}.`);
    return finish(G, top[0] === G.spy ? 'town' : 'spy', top[0] === G.spy ? 'caught' : 'wrong');
  }
}

export function act(G, seat, m) {
  if (!G || G.over || !m || !(seat >= 0 && seat < G.players.length)) return false;
  if (m.t === 'say') {
    const text = String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const now = Date.now();
    if (!text || now - (G.lastSay[seat] || 0) < 600) return false;
    G.lastSay[seat] = now;
    say(G, seat, text);
    return true;
  }
  if (m.t === 'callVote') {
    if (G.phase !== 'talk' || G.wantVote[seat]) return false;
    G.wantVote[seat] = true;
    const k = G.wantVote.filter(Boolean).length;
    sys(G, `${G.players[seat].name} хоче голосувати (${k}/${G.players.length}).`);
    if (k > G.players.length / 2) startVote(G);
    return true;
  }
  if (m.t === 'vote') {
    if (G.phase !== 'vote' || m.i === seat || !(m.i >= 0 && m.i < G.players.length)) return false;
    G.votes[seat] = m.i;
    if (G.votes.every(v => v != null)) G.deadline = Math.min(G.deadline, Date.now() + 2500);
    return true;
  }
  if (m.t === 'guess') {
    if (seat !== G.spy || (G.phase !== 'talk' && G.phase !== 'vote') || !LOCATIONS.includes(m.loc)) return false;
    G.guess = m.loc;
    sys(G, `🕵️ ${G.players[seat].name} — шпигун! Каже, що ви в локації «${m.loc}».`);
    finish(G, m.loc === G.loc ? 'spy' : 'town', m.loc === G.loc ? 'guessed' : 'missed');
    return true;
  }
  return false;
}

export function view(G, seat) {
  const isSpy = seat === G.spy;
  return {
    game: 'spy', seat, num: G.num, phase: G.phase, left: Math.max(0, G.deadline - Date.now()),
    over: G.over, winner: G.winner, reason: G.reason, ev: G.ev,
    role: isSpy ? 'spy' : 'agent',
    loc: isSpy && !G.over ? null : G.loc,
    spy: G.over ? G.spy : null, guess: G.guess, accused: G.accused,
    locations: LOCATIONS,
    players: G.players.map((p, i) => ({ name: p.name, bot: p.bot, wantVote: G.wantVote[i], voted: G.votes[i] != null })),
    votes: G.phase === 'vote' || G.over ? G.votes.slice() : null,
    myVote: G.votes[seat],
    chat: G.chat.slice(-60),
  };
}

export const waiting = () => [];

// Bots are not offered for this game; if one ends up at the table (a player left), it just votes.
export function botAction(G, seat) {
  if (G.over || G.phase !== 'vote' || G.votes[seat] != null) return null;
  const others = G.players.map((_, i) => i).filter(i => i !== seat);
  return { t: 'vote', i: others[rnd(others.length)] };
}
