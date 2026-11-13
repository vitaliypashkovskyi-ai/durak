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
const GROUP_CMDS = { '/durak': 'durak', '/battle': 'battle', '/mafia': 'mafia' };

export async function handleUpdate(update, env, makeRoom) {
  const msg = update.message;
  if (!msg || typeof msg.text !== 'string' || !msg.text.startsWith('/')) return;
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
  if (chat.type === 'private') {
    if (['/start', '/play', '/help', '/igry'].includes(cmd)) {
      return reply('🎲 <b>Ігри UA</b> — Дурень, Морський бій і Мафія з друзями прямо в Telegram.\n\n' +
        'Натисніть «Грати», щоб почати. У групі можна написати /durak, /battle або /mafia — і всі охочі зайдуть в одну кімнату.',
      { reply_markup: { inline_keyboard: [[{ text: '🎮 Грати', web_app: { url: APP_URL } }]] } });
    }
    return;
  }
  // group or supergroup
  if (cmd === '/igry' || cmd === '/games' || cmd === '/help' || cmd === '/start') {
    return reply('🎲 Зібрати гру тут:\n/durak — 🃏 Дурень\n/battle — 🚢 Морський бій\n/mafia — 🎭 Мафія\n/top — 🏆 топ тижня');
  }
  const game = GROUP_CMDS[cmd];
  if (!game) return;
  const code = await makeRoom({ game });
  const g = GAMES[game], who = esc((msg.from && msg.from.first_name) || 'Хтось');
  return reply(`${g.icon} <b>${who}</b> збирає гру «${g.title}»!\nНатисніть кнопку, щоб приєднатися 👇`,
    { reply_markup: { inline_keyboard: [[{ text: `▶ Приєднатися (${g.title})`, url: joinUrl(code) }]] } });
}
