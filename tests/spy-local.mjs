// Three guests play Spy on `wrangler dev` (port 8787): chat, a reaction, call the vote, vote for the spy.
const BASE = 'ws://localhost:8787';
const code = 'S' + Math.random().toString(36).slice(2, 7).toUpperCase();
function player(name, create) {
  const id = (name + 'x'.repeat(12)).replace(/[^a-z]/gi, 'q').slice(0, 12);
  const ws = new WebSocket(`${BASE}/ws/room?room=${code}`);
  const p = { ws, name, view: null, lobby: null, reacts: [] };
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', guest: { id, name }, create }));
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.type === 'lobby') p.lobby = m;
    if (m.type === 'state') p.view = m;
    if (m.type === 'react') p.reacts.push(m.e);
  };
  return p;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const send = (p, o) => p.ws.send(JSON.stringify(o));
const a = player('Anna', { game: 'spy' }); await sleep(600);
const b = player('Bohdan'); const c = player('Vira'); await sleep(800);
console.log('lobby seats:', a.lobby.seats.map(s => s.name).join(', '), '| host can add bots? server refuses:');
send(a, { t: 'addBot' }); await sleep(400);
console.log('  seats after addBot:', a.lobby.seats.length);
send(a, { t: 'start' }); await sleep(800);
const all = [a, b, c];
console.log('cards:', all.map(p => `${p.name}=${p.view.role === 'spy' ? 'SPY' : p.view.loc}`).join(', '));
send(b, { t: 'react', e: '😂' }); await sleep(300);
console.log('reaction seen by A:', a.reacts.join(''));
while (a.view.phase === 'intro') await sleep(500);
send(a, { t: 'say', text: 'Тут тепло?' }); await sleep(300);
send(a, { t: 'callVote' }); send(b, { t: 'callVote' }); await sleep(600);
console.log('phase after 2 of 3 want vote:', a.view.phase);
const spySeat = all.findIndex(p => p.view.role === 'spy');
all.forEach((p, i) => send(p, { t: 'vote', i: i === spySeat ? (i + 1) % 3 : spySeat }));
for (let k = 0; k < 20 && !a.view.over; k++) await sleep(500);
console.log('over:', a.view.over, '| winner:', a.view.winner, '| reason:', a.view.reason, '| chat last:', a.view.chat.slice(-1)[0].text);
all.forEach(p => p.ws.close());
setTimeout(() => process.exit(0), 300);
