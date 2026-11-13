// Welcome bonus and invites on `wrangler dev` (test token from server/.dev.vars).
import { createHmac } from 'node:crypto';
const BASE = 'http://localhost:8787', TOKEN = '123456:local-test-token';
function initData(user) {
  const f = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) };
  const dcs = Object.keys(f).sort().map(k => `${k}=${f[k]}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  return new URLSearchParams({ ...f, hash: createHmac('sha256', secret).update(dcs).digest('hex') }).toString();
}
const post = async (path, body) => (await fetch(BASE + path, { method: 'POST', body: JSON.stringify(body) })).json();
const base = 800000 + Math.floor(Math.random() * 90000);
const inviter = { id: base, first_name: 'Запрошувач' }, friend = { id: base + 1, first_name: 'Друг' };
console.log('inviter first visit :', JSON.stringify(await post('/api/hello', { init: initData(inviter) })));
console.log('inviter second visit:', JSON.stringify(await post('/api/hello', { init: initData(inviter) })));
console.log('friend via link     :', JSON.stringify(await post('/api/hello', { init: initData(friend), ref: String(base) })));
console.log('friend again        :', JSON.stringify(await post('/api/hello', { init: initData(friend), ref: String(base) })));
console.log('self-invite         :', JSON.stringify(await post('/api/hello', { init: initData({ id: base + 2, first_name: 'Хитрун' }), ref: String(base + 2) })));
const p = await post('/api/profile', { init: initData(inviter) });
console.log('inviter profile     :', JSON.stringify({ points: p.points, refs: p.refs, soul: p.achievements.find(a => a.name === 'Душа компанії') }));
