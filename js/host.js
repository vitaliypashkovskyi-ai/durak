// Runs one game: applies moves, lets bots play with a human-like pause,
// closes bouts after a short delay and (online) auto-plays for idle players.
// Shared by the page (games with bots) and the server (online rooms).

export class Host {
  constructor(engine, G, { onChange, idleMs = 0 } = {}) {
    this.e = engine; this.G = G; this.onChange = onChange; this.idleMs = idleMs;
    this.t = null; this.stuck = new Set(); this.stopped = false;
  }
  stop() { this.stopped = true; clearTimeout(this.t); clearTimeout(this.ta); }
  changed() {
    if (this.stopped) return;
    this.stuck.clear();
    if (this.onChange) this.onChange();
    this.G.ev = null;
    this.schedule();
  }
  act(seat, m) {
    if (this.stopped) return false;
    const ok = this.e.act(this.G, seat, m);
    if (ok) this.changed();
    return ok;
  }
  schedule() {
    clearTimeout(this.t); clearTimeout(this.ta);
    const G = this.G, e = this.e;
    if (this.stopped || G.over) return;
    if (e.pendingAdvance(G)) {
      // timed games (advanceIn) keep letting bots act until the phase timer fires
      const ms = e.advanceIn ? Math.max(0, e.advanceIn(G)) : e.delay.advance;
      this.ta = setTimeout(() => { e.advance(G); this.changed(); }, ms);
      if (!e.advanceIn) return;
    }
    for (let i = 0; i < G.players.length; i++) {
      if (!G.players[i].bot || this.stuck.has(i)) continue;
      const a = e.botAction(G, i);
      if (!a) continue;
      this.t = setTimeout(() => {
        if (e.act(G, i, a)) this.changed();
        else { this.stuck.add(i); this.schedule(); }
      }, e.delay.bot);
      return;
    }
    // bots that want to act later (e.g. talk in the chat on their own schedule)
    if (e.botWakeIn) {
      const ms = e.botWakeIn(G);
      if (ms != null) { this.t = setTimeout(() => this.schedule(), ms); return; }
    }
    if (this.idleMs) {
      const w = e.waiting(G).filter(i => !G.players[i].bot);
      if (!w.length) return;
      this.t = setTimeout(() => {
        let any = false;
        for (const i of w) { const a = e.botAction(G, i); if (a && e.act(G, i, a)) any = true; }
        if (any) this.changed();
      }, this.idleMs);
    }
  }
}
