// Spy with talking bots on a fake clock: bots chat, guess and vote as they would in real time.
// node tests/spy-bots.mjs
import * as E from '../js/spy-engine.js';
let clock = 1_000_000;
Date.now = () => clock;

function play(n, show) {
  const G = E.create({}, Array.from({ length: n }, (_, i) => ({ name: ['Тарас', 'Оксана', 'Марко', 'Соломія', 'Богдан', 'Ірина', 'Остап'][i], bot: true })));
  for (let step = 0; step < 4000 && !G.over; step++) {
    clock += 500;
    let acted = false;
    for (let i = 0; i < n && !acted; i++) {
      const a = E.botAction(G, i);
      if (a) { if (!E.act(G, i, a)) throw new Error('rejected ' + JSON.stringify(a)); acted = true; }
    }
    if (!acted && E.advanceIn(G) <= 0) E.advance(G);
  }
  if (show) {
    console.log(`--- ${n} bots, location «${G.loc}», spy: ${G.players[G.spy].name}`);
    G.chat.forEach(c => console.log((c.from >= 0 ? G.players[c.from].name + ': ' : '   ') + c.text));
  }
  return G;
}
play(4, true);
const res = {};
let msgs = 0;
for (let g = 0; g < 300; g++) {
  const G = play(3 + (g % 5), false);
  if (!G.over) throw new Error('not over');
  const k = G.winner + ':' + G.reason;
  res[k] = (res[k] || 0) + 1;
  msgs += G.chat.filter(c => c.from >= 0).length;
}
console.log('outcomes:', res, '| avg bot messages per game:', Math.round(msgs / 300));
