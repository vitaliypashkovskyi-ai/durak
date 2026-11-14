// Шашки: screen — the board (your pieces at the bottom), tap a piece, then where to go.
import * as E from './checkers-engine.js';
import { $, haptic, toast, sfx, mark } from './common.js';

export const rules = `
<p>Дошка 8×8, у кожного по 12 шашок на темних клітинках. Білі ходять першими.</p>
<p><b>Проста шашка</b> ходить по діагоналі вперед на одну клітинку. Б'є, перестрибуючи шашку суперника, — і вперед, і назад.</p>
<p><b>Бити обов'язково.</b> Якщо після удару можна бити ще — бийте далі тією ж шашкою. Збиті шашки знімаються після ходу, через одну шашку двічі не стрибають.</p>
<p><b>Дамка</b> — шашка, що дійшла до останнього ряду (якщо під час удару — б'є далі вже як дамка). Ходить і б'є на будь-яку відстань по діагоналі.</p>
<p>Програє той, хто не може зробити хід або втратив усі шашки. Нічия — 30 ходів поспіль лише дамками без взяття.</p>
<p>Як ходити: торкніться своєї шашки, потім клітинки, куди йти.</p>`;

let api, V = null, busy = false, sel = null;

export function mount(box, a) {
  api = a; V = null; busy = false; sel = null;
  box.innerHTML = `
    <div class="ckhead" id="ckTop"></div>
    <div class="ckboard" id="ckBoard"></div>
    <div class="ckhead" id="ckMe"></div>
    <div id="status"></div>`;
}

function nm(i) {
  if (i === V.seat) return 'Ви';
  const p = V.players[i];
  return (p.bot ? '🤖 ' : '') + p.name + mark(i);
}

export function render(v) {
  V = v; busy = false;
  if (v.chain != null) sel = v.turn === v.seat ? v.chain : null;
  else if (sel != null && !v.steps.some(s => s.from === sel)) sel = null;
  if (v.ev) {
    if (v.ev.kind === 'capture') { sfx('thud'); if (v.ev.seat !== v.seat) haptic('medium'); }
    else if (v.ev.kind === 'move') sfx('card');
    if (v.ev.kind === 'left') toast(`${v.players[v.ev.who].name} вийшов — замість нього бот`);
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

function myTurn() { return V && !V.over && !busy && V.turn === V.seat; }

function tap(sq) {
  if (!myTurn()) return;
  const v = V;
  if (sel != null) {
    const st = v.steps.find(s => s.from === sel && s.to === sq);
    if (st) { send({ t: 'move', from: st.from, to: st.to }); if (v.chain == null) sel = null; return; }
  }
  if (v.chain != null) return;
  if (v.steps.some(s => s.from === sq)) { sel = sq; draw(); return; }
  if (E.owner(v.B[sq]) === v.seat) toast(v.steps.some(s => s.cap != null) ? 'Треба бити!' : 'Ця шашка не може ходити');
}

function draw() {
  if (!V) return;
  const v = V, me = v.seat, flip = me === 1;
  const el = $('ckBoard'); el.innerHTML = '';
  const can = myTurn();
  const movable = new Set(can ? v.steps.map(s => s.from) : []);
  const dests = new Set(can && sel != null ? v.steps.filter(s => s.from === sel).map(s => s.to) : []);
  for (let i = 0; i < 64; i++) {
    const sq = flip ? 63 - i : i;
    const r = sq >> 3, c = sq & 7, dark = (r + c) % 2 === 1;
    const d = document.createElement('div');
    d.className = 'ck' + (dark ? ' dk' : '') +
      (v.last && (v.last.from === sq || v.last.to === sq) ? ' lm' : '') +
      (dests.has(sq) ? ' dest' : '') + (sel === sq ? ' sel' : '');
    const val = v.B[sq];
    if (val) {
      const p = document.createElement('div');
      p.className = 'pc ' + (E.owner(val) === 0 ? 'w' : 'b') + (E.isKing(val) ? ' k' : '') +
        (movable.has(sq) && sel !== sq ? ' mv' : '') + (v.taken.includes(sq) ? ' gone' : '');
      d.appendChild(p);
    }
    if (dark) d.onclick = () => tap(sq);
    el.appendChild(d);
  }
  const opp = 1 - me;
  const color = i => (i === 0 ? '⚪ білі' : '⚫ чорні');
  $('ckTop').textContent = `${nm(opp)} · ${color(opp)} · шашок: ${v.players[opp].pieces}` + (api.online && !api.online[opp] ? ' 📴' : '');
  $('ckMe').textContent = `Ви · ${color(me)} · шашок: ${v.players[me].pieces}`;
  $('ckTop').classList.toggle('on', !v.over && v.turn === opp);
  $('ckMe').classList.toggle('on', !v.over && v.turn === me);
  $('status').textContent = v.over ? '' : busy ? '…' : v.turn === me
    ? (v.chain != null ? 'Бийте далі!' : v.steps.some(s => s.cap != null) ? 'Ваш хід — треба бити' : sel != null ? 'Куди піти?' : 'Ваш хід — оберіть шашку')
    : `Ходить ${nm(v.turn)}…`;
}

export function result(v) {
  V = v;
  if (v.winner === -1) return { res: 'draw', icon: '🤝', title: 'Нічия', text: 'Ніхто не зміг перемогти' };
  const win = v.winner === v.seat;
  return {
    res: win ? 'win' : 'lose', icon: win ? '🏆' : '⚫',
    title: win ? 'Перемога!' : `Переміг ${nm(v.winner)}`,
    text: `Шашок лишилось: ви ${v.players[v.seat].pieces}, суперник ${v.players[1 - v.seat].pieces}`,
  };
}
