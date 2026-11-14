// Local check of the random queue for a 3-player game: two guests look for «Тисяча»;
// after the wait they get one room, it starts by itself and a bot takes the third seat.
// Run: node tests/match-local.mjs   (needs `npx wrangler dev --port 8787` in server/)
const BASE = 'ws://localhost:8787';
function guest(name) {
  return new Promise(resolve => {
    const id = 'test' + Math.random().toString(36).slice(2, 12);
    const ws = new WebSocket(`${BASE}/ws/match?game=thousand`);
    const log = [];
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', guest: { id, name } }));
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.type === 'waiting') log.push(`${m.found}/${m.want}`);
      if (m.type === 'matched') resolve({ id, name, room: m.room, humans: m.humans, fill: m.fill, log });
    };
  });
}
function join(g) {
  return new Promise(resolve => {
    const ws = new WebSocket(`${BASE}/ws/room?room=${g.room}`);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', guest: { id: g.id, name: g.name }, create: { game: 'thousand', auto: g.humans, fill: g.fill } }));
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.type === 'state') { resolve({ players: m.players.map(p => (p.bot ? '🤖' : '') + p.name) }); ws.close(); }
    };
  });
}
const t0 = Date.now();
const a = guest('Аня'); await new Promise(r => setTimeout(r, 500));
const b = guest('Богдан');
const [ga, gb] = await Promise.all([a, b]);
console.log(`matched after ${Math.round((Date.now() - t0) / 1000)} s:`, ga.room === gb.room ? 'same room' : 'DIFFERENT rooms', `humans ${ga.humans}, table ${ga.fill}`, 'queue log', ga.log.join(' '));
const [sa] = await Promise.all([join(ga), join(gb)]);
console.log('game started with:', sa.players.join(', '));
const ping = await (await fetch('http://localhost:8787/api/ping', { method: 'POST', body: JSON.stringify({ gid: ga.id }) })).json();
console.log('online:', ping.online);
process.exit(0);
