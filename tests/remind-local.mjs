// Reminders on `wrangler dev` (needs --test-scheduled, test token and REMIND_DAY_SHIFT=1 in server/.dev.vars):
// a player who opened the app (allows_write_to_pm) gets a candidate reminder «tomorrow»; one who switched them off does not.
// Run: node tests/remind-local.mjs, then look for «reminders {...}» in the wrangler log.
import { createHmac } from 'node:crypto';
const BASE = 'http://localhost:8787', TOKEN = '123456:local-test-token';
function initData(user) {
  const f = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) };
  const dcs = Object.keys(f).sort().map(k => `${k}=${f[k]}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  return new URLSearchParams({ ...f, hash: createHmac('sha256', secret).update(dcs).digest('hex') }).toString();
}
const post = async (path, body) => (await fetch(BASE + path, { method: 'POST', body: JSON.stringify(body) })).json();
const base = 700000 + Math.floor(Math.random() * 90000);
const a = { id: base, first_name: 'Нагадай', allows_write_to_pm: true }, b = { id: base + 1, first_name: 'Тиша', allows_write_to_pm: true };
console.log('hello a', JSON.stringify(await post('/api/hello', { init: initData(a) })));
console.log('hello b', JSON.stringify(await post('/api/hello', { init: initData(b) })));
console.log('b off  ', JSON.stringify(await post('/api/notify', { init: initData(b), on: false })));
console.log('a prof ', JSON.stringify((({ mute, pm_ok, last_seen }) => ({ mute, pm_ok, seen: !!last_seen }))(await post('/api/profile', { init: initData(a) }))));
console.log('cron   ', await (await fetch(BASE + '/__scheduled?cron=0+14+*+*+*')).text());
