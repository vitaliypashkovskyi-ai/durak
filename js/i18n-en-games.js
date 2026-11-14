// English, stage 2: screens of the international games (Durak, Battleship, Dice Poker, Chess, Checkers,
// Long Backgammon, Backgammon, Klondike, Spider, Minesweeper) and their rules.
const who = s => (s === 'Ви' ? 'You' : s === 'вас' ? 'you' : s);   // nm() says «Ви»/«вас» for yourself
const DICE_CAT = {
  'Одиниці': 'Ones', 'Двійки': 'Twos', 'Трійки': 'Threes', 'Четвірки': 'Fours', "П'ятірки": 'Fives', 'Шістки': 'Sixes',
  'Трійка': 'Three of a kind', 'Каре': 'Four of a kind', 'Фул-хаус': 'Full house', 'Мала стріт': 'Small straight', 'Велика стріт': 'Large straight',
  'Покер': 'Poker', 'Шанс': 'Chance',
};

export const GAME_EXACT = {
  ...DICE_CAT,
  'сума одиниць': 'sum of ones', 'сума двійок': 'sum of twos', 'сума трійок': 'sum of threes', 'сума четвірок': 'sum of fours',
  "сума п'ятірок": 'sum of fives', 'сума шісток': 'sum of sixes', '3 однакові — сума всіх': '3 alike — sum of all', '4 однакові — сума всіх': '4 alike — sum of all',
  '3 + 2 однакові — 25': '3 + 2 alike — 25', '4 поспіль — 30': '4 in a row — 30', '5 поспіль — 40': '5 in a row — 40', '5 однакових — 50': '5 alike — 50', 'сума всіх': 'sum of all',
  // shared
  'Якщо почати нову, вона пропаде.': 'If you start a new one, it will be lost.',
  'Ви': 'You', 'Перемога!': 'Victory!', 'Поразка': 'Defeat', 'Нічия': 'Draw', 'Куди піти?': 'Where to?', 'Куди піти? (підсвічено)': 'Where to? (highlighted)',
  'Здатися?': 'Resign?', '🏳 Здатися': '🏳 Resign', 'Так, здаюся': 'Yes, I resign', '💡 Підказка': '💡 Hint', 'Натисніть «Готово»': 'Press «Done»',
  '⚪ білі': '⚪ white', '⚫ чорні': '⚫ black', 'Ваш хід — оберіть шашку': 'Your move — pick a checker', 'Ходів немає — хід переходить…': 'No moves — the turn passes…',
  // durak
  'Ви ходите першим': 'You go first', 'Бито': 'Done', 'Ви взяли карти': 'You took the cards', 'Ви вийшли без карт': 'You are out of cards',
  'Що зробити?': 'What to do?', '🛡 Побити': '🛡 Beat', '↪ Перевести': '↪ Transfer', 'Ви вийшли без карт 🎉 Чекаємо кінця гри…': 'You are out 🎉 Waiting for the game to end…',
  'Ваш хід — киньте карту': 'Your turn — play a card', 'Ви берете. Інші підкидають…': 'You are taking. Others may throw in…',
  'Бийте, переводьте або беріть': 'Beat, transfer or take', 'Бийте (торкніться карти на столі, щоб вибрати ціль) або беріть': 'Beat (tap a card on the table to pick the target) or take',
  'Бийте або беріть': 'Beat or take', 'Чекаємо, чи підкинуть ще…': 'Waiting to see if more cards come…', 'Відбито. Підкиньте або «Бито»': 'Beaten. Throw in or «Done»',
  'Відбито. Натисніть «Бито»': 'Beaten. Press «Done»', '🏁 вийшов': '🏁 out', '✓ пас': '✓ pass', '✋ бере': '✋ taking', '🛡 захист': '🛡 defending', '⚔ хід': '⚔ attacking',
  'Колода:': 'Deck:', 'Козир:': 'Trump:', '· Бито:': '· Discarded:', 'Беру': 'Take', 'Пас': 'Pass', 'Останні карти скинули одночасно': 'The last cards went out at the same time',
  'Ви — дурень': 'You are the durak (the fool)', 'Ви не дурень!': 'You are not the durak!', 'підкидний': 'throw-in', 'переводний': 'transfer', 'підкидний + переводний': 'throw-in + transfer',
  '36 карт': '36 cards', '52 карти': '52 cards',
  // battleship
  'До бою! Ви стріляєте першим': 'Battle! You shoot first', 'Ваш флот потоплено 💀': 'Your fleet is sunk 💀', 'Мимо': 'Miss', 'Влучили! Стріляйте ще': 'Hit! Shoot again',
  'Потопили! Стріляйте ще': 'Sunk! Shoot again', 'Ваш флот': 'Your fleet', '🔀 Перемішати': '🔀 Shuffle', '✍️ Розставити самому': '✍️ Place them myself', '✅ Готово': '✅ Done',
  'Розставте флот і натисніть «Готово»': 'Place your fleet and press «Done»', 'Ваш флот потоплено. Можна дивитися бій далі…': 'Your fleet is sunk. You can keep watching…',
  'Ваш постріл — торкніться клітинки': 'Your shot — tap a cell', 'Флот розставлено!': 'Fleet placed!', 'Сюди не стане — кораблі не торкаються навіть кутами': 'It will not fit — ships may not touch, even at corners',
  '↕ Повернути': '↕ Rotate', '↔ Повернути': '↔ Rotate', '🔀 Випадково': '🔀 Random', 'Щось не так з розстановкою': 'Something is wrong with the layout', 'Ваш флот — останній на плаву': 'Your fleet is the last one afloat',
  // dice
  'ПОКЕР! +50 🎉': 'POKER! +50 🎉', '🎲 Кинути кубики': '🎲 Roll the dice', 'Разом': 'Total', 'Ваш хід — киньте кубики': 'Your turn — roll the dice',
  'Відкладіть кубики (торкніться) і перекиньте — або запишіть у таблицю': 'Keep dice (tap them) and reroll — or score in the table', 'Запишіть результат у таблицю': 'Score the result in the table',
  'Нічия на першому місці': 'Tie for first place',
  // chess
  'Шах!': 'Check!', 'Вам шах!': 'You are in check!', 'Шах! Треба захистити короля': 'Check! Protect your king', 'Ця фігура не може ходити': 'This piece cannot move',
  'Перетворення пішака': 'Pawn promotion', 'На яку фігуру?': 'Into which piece?', 'Партію буде програно.': 'You will lose the game.', 'Вам шах! Захистіть короля': 'Check! Protect your king',
  'Мат': 'Checkmate', 'Пат': 'Stalemate', '50 ходів без взяття': '50 moves without a capture', 'Триразовий повтор': 'Threefold repetition', 'Замало фігур для мату': 'Not enough pieces to mate',
  'Суперник здався': 'The opponent resigned', 'Мат! Перемога': 'Checkmate! Victory', 'Ви здалися': 'You resigned',
  // checkers
  'Треба бити!': 'You must capture!', 'Ця шашка не може ходити': 'This piece cannot move', 'Бийте далі!': 'Keep capturing!', 'Ваш хід — треба бити': 'Your move — you must capture',
  'Ніхто не зміг перемогти': 'Nobody could win',
  // backgammon (both)
  'ваша голова': 'your head (start)', '⬆ Викинути': '⬆ Bear off', '⬇ Викинути': '⬇ Bear off', 'ваш кидок': 'your roll', 'Ви ⚪': 'You ⚪', 'Перемога з марсом! 🔥': 'Victory with a mars (gammon)! 🔥',
  'Вашу шашку побили — на бар!': 'Your checker was hit — to the bar!', 'Побили! 💥': 'Hit! 💥', 'Спершу введіть шашку з бару': 'Enter your checker from the bar first',
  'Введіть шашку з бару (торкніться бару)': 'Enter a checker from the bar (tap the bar)',
  // solitaires, minesweeper
  'Ходів немає — почніть нову роздачу': 'No moves — start a new deal', 'Відкрийте карту з колоди': 'Draw a card from the stock', 'Ця карта може піти далі': 'This card can move',
  'Цю роздачу буде зараховано як програну.': 'This deal will count as lost.', 'Пасьянс зійшовся!': 'Solved!', 'Не зійшовся': 'Not solved',
  'Ряд зібрано! ✨': 'Row complete! ✨', 'Разом переносяться лише карти однієї масті за порядком': 'Only a same-suit sequence moves together', "зібрані ряди з'являться тут": 'completed rows appear here',
  'колода порожня': 'stock is empty', 'Спершу заповніть порожні стовпчики': 'Fill the empty columns first', 'Ходів немає — почніть нову гру': 'No moves — start a new game',
  'Роздайте карти з колоди': 'Deal from the stock', 'Гру буде зараховано як програну.': 'The game will count as lost.', 'Павук зібраний!': 'Spider solved!',
  'Тут прапорець — зніміть його, щоб відкрити': 'There is a flag — remove it to open the cell', '🚩 Ставлю прапорці': '🚩 Placing flags', '👆 Відкриваю клітинки': '👆 Opening cells',
  'Поле розміновано!': 'Field cleared!', 'Бум! Міна': 'Boom! A mine', 'Середній': 'Medium', 'Складний': 'Hard',
};

export const GAME_RULES = [
  [/^(.+): правила$/, (x, g) => `${x(g)}: rules`],
  [/^💡 (.+)$/, (x, t) => '💡 ' + x(t)],
  // durak
  [/^Першим ходить (.+)$/, (x, n) => `${who(n)} goes first`],
  [/^(.+) переводить на (.+)$/, (x, a, b) => `${who(a)} transfers to ${who(b)}`],
  [/^(.+) вийшов — замість нього бот$/, '$1 left — a bot took the seat'],
  [/^(.+) без карт$/, (x, n) => `${who(n)} is out of cards`],
  [/^(.+) ходить на (.+)$/, (x, a, b) => `${who(a)} attacks ${who(b)}`],
  [/^(.+) бере\. Підкиньте або «Пас»$/, '$1 takes. Throw in or «Pass»'],
  [/^(.+) бере\. Натисніть «Пас»$/, '$1 takes. Press «Pass»'],
  [/^(.+) бере$/, '$1 takes'],
  [/^(.+) відбивається…$/, '$1 is defending…'],
  [/^Дурень — (.+)$/, 'The durak: $1'],
  // battleship
  [/^До бою! Першим стріляє (.+)$/, 'Battle! $1 shoots first'],
  [/^(.+) без флоту 💀$/, '$1 has no fleet left 💀'],
  [/^(.+) потопив ваш корабель$/, '$1 sank your ship'],
  [/^(.+) влучив у вас$/, '$1 hit you'],
  [/^Чекаємо інших гравців \((\d+)\)…$/, 'Waiting for other players ($1)…'],
  [/^Поле суперника: (.+)$/, "Opponent's field: $1"],
  [/^Ваше поле (.*)$/, 'Your field $1'],
  [/^Стріляє (.+)…$/, '$1 is shooting…'],
  [/^Поставте (\d)-палубний \((горизонтально|вертикально) (.)\)$/, (x, n, d, a) => `Place the ${n}-cell ship (${d === 'горизонтально' ? 'horizontal' : 'vertical'} ${a})`],
  [/^Лишилось: ([\d, ]+) · торкніться клітинки \(корабель іде від неї (праворуч|вниз)\); торкніться корабля — прибрати$/,
    (x, l, d) => `Left: ${l} · tap a cell (the ship goes ${d === 'праворуч' ? 'right' : 'down'} from it); tap a ship to remove it`],
  [/^Переміг (.+)$/, (x, n) => `${n} won`],
  // dice
  [/^(.+): (\S+(?: \S+)?) — (\d+)$/, (x, n, c, p) => (DICE_CAT[c] ? `${n}: ${DICE_CAT[c]} — ${p}` : null)],
  [/^Раунд (\d+)\/(\d+)$/, 'Round $1/$2'],
  [/^кидає (.+)$/, 'rolling: $1'],
  [/^🎲 Перекинути \((\d)\)$/, '🎲 Reroll ($1)'],
  [/^Бонус \((\d+)\+\)$/, 'Bonus ($1+)'],
  [/^Кидає (.+)…$/, '$1 is rolling…'],
  // chess
  [/^(\S+) (Ферзь|Тура|Слон|Кінь)$/, (x, g, p) => `${g} ${{ 'Ферзь': 'Queen', 'Тура': 'Rook', 'Слон': 'Bishop', 'Кінь': 'Knight' }[p]}`],
  [/^Ваш хід \((\d+)-й\)$/, 'Your move ($1)'],
  [/^Думає (.+)…$/, '$1 is thinking…'],
  [/^Мат… переміг (.+)$/, 'Checkmate… $1 won'],
  [/^(.*) на (\d+)-му ході$/, (x, w, n) => `${x(w)} on move ${n}`],
  // checkers
  [/^шашок: (\d+)(.*)$/, 'pieces: $1$2'],
  [/^Ходить (.+)…$/, '$1 is moving…'],
  [/^Шашок лишилось: ви (\d+), суперник (\d+)$/, 'Pieces left: you $1, opponent $2'],
  // backgammon
  [/^(\d-\d): ходів немає 😕$/, '$1: no moves 😕'],
  [/^(.+): (\d-\d), ходів немає$/, '$1: $2, no moves'],
  [/^викинуто: (\d+)\/15$/, 'borne off: $1/15'],
  [/^викинуто (\d+)\/15$/, 'off $1/15'],
  [/^залишилось (\d+)( 📴)?$/, 'pips $1$2'],
  [/^кидок: (.+)$/, 'roll: $1'],
  [/^бар: ви (\d+) · суперник (\d+)$/, 'bar: you $1 · opponent $2'],
  [/^Марс… переміг (.+)$/, 'Mars (gammon)… $1 won'],
  [/^Кокс… переміг (.+)$/, 'Koks (backgammon)… $1 won'],
  [/^Перемога — (марс|кокс)! 🔥$/, (x, h) => `Victory — ${h === 'марс' ? 'mars (gammon)' : 'koks (backgammon)'}! 🔥`],
  [/^Викинуто: ви (\d+)\/15, суперник (\d+)\/15$/, 'Borne off: you $1/15, opponent $2/15'],
  [/^у колоді (\d+)$/, 'deck $1'], [/^роздача (\d+(?:\/\d+)?)$/, 'deal $1'], [/^(ніч|день) (\d+)$/, (x, p, n) => `${p === 'ніч' ? 'night' : 'day'} ${n}`],
  // solitaires, minesweeper
  [/^ходів (\d+)$/, 'moves $1'],
  [/^по ([13])$/, 'draw $1'],
  [/^у домах (\d+)\/52$/, 'home $1/52'],
  [/^рекорд (.+)$/, (x, t) => `best ${t.replace(/ с$/, ' s')}`],
  [/^(\d+) ходів$/, '$1 moves'],
  [/^У домах (\d+) з 52 карт\. Спробуйте ще!$/, '$1 of 52 cards home. Try again!'],
  [/^зібрано (\d)\/8$/, 'done $1/8'],
  [/^🂠 Роздати \((\d+)\)$/, '🂠 Deal ($1)'],
  [/^Зібрано рядів: (\d) з 8\. Спробуйте ще!$/, 'Rows done: $1 of 8. Try again!'],
  [/^⏱ (\d+) с$/, '⏱ $1 s'],
  [/^(\d+) с$/, '$1 s'],
  [/^(\d+) с\. Спробуйте ще!$/, '$1 s. Try again!'],
  [/^Новий рекорд: (.+)! 🏆$/, (x, t) => `New record: ${t.replace(/ с$/, ' s')}! 🏆`],
];

export const RULES_HTML = {
  durak: `
<p>A 36-card deck (up to 6 players), 52 (up to 8) or two 36-card decks (up to 12); 6 cards each. The trump is the bottom card of the deck; any trump beats any non-trump card.</p>
<p><b>Attack:</b> the first player plays any card at the player on the left.</p>
<p><b>Defence:</b> beat it with a higher card of the same suit or with a trump. Can't — press «Take».</p>
<p><b>Three variants:</b></p>
<p>• <b>Throw-in</b> — everyone except the defender may add cards of the ranks already on the table (up to 6 cards, 5 in the first round, and never more than the defender holds). No transfers.</p>
<p>• <b>Transfer</b> — no throwing in, but while no card is beaten yet, the defender may play a card of the same rank and pass the attack on to the next player.</p>
<p>• <b>Throw-in + transfer</b> — both are allowed.</p>
<p>Beat everything — «Done», and the defender attacks next. Took the cards — the next player after them attacks. Whoever runs out of cards after the deck is empty is out. The last one holding cards is the durak (the fool).</p>
<p class="muted">Tip: tap a card on the table to choose which one to beat.</p>`,
  battle: `
<p>A 10×10 field. The fleet: one 4-cell ship, two 3-cell, three 2-cell and four 1-cell ships. Ships may not touch, even at corners.</p>
<p>First place your fleet: «Shuffle» gives a new layout (or place the ships yourself), «Done» confirms it.</p>
<p>Players shoot in turns. A hit — shoot again. With more than two players, choose at the top whose field to shoot at.</p>
<p>Whoever loses the whole fleet is out. The last one afloat wins.</p>`,
  dice: `
<p>2–6 players, 5 dice, 13 rounds. On your turn you may roll up to <b>3 times</b>: after a roll tap the dice you want to keep and reroll the rest.</p>
<p>Then score the result in one free cell of the table — even if it is 0.</p>
<p><b>Upper part:</b> ones…sixes — the sum of those faces. Score 63+ in the upper part — bonus <b>+35</b>.</p>
<p><b>Lower part:</b> three and four of a kind — the sum of all dice; full house (3+2) — 25; small straight (4 in a row) — 30; large straight (5 in a row) — 40; <b>poker</b> (5 alike) — 50; chance — the sum of all.</p>
<p>After 13 rounds the highest total wins.</p>`,
  chess: `
<p>Classic chess. Colours are drawn at random, white moves first.</p>
<p>Everything as over the board: <b>castling</b> (the king moves two squares towards the rook), <b>en passant</b>, <b>pawn promotion</b> on the last rank (queen, rook, bishop or knight).</p>
<p><b>Checkmate</b> wins. <b>Stalemate</b> (no legal move, but no check) is a draw. Also a draw: 50 moves without a capture or a pawn move, threefold repetition, or too few pieces to mate.</p>
<p>How to move: tap your piece (the possible squares light up), then a square. «🏳 Resign» — lose early.</p>`,
  checkers: `
<p>An 8×8 board, 12 pieces each on the dark squares. White moves first.</p>
<p><b>A man</b> moves diagonally forward one square. It captures by jumping over an opponent's piece — forwards and backwards.</p>
<p><b>Capturing is compulsory.</b> If after a capture you can capture again, keep going with the same piece. Captured pieces are removed after the move; you can't jump the same piece twice.</p>
<p><b>A king</b> is a piece that reached the last row (if during a capture, it continues as a king). It moves and captures any distance diagonally.</p>
<p>You lose if you can't move or have no pieces left. A draw — 30 moves in a row with kings only and no captures.</p>
<p>How to move: tap your piece, then the square to go to.</p>`,
  nardy: `
<p>2 players, 15 checkers each. All start on the <b>head</b> and go round anticlockwise: yours go along the bottom from right to left, then along the top from left to right to your <b>home</b> (the top right 6 points). The opponent goes the same way from the opposite side.</p>
<p><b>No hitting:</b> you may not land on a point taken by an opponent's checker.</p>
<p>The dice roll by themselves. Each die is a separate move of that many points. <b>A double</b> gives four moves. Play as many dice as possible; if only one can be played — the bigger one.</p>
<p>Only <b>one</b> checker may leave the head per turn (two on a first roll of 6-6, 4-4 or 3-3).</p>
<p>You may not build a «fence» of 6 points in a row unless at least one opponent's checker is ahead of it.</p>
<p>When all 15 checkers are home, bear them off. The first to bear off all wins. If the opponent has not borne off a single one, it is a <b>mars</b> — a double win.</p>
<p>How to move: tap your checker, then the point to go to (highlighted).</p>`,
  bgammon: `
<p>2 players, 15 checkers each, moving <b>towards each other</b>. Your checkers go along the top from right to left, then along the bottom from left to right to your <b>home</b> (the bottom right 6 points).</p>
<p><b>Hitting:</b> a lone opponent's checker (a «blot») can be hit — it goes to the <b>bar</b> and must come back in through your home. You may not land on a point with 2+ opponent's checkers.</p>
<p>While you have checkers on the bar, enter them first (tap the bar).</p>
<p>The dice roll by themselves. <b>A double</b> gives 4 moves. Play as many dice as possible; if only one — the bigger one.</p>
<p>All 15 at home — bear them off. A win is 1 point, a <b>mars</b> (gammon: the opponent bore off none) — 2, a <b>koks</b> (backgammon: also a checker on the bar or in your home) — 3.</p>`,
  klondike: `
<p>Solitaire for one player. The goal is to move all 52 cards to the four <b>foundations</b> (top right): by suit, from ace to king.</p>
<p>In the <b>columns</b> a card goes on a card one higher of the other colour (a red 7 on a black 8). You may move a whole run of face-up cards. Only a king goes to an empty column.</p>
<p><b>The stock</b> (top left): tap to turn 1 card (or 3 in the hard mode). When the stock runs out, tap again — the waste goes back.</p>
<p>How to move: tap a card and it goes wherever it can (foundations first). To put it elsewhere, tap the card, then the column. «💡» suggests a move.</p>`,
  spider: `
<p>Solitaire for one, two decks. The goal is to build <b>8 runs from king down to ace in one suit</b>: a finished run is removed by itself.</p>
<p>Any face-up card goes on a card one higher (suit does not matter). But only a run of one suit in descending order <b>moves together</b>. Any card or run goes to an empty column.</p>
<p><b>The stock</b> (top right) deals one card onto every column — when there are no empty columns.</p>
<p>Modes: 1 suit — easy, 2 suits — medium, 4 suits — hard. Tap a card and it goes wherever it can; to choose the place, tap the card, then the column.</p>`,
  mines: `
<p>Open every cell that has <b>no mine</b>. A number shows how many mines are among the 8 neighbours.</p>
<p>The first move is always safe. Where you think a mine is, put a <b>flag 🚩</b>: switch on the «🚩» mode below or press and hold the cell.</p>
<p>Tap an open number that already has all its flags around it — the other neighbours open.</p>
<p>Sizes: easy 9×9 (10 mines), medium 12×16 (30 mines), hard 14×22 (60 mines). Your best time is remembered.</p>`,
};
