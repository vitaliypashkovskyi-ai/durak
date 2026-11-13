// Stats: one Durable Object (SQLite) with players' points, results for the weekly top,
// and a cached lookup of the news channel and the players' chat linked to it.
import { tg, CHANNEL, topText } from './telegram.js';

const PTS = { win: 3, draw: 1, lose: 0 };
const GAME_COL = { durak: 'durak_w', battle: 'battle_w', mafia: 'mafia_w' };
const LEVELS = [[0, 'Новачок 🌱'], [15, 'Аматор 🙂'], [40, 'Гравець 🎯'], [90, 'Досвідчений 💪'], [180, 'Майстер 🏅'], [350, 'Легенда 👑']];
const WEEK = 7 * 86400 * 1000;

export function level(points) {
  let i = 0;
  while (i + 1 < LEVELS.length && points >= LEVELS[i + 1][0]) i++;
  const next = LEVELS[i + 1];
  return { name: LEVELS[i][1], next: next ? { name: next[1], at: next[0] } : null };
}
export function badges(p) {
  const b = [];
  if (p.durak_w >= 15) b.push('🃏 Шулер');
  if (p.battle_w >= 15) b.push('⚓ Адмірал');
  if (p.don_w >= 5) b.push('🎭 Дон мафії');
  if (p.mafia_w - p.don_w >= 15) b.push('🏙 Захисник міста');
  return b;
}

const json = d => new Response(JSON.stringify(d), { headers: { 'Content-Type': 'application/json' } });

export class Stats {
  constructor(state, env) {
    this.env = env;
    this.sql = state.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY, name TEXT, points INTEGER DEFAULT 0,
      games INTEGER DEFAULT 0, wins INTEGER DEFAULT 0, durak_w INTEGER DEFAULT 0, battle_w INTEGER DEFAULT 0,
      mafia_w INTEGER DEFAULT 0, don_w INTEGER DEFAULT 0)`);
    this.sql.exec('CREATE TABLE IF NOT EXISTS results(id TEXT, game TEXT, res TEXT, pts INTEGER, ts INTEGER)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS results_ts ON results(ts)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT)');
  }

  async fetch(req) {
    const url = new URL(req.url);
    const body = req.method === 'POST' ? await req.json() : null;
    if (url.pathname === '/report') { this.report(body); return json({ ok: true }); }
    if (url.pathname === '/profile') return json(this.profile(body.id));
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
      this.sql.exec(`UPDATE players SET points = points + ?, games = games + 1, wins = wins + ?, ${col} = ${col} + ?, don_w = don_w + ? WHERE id = ?`,
        pts, win, win, p.don && win ? 1 : 0, p.id);
      this.sql.exec('INSERT INTO results(id, game, res, pts, ts) VALUES(?, ?, ?, ?, ?)', p.id, game, p.res, pts, now);
    }
    this.sql.exec('DELETE FROM results WHERE ts < ?', now - 5 * WEEK);
  }

  profile(id) {
    const rows = this.sql.exec('SELECT * FROM players WHERE id = ?', String(id)).toArray();
    const p = rows[0] || { name: '', points: 0, games: 0, wins: 0, durak_w: 0, battle_w: 0, mafia_w: 0, don_w: 0 };
    const rank = rows[0] ? this.sql.exec('SELECT COUNT(*) AS n FROM players WHERE points > ?', p.points).one().n + 1 : null;
    const week = this.sql.exec('SELECT COALESCE(SUM(pts), 0) AS s FROM results WHERE id = ? AND ts > ?', String(id), Date.now() - WEEK).one().s;
    return { ...p, rank, week, level: level(p.points), badges: badges(p) };
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
