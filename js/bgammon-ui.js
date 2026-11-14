// Короткі нарди: screen — your home bottom-right, the bar, dice, moves; tap a checker, then a point.
import * as E from './bgammon-engine.js';
import { $, haptic, toast, sfx, mark } from './common.js';

export const rules = `
<p>2 гравці, по 15 шашок, ідуть <b>назустріч одне одному</b>. Ваші шашки рухаються вгорі праворуч → ліворуч, потім унизу ліворуч → праворуч до свого <b>дому</b> (нижні праві 6 пунктів).</p>
<p><b>Бій:</b> одинока шашка суперника («блот») — бийте її, вона піде на <b>бар</b> і мусить знову ввійти з вашого дому. На пункт, де 2+ шашки суперника, ставати не можна.</p>
<p>Поки у вас є шашки на барі — спершу вводите їх (торкніться бару).</p>
<p>Кубики кидаються самі. <b>Дубль</b> — 4 ходи. Треба зіграти якнайбільше кубиків; якщо лише один — більший.</p>
<p>Усі 15 у домі — викидайте. Перемога — 1 очко, <b>марс</b> (суперник не викинув жодної) — 2, <b>кокс</b> (до того ж його шашка на барі чи у вашому домі) — 3.</p>`;

let api, V = null, busy = false, sel = null;
const DOTS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function mount(box, a) {
  api = a; V = null; busy = false; sel = null;
  box.innerHTML = `
    <div class="ckhead" id="bgTop"></div>
    <div class="ndboard bg" id="bgBoard"></div>
    <div class="nddice" id="bgDice"></div>
    <div class="ckhead" id="bgMe"></div>
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
    if (e.kind === 'roll') { sfx('pop'); if (e.none) toast(e.seat === v.seat ? `${e.dice.join('-')}: ходів немає 😕` : `${nm(e.seat)}: ${e.dice.join('-')}, ходів немає`); else if (e.seat === v.seat && prevTurn !== v.turn) haptic('light'); }
    if (e.kind === 'move') sfx('card');
    if (e.kind === 'hit') { sfx('thud'); if (e.seat !== v.seat) { toast('Вашу шашку побили — на бар!'); haptic('medium'); } else toast('Побили! 💥'); }
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
  if (v.players[v.seat].bar && p !== 25) toast('Спершу введіть шашку з бару');
  sel = null; draw();
}
function stackEl(n, mine, top) {
  const stack = document.createElement('div'); stack.className = 'ndstack';
  const show = Math.min(n, 5);
  for (let k = 0; k < show; k++) {
    const c = document.createElement('div');
    c.className = 'ndc ' + (mine ? 'mine' : 'opp');
    if (k === show - 1 && n > 5) c.textContent = n;
    stack.appendChild(c);
  }
  return stack;
}
function pointEl(p, top) {
  const v = V, me = v.seat, a = E.absOf(me, p), cnt = v.pts[a];
  const d = document.createElement('div');
  const can = myTurn();
  const src = can && v.steps.some(s => s.from === p);
  const dest = can && sel != null && v.steps.some(s => s.from === sel && s.to === p);
  const lm = v.last && v.last.to > 0 && E.absOf(v.last.seat, v.last.to) === a;
  d.className = 'ndp' + (top ? ' top' : '') + (p <= 6 ? ' home' : '') + (p % 2 ? ' alt' : '') + (src ? ' src' : '') + (sel === p ? ' sel' : '') + (dest ? ' dest' : '') + (lm ? ' lm' : '');
  if (cnt[me]) d.appendChild(stackEl(cnt[me], true));
  else if (cnt[1 - me]) d.appendChild(stackEl(cnt[1 - me], false));
  d.onclick = () => tapPoint(p);
  return d;
}
function draw() {
  if (!V) return;
  const v = V, me = v.seat, opp = 1 - me;
  const b = $('bgBoard'); b.innerHTML = '';
  const top = document.createElement('div'); top.className = 'ndrow';
  for (let p = 13; p <= 24; p++) top.appendChild(pointEl(p, true));
  const bottom = document.createElement('div'); bottom.className = 'ndrow';
  for (let p = 12; p >= 1; p--) bottom.appendChild(pointEl(p, false));
  // the bar and the bear-off zone
  const mid = document.createElement('div'); mid.className = 'bgmid';
  const can = myTurn();
  const bar = document.createElement('div');
  const barSrc = can && v.steps.some(s => s.from === 25);
  bar.className = 'bgbar' + (barSrc ? ' src' : '') + (sel === 25 ? ' sel' : '');
  bar.textContent = `бар: ви ${v.players[me].bar} · суперник ${v.players[opp].bar}`;
  bar.onclick = () => tapPoint(25);
  const off = document.createElement('div');
  const canOff = can && sel != null && v.steps.some(s => s.from === sel && s.to === 0);
  off.className = 'ndoff' + (canOff ? ' dest' : '');
  off.textContent = canOff ? '⬇ Викинути' : `викинуто: ${v.players[me].off}/15`;
  off.onclick = () => tapPoint(0);
  mid.append(bar, off);
  b.append(top, mid, bottom);
  const dd = $('bgDice'); dd.innerHTML = '';
  const left = v.left.slice();
  const dice = v.dice[0] === v.dice[1] ? [v.dice[0], v.dice[0], v.dice[0], v.dice[0]] : v.dice;
  dice.forEach(x => { const s = document.createElement('span'); const i = left.indexOf(x); s.className = 'ndd' + (i < 0 ? ' used' : ''); if (i >= 0) left.splice(i, 1); s.textContent = DOTS[x]; dd.appendChild(s); });
  const who = document.createElement('span'); who.className = 'ndwho'; who.textContent = v.turn === me ? 'ваш кидок' : `кидок: ${nm(v.turn)}`; dd.appendChild(who);
  $('bgTop').textContent = `${nm(opp)} ⚫ · викинуто ${v.players[opp].off}/15 · залишилось ${v.players[opp].pips}` + (api.online && !api.online[opp] ? ' 📴' : '');
  $('bgMe').textContent = `Ви ⚪ · викинуто ${v.players[me].off}/15 · залишилось ${v.players[me].pips}`;
  $('bgTop').classList.toggle('on', !v.over && v.turn === opp);
  $('bgMe').classList.toggle('on', !v.over && v.turn === me);
  $('status').textContent = v.over ? '' : busy ? '…' : v.waitUntil ? 'Ходів немає — хід переходить…'
    : v.turn === me ? (v.players[me].bar ? 'Введіть шашку з бару (торкніться бару)' : sel != null ? 'Куди піти? (підсвічено)' : 'Ваш хід — оберіть шашку') : `Ходить ${nm(v.turn)}…`;
}
export function result(v) {
  V = v;
  const win = v.winner === v.seat, how = v.points === 3 ? 'кокс' : v.points === 2 ? 'марс' : '';
  return {
    res: win ? 'win' : 'lose', icon: win ? '🏆' : '🎲',
    title: win ? (how ? `Перемога — ${how}! 🔥` : 'Перемога!') : (how ? `${how[0].toUpperCase() + how.slice(1)}… переміг ${nm(v.winner)}` : `Переміг ${nm(v.winner)}`),
    text: `Викинуто: ви ${v.players[v.seat].off}/15, суперник ${v.players[1 - v.seat].off}/15`,
  };
}
