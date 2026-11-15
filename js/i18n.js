// Interface language. Ukrainian is the source; English comes from a dictionary applied to the page:
// every text node and placeholder is looked up (whole line → EN_EXACT, then patterns EN_RULES, then
// small pieces EN_SUBS). A MutationObserver translates whatever the app draws later, so the game code
// keeps writing Ukrainian. Not translated text simply stays Ukrainian.
import { EN_EXACT, EN_RULES, EN_SUBS, EN_TITLES } from './i18n-en.js';
import { RULES_HTML } from './i18n-en-games.js';
import { RULES2_HTML } from './i18n-en-games2.js';

const tg = window.Telegram && window.Telegram.WebApp;
function detect() {
  try { const p = JSON.parse(localStorage.getItem('games.lang')); if (p === 'uk' || p === 'en') return p; } catch (e) {}
  const code = String((tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code) || navigator.language || 'uk').toLowerCase();
  return /^(uk|ru|be)/.test(code) ? 'uk' : 'en';
}
export const LANG = detect();
export const setLang = l => { try { localStorage.setItem('games.lang', JSON.stringify(l)); } catch (e) {} location.reload(); };
export const isEN = LANG === 'en';

// one piece: whole line, then patterns (a pattern may return null = "not mine, go on")
function one(k) {
  if (EN_EXACT[k] != null) return EN_EXACT[k];
  for (const [re, rep] of EN_RULES) {
    const m = k.match(re);
    if (!m || m.slice(1).some(g => g && g.includes(' · '))) continue;   // glued pieces are split below
    const out = typeof rep === 'function' ? rep(x, ...m.slice(1)) : k.replace(re, rep);
    if (out != null) return out;
  }
  return null;
}
const x = s => { const t = one(s); return t == null ? subs(s) : t; };
const subs = s => {
  for (const [a, b] of EN_SUBS) {
    if (a instanceof RegExp) s = s.replace(a, b);
    else if (s.includes(a)) s = s.split(a).join(b);
  }
  return s;
};
export function tr(s) {
  if (!isEN || !s || !/[А-Яа-яІіЇїЄєҐґ]/.test(s)) return s;
  return s.split('\n').map(line => {
    const lead = line.match(/^\s*/)[0], tail = line.match(/\s*$/)[0], k = line.trim();
    if (!k) return line;
    let t = one(k);
    // a line glued from pieces «a · b · c»: translate each piece on its own
    if (t == null && k.includes(' · ')) t = k.split(' · ').map(p => { const q = one(p); return q == null ? subs(p) : q; }).join(' · ');
    return lead + subs(t == null ? k : t) + tail;               // subs also catch names left inside a pattern
  }).join('\n');
}
export const rulesOf = (id, uk) => (isEN && (RULES_HTML[id] || RULES2_HTML[id])) || uk;
export const titleOf = (id, uk) => (isEN && EN_TITLES[id] ? EN_TITLES[id] : uk);

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT']);
function walk(node) {
  if (node.nodeType === 3) {
    const p = node.parentNode;
    if (p && (SKIP.has(p.nodeName) || p.classList && p.classList.contains('notr'))) return;
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
      else if (m.type === 'attributes') { const v = m.target.getAttribute(m.attributeName); const t = v && tr(v); if (t && t !== v) m.target.setAttribute(m.attributeName, t); }
      else m.addedNodes.forEach(walk);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
}
