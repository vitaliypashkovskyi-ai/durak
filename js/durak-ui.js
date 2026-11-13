// Дурень: screen. Draws a player's view and turns taps into moves.
import * as E from './durak-engine.js';
import { $, haptic, toast, showPanel, hidePanel, sfx, mark } from './common.js';

export const rules = `
<p>Колода 36 карт (до 6 гравців), 52 (до 8) або дві по 36 (до 12), по 6 у руці. Козир — нижня карта колоди, будь-який козир б'є некозирну карту.</p>
<p><b>Атака:</b> перший кидає будь-яку карту на гравця зліва.</p>
<p><b>Захист:</b> бийте старшою картою тієї ж масті або козирем. Не можете — «Беру».</p>
<p><b>Три варіанти:</b></p>
<p>• <b>Підкидний</b> — усі, крім захисника, підкидають карти тих номіналів, що вже є на столі (до 6 карт, у першому відбої — до 5, і не більше, ніж карт у захисника). Переводити не можна.</p>
<p>• <b>Переводний</b> — підкидати не можна, але поки жодна карта не побита, захисник може покласти карту того ж номіналу й перевести атаку на наступного гравця.</p>
<p>• <b>Підкидний + переводний</b> — можна і підкидати, і переводити.</p>
<p>Відбився — «Бито», і ходить захисник. Узяв — ходить наступний за ним. Хто скинув усі карти, коли колода скінчилась, — вийшов. Останній із картами — дурень.</p>
<p class="muted">Порада: торкніться карти на столі, щоб вибрати, яку саме бити.</p>`;

let api, V = null, sel = null, busy = false, lastNum = null;
const seen = new Set();

export function mount(box, a) {
  api = a; V = null; sel = null; busy = false; lastNum = null; seen.clear();
  box.innerHTML = `
    <div class="opps" id="dOpps"></div>
    <div class="dmain">
      <div id="info"><div id="deck"></div><div id="infoText"></div></div>
      <div id="table"></div>
    </div>
    <div id="status"></div>
    <div id="btnRow"><button id="act" hidden></button></div>
    <div id="hand"></div>`;
  $('act').onclick = onButton;
}

function nm(i, acc) {
  if (i === V.seat) return acc ? 'вас' : 'Ви';
  const p = V.players[i];
  return (p.bot ? '🤖 ' : '') + p.name + mark(i);
}

const onTable = v => v.table.reduce((n, p) => n + (p.d ? 2 : 1), 0);
export function render(v) {
  const fresh = v.num !== lastNum;
  if (V && (fresh || V.table.length !== v.table.length)) sel = null;
  if (V && !fresh && onTable(v) > onTable(V)) sfx('card');
  V = v; busy = false;
  if (fresh) {
    lastNum = v.num; seen.clear();
    if (!v.over) toast(v.attacker === v.seat ? 'Ви ходите першим' : `Першим ходить ${nm(v.attacker)}`);
  } else if (v.ev) evToast(v.ev);
  draw();
}

function evToast(e) {
  const me = V.seat, parts = [];
  if (e.kind === 'bito') parts.push('Бито');
  if (e.kind === 'took') parts.push(e.who === me ? 'Ви взяли карти' : `${nm(e.who)} бере`);
  if (e.kind === 'transfer') parts.push(`${nm(e.who)} переводить на ${nm(e.to, true)}`);
  if (e.kind === 'left') parts.push(`${V.players[e.who].name} вийшов — замість нього бот`);
  if (e.out && e.out.length) parts.push(e.out.map(i => (i === me ? 'Ви вийшли без карт' : `${nm(i)} без карт`)).join(', '));
  toast(parts.join(' · '));
  if (e.kind === 'transfer' && e.to === me) haptic('medium');
  if (e.kind === 'bito') sfx('swish');
  if (e.kind === 'took') sfx('thud');
}

// ---------- moves ----------
function send(m) {
  if (busy || !V || V.over) return;
  const r = api.act(m);
  if (r === null) { busy = true; draw(); }          // online: wait for the server
  else if (r === false) toast('Так не можна');
  else haptic('light');
}
function reject(el) { haptic('error'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
function playable(c) {
  if (busy || V.over) return false;
  const me = V.seat;
  return E.canLead(V, me) || E.coverTargets(V, me, c).length > 0 || E.canTransfer(V, me, c) || E.canAdd(V, me, c);
}
function onCard(c, el) {
  if (busy || V.over) return;
  const me = V.seat;
  if (E.canLead(V, me)) return send({ t: 'play', id: c.id });
  if (me === V.defender) {
    const targets = E.coverTargets(V, me, c), tr = E.canTransfer(V, me, c);
    const i = targets.includes(sel) ? sel : targets[0];
    if (targets.length && tr) {
      return showPanel({ kind: 'choice', title: 'Що зробити?', buttons: [
        { text: '🛡 Побити', fn: () => { hidePanel(); send({ t: 'cover', i, id: c.id }); } },
        { text: '↪ Перевести', fn: () => { hidePanel(); send({ t: 'transfer', id: c.id }); } },
        { text: 'Скасувати', sec: true, fn: hidePanel },
      ] });
    }
    if (targets.length) return send({ t: 'cover', i, id: c.id });
    if (tr) return send({ t: 'transfer', id: c.id });
    return reject(el);
  }
  if (E.canAdd(V, me, c)) return send({ t: 'play', id: c.id });
  reject(el);
}
function btnMode() {
  if (!V || busy || V.over) return null;
  const me = V.seat;
  if (me === V.defender && !V.taking && E.undefended(V)) return 'take';
  if (E.canPass(V, me)) return V.taking ? 'pass' : 'bito';
  return null;
}
function onButton() {
  const m = btnMode();
  if (m === 'take') send({ t: 'take' });
  else if (m) send({ t: 'pass' });
}

// ---------- drawing ----------
function cardEl(c, extra) {
  const d = document.createElement('div');
  d.className = 'card' + (c.s >= 2 ? ' red' : '') + (c.s === V.trump ? ' tr' : '') + (extra ? ' ' + extra : '');
  d.innerHTML = `<span class="c">${E.RANKS[c.r]}<i>${E.SUITS[c.s]}</i></span><span class="m">${E.SUITS[c.s]}</span>`;
  return d;
}
function backEl(extra) { const d = document.createElement('div'); d.className = 'card back' + (extra ? ' ' + extra : ''); return d; }
function popIfNew(el, c) { if (!seen.has(c.id)) { seen.add(c.id); el.classList.add('pop'); } }

function statusText() {
  const v = V, me = v.seat, d = v.defender, a = v.attacker, u = E.undefended(v);
  if (v.over) return '';
  if (v.players[me].done) return 'Ви вийшли без карт 🎉 Чекаємо кінця гри…';
  if (busy) return '…';
  if (!v.table.length) return a === me ? 'Ваш хід — киньте карту' : `${nm(a)} ходить на ${nm(d, true)}`;
  if (me === d) {
    if (v.taking) return 'Ви берете. Інші підкидають…';
    if (u) {
      const tr = v.hand.some(c => E.canTransfer(v, me, c));
      if (tr) return 'Бийте, переводьте або беріть';
      return u > 1 ? 'Бийте (торкніться карти на столі, щоб вибрати ціль) або беріть' : 'Бийте або беріть';
    }
    return 'Чекаємо, чи підкинуть ще…';
  }
  if (E.canPass(v, me)) {
    const can = v.hand.some(c => E.canAdd(v, me, c));
    if (v.taking) return `${nm(d)} бере. ${can ? 'Підкиньте або «Пас»' : 'Натисніть «Пас»'}`;
    return can ? 'Відбито. Підкиньте або «Бито»' : 'Відбито. Натисніть «Бито»';
  }
  if (v.players[me].passed) return 'Чекаємо інших…';
  return `${nm(d)} відбивається…`;
}

function draw() {
  if (!V) return;
  const v = V, me = v.seat, n = v.players.length;
  // opponents
  const op = $('dOpps'); op.innerHTML = '';
  op.classList.toggle('many', n > 5);
  for (let k = 1; k < n; k++) {
    const i = (me + k) % n, p = v.players[i];
    const box = document.createElement('div');
    const live = !v.over && !p.done;
    box.className = 'opp' + (p.done ? ' done' : '') + (live && i === v.defender ? ' def' : '') + (live && i === v.attacker ? ' att' : '');
    const nmEl = document.createElement('div'); nmEl.className = 'nm'; nmEl.textContent = nm(i);
    const cn = document.createElement('div'); cn.className = 'cn';
    const shown = Math.min(p.count, n <= 2 ? 8 : n > 5 ? 1 : 3);
    for (let j = 0; j < shown; j++) cn.appendChild(backEl('tiny'));
    const num = document.createElement('span'); num.textContent = p.count; cn.appendChild(num);
    let badge = p.done ? '🏁 вийшов' : p.passed ? '✓ пас' : i === v.defender ? (v.taking ? '✋ бере' : '🛡 захист') : i === v.attacker ? '⚔ хід' : '';
    if (api.online && !api.online[i]) badge = '📴 ' + badge;
    const bd = document.createElement('div'); bd.className = 'bd'; bd.textContent = badge;
    box.append(nmEl, cn, bd);
    op.appendChild(box);
  }
  // deck
  const dk = $('deck'); dk.innerHTML = '';
  const tcol = v.trump >= 2 ? '#ff8a80' : '#fff';
  if (v.deck > 0) {
    dk.appendChild(cardEl(v.trumpCard, 'trump'));
    if (v.deck > 1) dk.appendChild(backEl());
  } else {
    const e = document.createElement('div'); e.className = 'empty'; e.textContent = E.SUITS[v.trump]; e.style.color = tcol; dk.appendChild(e);
  }
  $('infoText').innerHTML = `Колода: <b>${v.deck}</b><br>Козир: <b style="color:${tcol}">${E.SUITS[v.trump]}</b> · Бито: <b>${v.out}</b>` +
    `<br><span class="tag">${E.VARIANTS[v.variant] ? E.VARIANTS[v.variant].label.toLowerCase() : ''} · ${E.DECKS[v.deckSize || 36].label}</span>`;
  // table
  const tb = $('table'); tb.innerHTML = '';
  const canTarget = !busy && !v.over && me === v.defender && !v.taking && E.undefended(v) > 1;
  v.table.forEach((p, i) => {
    const slot = document.createElement('div'); slot.className = 'slot';
    const a = cardEl(p.a); popIfNew(a, p.a);
    if (!p.d && canTarget) {
      a.classList.add('tap');
      if (sel === i) a.classList.add('target');
      a.onclick = () => { sel = sel === i ? null : i; draw(); };
    }
    slot.appendChild(a);
    if (p.d) { const d = cardEl(p.d, 'd'); popIfNew(d, p.d); slot.appendChild(d); }
    tb.appendChild(slot);
  });
  // hand
  const hd = $('hand'); hd.innerHTML = '';
  const hand = [...v.hand].sort((a, b) => (a.s === v.trump) - (b.s === v.trump) || a.s - b.s || a.r - b.r);
  const mode = btnMode();
  const active = !!mode || hand.some(playable);
  hand.forEach(c => {
    const el = cardEl(c, active ? (playable(c) ? 'ok' : 'dim') : '');
    el.onclick = () => onCard(c, el);
    hd.appendChild(el);
  });
  const act = $('act');
  act.hidden = !mode;
  act.className = mode === 'take' ? 'take' : '';
  act.textContent = mode === 'take' ? 'Беру' : mode === 'pass' ? 'Пас' : 'Бито';
  $('status').textContent = statusText();
  layoutRow(hd, 6);
}
function layoutRow(row, gap) {
  const cards = [...row.children]; if (!cards.length) return;
  const cs = getComputedStyle(row);
  const W = row.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const cw = cards[0].offsetWidth, n = cards.length;
  const step = n > 1 ? Math.min(cw + gap, (W - cw) / (n - 1)) : 0;
  cards.forEach((c, i) => { c.style.marginLeft = i ? (step - cw) + 'px' : '0'; });
}
window.addEventListener('resize', () => { if (V && $('hand')) draw(); });

export function result(v) {
  V = v;
  const L = v.loser;
  if (L === -1) return { res: 'draw', icon: '🤝', title: 'Нічия', text: 'Останні карти скинули одночасно' };
  if (L === v.seat) return { res: 'lose', icon: '🙃', title: 'Ви — дурень', text: '' };
  return { res: 'win', icon: '🏆', title: v.players.length > 2 ? 'Ви не дурень!' : 'Перемога!', text: v.players.length > 2 ? `Дурень — ${nm(L)}` : '' };
}
