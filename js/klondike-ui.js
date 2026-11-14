// Косинка: screen — stock, waste, four foundations, seven columns. Tap a card: it goes where it can
// (home first); a second tap on another column moves it there. Hint, auto-finish, new deal.
import * as E from './klondike-engine.js';
import { $, haptic, toast, sfx, showPanel, hidePanel } from './common.js';

export const rules = `
<p>Пасьянс для одного гравця. Мета — розкласти всі 52 карти в чотири <b>доми</b> (угорі праворуч): по мастях, від туза до короля.</p>
<p>У <b>стовпчиках</b> карти кладуться на одну старшу іншого кольору (червона 7 на чорну 8). Можна переносити й цілий ряд відкритих карт. На порожнє місце — лише король.</p>
<p><b>Колода</b> (угорі ліворуч): торкніться, щоб відкрити 1 карту (або 3 — у складному режимі). Коли колода скінчиться, торкніться ще раз — скид повернеться в колоду.</p>
<p>Як ходити: торкніться карти — вона сама піде, куди можна (спершу в дім). Щоб покласти в інше місце — торкніться карти, потім потрібного стовпчика. «💡» підкаже хід.</p>`;

let api, V = null, sel = null, busy = false, autoT = null;

export function mount(box, a) {
  api = a; V = null; sel = null; busy = false; clearTimeout(autoT);
  box.innerHTML = `
    <div class="klinfo" id="klInfo"></div>
    <div class="kltop" id="klTop"></div>
    <div class="kltab" id="klTab"></div>
    <div class="brow" id="klBtns"></div>`;
}

export function render(v) {
  V = v; busy = false;
  if (v.ev) { if (v.ev.kind === 'found') sfx('chime'); else if (v.ev.kind === 'draw' || v.ev.kind === 'move') sfx('card'); }
  draw();
  // all cards open and the stock empty: put everything home by itself
  clearTimeout(autoT);
  if (!v.over && E.canAutoFinish(v)) autoT = setTimeout(() => { const m = E.hint(v); if (m && m.t === 'move' && m.dst.to === 'f') send(m); }, 180);
}

function send(m) {
  if (busy || !V || V.over) return false;
  const r = api.act(m);
  if (r === null) { busy = true; return true; }
  if (r === false) { toast('Так не можна'); return false; }
  return true;
}

function cardEl(c, cls) {
  const d = document.createElement('div');
  if (!c || !c.up) { d.className = 'card back' + (cls ? ' ' + cls : ''); return d; }
  d.className = 'card' + (E.red(c) ? ' red' : '') + (cls ? ' ' + cls : '');
  d.innerHTML = `<span class="c">${E.LABELS[c.r]}<i>${E.SUITS[c.s]}</i></span><span class="m">${E.SUITS[c.s]}</span>`;
  return d;
}
const same = (a, b) => a && b && a.from === b.from && a.i === b.i && a.k === b.k;

// tap a card: move it where it fits (home first), or select it when there is a choice
function tapCard(src) {
  if (V.over) return;
  if (sel && !same(sel, src)) { if (dropOn(src)) return; }
  const ts = E.targets(V, src);
  if (!ts.length) { sel = null; draw(); haptic('light'); return; }
  const home = ts.find(x => x.to === 'f');
  const tabs = ts.filter(x => x.to === 't');
  // prefer home for a single card, else a column with cards, else an empty column
  const pick = home || tabs.find(x => V.tab[x.i].length) || tabs[0];
  if (same(sel, src) || ts.length === 1 || home) { sel = null; send({ t: 'move', src, dst: pick }); return; }
  sel = src; draw();
}
// a second tap on a column (or its card) drops the selected cards there
function dropOn(place) {
  if (!sel) return false;
  const i = place.from === 't' ? place.i : place.col;
  if (i == null) return false;
  const ok = E.targets(V, sel).find(x => x.to === 't' && x.i === i);
  if (!ok) return false;
  const src = sel; sel = null;
  send({ t: 'move', src, dst: ok });
  return true;
}

function draw() {
  if (!V) return;
  const v = V;
  const secs = Math.floor((Date.now() - v.started) / 1000);
  $('klInfo').textContent = `Ходів: ${v.moves} · ${v.draw3 ? 'по 3 карти' : 'по 1 карті'} · у домах ${v.foundN.reduce((a, b) => a + b, 0)}/52`;
  // top row: stock, waste, (gap), 4 foundations
  const t = $('klTop'); t.innerHTML = '';
  const stock = document.createElement('div'); stock.className = 'klslot';
  stock.appendChild(v.stock ? cardEl(null) : Object.assign(document.createElement('div'), { className: 'klempty', textContent: v.wasteAll ? '↻' : '' }));
  stock.onclick = () => { sel = null; send({ t: 'draw' }); };
  const waste = document.createElement('div'); waste.className = 'klslot waste';
  v.waste.forEach((c, k) => {
    const last = k === v.waste.length - 1;
    const e = cardEl(c, (last && sel && sel.from === 'w' ? 'sel' : '') + (v.draw3 ? ' fan' + k : ''));
    if (last) e.onclick = ev => { ev.stopPropagation(); tapCard({ from: 'w' }); };
    waste.appendChild(e);
  });
  const gap = document.createElement('div'); gap.className = 'klslot gap';
  t.append(stock, waste, gap);
  v.found.forEach((p, f) => {
    const s = document.createElement('div'); s.className = 'klslot';
    if (p.length) { const e = cardEl(p[0]); e.onclick = () => tapCard({ from: 'f', i: f }); s.appendChild(e); }
    else s.appendChild(Object.assign(document.createElement('div'), { className: 'klempty', textContent: E.SUITS[f] }));
    t.appendChild(s);
  });
  // columns
  const tb = $('klTab'); tb.innerHTML = '';
  v.tab.forEach((col, i) => {
    const c = document.createElement('div'); c.className = 'klcol';
    c.onclick = () => { if (!dropOn({ col: i })) { sel = null; draw(); } };
    if (!col.length) c.appendChild(Object.assign(document.createElement('div'), { className: 'klempty', textContent: 'К' }));
    col.forEach((card, k) => {
      const isSel = sel && sel.from === 't' && sel.i === i && k >= sel.k;
      const e = cardEl(card, isSel ? 'sel' : '');
      e.style.top = col.slice(0, k).reduce((y, x) => y + (x.up ? 22 : 9), 0) + 'px';
      if (card.up) e.onclick = ev => { ev.stopPropagation(); tapCard({ from: 't', i, k }); };
      c.appendChild(e);
    });
    tb.appendChild(c);
  });
  const bb = $('klBtns'); bb.innerHTML = '';
  if (!v.over) {
    const h = document.createElement('button'); h.className = 'sec'; h.textContent = '💡 Підказка';
    h.onclick = () => {
      const m = E.hint(v);
      if (!m) return toast('Ходів немає — почніть нову роздачу');
      if (m.t === 'draw') return toast('Відкрийте карту з колоди');
      sel = m.src; draw(); toast('Ця карта може піти далі'); setTimeout(() => { if (same(sel, m.src)) { sel = null; draw(); } }, 1500);
    };
    const g = document.createElement('button'); g.className = 'sec'; g.textContent = '🏳 Здатися';
    g.onclick = () => showPanel({ kind: 'choice', icon: '🂠', title: 'Здатися?', text: 'Цю роздачу буде зараховано як програну.', buttons: [
      { text: 'Так', fn: () => { hidePanel(); send({ t: 'giveup' }); } }, { text: 'Грати далі', sec: true, fn: hidePanel }] });
    bb.append(h, g);
  }
  void secs;
}

export function result(v) {
  V = v;
  const mins = Number.isFinite(v.started) ? Math.max(1, Math.round((Date.now() - v.started) / 60000)) : null;
  return v.won
    ? { res: 'win', icon: '🏆', title: 'Пасьянс зійшовся!', text: `${v.moves} ходів` + (mins ? ` · близько ${mins} хв` : '') }
    : { res: 'lose', icon: '🂠', title: 'Не зійшовся', text: `У домах ${v.foundN.reduce((a, b) => a + b, 0)} з 52 карт. Спробуйте ще!` };
}
