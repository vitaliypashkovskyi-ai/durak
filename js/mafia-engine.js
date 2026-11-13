// Мафія, 5–12 гравців. Ведучий — код: ролі, ніч, ранок, день, голосування за таймером.
// Pure JS (page + server). Phases end on a timer or earlier when everyone needed has acted.

export const delay = { bot: 1100, advance: 0 };
export const DUR = { intro: 8000, night: 40000, morning: 6000, day: 120000, verdict: 6000 };
export const ROLES = {
  mafia: { name: 'Мафія', icon: '🔫' },
  doctor: { name: 'Лікар', icon: '💉' },
  detective: { name: 'Комісар', icon: '🕵️' },
  civ: { name: 'Мирний', icon: '🙂' },
};

function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const pick = a => a[rnd(a.length)];
export const mafiaCount = n => (n <= 6 ? 1 : n <= 9 ? 2 : 3);

const isMafia = (G, i) => G.roles[i] === 'mafia';
const alive = G => G.alive.map((a, i) => (a ? i : -1)).filter(i => i >= 0);
const roleName = r => ROLES[r].name.toLowerCase();

function say(G, from, ch, text) {
  G.chat.push({ id: ++G.msgId, from, ch, text });
  if (G.chat.length > 120) G.chat.splice(0, G.chat.length - 120);
}
const sys = (G, text) => say(G, -1, 'sys', text);
function setPhase(G, ph) { G.phase = ph; G.deadline = Date.now() + DUR[ph]; }
function hurry(G, ms) { G.deadline = Math.min(G.deadline, Date.now() + ms); }

export function create(cfg, players) {
  const n = players.length, m = mafiaCount(n);
  const roles = Array(m).fill('mafia').concat(['doctor', 'detective']);
  while (roles.length < n) roles.push('civ');
  shuffle(roles);
  const G = {
    game: 'mafia', num: 1,
    players: players.map(p => ({ name: p.name, bot: !!p.bot })),
    roles, alive: players.map(() => true),
    phase: 'intro', day: 0, deadline: 0,
    kills: {}, heal: null, lastHeal: null, check: null,
    checks: players.map(() => []), votes: players.map(() => null),
    chat: [], msgId: 0, lastSay: {}, over: false, winner: null, ev: null,
  };
  setPhase(G, 'intro');
  sys(G, `Гра почалась: ${n} гравців, мафії — ${m}, є лікар і комісар. Запам'ятайте свою роль.`);
  return G;
}

// ---------- phases ----------
export const pendingAdvance = G => !G.over;
export const advanceIn = G => G.deadline - Date.now();
export function advance(G) {
  if (G.over) return;
  if (G.phase === 'intro' || G.phase === 'verdict') return startNight(G);
  if (G.phase === 'night') return resolveNight(G);
  if (G.phase === 'morning') return startDay(G);
  if (G.phase === 'day') return resolveDay(G);
}
function startNight(G) {
  G.day++;
  G.kills = {}; G.heal = null; G.check = null;
  setPhase(G, 'night');
  sys(G, `🌙 Ніч ${G.day}. Місто засинає. Мафія обирає жертву, лікар — кого рятувати, комісар — кого перевірити.`);
  G.ev = { kind: 'phase' };
}
function nightDone(G) {
  return alive(G).every(i => {
    const r = G.roles[i];
    if (r === 'mafia') return G.kills[i] != null;
    if (r === 'doctor') return G.heal != null;
    if (r === 'detective') return G.check != null;
    return true;
  });
}
function resolveNight(G) {
  const tally = {};
  for (const [m, t] of Object.entries(G.kills)) if (G.alive[m] && G.alive[t]) tally[t] = (tally[t] || 0) + 1;
  const max = Math.max(0, ...Object.values(tally));
  const top = Object.keys(tally).filter(t => tally[t] === max).map(Number);
  const victim = top.length ? pick(top) : null;
  G.lastHeal = G.heal;
  if (victim == null) sys(G, '☀️ Ранок. Ця ніч минула спокійно.');
  else if (G.heal === victim) sys(G, '☀️ Ранок. Мафія напала, але лікар урятував жертву! 💉');
  else {
    G.alive[victim] = false;
    sys(G, `☀️ Ранок. Вночі вбито: ${G.players[victim].name} (${roleName(G.roles[victim])}).`);
    G.ev = { kind: 'killed', who: victim };
  }
  if (checkWin(G)) return;
  setPhase(G, 'morning');
}
function startDay(G) {
  G.votes = G.players.map(() => null);
  setPhase(G, 'day');
  sys(G, `🗳 День ${G.day}. Обговорюйте й голосуйте, кого стратити. Можна пропустити голосування.`);
  G.ev = { kind: 'phase' };
}
function resolveDay(G) {
  const tally = {};
  let skip = 0;
  alive(G).forEach(i => {
    const v = G.votes[i];
    if (v === -1) skip++;
    else if (v != null && G.alive[v]) tally[v] = (tally[v] || 0) + 1;
  });
  const max = Math.max(0, ...Object.values(tally));
  const top = Object.keys(tally).filter(t => tally[t] === max).map(Number);
  if (max > 0 && top.length === 1 && max > skip) {
    const x = top[0];
    G.alive[x] = false;
    sys(G, `⚖️ Місто стратило ${G.players[x].name}. Це ${isMafia(G, x) ? 'була мафія 🔫' : roleName(G.roles[x])}.`);
    G.ev = { kind: 'executed', who: x };
  } else sys(G, '⚖️ Голоси розділились — сьогодні нікого не стратили.');
  if (checkWin(G)) return;
  setPhase(G, 'verdict');
}
function checkWin(G) {
  const live = alive(G);
  const maf = live.filter(i => isMafia(G, i)).length;
  if (maf && maf < live.length - maf) return false;
  G.over = true;
  G.winner = maf ? 'mafia' : 'town';
  G.phase = 'over';
  const names = G.roles.map((r, i) => (r === 'mafia' ? G.players[i].name : null)).filter(Boolean).join(', ');
  sys(G, maf ? `🔫 Мафія захопила місто! Мафія: ${names}.` : `🎉 Мафію знищено — перемогло місто! Мафія: ${names}.`);
  return true;
}

// ---------- moves ----------
export function act(G, seat, m) {
  if (!G || G.over || !m || !(seat >= 0 && seat < G.players.length) || !G.alive[seat]) return false;
  if (m.t === 'say') {
    const text = String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const now = Date.now();
    if (!text || now - (G.lastSay[seat] || 0) < 600) return false;
    if (G.phase === 'night' && !isMafia(G, seat)) return false;
    G.lastSay[seat] = now;
    say(G, seat, G.phase === 'night' ? 'mafia' : 'all', text);
    return true;
  }
  if (m.t === 'skip') {
    if (G.phase !== 'day') return false;
    G.votes[seat] = -1;
    if (alive(G).every(i => G.votes[i] != null)) hurry(G, 3000);
    return true;
  }
  if (m.t !== 'target') return false;
  const t = m.i;
  if (!(t >= 0 && t < G.players.length) || !G.alive[t]) return false;
  if (G.phase === 'night') {
    const r = G.roles[seat];
    if (r === 'mafia') { if (isMafia(G, t)) return false; G.kills[seat] = t; }
    else if (r === 'doctor') { if (t === G.lastHeal) return false; G.heal = t; }
    else if (r === 'detective') {
      if (G.check != null || t === seat) return false;
      G.check = t;
      G.checks[seat].push({ i: t, mafia: isMafia(G, t) });
    } else return false;
    if (nightDone(G)) hurry(G, 2500);
    return true;
  }
  if (G.phase === 'day') {
    if (t === seat) return false;
    G.votes[seat] = t;
    if (alive(G).every(i => G.votes[i] != null)) hurry(G, 3000);
    return true;
  }
  return false;
}

export function view(G, seat) {
  const me = G.roles[seat], mafia = me === 'mafia';
  const night = G.phase === 'night';
  let myTarget = null;
  if (night) myTarget = mafia ? G.kills[seat] ?? null : me === 'doctor' ? G.heal : me === 'detective' ? G.check : null;
  else if (G.phase === 'day') myTarget = G.votes[seat];
  return {
    game: 'mafia', seat, num: G.num, phase: G.phase, day: G.day, left: Math.max(0, G.deadline - Date.now()),
    over: G.over, winner: G.winner, ev: G.ev, role: me,
    players: G.players.map((p, i) => ({
      name: p.name, bot: p.bot, alive: G.alive[i],
      role: i === seat || !G.alive[i] || G.over || (mafia && isMafia(G, i)) ? G.roles[i] : null,
    })),
    votes: G.phase === 'day' ? G.votes.slice() : null,
    myTarget,
    mafiaKills: mafia && night ? G.players.map((_, i) => G.kills[i] ?? null) : null,
    checks: me === 'detective' ? G.checks[seat] : [],
    lastHeal: me === 'doctor' ? G.lastHeal : null,
    chat: G.chat.filter(c => c.ch !== 'mafia' || mafia || G.over).slice(-60),
  };
}

export const waiting = () => [];

// ---------- bots ----------
export function botAction(G, seat) {
  if (G.over || !G.alive[seat]) return null;
  const live = alive(G), others = live.filter(i => i !== seat), r = G.roles[seat];
  if (G.phase === 'night') {
    if (r === 'mafia' && G.kills[seat] == null) {
      const mate = Object.entries(G.kills).find(([m, t]) => G.alive[m] && G.alive[t]);
      const t = mate ? Number(mate[1]) : pick(live.filter(i => !isMafia(G, i)));
      return t == null ? null : { t: 'target', i: t };
    }
    if (r === 'doctor' && G.heal == null) {
      const opts = live.filter(i => i !== G.lastHeal);
      if (!opts.length) return null;
      return { t: 'target', i: opts.includes(seat) && rnd(3) === 0 ? seat : pick(opts) };
    }
    if (r === 'detective' && G.check == null) {
      const known = new Set(G.checks[seat].map(c => c.i));
      const opts = others.filter(i => !known.has(i));
      return { t: 'target', i: pick(opts.length ? opts : others) };
    }
    return null;
  }
  if (G.phase === 'day' && G.votes[seat] == null) {
    if (r === 'detective') {
      const found = G.checks[seat].find(c => c.mafia && G.alive[c.i]);
      if (found) return { t: 'target', i: found.i };
    }
    const tally = {};
    live.forEach(i => { const v = G.votes[i]; if (v != null && v >= 0 && G.alive[v]) tally[v] = (tally[v] || 0) + 1; });
    let opts = others;
    if (r === 'mafia') opts = others.filter(i => !isMafia(G, i));
    const voted = opts.filter(i => tally[i]).sort((a, b) => tally[b] - tally[a]);
    if (voted.length && rnd(10) < 6) return { t: 'target', i: voted[0] };
    return opts.length ? { t: 'target', i: pick(opts) } : { t: 'skip' };
  }
  return null;
}
