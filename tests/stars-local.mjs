// Telegram Stars on `wrangler dev` (test token in server/.dev.vars): a fake «paid» update must give the item,
// a repeated one must not count twice, VIP must show in the profile.
// Run: node tests/stars-local.mjs
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
const BASE = 'http://localhost:8787', TOKEN = '123456:local-test-token';
const SECRET = (fs.readFileSync(new URL('../server/.dev.vars', import.meta.url), 'utf8').match(/^WEBHOOK_SECRET=(.*)$/m) || [])[1];
function initData(user) {
  const f = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) };
  const dcs = Object.keys(f).sort().map(k => `${k}=${f[k]}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  return new URLSearchParams({ ...f, hash: createHmac('sha256', secret).update(dcs).digest('hex') }).toString();
}
const hook = body => fetch(BASE + '/tg/hook', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': SECRET.trim(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.status);
const uid = 600000 + Math.floor(Math.random() * 90000);
const user = { id: uid, first_name: 'Покупець' };
const paid = (item, stars, charge) => hook({ message: { chat: { id: uid, type: 'private' }, from: { id: uid }, successful_payment: { currency: 'XTR', total_amount: stars, invoice_payload: `${item}:${uid}`, telegram_payment_charge_id: charge } } });
console.log('pre-checkout ->', await hook({ pre_checkout_query: { id: 'q1', from: { id: uid }, currency: 'XTR', total_amount: 25, invoice_payload: `kozak:${uid}` } }));
console.log('paid kozak   ->', await paid('kozak', 25, 'ch-' + uid + '-1'));
console.log('paid again   ->', await paid('kozak', 25, 'ch-' + uid + '-1'));
console.log('paid vip     ->', await paid('vip', 75, 'ch-' + uid + '-2'));
await new Promise(r => setTimeout(r, 500));
const p = await (await fetch(BASE + '/api/profile', { method: 'POST', body: JSON.stringify({ init: initData(user) }) })).json();
console.log('profile      :', JSON.stringify({ owned: p.owned, vip: p.vip, days: Math.round((p.vip_until - Date.now()) / 864e5) }));
const inv = await (await fetch(BASE + '/api/shop', { method: 'POST', body: JSON.stringify({ init: initData(user), item: 'velvet' }) })).json();
console.log('invoice link :', JSON.stringify(inv), '(fails locally: fake token)');
