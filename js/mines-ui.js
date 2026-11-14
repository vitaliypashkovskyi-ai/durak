// Сапер: screen — the field, a «flag» switch, mines left and a timer; long press also puts a flag.
import * as E from './mines-engine.js';
import { $, haptic, toast, sfx } from './common.js';

export const rules = `
<p>Відкрийте всі клітинки, де <b>немає мін</b>. Число в клітинці — скільки мін серед 8 сусідніх.</p>
<p>Перший хід завжди безпечний. Де, на вашу думку, міна — поставте <b>прапорець 🚩</b>: увімкніть режим «🚩» унизу або натисніть і потримайте клітинку.</p>
<p>Торкніться відкритого числа, навколо якого вже стоять усі прапорці, — відкриються решта сусідніх клітинок.</p>
<p>Розміри: легкий 9×9 (10 мін), середній 12×16 (30 мін), складний 14×22 (60 мін). Найкращий час запам'ятовується.</p>`;

let api, V = null, flagMode = false, tick = null, pressT = null, pressed = null, longDone = false;
const COLORS = ['', '#1e63c4', '#2e7d32', '#c62828', '#4527a0', '#8d2b0b', '#00838f', '#212121', '#757575'];

export function mount(box, a) {
  api = a; V = null; flagMode = false; clearInterval(tick);
  box.innerHTML = `
    <div class="msinfo" id="msInfo"></div>
    <div class="msgrid" id="msGrid"></div>
    <div class="brow" id="msBtns"></div>`;
  tick = setInterval(drawInfo, 1000);
}
export function render(v) {
  const prev = V;
  V = v;
  if (v.ev) {
    if (v.ev.kind === 'boom') { sfx('boom'); haptic('error'); }
    else if (v.ev.kind === 'win') { sfx('win'); saveBest(v); }
    else if (v.ev.kind === 'flag') sfx('pop');
    else if (v.ev.kind === 'open') sfx('card');
  }
  void prev;
  draw();
}
const best = size => { try { return Number(localStorage.getItem('games.mines.best.' + size)) || 0; } catch (e) { return 0; } };
function saveBest(v) {
  const t = Math.round((v.ended - v.started) / 1000), b = best(v.size);
  if (!b || t < b) { try { localStorage.setItem('games.mines.best.' + v.size, String(t)); } catch (e) {} if (b) toast(`Новий рекорд: ${t} с! 🏆`); }
}
const secs = v => (v.started ? Math.floor(((v.over ? v.ended : Date.now()) - v.started) / 1000) : 0);
function drawInfo() {
  if (!V || !$('msInfo')) return;
  const b = best(V.size);
  $('msInfo').textContent = `💣 ${V.mines - V.flags} · ⏱ ${secs(V)} с` + (b ? ` · рекорд ${b} с` : '');
}
function send(m) { if (!V || V.over) return; if (api.act(m) === false) haptic('light'); }
function tapCell(i, long) {
  const c = V.cells[i];
  if (V.over) return;
  if (long || (flagMode && c < 0)) { if (c === -1 || c === -2) { send({ t: 'flag', i }); haptic('light'); } return; }
  if (c === -2) return toast('Тут прапорець — зніміть його, щоб відкрити');
  send({ t: 'open', i });
}
function draw() {
  if (!V) return;
  const v = V, g = $('msGrid');
  g.style.gridTemplateColumns = `repeat(${v.w}, 1fr)`;
  g.style.setProperty('--cols', v.w);
  g.style.setProperty('--rows', v.h);
  g.innerHTML = '';
  v.cells.forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'msc' + (c >= 0 ? ' open' : '') + (c === -3 ? ' mine' : '') + (i === v.boom ? ' boom' : '') + (v.wrongFlags && v.wrongFlags[i] ? ' wrong' : '');
    if (c > 0) { d.textContent = c; d.style.color = COLORS[c]; }
    else if (c === -2) d.textContent = '🚩';
    else if (c === -3) d.textContent = '💣';
    // tap = open (or flag in flag mode); press and hold = flag
    d.onpointerdown = () => { longDone = false; pressed = i; clearTimeout(pressT); pressT = setTimeout(() => { longDone = true; tapCell(i, true); }, 420); };
    d.onpointerup = () => { clearTimeout(pressT); if (!longDone && pressed === i) tapCell(i, false); pressed = null; };
    d.onpointerleave = () => { clearTimeout(pressT); pressed = null; };
    d.oncontextmenu = e => { e.preventDefault(); };
    g.appendChild(d);
  });
  const bb = $('msBtns'); bb.innerHTML = '';
  if (!v.over) {
    const f = document.createElement('button');
    f.className = flagMode ? '' : 'sec';
    f.textContent = flagMode ? '🚩 Ставлю прапорці' : '👆 Відкриваю клітинки';
    f.onclick = () => { flagMode = !flagMode; draw(); };
    bb.appendChild(f);
  }
  drawInfo();
}
export function result(v) {
  V = v;
  const t = secs(v), b = best(v.size);
  return v.won
    ? { res: 'win', icon: '🏆', title: 'Поле розміновано!', text: `${E.SIZES[v.size].label} · ${t} с` + (b ? ` · рекорд ${b} с` : '') }
    : { res: 'lose', icon: '💥', title: 'Бум! Міна', text: `${E.SIZES[v.size].label} · ${t} с. Спробуйте ще!` };
}
