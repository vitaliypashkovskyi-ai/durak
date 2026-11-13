// Two guests open a Spy room and wait for a third player (the browser), then the host starts.
const code = process.argv[2] || 'SPYTST';
const mk = (name, create) => {
  const ws = new WebSocket(`ws://localhost:8787/ws/room?room=${code}`);
  const p = { ws, lobby: null };
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', guest: { id: (name + 'zzzzzzzzzzzz').slice(0, 12), name }, create }));
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.type === 'lobby') p.lobby = m; };
  return p;
};
const a = mk('Anna', { game: 'spy' });
await new Promise(r => setTimeout(r, 500));
const b = mk('Bohdan');
console.log('room', code);
for (let k = 0; k < 120; k++) {
  await new Promise(r => setTimeout(r, 500));
  if (a.lobby && a.lobby.seats.length === 3) { a.ws.send(JSON.stringify({ t: 'start' })); console.log('started'); break; }
}
await new Promise(r => setTimeout(r, 4000));
b.ws.send(JSON.stringify({ t: 'say', text: 'Привіт! Мені тут подобається 🙂' }));
b.ws.send(JSON.stringify({ t: 'react', e: '🤔' }));
await new Promise(r => setTimeout(r, 90000));
process.exit(0);
