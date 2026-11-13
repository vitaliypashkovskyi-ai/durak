// Мафія: screen — phase and timer, your role, players (tap = your night action or day vote), chat.
import { ROLES } from './mafia-engine.js';
import { $, haptic, toast } from './common.js';

export const rules = `
<p>5–12 гравців. Ролі роздає гра: <b>мафія</b> (1–3), <b>лікар</b>, <b>комісар</b>, решта — <b>мирні</b>. Свою роль бачите лише ви; мафія знає одне одного.</p>
<p><b>🌙 Ніч:</b> мафія обирає жертву (у мафії свій чат), лікар рятує одного гравця (не того самого дві ночі поспіль), комісар перевіряє одного гравця й дізнається, чи це мафія.</p>
<p><b>☀️ День:</b> гра оголошує, хто загинув. Усі обговорюють у чаті й голосують, кого стратити (або пропускають). Страчують того, хто набрав найбільше голосів, якщо їх більше, ніж «пропустити».</p>
<p>Ролі загиблих відкриваються. <b>Місто</b> перемагає, коли мафії не лишилось; <b>мафія</b> — коли її стільки ж, скільки інших.</p>
<p class="muted">Торкніться гравця, щоб обрати ціль або проголосувати.</p>`;

let api, V = null, busy = false, lastNum = null, lastPhase = null, recvAt = 0, timer = null, lastChatId = 0;

export function mount(box, a) {
  api = a; V = null; busy = false; lastNum = null; lastPhase = null; lastChatId = 0;
  box.innerHTML = `
    <div class="mbar"><span id="mPhase"></span><span id="mTimer"></span></div>
    <div class="mrole" id="mRole"></div>
    <div class="mplayers" id="mPlayers"></div>
    <div id="status"></div>
    <div class="brow" id="mBtns"></div>
    <div class="mchat" id="mChat"></div>
    <form class="msay" id="mSay" autocomplete="off"><input id="mInput" maxlength="200" enterkeyhint="send"><button>➤</button></form>`;
  $('mSay').onsubmit = e => {
    e.preventDefault();
    const t = $('mInput').value.trim();
    if (!t) return;
    const r = api.act({ t: 'say', text: t });
    if (r === false) toast('Зараз писати не можна');
    else $('mInput').value = '';
  };
  clearInterval(timer);
  timer = setInterval(tickTimer, 500);
}

function nm(i) {
  if (i === V.seat) return 'Ви';
  const p = V.players[i];
  return (p.bot ? '🤖 ' : '') + p.name;
}
const roleText = r => `${ROLES[r].icon} ${ROLES[r].name}`;

export function render(v) {
  const fresh = v.num !== lastNum;
  V = v; busy = false; recvAt = Date.now();
  if (fresh) { lastNum = v.num; lastPhase = null; lastChatId = 0; }
  if (v.phase !== lastPhase) {
    if (lastPhase !== null || fresh) phaseToast();
    lastPhase = v.phase;
  }
  draw();
}

function phaseToast() {
  const v = V;
  if (v.phase === 'intro') toast(`Ваша роль: ${roleText(v.role)}`);
  else if (v.phase === 'night') toast(`🌙 Ніч ${v.day}`);
  else if (v.phase === 'day') toast(`☀️ День ${v.day}: голосування`);
  if (v.phase === 'night' && v.players[v.seat].alive && v.role !== 'civ') haptic('medium');
}

function tickTimer() {
  if (!V || !$('mTimer')) return;
  if (V.over) { $('mTimer').textContent = ''; return; }
  const s = Math.max(0, Math.ceil((V.left - (Date.now() - recvAt)) / 1000));
  $('mTimer').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function canTarget(i) {
  const v = V, me = v.seat, p = v.players[i];
  if (busy || v.over || !v.players[me].alive || !p.alive) return false;
  if (v.phase === 'night') {
    if (v.role === 'mafia') return p.role !== 'mafia';
    if (v.role === 'doctor') return i !== v.lastHeal;
    if (v.role === 'detective') return v.myTarget == null && i !== me;
    return false;
  }
  if (v.phase === 'day') return i !== me;
  return false;
}
function send(m) {
  if (busy) return;
  const r = api.act(m);
  if (r === null) { busy = true; draw(); }
  else if (r === false) toast('Так не можна');
  else haptic('light');
}

function hint() {
  const v = V, me = v.seat;
  if (v.over) return '';
  if (!v.players[me].alive) return 'Вас убито. Можна стежити за грою 👀';
  const tgt = v.myTarget != null && v.myTarget >= 0 ? nm(v.myTarget) : null;
  if (v.phase === 'intro') return 'Запам’ятайте свою роль. Скоро ніч…';
  if (v.phase === 'night') {
    if (v.role === 'mafia') return tgt ? `Ваша жертва: ${tgt}. Можна змінити` : 'Оберіть жертву (торкніться гравця)';
    if (v.role === 'doctor') return tgt ? `Рятуєте: ${tgt}. Можна змінити` : 'Кого врятувати цієї ночі?';
    if (v.role === 'detective') return tgt ? 'Перевірку зроблено — результат у вашій ролі' : 'Кого перевірити?';
    return 'Місто спить… 😴';
  }
  if (v.phase === 'day') {
    if (v.myTarget === -1) return 'Ви пропустили голосування. Можна змінити';
    return tgt ? `Ваш голос: ${tgt}. Можна змінити` : 'Обговорюйте й голосуйте: торкніться гравця';
  }
  if (v.phase === 'morning') return 'Ранок. Скоро обговорення…';
  if (v.phase === 'verdict') return 'Підсумки дня. Скоро ніч…';
  return '';
}

function draw() {
  if (!V) return;
  const v = V, me = v.seat;
  const ph = { intro: '🎭 Знайомство', night: `🌙 Ніч ${v.day}`, morning: `☀️ Ранок ${v.day}`, day: `☀️ День ${v.day}`, verdict: `⚖️ Вирок ${v.day}`, over: '🏁 Кінець гри' };
  $('mPhase').textContent = ph[v.phase] || '';
  $('game').classList.toggle('nightmode', v.phase === 'night');
  tickTimer();

  // role card
  const mates = v.role === 'mafia' ? v.players.map((p, i) => (i !== me && p.role === 'mafia' ? nm(i) : null)).filter(Boolean) : [];
  let rt = `Ваша роль: <b>${roleText(v.role)}</b>`;
  if (!v.players[me].alive) rt = '💀 ' + rt;
  const role = $('mRole');
  role.innerHTML = rt;
  const extra = document.createElement('div');
  extra.className = 'mextra';
  if (mates.length) extra.textContent = `Ваша команда: ${mates.join(', ')}`;
  if (v.role === 'detective' && v.checks.length) {
    extra.textContent = 'Перевірки: ' + v.checks.map(c => `${v.players[c.i].name} — ${c.mafia ? 'МАФІЯ 🔫' : 'мирний'}`).join('; ');
  }
  if (extra.textContent) role.appendChild(extra);

  // players
  const box = $('mPlayers'); box.innerHTML = '';
  const tally = {};
  if (v.votes) v.votes.forEach((t, i) => { if (t != null && t >= 0 && v.players[i].alive) tally[t] = (tally[t] || 0) + 1; });
  v.players.forEach((p, i) => {
    const d = document.createElement('button');
    const can = canTarget(i);
    d.className = 'mp' + (p.alive ? '' : ' dead') + (i === me ? ' me' : '') + (v.myTarget === i ? ' sel' : '') +
      (p.role === 'mafia' && v.role === 'mafia' && i !== me ? ' mate' : '') + (can ? ' can' : '');
    d.disabled = !can;
    const av = document.createElement('span'); av.className = 'av'; av.textContent = p.alive ? (p.role ? ROLES[p.role].icon : String(i + 1)) : '💀';
    const name = document.createElement('span'); name.className = 'pn'; name.textContent = nm(i);
    const sub = document.createElement('span'); sub.className = 'ps';
    let s = '';
    if (!p.alive && p.role) s = ROLES[p.role].name;
    else if (v.mafiaKills) { const n = v.mafiaKills.filter(t => t === i).length; if (n) s = `🎯 ${n}`; }
    if (v.phase === 'day' && p.alive) {
      if (tally[i]) s = `🗳 ${tally[i]}`;
      if (v.votes && v.votes[i] != null) s += (s ? ' ' : '') + '✓';
    }
    if (api.online && !api.online[i]) s += ' 📴';
    sub.textContent = s;
    d.append(av, name, sub);
    d.onclick = () => send({ t: 'target', i });
    box.appendChild(d);
  });

  $('status').textContent = busy ? '…' : hint();
  const btns = $('mBtns'); btns.innerHTML = '';
  if (!v.over && v.phase === 'day' && v.players[me].alive && v.myTarget !== -1) {
    const b = document.createElement('button'); b.className = 'sec'; b.textContent = '🤷 Пропустити голосування';
    b.onclick = () => send({ t: 'skip' });
    btns.appendChild(b);
  }

  // chat
  const chat = $('mChat');
  const atBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 40;
  chat.innerHTML = '';
  v.chat.forEach(c => {
    const row = document.createElement('div');
    row.className = 'msg ' + c.ch;
    if (c.from >= 0) {
      const who = document.createElement('b');
      who.textContent = (c.ch === 'mafia' ? '🔫 ' : '') + nm(c.from) + ': ';
      row.appendChild(who);
    }
    row.appendChild(document.createTextNode(c.text));
    chat.appendChild(row);
  });
  const newest = v.chat.length ? v.chat[v.chat.length - 1].id : 0;
  if (atBottom || newest !== lastChatId) chat.scrollTop = chat.scrollHeight;
  lastChatId = newest;
  const canSay = !v.over && v.players[me].alive && (v.phase !== 'night' || v.role === 'mafia');
  const inp = $('mInput');
  inp.disabled = !canSay;
  inp.placeholder = !v.players[me].alive ? 'Мертві мовчать 💀' : v.phase === 'night' ? (v.role === 'mafia' ? 'Чат мафії…' : 'Вночі всі сплять…') : 'Повідомлення…';
}

export function result(v) {
  V = v;
  const mine = v.role === 'mafia' ? 'mafia' : 'town';
  const win = v.winner === mine;
  const mafia = v.players.map((p, i) => (p.role === 'mafia' ? p.name : null)).filter(Boolean).join(', ');
  return {
    res: win ? 'win' : 'lose',
    icon: v.winner === 'town' ? '🎉' : '🔫',
    title: v.winner === 'town' ? 'Перемогло місто' : 'Перемогла мафія',
    text: `${win ? 'Ваша команда виграла!' : 'Ваша команда програла.'}\nМафія: ${mafia}`,
  };
}
