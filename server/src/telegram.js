// Telegram side of the server: Bot API calls, the webhook (commands in private chats and in the
// players' group), the players' chat / news channel lookup.
import * as durak from '../../js/durak-engine.js';

export const BOT = 'IgryUA_bot';
export const CHANNEL = '@UAIgry';
export const APP_URL = 'https://vitaliypashkovskyi-ai.github.io/durak/';
export const GAMES = {
  durak: { icon: '🃏', title: 'Дурень' },
  battle: { icon: '🚢', title: 'Морський бій' },
  mafia: { icon: '🎭', title: 'Мафія' },
  thousand: { icon: '🂡', title: 'Тисяча' },
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

export function topText(rows, title) {
  if (!rows.length) return `${title}\n\nПоки що порожньо — зіграйте онлайн з друзями, щоб потрапити сюди!`;
  const medal = i => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
  return `${title}\n\n` + rows.map((r, i) => `${medal(i)} ${esc(r.name)} — <b>${r.points}</b> оч. (${r.wins} перемог)`).join('\n');
}

// ---------- webhook ----------
const GROUP_CMDS = { '/durak': 'durak', '/battle': 'battle', '/mafia': 'mafia', '/thousand': 'thousand' };

export async function handleUpdate(update, env, makeRoom) {
  if (update.callback_query) return handleCallback(update.callback_query, env, makeRoom);
  const msg = update.message;
  if (!msg || typeof msg.text !== 'string' || !msg.text.startsWith('/')) return;
  return handleCommand(msg, env, makeRoom);
}

// The game list as buttons: pressing one gathers a room right away.
const menuKeyboard = withPlay => ({
  inline_keyboard: [
    ...(withPlay ? [[{ text: '🎮 Відкрити ігри', web_app: { url: APP_URL } }]] : []),
    [{ text: '🃏 Дурень', callback_data: 'new:durak' }, { text: '🚢 Морський бій', callback_data: 'new:battle' }],
    [{ text: '🎭 Мафія', callback_data: 'new:mafia' }, { text: '🂡 Тисяча', callback_data: 'new:thousand' }],
    [{ text: '🏆 Топ тижня', callback_data: 'top' }],
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
  if (['/start', '/play', '/help', '/igry', '/games', '/menu'].includes(cmd)) {
    // web_app buttons work only in private chats
    return reply(MENU_TEXT, { reply_markup: menuKeyboard(priv) });
  }
  const game = GROUP_CMDS[cmd];
  if (!game) return;
  return gatherRoom(env, makeRoom, chat.id, msg.from, game);
}
