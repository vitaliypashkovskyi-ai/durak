// Stats: one Durable Object (SQLite) with players' points, results for the weekly top,
// and a cached lookup of the news channel and the players' chat linked to it.
import { tg, CHANNEL, topText } from './telegram.js';

const PTS = { win: 3, draw: 1, lose: 0 };
const GAME_COL = { durak: 'durak_w', battle: 'battle_w', mafia: 'mafia_w', thousand: 'thousand_w', spy: 'spy_w', goat: 'goat_w', rpoker: 'rpoker_w', svara: 'svara_w' };
const EXTRA_COLS = ['thousand_w', 'spy_w', 'spyrole_w', 'goat_w', 'streak', 'best_streak', 'last_day', 'rpoker_w',
  'welcome_done', 'ref_by', 'refs', 'ref_day', 'ref_today', 'svara_w'];
const WELCOME = 10, REF_FRIEND = 5, REF_INVITER = 15, REF_PER_DAY = Infinity;   // no daily cap (user's choice)
const LEVELS = [[0, 'Новачок 🌱'], [15, 'Аматор 🙂'], [40, 'Гравець 🎯'], [90, 'Досвідчений 💪'], [180, 'Майстер 🏅'], [350, 'Легенда 👑']];
const WEEK = 7 * 86400 * 1000;

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
  ['⚓', 'Адмірал', '15 перемог у Морському бої', p => p.battle_w, 15],
  ['🎭', 'Дон мафії', '5 перемог за мафію', p => p.don_w, 5],
  ['🏙', 'Захисник міста', '15 перемог за місто в Мафії', p => p.mafia_w - p.don_w, 15],
  ['🕵️', 'Розвідник', '3 перемоги шпигуном', p => p.spyrole_w, 3],
  ['🔍', 'Ловець шпигунів', '5 перемог агентом у Шпигуні', p => p.spy_w - p.spyrole_w, 5],
  ['🤝', 'Душа компанії', 'Запросіть 5 друзів', p => p.refs, 5],
  ['🌈', 'Майстер на всі руки', 'Виграйте в кожну гру хоча б раз',
    p => ['durak_w', 'thousand_w', 'goat_w', 'battle_w', 'mafia_w', 'spy_w', 'rpoker_w', 'svara_w'].filter(c => p[c] > 0).length, 8],
];
export function achievements(p) {
  return ACHIEVEMENTS.map(([icon, name, how, f, goal]) => {
    const have = Math.max(0, Math.min(Number(f(p)) || 0, goal));
    return { icon, name, how, have, goal, done: have >= goal };
  });
}
export const badges = p => achievements(p).filter(a => a.done).map(a => `${a.icon} ${a.name}`);

// Today's date in Kyiv as a day number (the daily bonus resets at midnight Kyiv time)
function kyivDay() {
  const s = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' });
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
  }

  async fetch(req) {
    const url = new URL(req.url);
    const body = req.method === 'POST' ? await req.json() : null;
    if (url.pathname === '/report') { this.report(body); return json({ ok: true }); }
    if (url.pathname === '/profile') return json(this.profile(body.id));
    if (url.pathname === '/daily') return json(this.daily(body.id, body.name));
    if (url.pathname === '/hello') return json(this.hello(body.id, body.name, body.ref));
    if (url.pathname === '/top') return json(this.top(url.searchParams.get('period')));
    if (url.pathname === '/community') return json(await this.community());
    if (url.pathname === '/weekly') return json(await this.weekly());
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
    const week = this.sql.exec('SELECT COALESCE(SUM(pts), 0) AS s FROM results WHERE id = ? AND ts > ?', String(id), Date.now() - WEEK).one().s;
    const today = kyivDay();
    const streak = p.last_day >= today - 1 ? p.streak : 0;
    // next = what the next claim gives (today if not claimed yet, otherwise tomorrow)
    const daily = { available: p.last_day !== today, streak, next: dailyBonus(p.last_day === today || p.last_day === today - 1 ? p.streak + 1 : 1) };
    return { ...p, rank, week, level: level(p.points), badges: badges(p), achievements: achievements(p), daily };
  }

  // First visit: +10 once. A brand-new player who came by a friend's link gets +5 more and the
  // friend +15 for every new player, without a daily cap.
  hello(id, name, ref) {
    if (!/^tg:\d+$/.test(String(id))) return { ok: false };
    const existed = this.sql.exec('SELECT welcome_done FROM players WHERE id = ?', id).toArray()[0];
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

  top(period) {
    if (period === 'week') {
      return this.sql.exec(`SELECT p.name AS name, SUM(r.pts) AS points, SUM(r.res = 'win') AS wins
        FROM results r JOIN players p ON p.id = r.id WHERE r.ts > ? GROUP BY r.id ORDER BY points DESC, wins DESC LIMIT 10`,
      Date.now() - WEEK).toArray();
    }
    return this.sql.exec('SELECT name, points, wins FROM players ORDER BY points DESC, wins DESC LIMIT 10').toArray();
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

  async weekly() {
    const rows = this.top('week');
    if (!rows.length) return { posted: false };
    const { channelId } = await this.community();
    if (!channelId) return { posted: false };
    const r = await tg(this.env, 'sendMessage', {
      chat_id: channelId, parse_mode: 'HTML', disable_web_page_preview: true,
      text: topText(rows, '🏆 <b>Топ-10 гравців тижня</b>') + '\n\nГрайте з друзями в @IgryUA_bot — і потрапляйте в топ! 🎲',
    });
    return { posted: !!r.ok };
  }
}
