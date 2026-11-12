// Морський бій: screen.
import { $, haptic, toast } from './common.js';

export const rules = `
<p>Поле 10×10. Флот: один корабель на 4 клітинки, два на 3, три на 2 і чотири на 1. Кораблі не торкаються навіть кутами.</p>
<p>Спершу розставте флот: «Перемішати» дає нову розстановку, «Готово» — підтверджує.</p>
<p>Стріляють по черзі. Влучили — стріляєте ще раз. Коли гравців більше двох, оберіть угорі, по чийому полю стріляти.</p>
<p>Чий флот потоплено — вибуває. Перемагає останній на плаву.</p>`;

let api, V = null, target = null, busy = false, lastNum = null;

export function mount(box, a) {
  api = a; V = null; target = null; busy = false; lastNum = null;
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
  return (p.bot ? '🤖 ' : '') + p.name;
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
    $('bBigLabel').textContent = 'Ваш флот';
    board($('bBig'), v.boards[me], null);
    $('bMine').hidden = true; $('bMineLabel').hidden = true;
    const ready = v.players[me].ready;
    if (!ready) { button('🔀 Перемішати', () => send({ t: 'shuffle' }), true); button('✅ Готово', () => send({ t: 'ready' })); }
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

export function result(v) {
  V = v;
  if (v.winner === v.seat) return { res: 'win', icon: '🏆', title: 'Перемога!', text: 'Ваш флот — останній на плаву' };
  return { res: 'lose', icon: '⚓', title: 'Поразка', text: `Переміг ${nm(v.winner)}` };
}
