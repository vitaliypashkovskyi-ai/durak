// Interface language. Ukrainian is the source; English comes from a dictionary applied to the page:
// every text node and placeholder is looked up (whole line → EN_EXACT, then patterns EN_RULES, then
// small pieces EN_SUBS). A MutationObserver translates whatever the app draws later, so the game code
// keeps writing Ukrainian. Not translated text simply stays Ukrainian.
import { EN_EXACT, EN_RULES, EN_SUBS, EN_TITLES } from './i18n-en.js';

const tg = window.Telegram && window.Telegram.WebApp;
function detect() {
  try { const p = JSON.parse(localStorage.getItem('games.lang')); if (p === 'uk' || p === 'en') return p; } catch (e) {}
  const code = String((tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code) || navigator.language || 'uk').toLowerCase();
  return /^(uk|ru|be)/.test(code) ? 'uk' : 'en';
}
export const LANG = detect();
export const setLang = l => { try { localStorage.setItem('games.lang', JSON.stringify(l)); } catch (e) {} location.reload(); };
export const isEN = LANG === 'en';

const x = s => (EN_EXACT[s] != null ? EN_EXACT[s] : s);
export function tr(s) {
  if (!isEN || !s || !/[А-Яа-яІіЇїЄєҐґ]/.test(s)) return s;
  return s.split('\n').map(line => {
    const lead = line.match(/^\s*/)[0], tail = line.match(/\s*$/)[0], k = line.trim();
    if (!k) return line;
    if (EN_EXACT[k] != null) return lead + EN_EXACT[k] + tail;
    for (const [re, rep] of EN_RULES) {
      const m = k.match(re);
      if (m) return lead + (typeof rep === 'function' ? rep(x, ...m.slice(1)) : k.replace(re, rep)) + tail;
    }
    let out = k;
    for (const [a, b] of EN_SUBS) if (out.includes(a)) out = out.split(a).join(b);
    return lead + out + tail;
  }).join('\n');
}
export const titleOf = (id, uk) => (isEN && EN_TITLES[id] ? EN_TITLES[id] : uk);

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT']);
function walk(node) {
  if (node.nodeType === 3) {
    const p = node.parentNode;
    if (p && SKIP.has(p.nodeName)) return;
    const t = tr(node.nodeValue);
    if (t !== node.nodeValue) node.nodeValue = t;
    return;
  }
  if (node.nodeType !== 1 || node.nodeName === 'SCRIPT' || node.nodeName === 'STYLE') return;
  for (const a of ['placeholder', 'title', 'aria-label']) {
    const v = node.getAttribute && node.getAttribute(a);
    if (v) { const t = tr(v); if (t !== v) node.setAttribute(a, t); }
  }
  if (SKIP.has(node.nodeName)) return;                 // never touch what the player types
  for (const c of node.childNodes) walk(c);
}
export function startTranslating() {
  if (!isEN) return;
  document.documentElement.lang = 'en';
  walk(document.body);
  new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === 'characterData') walk(m.target);
      else m.addedNodes.forEach(walk);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
