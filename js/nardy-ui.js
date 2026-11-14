// Довгі нарди: screen — the board from your side (your head bottom-right, your home top-right), dice, moves.
import * as E from './nardy-engine.js';
import { $, haptic, toast, sfx, mark } from './common.js';

export const rules = `
<p>2 гравці, по 15 шашок. Усі стартують на <b>голові</b> й ідуть по колу проти годинникової стрілки: у вас — знизу справа наліво, потім угорі зліва направо до свого <b>дому</b> (верхні праві 6 пунктів). Суперник іде так само, але з протилежного боку.</p>
<p><b>Бити не можна:</b> ставати на пункт, де стоїть шашка суперника, заборонено.</p>
<p>Кубики кидаються самі. Кожен кубик — окремий хід на стільки пунктів. <b>Дубль</b> — чотири ходи. Треба зіграти якнайбільше кубиків; якщо можна зіграти лише один — більший.</p>
<p>З голови за хід можна взяти лише <b>одну</b> шашку (першим кидком 6-6, 4-4 чи 3-3 — дві).</p>
<p>Не можна ставити «паркан» із 6 пунктів поспіль, якщо попереду нього немає жодної шашки суперника.</p>
<p>Коли всі 15 шашок у домі — викидайте їх. Хто перший викинув усі — переміг. Якщо суперник не викинув жодної — це <b>марс</b>, подвійна перемога.</p>
<p>Як ходити: торкніться своєї шашки, потім пункту, куди йти (підсвічено).</p>`;

let api, V = null, busy = false, sel = null;
const DOTS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function mount(box, a) {
  api = a; V = null; busy = false; sel = null;
  box.innerHTML = `
    <div class="ckhead" id="ndTop"></div>
    <div class="ndboard" id="ndBoard"></div>
    <div class="nddice" id="ndDice"></div>
    <div class="ckhead" id="ndMe"></div>
    <div id="status"></div>`;
}

function nm(i) {
  if (i === V.seat) return 'Ви';
  const p = V.players[i];
  return (p.bot ? '🤖 ' : '') + p.name + mark(i);
}

export function render(v) {
  const prevTurn = V && V.turn;
  V = v; busy = false;
  if (sel != null && !v.steps.some(s => s.from === sel)) sel = null;
  const e = v.ev;
  if (e) {
    if (e.kind === 'roll') {
      sfx('pop');
      if (e.none) toast(e.seat === v.seat ? `${e.dice.join('-')}: ходів немає 😕` : `${nm(e.seat)}: ${e.dice.join('-')}, ходів немає`);
      else if (e.seat === v.seat && prevTurn !== v.turn) haptic('light');
    }
    if (e.kind === 'move') sfx('card');
    if (e.kind === 'off') sfx('chime');
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
const myTurn = () => V && !V.over && !busy && !V.waitUntil && V.turn === V.seat;

function tapPoint(p) {
  if (!myTurn()) return;
  const v = V;
  if (sel != null) {
    const st = v.steps.find(s => s.from === sel && s.to === p);
    if (st) { send({ t: 'move', from: st.from, die: st.die }); sel = null; return; }
  }
  if (v.steps.some(s => s.from === p)) { sel = p; draw(); return; }
  sel = null; draw();
}

function pointEl(p, top) {
  const v = V, me = v.seat;
  const a = E.absOf(me, p), pt = v.pts[a];
  const d = document.createElement('div');
  const can = myTurn();
  const src = can && v.steps.some(s => s.from === p);
  const dest = can && sel != null && v.steps.some(s => s.from === sel && s.to === p);
  const lm = v.last && E.absOf(v.last.seat, v.last.to) === a && v.last.to < 24;
  d.className = 'ndp' + (top ? ' top' : '') + (p >= 18 ? ' home' : '') + (p % 2 ? ' alt' : '') +
    (src ? ' src' : '') + (sel === p ? ' sel' : '') + (dest ? ' dest' : '') + (lm ? ' lm' : '');
  if (pt.n) {
    const stack = document.createElement('div'); stack.className = 'ndstack';
    const show = Math.min(pt.n, 5);
    for (let k = 0; k < show; k++) {
      const c = document.createElement('div');
      c.className = 'ndc ' + (pt.o === me ? 'mine' : 'opp');
      if (k === show - 1 && pt.n > 5) c.textContent = pt.n;
      stack.appendChild(c);
    }
    d.appendChild(stack);
  }
  if (p === 0) d.title = 'ваша голова';
  d.onclick = () => tapPoint(p);
  return d;
}

function draw() {
  if (!V) return;
  const v = V, me = v.seat, opp = 1 - me;
  const b = $('ndBoard'); b.innerHTML = '';
  const top = document.createElement('div'); top.className = 'ndrow';
  for (let p = 12; p < 24; p++) top.appendChild(pointEl(p, true));
  const bottom = document.createElement('div'); bottom.className = 'ndrow';
  for (let p = 11; p >= 0; p--) bottom.appendChild(pointEl(p, false));
  // bear-off target
  const off = document.createElement('div');
  const canOff = myTurn() && sel != null && v.steps.some(s => s.from === sel && s.to === 24);
  off.className = 'ndoff' + (canOff ? ' dest' : '');
  off.textContent = canOff ? '⬆ Викинути' : `викинуто: ${v.players[me].off}/15`;
  off.onclick = () => tapPoint(24);
  b.append(top, bottom, off);
  // dice
  const dd = $('ndDice'); dd.innerHTML = '';
  const left = v.left.slice();
  const dice = v.dice[0] === v.dice[1] ? [v.dice[0], v.dice[0], v.dice[0], v.dice[0]] : v.dice;
  dice.forEach(x => {
    const s = document.createElement('span');
    const i = left.indexOf(x);
    s.className = 'ndd' + (i < 0 ? ' used' : '') + (v.turn === me ? ' my' : '');
    if (i >= 0) left.splice(i, 1);
    s.textContent = DOTS[x];
    dd.appendChild(s);
  });
  const who = document.createElement('span'); who.className = 'ndwho';
  who.textContent = v.turn === me ? 'ваш кидок' : `кидок: ${nm(v.turn)}`;
  dd.appendChild(who);
  $('ndTop').textContent = `${nm(opp)} ⚫ · викинуто ${v.players[opp].off}/15 · залишилось ${v.players[opp].pips}` + (api.online && !api.online[opp] ? ' 📴' : '');
  $('ndMe').textContent = `Ви ⚪ · викинуто ${v.players[me].off}/15 · залишилось ${v.players[me].pips}`;
  $('ndTop').classList.toggle('on', !v.over && v.turn === opp);
  $('ndMe').classList.toggle('on', !v.over && v.turn === me);
  $('status').textContent = v.over ? '' : busy ? '…' : v.waitUntil ? 'Ходів немає — хід переходить…'
    : v.turn === me ? (sel != null ? 'Куди піти? (підсвічено)' : 'Ваш хід — оберіть шашку') : `Ходить ${nm(v.turn)}…`;
}

export function result(v) {
  V = v;
  const win = v.winner === v.seat;
  return {
    res: win ? 'win' : 'lose', icon: win ? '🏆' : '🎲',
    title: win ? (v.mars ? 'Перемога з марсом! 🔥' : 'Перемога!') : (v.mars ? `Марс… переміг ${nm(v.winner)}` : `Переміг ${nm(v.winner)}`),
    text: `Викинуто: ви ${v.players[v.seat].off}/15, суперник ${v.players[1 - v.seat].off}/15`,
  };
}
