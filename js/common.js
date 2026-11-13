// Shared page helpers: Telegram, haptics, toast, the modal panel.
export const tg = (window.Telegram && window.Telegram.WebApp) || null;
export const inTelegram = !!(tg && tg.initData);
export const $ = id => document.getElementById(id);

export function haptic(kind) {
  try {
    if (!tg || !tg.HapticFeedback) return;
    if (kind === 'error' || kind === 'success') tg.HapticFeedback.notificationOccurred(kind);
    else tg.HapticFeedback.impactOccurred(kind || 'light');
  } catch (e) {}
}

let toastT;
export function toast(text) {
  if (!text) return;
  const el = $('toast');
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), 1300);
}

// ---------- sounds (synthesized, no files) ----------
let actx = null;
function audio() {
  if (!actx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; actx = new A(); }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
document.addEventListener('pointerdown', () => { if (sound.on) audio(); }, { once: true });
export const sound = { on: (() => { try { return localStorage.getItem('games.sound') !== '0'; } catch (e) { return true; } })() };
export function setSound(on) { sound.on = on; try { localStorage.setItem('games.sound', on ? '1' : '0'); } catch (e) {} }
function tone(freq, dur, type = 'sine', vol = 0.15, slide = 0, delay = 0) {
  const c = audio(); if (!c) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.2, freq = 1500, delay = 0) {
  const c = audio(); if (!c) return;
  const t = c.currentTime + delay, len = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol;
  s.connect(f).connect(g).connect(c.destination); s.start(t);
}
export function sfx(name) {
  if (!sound.on) return;
  try {
    if (name === 'card') noise(0.06, 0.35, 2500);
    else if (name === 'swish') noise(0.25, 0.25, 800);
    else if (name === 'thud') tone(110, 0.18, 'sine', 0.25, 0.6);
    else if (name === 'splash') noise(0.35, 0.25, 600);
    else if (name === 'boom') { noise(0.4, 0.5, 200); tone(80, 0.35, 'sine', 0.3, 0.5); }
    else if (name === 'bell') { tone(880, 0.5, 'sine', 0.12); tone(1320, 0.5, 'sine', 0.06, 0, 0.05); }
    else if (name === 'chime') { tone(660, 0.15, 'triangle', 0.12); tone(990, 0.25, 'triangle', 0.12, 0, 0.12); }
    else if (name === 'pop') tone(500, 0.08, 'sine', 0.12, 1.8);
    else if (name === 'win') [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.13, 0, i * 0.12));
    else if (name === 'lose') [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, 0, i * 0.15));
  } catch (e) {}
}

// ---------- level marks next to names (shown to everyone at the table) ----------
// level index from the server: 0 Новачок, 1 Аматор, 2 Гравець, 3 Досвідчений, 4 Майстер, 5 Легенда
export const LVL_MARK = ['', '', '', '⭐', '🏅', '👑'];
export const levels = { list: null };   // set by the app for online games
export const mark = i => { const l = levels.list && levels.list[i]; return l && LVL_MARK[l] ? ' ' + LVL_MARK[l] : ''; };

let kind = null;
export const panelKind = () => ($('ov').hidden ? null : kind);
// showPanel({kind, icon, title, text, code, body, buttons:[{text, fn, sec, disabled}]})
export function showPanel(o) {
  kind = o.kind || null;
  const p = $('ovPanel');
  p.innerHTML = '';
  const add = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; p.appendChild(e); return e; };
  if (o.icon) add('div', 'big', o.icon);
  if (o.title) add('h2', '', o.title);
  if (o.text) add('p', 'muted', o.text);
  if (o.code) add('div', 'code', o.code);
  if (o.body) p.appendChild(o.body);
  const box = add('div', 'btns');
  (o.buttons || []).forEach(b => {
    const e = document.createElement('button');
    e.textContent = b.text;
    if (b.sec) e.className = 'sec';
    e.disabled = !!b.disabled;
    e.onclick = b.fn;
    box.appendChild(e);
  });
  $('ov').hidden = false;
  return p;
}
export function hidePanel() { $('ov').hidden = true; kind = null; }
