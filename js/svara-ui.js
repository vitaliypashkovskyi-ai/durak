// Свара: screen — chips, the pot, bets, the showdown and «свара» replays.
import * as E from './svara-engine.js';
import { $, haptic, toast, sfx, mark } from './common.js';

export const rules = `
<p>2–8 гравців, колода 36 карт, кожному по <b>3 карти</b>. У кожного на старті ${E.START} фішок.</p>
<p><b>Очки руки:</b> сума карт <b>однієї масті</b> — туз 11, король, дама, валет і 10 — по 10, 9…6 — за номіналом. Два тузи — 22. Три однакові — тричі номінал (три тузи — 33), <b>три шістки — 34</b>, найстарша рука.</p>
<p><b>Шаха 7♣</b> — джокер: стає будь-якою картою (до масті додає 11, доповнює пару до трійки).</p>
<p><b>Торг:</b> кожен кладе в банк ${E.ANTE} фішку, далі по колу: <b>пас</b> (скинути карти), <b>підтримати</b> (зрівняти ставку) або <b>підняти</b>. Ставка не може перевищити фішки найбіднішого в роздачі.</p>
<p>Хто лишився сам — забирає банк без показу. Інакше карти відкривають: найбільше очок забирає банк. Нічия — <b>свара</b>: ті, хто зрівнявся, переграють за той самий банк.</p>
<p>Без фішок — вибуваєте. Гра йде до останнього з фішками або до кінця роздач (коротка — 10, повна — 20): тоді перемагає найбагатший.</p>`;

let api, V = null, busy = false, lastNum = null;

export function mount(box, a) {
  api = a; V = null; busy = false; lastNum = null;
  box.innerHTML = `
    <div class="opps" id="sOpps"></div>
    <div class="tscore" id="sInfo"></div>
    <div class="tmain" id="sCenter"></div>
    <div id="status"></div>
    <div class="brow" id="sBtns"></div>
    <div id="hand"></div>`;
}

function nm(i) {
  if (i === V.seat) return 'Ви';
  const p = V.players[i];
  return (p.bot ? '🤖 ' : '') + p.name + mark(i);
}

export function render(v) {
  const fresh = v.num !== lastNum;
  V = v; busy = false;
  if (fresh) lastNum = v.num;
  if (v.ev) evToast(v.ev);
  draw();
}
function evToast(e) {
  const v = V;
  if (e.kind === 'move') {
    if (e.t === 'raise') { sfx('card'); if (e.seat !== v.seat) toast(`${nm(e.seat)}: +${e.v} ⬆️`); }
    else if (e.t === 'fold') sfx('swish');
    else sfx('card');
  }
  if (e.kind === 'won') {
    const r = v.result, w = e.who[0];
    if (w === v.seat) { sfx('chime'); toast(`Ви забираєте банк: +${r.pot} 💰`); }
    else toast(`${nm(w)} забирає банк ${r.pot}`);
  }
  if (e.kind === 'svara') { sfx('bell'); toast(`⚔️ Свара! ${e.who.map(nm).join(', ')} переграють банк`); }
  if (e.kind === 'deal') sfx('swish');
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
  d.className = 'card' + (c.s >= 2 ? ' red' : '') + (E.isJoker(c) ? ' tr' : '') + (extra ? ' ' + extra : '');
  d.innerHTML = `<span class="c">${E.LABELS[c.r]}<i>${E.SUITS[c.s]}</i></span><span class="m">${E.SUITS[c.s]}</span>`;
  return d;
}
function backEl(tiny) { const d = document.createElement('div'); d.className = 'card back' + (tiny ? ' tiny' : ''); return d; }
function button(text, fn, cls, disabled) {
  const b = document.createElement('button');
  b.textContent = text; if (cls) b.className = cls; b.disabled = !!disabled;
  b.onclick = fn; $('sBtns').appendChild(b);
}

function stateOf(p, i) {
  const v = V;
  if (p.out) return 'вибув';
  if (!p.inHand) return v.svara ? 'чекає свару' : '—';
  if (p.folded) return 'пас';
  if (v.lastMove && v.lastMove.seat === i && v.phase === 'bet') {
    const m = v.lastMove;
    return m.t === 'raise' ? `+${m.v} ⬆️` : m.t === 'call' ? 'підтримав' : 'чекає';
  }
  return p.bet ? `ставка ${p.bet}` : '';
}

function draw() {
  if (!V) return;
  const v = V, me = v.seat, n = v.players.length;
  const show = v.phase === 'show' && v.result;
  // opponents
  const op = $('sOpps'); op.innerHTML = '';
  op.classList.toggle('many', n > 5);
  for (let k = 1; k < n; k++) {
    const i = (me + k) % n, p = v.players[i];
    const box = document.createElement('div');
    const won = show && !v.result.svara && v.result.winners.includes(i);
    box.className = 'opp' + (!v.over && v.phase === 'bet' && v.turn === i ? ' att' : '') + (p.folded || p.out ? ' sfold' : '') + (won ? ' swin' : '');
    const nmEl = document.createElement('div'); nmEl.className = 'nm'; nmEl.textContent = nm(i);
    const cn = document.createElement('div'); cn.className = 'cn';
    if (show && p.cards) {
      for (const c of p.cards) {
        const t = document.createElement('span');
        t.className = 'scard' + (c.s >= 2 ? ' red' : '') + (E.isJoker(c) ? ' jk' : '');
        t.textContent = E.LABELS[c.r] + E.SUITS[c.s];
        cn.appendChild(t);
      }
    } else if (p.inHand && !p.folded) {
      for (let j = 0; j < Math.min(p.count, n > 5 ? 1 : 3); j++) cn.appendChild(backEl(true));
    }
    const bd = document.createElement('div'); bd.className = 'bd';
    const sc = show && v.result.scores[i] != null ? ` · ${v.result.scores[i]} оч.` : '';
    bd.textContent = [`${i === v.dealer ? '🃏 ' : ''}💰${p.chips}`, stateOf(p, i)].filter(Boolean).join(' · ') + sc + (api.online && !api.online[i] ? ' 📴' : '');
    box.append(nmEl, cn, bd);
    op.appendChild(box);
  }
  // info
  const mine = v.players[me];
  const info = $('sInfo'); info.innerHTML = '';
  const l1 = document.createElement('div'); l1.className = 'gsc';
  l1.textContent = `${v.svara ? '⚔️ Свара · ' : ''}Роздача ${v.handNo}/${v.maxHands} · Банк 💰${v.pot || (show ? v.result.pot : 0)}`;
  const l2 = document.createElement('div'); l2.className = 'tinfo small';
  l2.textContent = `Ваші фішки: ${mine.chips}` + (v.phase === 'bet' && mine.inHand ? ` · ставка ${v.cur}` + (mine.bet ? ` (ваша ${mine.bet})` : '') : '') +
    (mine.inHand && v.hand.length ? ` · у вас ${E.score(v.hand)} оч.` : '');
  info.append(l1, l2);
  // center
  const c = $('sCenter'); c.innerHTML = '';
  if (show) {
    const r = v.result;
    const t = document.createElement('div'); t.className = 'sres';
    if (!r.shown.length) t.textContent = `${nm(r.winners[0])}: усі спасували — банк ${r.pot}`;
    else if (r.svara) t.textContent = `⚔️ Свара: ${r.winners.map(nm).join(', ')} — по ${r.scores[r.winners[0]]} оч.`;
    else t.textContent = `🏆 ${nm(r.winners[0])}: ${r.scores[r.winners[0]]} оч. — банк ${r.pot}`;
    c.appendChild(t);
  } else {
    const pot = document.createElement('div'); pot.className = 'spot';
    pot.textContent = `💰 ${v.pot}`;
    c.appendChild(pot);
  }
  // buttons
  $('sBtns').innerHTML = '';
  const myTurn = !v.over && !busy && v.phase === 'bet' && v.turn === me && !v.waitUntil;
  if (myTurn) {
    const need = v.cur - mine.bet;
    button('Пас', () => send({ t: 'fold' }), 'sec');
    button(need > 0 ? `Підтримати ${need}` : 'Чекати', () => send({ t: 'call' }));
    for (const x of E.RAISES) button(`+${x}`, () => send({ t: 'raise', v: x }), 'up', v.cur + x > v.cap);
  }
  // hand
  const hd = $('hand'); hd.innerHTML = '';
  const hand = [...v.hand].sort((a, b) => a.s - b.s || a.r - b.r);
  hand.forEach(card => hd.appendChild(cardEl(card, mine.folded ? 'dim' : '')));
  $('status').textContent = statusText();
  layoutRow(hd, 6);
}
function statusText() {
  const v = V, me = v.seat, mine = v.players[me];
  if (v.over) return '';
  if (busy) return '…';
  if (v.phase === 'show') return v.result.svara ? 'Свара! Скоро перегравання…' : 'Наступна роздача скоро…';
  if (mine.out) return 'У вас закінчились фішки — ви глядач';
  if (!mine.inHand) return 'Ви чекаєте, поки закінчиться свара';
  if (mine.folded) return 'Ви спасували. Чекаємо…';
  if (v.turn === me) return v.cur - mine.bet > 0 ? `Ваш хід: підтримати ${v.cur - mine.bet}, підняти чи пас?` : 'Ваш хід: чекати, підняти чи пас?';
  return `Хід: ${nm(v.turn)}…`;
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
  const table = v.players.map((p, i) => [i, p.chips]).sort((a, b) => b[1] - a[1]).map(([i, s]) => `${nm(i)}: ${s}`).join('\n');
  return { res, icon: win ? '💰' : '🎴', title: win ? (res === 'draw' ? 'Нічия на першому місці' : 'Перемога! Усі фішки ваші') : `Переміг ${nm(v.winners[0])}`, text: `Фішки:\n${table}` };
}
