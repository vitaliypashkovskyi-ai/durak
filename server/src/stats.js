// Stats: one Durable Object (SQLite) with players' points, results for the weekly top,
// and a cached lookup of the news channel and the players' chat linked to it.
import { tg, CHANNEL, topText, esc, APP_URL } from './telegram.js';

const PTS = { win: 3, draw: 1, lose: 0 };
const GAME_COL = { durak: 'durak_w', battle: 'battle_w', mafia: 'mafia_w', thousand: 'thousand_w', spy: 'spy_w', goat: 'goat_w', rpoker: 'rpoker_w', svara: 'svara_w', checkers: 'checkers_w', nardy: 'nardy_w', dice: 'dice_w' };
const EXTRA_COLS = ['thousand_w', 'spy_w', 'spyrole_w', 'goat_w', 'streak', 'best_streak', 'last_day', 'rpoker_w',
  'welcome_done', 'ref_by', 'refs', 'ref_day', 'ref_today', 'svara_w', 'cup1', 'cup2', 'cup3', 'checkers_w', 'nardy_w', 'dice_w',
  'last_seen', 'pm_ok', 'mute', 'reminded_day'];
const WELCOME = 10, REF_FRIEND = 5, REF_INVITER = 15, REF_PER_DAY = Infinity;   // no daily cap (user's choice)
const LEVELS = [[0, 'Новачок 🌱'], [15, 'Аматор 🙂'], [40, 'Гравець 🎯'], [90, 'Досвідчений 💪'], [180, 'Майстер 🏅'], [350, 'Легенда 👑']];
const WEEK = 7 * 86400 * 1000;
// Weekly tournament: from Sunday 17:00 UTC (the cron) to the next one. Top-3 get bonus points and a cup.
export const PRIZES = [30, 20, 10];
const TOUR_HOUR = 17;   // UTC, same as the cron in wrangler.toml
function lastSunday(now = Date.now()) {
  const d = new Date(now);
  d.setUTCHours(TOUR_HOUR, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  if (d.getTime() > now) d.setUTCDate(d.getUTCDate() - 7);
  return d.getTime();
}

export function level(points) {
  let i = 0;
  while (i + 1 < LEVELS.length && points >= LEVELS[i + 1][0]) i++;
  const next = LEVELS[i + 1];
  return { idx: i, name: LEVELS[i][1], next: next ? { name: next[1], at: next[0] } : null };
}
// [icon, name, how to get it, progress(p), goal]
const ACHIEVEMENTS = [
  ['🎉', 'Перша перемога', 'Виграйте онлайн-гру', p => p.wins, 1],
  ['🎮', 'Завсідник', 'Зіграйте 10 онлайн-ігор', p => p.games, 10],
  ['💯', 'Сотня', 'Зіграйте 100 онлайн-ігор', p => p.games, 100],
  ['🏆', 'Переможець', 'Здобудьте 25 перемог', p => p.wins, 25],
  ['🔥', 'Тиждень поспіль', 'Забирайте бонус 7 днів поспіль', p => p.best_streak, 7],
  ['🃏', 'Шулер', '15 перемог у Дурні', p => p.durak_w, 15],
  ['🂡', 'Тисячник', '5 перемог у Тисячі', p => p.thousand_w, 5],
  ['🐐', 'Не козел', '5 перемог у Козлі', p => p.goat_w, 5],
  ['🎯', 'Снайпер', '5 перемог у Розписному покері', p => p.rpoker_w, 5],
  ['🎴', 'Сварщик', '5 перемог у Сварі', p => p.svara_w, 5],
  ['⚪', 'Гросмейстер', '10 перемог у Шашках', p => p.checkers_w, 10],
  ['🎲', 'Нардист', '10 перемог у Нардах', p => p.nardy_w, 10],
  ['⚀', 'Щасливчик', '5 перемог у Костях', p => p.dice_w, 5],
  ['⚓', 'Адмірал', '15 перемог у Морському бої', p => p.battle_w, 15],
  ['🎭', 'Дон мафії', '5 перемог за мафію', p => p.don_w, 5],
  ['🏙', 'Захисник міста', '15 перемог за місто в Мафії', p => p.mafia_w - p.don_w, 15],
  ['🕵️', 'Розвідник', '3 перемоги шпигуном', p => p.spyrole_w, 3],
  ['🔍', 'Ловець шпигунів', '5 перемог агентом у Шпигуні', p => p.spy_w - p.spyrole_w, 5],
  ['🤝', 'Душа компанії', 'Запросіть 5 друзів', p => p.refs, 5],
  ['🏆', 'Чемпіон тижня', 'Виграйте турнір тижня', p => p.cup1, 1],
  ['🏅', 'Призер', '3 рази потрапте в трійку турніру', p => (p.cup1 || 0) + (p.cup2 || 0) + (p.cup3 || 0), 3],
  ['🌈', 'Майстер на всі руки', 'Виграйте в кожну гру хоча б раз',
    p => ['durak_w', 'thousand_w', 'goat_w', 'battle_w', 'mafia_w', 'spy_w', 'rpoker_w', 'svara_w', 'checkers_w', 'nardy_w', 'dice_w'].filter(c => p[c] > 0).length, 11],
];
export function achievements(p) {
  return ACHIEVEMENTS.map(([icon, name, how, f, goal]) => {
    const have = Math.max(0, Math.min(Number(f(p)) || 0, goal));
    return { icon, name, how, have, goal, done: have >= goal };
  });
}
export const badges = p => achievements(p).filter(a => a.done).map(a => `${a.icon} ${a.name}`);

// Today's date in Kyiv as a day number (the daily bonus resets at midnight Kyiv time)
function kyivDay(ts = Date.now()) {
  const s = new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' });
  return Math.round(Date.parse(s + 'T00:00:00Z') / 86400000);
}
const dailyBonus = streak => Math.min(streak, 7);

const json = d => new Response(JSON.stringify(d), { headers: { 'Content-Type': 'application/json' } });

export class Stats {
  constructor(state, env) {
    this.env = env;
    this.sql = state.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY, name TEXT, points INTEGER DEFAULT 0,
      games INTEGER DEFAULT 0, wins INTEGER DEFAULT 0, durak_w INTEGER DEFAULT 0, battle_w INTEGER DEFAULT 0,
      mafia_w INTEGER DEFAULT 0, don_w INTEGER DEFAULT 0)`);
    const cols = this.sql.exec('PRAGMA table_info(players)').toArray().map(c => c.name);
    for (const c of EXTRA_COLS) if (!cols.includes(c)) this.sql.exec(`ALTER TABLE players ADD COLUMN ${c} INTEGER DEFAULT 0`);
    this.sql.exec('CREATE TABLE IF NOT EXISTS results(id TEXT, game TEXT, res TEXT, pts INTEGER, ts INTEGER)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS results_ts ON results(ts)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT)');
    this.seen = new Map();   // who has the app open now (in memory): id -> last ping
  }

  async fetch(req) {
    const url = new URL(req.url);
    const body = req.method === 'POST' ? await req.json() : null;
    if (url.pathname === '/report') { this.report(body); return json({ ok: true }); }
    if (url.pathname === '/profile') return json(this.profile(body.id));
    if (url.pathname === '/daily') return json(this.daily(body.id, body.name));
    if (url.pathname === '/hello') return json(this.hello(body.id, body.name, body.ref, body.pm));
    if (url.pathname === '/top') return json(this.top(url.searchParams.get('period')));
    if (url.pathname === '/community') return json(await this.community());
    if (url.pathname === '/weekly') return json(await this.weekly());
    if (url.pathname === '/tour') return json(this.tour(url.searchParams.get('id')));
    if (url.pathname === '/ping') return json(this.ping(body.id));
    if (url.pathname === '/notify') return json(this.notify(body));
    if (url.pathname === '/remind') return json(await this.remind());
    return new Response('not found', { status: 404 });
  }

  // {game, players:[{id, name, res:'win'|'lose'|'draw', don}]}
  report({ game, players }) {
    const col = GAME_COL[game];
    if (!col || !Array.isArray(players)) return;
    const now = Date.now();
    for (const p of players) {
      if (!/^tg:\d+$/.test(p.id) || !PTS.hasOwnProperty(p.res)) continue;
      const pts = PTS[p.res], win = p.res === 'win' ? 1 : 0;
      this.sql.exec('INSERT INTO players(id, name) VALUES(?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name', p.id, String(p.name).slice(0, 24));
      // p.don = special role won: the mafia (mafia) or the spy (spy)
      const special = p.don && win ? 1 : 0;
      this.sql.exec(`UPDATE players SET points = points + ?, games = games + 1, wins = wins + ?, ${col} = ${col} + ?,
        don_w = don_w + ?, spyrole_w = spyrole_w + ? WHERE id = ?`,
      pts, win, win, game === 'mafia' ? special : 0, game === 'spy' ? special : 0, p.id);
      this.sql.exec('INSERT INTO results(id, game, res, pts, ts) VALUES(?, ?, ?, ?, ?)', p.id, game, p.res, pts, now);
    }
    this.sql.exec('DELETE FROM results WHERE ts < ?', now - 5 * WEEK);
  }

  profile(id) {
    const rows = this.sql.exec('SELECT * FROM players WHERE id = ?', String(id)).toArray();
    const p = rows[0] || { name: '', points: 0, games: 0, wins: 0, durak_w: 0, battle_w: 0, mafia_w: 0, don_w: 0,
      thousand_w: 0, spy_w: 0, spyrole_w: 0, goat_w: 0, streak: 0, best_streak: 0, last_day: 0 };
    const rank = rows[0] ? this.sql.exec('SELECT COUNT(*) AS n FROM players WHERE points > ?', p.points).one().n + 1 : null;
    const week = this.sql.exec('SELECT COALESCE(SUM(pts), 0) AS s FROM results WHERE id = ? AND ts > ?', String(id), this.tourStart()).one().s;
    const today = kyivDay();
    const streak = p.last_day >= today - 1 ? p.streak : 0;
    // next = what the next claim gives (today if not claimed yet, otherwise tomorrow)
    const daily = { available: p.last_day !== today, streak, next: dailyBonus(p.last_day === today || p.last_day === today - 1 ? p.streak + 1 : 1) };
    return { ...p, rank, week, level: level(p.points), badges: badges(p), achievements: achievements(p), daily };
  }

  // First visit: +10 once. A brand-new player who came by a friend's link gets +5 more and the
  // friend +15 for every new player, without a daily cap.
  hello(id, name, ref, pm) {
    if (!/^tg:\d+$/.test(String(id))) return { ok: false };
    const existed = this.sql.exec('SELECT welcome_done FROM players WHERE id = ?', id).toArray()[0];
    this.sql.exec('INSERT INTO players(id, name) VALUES(?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name', id, String(name || '').slice(0, 24));
    this.sql.exec('UPDATE players SET last_seen = ?, pm_ok = MAX(pm_ok, ?) WHERE id = ?', Date.now(), pm ? 1 : 0, id);
    if (existed && existed.welcome_done) return { ok: true, welcome: false };
    this.sql.exec('INSERT INTO players(id, name) VALUES(?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name', id, String(name || '').slice(0, 24));
    let bonus = WELCOME, inviter = null;
    const refId = /^\d{3,15}$/.test(String(ref || '')) ? 'tg:' + ref : null;
    if (!existed && refId && refId !== id) {
      const inv = this.sql.exec('SELECT name, ref_day, ref_today FROM players WHERE id = ?', refId).toArray()[0];
      const today = kyivDay();
      const used = inv && inv.ref_day === today ? inv.ref_today : 0;
      if (inv && used < REF_PER_DAY) {
        this.sql.exec('UPDATE players SET points = points + ?, refs = refs + 1, ref_day = ?, ref_today = ? WHERE id = ?',
          REF_INVITER, today, used + 1, refId);
        this.sql.exec('UPDATE players SET ref_by = ? WHERE id = ?', refId, id);
        bonus += REF_FRIEND;
        inviter = { id: refId, name: inv.name };
      }
    }
    this.sql.exec('UPDATE players SET points = points + ?, welcome_done = 1 WHERE id = ?', bonus, id);
    return { ok: true, welcome: true, bonus, invitedBy: inviter ? inviter.name : null, inviter: inviter ? inviter.id : null, inviterBonus: REF_INVITER };
  }

  // Daily bonus: +1 on the first day of a streak, +2 on the second… up to +7 a day.
  daily(id, name) {
    if (!/^tg:\d+$/.test(String(id))) return { ok: false };
    this.sql.exec('INSERT INTO players(id, name) VALUES(?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name', id, String(name || '').slice(0, 24));
    const p = this.sql.exec('SELECT points, streak, best_streak, last_day FROM players WHERE id = ?', id).one();
    const today = kyivDay();
    if (p.last_day === today) return { ok: true, claimed: false, streak: p.streak, next: dailyBonus(p.streak + 1), points: p.points };
    const streak = p.last_day === today - 1 ? p.streak + 1 : 1;
    const bonus = dailyBonus(streak);
    this.sql.exec('UPDATE players SET points = points + ?, streak = ?, best_streak = MAX(best_streak, ?), last_day = ? WHERE id = ?',
      bonus, streak, streak, today, id);
    return { ok: true, claimed: true, bonus, streak, next: dailyBonus(streak + 1), points: p.points + bonus };
  }

  // ---------- online counter ----------
  ping(id) {
    const now = Date.now();
    if (id) this.seen.set(String(id), now);
    for (const [k, t] of this.seen) if (now - t > 150000) this.seen.delete(k);
    return { online: this.seen.size };
  }

  // ---------- reminders ----------
  // {id, on?, pm?, name?}: on = reminders on/off, pm = the bot may write to this person
  notify({ id, on, pm, name }) {
    if (!/^tg:\d+$/.test(String(id))) return { ok: false };
    this.sql.exec('INSERT INTO players(id, name) VALUES(?, ?) ON CONFLICT(id) DO NOTHING', id, String(name || 'Гравець').slice(0, 24));
    if (on !== undefined) this.sql.exec('UPDATE players SET mute = ? WHERE id = ?', on ? 0 : 1, id);
    if (pm) this.sql.exec('UPDATE players SET pm_ok = 1 WHERE id = ?', id);
    const p = this.sql.exec('SELECT mute, pm_ok FROM players WHERE id = ?', id).one();
    return { ok: true, on: !p.mute, pm: !!p.pm_ok };
  }
  // Cron, twice a day: at most one message a day per person, only to those who were here this week but not today.
  async remind() {
    // REMIND_DAY_SHIFT only in server/.dev.vars: pretend it is a later day to test locally
    const now = Date.now(), today = kyivDay() + Number(this.env.REMIND_DAY_SHIFT || 0);
    const dow = new Date(new Date(now).toLocaleString('en-US', { timeZone: 'Europe/Kyiv' })).getDay();   // 0 = Sunday
    const rows = this.sql.exec(`SELECT id, name, points, streak, last_day, last_seen, reminded_day FROM players
      WHERE pm_ok = 1 AND mute = 0 AND last_seen > ? AND reminded_day < ?`, now - WEEK, today).toArray();
    const tour = (dow === 6 || dow === 0) ? this.tourRows(1000) : [];
    const third = tour[2] ? tour[2].points : 0;
    let sent = 0;
    for (const p of rows) {
      if (sent >= 40) break;                                   // Workers' outbound request limit per run
      if (kyivDay(p.last_seen) >= today) continue;             // already played today
      const place = tour.findIndex(r => r.id === p.id) + 1;
      const streak = p.last_day === today - 1 ? p.streak : 0;
      const next = Math.min(7, (p.last_day === today - 1 ? p.streak : 0) + 1);
      let text = null;
      if (place >= 4 && place <= 10 && third - tour[place - 1].points <= 9) {
        text = `🏆 Ви на <b>${place}-му місці</b> в турнірі тижня — до призового місця лише <b>${third - tour[place - 1].points + 1}</b> оч.! Підсумки в неділю о 19:00 — встигніть зіграти 🎲`;
      } else if (p.last_day < today && streak >= 2) {
        text = `🔥 Ваша серія бонусів — <b>${streak} дн.</b> Не дайте їй згоріти: заберіть сьогоднішній бонус <b>+${next}</b> очок!`;
      } else if (p.last_day < today && now - p.last_seen < 3 * 86400 * 1000) {
        text = `🎁 Бонус дня чекає: <b>+${next}</b> очок. Зазирніть і заберіть — а заодно зіграйте партію 🃏`;
      }
      if (!text) continue;
      const r = await tg(this.env, 'sendMessage', {
        chat_id: p.id.slice(3), parse_mode: 'HTML', text,
        reply_markup: { inline_keyboard: [[{ text: '🎮 Грати', web_app: { url: APP_URL } }], [{ text: '🔕 Не нагадувати', callback_data: 'notify:off' }]] },
      }).catch(() => ({ ok: false }));
      sent++;
      if (r.ok) this.sql.exec('UPDATE players SET reminded_day = ? WHERE id = ?', today, p.id);
      else if (r.error_code === 403) this.sql.exec('UPDATE players SET pm_ok = 0 WHERE id = ?', p.id);   // blocked the bot
      else this.sql.exec('UPDATE players SET reminded_day = ? WHERE id = ?', today, p.id);
    }
    console.log('reminders', JSON.stringify({ candidates: rows.length, sent }));
    return { candidates: rows.length, sent };
  }

  top(period) {
    if (period === 'week') return this.tourRows(10).map(({ name, points, wins }) => ({ name, points, wins }));
    return this.sql.exec('SELECT name, points, wins FROM players ORDER BY points DESC, wins DESC LIMIT 10').toArray();
  }

  // ---------- weekly tournament ----------
  kvGet(k) { const r = this.sql.exec('SELECT v FROM kv WHERE k = ?', k).toArray()[0]; return r ? JSON.parse(r.v) : null; }
  kvSet(k, v) { this.sql.exec('INSERT INTO kv(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, JSON.stringify(v)); }
  // before the first close: the last Sunday cron (an hour back, so the cron itself sees the past week)
  tourStart() { return this.kvGet('tour_start') || lastSunday(Date.now() - 3600 * 1000); }
  tourRows(limit) {
    return this.sql.exec(`SELECT r.id AS id, p.name AS name, SUM(r.pts) AS points, SUM(r.res = 'win') AS wins, MIN(r.ts) AS first
      FROM results r JOIN players p ON p.id = r.id WHERE r.ts > ? GROUP BY r.id HAVING points > 0
      ORDER BY points DESC, wins DESC, first ASC LIMIT ?`, this.tourStart(), limit).toArray();
  }
  // Standings for the app: time left, prizes, top-10, the player's place and last week's winners.
  tour(id) {
    const rows = this.tourRows(1000);
    const i = id ? rows.findIndex(r => r.id === String(id)) : -1;
    return {
      start: this.tourStart(), end: lastSunday() + WEEK, now: Date.now(), prizes: PRIZES,
      top: rows.slice(0, 10).map(({ name, points, wins }) => ({ name, points, wins })),
      me: i >= 0 ? { place: i + 1, points: rows[i].points } : null,
      last: this.kvGet('tour_last'),
    };
  }


  // The news channel and its linked discussion group (the players' chat), cached for an hour.
  async community() {
    const row = this.sql.exec("SELECT v FROM kv WHERE k = 'community'").toArray()[0];
    const cached = row ? JSON.parse(row.v) : null;
    if (cached && Date.now() - cached.t < 3600 * 1000) return cached;
    const r = await tg(this.env, 'getChat', { chat_id: CHANNEL });
    if (!r.ok) return cached || { channelId: null, groupId: null, t: 0 };
    const c = { channelId: r.result.id, groupId: r.result.linked_chat_id || null, t: Date.now() };
    this.sql.exec("INSERT INTO kv(k, v) VALUES('community', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", JSON.stringify(c));
    return c;
  }

  // Cron (Sunday 17:00 UTC): close the tournament, pay the prizes, tell the winners and the channel.
  async weekly() {
    const now = Date.now();
    // a repeated cron run must not pay twice (TOUR_MIN_GAP_MS only in server/.dev.vars for local tests)
    const gap = this.env.TOUR_MIN_GAP_MS != null ? Number(this.env.TOUR_MIN_GAP_MS) : 6 * 86400 * 1000;
    if (now - this.tourStart() < gap) return { posted: false, reason: 'too early' };
    const rows = this.tourRows(10);
    const winners = rows.slice(0, PRIZES.length).map((r, i) => ({ ...r, place: i + 1, prize: PRIZES[i] }));
    for (const w of winners) {
      this.sql.exec(`UPDATE players SET points = points + ?, cup${w.place} = cup${w.place} + 1 WHERE id = ?`, w.prize, w.id);
    }
    this.kvSet('tour_start', now);
    this.kvSet('tour_last', { end: now, winners: winners.map(({ name, points, place, prize }) => ({ name, points, place, prize })) });
    const medal = ['🥇', '🥈', '🥉'];
    for (const w of winners) {
      await tg(this.env, 'sendMessage', {
        chat_id: w.id.slice(3), parse_mode: 'HTML',
        text: `${medal[w.place - 1]} Вітаємо! Ви посіли <b>${w.place} місце</b> в турнірі тижня (${w.points} оч.) — вам <b>+${w.prize}</b> очок і кубок у профілі! Новий турнір уже почався 🎲`,
      }).catch(() => {});
    }
    if (!rows.length) return { posted: false };
    const { channelId } = await this.community();
    if (!channelId) return { posted: false };
    const prizes = winners.map(w => `${medal[w.place - 1]} ${esc(w.name)} +${w.prize}`).join('\n');
    const r = await tg(this.env, 'sendMessage', {
      chat_id: channelId, parse_mode: 'HTML', disable_web_page_preview: true,
      text: topText(rows, '🏆 <b>Підсумки турніру тижня</b>') + `\n\n🎁 <b>Призи:</b>\n${prizes}\n\nНовий турнір уже почався — грайте онлайн з друзями в @IgryUA_bot і забирайте призи: 🥇 +${PRIZES[0]}, 🥈 +${PRIZES[1]}, 🥉 +${PRIZES[2]} 🎲`,
    });
    return { posted: !!r.ok };
  }
}
