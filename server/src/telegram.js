import { SHOP } from '../../js/shop.js';
// Telegram side of the server: Bot API calls, the webhook (commands in private chats and in the
// players' group), the players' chat / news channel lookup.
import * as durak from '../../js/durak-engine.js';

export const BOT = 'IgryUA_bot';
export const CHANNEL = '@UAIgry';
export const APP_URL = 'https://www.igryua.biz.ua/';
export const GAMES = {
  durak: { icon: '🃏', title: 'Дурень' },
  battle: { icon: '🚢', title: 'Морський бій' },
  mafia: { icon: '🎭', title: 'Мафія' },
  thousand: { icon: '🂡', title: 'Тисяча' },
  spy: { icon: '🕵️', title: 'Шпигун' },
  goat: { icon: '🐐', title: 'Козел' },
  rpoker: { icon: '🎯', title: 'Розписний покер' },
  svara: { icon: '🎴', title: 'Свара' },
  checkers: { icon: '⚪', title: 'Шашки' },
  nardy: { icon: '🎲', title: 'Нарди' },
  dice: { icon: '⚀', title: 'Кості' },
};
export const joinUrl = code => `https://t.me/${BOT}?startapp=${code}`;

export async function tg(env, method, params) {
  if (!env.BOT_TOKEN_2) return { ok: false, description: 'no token' };
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN_2}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
  });
  return r.json();
}

export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function cfgLabel(cfg) {
  if (cfg.game !== 'durak') return '';
  return `${durak.VARIANTS[durak.variantOf(cfg)].label}, ${durak.DECKS[durak.deckOf(cfg)].label}`;
}

const stats = env => env.STATS.get(env.STATS.idFromName('main'));
export async function statsCall(env, path, body) {
  const r = await stats(env).fetch('https://stats' + path, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) });
  return r.json();
}

// ---------- Telegram Stars ----------
// payload = "<item>:<telegram user id>"
export async function invoiceLink(env, user, item) {
  const it = SHOP[item];
  if (!it) return null;
  const r = await tg(env, 'createInvoiceLink', {
    title: it.title, description: it.desc, payload: `${item}:${user.id.slice(3)}`,
    provider_token: '', currency: 'XTR', prices: [{ label: it.title, amount: it.price }],
  });
  return r.ok ? r.result : null;
}
async function preCheckout(q, env) {
  const [item, uid] = String(q.invoice_payload || '').split(':');
  const it = SHOP[item];
  const ok = !!it && q.currency === 'XTR' && q.total_amount === it.price && uid === String(q.from.id);
  return tg(env, 'answerPreCheckoutQuery', { pre_checkout_query_id: q.id, ok, ...(ok ? {} : { error_message: 'Товар змінився — відкрийте магазин ще раз.' }) });
}
async function paid(msg, env) {
  const p = msg.successful_payment;
  const [item] = String(p.invoice_payload || '').split(':');
  const r = await statsCall(env, '/buy', { id: 'tg:' + msg.from.id, item, stars: p.total_amount, charge: p.telegram_payment_charge_id });
  const it = SHOP[item];
  const text = item === 'vip'
    ? `💎 Дякуємо! VIP діє до <b>${new Date(r.vip_until || Date.now()).toLocaleDateString('uk-UA', { timeZone: 'Europe/Kyiv' })}</b>: значок 💎 біля імені й усі преміум-оформлення.`
    : `🎉 Дякуємо за покупку! «${esc(it ? it.title : item)}» — ваше назавжди. Оберіть у грі: 🎨 Оформлення.`;
  return tg(env, 'sendMessage', { chat_id: msg.chat.id, parse_mode: 'HTML', text });
}

export function adminText(a) {
  const name = g => (GAMES[g] ? GAMES[g].icon + ' ' + GAMES[g].title : g);
  const list = rows => (rows.length ? rows.map(r => `${name(r.game)} — ${r.n}`).join('\n') : '—');
  const bots = c => { const r = Object.entries(c).filter(([k]) => k.startsWith('bot:')).sort((x, y) => y[1] - x[1]);
    return r.length ? r.map(([k, n]) => `${name(k.slice(4))} — ${n}`).join('\n') : '—'; };
  const total = c => Object.entries(c).filter(([k]) => k.startsWith('bot:')).reduce((s, [, n]) => s + n, 0);
  const sumRows = rows => rows.reduce((s, r) => s + r.n, 0);
  return `📊 <b>Статистика «Ігри UA»</b>

👥 Гравців усього: <b>${a.players}</b>
🆕 Нових: сьогодні <b>${a.newToday}</b> · за тиждень <b>${a.new7}</b> (за запрошенням ${a.refs7})
🎮 Заходили: сьогодні <b>${a.activeToday}</b> · за тиждень <b>${a.active7}</b>
🟢 Зараз онлайн: <b>${a.online}</b>

🌐 <b>Онлайн-ігри</b> сьогодні ${sumRows(a.onlineToday)} · за тиждень ${sumRows(a.online7)}:
${list(a.online7)}

🤖 <b>Ігри з ботами</b> сьогодні ${total(a.botToday)} · за тиждень ${total(a.bot7)}:
${bots(a.bot7)}

🔔 Нагадування: можна писати ${a.reminders.canWrite}, вимкнули ${a.reminders.muted}, надіслано сьогодні ${a.reminders.today}

⭐ <b>Stars</b>: сьогодні ${a.stars.today} · за тиждень ${a.stars.week} · усього ${a.stars.all} (покупців ${a.stars.buyers}, VIP зараз ${a.stars.vips})`;
}

export function topText(rows, title) {
  if (!rows.length) return `${title}\n\nПоки що порожньо — зіграйте онлайн з друзями, щоб потрапити сюди!`;
  const medal = i => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
  return `${title}\n\n` + rows.map((r, i) => `${medal(i)} ${esc(r.name)} — <b>${r.points}</b> оч. (${r.wins} перемог)`).join('\n');
}

// ---------- webhook ----------
const GROUP_CMDS = { '/durak': 'durak', '/battle': 'battle', '/mafia': 'mafia', '/thousand': 'thousand', '/spy': 'spy', '/kozel': 'goat', '/poker': 'rpoker', '/svara': 'svara', '/shashky': 'checkers', '/checkers': 'checkers', '/nardy': 'nardy', '/kosti': 'dice' };

export async function handleUpdate(update, env, makeRoom) {
  if (update.callback_query) return handleCallback(update.callback_query, env, makeRoom);
  if (update.pre_checkout_query) return preCheckout(update.pre_checkout_query, env);
  const msg = update.message;
  if (msg && msg.successful_payment) return paid(msg, env);
  if (!msg || typeof msg.text !== 'string' || !msg.text.startsWith('/')) return;
  return handleCommand(msg, env, makeRoom);
}

// The game list as buttons: pressing one gathers a room right away.
const menuKeyboard = withPlay => ({
  inline_keyboard: [
    ...(withPlay ? [[{ text: '🎮 Відкрити ігри', web_app: { url: APP_URL } }]] : []),
    [{ text: '🃏 Дурень', callback_data: 'new:durak' }, { text: '🚢 Морський бій', callback_data: 'new:battle' }],
    [{ text: '🎭 Мафія', callback_data: 'new:mafia' }, { text: '🂡 Тисяча', callback_data: 'new:thousand' }],
    [{ text: '🕵️ Шпигун', callback_data: 'new:spy' }, { text: '🐐 Козел', callback_data: 'new:goat' }],
    [{ text: '🎯 Розписний покер', callback_data: 'new:rpoker' }, { text: '🎴 Свара', callback_data: 'new:svara' }],
    [{ text: '⚪ Шашки', callback_data: 'new:checkers' }, { text: '🎲 Нарди', callback_data: 'new:nardy' }],
    [{ text: '⚀ Кості', callback_data: 'new:dice' }, { text: '🏆 Топ тижня', callback_data: 'top' }],
  ],
});
const MENU_TEXT = '🎲 <b>Ігри UA</b> — оберіть гру, і бот збере кімнату. Хто натисне «Приєднатися», зайде до вас.';

async function gatherRoom(env, makeRoom, chatId, from, game) {
  const code = await makeRoom({ game });
  const g = GAMES[game], who = esc((from && from.first_name) || 'Хтось');
  return tg(env, 'sendMessage', {
    chat_id: chatId, parse_mode: 'HTML',
    text: `${g.icon} <b>${who}</b> збирає гру «${g.title}»!\nНатисніть кнопку, щоб приєднатися 👇`,
    reply_markup: { inline_keyboard: [[{ text: `▶ Приєднатися (${g.title})`, url: joinUrl(code) }]] },
  });
}

export async function handleCallback(q, env, makeRoom) {
  const chat = q.message && q.message.chat;
  if (!chat) return tg(env, 'answerCallbackQuery', { callback_query_id: q.id });
  if (q.data === 'notify:off' || q.data === 'notify:on') {
    const on = q.data === 'notify:on';
    await statsCall(env, '/notify', { id: 'tg:' + q.from.id, on });
    return tg(env, 'answerCallbackQuery', { callback_query_id: q.id, text: on ? '🔔 Нагадування увімкнено' : '🔕 Нагадування вимкнено. Увімкнути: /notify' });
  }
  if (q.data === 'top') {
    await tg(env, 'answerCallbackQuery', { callback_query_id: q.id });
    const rows = await statsCall(env, '/top?period=week');
    return tg(env, 'sendMessage', { chat_id: chat.id, parse_mode: 'HTML', text: topText(rows, '🏆 <b>Топ гравців тижня</b>') });
  }
  const game = typeof q.data === 'string' && q.data.startsWith('new:') ? q.data.slice(4) : null;
  if (!GAMES[game]) return tg(env, 'answerCallbackQuery', { callback_query_id: q.id });
  await tg(env, 'answerCallbackQuery', { callback_query_id: q.id, text: `${GAMES[game].icon} Збираю кімнату…` });
  return gatherRoom(env, makeRoom, chat.id, q.from, game);
}

async function handleCommand(msg, env, makeRoom) {
  const [full] = msg.text.trim().split(/\s+/);
  const [cmdRaw, at] = full.split('@');
  if (at && at.toLowerCase() !== BOT.toLowerCase()) return;   // a command for another bot
  const cmd = cmdRaw.toLowerCase();
  const chat = msg.chat;
  const reply = (text, extra = {}) => tg(env, 'sendMessage', { chat_id: chat.id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });

  if (cmd === '/top') {
    const rows = await statsCall(env, '/top?period=week');
    return reply(topText(rows, '🏆 <b>Топ гравців тижня</b>'));
  }
  const priv = chat.type === 'private';
  if (priv && cmd === '/stats') {
    // only for the admins of the news channel
    // ADMIN_TEST only in server/.dev.vars: no admin check, the text goes to the log
    const admins = env.ADMIN_TEST === '1' ? null : await tg(env, 'getChatAdministrators', { chat_id: CHANNEL });
    if (admins && (!admins.ok || !admins.result.some(a => a.user && a.user.id === msg.from.id && !a.user.is_bot))) return;
    const text = adminText(await statsCall(env, '/admin', {}));
    if (env.ADMIN_TEST === '1') console.log(text);
    return reply(text);
  }
  if (priv && cmd === '/paysupport') {
    return reply('💳 <b>Покупки за ⭐ Stars</b>\nЗа зірки продаються лише оформлення (сорочки карт, столи) і VIP-значок — на гру вони не впливають.\nЯкщо з покупкою щось не так — напишіть сюди або в чат @ua_Igry з позначкою «оплата», ми розберемося.');
  }
  if (priv && (cmd === '/stop' || cmd === '/notify')) {
    const on = cmd === '/notify';
    await statsCall(env, '/notify', { id: 'tg:' + msg.from.id, on, pm: true });
    return reply(on ? '🔔 Нагадування увімкнено: бонус дня, турнір тижня. Вимкнути — /stop' : '🔕 Нагадування вимкнено. Увімкнути знову — /notify');
  }
  // someone who writes to the bot privately can get reminders
  if (priv && msg.from) await statsCall(env, '/notify', { id: 'tg:' + msg.from.id, pm: true, name: msg.from.first_name }).catch(() => {});
  if (['/start', '/play', '/help', '/igry', '/games', '/menu'].includes(cmd)) {
    // web_app buttons work only in private chats
    return reply(MENU_TEXT, { reply_markup: menuKeyboard(priv) });
  }
  const game = GROUP_CMDS[cmd];
  if (!game) return;
  return gatherRoom(env, makeRoom, chat.id, msg.from, game);
}
