// Two Telegram-signed players in a local room: the lobby must carry each seat's level.
import { createHmac } from 'node:crypto';
const TOKEN = '123456:local-test-token';
function initData(user) {
  const f = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) };
  const dcs = Object.keys(f).sort().map(k => `${k}=${f[k]}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  return new URLSearchParams({ ...f, hash: createHmac('sha256', secret).update(dcs).digest('hex') }).toString();
}
const code = 'L' + Math.random().toString(36).slice(2, 7).toUpperCase();
const ws = new WebSocket(`ws://localhost:8787/ws/room?room=${code}`);
let last = null;
ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', init: initData({ id: 502, first_name: 'Іван' }), create: { game: 'durak' } }));
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.type === 'lobby') last = m; };
await new Promise(r => setTimeout(r, 1500));
console.log('lobby seats:', JSON.stringify(last.seats));
ws.close(); setTimeout(() => process.exit(0), 200);
