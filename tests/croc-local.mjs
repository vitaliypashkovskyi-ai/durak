// Крокодил on `wrangler dev` (test token): start in a group, a wrong and a right guess, the explainer leaking the word.
// Telegram calls fail locally (fake token); the game state is read back through the server log.
import fs from 'node:fs';
const SECRET = (fs.readFileSync(new URL('../server/.dev.vars', import.meta.url), 'utf8').match(/^WEBHOOK_SECRET=(.*)$/m) || [])[1].trim();
const hook = body => fetch('http://localhost:8787/tg/hook', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': SECRET, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.status);
const chat = { id: -100123456 - Math.floor(Math.random() * 1e6), type: "supergroup" };
const msg = (from, text) => hook({ message: { chat, from: { id: from, first_name: 'U' + from }, text } });
console.log('start', await msg(11, '/krokodyl'));
console.log('show ', await hook({ callback_query: { id: 'q1', from: { id: 11, first_name: 'U11' }, message: { chat }, data: 'croc:show' } }));
console.log('guess', await msg(22, 'а може це щось інше?'));
