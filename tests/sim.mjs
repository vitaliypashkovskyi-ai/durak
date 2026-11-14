// Bot-vs-bot simulation: node tests/sim.mjs
import * as durak from '../js/durak-engine.js';
import * as battle from '../js/battle-engine.js';
import * as mafia from '../js/mafia-engine.js';
import * as thousand from '../js/thousand-engine.js';
import * as spy from '../js/spy-engine.js';
import * as goat from '../js/goat-engine.js';
import * as rpoker from '../js/rpoker-engine.js';
import * as svara from '../js/svara-engine.js';

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
  if (total !== G.total) throw new Error('card count ' + total + ' of ' + G.total);
  const ids = new Set(G.hands.flat().map(c => c.id));
  if (ids.size !== G.hands.flat().length) throw new Error('duplicate card id in hands');
  if (G.table.length > 6) throw new Error('table > 6');
  if (!G.over && G.defender === G.attacker) throw new Error('attacker = defender');
};

for (const deck of [36, 52, 72]) {
  for (const variant of ['podkidnoy', 'perevod', 'both']) {
    for (const n of [2, 3, 4, 6, 8, 10, 12].filter(k => k <= durak.DECKS[deck].max)) {
      const r = run(durak, { variant, deck }, n, 200, durakCheck);
      console.log(`durak ${deck} ${variant} n=${n}: avg ${Math.round(r.steps / r.games)} moves, transfers ${r.transfers}, draws ${r.outcomes['-1'] || 0}`);
    }
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
{
  let deals = 0, made = 0, contracts = 0, marriagesSeen = 0;
  const thStats = {};
  const thCheck = G => {
    const cards = G.hands.flat().length + G.talon.length + G.trick.length;
    if (G.phase === 'bid' && cards !== 24) throw new Error('thousand card count ' + cards);
    const ids = new Set(G.hands.flat().map(c => c.id));
    if (ids.size !== G.hands.flat().length) throw new Error('duplicate card');
    if (G.phase === 'score' && G.result && G.result.__seen !== true) {
      G.result.__seen = true; deals++; contracts += G.contract;
      if (G.result[G.declarer].made) made++;
      const key = G.contract === 100 ? 'c100' : 'cMore';
      thStats[key] = thStats[key] || [0, 0]; thStats[key][0]++; if (G.result[G.declarer].made) thStats[key][1]++;
      marriagesSeen += G.marr.filter(Boolean).length;
      const pts = G.taken.reduce((a, b) => a + b, 0);
      if (pts !== 120) throw new Error('trick points ' + pts);
    }
  };
  const r = run(thousand, {}, 3, 100, thCheck);
  console.log(`thousand: ${r.games} games, avg ${Math.round(deals / r.games)} deals, contracts made ${Math.round(100 * made / deals)}%, avg contract ${Math.round(contracts / deals)}, marriages ${marriagesSeen}, winners`, r.outcomes, 'made by contract [deals, made]:', JSON.stringify(thStats));
}
{
  const spyCheck = G => {
    const v = spy.view(G, G.spy);
    if (!G.over && v.loc !== null) throw new Error('location leaked to the spy');
  };
  for (const n of [3, 6, 10]) {
    const r = run(spy, {}, n, 200, spyCheck);
    console.log(`spy n=${n}: ${r.games} games, winners`, r.outcomes);
  }
}
{
  let deals = 0, eggs = 0, gains = {};
  const goatCheck = G => {
    const ids = new Set(G.hands.flat().map(c => c.id));
    if (ids.size !== G.hands.flat().length) throw new Error('goat duplicate card');
    if (G.phase === 'play' && G.hands.flat().length + G.trick.length + (G.tricks[0] + G.tricks[1]) * 4 !== 36) throw new Error('goat card count');
    if (G.phase === 'score' && G.result && !G.result.__seen) {
      G.result.__seen = true; deals++;
      if (G.taken[0] + G.taken[1] !== 120) throw new Error('goat points ' + (G.taken[0] + G.taken[1]));
      if (G.result.eggs) eggs++; else gains[G.result.gain] = (gains[G.result.gain] || 0) + 1;
    }
  };
  const r = run(goat, {}, 4, 300, goatCheck);
  console.log(`goat: ${r.games} games, avg ${Math.round(deals / r.games)} deals, eggs ${eggs}, gains`, gains, 'winners (team)', r.outcomes);
}
{
  for (const deck of [36, 54]) for (const length of ['full', 'short']) for (const n of [2, 3, 4, 6, 8].filter(k => k <= rpoker.DECKS[deck].max)) {
    let deals = 0, exact = 0, bids = 0;
    const check = G => {
      const ids = new Set(G.hands.flat().map(c => c.id));
      if (ids.size !== G.hands.flat().length) throw new Error('rpoker duplicate card');
      if (G.phase === 'bid' && G.bids.every(b => b != null) ) throw new Error('bidding not closed');
      if (G.phase === 'play' && G.type !== 'mizer' && G.bids.reduce((a, b) => a + b, 0) === G.k) throw new Error('bids sum equals cards');
      if (G.phase === 'score' && G.result && !G.result.__seen) {
        G.result.__seen = true; deals++;
        if (G.taken.reduce((a, b) => a + b, 0) !== G.k) throw new Error('tricks != cards');
        if (G.type !== 'mizer') G.result.forEach(r => { bids++; if (r.bid === r.took) exact++; });
      }
    };
    const r = run(rpoker, { deck, length }, n, 30, check);
    console.log(`rpoker ${deck} ${length} n=${n}: ${deals / r.games} deals/game, exact bids ${Math.round(100 * exact / bids)}%`);
  }
}
{
  // scores
  const C = (r, s) => ({ r, s, id: s * 9 + r });
  const cases = [[[C(0,0),C(0,2),C(0,3)],34],[[C(8,0),C(8,2),C(8,3)],33],[[C(8,0),C(8,2),C(0,3)],22],[[C(8,0),C(7,0),C(4,0)],31],
    [[C(1,1),C(8,0),C(7,0)],32],[[C(1,1),C(0,0),C(0,2)],34],[[C(1,1),C(3,2),C(2,3)],20],[[C(4,0),C(4,2),C(4,3)],30],[[C(0,0),C(1,0),C(2,2)],13]];
  for (const [h, want] of cases) if (svara.score(h) !== want) throw new Error(`svara score ${JSON.stringify(h)} = ${svara.score(h)}, want ${want}`);
  for (const length of ['short', 'full']) for (const n of [2, 3, 5, 8]) {
    let hands = 0, svaras = 0, shows = 0, folds = 0, maxPot = 0;
    const check = G => {
      const total = G.chips.reduce((a, b) => a + b, 0) + G.pot;
      if (total !== svara.START * n) throw new Error('svara chips ' + total);
      if (G.chips.some(c => c < 0)) throw new Error('svara negative chips');
      const ids = new Set(G.hands.flat().map(c => c.id));
      if (ids.size !== G.hands.flat().length) throw new Error('svara duplicate card');
      if (G.phase === 'show' && G.result && !G.result.__seen) {
        G.result.__seen = true; hands++;
        if (G.result.svara) svaras++; else if (G.result.shown.length) shows++; else folds++;
        maxPot = Math.max(maxPot, G.result.pot);
      }
    };
    const r = run(svara, { length }, n, 40, check);
    console.log(`svara ${length} n=${n}: ${(hands / r.games).toFixed(1)} hands/game, show ${shows} fold ${folds} svara ${svaras}, max pot ${maxPot}`, 'winners', r.outcomes);
  }
}
console.log('OK');
