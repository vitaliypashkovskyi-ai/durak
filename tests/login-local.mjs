// Telegram Login Widget on `wrangler dev` (test token): a correctly signed login is accepted, a forged one is not.
// Run: node tests/login-local.mjs
import { createHash, createHmac } from 'node:crypto';
const BASE = 'http://localhost:8787', TOKEN = '123456:local-test-token';
function login(user) {
  const f = { ...user, auth_date: String(Math.floor(Date.now() / 1000)) };
  const dcs = Object.keys(f).sort().map(k => `${k}=${f[k]}`).join('\n');
  const hash = createHmac('sha256', createHash('sha256').update(TOKEN).digest()).update(dcs).digest('hex');
  return 'tglogin:' + new URLSearchParams({ ...f, hash }).toString();
}
const post = async (path, body) => { const r = await fetch(BASE + path, { method: 'POST', body: JSON.stringify(body) }); return r.status + ' ' + (await r.text()).slice(0, 90); };
const u = { id: String(500000 + Math.floor(Math.random() * 90000)), first_name: 'Вебгравець' };
console.log('hello  :', await post('/api/hello', { init: login(u) }));
console.log('profile:', await post('/api/profile', { init: login(u) }));
console.log('forged :', await post('/api/profile', { init: login(u).replace(/hash=\w+/, 'hash=00ff') }));
