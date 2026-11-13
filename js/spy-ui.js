// Шпигун: screen — your card (location or "spy"), players and votes, locations list, chat.
import { $, haptic, toast, showPanel, hidePanel, sfx, mark } from './common.js';

export const rules = `
<p>3–10 гравців. Усі, крім одного, бачать <b>локацію</b> (пляж, лікарня, потяг…). Один гравець — <b>шпигун</b>: він локації не знає.</p>
<p><b>Розмова:</b> ставте одне одному питання в чаті («Ти часто тут буваєш?», «Що тут на тобі вдягнено?») — так, щоб свої зрозуміли, а шпигун не здогадався, де ви.</p>
<p><b>Голосування</b> починається, коли більшість натисне «До голосування» або скінчиться час. Спіймали шпигуна — перемогли агенти. Помилились або голоси розділились — переміг шпигун.</p>
<p><b>Шпигун</b> може будь-коли натиснути «Я знаю, де ми!» і назвати локацію: вгадав — він переміг, ні — програв.</p>
<p><b>Боти</b> теж розмовляють: питають гравців і відповідають, коли їх згадати на ім'я («Тарасе, ти тут часто буваєш?»). Бот-шпигун ловить у чаті слова-підказки, тож натякайте обережно!</p>`;

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
    <form class="msay" id="mSay" autocomplete="off"><input id="mInput" maxlength="200" enterkeyhint="send" placeholder="Питання чи відповідь…"><button>➤</button></form>`;
  $('mSay').onsubmit = e => {
    e.preventDefault();
    const t = $('mInput').value.trim();
    if (!t) return;
    if (api.act({ t: 'say', text: t }) !== false) $('mInput').value = '';
  };
  clearInterval(timer);
  timer = setInterval(tickTimer, 500);
}

function nm(i) { if (i === V.seat) return 'Ви'; const p = V.players[i]; return (p.bot ? '🤖 ' : '') + p.name + mark(i); }

export function render(v) {
  const fresh = v.num !== lastNum;
  V = v; busy = false; recvAt = Date.now();
  if (fresh) { lastNum = v.num; lastPhase = null; lastChatId = 0; }
  if (v.phase !== lastPhase) {
    if (v.phase === 'intro') toast(v.role === 'spy' ? '🕵️ Ви — шпигун!' : `📍 Локація: ${v.loc}`);
    if (v.phase === 'vote') { toast('🗳 Голосування!'); haptic('medium'); sfx('bell'); }
    lastPhase = v.phase;
  }
  draw();
}

function tickTimer() {
  if (!V || !$('mTimer')) return;
  if (V.over) { $('mTimer').textContent = ''; return; }
  const s = Math.max(0, Math.ceil((V.left - (Date.now() - recvAt)) / 1000));
  $('mTimer').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function send(m) {
  if (busy) return;
  const r = api.act(m);
  if (r === null) { busy = true; draw(); }
  else if (r === false) toast('Так не можна');
  else haptic('light');
}

function guessPanel() {
  const body = document.createElement('div');
  body.className = 'locs pick';
  V.locations.forEach(l => {
    const b = document.createElement('button');
    b.className = 'chip'; b.textContent = l;
    b.onclick = () => showPanel({ kind: 'choice', title: `«${l}»?`, text: 'Якщо не вгадаєте — програєте.', buttons: [
      { text: '🕵️ Так, ми тут!', fn: () => { hidePanel(); send({ t: 'guess', loc: l }); } },
      { text: 'Назад', sec: true, fn: guessPanel }] });
    body.appendChild(b);
  });
  showPanel({ kind: 'choice', title: 'Де ми?', text: 'Оберіть локацію', body, buttons: [{ text: 'Скасувати', sec: true, fn: hidePanel }] });
}

function draw() {
  if (!V) return;
  const v = V, me = v.seat, n = v.players.length;
  const ph = { intro: '🕵️ Картки роздано', talk: '💬 Розмова', vote: '🗳 Голосування', over: '🏁 Кінець гри' };
  $('mPhase').textContent = ph[v.phase] || '';
  tickTimer();
  // card
  const role = $('mRole');
  role.innerHTML = '';
  const main = document.createElement('div');
  if (v.role === 'spy' && !v.over) main.innerHTML = '🕵️ <b>Ви — шпигун!</b> З розмови вгадайте, де всі.';
  else { main.textContent = '📍 Локація: '; const b = document.createElement('b'); b.textContent = v.loc; main.appendChild(b); }
  role.appendChild(main);
  const ex = document.createElement('div'); ex.className = 'mextra';
  ex.textContent = v.role === 'spy' && !v.over ? 'Не видайте себе. Відповідайте загально, слухайте інших.' : 'Питайте так, щоб шпигун не здогадався, де ви.';
  role.appendChild(ex);
  // players
  const box = $('mPlayers'); box.innerHTML = '';
  const tally = {};
  if (v.votes) v.votes.forEach(t => { if (t != null) tally[t] = (tally[t] || 0) + 1; });
  v.players.forEach((p, i) => {
    const d = document.createElement('button');
    const can = !busy && !v.over && v.phase === 'vote' && i !== me;
    d.className = 'mp' + (i === me ? ' me' : '') + (v.myVote === i ? ' sel' : '') + (can ? ' can' : '') + (v.over && i === v.spy ? ' mate' : '');
    d.disabled = !can;
    const av = document.createElement('span'); av.className = 'av'; av.textContent = v.over && i === v.spy ? '🕵️' : String(i + 1);
    const name = document.createElement('span'); name.className = 'pn'; name.textContent = nm(i);
    const sub = document.createElement('span'); sub.className = 'ps';
    let s = '';
    if (v.phase === 'talk' && p.wantVote) s = '🗳 хоче голосувати';
    if (v.votes && tally[i]) s = `🗳 ${tally[i]}`;
    if (v.phase === 'vote' && p.voted) s += (s ? ' ' : '') + '✓';
    if (v.over && i === v.spy) s = 'шпигун';
    if (api.online && !api.online[i]) s += ' 📴';
    sub.textContent = s;
    d.append(av, name, sub);
    d.onclick = () => send({ t: 'vote', i });
    box.appendChild(d);
  });
  // status + buttons
  const st = v.over ? '' : busy ? '…' :
    v.phase === 'intro' ? 'Запам’ятайте картку. Скоро розмова…' :
    v.phase === 'talk' ? 'Розпитуйте одне одного в чаті' :
    v.myVote != null ? `Ваш голос: ${nm(v.myVote)}. Можна змінити` : 'Торкніться того, хто, на вашу думку, шпигун';
  $('status').textContent = st;
  const btns = $('mBtns'); btns.innerHTML = '';
  const add = (t, fn, cls) => { const b = document.createElement('button'); b.textContent = t; if (cls) b.className = cls; b.onclick = fn; btns.appendChild(b); };
  if (!v.over && v.phase === 'talk' && !v.players[me].wantVote) {
    add(`🗳 До голосування (${v.players.filter(p => p.wantVote).length}/${n})`, () => send({ t: 'callVote' }), 'sec');
  }
  if (!v.over && v.role === 'spy' && (v.phase === 'talk' || v.phase === 'vote')) add('🕵️ Я знаю, де ми!', guessPanel);
  if (!v.over) add('📍 Усі локації', () => {
    const body = document.createElement('div'); body.className = 'locs';
    v.locations.forEach(l => { const s = document.createElement('span'); s.className = 'loc' + (l === v.loc ? ' cur' : ''); s.textContent = l; body.appendChild(s); });
    showPanel({ kind: 'choice', title: 'Можливі локації', body, buttons: [{ text: 'Закрити', sec: true, fn: hidePanel }] });
  }, 'sec');
  // chat
  const chat = $('mChat');
  const atBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 40;
  chat.innerHTML = '';
  v.chat.forEach(c => {
    const row = document.createElement('div');
    row.className = 'msg ' + c.ch;
    if (c.from >= 0) { const w = document.createElement('b'); w.textContent = nm(c.from) + ': '; row.appendChild(w); }
    row.appendChild(document.createTextNode(c.text));
    chat.appendChild(row);
  });
  const newest = v.chat.length ? v.chat[v.chat.length - 1].id : 0;
  if (atBottom || newest !== lastChatId) chat.scrollTop = chat.scrollHeight;
  lastChatId = newest;
  $('mInput').disabled = v.over;
}

export function result(v) {
  V = v;
  const mine = v.role === 'spy' ? 'spy' : 'town';
  const win = v.winner === mine;
  const why = { caught: 'Шпигуна викрили голосуванням.', wrong: 'Місто звинуватило не того.', tie: 'Голоси розділились.',
    guessed: `Шпигун вгадав локацію «${v.loc}».`, missed: `Шпигун помилився: назвав «${v.guess}».` }[v.reason] || '';
  return {
    res: win ? 'win' : 'lose',
    icon: v.winner === 'spy' ? '🕵️' : '🎉',
    title: v.winner === 'spy' ? 'Переміг шпигун' : 'Перемогли агенти',
    text: `${why}\nШпигун — ${nm(v.spy)}, локація — «${v.loc}».`,
  };
}
