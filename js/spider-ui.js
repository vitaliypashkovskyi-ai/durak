// Павук: screen — 10 columns, the stock, collected runs, a timer; tap a card to move it (and the cards under it).
import * as E from './spider-engine.js';
import { $, haptic, toast, sfx, showPanel, hidePanel } from './common.js';

export const rules = `
<p>Пасьянс для одного, дві колоди. Мета — зібрати <b>8 рядів від короля до туза однієї масті</b>: зібраний ряд прибирається сам.</p>
<p>Будь-яку відкриту карту можна покласти на карту, старшу на одиницю (масть не важлива). Але <b>разом переносити</b> можна лише ряд однієї масті за спаданням. На порожнє місце — будь-яку карту чи ряд.</p>
<p><b>Колода</b> (угорі праворуч) кладе по одній карті в кожен стовпчик — коли немає порожніх місць.</p>
<p>Режими: 1 масть — легко, 2 масті — середньо, 4 масті — складно. Торкніться карти — вона піде, куди можна; щоб обрати місце — торкніться карти, потім стовпчика.</p>`;

let api, V = null, sel = null, tick = null;
export function mount(box, a) {
  api = a; V = null; sel = null; clearInterval(tick);
  box.innerHTML = `<div class="klinfo" id="spInfo"></div><div class="sptop" id="spTop"></div><div class="sptab" id="spTab"></div><div class="brow" id="spBtns"></div>`;
  tick = setInterval(info, 1000);
}
export function render(v) {
  V = v;
  if (v.ev) { if (v.ev.kind === 'collect') { sfx('chime'); haptic('success'); toast('Ряд зібрано! ✨'); } else if (v.ev.kind === 'deal' || v.ev.kind === 'move') sfx('card'); }
  if (v.won) saveBest(v);
  draw();
}
const secs = v => Math.floor(((v.over ? v.ended : Date.now()) - v.started) / 1000);
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const best = suits => { try { return Number(localStorage.getItem('games.spider.best.' + suits)) || 0; } catch (e) { return 0; } };
function saveBest(v) { const t = secs(v), b = best(v.suits); if (!b || t < b) { try { localStorage.setItem('games.spider.best.' + v.suits, String(t)); } catch (e) {} } }
function info() { if (!V || !$('spInfo')) return; const b = best(V.suits); $('spInfo').textContent = `⏱ ${fmt(secs(V))} · ходів ${V.moves} · зібрано ${V.done}/8` + (b ? ` · рекорд ${fmt(b)}` : ''); }
function send(m) { if (!V || V.over) return false; const r = api.act(m); if (r === false) { toast('Так не можна'); return false; } return true; }
function cardEl(c, cls) {
  const d = document.createElement('div');
  if (!c.up) { d.className = 'card back' + (cls ? ' ' + cls : ''); return d; }
  d.className = 'card' + (E.red(c) ? ' red' : '') + (cls ? ' ' + cls : '');
  d.innerHTML = `<span class="c">${E.LABELS[c.r]}<i>${E.SUITS[c.s]}</i></span>`;
  return d;
}
function tap(from, k) {
  if (V.over) return;
  if (sel && sel.from !== from) { if (drop(from)) return; }
  const ts = E.targets(V, from, k);
  if (!E.movable(V.tab[from], k)) { sel = null; draw(); return toast('Разом переносяться лише карти однієї масті за порядком'); }
  if (!ts.length) { sel = null; draw(); return haptic('light'); }
  if (ts.length === 1 || (sel && sel.from === from && sel.k === k) || V.tab[ts[0]].length) { sel = null; send({ t: 'move', from, k, to: ts[0] }); return; }
  sel = { from, k }; draw();
}
function drop(to) {
  if (!sel) return false;
  if (!E.targets(V, sel.from, sel.k).includes(to)) return false;
  const s = sel; sel = null; send({ t: 'move', from: s.from, k: s.k, to });
  return true;
}
function draw() {
  if (!V) return;
  const v = V;
  const t = $('spTop'); t.innerHTML = '';
  const done = document.createElement('div'); done.className = 'spdone' + (v.done ? '' : ' empty'); done.textContent = v.done ? '♠'.repeat(v.done) : 'зібрані ряди з\'являться тут';
  const stock = document.createElement('button'); stock.className = 'spstock'; stock.disabled = !v.stock || v.over;
  stock.textContent = v.stock ? `🂠 Роздати (${v.stock / 10})` : 'колода порожня';
  stock.onclick = () => { sel = null; if (v.tab.some(c => !c.length)) return toast('Спершу заповніть порожні стовпчики'); send({ t: 'deal' }); };
  t.append(done, stock);
  const tb = $('spTab'); tb.innerHTML = '';
  v.tab.forEach((col, i) => {
    const c = document.createElement('div'); c.className = 'spcol';
    c.onclick = () => { if (!drop(i)) { sel = null; draw(); } };
    if (!col.length) c.appendChild(Object.assign(document.createElement('div'), { className: 'klempty' }));
    let y = 0;
    col.forEach((card, k) => {
      const e = cardEl(card, sel && sel.from === i && k >= sel.k ? 'sel' : '');
      e.style.top = y + 'px'; y += card.up ? 20 : 7;
      if (card.up) e.onclick = ev => { ev.stopPropagation(); tap(i, k); };
      c.appendChild(e);
    });
    c.style.minHeight = (y + 60) + 'px';
    tb.appendChild(c);
  });
  const bb = $('spBtns'); bb.innerHTML = '';
  if (!v.over) {
    const h = document.createElement('button'); h.className = 'sec'; h.textContent = '💡 Підказка';
    h.onclick = () => { const m = E.hint(v); if (!m) return toast('Ходів немає — почніть нову гру'); if (m.t === 'deal') return toast('Роздайте карти з колоди'); sel = { from: m.from, k: m.k }; draw(); setTimeout(() => { sel = null; draw(); }, 1400); };
    const g = document.createElement('button'); g.className = 'sec'; g.textContent = '🏳 Здатися';
    g.onclick = () => showPanel({ kind: 'choice', icon: '🕷', title: 'Здатися?', text: 'Гру буде зараховано як програну.', buttons: [{ text: 'Так', fn: () => { hidePanel(); send({ t: 'giveup' }); } }, { text: 'Грати далі', sec: true, fn: hidePanel }] });
    bb.append(h, g);
  }
  info();
}
export function result(v) {
  V = v;
  return v.won ? { res: 'win', icon: '🏆', title: 'Павук зібраний!', text: `${E.MODES[v.suits]} · ${fmt(secs(v))} · ${v.moves} ходів` }
    : { res: 'lose', icon: '🕷', title: 'Не вийшло', text: `Зібрано рядів: ${v.done} з 8. Спробуйте ще!` };
}
