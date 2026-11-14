// Вікторина: screen — the question, four answers, a countdown, who has answered, the reveal and the scores.
import * as E from './quiz-engine.js';
import { $, haptic, toast, sfx, mark } from './common.js';

export const rules = `
<p>2–8 гравців, ${E.ROUNDS} питань. На кожне — <b>${E.Q_MS / 1000} секунд</b>: усі відповідають одночасно, обравши один із чотирьох варіантів.</p>
<p>Правильна відповідь — <b>+10</b> і ще до <b>+5</b> за швидкість. Неправильна або без відповіді — 0.</p>
<p>Після кожного питання видно правильну відповідь і хто що обрав. Перемагає той, у кого найбільше очок.</p>
<p>Теми: Україна, світ, наука, спорт, культура й різне — можна обрати одну або грати всі.</p>`;

let api, V = null, busy = false, tick = null, shownAt = 0;

export function mount(box, a) {
  api = a; V = null; busy = false; clearInterval(tick);
  box.innerHTML = `
    <div class="qzhead" id="qzHead"></div>
    <div class="qztimer"><span id="qzBar"></span></div>
    <div class="qzq" id="qzQ"></div>
    <div class="qzopts" id="qzOpts"></div>
    <div id="status"></div>
    <div class="qzscores" id="qzScores"></div>`;
  tick = setInterval(drawTimer, 200);
}

function nm(i) {
  if (i === V.seat) return 'Ви';
  const p = V.players[i];
  return (p.bot ? '🤖 ' : '') + p.name + mark(i);
}

export function render(v) {
  const prev = V;
  V = v; busy = false; shownAt = Date.now();
  if (v.ev) {
    if (v.ev.kind === 'question') sfx('pop');
    if (v.ev.kind === 'reveal') {
      const g = v.players[v.seat].gain;
      if (g) { sfx('chime'); haptic('success'); } else if (v.mine != null) { sfx('lose'); }
    }
    if (v.ev.kind === 'left') toast(`${v.players[v.ev.who].name} вийшов — замість нього бот`);
  }
  void prev;
  draw();
}

function send(m) {
  if (busy || !V || V.over) return;
  const r = api.act(m);
  if (r === null) { busy = true; draw(); }
  else if (r === false) toast('Вже не можна');
  else haptic('light');
}

function drawTimer() {
  if (!V || !$('qzBar')) return;
  const left = V.phase === 'q' ? Math.max(0, V.leftMs - (Date.now() - shownAt)) : 0;
  $('qzBar').style.width = (100 * left / E.Q_MS) + '%';
  $('qzBar').className = left < 5000 ? 'low' : '';
}

function draw() {
  if (!V) return;
  const v = V, me = v.seat, reveal = v.phase === 'reveal';
  $('qzHead').textContent = `Питання ${v.round + 1} з ${v.rounds} · ${v.cat}`;
  $('qzQ').textContent = v.text;
  const box = $('qzOpts'); box.innerHTML = '';
  v.opts.forEach((t, k) => {
    const b = document.createElement('button');
    let cls = 'qzopt';
    if (v.mine === k) cls += ' mine';
    if (reveal && k === v.right) cls += ' right';
    else if (reveal && v.mine === k) cls += ' wrong';
    b.className = cls;
    b.textContent = t;
    // who picked it (shown at the reveal)
    if (reveal) {
      const who = v.players.map((p, i) => (p.pick === k ? (i === me ? 'ви' : p.name) : null)).filter(Boolean);
      if (who.length) { const s = document.createElement('small'); s.textContent = who.join(', '); b.appendChild(s); }
    }
    b.disabled = reveal || v.mine != null || v.over;
    b.onclick = () => send({ t: 'answer', a: k });
    box.appendChild(b);
  });
  const sc = $('qzScores'); sc.innerHTML = '';
  v.players.map((p, i) => [i, p]).sort((a, b) => b[1].score - a[1].score).forEach(([i, p]) => {
    const s = document.createElement('span');
    s.className = 'qzp' + (i === me ? ' me' : '');
    s.textContent = `${nm(i)} ${p.score}` + (reveal && p.gain ? ` (+${p.gain})` : '') + (!reveal && v.phase === 'q' ? (p.answered ? ' ✓' : ' …') : '') + (api.online && !api.online[i] ? ' 📴' : '');
    sc.appendChild(s);
  });
  const mine = v.players[me];
  $('status').textContent = v.over ? '' : busy ? '…' : reveal ? (mine.gain ? `Правильно! +${mine.gain}` : v.mine == null ? 'Не встигли 😅' : 'Ні, правильна відповідь підсвічена') :
    v.mine != null ? 'Відповідь прийнята — чекаємо інших…' : 'Оберіть відповідь!';
  drawTimer();
}

export function result(v) {
  V = v;
  const win = v.winners.includes(v.seat);
  const res = win ? (v.winners.length > 1 ? 'draw' : 'win') : 'lose';
  const table = v.players.map((p, i) => [i, p.score]).sort((a, b) => b[1] - a[1]).map(([i, s]) => `${nm(i)}: ${s}`).join('\n');
  return { res, icon: win ? '🏆' : '❓', title: win ? (res === 'draw' ? 'Нічия на першому місці' : 'Ви — знавець! 🧠') : `Переміг ${nm(v.winners[0])}`, text: table };
}
