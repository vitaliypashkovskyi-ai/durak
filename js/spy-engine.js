// Шпигун, 3–10 гравців. Усі, крім шпигуна, знають локацію. Розмова в чаті за таймером,
// потім голосування. Спіймали шпигуна — перемогли агенти; помилились — переміг шпигун.
// Шпигун може будь-коли назвати локацію: вгадав — перемога, ні — поразка. Pure JS (page + server).
// Bots talk: they ask players questions, answer when their name is mentioned (agents with a hint
// about the location, the spy vaguely), the spy bot listens for keywords and guesses, agents vote
// for whoever sounds least like the location.
import { LOC_DATA, QUESTIONS, VAGUE } from './spy-data.js';

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
    ask: {}, botNext: {}, used: [], talkStart: 0,
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
    G.talkStart = Date.now();
    let k = 0;
    G.players.forEach((p, i) => { if (p.bot) G.botNext[i] = G.talkStart + 4000 + 3500 * k++ + rnd(3000); });
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
    if (m.answer) delete G.ask[seat];
    if (m.hint && G.players[seat].bot) G.used.push(String(m.hint));
    if (m.kind === 'ask') G.botNext[seat] = now + botGap(G);
    // a bot whose name is mentioned answers a few seconds later (answers themselves don't ask anyone)
    if (G.phase === 'talk' && !m.answer) {
      const low = text.toLowerCase();
      G.players.forEach((p, i) => {
        if (i !== seat && p.bot && !G.ask[i] && low.includes(stem(p.name))) G.ask[i] = { from: seat, at: now + 2000 + rnd(3000) };
      });
    }
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

// ---------- bots ----------
// «Тарасе», «Оксано», «Лесю» all contain the name without its last letter
const stem = name => name.toLowerCase().slice(0, Math.max(3, name.length - 1));
const pick = a => a[rnd(a.length)];
const botCount = G => G.players.filter(p => p.bot).length;
const botGap = G => 12000 + botCount(G) * 3000 + rnd(8000);
// keywords count only at the start of a word, and players' names are ignored («Марко» is not «марка»)
const words = (G, text) => {
  const names = G.players.map(p => stem(p.name));
  return text.toLowerCase().split(/[^a-zа-яіїєґ'ʼ]+/i).filter(w => w && !names.some(n => w.startsWith(n)));
};
const hits = (G, text, loc) => { const ws = words(G, text); return LOC_DATA[loc].k.filter(k => ws.some(w => w.startsWith(k))).length; };
const saidBy = (G, p) => G.chat.filter(c => c.from === p).map(c => c.text);

function spyGuess(G, seat) {
  const said = G.chat.filter(c => c.from >= 0 && c.from !== seat).map(c => c.text);
  const score = LOCATIONS.map(l => [l, said.reduce((s, t) => s + hits(G, t, l), 0)]).sort((a, b) => b[1] - a[1]);
  const [top, second] = score;
  if (G.phase === 'talk' && top[1] >= 4 && top[1] - second[1] >= 3) return top[0];
  if (G.phase !== 'vote') return null;
  // in the vote: guess when sure, or as a last chance when the table is voting for the spy
  const against = G.votes.filter(v => v === seat).length, need = G.players.length / 2;
  if (top[1] >= 3 && top[1] - second[1] >= 2) return top[0];
  if (against >= need && top[1] >= 2 && top[1] > second[1]) return top[0];
  return null;
}
// Agents hint, but not every time — otherwise the spy hears the place too easily.
function answer(G, seat) {
  if (seat === G.spy) return pick(VAGUE);
  // at most two hints from bots per game: enough for agents to recognise each other, not for the spy
  const fresh = G.used.length < 2 ? LOC_DATA[G.loc].h.filter(h => !G.used.includes(h)) : [];
  return fresh.length && rnd(100) < 55 ? pick(fresh) : pick(VAGUE);
}

export function botAction(G, seat) {
  if (G.over || !G.players[seat].bot) return null;
  const now = Date.now(), others = G.players.map((_, i) => i).filter(i => i !== seat);
  if (G.phase === 'talk') {
    if (seat === G.spy) {
      const loc = spyGuess(G, seat);
      if (loc) return { t: 'guess', loc };
    }
    const quiet = now - (G.lastSay[seat] || 0) < 2500;   // a bot does not fire two lines at once
    const a = G.ask[seat];
    if (a && now >= a.at && !quiet) {
      const who = a.from >= 0 && a.from !== seat ? G.players[a.from].name : '';
      const asker = who && who !== 'Ви' ? who + ', ' : '';
      const text = answer(G, seat);
      return { t: 'say', text: asker ? asker + text.charAt(0).toLowerCase() + text.slice(1) : text, answer: true, hint: text };
    }
    if (!G.wantVote[seat] && now >= G.talkStart + (G.deadline - G.talkStart) * 0.6) return { t: 'callVote' };
    if (G.botNext[seat] && now >= G.botNext[seat] && !quiet) {
      const target = pick(others), name = G.players[target].name, q = pick(QUESTIONS);
      // outside Telegram the local player is called «Ви»: ask without addressing by name
      const text = name === 'Ви' ? q.replace('{n}, ', '').replace(/^./, c => c.toUpperCase()) : q.replace('{n}', name);
      return { t: 'say', text, kind: 'ask' };
    }
    return null;
  }
  if (G.phase === 'vote') {
    if (seat === G.spy) {
      const loc = spyGuess(G, seat);
      if (loc) return { t: 'guess', loc };
    }
    if (G.votes[seat] != null) return null;
    if (seat === G.spy) {
      const voted = others.filter(i => G.votes.includes(i));
      return { t: 'vote', i: voted.length ? pick(voted) : pick(others) };
    }
    // agents suspect whoever sounds least like the location
    const sc = others.map(i => [i, saidBy(G, i).reduce((s, t) => s + hits(G, t, G.loc), 0)]);
    const min = Math.min(...sc.map(x => x[1]));
    return { t: 'vote', i: pick(sc.filter(x => x[1] === min).map(x => x[0])) };
  }
  return null;
}

// When a bot will next want to speak (the host wakes bots up on time).
export function botWakeIn(G) {
  if (G.over || G.phase !== 'talk') return null;
  const now = Date.now();
  let at = Infinity;
  G.players.forEach((p, i) => {
    if (!p.bot) return;
    if (G.ask[i]) at = Math.min(at, G.ask[i].at);
    if (G.botNext[i]) at = Math.min(at, G.botNext[i]);
    if (!G.wantVote[i]) at = Math.min(at, G.talkStart + (G.deadline - G.talkStart) * 0.6);
  });
  return at === Infinity ? null : Math.max(300, at - now);
}
