// Морський бій: screen.
import * as E from './battle-engine.js';
import { $, haptic, toast, sfx, mark } from './common.js';

export const rules = `
<p>Поле 10×10. Флот: один корабель на 4 клітинки, два на 3, три на 2 і чотири на 1. Кораблі не торкаються навіть кутами.</p>
<p>Спершу розставте флот: «Перемішати» дає нову розстановку, «Готово» — підтверджує.</p>
<p>Стріляють по черзі. Влучили — стріляєте ще раз. Коли гравців більше двох, оберіть угорі, по чийому полю стріляти.</p>
<p>Чий флот потоплено — вибуває. Перемагає останній на плаву.</p>`;

let api, V = null, target = null, busy = false, lastNum = null, manual = null;   // manual = { ships: [[cells]], hor }

export function mount(box, a) {
  api = a; V = null; target = null; busy = false; lastNum = null; manual = null;
  box.innerHTML = `
    <div class="btabs" id="bTabs"></div>
    <div class="bmain">
      <div class="blabel" id="bBigLabel"></div>
      <div class="grid big" id="bBig"></div>
      <div id="status"></div>
      <div class="brow" id="bBtns"></div>
      <div class="blabel" id="bMineLabel"></div>
      <div class="grid small" id="bMine"></div>
    </div>`;
}

function nm(i) {
  if (i === V.seat) return 'Ви';
  const p = V.players[i];
  return (p.bot ? '🤖 ' : '') + p.name + mark(i);
}

export function render(v) {
  const fresh = v.num !== lastNum;
  V = v; busy = false;
  if (fresh) { lastNum = v.num; target = null; }
  if (v.ev) evToast(v.ev);
  draw();
}

function evToast(e) {
  const me = V.seat;
  if (e.kind === 'start') toast(V.turn === me ? 'До бою! Ви стріляєте першим' : `До бою! Першим стріляє ${nm(V.turn)}`);
  if (e.kind === 'left') toast(`${V.players[e.who].name} вийшов — замість нього бот`);
  if (e.kind !== 'shot') return;
  sfx(e.res === 'miss' ? 'splash' : 'boom');
  if (e.dead != null) toast(e.dead === me ? 'Ваш флот потоплено 💀' : `${nm(e.dead)} без флоту 💀`);
  else if (e.by === me) toast(e.res === 'miss' ? 'Мимо' : e.res === 'hit' ? 'Влучили! Стріляйте ще' : 'Потопили! Стріляйте ще');
  else if (e.target === me && e.res !== 'miss') { toast(`${nm(e.by)} ${e.res === 'sunk' ? 'потопив ваш корабель' : 'влучив у вас'}`); haptic('medium'); }
  if (e.by === me && e.res !== 'miss') haptic('success');
}

function send(m) {
  if (busy || !V || V.over) return;
  const r = api.act(m);
  if (r === null) { busy = true; draw(); }
  else if (r === false) toast('Так не можна');
}
function button(text, fn, sec) {
  const b = document.createElement('button');
  b.textContent = text; if (sec) b.className = 'sec';
  b.onclick = fn; $('bBtns').appendChild(b);
}

function board(el, b, aimAt) {
  el.innerHTML = '';
  el.classList.toggle('aim', aimAt != null);
  for (let c = 0; c < 100; c++) {
    const d = document.createElement('div');
    const s = b.shots[c];
    d.className = 'cell' + (s === 1 ? ' miss' : s === 2 ? ' hit' : s === 3 ? ' sunk' : '') +
      (!s && b.ships && b.ships[c] ? ' ship' : '') + (!s && aimAt != null ? ' free' : '');
    if (aimAt != null && !s) d.onclick = () => send({ t: 'shoot', target: aimAt, cell: c });
    el.appendChild(d);
  }
}

function draw() {
  if (!V) return;
  const v = V, me = v.seat, n = v.players.length;
  const tabs = $('bTabs'); tabs.innerHTML = '';
  $('bBtns').innerHTML = '';
  if (v.phase === 'place') {
    $('bMine').hidden = true; $('bMineLabel').hidden = true;
    const ready = v.players[me].ready;
    if (manual && !ready) return drawManual();
    $('bBigLabel').textContent = 'Ваш флот';
    board($('bBig'), v.boards[me], null);
    if (!ready) {
      button('🔀 Перемішати', () => send({ t: 'shuffle' }), true);
      button('✍️ Розставити самому', () => { manual = { ships: [], hor: true }; draw(); }, true);
      button('✅ Готово', () => send({ t: 'ready' }));
    }
    const left = v.players.filter(p => !p.ready).length;
    $('status').textContent = ready ? `Чекаємо інших гравців (${left})…` : 'Розставте флот і натисніть «Готово»';
    return;
  }
  $('bMine').hidden = false; $('bMineLabel').hidden = false;
  const opps = [];
  for (let k = 1; k < n; k++) opps.push((me + k) % n);
  if (target == null || (!v.players[target].alive && !v.over)) {
    const alive = opps.filter(i => v.players[i].alive);
    target = alive.length ? alive[0] : opps[0];
  }
  opps.forEach(i => {
    const p = v.players[i];
    const b = document.createElement('button');
    b.className = 'btab' + (i === target ? ' on' : '') + (!v.over && v.turn === i ? ' turn' : '') + (!p.alive ? ' dead' : '');
    b.textContent = `${nm(i)} ${p.alive ? '🚢' + p.left : '💀'}` + (api.online && !api.online[i] ? ' 📴' : '');
    b.onclick = () => { target = i; draw(); };
    tabs.appendChild(b);
  });
  const myTurn = !v.over && !busy && v.turn === me && v.players[me].alive;
  $('bBigLabel').textContent = `Поле суперника: ${nm(target)}`;
  board($('bBig'), v.boards[target], myTurn && v.players[target].alive ? target : null);
  board($('bMine'), v.boards[me], null);
  $('bMineLabel').textContent = `Ваше поле ${v.players[me].alive ? '🚢' + v.players[me].left : '💀'}`;
  $('status').textContent = v.over ? '' : busy ? '…' :
    !v.players[me].alive ? 'Ваш флот потоплено. Можна дивитися бій далі…' :
    v.turn === me ? 'Ваш постріл — торкніться клітинки' : `Стріляє ${nm(v.turn)}…`;
}

// ---------- placing the fleet by hand ----------
const sizesLeft = () => { const left = [...E.FLEET]; manual.ships.forEach(s => left.splice(left.indexOf(s.length), 1)); return left; };
function shipAt(c) { return manual.ships.findIndex(s => s.includes(c)); }
function cellsFor(c, len, hor) {
  const x = c % E.SIZE, y = (c / E.SIZE) | 0;
  if (hor ? x + len > E.SIZE : y + len > E.SIZE) return null;
  return Array.from({ length: len }, (_, k) => hor ? c + k : c + k * E.SIZE);
}
function fits(cells) {
  const taken = new Set(manual.ships.flat());
  return cells.every(c => !taken.has(c) && E.around(c).every(a => !taken.has(a)));
}
function drawManual() {
  const left = sizesLeft(), next = left.length ? Math.max(...left) : 0;
  $('bBigLabel').textContent = next ? `Поставте ${next}-палубний (${manual.hor ? 'горизонтально ↔' : 'вертикально ↕'})` : 'Флот розставлено!';
  const el = $('bBig'); el.innerHTML = ''; el.classList.add('aim');
  const taken = new Set(manual.ships.flat());
  for (let c = 0; c < 100; c++) {
    const d = document.createElement('div');
    const cells = next ? cellsFor(c, next, manual.hor) : null;
    d.className = 'cell' + (taken.has(c) ? ' ship' : '') + (!taken.has(c) && cells && fits(cells) ? ' free' : '');
    d.onclick = () => {
      const k = shipAt(c);
      if (k >= 0) { manual.ships.splice(k, 1); drawManual(); return; }          // tap a ship: take it back
      if (!next) return;
      const cs = cellsFor(c, next, manual.hor);
      if (!cs || !fits(cs)) return toast('Сюди не стане — кораблі не торкаються навіть кутами');
      manual.ships.push(cs); haptic('light'); drawManual();
    };
    el.appendChild(d);
  }
  $('bBtns').innerHTML = '';
  button(manual.hor ? '↕ Повернути' : '↔ Повернути', () => { manual.hor = !manual.hor; drawManual(); }, true);
  button('🔀 Випадково', () => { manual = null; send({ t: 'shuffle' }); }, true);
  if (!next) button('✅ Готово', () => { if (api.act({ t: 'fleet', ships: manual.ships }) === false) return toast('Щось не так з розстановкою'); manual = null; send({ t: 'ready' }); });
  $('status').textContent = next ? `Лишилось: ${left.sort((a, b) => b - a).join(', ')} · торкніться клітинки (корабель іде від неї ${manual.hor ? 'праворуч' : 'вниз'}); торкніться корабля — прибрати` : 'Натисніть «Готово»';
}

export function result(v) {
  V = v;
  if (v.winner === v.seat) return { res: 'win', icon: '🏆', title: 'Перемога!', text: 'Ваш флот — останній на плаву' };
  return { res: 'lose', icon: '⚓', title: 'Поразка', text: `Переміг ${nm(v.winner)}` };
}
