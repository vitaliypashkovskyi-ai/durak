// Local check of the rating: two Telegram-signed players (test token from server/.dev.vars) play
// sea battle on `wrangler dev`, then /api/top and /api/profile must show the result.
// Run: node tests/rating-local.mjs   (needs `npx wrangler dev --port 8787` in server/)
import { createHmac } from 'node:crypto';

const BASE = 'localhost:8787', TOKEN = '123456:local-test-token';
function initData(user) {
  const f = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) };
  const dcs = Object.keys(f).sort().map(k => `${k}=${f[k]}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  return new URLSearchParams({ ...f, hash: createHmac('sha256', secret).update(dcs).digest('hex') }).toString();
}
function player(code, user, create) {
  const ws = new WebSocket(`ws://${BASE}/ws/room?room=${code}`);
  const p = { ws, view: null, user };
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', init: initData(user), create }));
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.type === 'lobby' && m.you === m.host && m.seats.length === 2) ws.send(JSON.stringify({ t: 'start' }));
    if (m.type !== 'state') return;
    p.view = m;
    if (m.over) return;
    if (m.phase === 'place' && !m.players[m.seat].ready) ws.send(JSON.stringify({ t: 'ready' }));
    if (m.phase === 'play' && m.turn === m.seat) {
      const t = 1 - m.seat, cell = m.boards[t].shots.findIndex(s => !s);
      ws.send(JSON.stringify({ t: 'shoot', target: t, cell }));
    }
  };
  return p;
}
const code = 'R' + Math.random().toString(36).slice(2, 7).toUpperCase();
const a = player(code, { id: 501, first_name: 'Олена' }, { game: 'battle' });
await new Promise(r => setTimeout(r, 800));
const b = player(code, { id: 502, first_name: 'Іван' }, null);
for (let i = 0; i < 120 && !(a.view && a.view.over); i++) await new Promise(r => setTimeout(r, 500));
console.log('over:', !!(a.view && a.view.over), 'winner seat:', a.view && a.view.winner);
await new Promise(r => setTimeout(r, 1000));
console.log('top all:', JSON.stringify(await (await fetch(`http://${BASE}/api/top?period=all`)).json()));
console.log('top week:', JSON.stringify(await (await fetch(`http://${BASE}/api/top?period=week`)).json()));
const prof = await (await fetch(`http://${BASE}/api/profile`, { method: 'POST', body: JSON.stringify({ init: initData({ id: 501, first_name: 'Олена' }) }) })).json();
console.log('profile Олена:', JSON.stringify({ points: prof.points, games: prof.games, rank: prof.rank, level: prof.level.name, week: prof.week }));
const hook = await fetch(`http://${BASE}/tg/hook`, { method: 'POST', body: '{}' });
console.log('webhook without secret ->', hook.status);
a.ws.close(); b.ws.close();
setTimeout(() => process.exit(0), 300);
