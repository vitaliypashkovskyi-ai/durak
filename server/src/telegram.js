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
  nardy: { icon: '🎲', title: 'Довгі нарди' },
  dice: { icon: '⚀', title: 'Кості' },
  spider: { icon: '🕷', title: 'Павук' },
  mines: { icon: '💣', title: 'Сапер' },
  bgammon: { icon: '🎲', title: 'Короткі нарди' },
  pref: { icon: '🎩', title: 'Преферанс' },
  quiz: { icon: '❓', title: 'Вікторина' },
  klondike: { icon: '🂠', title: 'Косинка' },
  chess: { icon: '♟', title: 'Шахи' },
};
const EN_TITLES = { durak: 'Durak', battle: 'Battleship', mafia: 'Mafia', thousand: 'Thousand', spy: 'Spy', goat: 'Kozel', rpoker: 'Painted Poker',
  svara: 'Svara', checkers: 'Checkers', nardy: 'Long Backgammon', dice: 'Dice Poker', spider: 'Spider', mines: 'Minesweeper', bgammon: 'Backgammon',
  pref: 'Preferans', quiz: 'Quiz', klondike: 'Klondike', chess: 'Chess' };
for (const k in GAMES) GAMES[k].en = EN_TITLES[k] || GAMES[k].title;
// Same rule as the game page: Ukrainian, Russian and Belarusian speakers get Ukrainian, everyone else English.
export const isEn = from => !/^(uk|ru|be)/i.test((from && from.language_code) || 'uk');
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

// ---------- inline mode: «@IgryUA_bot …» in any chat; the game opens it with switchInlineQuery ----------
// query: "r CODE game" — invite to a room; "w game" — I won; anything else — a general invitation.
// Every link carries the sender's id, so a friend who joins brings him +15.
const PIC = 'https://www.igryua.biz.ua/promo/promo-wide.png';
async function inlineQuery(q, env) {
  const ref = '_r' + q.from.id, words = String(q.query || '').trim().split(/\s+/);
  const results = [];
  const card = (id, title, description, text, button, url) => results.push({
    type: 'article', id, title, description, thumbnail_url: PIC,
    input_message_content: { message_text: text, parse_mode: 'HTML' },
    reply_markup: { inline_keyboard: [[{ text: button, url }]] },
  });
  const name = esc(q.from.first_name || 'Друг');
  if (isEn(q.from)) {
    const G = id => (GAMES[id] ? { icon: GAMES[id].icon, title: GAMES[id].en } : null);
    if (words[0] === 'r' && /^[A-Z0-9]{4,8}$/.test(words[1] || '')) {
      const g = G(words[2]) || { icon: '🎲', title: 'a game' };
      card('room' + words[1], `${g.icon} Invite to ${g.title}`, `Room ${words[1]} — your friend joins your table at once`,
        `🎲 <b>${name}</b> invites you to play ${g.icon} <b>${esc(g.title)}</b>!\nRoom ${words[1]} — tap the button and take a seat.`, '▶ Join', joinUrl(words[1] + ref));
    } else if (words[0] === 'k' && /^[A-Z0-9]{5}$/.test(words[1] || '')) {
      card('club' + words[1], '🏠 Invite to the club', `Club code ${words[1]}`,
        `🏠 <b>${name}</b> invites you to their club in «Ігри UA»! We play together and compete with other clubs 🏆`, '🏠 Join the club', `https://t.me/${BOT}?startapp=club-${words[1]}`);
    } else if (words[0] === 'w' && G(words[1])) {
      const g = G(words[1]);
      card('win' + words[1], '🏆 Show off the win', `${g.icon} ${g.title}`,
        `🏆 <b>${name}</b> just won at ${g.icon} <b>${esc(g.title)}</b>!\nCan you do better? Play «Ігри UA» 🎲`, `${g.icon} Play`, `https://t.me/${BOT}?startapp=r${q.from.id}`);
    }
    card('invite', '🎲 Invite to «Ігри UA»', 'Durak, Poker, Chess, Backgammon and 14 more games — +5 bonus for your friend',
      `🎲 <b>${name}</b> invites you to «Ігри UA»: Durak, Poker, Preferans, Chess, Backgammon, Mafia and 12 more games — right in Telegram!`,
      '🎲 Play', `https://t.me/${BOT}?startapp=r${q.from.id}`);
    return tg(env, 'answerInlineQuery', { inline_query_id: q.id, results, cache_time: 0, is_personal: true });
  }
  if (words[0] === 'r' && /^[A-Z0-9]{4,8}$/.test(words[1] || '')) {
    const g = GAMES[words[2]] || { icon: '🎲', title: 'гру' };
    card('room' + words[1], `${g.icon} Запросити в ${g.title}`, `Кімната ${words[1]} — друг одразу сяде за ваш стіл`,
      `🎲 <b>${name}</b> кличе тебе зіграти: ${g.icon} <b>${esc(g.title)}</b>!
Кімната ${words[1]} — натисни кнопку й сідай за стіл.`,
      `▶ Приєднатися`, joinUrl(words[1] + ref));
  } else if (words[0] === 'k' && /^[A-Z0-9]{5}$/.test(words[1] || '')) {
    card('club' + words[1], '🏠 Запросити в клуб', `Код клубу ${words[1]}`,
      `🏠 <b>${name}</b> кличе тебе у свій клуб в «Ігри UA»! Граємо разом і змагаємося з іншими клубами 🏆`,
      '🏠 Вступити в клуб', `https://t.me/${BOT}?startapp=club-${words[1]}`);
  } else if (words[0] === 'w' && GAMES[words[1]]) {
    const g = GAMES[words[1]];
    card('win' + words[1], `🏆 Похвалитися перемогою`, `${g.icon} ${g.title}`,
      `🏆 <b>${name}</b> щойно виграв у ${g.icon} <b>${esc(g.title)}</b>!
Зможеш краще? Грай в «Ігри UA» 🎲`,
      `${g.icon} Зіграти`, `https://t.me/${BOT}?startapp=r${q.from.id}`);
  }
  card('invite', '🎲 Запросити в «Ігри UA»', 'Дурень, Покер, Шахи, Нарди й ще 11 ігор — бонус +5 другові',
    `🎲 <b>${name}</b> запрошує тебе в «Ігри UA»: Дурень, Покер, Преферанс, Шахи, Нарди, Мафія й ще 9 ігор — прямо в Telegram!`,
    '🎲 Грати', `https://t.me/${BOT}?startapp=r${q.from.id}`);
  return tg(env, 'answerInlineQuery', { inline_query_id: q.id, results, cache_time: 0, is_personal: true });
}

// ---------- Telegram Stars ----------
// payload = "<item>:<telegram user id>"
export async function invoiceLink(env, user, item, en) {
  const it = SHOP[item];
  if (!it) return null;
  const [title, desc] = en && it.en ? it.en : [it.title, it.desc];
  const r = await tg(env, 'createInvoiceLink', {
    title, description: desc, payload: `${item}:${user.id.slice(3)}`,
    provider_token: '', currency: 'XTR', prices: [{ label: title, amount: it.price }],
  });
  return r.ok ? r.result : null;
}
async function preCheckout(q, env) {
  const [item, uid] = String(q.invoice_payload || '').split(':');
  const it = SHOP[item];
  const ok = !!it && q.currency === 'XTR' && q.total_amount === it.price && uid === String(q.from.id);
  return tg(env, 'answerPreCheckoutQuery', { pre_checkout_query_id: q.id, ok, ...(ok ? {} : { error_message: isEn(q.from) ? 'The item has changed — open the shop again.' : 'Товар змінився — відкрийте магазин ще раз.' }) });
}
async function paid(msg, env) {
  const p = msg.successful_payment;
  const [item] = String(p.invoice_payload || '').split(':');
  const r = await statsCall(env, '/buy', { id: 'tg:' + msg.from.id, item, stars: p.total_amount, charge: p.telegram_payment_charge_id });
  const it = SHOP[item];
  const text = isEn(msg.from) ? (item === 'vip'
    ? `💎 Thank you! VIP is active until <b>${new Date(r.vip_until || Date.now()).toLocaleDateString('en-GB', { timeZone: 'Europe/Kyiv' })}</b>: the 💎 badge next to your name and all premium looks.`
    : `🎉 Thank you for the purchase! «${esc(it && it.en ? it.en[0] : item)}» is yours forever. Choose it in the game: 🎨 Looks.`)
    : item === 'vip'
    ? `💎 Дякуємо! VIP діє до <b>${new Date(r.vip_until || Date.now()).toLocaleDateString('uk-UA', { timeZone: 'Europe/Kyiv' })}</b>: значок 💎 біля імені й усі преміум-оформлення.`
    : `🎉 Дякуємо за покупку! «${esc(it ? it.title : item)}» — ваше назавжди. Оберіть у грі: 🎨 Оформлення.`;
  return tg(env, 'sendMessage', { chat_id: msg.chat.id, parse_mode: 'HTML', text });
}

export const SOURCE_NAMES = { direct: '🔗 напряму', friend: '👥 від друзів', channel: '📢 канал', group: '💬 чат', site: '🌐 сайт', seo: '🔎 Google', old: '⏳ до міток' };
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

🔔 Нагадування: можна писати ${a.reminders.canWrite}, вимкнули ${a.reminders.muted}, надіслано сьогодні ${a.reminders.today}\n\n🧭 <b>Звідки прийшли за тиждень</b>: ${a.sources && a.sources.length ? a.sources.map(s => `${SOURCE_NAMES[s.source] || s.source} ${s.n}`).join(' · ') : '—'}

⭐ <b>Stars</b>: сьогодні ${a.stars.today} · за тиждень ${a.stars.week} · усього ${a.stars.all} (покупців ${a.stars.buyers}, VIP зараз ${a.stars.vips})`;
}

export function topText(rows, title, en) {
  const medal = i => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
  if (en) {
    if (!rows.length) return `${title}\n\nEmpty so far — play online with friends to get here!`;
    return `${title}\n\n` + rows.map((r, i) => `${medal(i)} ${esc(r.name)} — <b>${r.points}</b> pts (${r.wins} wins)`).join('\n');
  }
  if (!rows.length) return `${title}\n\nПоки що порожньо — зіграйте онлайн з друзями, щоб потрапити сюди!`;
  return `${title}\n\n` + rows.map((r, i) => `${medal(i)} ${esc(r.name)} — <b>${r.points}</b> оч. (${r.wins} перемог)`).join('\n');
}

// ---------- webhook ----------
const GROUP_CMDS = { '/durak': 'durak', '/battle': 'battle', '/mafia': 'mafia', '/thousand': 'thousand', '/spy': 'spy', '/kozel': 'goat', '/poker': 'rpoker', '/svara': 'svara', '/shashky': 'checkers', '/checkers': 'checkers', '/nardy': 'nardy', '/kosti': 'dice', '/shakhy': 'chess', '/viktoryna': 'quiz', '/preferans': 'pref', '/korotki': 'bgammon' };

export async function handleUpdate(update, env, makeRoom) {
  if (update.callback_query) return handleCallback(update.callback_query, env, makeRoom);
  if (update.pre_checkout_query) return preCheckout(update.pre_checkout_query, env);
  if (update.inline_query) return inlineQuery(update.inline_query, env);
  const msg = update.message;
  if (msg && msg.successful_payment) return paid(msg, env);
  if (!msg || typeof msg.text !== 'string') return;
  // a plain message in a group: maybe a guess in Крокодил
  if (!msg.text.startsWith('/')) {
    if (msg.chat && msg.chat.type !== 'private' && msg.from && !msg.from.is_bot) {
      return statsCall(env, '/croc', { kind: 'msg', chat: msg.chat.id, from: { id: msg.from.id, name: msg.from.first_name }, text: msg.text });
    }
    return;
  }
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
    [{ text: '⚀ Кості', callback_data: 'new:dice' }, { text: '♟ Шахи', callback_data: 'new:chess' }],
    [{ text: '❓ Вікторина', callback_data: 'new:quiz' }, { text: '🎩 Преферанс', callback_data: 'new:pref' }],
    [{ text: '🎲 Короткі нарди', callback_data: 'new:bgammon' }, { text: '🏆 Топ тижня', callback_data: 'top' }],
  ],
});
const menuKeyboardEn = () => ({
  inline_keyboard: [[{ text: '🎮 Open the games', web_app: { url: APP_URL } }],
    ...[['durak', 'battle'], ['mafia', 'thousand'], ['spy', 'goat'], ['rpoker', 'svara'], ['checkers', 'nardy'], ['dice', 'chess'], ['quiz', 'pref']]
      .map(row => row.map(id => ({ text: `${GAMES[id].icon} ${GAMES[id].en}`, callback_data: 'new:' + id }))),
    [{ text: `${GAMES.bgammon.icon} ${GAMES.bgammon.en}`, callback_data: 'new:bgammon' }, { text: '🏆 Top of the week', callback_data: 'top' }]],
});
const MENU_TEXT_EN = '🎲 <b>Ігри UA</b> — pick a game and the bot gathers a room. Whoever taps «Join» sits at your table. Or open all 18 games with the button on top.';
const MENU_TEXT = '🎲 <b>Ігри UA</b> — оберіть гру, і бот збере кімнату. Хто натисне «Приєднатися», зайде до вас.';

async function gatherRoom(env, makeRoom, chatId, from, game, en) {
  const code = await makeRoom({ game });
  const g = GAMES[game], who = esc((from && from.first_name) || 'Хтось');
  if (en) return tg(env, 'sendMessage', {
    chat_id: chatId, parse_mode: 'HTML',
    text: `${g.icon} <b>${who}</b> is gathering a game of «${g.en}»!\nTap the button to join 👇`,
    reply_markup: { inline_keyboard: [[{ text: `▶ Join (${g.en})`, url: joinUrl(code) }]] },
  });
  return tg(env, 'sendMessage', {
    chat_id: chatId, parse_mode: 'HTML',
    text: `${g.icon} <b>${who}</b> збирає гру «${g.title}»!\nНатисніть кнопку, щоб приєднатися 👇`,
    reply_markup: { inline_keyboard: [[{ text: `▶ Приєднатися (${g.title})`, url: joinUrl(code) }]] },
  });
}

export async function handleCallback(q, env, makeRoom) {
  const chat = q.message && q.message.chat;
  if (!chat) return tg(env, 'answerCallbackQuery', { callback_query_id: q.id });
  if (typeof q.data === 'string' && q.data.startsWith('croc:')) {
    return statsCall(env, '/croc', { kind: 'cb', chat: chat.id, from: { id: q.from.id, name: q.from.first_name }, cbId: q.id, data: q.data });
  }
  if (q.data === 'notify:off' || q.data === 'notify:on') {
    const on = q.data === 'notify:on';
    await statsCall(env, '/notify', { id: 'tg:' + q.from.id, on });
    const en = isEn(q.from);
    return tg(env, 'answerCallbackQuery', { callback_query_id: q.id, text: on ? (en ? '🔔 Reminders on' : '🔔 Нагадування увімкнено') : (en ? '🔕 Reminders off. Turn on: /notify' : '🔕 Нагадування вимкнено. Увімкнути: /notify') });
  }
  if (q.data === 'top') {
    await tg(env, 'answerCallbackQuery', { callback_query_id: q.id });
    const rows = await statsCall(env, '/top?period=week');
    const en = chat.type === 'private' && isEn(q.from);
    return tg(env, 'sendMessage', { chat_id: chat.id, parse_mode: 'HTML', text: en ? topText(rows, '🏆 <b>Top players of the week</b>', true) : topText(rows, '🏆 <b>Топ гравців тижня</b>') });
  }
  const game = typeof q.data === 'string' && q.data.startsWith('new:') ? q.data.slice(4) : null;
  if (!GAMES[game]) return tg(env, 'answerCallbackQuery', { callback_query_id: q.id });
  const en = chat.type === 'private' && isEn(q.from);
  await tg(env, 'answerCallbackQuery', { callback_query_id: q.id, text: `${GAMES[game].icon} ${en ? 'Gathering a room…' : 'Збираю кімнату…'}` });
  return gatherRoom(env, makeRoom, chat.id, q.from, game, en);
}

async function handleCommand(msg, env, makeRoom) {
  const [full] = msg.text.trim().split(/\s+/);
  const [cmdRaw, at] = full.split('@');
  if (at && at.toLowerCase() !== BOT.toLowerCase()) return;   // a command for another bot
  const cmd = cmdRaw.toLowerCase();
  const chat = msg.chat;
  const reply = (text, extra = {}) => tg(env, 'sendMessage', { chat_id: chat.id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });

  const priv = chat.type === 'private';
  const en = priv && isEn(msg.from);          // groups stay Ukrainian: our community speaks it
  if (cmd === '/top') {
    const rows = await statsCall(env, '/top?period=week');
    return reply(en ? topText(rows, '🏆 <b>Top players of the week</b>', true) : topText(rows, '🏆 <b>Топ гравців тижня</b>'));
  }
  if (priv && cmd === '/stats') {
    // only for the admins of the news channel
    // ADMIN_TEST only in server/.dev.vars: no admin check, the text goes to the log
    const admins = env.ADMIN_TEST === '1' ? null : await tg(env, 'getChatAdministrators', { chat_id: CHANNEL });
    if (admins && (!admins.ok || !admins.result.some(a => a.user && a.user.id === msg.from.id && !a.user.is_bot))) return;
    const text = adminText(await statsCall(env, '/admin', {}));
    if (env.ADMIN_TEST === '1') console.log(text);
    return reply(text, { reply_markup: { inline_keyboard: [[{ text: '📊 Відкрити панель з графіками', web_app: { url: APP_URL + 'admin/' } }]] } });
  }
  if (cmd === '/krokodyl' || cmd === '/croc' || cmd === '/krokodil') {
    if (en) return reply('🐊 Krokodyl (a word-explaining game, in Ukrainian) is played in a group: add @IgryUA_bot to your chat as an admin and write /krokodyl — or play in our chat @ua_Igry.');
    if (priv) return reply('🐊 Крокодил грають у групі: додайте @IgryUA_bot у свій чат (адміністратором) і напишіть /krokodyl — або грайте в нашому чаті @ua_Igry.');
    return statsCall(env, '/croc', { kind: 'start', chat: chat.id, from: { id: msg.from.id, name: msg.from.first_name } });
  }
  if (priv && cmd === '/paysupport') {
    if (en) return reply('💳 <b>Purchases for ⭐ Stars</b>\nStars buy only looks (card backs, tables) and the VIP badge — they never change the game.\nIf something is wrong with a purchase, write here or in the chat @ua_Igry with the word «payment» — we will sort it out.');
    return reply('💳 <b>Покупки за ⭐ Stars</b>\nЗа зірки продаються лише оформлення (сорочки карт, столи) і VIP-значок — на гру вони не впливають.\nЯкщо з покупкою щось не так — напишіть сюди або в чат @ua_Igry з позначкою «оплата», ми розберемося.');
  }
  if (priv && (cmd === '/stop' || cmd === '/notify')) {
    const on = cmd === '/notify';
    await statsCall(env, '/notify', { id: 'tg:' + msg.from.id, on, pm: true, lang: en ? 'en' : 'uk' });
    if (en) return reply(on ? '🔔 Reminders are on: the daily bonus and the weekly tournament. Turn off — /stop' : '🔕 Reminders are off. Turn on again — /notify');
    return reply(on ? '🔔 Нагадування увімкнено: бонус дня, турнір тижня. Вимкнути — /stop' : '🔕 Нагадування вимкнено. Увімкнути знову — /notify');
  }
  // someone who writes to the bot privately can get reminders
  if (priv && msg.from) await statsCall(env, '/notify', { id: 'tg:' + msg.from.id, pm: true, name: msg.from.first_name, lang: en ? 'en' : 'uk' }).catch(() => {});
  if (['/start', '/play', '/help', '/igry', '/games', '/menu'].includes(cmd)) {
    // web_app buttons work only in private chats
    if (en) return reply(MENU_TEXT_EN, { reply_markup: menuKeyboardEn() });
    return reply(MENU_TEXT, { reply_markup: menuKeyboard(priv) });
  }
  const game = GROUP_CMDS[cmd];
  if (!game) return;
  return gatherRoom(env, makeRoom, chat.id, msg.from, game, en);
}
