// Bot difficulty, shared by the page and the server. cfg.level: 'easy' | 'normal' | 'hard'.
// Easy bots sometimes make a random (legal) move; hard is stronger only where the bot can think further
// (checkers, nardy, dice) — elsewhere it plays like normal.
export const LEVELS = { easy: 'Легкий', normal: 'Звичайний', hard: 'Сильний' };
export const HARD_GAMES = ['checkers', 'nardy', 'dice', 'chess', 'quiz'];
export const NO_LEVEL = ['mafia', 'spy', 'klondike'];          // social games: bots talk and vote, no «strength»
export const levelOf = cfg => (cfg && (cfg.level === 'easy' || cfg.level === 'hard') ? cfg.level : 'normal');
// an easy bot's slip: true with probability p (default 35 %)
export const slip = (G, p = 0.35) => G && G.level === 'easy' && Math.random() < p;
export const pickAny = a => a[Math.floor(Math.random() * a.length)];
