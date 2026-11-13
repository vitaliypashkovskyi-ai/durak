// Daily bonus and achievements on `wrangler dev` (test token from server/.dev.vars).
import { createHmac } from 'node:crypto';
const BASE = 'http://localhost:8787', TOKEN = '123456:local-test-token';
function initData(user) {
  const f = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) };
  const dcs = Object.keys(f).sort().map(k => `${k}=${f[k]}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  return new URLSearchParams({ ...f, hash: createHmac('sha256', secret).update(dcs).digest('hex') }).toString();
}
const user = { id: 700000 + Math.floor(Math.random() * 1000), first_name: 'Бонус' };
const post = async (path, body) => (await fetch(BASE + path, { method: 'POST', body: JSON.stringify(body) })).json();
console.log('first claim :', JSON.stringify(await post('/api/daily', { init: initData(user) })));
console.log('second claim:', JSON.stringify(await post('/api/daily', { init: initData(user) })));
const p = await post('/api/profile', { init: initData(user) });
console.log('profile     :', JSON.stringify({ points: p.points, daily: p.daily, achievements: p.achievements.length, done: p.achievements.filter(a => a.done).map(a => a.name) }));
console.log('guest claim :', JSON.stringify(await post('/api/daily', { init: 'hash=x' })));
