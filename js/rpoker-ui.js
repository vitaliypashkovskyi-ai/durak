// Розписний покер: screen — round info, bids, tricks, the joker choice, deal results.
import * as E from './rpoker-engine.js';
import { $, haptic, toast, sfx, showPanel, hidePanel, mark } from './common.js';

export const rules = `
<p>2–8 гравців. Колода 36 карт (джокер — 7♠, до 6 гравців) або 54 (два джокери, до 8 гравців).</p>
<p><b>Роздачі:</b> спершу по 1 карті, далі 2, 3… до максимуму (не більше 10), потім назад до 1. У <b>повній</b> грі ще по колу на максимумі, а наприкінці — особливі раунди: 🌑 <b>темна</b> (замовляєте не дивлячись у карти), 🚫 <b>безкозирка</b>, 💰 <b>золота</b> (очки ×2), ❄️ <b>мізер</b> (кожна взятка −10, жодної — +50).</p>
<p><b>Козир</b> — відкрита карта після роздачі (або остання карта роздавача, якщо роздано всю колоду).</p>
<p><b>Замовлення:</b> по черзі, хто скільки взяток візьме. Роздавач — останній і не може зробити суму замовлень рівною кількості карт.</p>
<p><b>Хід:</b> масть треба підтримати, якщо немає — бити козирем, якщо немає й козиря — будь-яка карта.</p>
<p><b>Джокер 🃏</b> — найсильніший, його можна покласти будь-коли. Першим: «забираю» або «по старших [масть]» (усі кладуть найстаршу карту цієї масті). Не першим: «забираю» або «скидаю» (тоді він найслабший).</p>
<p><b>Очки:</b> взяли рівно стільки, скільки замовили — 10 за кожну (0 із 0 — 5). Зайві взятки — +1 за кожну. Недобір — −10 за кожну. Виграє той, у кого більше очок наприкінці.</p>`;

let api, V = null, busy = false, lastNum = null;

export function mount(box, a) {
  api = a; V = null; busy = false; lastNum = null;
  box.innerHTML = `
    <div class="opps" id="pOpps"></div>
    <div class="tscore" id="pInfo"></div>
    <div class="tmain" id="pCenter"></div>
    <div id="status"></div>
    <div class="brow" id="pBtns"></div>
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
  V = v; busy = false;
  if (fresh) lastNum = v.num;
  if (v.ev) evToast(v.ev);
  draw();
}
function evToast(e) {
  const v = V;
  if (e.kind === 'deal') {
    const t = E.TYPES[v.type];
    toast(`${t.icon ? t.icon + ' ' + t.name + ' · ' : ''}${v.k} ${v.k === 1 ? 'карта' : v.k < 5 ? 'карти' : 'карт'}`);
    if (v.type !== 'normal') sfx('bell');
  }
  if (e.kind === 'trick') sfx('swish');
  if (e.kind === 'score') {
    const r = v.result[v.seat];
    toast(r.pts >= 0 ? `+${r.pts} ${r.bid === r.took || v.type === 'mizer' && r.took === 0 ? '🎯' : ''}` : `${r.pts} 💸`);
  }
  if (e.kind === 'left') toast(`${v.players[e.who].name} вийшов — замість нього бот`);
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
  if (c.joker) {
    d.className = 'card joker' + (extra ? ' ' + extra : '');
    d.innerHTML = '<span class="c">JK</span><span class="m">🃏</span>';
    return d;
  }
  d.className = 'card' + (c.s >= 2 ? ' red' : '') + (V.trump != null && c.s === V.trump ? ' tr' : '') + (extra ? ' ' + extra : '');
  d.innerHTML = `<span class="c">${E.LABELS[c.r]}<i>${E.SUITS[c.s]}</i></span><span class="m">${E.SUITS[c.s]}</span>`;
  return d;
}
function backEl(tiny) { const d = document.createElement('div'); d.className = 'card back' + (tiny ? ' tiny' : ''); return d; }
function button(text, fn, cls, disabled) {
  const b = document.createElement('button');
  b.textContent = text; if (cls) b.className = cls; b.disabled = !!disabled;
  b.onclick = fn; $('pBtns').appendChild(b);
}

function playCard(c) {
  if (!c.joker) return send({ t: 'play', id: c.id });
  const first = !V.trick.length;
  const pick = m => () => { hidePanel(); send(Object.assign({ t: 'play', id: c.id }, m)); };
  showPanel({
    kind: 'choice', icon: '🃏', title: 'Джокер', text: first ? 'Як ходите джокером?' : 'Що робить джокер?',
    buttons: first
      ? [{ text: '✋ Забираю', fn: pick({ mode: 'take' }) },
        ...E.SUITS.map((s, i) => ({ text: `По старших ${s}`, sec: true, fn: pick({ mode: 'high', suit: i }) })),
        { text: 'Скасувати', sec: true, fn: hidePanel }]
      : [{ text: '✋ Забираю', fn: pick({ mode: 'take' }) }, { text: '⬇️ Скидаю', sec: true, fn: pick({ mode: 'drop' }) },
        { text: 'Скасувати', sec: true, fn: hidePanel }],
  });
}

function draw() {
  if (!V) return;
  const v = V, me = v.seat, n = v.players.length;
  // opponents
  const op = $('pOpps'); op.innerHTML = '';
  op.classList.toggle('many', n > 5);
  for (let k = 1; k < n; k++) {
    const i = (me + k) % n, p = v.players[i];
    const box = document.createElement('div');
    box.className = 'opp' + (!v.over && v.turn === i && !v.waitUntil ? ' att' : '');
    const nmEl = document.createElement('div'); nmEl.className = 'nm'; nmEl.textContent = nm(i);
    const cn = document.createElement('div'); cn.className = 'cn';
    for (let j = 0; j < Math.min(p.count, n > 5 ? 1 : 3); j++) cn.appendChild(backEl(true));
    const num = document.createElement('span'); num.textContent = p.count; cn.appendChild(num);
    const bd = document.createElement('div'); bd.className = 'bd';
    bd.textContent = `${i === v.dealer ? '🃏 ' : ''}${p.bid != null ? `📢${p.bid} ✋${p.taken}` : v.type === 'mizer' ? `✋${p.taken}` : '…'} · ${p.score}` +
      (api.online && !api.online[i] ? ' 📴' : '');
    box.append(nmEl, cn, bd);
    op.appendChild(box);
  }
  // round info
  const t = E.TYPES[v.type];
  const info = $('pInfo'); info.innerHTML = '';
  const l1 = document.createElement('div'); l1.className = 'gsc';
  l1.textContent = `${t.icon ? t.icon + ' ' + t.name + ' · ' : ''}Роздача ${v.round + 1}/${v.rounds} · ${v.k} карт.`;
  const l2 = document.createElement('div'); l2.className = 'tinfo small';
  const mine = v.players[me];
  l2.textContent = `Козир: ${v.trump != null ? E.SUITS[v.trump] : 'немає'} · Ви: ${mine.bid != null ? `замовили ${mine.bid}, взяли ${mine.taken}` : v.type === 'mizer' ? `взяли ${mine.taken} (мізер)` : 'ще не замовили'} · очки ${mine.score}`;
  info.append(l1, l2);
  // center
  const c = $('pCenter'); c.innerHTML = '';
  if (v.phase === 'bid' && v.trumpCard) {
    const row = document.createElement('div'); row.className = 'trow';
    const w = document.createElement('div'); w.className = 'tslot';
    w.appendChild(cardEl(v.trumpCard));
    const l = document.createElement('div'); l.className = 'tl'; l.textContent = 'козир';
    w.appendChild(l); row.appendChild(w); c.appendChild(row);
    const s = document.createElement('div'); s.className = 'tinfo small';
    const sum = v.bids.reduce((a, b) => a + (b || 0), 0);
    s.textContent = `Замовлено: ${sum} із ${v.k}`;
    c.appendChild(s);
  }
  if (v.phase === 'play') {
    const row = document.createElement('div'); row.className = 'trow trick';
    v.trick.forEach(x => {
      const w = document.createElement('div'); w.className = 'tslot';
      w.appendChild(cardEl(x.c, 'pop'));
      const l = document.createElement('div'); l.className = 'tl';
      l.textContent = nm(x.seat) + (x.c.joker ? (x.mode === 'drop' ? ' · скидає' : x.mode === 'high' ? ` · по ${E.SUITS[x.suit]}` : ' · забирає') : '');
      w.appendChild(l); row.appendChild(w);
    });
    if (!v.trick.length) { const e = document.createElement('div'); e.className = 'tempty'; e.textContent = 'Стіл порожній'; row.appendChild(e); }
    c.appendChild(row);
  }
  if (v.phase === 'score' && v.result) {
    const tbl = document.createElement('table'); tbl.className = 'tres';
    tbl.innerHTML = '<tr><th></th><th>Замов.</th><th>Взяв</th><th>±</th><th>Рахунок</th></tr>';
    v.result.forEach((r, i) => {
      const tr = document.createElement('tr');
      [nm(i), r.bid ?? '—', r.took, (r.pts > 0 ? '+' : '') + r.pts, r.score].forEach(x => { const td = document.createElement('td'); td.textContent = x; tr.appendChild(td); });
      tbl.appendChild(tr);
    });
    c.appendChild(tbl);
    if (v.upcoming && v.upcoming.length) {
      const s = document.createElement('div'); s.className = 'tinfo small';
      s.textContent = 'Далі: ' + v.upcoming.map(u => `${E.TYPES[u.type].icon || ''}${u.k}`).join(' → ');
      c.appendChild(s);
    }
  }
  // bid buttons
  $('pBtns').innerHTML = '';
  if (!v.over && !busy && v.phase === 'bid' && v.turn === me) {
    for (let x = 0; x <= v.k; x++) button(String(x), () => send({ t: 'bid', v: x }), x ? '' : 'sec', !E.canBid(v, me, x));
  }
  // hand
  const hd = $('hand'); hd.innerHTML = '';
  if (v.darkCount) {
    for (let j = 0; j < v.darkCount; j++) hd.appendChild(backEl(false));
  } else {
    const hand = [...v.hand].sort((a, b) => (a.joker - b.joker) || a.s - b.s || a.r - b.r);
    const canPlay = !busy && !v.over && v.phase === 'play' && v.turn === me && !v.waitUntil;
    hand.forEach(card => {
      const ok = canPlay && E.legal(v, me, card);
      const el = cardEl(card, canPlay ? (ok ? 'ok' : 'dim') : '');
      el.onclick = () => { if (ok) playCard(card); };
      hd.appendChild(el);
    });
  }
  $('status').textContent = statusText();
  layoutRow(hd, 4);
}
function statusText() {
  const v = V, me = v.seat;
  if (v.over) return '';
  if (busy || v.waitUntil && v.phase === 'play') return '…';
  if (v.phase === 'score') return 'Підсумки роздачі…';
  if (v.phase === 'bid') {
    if (v.turn !== me) return `Замовляє ${nm(v.turn)}…`;
    const dark = v.darkCount ? ' наосліп 🌑' : '';
    return me === v.dealer ? `Ви роздавач: замовте${dark} (не можна, щоб сума стала ${v.k})` : `Скільки взяток візьмете?${dark}`;
  }
  if (v.turn === me) {
    const need = v.type === 'mizer' ? 'не беріть жодної!' : `треба ще ${Math.max(0, (v.players[me].bid || 0) - v.players[me].taken)}`;
    return `Ваш хід · ${need}`;
  }
  return `Ходить ${nm(v.turn)}…`;
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
  const best = Math.max(...v.players.map(p => p.score));
  const win = v.winners.includes(v.seat);
  const res = win ? (v.winners.length > 1 ? 'draw' : 'win') : 'lose';
  const table = [...v.players.map((p, i) => [i, p.score])].sort((a, b) => b[1] - a[1]).map(([i, s]) => `${nm(i)}: ${s}`).join('\n');
  return { res, icon: win ? '🏆' : '🎯', title: win ? (res === 'draw' ? 'Нічия на першому місці' : 'Перемога!') : `Переміг ${nm(v.winners[0])}`, text: `Найбільше — ${best}\n${table}` };
}
