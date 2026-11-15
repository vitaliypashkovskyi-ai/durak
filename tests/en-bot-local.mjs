// English bot replies (Telegram calls are caught, nothing is sent) + «Сапер дня» API on `wrangler dev`.
// Run: node tests/en-bot-local.mjs   (needs the local server from launch.json «durak-server»)
import { createHmac } from 'node:crypto';
const BASE = 'http://localhost:8787', TOKEN = '123456:local-test-token';
const realFetch = globalThis.fetch;
function initData(user) {
  const f = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) };
  const dcs = Object.keys(f).sort().map(k => `${k}=${f[k]}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  return new URLSearchParams({ ...f, hash: createHmac('sha256', secret).update(dcs).digest('hex') }).toString();
}
const post = async (path, body) => (await realFetch(BASE + path, { method: 'POST', body: JSON.stringify(body) })).json();

// ---- 1. the bot, offline: catch what it would send ----
const sent = [];
globalThis.fetch = async (url, o) => { sent.push({ method: String(url).split('/').pop(), body: JSON.parse(o.body) }); return { json: async () => ({ ok: true, result: 'https://t.me/$invoice' }) }; };
const { handleUpdate, invoiceLink } = await import('../server/src/telegram.js');
const env = { BOT_TOKEN_2: 'x', STATS: { idFromName: () => 1, get: () => ({ fetch: async () => ({ json: async () => [] }) }) } };
const makeRoom = async () => 'ABCD12';
const en = { id: 1, first_name: 'John', language_code: 'en' }, uk = { id: 2, first_name: 'Олег', language_code: 'uk' };
const last = () => sent[sent.length - 1];
for (const [who, from] of [['EN', en], ['UK', uk]]) {
  sent.length = 0;
  await handleUpdate({ message: { text: '/start', chat: { id: from.id, type: 'private' }, from } }, env, makeRoom);
  const m = last().body;
  console.log(`${who} /start   :`, m.text.slice(0, 70), '| buttons:', m.reply_markup.inline_keyboard.slice(0, 2).flat().map(b => b.text).join(', '));
  sent.length = 0;
  await handleUpdate({ callback_query: { id: 'q', data: 'new:chess', from, message: { chat: { id: from.id, type: 'private' } } } }, env, makeRoom);
  console.log(`${who} room     :`, sent.map(s => s.body.text).join(' || ').replace(/\n/g, ' '));
  sent.length = 0;
  await handleUpdate({ inline_query: { id: 'i', query: 'r ABCD12 durak', from } }, env, makeRoom);
  console.log(`${who} inline   :`, last().body.results.map(r => r.title).join(' / '));
  sent.length = 0;
  await handleUpdate({ message: { text: '/stop', chat: { id: from.id, type: 'private' }, from } }, env, makeRoom);
  console.log(`${who} /stop    :`, last().body.text);
}
sent.length = 0;
await handleUpdate({ message: { text: '/start', chat: { id: -100, type: 'supergroup' }, from: en } }, env, makeRoom);
console.log('EN in group:', last().body.text.slice(0, 50), '(the group stays Ukrainian)');
sent.length = 0;
await invoiceLink(env, { id: 'tg:1' }, 'velvet', true);
console.log('EN invoice :', sent[0].body.title, '—', sent[0].body.description);
globalThis.fetch = realFetch;

// ---- 2. the server: language saved, «Сапер дня» ----
const base = 700000 + Math.floor(Math.random() * 90000);
const a = { id: base, first_name: 'Ann', language_code: 'en' }, b = { id: base + 1, first_name: 'Богдан' };
console.log('hello en        :', JSON.stringify(await post('/api/hello', { init: initData(a), lang: 'en' })).slice(0, 60));
await post('/api/hello', { init: initData(b), lang: 'uk' });
console.log('challenge get   :', JSON.stringify(await post('/api/challenge', { init: initData(a), op: 'get' })));
console.log('a wins 95 s     :', JSON.stringify((await post('/api/challenge', { init: initData(a), op: 'done', won: true, secs: 95 })).me));
console.log('a again 20 s    :', JSON.stringify((await post('/api/challenge', { init: initData(a), op: 'done', won: true, secs: 20 })).me), '(first attempt stays)');
console.log('b wins 61 s     :', JSON.stringify((await post('/api/challenge', { init: initData(b), op: 'done', won: true, secs: 61 })).me));
const t = await post('/api/challenge', { op: 'get' });
console.log('table (guest)   :', JSON.stringify(t.top.slice(0, 3)), 'winners', t.winners, 'tries', t.tries);
console.log('too fast 2 s    :', JSON.stringify((await post('/api/challenge', { init: initData({ id: base + 2, first_name: 'Чит' }), op: 'done', won: true, secs: 2 })).me));
const d = await post('/api/daily', { init: initData(a) });
console.log('daily (chestIn) :', JSON.stringify({ bonus: d.bonus, chest: d.chest, chestIn: d.chestIn, streak: d.streak }));
