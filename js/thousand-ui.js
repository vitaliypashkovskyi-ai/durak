// Тисяча: screen — torg, prykup, contract, tricks, deal results.
import * as E from './thousand-engine.js';
import { $, haptic, toast } from './common.js';

export const rules = `
<p>3 гравці, 24 карти (9, валет, дама, король, 10, туз). Очки: туз 11, десятка 10, король 4, дама 3, валет 2, дев'ятка 0. У колоді 120 очок.</p>
<p><b>Торг:</b> гравець після роздавача вже «сидить» на 100. Далі по черзі підвищують на 5 або пасують. Більше 120 можна замовити, лише маючи марьяж.</p>
<p><b>Прикуп:</b> хто виграв торг, бере 3 карти прикупу (їх бачать усі), віддає по одній карті кожному супернику й остаточно замовляє (можна підняти).</p>
<p><b>Гра:</b> 8 взяток. Масть треба підтримати; якщо її немає — бити козирем. Козиря немає, доки хтось не оголосить марьяж.</p>
<p><b>Марьяж</b> (король + дама однієї масті): ♠ 40, ♣ 60, ♦ 80, ♥ 100. Оголошується автоматично, коли ви ходите королем чи дамою з пари й уже маєте хоч одну взятку. Його масть стає козирем.</p>
<p><b>Рахунок:</b> замовник отримує + замовлення, якщо набрав стільки ж, і − замовлення, якщо ні. Інші — свої очки, округлені до 5. Три роздачі з нулем («болти») — −120.</p>
<p><b>Бочка:</b> на 880 очки за взятки не додаються — виграти можна, лише взявши гру й дійшовши до 1000. Три невдалі роздачі на бочці — −120.</p>`;

let api, V = null, busy = false, lastNum = null, sel = null;

export function mount(box, a) {
  api = a; V = null; busy = false; lastNum = null; sel = null;
  box.innerHTML = `
    <div class="opps" id="tOpps"></div>
    <div class="tscore" id="tScore"></div>
    <div class="tmain" id="tCenter"></div>
    <div id="status"></div>
    <div class="brow" id="tBtns"></div>
    <div id="hand"></div>`;
}

function nm(i, acc) {
  if (i === V.seat) return acc ? 'вас' : 'Ви';
  const p = V.players[i];
  return (p.bot ? '🤖 ' : '') + p.name;
}
const suitHtml = s => `<b class="${s >= 2 ? 'redsuit' : ''}">${E.SUITS[s]}</b>`;

export function render(v) {
  const fresh = v.num !== lastNum;
  if (V && V.phase !== v.phase) sel = null;
  V = v; busy = false;
  if (fresh) { lastNum = v.num; sel = null; }
  if (v.ev) evToast(v.ev);
  draw();
}

function evToast(e) {
  if (e.kind === 'talon') toast(`${nm(e.who)} ${e.who === V.seat ? 'берете' : 'бере'} прикуп за ${e.bid}`);
  if (e.kind === 'contract') toast(`${nm(e.who)} ${e.who === V.seat ? 'граєте' : 'грає'} ${e.v}`);
  if (e.kind === 'marriage') { toast(`${nm(e.who)}: марьяж ${E.SUITS[e.s]} +${e.v}! Козир ${E.SUITS[e.s]}`); haptic('medium'); }
  if (e.kind === 'deal') toast('Роздачу завершено');
  if (e.kind === 'left') toast(`${V.players[e.who].name} вийшов — замість нього бот`);
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
  d.className = 'card' + (c.s >= 2 ? ' red' : '') + (c.s === V.trump ? ' tr' : '') + (extra ? ' ' + extra : '');
  d.innerHTML = `<span class="c">${E.LABELS[c.r]}<i>${E.SUITS[c.s]}</i></span><span class="m">${E.SUITS[c.s]}</span>`;
  return d;
}
function backEl() { const d = document.createElement('div'); d.className = 'card back tiny'; return d; }
function button(text, fn, cls, disabled) {
  const b = document.createElement('button');
  b.textContent = text; if (cls) b.className = cls; b.disabled = !!disabled;
  b.onclick = fn; $('tBtns').appendChild(b);
}

function statusText() {
  const v = V, me = v.seat, t = v.turn;
  if (v.over) return '';
  if (busy) return '…';
  if (v.phase === 'bid') {
    if (t === me) return `Торг: ${v.bid} (${nm(v.holder)}). Підвищуйте або пас`;
    return `Торгується ${nm(t)}… Зараз ${v.bid} (${nm(v.holder)})`;
  }
  if (v.phase === 'talon') {
    if (v.declarer === me) return sel ? 'Кому віддати цю карту?' : 'Віддайте по карті кожному супернику: торкніться карти';
    return `${nm(v.declarer)} роздає карти з прикупу…`;
  }
  if (v.phase === 'contract') return v.declarer === me ? 'Скільки замовляєте? Можна залишити або підняти' : `${nm(v.declarer)} вирішує замовлення…`;
  if (v.phase === 'play') {
    if (v.waitUntil) return '…';
    if (t === me) return v.trick.length ? 'Ваш хід — підтримайте масть' : 'Ваш хід';
    return `Ходить ${nm(t)}…`;
  }
  if (v.phase === 'score') return 'Підсумки роздачі. Скоро нова…';
  return '';
}

function draw() {
  if (!V) return;
  const v = V, me = v.seat;
  // opponents
  const op = $('tOpps'); op.innerHTML = '';
  for (const k of [1, 2]) {
    const i = (me + k) % 3, p = v.players[i];
    const box = document.createElement('div');
    box.className = 'opp' + (!v.over && v.turn === i && !v.waitUntil ? ' att' : '') + (v.declarer === i ? ' def' : '');
    const n = document.createElement('div'); n.className = 'nm'; n.textContent = nm(i);
    const cn = document.createElement('div'); cn.className = 'cn';
    for (let j = 0; j < Math.min(p.count, 3); j++) cn.appendChild(backEl());
    const num = document.createElement('span'); num.textContent = p.count; cn.appendChild(num);
    const bd = document.createElement('div'); bd.className = 'bd';
    bd.textContent = badge(i) + (api.online && !api.online[i] ? ' 📴' : '');
    box.append(n, cn, bd);
    op.appendChild(box);
  }
  // scores
  $('tScore').innerHTML = '';
  v.players.forEach((p, i) => {
    const s = document.createElement('span');
    s.className = 'tsc' + (i === me ? ' me' : '');
    s.textContent = `${i === me ? 'Ви' : p.name}: ${p.score}${p.barrel ? ` 🛢${p.barrel}/3` : ''}${p.bolts ? ' ' + '⚡'.repeat(p.bolts) : ''}`;
    $('tScore').appendChild(s);
  });
  // center
  const c = $('tCenter'); c.innerHTML = '';
  const info = document.createElement('div'); info.className = 'tinfo';
  const trumpTxt = v.trump != null ? `Козир: ${suitHtml(v.trump)}` : 'Козиря ще немає';
  if (v.phase === 'bid') info.innerHTML = `Роздача ${v.deal} · торг: <b>${v.bid}</b> — ${nmEsc(v.holder)}`;
  else if (v.phase === 'talon' || v.phase === 'contract') info.innerHTML = `Прикуп бере ${nmEsc(v.declarer)} за <b>${v.bid}</b>`;
  else if (v.phase === 'play') info.innerHTML = `${nmEsc(v.declarer)} грає <b>${v.contract}</b> · ${trumpTxt}`;
  else if (v.phase === 'score') info.innerHTML = `Роздача ${v.deal}: ${nmEsc(v.declarer)} грав <b>${v.contract}</b>`;
  c.appendChild(info);
  if (v.talonShown) {
    const row = document.createElement('div'); row.className = 'trow';
    v.talonShown.forEach(x => row.appendChild(cardEl(x)));
    c.appendChild(row);
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
    const t = document.createElement('div'); t.className = 'tinfo small';
    t.textContent = v.players.map((p, i) => `${i === me ? 'Ви' : p.name}: взяток ${p.tricks}${p.marr ? `, марьяж +${p.marr}` : ''}`).join(' · ');
    c.appendChild(t);
  }
  if (v.phase === 'score' && v.result) {
    const tbl = document.createElement('table'); tbl.className = 'tres';
    tbl.innerHTML = '<tr><th></th><th>Очки</th><th>±</th><th>Рахунок</th></tr>';
    v.result.forEach((r, i) => {
      const tr = document.createElement('tr');
      const cells = [nm(i) + (i === v.declarer ? (r.made ? ' ✅' : ' ❌') : '') + (r.bolt ? ' ⚡' : ''), r.pts, (r.delta > 0 ? '+' : '') + r.delta, r.score];
      cells.forEach(x => { const td = document.createElement('td'); td.textContent = x; tr.appendChild(td); });
      tbl.appendChild(tr);
    });
    c.appendChild(tbl);
  }
  // buttons
  $('tBtns').innerHTML = '';
  if (!v.over && !busy) {
    if (v.phase === 'bid' && v.turn === me) {
      button('Пас', () => send({ t: 'pass' }), 'sec');
      [5, 10, 20].map(d => v.bid + d).filter(x => E.canBid(v, me, x)).forEach(x => button(String(x), () => send({ t: 'bid', v: x })));
    }
    if (v.phase === 'talon' && v.declarer === me && sel) {
      [1, 2].map(k => (me + k) % 3).filter(i => !v.given.includes(i)).forEach(i => button(`→ ${nm(i)}`, () => { const id = sel; sel = null; send({ t: 'give', id, to: i }); }));
    }
    if (v.phase === 'contract' && v.declarer === me) {
      [0, 5, 10, 20].map(d => v.bid + d).filter(x => E.canContract(v, me, x)).forEach((x, k) => button(k ? String(x) : `Граю ${x}`, () => send({ t: 'contract', v: x }), k ? 'sec' : ''));
    }
  }
  // hand
  const hd = $('hand'); hd.innerHTML = '';
  const hand = [...v.hand].sort((a, b) => a.s - b.s || b.r - a.r);
  const canPlay = !busy && !v.over && v.phase === 'play' && v.turn === me && !v.waitUntil;
  const picking = !busy && !v.over && v.phase === 'talon' && v.declarer === me;
  hand.forEach(card => {
    const ok = canPlay ? E.legal(v, me, card) : picking;
    const el = cardEl(card, (canPlay || picking) ? (ok ? 'ok' : 'dim') : '');
    if (picking && sel === card.id) el.classList.add('picked');
    if (canPlay && ok && E.canMarry(v, me, card)) el.classList.add('marry');
    el.onclick = () => {
      if (picking) { sel = sel === card.id ? null : card.id; draw(); return; }
      if (canPlay && ok) send({ t: 'play', id: card.id });
    };
    hd.appendChild(el);
  });
  $('status').textContent = statusText();
  layoutRow(hd, 6);
}
const nmEsc = i => (i == null ? '' : nm(i).replace(/[<>&]/g, ''));
function badge(i) {
  const v = V, p = v.players[i];
  const parts = [];
  if (i === v.dealer) parts.push('🃏');
  if (v.phase === 'bid') parts.push(p.passed ? '✋ пас' : i === v.holder ? `📢 ${v.bid}` : '');
  else if (i === v.declarer) parts.push(`🎯 ${v.contract || v.bid}`);
  return parts.filter(Boolean).join(' ');
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
  if (v.winner === v.seat) return { res: 'win', icon: '🏆', title: 'Тисяча! Перемога', text: `Рахунок: ${v.players.map(p => `${p.name} ${p.score}`).join(', ')}` };
  return { res: 'lose', icon: '🂡', title: `Переміг ${nm(v.winner)}`, text: `Рахунок: ${v.players.map(p => `${p.name} ${p.score}`).join(', ')}` };
}
