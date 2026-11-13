// Bot-vs-bot simulation: node tests/sim.mjs
import * as durak from '../js/durak-engine.js';
import * as battle from '../js/battle-engine.js';
import * as mafia from '../js/mafia-engine.js';

function run(E, cfg, n, games, check) {
  const res = { games: 0, steps: 0, transfers: 0, outcomes: {} };
  for (let g = 0; g < games; g++) {
    const G = E.create(cfg, Array.from({ length: n }, (_, i) => ({ name: 'B' + i, bot: true })));
    let steps = 0;
    while (!G.over) {
      if (++steps > 20000) throw new Error(`too long: ${JSON.stringify(cfg)} n=${n}`);
      // timed games: bots act first, the phase ends (timer) when nobody has anything to do
      if (E.pendingAdvance(G) && !E.advanceIn) { E.advance(G); check && check(G); continue; }
      let acted = false;
      for (let i = 0; i < n && !acted; i++) {
        const a = E.botAction(G, i);
        if (!a) continue;
        if (!E.act(G, i, a)) throw new Error(`rejected ${JSON.stringify(a)} seat ${i}`);
        if (a.t === 'transfer') res.transfers++;
        acted = true;
      }
      if (!acted && E.advanceIn) { E.advance(G); check && check(G); continue; }
      if (!acted) throw new Error(`stuck: ${JSON.stringify(E.view(G, 0)).slice(0, 400)}`);
      check && check(G);
    }
    const key = String(G.loser ?? G.winner);
    res.outcomes[key] = (res.outcomes[key] || 0) + 1;
    res.games++; res.steps += steps;
  }
  return res;
}

const durakCheck = G => {
  const total = G.deck.length + G.out + G.hands.reduce((s, h) => s + h.length, 0) +
    G.table.reduce((s, p) => s + (p.d ? 2 : 1), 0);
  if (total !== 36) throw new Error('card count ' + total);
  if (G.table.length > 6) throw new Error('table > 6');
  if (!G.over && G.defender === G.attacker) throw new Error('attacker = defender');
};

for (const variant of ['podkidnoy', 'perevod']) {
  for (let n = 2; n <= 6; n++) {
    const r = run(durak, { variant }, n, 400, durakCheck);
    console.log(`durak ${variant} n=${n}: ${r.games} games, avg ${Math.round(r.steps / r.games)} moves, transfers ${r.transfers}, losers`, r.outcomes);
  }
}
for (let n = 2; n <= 4; n++) {
  const r = run(battle, {}, n, 200);
  console.log(`battle n=${n}: ${r.games} games, avg ${Math.round(r.steps / r.games)} shots, winners`, r.outcomes);
}
const mafiaCheck = G => {
  const live = G.alive.filter(Boolean).length;
  if (!G.over && live < 2) throw new Error('game not over with < 2 alive');
  G.players.forEach((_, i) => { const v = mafia.view(G, i);
    if (G.roles[i] !== 'mafia' && v.chat.some(c => c.ch === 'mafia') && !G.over) throw new Error('mafia chat leaked');
    v.players.forEach((p, j) => { if (p.role && j !== i && G.alive[j] && !G.over && !(G.roles[i] === 'mafia' && G.roles[j] === 'mafia')) throw new Error('role leaked'); });
  });
};
for (let n = 5; n <= 12; n++) {
  const r = run(mafia, {}, n, 300, mafiaCheck);
  console.log(`mafia n=${n}: ${r.games} games, avg ${Math.round(r.steps / r.games)} steps, winners`, r.outcomes);
}
console.log('OK');
