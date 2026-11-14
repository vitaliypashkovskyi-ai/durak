// Преферанс: screen — bidding, the talon, discarding two cards, the contract, tricks and deal results.
import * as E from './pref-engine.js';
import { $, haptic, toast, sfx, mark } from './common.js';

export const rules = `
<p>3 гравці, 32 карти (від сімки до туза), кожному по 10, дві — у <b>прикуп</b>.</p>
<p><b>Торг:</b> по черзі називають гру: 6♠ &lt; 6♣ &lt; 6♦ &lt; 6♥ &lt; 6 БК &lt; 7♠ … &lt; 8 БК &lt; <b>мізер</b> &lt; 9♠ … &lt; 10 БК. Хто сказав «пас» — вибуває з торгу. Число — скільки взяток з 10 зобов'язуєтесь узяти; масть — козир, БК — без козиря.</p>
<p><b>Розігрувач</b> бере прикуп (його бачать усі), скидає 2 карти й оголошує гру — не нижчу за свою ставку.</p>
<p><b>Хід:</b> масть треба підтримати; немає — бити козирем; немає й козиря — будь-яка карта.</p>
<p><b>Очки</b> (спрощений підрахунок замість пулі й гори): ціна гри 6 — 2, 7 — 4, 8 — 6, 9 — 8, 10 — 10. Зіграв — +5×ціна; недобрав k взяток — −5×ціна×k. Кожен захисник — +ціна за свою взятку.</p>
<p><b>Мізер</b> — не взяти жодної взятки (без козиря): так — +50, кожна взятка — −50. <b>Розпаси</b> (усі спасували): кожна взятка −5, хто не взяв жодної — +10.</p>
<p>Гра — 12 або 24 роздачі. Перемагає найбільше очок.</p>`;

let api, V = null, busy = false, lastNum = null, pick = [];

export function mount(box, a) {
  api = a; V = null; busy = false; lastNum = null; pick = [];
  box.innerHTML = `
    <div class="opps" id="prOpps"></div>
    <div class="tscore" id="prInfo"></div>
    <div class="tmain" id="prCenter"></div>
    <div id="status"></div>
    <div class="brow" id="prBtns"></div>
    <div id="hand"></div>`;
}
function nm(i) {
  if (i === V.seat) return 'Ви';
  const p = V.players[i];
  return (p.bot ? '🤖 ' : '') + p.name + mark(i);
}
export function render(v) {
  const fresh = v.num !== lastNum;
  if (V && !fresh && v.trick.length > V.trick.length) sfx('card');
  if (v.phase !== 'discard') pick = [];
  V = v; busy = false;
  if (fresh) lastNum = v.num;
  const e = v.ev;
  if (e) {
    if (e.kind === 'trick') sfx('swish');
    if (e.kind === 'talon' && e.seat !== v.seat) toast(`${nm(e.seat)} бере прикуп`);
    if (e.kind === 'raspas') { sfx('bell'); toast('Усі спасували — розпаси: не беріть взяток!'); }
    if (e.kind === 'play' && e.seat !== v.seat && v.contract != null) toast(`${nm(e.seat)} грає ${E.bidName(E.BIDS[v.contract])}`);
    if (e.kind === 'deal') { const g = v.result.gain[v.seat]; toast(`${v.result.note} · вам ${g >= 0 ? '+' : ''}${g}`); }
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
function cardEl(c, extra) {
  const d = document.createElement('div');
  d.className = 'card' + (c.s >= 2 ? ' red' : '') + (V.trump != null && c.s === V.trump ? ' tr' : '') + (extra ? ' ' + extra : '');
  d.innerHTML = `<span class="c">${E.LABELS[c.r]}<i>${E.SUITS[c.s]}</i></span><span class="m">${E.SUITS[c.s]}</span>`;
  return d;
}
function backEl() { const d = document.createElement('div'); d.className = 'card back tiny'; return d; }
function button(text, fn, cls, disabled) {
  const b = document.createElement('button');
  b.textContent = text; if (cls) b.className = cls; b.disabled = !!disabled;
  b.onclick = fn; $('prBtns').appendChild(b);
}

function draw() {
  if (!V) return;
  const v = V, me = v.seat;
  const op = $('prOpps'); op.innerHTML = '';
  for (const k of [1, 2]) {
    const i = (me + k) % 3, p = v.players[i];
    const box = document.createElement('div');
    box.className = 'opp' + (!v.over && v.turn === i && !v.waitUntil ? ' att' : '') + (v.declarer === i ? ' partner' : '');
    const n = document.createElement('div'); n.className = 'nm'; n.textContent = nm(i);
    const cn = document.createElement('div'); cn.className = 'cn';
    for (let j = 0; j < Math.min(p.count, 3); j++) cn.appendChild(backEl());
    const num = document.createElement('span'); num.textContent = p.count; cn.appendChild(num);
    const bd = document.createElement('div'); bd.className = 'bd';
    bd.textContent = `${i === v.dealer ? '🃏 ' : ''}${v.phase === 'bid' ? (p.word || '…') : v.declarer === i ? '🎩 розігрує' : ''}${v.phase === 'play' || v.phase === 'score' ? ` ✋${p.tricks}` : ''} · ${p.score}` + (api.online && !api.online[i] ? ' 📴' : '');
    box.append(n, cn, bd);
    op.appendChild(box);
  }
  const info = $('prInfo'); info.innerHTML = '';
  const l1 = document.createElement('div'); l1.className = 'gsc';
  const game = v.contract != null ? E.bidName(E.BIDS[v.contract]) : v.phase === 'play' && v.declarer == null ? 'Розпаси' : v.bid >= 0 ? `ставка ${E.bidName(E.BIDS[v.bid])}` : 'торг';
  l1.textContent = `Роздача ${v.deal}/${v.deals} · ${game}` + (v.trump != null ? ` · козир ${E.SUITS[v.trump]}` : v.phase === 'play' ? ' · без козиря' : '');
  const l2 = document.createElement('div'); l2.className = 'tinfo small';
  l2.textContent = `Ваші очки: ${v.players[me].score}` + (v.phase === 'play' ? ` · ваші взятки: ${v.players[me].tricks}` : '') + (v.phase === 'bid' && v.players[me].word ? ` · ви сказали: ${v.players[me].word}` : '');
  info.append(l1, l2);
  // center: talon, trick or results
  const c = $('prCenter'); c.innerHTML = '';
  if (v.talon) {
    const row = document.createElement('div'); row.className = 'trow';
    v.talon.forEach(card => { const w = document.createElement('div'); w.className = 'tslot'; w.appendChild(cardEl(card)); row.appendChild(w); });
    const l = document.createElement('div'); l.className = 'tinfo small'; l.textContent = 'прикуп';
    c.append(row, l);
  }
  if (v.phase === 'play') {
    const row = document.createElement('div'); row.className = 'trow trick';
    v.trick.forEach(x => {
      const w = document.createElement('div'); w.className = 'tslot';
      w.appendChild(cardEl(x.c, 'pop'));
      const l = document.createElement('div'); l.className = 'tl'; l.textContent = nm(x.seat);
      w.appendChild(l); row.appendChild(w);
    });
    if (!v.trick.length) { const e = document.createElement('div'); e.className = 'tempty'; e.textContent = 'Стіл порожній'; row.appendChild(e); }
    c.appendChild(row);
  }
  if (v.phase === 'score' && v.result) {
    const r = v.result;
    const tbl = document.createElement('table'); tbl.className = 'tres';
    tbl.innerHTML = '<tr><th></th><th>Взятки</th><th>±</th><th>Рахунок</th></tr>';
    [0, 1, 2].forEach(i => {
      const tr = document.createElement('tr');
      [nm(i) + (r.declarer === i ? ' 🎩' : ''), r.tricks[i], (r.gain[i] > 0 ? '+' : '') + r.gain[i], v.players[i].score].forEach(x => { const td = document.createElement('td'); td.textContent = x; tr.appendChild(td); });
      tbl.appendChild(tr);
    });
    const n = document.createElement('div'); n.className = 'tinfo small'; n.textContent = r.note;
    c.append(n, tbl);
  }
  // buttons
  $('prBtns').innerHTML = '';
  const myTurn = !v.over && !busy && v.turn === me && !v.waitUntil;
  if (myTurn && v.phase === 'bid') {
    // the next few bids and «pass»
    button('Пас', () => send({ t: 'pass' }), 'sec');
    const from = v.bid + 1;
    E.BIDS.slice(from, from + 6).forEach((b, k) => button(E.bidName(b), () => send({ t: 'bid', v: from + k })));
    const mz = E.BIDS.findIndex(b => b.mizer);
    if (mz >= from + 6) button('мізер', () => send({ t: 'bid', v: mz }));
  }
  if (myTurn && v.phase === 'discard') {
    button(`Скинути ${pick.length}/2`, () => send({ t: 'discard', ids: pick }), '', pick.length !== 2);
  }
  if (myTurn && v.phase === 'contract') {
    E.BIDS.forEach((b, k) => { if (k >= v.bid && !b.mizer && k < v.bid + 8) button(E.bidName(b), () => send({ t: 'contract', v: k }), k === v.bid ? '' : 'sec'); });
  }
  // hand
  const hd = $('hand'); hd.innerHTML = '';
  const hand = [...v.hand].sort((a, b) => a.s - b.s || a.r - b.r);
  const canPlay = myTurn && v.phase === 'play';
  hand.forEach(card => {
    const ok = canPlay && E.legal(v, me, card);
    const chosen = pick.includes(card.id);
    const el = cardEl(card, canPlay ? (ok ? 'ok' : 'dim') : chosen ? 'chosen' : '');
    el.onclick = () => {
      if (myTurn && v.phase === 'discard') { pick = chosen ? pick.filter(x => x !== card.id) : pick.concat(card.id).slice(-2); draw(); return; }
      if (ok) send({ t: 'play', id: card.id });
    };
    hd.appendChild(el);
  });
  $('status').textContent = v.over ? '' : busy ? '…' : v.phase === 'score' ? 'Підсумки роздачі…' : v.waitUntil ? '…' :
    v.turn !== me ? (v.phase === 'bid' ? `Торгується ${nm(v.turn)}…` : v.phase === 'discard' || v.phase === 'contract' ? `${nm(v.turn)} обирає гру…` : `Ходить ${nm(v.turn)}…`) :
    v.phase === 'bid' ? 'Ваша ставка або пас' : v.phase === 'discard' ? 'Оберіть 2 карти, щоб скинути' : v.phase === 'contract' ? 'Оголосіть гру' :
    v.declarer == null ? 'Розпаси: намагайтеся не брати взяток' : v.declarer === me && E.BIDS[v.contract].mizer ? 'Мізер: не беріть жодної!' : 'Ваш хід';
  layoutRow(hd, 4);
}
function layoutRow(row, gap) {
  const cards = [...row.children]; if (!cards.length) return;
  const cs = getComputedStyle(row);
  const W = row.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const cw = cards[0].offsetWidth, n = cards.length;
  const step = n > 1 ? Math.min(cw + gap, (W - cw) / (n - 1)) : 0;
  cards.forEach((c, i) => { c.style.marginLeft = i ? (step - cw) + 'px' : '0'; });
}
export function result(v) {
  V = v;
  const win = v.winners.includes(v.seat);
  const res = win ? (v.winners.length > 1 ? 'draw' : 'win') : 'lose';
  const table = [0, 1, 2].map(i => [i, v.players[i].score]).sort((a, b) => b[1] - a[1]).map(([i, s]) => `${nm(i)}: ${s}`).join('\n');
  return { res, icon: win ? '🎩' : '🃏', title: win ? (res === 'draw' ? 'Нічия на першому місці' : 'Перемога!') : `Переміг ${nm(v.winners[0])}`, text: table };
}
