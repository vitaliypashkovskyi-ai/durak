// Finds a durak game that does not finish and prints the repeating moves.
import * as E from '../js/durak-engine.js';
const S = c => E.RANKS[c.r] + E.SUITS[c.s];
for (let g = 0; g < 60000; g++) {
  const n = 2 + (g % 5);
  const variant = g % 2 ? 'perevod' : 'podkidnoy';
  const G = E.create({ variant }, Array.from({ length: n }, (_, i) => ({ name: 'B' + i, bot: true })));
  const log = [];
  let steps = 0;
  while (!G.over && steps < 3000) {
    steps++;
    if (E.pendingAdvance(G)) { E.advance(G); log.push('-- end bout'); continue; }
    let acted = false;
    for (let i = 0; i < n && !acted; i++) {
      const a = E.botAction(G, i);
      if (!a) continue;
      if (!E.act(G, i, a)) { console.log('REJECTED', i, a); process.exit(1); }
      log.push(`${i}:${a.t}${a.id != null ? ' ' + S({ s: Math.floor(a.id / 9), r: a.id % 9 }) : ''} | a${G.attacker} d${G.defender} t${G.table.length} deck${G.deck.length} hands ${G.hands.map(h => h.length)}`);
      acted = true;
    }
    if (!acted) { console.log('STUCK'); process.exit(1); }
  }
  if (!G.over) {
    console.log(`game ${g}: n=${n} ${variant} not over after ${steps} steps; done=${G.done}`);
    console.log(log.slice(-40).join('\n'));
    process.exit(1);
  }
}
console.log('no loop found');
