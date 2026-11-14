// Stats: one Durable Object (SQLite) with players' points, results for the weekly top,
// and a cached lookup of the news channel and the players' chat linked to it.
import { tg, CHANNEL, topText, esc, APP_URL, GAMES } from './telegram.js';
import { pickWord, names, leaks, ROUND_MS, IDLE_MS } from './croc.js';

const PTS = { win: 3, draw: 1, lose: 0 };
const GAME_COL = { durak: 'durak_w', battle: 'battle_w', mafia: 'mafia_w', thousand: 'thousand_w', spy: 'spy_w', goat: 'goat_w', rpoker: 'rpoker_w', svara: 'svara_w', checkers: 'checkers_w', nardy: 'nardy_w', dice: 'dice_w', chess: 'chess_w', quiz: 'quiz_w', pref: 'pref_w', bgammon: 'bgammon_w' };
const EXTRA_COLS = ['thousand_w', 'spy_w', 'spyrole_w', 'goat_w', 'streak', 'best_streak', 'last_day', 'rpoker_w',
  'welcome_done', 'ref_by', 'refs', 'ref_day', 'ref_today', 'svara_w', 'cup1', 'cup2', 'cup3', 'checkers_w', 'nardy_w', 'dice_w',
  'last_seen', 'pm_ok', 'mute', 'reminded_day', 'first_seen', 'vip_until', 'champ', 'pub', 'bgammon_w', 'pref_w', 'quiz_w', 'chess_w'];
const WELCOME = 10, REF_FRIEND = 5, REF_INVITER = 15, REF_PER_DAY = Infinity;   // no daily cap (user's choice)
const LEVELS = [[0, 'Новачок 🌱'], [15, 'Аматор 🙂'], [40, 'Гравець 🎯'], [90, 'Досвідчений 💪'], [180, 'Майстер 🏅'], [350, 'Легенда 👑']];
const WEEK = 7 * 86400 * 1000;
// Daily quests: the same three for everyone each day; +QUEST_PTS each, +QUEST_ALL more for all three.
const QUEST_PTS = 5, QUEST_ALL = 5;
const QUEST_GAMES = ['durak', 'rpoker', 'svara', 'thousand', 'goat', 'battle', 'checkers', 'nardy', 'dice', 'spy', 'mafia', 'chess', 'quiz', 'pref', 'bgammon'];
const gname = g => (GAMES[g] ? `${GAMES[g].icon} ${GAMES[g].title}` : g);
export function questsFor(day) {
  const g = QUEST_GAMES[day % QUEST_GAMES.length], h = QUEST_GAMES[(day * 7 + 3) % QUEST_GAMES.length];
  const a = day % 2 ? { k: 'bonus', n: 1, text: 'Заберіть 🎁 бонус дня' } : { k: 'play_any', n: 3, text: 'Зіграйте 3 будь-які партії (з ботами чи людьми)' };
  const b = day % 3 === 0 ? { k: 'play_game', g: h, n: 2, text: `Зіграйте 2 партії в ${gname(h)}` } : { k: 'win_game', g, n: 1, text: `Виграйте партію в ${gname(g)}` };
  const c = day % 2 ? { k: 'play_online', n: 2, text: 'Зіграйте 2 онлайн-партії з людьми' } : { k: 'win_online', n: 1, text: 'Виграйте онлайн-партію з людьми' };
  return [a, b, c];
}
// does an event {online, game, win, bonus} count for the quest q?
function questHit(q, e) {
  switch (q.k) {
    case 'bonus': return !!e.bonus;
    case 'play_any': return !!e.game;
    case 'play_online': return !!e.game && e.online;
    case 'win_online': return !!e.game && e.online && e.win;
    case 'play_game': return e.game === q.g;
    case 'win_game': return e.game === q.g && e.win;
  }
  return false;
}
// Weekly tournament: from Sunday 17:00 UTC (the cron) to the next one. Top-3 get bonus points and a cup.
export const PRIZES = [30, 20, 10];
// Monthly seasons: a separate table for each calendar month (Kyiv); the 1st of the month pays the top-3
// and the winner wears 🏆 next to the name for the whole next month.
export const SEASON_PRIZES = [50, 30, 20];
// Evening Durak tournament: every day 20:00–21:00 Kyiv, online Durak wins count; top-3 get bonus points.
export const EVENING_PRIZES = [20, 10, 5];
const EVENING_HOUR = 20;
function kyivMidnight(ts = Date.now()) {
  const [h, m, s] = new Date(ts).toLocaleTimeString('en-GB', { timeZone: 'Europe/Kyiv', hour12: false }).split(':').map(Number);
  return ts - ((h % 24) * 3600 + m * 60 + s) * 1000;
}
export const kyivHour = (ts = Date.now()) => Number(new Date(ts).toLocaleTimeString('en-GB', { timeZone: 'Europe/Kyiv', hour12: false }).slice(0, 2)) % 24;
const MONTHS_OF = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
const monthKey = (ts = Date.now()) => new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' }).slice(0, 7);   // '2026-11'
// Kyiv midnight of the 1st of the month that contains ts
function monthStart(ts = Date.now()) {
  const d = Number(new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' }).slice(8, 10));
  const [h, m, s] = new Date(ts).toLocaleTimeString('en-GB', { timeZone: 'Europe/Kyiv', hour12: false }).split(':').map(Number);
  return ts - ((d - 1) * 86400 + (h % 24) * 3600 + m * 60 + s) * 1000;
}
export const seasonName = key => MONTHS[Number(key.slice(5, 7)) - 1] + ' ' + key.slice(0, 4);
export const seasonOf = key => MONTHS_OF[Number(key.slice(5, 7)) - 1];
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
  ['🎯', 'Гравець у нарди', '10 перемог у Коротких нардах', p => p.bgammon_w, 10],
  ['🎩', 'Префераншик', '5 перемог у Преферансі', p => p.pref_w, 5],
  ['🧠', 'Ерудит', '10 перемог у Вікторині', p => p.quiz_w, 10],
  ['♛', 'Ферзь', '10 перемог у Шахах', p => p.chess_w, 10],
  ['⚪', 'Гросмейстер', '10 перемог у Шашках', p => p.checkers_w, 10],
  ['🎲', 'Нардист', '10 перемог у Нардах', p => p.nardy_w, 10],
  ['⚀', 'Щасливчик', '5 перемог у Костях', p => p.dice_w, 5],
  ['⚓', 'Адмірал', '15 перемог у Морському бої', p => p.battle_w, 15],
  ['🎭', 'Дон мафії', '5 перемог за мафію', p => p.don_w, 5],
  ['🏙', 'Захисник міста', '15 перемог за місто в Мафії', p => p.mafia_w - p.don_w, 15],
  ['🕵️', 'Розвідник', '3 перемоги шпигуном', p => p.spyrole_w, 3],
  ['🔍', 'Ловець шпигунів', '5 перемог агентом у Шпигуні', p => p.spy_w - p.spyrole_w, 5],
  ['🤝', 'Душа компанії', 'Запросіть 5 друзів', p => p.refs, 5],
  ['👑', 'Чемпіон сезону', 'Виграйте місячний сезон', p => p.champ, 1],
  ['🏆', 'Чемпіон тижня', 'Виграйте турнір тижня', p => p.cup1, 1],
  ['🏅', 'Призер', '3 рази потрапте в трійку турніру', p => (p.cup1 || 0) + (p.cup2 || 0) + (p.cup3 || 0), 3],
  ['🌈', 'Майстер на всі руки', 'Виграйте в кожну гру хоча б раз',
    p => ['durak_w', 'thousand_w', 'goat_w', 'battle_w', 'mafia_w', 'spy_w', 'rpoker_w', 'svara_w', 'checkers_w', 'nardy_w', 'dice_w', 'chess_w', 'quiz_w', 'pref_w', 'bgammon_w'].filter(c => p[c] > 0).length, 15],
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
    this.sql.exec('CREATE TABLE IF NOT EXISTS purchases(id TEXT, item TEXT, stars INTEGER, charge TEXT PRIMARY KEY, ts INTEGER)');
    // where a player came from (link label) and which days they opened the game
    if (!cols.includes('source')) this.sql.exec("ALTER TABLE players ADD COLUMN source TEXT DEFAULT ''");
    this.sql.exec('CREATE TABLE IF NOT EXISTS visits(id TEXT, day INTEGER, PRIMARY KEY(id, day))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS clubs(code TEXT PRIMARY KEY, name TEXT, owner TEXT, created INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS club_members(id TEXT PRIMARY KEY, club TEXT, joined INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS friends(a TEXT, b TEXT, ts INTEGER, games INTEGER DEFAULT 0, PRIMARY KEY(a, b))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS quests(id TEXT, day INTEGER, qi INTEGER, prog INTEGER DEFAULT 0, done INTEGER DEFAULT 0, PRIMARY KEY(id, day, qi))');
    this.invited = new Map();   // 'a>b' -> last invite time (anti-spam)
    this.seen = new Map();   // who has the app open now (in memory): id -> last ping
  }

  async fetch(req) {
    const url = new URL(req.url);
    const body = req.method === 'POST' ? await req.json() : null;
    if (url.pathname === '/report') { this.report(body); return json({ ok: true }); }
    if (url.pathname === '/profile') return json(this.profile(body.id));
    if (url.pathname === '/daily') return json(this.daily(body.id, body.name));
    if (url.pathname === '/hello') return json(this.hello(body.id, body.name, body.ref, body.pm, body.src));
    if (url.pathname === '/top') return json(this.top(url.searchParams.get('period')));
    if (url.pathname === '/community') return json(await this.community());
    if (url.pathname === '/weekly') return json(await this.weekly());
    if (url.pathname === '/tour') return json(this.tour(url.searchParams.get('id')));
    if (url.pathname === '/ping') return json(this.ping(body.id));
    if (url.pathname === '/event') {
      this.count(`${body.t}:${body.game}`);
      const done = body.id ? this.questEvent(body.id, { game: body.game, win: !!body.win, online: false }) : [];
      return json({ ok: true, done });
    }
    if (url.pathname === '/friends') return json(this.friends(body.id));
    if (url.pathname === '/invite') return json(this.canInvite(body.from, body.to));
    if (url.pathname === '/quests') return json(this.quests(body.id));
    if (url.pathname === '/player') return json(this.player(body.pub, body.viewer));
    if (url.pathname === '/evening') return json(this.evening(body.id));
    if (url.pathname === '/hourly') return json(await this.hourly());
    if (url.pathname === '/dash') return json(this.dash());
    if (url.pathname === '/croc') { await this.croc(body); return json({ ok: true }); }
    if (url.pathname === '/club') return json(this.club(body));
    if (url.pathname === '/season') return json(this.season(url.searchParams.get('id')));
    if (url.pathname === '/admin') return json(this.admin());
    if (url.pathname === '/buy') return json(this.buy(body));
    if (url.pathname === '/notify') return json(this.notify(body));
    if (url.pathname === '/remind') { await this.seasonClose(); return json(await this.remind()); }
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
      this.questEvent(p.id, { game, online: true, win: p.res === 'win' });
    }
    // people who played together become friends
    const ids = players.map(p => p.id).filter(id => /^tg:\d+$/.test(id));
    for (const a of ids) for (const b of ids) if (a < b) this.befriend(a, b, true);
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
    const owned = this.sql.exec("SELECT DISTINCT item FROM purchases WHERE id = ? AND item != 'vip'", String(id)).toArray().map(r => r.item);
    const vip = (p.vip_until || 0) > Date.now();
    const ch = this.kvGet('champion'), champion = !!ch && ch.id === String(id) && ch.until > Date.now();
    return { ...p, rank, week, level: level(p.points), badges: badges(p), achievements: achievements(p), daily, owned, vip, vip_until: p.vip_until || 0, champion };
  }

  // First visit: +10 once. A brand-new player who came by a friend's link gets +5 more and the
  // friend +15 for every new player, without a daily cap.
  hello(id, name, ref, pm, src) {
    if (!/^tg:\d+$/.test(String(id))) return { ok: false };
    const existed = this.sql.exec('SELECT welcome_done FROM players WHERE id = ?', id).toArray()[0];
    this.sql.exec('INSERT INTO players(id, name) VALUES(?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name', id, String(name || '').slice(0, 24));
    this.sql.exec('UPDATE players SET last_seen = ?, pm_ok = MAX(pm_ok, ?), first_seen = CASE WHEN first_seen = 0 THEN ? ELSE first_seen END WHERE id = ?', Date.now(), pm ? 1 : 0, Date.now(), id);
    this.sql.exec('INSERT INTO visits(id, day) VALUES(?, ?) ON CONFLICT DO NOTHING', id, kyivDay());
    if (!existed) {
      const source = /^[a-z0-9]{1,20}$/.test(String(src || '')) ? src : /^\d{3,15}$/.test(String(ref || '')) ? 'friend' : 'direct';
      this.sql.exec('UPDATE players SET source = ? WHERE id = ?', source, id);
    }
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
        this.befriend(id, refId, false);
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
    const quests = this.questEvent(id, { bonus: true });
    return { ok: true, claimed: true, bonus, streak, next: dailyBonus(streak + 1), points: p.points + bonus, quests };
  }

  // ---------- counters per Kyiv day (kv 'c:<day>' = {key: n}) and the owner's summary ----------
  count(key, n = 1) {
    const k = 'c:' + kyivDay(), c = this.kvGet(k) || {};
    c[key] = (c[key] || 0) + n;
    this.kvSet(k, c);
  }
  admin() {
    const now = Date.now(), today = kyivDay();
    const one = (q, ...a) => this.sql.exec(q, ...a).one().n;
    const [h, m, sec] = new Date(now).toLocaleTimeString('en-GB', { timeZone: 'Europe/Kyiv', hour12: false }).split(':').map(Number);
    const dayStart = now - ((h % 24) * 3600 + m * 60 + sec) * 1000;   // Kyiv midnight
    const sum = days => { const t = {}; for (let d = today - days + 1; d <= today; d++) { const c = this.kvGet('c:' + d) || {}; for (const k in c) t[k] = (t[k] || 0) + c[k]; } return t; };
    const games = since => this.sql.exec('SELECT game, COUNT(DISTINCT ts) AS n FROM results WHERE ts > ? GROUP BY game ORDER BY n DESC', since).toArray();
    return {
      players: one('SELECT COUNT(*) AS n FROM players'),
      newToday: one('SELECT COUNT(*) AS n FROM players WHERE first_seen > ?', dayStart),
      new7: one('SELECT COUNT(*) AS n FROM players WHERE first_seen > ?', now - WEEK),
      activeToday: one('SELECT COUNT(*) AS n FROM players WHERE last_seen > ?', dayStart),
      active7: one('SELECT COUNT(*) AS n FROM players WHERE last_seen > ?', now - WEEK),
      online: this.ping(null).online,
      onlineToday: games(dayStart), online7: games(now - WEEK),
      botToday: sum(1), bot7: sum(7),
      reminders: { canWrite: one('SELECT COUNT(*) AS n FROM players WHERE pm_ok = 1 AND mute = 0'), muted: one('SELECT COUNT(*) AS n FROM players WHERE mute = 1'),
        today: one('SELECT COUNT(*) AS n FROM players WHERE reminded_day = ?', today) },
      refs7: one('SELECT COUNT(*) AS n FROM players WHERE ref_by != 0 AND first_seen > ?', now - WEEK),
      sources: this.sql.exec(`SELECT source, COUNT(*) AS n FROM players WHERE first_seen > ? AND source != '' GROUP BY source ORDER BY n DESC`, now - WEEK).toArray(),
      stars: { today: one('SELECT COALESCE(SUM(stars), 0) AS n FROM purchases WHERE ts > ?', dayStart),
        week: one('SELECT COALESCE(SUM(stars), 0) AS n FROM purchases WHERE ts > ?', now - WEEK),
        all: one('SELECT COALESCE(SUM(stars), 0) AS n FROM purchases'), buyers: one('SELECT COUNT(DISTINCT id) AS n FROM purchases'),
        vips: one('SELECT COUNT(*) AS n FROM players WHERE vip_until > ?', now) },
    };
  }

  // ---------- monthly seasons ----------
  seasonNow() {
    let s = this.kvGet('season');
    if (!s) { s = { key: monthKey(), start: monthStart() }; this.kvSet('season', s); }
    return s;
  }
  seasonRows(s, end, limit) {
    return this.sql.exec(`SELECT r.id AS id, p.name AS name, SUM(r.pts) AS points, SUM(r.res = 'win') AS wins, MIN(r.ts) AS first
      FROM results r JOIN players p ON p.id = r.id WHERE r.ts >= ? AND r.ts < ? GROUP BY r.id HAVING points > 0
      ORDER BY points DESC, wins DESC, first ASC LIMIT ?`, s.start, end, limit).toArray();
  }
  season(id) {
    const s = this.seasonNow(), now = Date.now();
    const rows = this.seasonRows(s, now + 1, 1000);
    const i = id ? rows.findIndex(r => r.id === String(id)) : -1;
    const next = monthStart(monthStart(now) + 40 * 86400 * 1000);
    return {
      key: s.key, name: seasonName(s.key), end: next, now, prizes: SEASON_PRIZES,
      top: rows.slice(0, 10).map(({ id, name, points, wins }) => ({ pub: this.pubOf(id), name, points, wins })),
      me: i >= 0 ? { place: i + 1, points: rows[i].points } : null,
      last: this.kvGet('season_last'),
    };
  }
  // Cron (daily): when the month has changed, close the previous season once.
  async seasonClose() {
    // SEASON_KEY_TEST only in server/.dev.vars: pretend the month has changed to test locally
    const s = this.seasonNow(), key = this.env.SEASON_KEY_TEST || monthKey();
    if (s.key === key) return { closed: false };
    const end = this.env.SEASON_KEY_TEST ? Date.now() : monthStart();
    const rows = this.seasonRows(s, end, 10);
    const winners = rows.slice(0, SEASON_PRIZES.length).map((r, i) => ({ ...r, place: i + 1, prize: SEASON_PRIZES[i] }));
    for (const w of winners) this.sql.exec('UPDATE players SET points = points + ? WHERE id = ?', w.prize, w.id);
    if (winners[0]) {
      this.sql.exec('UPDATE players SET champ = champ + 1 WHERE id = ?', winners[0].id);
      this.kvSet('champion', { id: winners[0].id, name: winners[0].name, key: s.key, until: monthStart(end + 40 * 86400 * 1000) });
    }
    this.kvSet('season_last', { key: s.key, name: seasonName(s.key), of: seasonOf(s.key), winners: winners.map(({ name, points, place, prize }) => ({ name, points, place, prize })) });
    this.kvSet('season', { key, start: end });
    const medal = ['🥇', '🥈', '🥉'];
    for (const w of winners) {
      await tg(this.env, 'sendMessage', { chat_id: w.id.slice(3), parse_mode: 'HTML',
        text: `${medal[w.place - 1]} Сезон «${seasonName(s.key)}» завершено: ви на <b>${w.place} місці</b> (${w.points} оч.) — <b>+${w.prize}</b> очок!` +
          (w.place === 1 ? `\n🏆 Ви — <b>Чемпіон ${seasonOf(s.key)}</b>: увесь наступний місяць біля вашого імені буде 🏆.` : '') }).catch(() => {});
    }
    const { channelId } = await this.community();
    if (channelId && rows.length) {
      await tg(this.env, 'sendMessage', { chat_id: channelId, parse_mode: 'HTML', disable_web_page_preview: true,
        text: topText(rows, `🗓 <b>Підсумки сезону «${seasonName(s.key)}»</b>`) +
          `\n\n🏆 Чемпіон ${seasonOf(s.key)} — <b>${esc(winners[0].name)}</b>!\n🎁 ${winners.map(w => `${medal[w.place - 1]} +${w.prize}`).join('  ')}\n\nНовий сезон «${seasonName(key)}» уже почався — усі стартують з нуля 🎲` }).catch(() => {});
    }
    return { closed: true };
  }

  // ---------- clubs: a group of players with a shared weekly score ----------
  clubWeek() {
    // weekly points of every club = the members' points in the current weekly tournament
    return this.sql.exec(`SELECT c.code AS code, c.name AS name, COUNT(DISTINCT m.id) AS members, COALESCE(SUM(r.pts), 0) AS points
      FROM clubs c JOIN club_members m ON m.club = c.code LEFT JOIN results r ON r.id = m.id AND r.ts > ?
      GROUP BY c.code ORDER BY points DESC, members DESC`, this.tourStart()).toArray();
  }
  club({ id, op, name, code }) {
    if (!/^tg:\d+$/.test(String(id))) return { ok: false, why: 'login' };
    const mine = () => this.sql.exec('SELECT club FROM club_members WHERE id = ?', id).toArray()[0];
    const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let err = null;
    if (op === 'create') {
      const nm = String(name || '').replace(/[<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
      if (nm.length < 3) err = 'Назва — від 3 символів';
      else if (mine()) err = 'Ви вже в клубі — спершу вийдіть';
      else if (this.sql.exec('SELECT name FROM clubs').toArray().some(r => r.name.toLowerCase() === nm.toLowerCase())) err = 'Клуб з такою назвою вже є';   // SQLite lower() is ASCII only
      else {
        let c; do { c = Array.from({ length: 5 }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join(''); } while (this.sql.exec('SELECT COUNT(*) AS n FROM clubs WHERE code = ?', c).one().n);
        this.sql.exec('INSERT INTO clubs(code, name, owner, created) VALUES(?, ?, ?, ?)', c, nm, id, Date.now());
        this.sql.exec('INSERT INTO club_members(id, club, joined) VALUES(?, ?, ?)', id, c, Date.now());
      }
    } else if (op === 'join') {
      const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const club = this.sql.exec('SELECT code FROM clubs WHERE code = ?', c).toArray()[0];
      const m = mine();
      if (!club) err = 'Клуб не знайдено — перевірте код';
      else if (m && m.club === c) err = null;
      else if (m) err = 'Ви вже в іншому клубі — спершу вийдіть';
      else if (this.sql.exec('SELECT COUNT(*) AS n FROM club_members WHERE club = ?', c).one().n >= 30) err = 'У клубі вже 30 гравців';
      else this.sql.exec('INSERT INTO club_members(id, club, joined) VALUES(?, ?, ?)', id, c, Date.now());
    } else if (op === 'leave') {
      const m = mine();
      if (m) {
        this.sql.exec('DELETE FROM club_members WHERE id = ?', id);
        const left = this.sql.exec('SELECT id FROM club_members WHERE club = ? ORDER BY joined LIMIT 1', m.club).toArray()[0];
        if (!left) this.sql.exec('DELETE FROM clubs WHERE code = ?', m.club);                                  // empty club disappears
        else this.sql.exec('UPDATE clubs SET owner = ? WHERE code = ? AND owner = ?', left.id, m.club, id);   // the next member leads
      }
    }
    const week = this.clubWeek();
    const top = week.slice(0, 10).map(({ name, members, points }) => ({ name, members, points }));
    const m = mine();
    if (!m) return { ok: !err, err, club: null, top };
    const c = this.sql.exec('SELECT code, name, owner FROM clubs WHERE code = ?', m.club).one();
    const members = this.sql.exec(`SELECT m.id AS id, COALESCE(p.name, 'Гравець') AS name, COALESCE((SELECT SUM(pts) FROM results r WHERE r.id = m.id AND r.ts > ?), 0) AS week
      FROM club_members m LEFT JOIN players p ON p.id = m.id WHERE m.club = ? ORDER BY week DESC`, this.tourStart(), m.club).toArray()
      .map(x => ({ pub: this.pubOf(x.id), name: x.name, week: x.week, owner: x.id === c.owner, me: x.id === id }));
    const place = week.findIndex(x => x.code === c.code) + 1;
    return { ok: !err, err, club: { code: c.code, name: c.name, members, place, points: (week[place - 1] || {}).points || 0, clubs: week.length }, top };
  }

  // ---------- Крокодил in group chats ----------
  async croc({ kind, chat, from, text, cbId, data }) {
    const key = 'croc:' + chat, now = Date.now();
    let g = this.kvGet(key);
    if (g && now - g.last > IDLE_MS) { this.sql.exec('DELETE FROM kv WHERE k = ?', key); g = null; }
    const name = esc((from && from.name) || 'Гравець');
    const kb = { inline_keyboard: [[{ text: '👀 Показати слово', callback_data: 'croc:show' }], [{ text: '🔄 Інше слово', callback_data: 'croc:skip' }, { text: '⏹ Завершити', callback_data: 'croc:stop' }]] };
    const say = (t, withKb) => tg(this.env, 'sendMessage', { chat_id: chat, parse_mode: 'HTML', text: t, ...(withKb ? { reply_markup: kb } : {}) }).catch(() => {});
    const alert = t => tg(this.env, 'answerCallbackQuery', { callback_query_id: cbId, text: t, show_alert: true }).catch(() => {});
    const save = () => { this.kvSet(key, g); if (this.env.ADMIN_TEST === '1' && g) console.log('croc word', g.word, 'host', g.host); };   // ADMIN_TEST: .dev.vars only
    const award = (id, nm) => {
      const pid = 'tg:' + id;
      this.sql.exec('INSERT INTO players(id, name) VALUES(?, ?) ON CONFLICT(id) DO NOTHING', pid, String(nm || 'Гравець').slice(0, 24));
      this.sql.exec('UPDATE players SET points = points + 1 WHERE id = ?', pid);
    };
    if (kind === 'start') {
      if (g) return say(`🐊 Гра вже йде — пояснює <b>${esc(g.hostName)}</b>. Пишіть здогадки в чат!`);
      g = { word: pickWord(), host: from.id, hostName: from.name, start: now, last: now, scores: {} };
      save();
      return say(`🐊 <b>Крокодил!</b> Пояснює <b>${name}</b> — натисніть «👀 Показати слово».
Пояснюйте словами, не називаючи слова й спільнокореневих. Інші — пишіть здогадки в чат!
⏱ На слово — 3 хвилини.`, true);
    }
    if (!g) { if (kind === 'cb') return alert('Гра вже закінчилась. Почніть нову: /krokodyl'); return; }
    g.last = now;
    if (kind === 'cb') {
      if (data === 'croc:show') return from.id === g.host ? alert(`🤫 Ваше слово: «${g.word}»`) : alert('Слово бачить лише той, хто пояснює 😉');
      if (data === 'croc:skip') {
        if (from.id !== g.host) return alert('Змінити слово може лише той, хто пояснює');
        g.word = pickWord(g.word); g.start = now; save();
        return alert(`🔄 Нове слово: «${g.word}»`);
      }
      if (data === 'croc:stop') {
        if (from.id !== g.host) return alert('Завершити може той, хто пояснює');
        this.sql.exec('DELETE FROM kv WHERE k = ?', key);
        const top = Object.values(g.scores).sort((a, b) => b.n - a.n).slice(0, 5);
        await alert('Гру завершено');
        return say(`🐊 Крокодил завершено. Слово було «${g.word}».` + (top.length ? '\n🏆 ' + top.map(s => `${esc(s.name)} — ${s.n}`).join(' · ') : '') + '\nЩе раз: /krokodyl');
      }
      return;
    }
    // a message in the chat
    if (now - g.start > ROUND_MS) {
      const old = g.word; g.word = pickWord(old); g.start = now; save();
      return say(`⏰ Час вийшов! Слово було «${old}». <b>${esc(g.hostName)}</b>, у вас нове слово 👇`, true);
    }
    if (from.id === g.host) {
      if (leaks(text, g.word)) {
        const old = g.word; g.word = pickWord(old); g.start = now; save();
        return say(`🙊 ${name}, слово (чи його корінь) називати не можна! Це було «${old}». Нове слово 👇`, true);
      }
      return save();
    }
    if (names(text, g.word)) {
      const old = g.word;
      const s = g.scores[from.id] || { name: from.name, n: 0 }; s.n++; g.scores[from.id] = s;
      award(from.id, from.name); award(g.host, g.hostName);
      g.host = from.id; g.hostName = from.name; g.word = pickWord(old); g.start = now; save();
      return say(`✅ <b>${name}</b> вгадав(ла): «${old}»! +1 очко вам і тому, хто пояснював.
Тепер пояснює <b>${name}</b> 👇`, true);
    }
    save();
  }

  // ---------- the hourly cron: evening tournament, reminders, season ----------
  async hourly() {
    const h = this.env.FAKE_KYIV_HOUR != null ? Number(this.env.FAKE_KYIV_HOUR) : kyivHour(), out = {};   // FAKE_KYIV_HOUR: .dev.vars only
    if (h === EVENING_HOUR) out.evening = await this.eveningStart();
    if (h === EVENING_HOUR + 1) out.evening = await this.eveningClose();
    if (h === 16 || h === 17) { await this.seasonClose(); out.remind = await this.remind(); }
    return out;
  }
  eveningWindow(now = Date.now()) {
    const start = kyivMidnight(now) + EVENING_HOUR * 3600 * 1000;
    return { start, end: start + 3600 * 1000 };
  }
  eveningRows(w, limit) {
    return this.sql.exec(`SELECT r.id AS id, p.name AS name, SUM(r.res = 'win') AS wins, SUM(r.pts) AS points, MIN(r.ts) AS first
      FROM results r JOIN players p ON p.id = r.id WHERE r.game = 'durak' AND r.ts >= ? AND r.ts < ? GROUP BY r.id HAVING points > 0
      ORDER BY points DESC, wins DESC, first ASC LIMIT ?`, w.start, w.end, limit).toArray();
  }
  // for the app: is it on now, when the next one starts, the standings and my place
  evening(id) {
    const now = Date.now(), w = this.eveningWindow(now);
    const live = now >= w.start && now < w.end;
    const next = now < w.start ? w.start : w.start + 86400 * 1000;
    const rows = live ? this.eveningRows(w, 100) : [];
    const i = id ? rows.findIndex(r => r.id === String(id)) : -1;
    return { live, start: live ? w.start : next, end: live ? w.end : next + 3600 * 1000, now, prizes: EVENING_PRIZES,
      top: rows.slice(0, 5).map(({ name, points, wins }) => ({ name, points, wins })), me: i >= 0 ? { place: i + 1, points: rows[i].points } : null,
      last: this.kvGet('evening_last') };
  }
  async eveningStart() {
    const day = kyivDay();
    if (this.kvGet('evening_started') === day) return 'already';
    this.kvSet('evening_started', day);
    const { groupId } = await this.community();
    if (groupId) await tg(this.env, 'sendMessage', { chat_id: groupId, parse_mode: 'HTML',
      text: `🔥 <b>Вечірній турнір з Дурня почався!</b>\nДо 21:00 кожна онлайн-перемога в 🃏 Дурні — в таблицю вечора.\n🎁 Призи: 🥇 +${EVENING_PRIZES[0]} · 🥈 +${EVENING_PRIZES[1]} · 🥉 +${EVENING_PRIZES[2]} очок`,
      reply_markup: { inline_keyboard: [[{ text: '🃏 Грати в турнірі', url: 'https://t.me/IgryUA_bot?startapp=ev' }]] } }).catch(() => {});
    return 'started';
  }
  async eveningClose() {
    const day = kyivDay();
    if (this.kvGet('evening_closed') === day) return 'already';
    this.kvSet('evening_closed', day);
    const w = this.eveningWindow(Date.now() - 3600 * 1000);
    const rows = this.eveningRows(w, 10);
    const winners = rows.slice(0, EVENING_PRIZES.length).map((r, i) => ({ ...r, place: i + 1, prize: EVENING_PRIZES[i] }));
    for (const x of winners) this.sql.exec('UPDATE players SET points = points + ? WHERE id = ?', x.prize, x.id);
    this.kvSet('evening_last', { day, winners: winners.map(({ name, points, place, prize }) => ({ name, points, place, prize })) });
    const medal = ['🥇', '🥈', '🥉'];
    for (const x of winners) await tg(this.env, 'sendMessage', { chat_id: x.id.slice(3), parse_mode: 'HTML',
      text: `${medal[x.place - 1]} Вечірній турнір з Дурня: ви на <b>${x.place} місці</b> — <b>+${x.prize}</b> очок! Завтра о 20:00 — знову 🃏` }).catch(() => {});
    const { groupId } = await this.community();
    if (groupId) await tg(this.env, 'sendMessage', { chat_id: groupId, parse_mode: 'HTML',
      text: rows.length ? topText(rows, '🃏 <b>Підсумки вечірнього турніру з Дурня</b>') + `\n\n🎁 ${winners.map(x => `${medal[x.place - 1]} ${esc(x.name)} +${x.prize}`).join('  ')}\nЗавтра о 20:00 — новий турнір!`
        : '🃏 Вечірній турнір з Дурня завершився — сьогодні без переможців. Завтра о 20:00 — новий шанс!' }).catch(() => {});
    return 'closed';
  }

  // ---------- the owner's dashboard: daily series for 30 days ----------
  dash() {
    const today = kyivDay(), now = Date.now(), DAYS = 30;
    const days = Array.from({ length: DAYS }, (_, k) => today - DAYS + 1 + k);
    const startTs = kyivMidnight(now) - (DAYS - 1) * 86400 * 1000;
    const dayOf = ts => kyivDay(ts);
    const series = () => Object.fromEntries(days.map(d => [d, 0]));
    const newP = series(), dau = series(), online = series(), bots = series(), stars = series();
    for (const r of this.sql.exec('SELECT first_seen FROM players WHERE first_seen >= ?', startTs).toArray()) { const d = dayOf(r.first_seen); if (d in newP) newP[d]++; }
    for (const r of this.sql.exec('SELECT day, COUNT(*) AS n FROM visits WHERE day >= ? GROUP BY day', days[0]).toArray()) if (r.day in dau) dau[r.day] = r.n;
    for (const r of this.sql.exec('SELECT DISTINCT ts, game FROM results WHERE ts >= ?', startTs).toArray()) { const d = dayOf(r.ts); if (d in online) online[d]++; }
    const games = {};
    for (const d of days) { const c = this.kvGet('c:' + d) || {}; for (const k in c) if (k.startsWith('bot:')) { bots[d] += c[k]; games[k.slice(4)] = (games[k.slice(4)] || 0) + c[k]; } }
    for (const r of this.sql.exec('SELECT game, COUNT(DISTINCT ts) AS n FROM results WHERE ts >= ? GROUP BY game', startTs).toArray()) games[r.game] = (games[r.game] || 0) + r.n;
    for (const r of this.sql.exec('SELECT ts, stars FROM purchases WHERE ts >= ?', startTs).toArray()) { const d = dayOf(r.ts); if (d in stars) stars[d] += r.stars; }
    const sources = this.sql.exec(`SELECT CASE WHEN source = '' THEN 'old' ELSE source END AS source, COUNT(*) AS total,
      SUM(first_seen >= ?) AS week, SUM(first_seen > 0 AND last_seen - first_seen > 72000000) AS returned FROM players GROUP BY 1 ORDER BY total DESC`, now - WEEK).toArray();
    const one = (q, ...a) => this.sql.exec(q, ...a).one().n;
    const label = d => new Date(d * 86400000).toISOString().slice(5, 10).split('-').reverse().join('.');
    return {
      days: days.map(label), newPlayers: days.map(d => newP[d]), active: days.map(d => dau[d]), onlineGames: days.map(d => online[d]),
      botGames: days.map(d => bots[d]), stars: days.map(d => stars[d]), games: Object.entries(games).sort((a, b) => b[1] - a[1]), sources,
      totals: { players: one('SELECT COUNT(*) AS n FROM players'), online: this.ping(null).online, stars: one('SELECT COALESCE(SUM(stars), 0) AS n FROM purchases'),
        vips: one('SELECT COUNT(*) AS n FROM players WHERE vip_until > ?', now), notify: one('SELECT COUNT(*) AS n FROM players WHERE pm_ok = 1 AND mute = 0') },
    };
  }

  // ---------- friends ----------
  befriend(a, b, played) {
    if (a === b) return;
    const now = Date.now();
    for (const [x, y] of [[a, b], [b, a]]) {
      this.sql.exec('INSERT INTO friends(a, b, ts, games) VALUES(?, ?, ?, ?) ON CONFLICT(a, b) DO UPDATE SET ts = excluded.ts, games = games + ?',
        x, y, now, played ? 1 : 0, played ? 1 : 0);
    }
  }
  friends(id) {
    const now = Date.now();
    const rows = this.sql.exec(`SELECT f.b AS id, p.name AS name, p.last_seen AS seen, f.games AS games, p.pm_ok AS pm
      FROM friends f JOIN players p ON p.id = f.b WHERE f.a = ? ORDER BY p.last_seen DESC LIMIT 60`, String(id)).toArray();
    return rows.map(r => {
      const t = this.seen.get(r.id);
      return { id: r.id, pub: this.pubOf(r.id), name: r.name, online: !!t && now - t < 150000, seen: r.seen || 0, games: r.games, pm: !!r.pm };
    }).sort((x, y) => (y.online - x.online) || (y.seen - x.seen));
  }
  // may «from» call «to» into a game now? (friends, the bot may write, at most once per 2 minutes)
  canInvite(from, to) {
    const f = this.sql.exec('SELECT COUNT(*) AS n FROM friends WHERE a = ? AND b = ?', String(from), String(to)).one().n;
    if (!f) return { ok: false, why: 'not friends' };
    const p = this.sql.exec('SELECT pm_ok FROM players WHERE id = ?', String(to)).toArray()[0];
    if (!p || !p.pm_ok) return { ok: false, why: 'no pm' };
    const k = from + '>' + to, t = this.invited.get(k) || 0;
    if (Date.now() - t < 120000) return { ok: false, why: 'too often' };
    this.invited.set(k, Date.now());
    return { ok: true };
  }

  // ---------- daily quests ----------
  questEvent(id, e) {
    if (!/^tg:\d+$/.test(String(id))) return [];
    const day = kyivDay(), qs = questsFor(day), done = [];
    qs.forEach((q, qi) => {
      if (!questHit(q, e)) return;
      this.sql.exec('INSERT INTO quests(id, day, qi) VALUES(?, ?, ?) ON CONFLICT DO NOTHING', id, day, qi);
      const r = this.sql.exec('SELECT prog, done FROM quests WHERE id = ? AND day = ? AND qi = ?', id, day, qi).one();
      if (r.done) return;
      const prog = r.prog + 1, fin = prog >= q.n;
      this.sql.exec('UPDATE quests SET prog = ?, done = ? WHERE id = ? AND day = ? AND qi = ?', prog, fin ? 1 : 0, id, day, qi);
      if (fin) { this.sql.exec('UPDATE players SET points = points + ? WHERE id = ?', QUEST_PTS, id); done.push({ text: q.text, pts: QUEST_PTS }); }
    });
    if (done.length) {
      const all = this.sql.exec('SELECT COUNT(*) AS n FROM quests WHERE id = ? AND day = ? AND done = 1', id, day).one().n;
      if (all === qs.length) { this.sql.exec('UPDATE players SET points = points + ? WHERE id = ?', QUEST_ALL, id); done.push({ text: 'Усі завдання дня', pts: QUEST_ALL, all: true }); }
    }
    return done;
  }
  quests(id) {
    const day = kyivDay(), qs = questsFor(day);
    const rows = /^tg:\d+$/.test(String(id)) ? this.sql.exec('SELECT qi, prog, done FROM quests WHERE id = ? AND day = ?', id, day).toArray() : [];
    return {
      reward: QUEST_PTS, all: QUEST_ALL,
      list: qs.map((q, qi) => { const r = rows.find(x => x.qi === qi) || { prog: 0, done: 0 }; return { text: q.text, need: q.n, prog: Math.min(r.prog, q.n), done: !!r.done }; }),
    };
  }

  // ---------- Telegram Stars ----------
  // {id, item, stars, charge}: a paid order (charge = Telegram's payment id, so a repeat is ignored)
  buy({ id, item, stars, charge }) {
    if (!/^tg:\d+$/.test(String(id)) || !item || !charge) return { ok: false };
    if (this.sql.exec('SELECT COUNT(*) AS n FROM purchases WHERE charge = ?', charge).one().n) return { ok: true, repeat: true };
    this.sql.exec('INSERT INTO players(id, name) VALUES(?, ?) ON CONFLICT(id) DO NOTHING', id, 'Гравець');
    this.sql.exec('INSERT INTO purchases(id, item, stars, charge, ts) VALUES(?, ?, ?, ?, ?)', id, item, stars | 0, charge, Date.now());
    if (item === 'vip') {
      const p = this.sql.exec('SELECT vip_until FROM players WHERE id = ?', id).one();
      const until = Math.max(Date.now(), p.vip_until || 0) + 30 * 86400 * 1000;
      this.sql.exec('UPDATE players SET vip_until = ? WHERE id = ?', until, id);
      return { ok: true, vip_until: until };
    }
    return { ok: true };
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

  // a random public number for each player (leaderboards show it instead of the Telegram id)
  pubOf(id) {
    const r = this.sql.exec('SELECT pub FROM players WHERE id = ?', String(id)).toArray()[0];
    if (!r) return 0;
    if (r.pub) return r.pub;
    const pub = 100000000 + Math.floor(Math.random() * 900000000);
    this.sql.exec('UPDATE players SET pub = ? WHERE id = ?', pub, String(id));
    return pub;
  }
  top(period) {
    if (period === 'week') return this.tourRows(10).map(({ id, name, points, wins }) => ({ pub: this.pubOf(id), name, points, wins }));
    return this.sql.exec('SELECT id, name, points, wins FROM players ORDER BY points DESC, wins DESC LIMIT 10').toArray()
      .map(({ id, name, points, wins }) => ({ pub: this.pubOf(id), name, points, wins }));
  }

  // ---------- a player's card: level, wins, favourite games, achievements, head-to-head with the viewer ----------
  player(pub, viewer) {
    const p = this.sql.exec('SELECT * FROM players WHERE pub = ?', Number(pub) || -1).toArray()[0];
    if (!p) return { ok: false };
    const favs = Object.entries(GAME_COL).map(([g, col]) => [g, p[col] || 0]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([g, n]) => ({ game: g, wins: n }));
    const ach = achievements(p).filter(a => a.done).map(a => a.icon + ' ' + a.name);
    let h2h = null;
    if (viewer && viewer !== p.id) {
      const rows = this.sql.exec(`SELECT a.res AS mine, b.res AS his FROM results a JOIN results b ON a.ts = b.ts AND a.game = b.game
        WHERE a.id = ? AND b.id = ?`, String(viewer), p.id).toArray();
      h2h = { games: rows.length, mine: rows.filter(r => r.mine === 'win').length, his: rows.filter(r => r.his === 'win').length };
    }
    const ch = this.kvGet('champion');
    return {
      ok: true, name: p.name, points: p.points, wins: p.wins, games: p.games, level: level(p.points),
      favs, achievements: ach, vip: (p.vip_until || 0) > Date.now(), champion: !!ch && ch.id === p.id && ch.until > Date.now(),
      cups: (p.cup1 || 0) + (p.cup2 || 0) + (p.cup3 || 0), online: (Date.now() - (this.seen.get(p.id) || 0)) < 150000,
      friend: !!viewer && this.sql.exec('SELECT COUNT(*) AS n FROM friends WHERE a = ? AND b = ?', String(viewer), p.id).one().n > 0, h2h,
    };
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
      top: rows.slice(0, 10).map(({ id, name, points, wins }) => ({ pub: this.pubOf(id), name, points, wins })),
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
    // the club of the week: every member +5
    const bestClub = this.clubWeek().find(c => c.points > 0) || null;
    if (bestClub) this.sql.exec('UPDATE players SET points = points + 5 WHERE id IN (SELECT id FROM club_members WHERE club = ?)', bestClub.code);
    this.kvSet('tour_start', now);
    this.kvSet('tour_last', { end: now, club: bestClub ? bestClub.name : null, winners: winners.map(({ name, points, place, prize }) => ({ name, points, place, prize })) });
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
      text: topText(rows, '🏆 <b>Підсумки турніру тижня</b>') + (bestClub ? `\n\n🏠 Клуб тижня — <b>${esc(bestClub.name)}</b> (${bestClub.points} оч.): кожному учаснику +5!` : '') + `\n\n🎁 <b>Призи:</b>\n${prizes}\n\nНовий турнір уже почався — грайте онлайн з друзями в @IgryUA_bot і забирайте призи: 🥇 +${PRIZES[0]}, 🥈 +${PRIZES[1]}, 🥉 +${PRIZES[2]} 🎲`,
    });
    return { posted: !!r.ok };
  }
}
