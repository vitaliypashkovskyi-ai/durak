// Шахи: screen — the board from your side, tap a piece then a square; promotion choice; resign.
import * as E from './chess-engine.js';
import { $, haptic, toast, sfx, mark, showPanel, hidePanel } from './common.js';

export const rules = `
<p>Класичні шахи. Кольори розігруються, білі ходять першими.</p>
<p>Є все, як за дошкою: <b>рокіровка</b> (король на дві клітинки до тури), <b>взяття на проході</b>, <b>перетворення пішака</b> на останній горизонталі (ферзь, тура, слон чи кінь).</p>
<p><b>Мат</b> — перемога. <b>Пат</b> (ходити нікуди, але шаху немає) — нічия. Ще нічия: 50 ходів без взяття й руху пішаків, триразовий повтор позиції, або на дошці замало фігур для мату.</p>
<p>Як ходити: торкніться своєї фігури (підсвічено, куди можна), потім клітинки. «🏳 Здатися» — програти достроково.</p>`;

// solid glyphs for both colours (styled by CSS); ︎ keeps them as text, not emoji
const GLYPH = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
const glyph = p => GLYPH[p.toUpperCase()] + '︎';
const WORTH = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

let api, V = null, busy = false, sel = null;

export function mount(box, a) {
  api = a; V = null; busy = false; sel = null;
  box.innerHTML = `
    <div class="ckhead" id="chTop"></div>
    <div class="ckboard chess" id="chBoard"></div>
    <div class="ckhead" id="chMe"></div>
    <div id="status"></div>
    <div class="brow" id="chBtns"></div>`;
}

function nm(i) {
  if (i === V.seat) return 'Ви';
  const p = V.players[i];
  return (p.bot ? '🤖 ' : '') + p.name + mark(i);
}
const myColor = () => (V.seat === V.white ? 'w' : 'b');

export function render(v) {
  V = v; busy = false;
  if (sel != null && !v.moves.some(m => m.from === sel)) sel = null;
  const e = v.ev;
  if (e) {
    if (e.kind === 'capture') sfx('thud'); else if (e.kind === 'move') sfx('card');
    if (e.check && !v.over) { toast(e.seat === v.seat ? 'Шах!' : 'Вам шах!'); if (e.seat !== v.seat) haptic('medium'); }
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
const myTurn = () => V && !V.over && !busy && V.turn === V.seat;

function tap(sq) {
  if (!myTurn()) return;
  const v = V;
  if (sel != null) {
    const ms = v.moves.filter(m => m.from === sel && m.to === sq);
    if (ms.length > 1) return askPromo(ms);
    if (ms.length === 1) { send({ t: 'move', from: sel, to: sq }); sel = null; return; }
  }
  if (v.moves.some(m => m.from === sq)) { sel = sq; draw(); return; }
  if (v.B[sq] !== '.' && (v.B[sq] === v.B[sq].toUpperCase()) === (myColor() === 'w')) toast(v.check ? 'Шах! Треба захистити короля' : 'Ця фігура не може ходити');
  sel = null; draw();
}
function askPromo(ms) {
  const from = sel, to = ms[0].to, white = myColor() === 'w';
  const pick = q => () => { hidePanel(); send({ t: 'move', from, to, promo: q }); sel = null; };
  showPanel({ kind: 'choice', icon: glyph(white ? 'Q' : 'q'), title: 'Перетворення пішака', text: 'На яку фігуру?', buttons: [
    { text: `${glyph('Q')} Ферзь`, fn: pick('q') }, { text: `${glyph('R')} Тура`, sec: true, fn: pick('r') },
    { text: `${glyph('B')} Слон`, sec: true, fn: pick('b') }, { text: `${glyph('N')} Кінь`, sec: true, fn: pick('n') },
    { text: 'Скасувати', sec: true, fn: hidePanel }] });
}
function resign() {
  showPanel({ kind: 'choice', icon: '🏳', title: 'Здатися?', text: 'Партію буде програно.', buttons: [
    { text: 'Так, здаюся', fn: () => { hidePanel(); send({ t: 'resign' }); } }, { text: 'Грати далі', sec: true, fn: hidePanel }] });
}

function capLine(list) {
  const pts = list.reduce((s, p) => s + WORTH[p.toUpperCase()], 0);
  return list.length ? ' · ' + list.map(glyph).join('') + ` (+${pts})` : '';
}

function draw() {
  if (!V) return;
  const v = V, me = v.seat, opp = 1 - me, flip = myColor() === 'b';
  const el = $('chBoard'); el.innerHTML = '';
  const can = myTurn();
  const movable = new Set(can ? v.moves.map(m => m.from) : []);
  const dests = new Set(can && sel != null ? v.moves.filter(m => m.from === sel).map(m => m.to) : []);
  const kingInCheck = v.check ? v.B.indexOf(v.side === 'w' ? 'K' : 'k') : -1;
  for (let i = 0; i < 64; i++) {
    const sq = flip ? 63 - i : i;
    const r = sq >> 3, c = sq & 7, dark = (r + c) % 2 === 1;
    const d = document.createElement('div');
    d.className = 'ck' + (dark ? ' dk' : '') + (v.last && (v.last.from === sq || v.last.to === sq) ? ' lm' : '') +
      (sel === sq ? ' sel' : '') + (dests.has(sq) ? (v.B[sq] !== '.' ? ' hit' : ' dest') : '') + (sq === kingInCheck ? ' chk' : '');
    const p = v.B[sq];
    if (p !== '.') {
      const s = document.createElement('span');
      s.className = 'cp ' + (p === p.toUpperCase() ? 'w' : 'b') + (movable.has(sq) && sel !== sq ? ' mv' : '');
      s.textContent = glyph(p);
      d.appendChild(s);
    }
    // coordinates on the edge
    if ((flip ? c === 7 : c === 0)) { const k = document.createElement('i'); k.className = 'crd r'; k.textContent = 8 - r; d.appendChild(k); }
    if ((flip ? r === 0 : r === 7)) { const k = document.createElement('i'); k.className = 'crd f'; k.textContent = 'abcdefgh'[c]; d.appendChild(k); }
    d.onclick = () => tap(sq);
    el.appendChild(d);
  }
  const col = s => (s === v.white ? '⚪ білі' : '⚫ чорні');
  const capBy = s => v.captured[s === v.white ? 'w' : 'b'];
  $('chTop').textContent = `${nm(opp)} · ${col(opp)}${capLine(capBy(opp))}` + (api.online && !api.online[opp] ? ' 📴' : '');
  $('chMe').textContent = `Ви · ${col(me)}${capLine(capBy(me))}`;
  $('chTop').classList.toggle('on', !v.over && v.turn === opp);
  $('chMe').classList.toggle('on', !v.over && v.turn === me);
  $('status').textContent = v.over ? '' : busy ? '…' : v.turn === me ? (v.check ? 'Вам шах! Захистіть короля' : sel != null ? 'Куди піти?' : `Ваш хід (${v.full}-й)`) : `Думає ${nm(v.turn)}…`;
  const bb = $('chBtns'); bb.innerHTML = '';
  if (!v.over) { const b = document.createElement('button'); b.className = 'sec'; b.textContent = '🏳 Здатися'; b.onclick = resign; bb.appendChild(b); }
}

export function result(v) {
  V = v;
  const WHY = { mate: 'Мат', stalemate: 'Пат', fifty: '50 ходів без взяття', repeat: 'Триразовий повтор', material: 'Замало фігур для мату', resign: 'Суперник здався' };
  if (v.winner === -1) return { res: 'draw', icon: '🤝', title: 'Нічия', text: WHY[v.why] || '' };
  const win = v.winner === v.seat;
  return {
    res: win ? 'win' : 'lose', icon: win ? '🏆' : '♟',
    title: win ? (v.why === 'mate' ? 'Мат! Перемога' : 'Перемога!') : (v.why === 'resign' ? 'Ви здалися' : `Мат… переміг ${nm(v.winner)}`),
    text: v.why === 'resign' && win ? 'Суперник здався' : `${WHY[v.why] || ''} на ${v.full}-му ході`,
  };
}
