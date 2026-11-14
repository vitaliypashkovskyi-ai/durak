// Кості (покер на костях): screen — five dice to hold, roll button, the score sheet.
import * as E from './dice-engine.js';
import { $, haptic, toast, sfx, mark } from './common.js';

export const rules = `
<p>2–6 гравців, 5 кубиків, 13 раундів. За свій хід можна кинути до <b>3 разів</b>: після кидка торкніться кубиків, які хочете відкласти, і перекиньте решту.</p>
<p>Потім запишіть результат в одну вільну клітинку таблиці — навіть якщо там буде 0.</p>
<p><b>Верх:</b> одиниці…шістки — сума цих граней. Набрали у верху ${E.BONUS_AT}+ — бонус <b>+${E.BONUS}</b>.</p>
<p><b>Низ:</b> трійка й каре — сума всіх кубиків; фул-хаус (3+2) — 25; мала стріт (4 поспіль) — 30; велика стріт (5 поспіль) — 40; <b>покер</b> (5 однакових) — 50; шанс — сума всіх.</p>
<p>Після 13 раундів перемагає найбільша сума.</p>`;

let api, V = null, busy = false, hold = [false, false, false, false, false], lastNum = null;
const FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function mount(box, a) {
  api = a; V = null; busy = false; lastNum = null; hold = [false, false, false, false, false];
  box.innerHTML = `
    <div class="dcscore" id="dcScore"></div>
    <div class="dcdice" id="dcDice"></div>
    <div id="status"></div>
    <div class="brow" id="dcBtns"></div>
    <div class="dcsheet" id="dcSheet"></div>`;
}

function nm(i) {
  if (i === V.seat) return 'Ви';
  const p = V.players[i];
  return (p.bot ? '🤖 ' : '') + p.name + mark(i);
}

export function render(v) {
  if (v.num !== lastNum) { lastNum = v.num; hold = [false, false, false, false, false]; }
  V = v; busy = false;
  if (v.turn !== v.seat) hold = v.held.slice();
  const e = v.ev;
  if (e) {
    if (e.kind === 'roll') sfx('pop');
    if (e.kind === 'score') {
      const name = E.CATS.find(c => c[0] === e.cat)[1];
      if (e.seat !== v.seat) toast(`${nm(e.seat)}: ${name} — ${e.pts}`);
      else if (e.cat === 'poker' && e.pts) { sfx('win'); toast('ПОКЕР! +50 🎉'); }
      else sfx('card');
    }
    if (e.kind === 'left') toast(`${v.players[e.who].name} вийшов — замість нього бот`);
  }
  draw();
}

function send(m) {
  if (busy || !V || V.over) return;
  const r = api.act(m);
  if (r === null) { busy = true; draw(); }
  else if (r === false) toast('Так не можна');
  else haptic('light');
}
const myTurn = () => V && !V.over && !busy && V.turn === V.seat;

function draw() {
  if (!V) return;
  const v = V, me = v.seat, n = v.players.length, mine = myTurn();
  // players' totals
  const sc = $('dcScore'); sc.innerHTML = '';
  v.players.forEach((p, i) => {
    const s = document.createElement('span');
    s.className = 'dcp' + (!v.over && v.turn === i ? ' on' : '');
    s.textContent = `${nm(i)} ${p.total}` + (api.online && !api.online[i] ? ' 📴' : '');
    sc.appendChild(s);
  });
  const r = document.createElement('div'); r.className = 'tinfo small';
  r.textContent = `Раунд ${v.round}/${v.rounds}` + (v.turn !== me && !v.over ? ` · кидає ${nm(v.turn)}` : '');
  sc.appendChild(r);
  // dice
  const dd = $('dcDice'); dd.innerHTML = '';
  v.dice.forEach((x, i) => {
    const d = document.createElement('div');
    const held = mine ? hold[i] : v.held[i] && v.rolls > 0;
    d.className = 'dcd' + (x ? '' : ' empty') + (held ? ' held' : '') + (mine && v.rolls && v.rolls < 3 ? ' tap' : '');
    d.textContent = x ? FACES[x] : '·';
    d.onclick = () => { if (mine && v.rolls && v.rolls < 3) { hold[i] = !hold[i]; draw(); } };
    dd.appendChild(d);
  });
  // buttons
  const bb = $('dcBtns'); bb.innerHTML = '';
  if (mine && v.rolls < 3) {
    const b = document.createElement('button');
    b.textContent = v.rolls ? `🎲 Перекинути (${3 - v.rolls})` : '🎲 Кинути кубики';
    b.disabled = v.rolls > 0 && hold.every(Boolean);
    b.onclick = () => send({ t: 'roll', hold: v.rolls ? hold : undefined });
    bb.appendChild(b);
  }
  // sheet: my column + the player whose turn it is (or the leader)
  const other = v.turn !== me ? v.turn : v.players.map((p, i) => [i, p.total]).filter(([i]) => i !== me).sort((a, b) => b[1] - a[1])[0][0];
  const tbl = document.createElement('table'); tbl.className = 'dct';
  const head = document.createElement('tr');
  ['', 'Ви', nm(other)].forEach(t => { const th = document.createElement('th'); th.textContent = t; head.appendChild(th); });
  tbl.appendChild(head);
  const rowFor = (label, a, b, cls, onPick, hint) => {
    const tr = document.createElement('tr'); if (cls) tr.className = cls;
    const td0 = document.createElement('td'); td0.textContent = label; if (hint) td0.title = hint;
    const td1 = document.createElement('td'); td1.textContent = a;
    const td2 = document.createElement('td'); td2.textContent = b;
    if (onPick) { td1.className = 'pick'; tr.onclick = onPick; }
    tr.append(td0, td1, td2); tbl.appendChild(tr);
  };
  const canScore = mine && v.rolls > 0;
  E.CATS.forEach(([k, label], idx) => {
    const my = v.sheets[me][k], his = v.sheets[other][k];
    const free = my == null;
    const pot = canScore && free ? E.value(k, v.dice) : null;
    rowFor(label, free ? (pot != null ? `+${pot}` : '') : my, his == null ? '' : his,
      (idx === 6 ? 'sep ' : '') + (pot != null ? (pot ? 'can' : 'zero') : ''),
      pot != null ? () => send({ t: 'score', cat: k }) : null, E.HINT[k]);
    if (idx === 5) {
      const t1 = E.totals(v.sheets[me]), t2 = E.totals(v.sheets[other]);
      rowFor(`Бонус (${E.BONUS_AT}+)`, t1.bonus ? `+${t1.bonus}` : `${t1.up}/${E.BONUS_AT}`, t2.bonus ? `+${t2.bonus}` : `${t2.up}`, 'bonus');
    }
  });
  rowFor('Разом', v.players[me].total, v.players[other].total, 'total');
  const sh = $('dcSheet'); sh.innerHTML = ''; sh.appendChild(tbl);
  $('status').textContent = v.over ? '' : busy ? '…' : !mine ? `Кидає ${nm(v.turn)}…`
    : !v.rolls ? 'Ваш хід — киньте кубики' : v.rolls < 3 ? 'Відкладіть кубики (торкніться) і перекиньте — або запишіть у таблицю' : 'Запишіть результат у таблицю';
  void n;
}

export function result(v) {
  V = v;
  const win = v.winners.includes(v.seat);
  const res = win ? (v.winners.length > 1 ? 'draw' : 'win') : 'lose';
  const table = v.players.map((p, i) => [i, p.total]).sort((a, b) => b[1] - a[1]).map(([i, t]) => `${nm(i)}: ${t}`).join('\n');
  return { res, icon: win ? '🏆' : '🎲', title: win ? (res === 'draw' ? 'Нічия на першому місці' : 'Перемога!') : `Переміг ${nm(v.winners[0])}`, text: table };
}
