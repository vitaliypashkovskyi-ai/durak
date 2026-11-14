// Вікторина: 2–8 гравців, 10 питань. На кожне — 15 секунд, усі відповідають одночасно, обравши 1 з 4 варіантів.
// Правильно: +10 і до +5 за швидкість. Після питання — 4 секунди показу правильної відповіді. Перемагає найбільше очок.
// Боти відповідають у випадковий момент; правильно — тим частіше, чим вищий рівень. Pure JS (page + server).
import { QUESTIONS, CATS } from './quiz-data.js';
import { levelOf } from './level.js';

export const ROUNDS = 10, Q_MS = 15000, REVEAL_MS = 4000;
export { CATS };
export const delay = { bot: 0, advance: 0 };
const ACC = { easy: 0.45, normal: 0.65, hard: 0.85 };

function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function create(cfg, players) {
  const cat = cfg && CATS[cfg.cat] ? cfg.cat : null;
  let pool = QUESTIONS.map((q, i) => i).filter(i => !cat || QUESTIONS[i][0] === cat);
  if (pool.length < ROUNDS) pool = QUESTIONS.map((q, i) => i);
  const qs = shuffle(pool).slice(0, ROUNDS).map(i => ({ i, order: shuffle([0, 1, 2, 3]) }));
  const G = {
    game: 'quiz', level: levelOf(cfg), num: 1, cat,
    players: players.map(p => ({ name: p.name, bot: !!p.bot })),
    score: players.map(() => 0), qs, round: 0,
    phase: 'q', answers: [], deadline: 0, waitUntil: null, botAt: [],
    over: false, winners: [], ev: null,
  };
  startQ(G);
  return G;
}
function startQ(G) {
  const now = Date.now();
  G.phase = 'q';
  G.answers = G.players.map(() => null);
  G.deadline = now + Q_MS;
  G.waitUntil = G.deadline;
  // bots answer between 3 and 11 seconds
  G.botAt = G.players.map(p => (p.bot ? now + 3000 + rnd(8000) : null));
  G.ev = { kind: 'question', round: G.round };
}
// the option shown at position k → index in the question's list (0 = right)
const optAt = (G, k) => G.qs[G.round].order[k];

export function act(G, seat, m) {
  if (!G || G.over || G.phase !== 'q' || !m || m.t !== 'answer' || !(seat >= 0 && seat < G.players.length)) return false;
  if (G.answers[seat] || !(m.a >= 0 && m.a < 4)) return false;
  const left = Math.max(0, G.deadline - Date.now());
  G.answers[seat] = { a: m.a, left };
  G.ev = { kind: 'answer', seat };
  if (G.answers.every(Boolean)) G.waitUntil = Date.now();      // everyone answered: reveal now
  return true;
}

export const pendingAdvance = G => !G.over && G.waitUntil != null;
export const advanceIn = G => (G.waitUntil || 0) - Date.now();
export function advance(G) {
  if (G.over) return;
  if (G.phase === 'q') {
    // score the question
    const gain = G.players.map((_, i) => {
      const a = G.answers[i];
      if (!a || optAt(G, a.a) !== 0) return 0;
      return 10 + Math.round(5 * a.left / Q_MS);
    });
    gain.forEach((g, i) => { G.score[i] += g; });
    G.phase = 'reveal'; G.gain = gain;
    G.waitUntil = Date.now() + REVEAL_MS;
    G.ev = { kind: 'reveal' };
    return;
  }
  G.round++;
  if (G.round >= G.qs.length) {
    G.over = true; G.waitUntil = null;
    const top = Math.max(...G.score);
    G.winners = G.score.map((s, i) => (s === top ? i : -1)).filter(i => i >= 0);
    G.ev = { kind: 'end' };
    return;
  }
  startQ(G);
}

export function view(G, seat) {
  const q = QUESTIONS[G.qs[G.round].i];
  const opts = G.qs[G.round].order.map(k => q[2][k]);
  const reveal = G.phase === 'reveal';
  return {
    game: 'quiz', seat, num: G.num, over: G.over, winners: G.winners, ev: G.ev,
    players: G.players.map((p, i) => ({ name: p.name, bot: p.bot, score: G.score[i], answered: !!G.answers[i],
      pick: reveal && G.answers[i] ? G.answers[i].a : null, gain: reveal ? G.gain[i] : null })),
    round: G.round, rounds: G.qs.length, phase: G.phase, cat: CATS[q[0]], text: q[1], opts,
    mine: G.answers[seat] ? G.answers[seat].a : null,
    right: reveal ? G.qs[G.round].order.indexOf(0) : null,
    leftMs: G.phase === 'q' ? Math.max(0, G.deadline - Date.now()) : 0,
    turn: -1,
  };
}
export function waiting(G) { return G.over || G.phase !== 'q' ? [] : G.players.map((_, i) => i).filter(i => !G.answers[i]); }

// ---------- bots ----------
export function botAction(G, seat) {
  if (G.over || G.phase !== 'q' || G.answers[seat] || !G.botAt[seat] || Date.now() < G.botAt[seat]) return null;
  const right = G.qs[G.round].order.indexOf(0);
  const ok = Math.random() < (ACC[G.level] || ACC.normal);
  let a = right;
  if (!ok) { const wrong = [0, 1, 2, 3].filter(k => k !== right); a = wrong[rnd(3)]; }
  return { t: 'answer', a };
}
// wake the host when the next bot wants to answer
export function botWakeIn(G) {
  if (G.over || G.phase !== 'q') return null;
  const now = Date.now();
  const next = G.botAt.filter((t, i) => t && !G.answers[i]).map(t => t - now);
  return next.length ? Math.max(50, Math.min(...next)) : null;
}
