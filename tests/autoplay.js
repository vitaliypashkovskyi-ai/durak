// Paste into a browser tab (test only): plays online durak / battle for this tab's player.
(async () => {
  const D = await import('/js/durak-engine.js');
  const B = await import('/js/battle-engine.js');
  let last = null;
  clearInterval(window.__ap);
  window.__apLog = [];
  window.__ap = setInterval(() => {
    try {
      const again = !document.getElementById('ov').hidden && [...document.querySelectorAll('#ovPanel button')].find(b => b.textContent === 'Ще раз' && !b.disabled);
      if (again) { again.click(); return; }
      const v = window.games.view;
      if (!v || v === last || v.over) return;
      const me = v.seat;
      let m = null;
      if (v.game === 'durak') {
        const hand = [...v.hand];
        const u = D.undefended(v);
        if (D.canLead(v, me)) m = { t: 'play', id: hand[0].id };
        else if (me === v.defender && !v.taking && u) {
          const tr = hand.find(c => D.canTransfer(v, me, c));
          const cv = hand.map(c => ({ c, t: D.coverTargets(v, me, c) })).find(x => x.t.length);
          if (tr && Math.random() < 0.5) m = { t: 'transfer', id: tr.id };
          else if (cv) m = { t: 'cover', i: cv.t[0], id: cv.c.id };
          else m = { t: 'take' };
        } else if (D.canPass(v, me)) {
          const add = hand.find(c => D.canAdd(v, me, c));
          m = add && Math.random() < 0.4 ? { t: 'play', id: add.id } : { t: 'pass' };
        }
      } else if (v.game === 'battle') {
        if (v.phase === 'place' && !v.players[me].ready) m = { t: 'ready' };
        else if (v.phase === 'play' && v.turn === me) {
          const t = v.players.findIndex((p, i) => i !== me && p.alive);
          const sh = v.boards[t].shots;
          const free = sh.map((s, i) => (s ? -1 : i)).filter(i => i >= 0);
          m = { t: 'shoot', target: t, cell: free[Math.floor(Math.random() * free.length)] };
        }
      }
      if (m) { last = v; window.games.act(m); }
    } catch (e) { window.__apLog.push(String(e)); }
  }, 120);
  return 'autoplay on';
})();
