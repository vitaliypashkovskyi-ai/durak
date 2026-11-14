// Friends and daily quests on `wrangler dev` (test token in server/.dev.vars).
// B comes by A's link → they are friends; quests move with bot games and the daily bonus; A can call B once per 2 min.
// Run: node tests/social-local.mjs
import { createHmac } from 'node:crypto';
const BASE = 'http://localhost:8787', TOKEN = '123456:local-test-token';
function initData(user) {
  const f = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) };
  const dcs = Object.keys(f).sort().map(k => `${k}=${f[k]}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  return new URLSearchParams({ ...f, hash: createHmac('sha256', secret).update(dcs).digest('hex') }).toString();
}
const post = async (path, body) => (await fetch(BASE + path, { method: 'POST', body: JSON.stringify(body) })).json();
const base = 400000 + Math.floor(Math.random() * 90000);
const A = { id: base, first_name: 'Андрій', allows_write_to_pm: true }, B = { id: base + 1, first_name: 'Богдана', allows_write_to_pm: true };
await post('/api/hello', { init: initData(A) });
await post('/api/hello', { init: initData(B), ref: String(A.id) });
const fr = await post('/api/friends', { init: initData(A) });
console.log('A friends   :', JSON.stringify(fr.map(f => ({ name: f.name, pm: f.pm }))));
const q0 = await post('/api/quests', { init: initData(A) });
console.log('quests      :', q0.list.map(q => `${q.text} (${q.prog}/${q.need})`).join(' | '));
for (const game of ['durak', 'nardy', 'checkers', 'svara']) {
  const r = await post('/api/event', { t: 'bot', game, res: 'win', init: initData(A) });
  if (r.done.length) console.log('done after', game, ':', JSON.stringify(r.done));
}
const d = await post('/api/daily', { init: initData(A) });
console.log('daily quests:', JSON.stringify(d.quests));
const q1 = await post('/api/quests', { init: initData(A) });
console.log('quests now  :', q1.list.map(q => `${q.done ? '✅' : '⬜'} ${q.prog}/${q.need}`).join(' | '));
console.log('invite B    :', JSON.stringify(await post('/api/invite', { init: initData(A), to: 'tg:' + B.id, code: 'ABC123', game: 'durak' })), '(sendMessage fails locally: fake token)');
console.log('invite again:', JSON.stringify(await post('/api/invite', { init: initData(A), to: 'tg:' + B.id, code: 'ABC123', game: 'durak' })));
console.log('stranger    :', JSON.stringify(await post('/api/invite', { init: initData(A), to: 'tg:123', code: 'ABC123', game: 'durak' })));
