// Козел: screen — partner opposite, team score, the trick, deal results.
import * as E from './goat-engine.js';
import { $, haptic, toast, sfx } from './common.js';

export const rules = `
<p>4 гравці, дві пари: ваш <b>партнер</b> сидить навпроти. 36 карт, по 9 у руці.</p>
<p><b>Козирі:</b> усі вальти — найстарші (♣ > ♠ > ♥ > ♦), далі вся масть ♣ треф (туз, 10, король, дама, 9…6). У звичайних мастях: туз, 10, король, дама, 9, 8, 7, 6.</p>
<p><b>Хід:</b> масть треба підтримати (валет вважається трефою-козирем). Немає масті — кладіть будь-яку карту.</p>
<p><b>Очки:</b> туз 11, 10 — 10, король 4, дама 3, валет 2. У колоді 120.</p>
<p><b>Роздача:</b> пара з 61+ очок отримує +2; якщо суперники набрали менше 31 — +4; якщо не взяли жодної взятки — +6. 60:60 — «яйця»: наступна роздача рахується вдвічі.</p>
<p>Гра до <b>12</b>. Хто програв — ті «козли» 🐐.</p>`;

let api, V = null, busy = false, lastNum = null;

export function mount(box, a) {
  api = a; V = null; busy = false; lastNum = null;
  box.innerHTML = `
    <div class="opps" id="gOpps"></div>
    <div class="tscore" id="gScore"></div>
    <div class="tmain" id="gCenter"></div>
    <div id="status"></div>
    <div id="hand"></div>`;
}

function nm(i) {
  if (i === V.seat) return 'Ви';
  const p = V.players[i];
  return (p.bot ? '🤖 ' : '') + p.name;
}
const myTeam = () => E.team(V.seat);

export function render(v) {
  const fresh = v.num !== lastNum;
  if (V && !fresh && v.trick.length > V.trick.length) sfx('card');
  V = v; busy = false;
  if (fresh) lastNum = v.num;
  if (v.ev) evToast(v.ev);
  draw();
}
function evToast(e) {
  if (e.kind === 'trick') {
    sfx('swish');
    if (e.pts >= 20) toast(`${nm(e.who)}: +${e.pts} ${E.team(e.who) === myTeam() ? '👍' : ''}`);
  }
  if (e.kind === 'deal') {
    const r = V.result;
    if (r.eggs) toast('🥚 Яйця 60:60 — наступна роздача вдвічі!');
    else toast(r.team === myTeam() ? `Ми беремо +${r.gain}! 🎉` : `Суперники +${r.gain}`);
  }
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
  d.className = 'card' + (c.s >= 2 ? ' red' : '') + (E.isTrump(c) ? ' tr' : '') + (extra ? ' ' + extra : '');
  d.innerHTML = `<span class="c">${E.LABELS[c.r]}<i>${E.SUITS[c.s]}</i></span><span class="m">${E.SUITS[c.s]}</span>`;
  return d;
}
function backEl() { const d = document.createElement('div'); d.className = 'card back tiny'; return d; }

function draw() {
  if (!V) return;
  const v = V, me = v.seat;
  // left opponent, partner, right opponent
  const op = $('gOpps'); op.innerHTML = '';
  for (const k of [1, 2, 3]) {
    const i = (me + k) % 4, p = v.players[i];
    const box = document.createElement('div');
    box.className = 'opp' + (!v.over && v.turn === i && !v.waitUntil ? ' att' : '') + (k === 2 ? ' partner' : '');
    const n = document.createElement('div'); n.className = 'nm'; n.textContent = nm(i);
    const cn = document.createElement('div'); cn.className = 'cn';
    for (let j = 0; j < Math.min(p.count, 3); j++) cn.appendChild(backEl());
    const num = document.createElement('span'); num.textContent = p.count; cn.appendChild(num);
    const bd = document.createElement('div'); bd.className = 'bd';
    bd.textContent = (k === 2 ? '🤝 партнер' : 'суперник') + (i === v.dealer ? ' · 🃏' : '') + (api.online && !api.online[i] ? ' 📴' : '');
    box.append(n, cn, bd);
    op.appendChild(box);
  }
  const t = myTeam();
  $('gScore').innerHTML = '';
  const sc = document.createElement('div');
  sc.className = 'gsc';
  sc.textContent = `Ми ${v.score[t]} : ${v.score[1 - t]} Вони · до ${E.GOAL}`;
  const sub = document.createElement('div');
  sub.className = 'tinfo small';
  sub.textContent = `Роздача ${v.deal} · Козирі: усі вальти й ♣` + (v.eggs ? ` · 🥚×${v.eggs + 1}` : '') +
    (v.phase === 'play' ? ` · взятки: ми ${v.tricks[t]}, вони ${v.tricks[1 - t]}` : '');
  $('gScore').append(sc, sub);
  // center
  const c = $('gCenter'); c.innerHTML = '';
  if (v.phase === 'play') {
    const row = document.createElement('div'); row.className = 'trow trick';
    v.trick.forEach(x => {
      const w = document.createElement('div'); w.className = 'tslot' + (E.team(x.seat) === t ? ' ours' : '');
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
    tbl.innerHTML = '<tr><th></th><th>Очки</th><th>Взятки</th><th>+</th></tr>';
    [[t, 'Ми'], [1 - t, 'Вони']].forEach(([tm, label]) => {
      const tr = document.createElement('tr');
      [label, r.taken[tm], r.tricks[tm], r.team === tm ? `+${r.gain}` : r.eggs ? '🥚' : '—'].forEach(x => {
        const td = document.createElement('td'); td.textContent = x; tr.appendChild(td);
      });
      tbl.appendChild(tr);
    });
    c.appendChild(tbl);
  }
  // hand: plain suits first, trumps (♣ and jacks) last, strongest to the right
  const hd = $('hand'); hd.innerHTML = '';
  const hand = [...v.hand].sort((a, b) => (E.isTrump(a) - E.isTrump(b)) || (E.isTrump(a) ? 0 : a.s - b.s) || E.strength(a) - E.strength(b));
  const canPlay = !busy && !v.over && v.phase === 'play' && v.turn === me && !v.waitUntil;
  hand.forEach(card => {
    const ok = canPlay && E.legal(v, me, card);
    const el = cardEl(card, canPlay ? (ok ? 'ok' : 'dim') : '');
    el.onclick = () => { if (ok) send({ t: 'play', id: card.id }); };
    hd.appendChild(el);
  });
  $('status').textContent = v.over ? '' : busy ? '…' : v.phase === 'score' ? 'Підсумки роздачі. Скоро нова…' :
    v.waitUntil ? '…' : v.turn === me ? (v.trick.length ? 'Ваш хід — підтримайте масть' : 'Ваш хід') :
    v.turn === (me + 2) % 4 ? 'Ходить ваш партнер…' : `Ходить ${nm(v.turn)}…`;
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
  const t = E.team(v.seat), win = v.winner === t;
  return {
    res: win ? 'win' : 'lose',
    icon: win ? '🏆' : '🐐',
    title: win ? 'Перемога! Козли — суперники' : 'Ви — козли 🐐',
    text: `Рахунок: ми ${v.score[t]} — вони ${v.score[1 - t]}`,
  };
}
