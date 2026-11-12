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
