// English, stage 3: Svara, Thousand, Kozel, Painted Poker, Preferans, Mafia, Spy, Quiz.
import { QUIZ_EN } from './i18n-en-quiz.js';
const who = s => (s === 'Ви' ? 'You' : s === 'вас' ? 'you' : s);
const bid = s => s.replace('мізер', 'misère').replace(' БК', ' NT');
const ROLE = { 'мафія': 'mafia', 'лікар': 'doctor', 'комісар': 'detective', 'мирний': 'civilian' };

// ---------- Spy: locations and what the bots say ----------
export const LOC_EN = {
  'Лікарня': 'Hospital', 'Школа': 'School', 'Пляж': 'Beach', 'Літак': 'Plane', 'Потяг': 'Train', 'Ресторан': 'Restaurant', 'Кінотеатр': 'Cinema',
  'Банк': 'Bank', 'Піцерія': 'Pizzeria', 'Супермаркет': 'Supermarket', 'Цирк': 'Circus', 'Космічна станція': 'Space station',
  'Підводний човен': 'Submarine', 'Поліцейська дільниця': 'Police station', 'Посольство': 'Embassy', 'Готель': 'Hotel', 'Університет': 'University',
  'Вокзал': 'Railway station', 'Театр': 'Theatre', 'Стадіон': 'Stadium', 'Зоопарк': 'Zoo', 'Музей': 'Museum', 'Базар': 'Market', 'Автосервіс': 'Car service',
  'Круїзний лайнер': 'Cruise liner', 'Військова база': 'Military base', 'Нічний клуб': 'Night club', 'Бібліотека': 'Library', 'Аеропорт': 'Airport',
  'Перукарня': 'Hairdresser', 'Ферма': 'Farm', 'Дитячий табір': 'Summer camp', 'Спортзал': 'Gym', 'Метро': 'Metro', 'Гірськолижний курорт': 'Ski resort',
  'Пошта': 'Post office', "Кав'ярня": 'Café', 'Весілля': 'Wedding', 'Пожежна частина': 'Fire station', 'Кораблетроща на острові': 'Shipwreck on an island',
};
const loc = s => LOC_EN[s] || s;
const SPY_SAY = {
  // hints
  'Тут головне — дочекатися свого лікаря.': 'The main thing here is to wait for your doctor.', 'Білий халат тут нікого не дивує.': 'Nobody is surprised by a white coat here.', 'Один укол — і все минеться 🙂': 'One shot and it will all pass 🙂',
  'Чекаю на дзвоник, як завжди.': 'Waiting for the bell, as always.', 'Домашнє завдання — мій головний ворог.': 'Homework is my main enemy.', 'Головне — не запізнитися на перший урок.': 'The main thing is not to be late for the first lesson.',
  'Без сонцезахисного крему тут ніяк.': 'No way without sunscreen here.', 'Пісок потім усюди 😅': 'Sand gets everywhere afterwards 😅', 'Головне — не обгоріти на сонці.': 'The main thing is not to get sunburnt.',
  'Пристебніть ремені, як то кажуть.': 'Fasten your seat belts, as they say.', 'Найгірше тут — турбулентність.': 'The worst thing here is turbulence.', 'Люблю дивитися у віконце на зльоті.': 'I love looking out of the window at take-off.',
  'Провідник уже приносив чай?': 'Has the attendant brought tea yet?', 'Верхня полиця — не моє.': 'The upper berth is not for me.', 'Під стукіт коліс добре спиться.': 'You sleep well to the sound of the wheels.',
  'Офіціант щось довго не несе меню.': 'The waiter is taking ages with the menu.', 'Я завжди залишаю чайові.': 'I always leave a tip.', 'Шеф тут готує неймовірно.': 'The chef here cooks amazingly.',
  'Без попкорну не той настрій.': 'Without popcorn it is not the same.', 'Головне — не сісти в перший ряд.': 'The main thing is not to sit in the front row.', 'Сеанс уже от-от почнеться.': 'The show is about to start.',
  'До касира черга, як завжди.': 'A queue to the cashier, as always.', 'Кредит — це точно не моє.': 'A loan is definitely not for me.', 'Тут без паспорта нічого не зробиш.': 'You can do nothing here without a passport.',
  'Найсмачніше — з подвійним сиром.': 'The tastiest is with double cheese.', 'Тісто тут тонке, як я люблю.': 'The dough here is thin, just as I like.', 'Запах із печі — на всю вулицю.': 'The smell from the oven fills the street.',
  'Беру візок і йду по акціях.': 'I grab a trolley and go for the special offers.', 'Біля каси завжди черга.': 'There is always a queue at the till.', 'Головне — не набрати зайвих продуктів.': 'The main thing is not to buy too much.',
  'Найбільше люблю клоунів 🤡': 'I love the clowns most 🤡', 'Під куполом страшно навіть дивитися.': 'It is scary even to look up under the dome.', 'Акробати сьогодні неймовірні.': 'The acrobats are amazing today.',
  'Невагомість — це щось!': 'Weightlessness is something!', 'Звідси Земля така маленька.': 'The Earth looks so small from here.', 'Без скафандра назовні не вийдеш.': 'You cannot go outside without a suit.',
  'Тут тісно, але звикаєш.': 'It is cramped here, but you get used to it.', 'Перископ — моє улюблене місце.': 'The periscope is my favourite spot.', 'Головне — не думати про глибину.': 'The main thing is not to think about the depth.',
  'Пишу заяву вже годину.': 'I have been writing a statement for an hour.', 'Протокол — справа нудна.': 'Paperwork is boring.', 'Наручники тут не для прикраси.': 'The handcuffs here are not for decoration.',
  'Анкету на візу заповнити — ціла справа.': 'Filling in a visa form is a whole job.', 'Паспорт головне не забути.': 'The main thing is not to forget the passport.', 'Тут усі такі ввічливі, дипломати ж.': 'Everyone is so polite here — diplomats.',
  'Сніданок включено — це плюс.': 'Breakfast is included — a plus.', 'На рецепції досі не дали ключ.': 'Reception still has not given me the key.', 'Мій номер із видом — розкіш.': 'My room with a view is a luxury.',
  'Сесія вже на носі.': 'Exams are just around the corner.', 'Професор знову затримує лекцію.': 'The professor is running the lecture over again.', 'Залік автоматом — моя мрія.': 'A pass without an exam is my dream.',
  'Стежу за табло з розкладом.': 'I am watching the departures board.', 'Валіза важка, як ніколи.': 'My suitcase is heavier than ever.', 'Оголошення тут ніхто не розбирає 😅': 'Nobody can make out the announcements here 😅',
  'В антракті — тільки в буфет.': 'In the interval — straight to the buffet.', 'Акторам сьогодні аплодували стоячи.': 'The actors got a standing ovation today.', 'Квитки в ложу — найкращі.': 'Box seats are the best.',
  'На трибуні такий гул!': 'Such a roar in the stands!', 'Головне — щоб наші забили.': 'The main thing is that our team scores.', 'Шарф уболівальника — обовʼязково.': 'A fan scarf is a must.',
  'Мавпи тут найкумедніші.': 'The monkeys here are the funniest.', 'Тварин годувати не можна.': 'You must not feed the animals.', 'До жирафів завжди черга.': 'There is always a queue to the giraffes.',
  'Гід розповідає дуже цікаво.': 'The guide tells it very well.', 'Тут нічого не можна торкатися руками.': 'You must not touch anything here.', 'Ця картина варта всієї подорожі.': 'This painting is worth the whole trip.',
  'Тут обовʼязково треба торгуватися!': 'You must haggle here!', 'Найсвіжіші овочі — тільки тут.': 'The freshest vegetables are only here.', 'Бабуся завжди дає скуштувати.': 'Granny always lets you taste.',
  'Механік каже, що справ на годину.': 'The mechanic says it is an hour of work.', 'Тут усе в мастилі.': 'Everything here is covered in oil.', 'Колеса вже поміняли.': 'The wheels are already changed.',
  'Вечори на палубі — найкращі.': 'Evenings on deck are the best.', 'Каюта маленька, зате вид який!': 'The cabin is small, but what a view!', 'Завтра заходимо в новий порт.': 'Tomorrow we call at a new port.',
  'Наказ є наказ.': 'An order is an order.', 'Підйом тут дуже ранній.': 'Wake-up here is very early.', 'Форма має бути ідеальною.': 'The uniform must be perfect.',
  'Діджей сьогодні вогонь 🔥': 'The DJ is on fire tonight 🔥', 'Охорона на вході сувора.': 'Security at the door is strict.', 'Танцюю до самого ранку.': 'I dance until morning.',
  'Тут треба говорити пошепки.': 'You have to whisper here.', 'Абонемент уже прострочений 😅': 'My card has already expired 😅', 'Шукаю одну рідкісну книжку.': 'I am looking for a rare book.',
  'Рейс знову затримують.': 'The flight is delayed again.', 'Багаж здав, тепер чекаю.': 'Bags checked, now I wait.', 'Реєстрація закривається за 40 хвилин.': 'Check-in closes in 40 minutes.',
  'Майстер сьогодні у формі.': 'The stylist is on form today.', 'Тільки кінчики, будь ласка!': 'Just the ends, please!', 'Нова зачіска — новий настрій.': 'New haircut, new mood.',
  'Встаю ще до світанку.': 'I get up before dawn.', 'Свіже молоко щоранку.': 'Fresh milk every morning.', 'Трактор знову зламався.': 'The tractor broke down again.',
  'Ввечері співаємо пісні біля вогнища.': 'In the evening we sing songs by the campfire.', 'Вожатий у нас класний.': 'Our counsellor is great.', 'Зарядка о сьомій — жах 😅': 'Exercises at seven — a nightmare 😅',
  'Сьогодні день ніг 💪': 'Today is leg day 💪', 'Тренер ганяє без жалю.': 'The coach works us without mercy.', 'Гантелі знову хтось не поклав на місце.': 'Someone left the dumbbells out again.',
  'Ескалатор знову не працює.': 'The escalator is broken again.', 'У годину пік тут не протиснутися.': 'At rush hour you cannot squeeze through here.', 'Наступна станція — моя.': 'The next stop is mine.',
  'Сніг сьогодні ідеальний.': 'The snow is perfect today.', 'На підйомник знову черга.': 'Another queue for the lift.', 'Головне — не впасти на спуску.': 'The main thing is not to fall on the way down.',
  'Прийшла посилка — стою в черзі.': 'A parcel arrived — I am in the queue.', 'Конверт і марку, будь ласка.': 'An envelope and a stamp, please.', 'Відправлення досі не надійшло 😤': 'The parcel still has not arrived 😤',
  'Бариста тут малює на пінці.': 'The barista here draws on the foam.', 'Один капучино — і я людина.': 'One cappuccino and I am human.', 'Круасани тут свіжі зранку.': 'The croissants are fresh in the morning.',
  'Чекаю, коли кидатимуть букет 💐': 'Waiting for the bouquet toss 💐', 'Тост за молодих!': 'A toast to the newlyweds!', 'Торт був величезний.': 'The cake was huge.',
  'Тривога може пролунати будь-коли.': 'The alarm can go off any time.', 'Каска завжди поруч.': 'The helmet is always close by.', 'Головне — швидко зібратися по сирені.': 'The main thing is to get ready fast at the siren.',
  'Кокоси вже набридли 🥥': 'I am sick of coconuts 🥥', 'Чекаємо, поки нас помітять.': 'Waiting for someone to spot us.', 'Будуємо пліт із пальм.': 'We are building a raft from palm trees.',
  // questions (without the name)
  'Що ти тут зазвичай робиш?': 'What do you usually do here?', 'Ти часто тут буваєш?': 'Are you here often?', 'А тобі тут подобається?': 'Do you like it here?',
  'Що тут найважче?': 'What is the hardest thing here?', 'З ким ти сюди зазвичай приходиш?': 'Who do you usually come here with?', 'Що тут треба мати з собою?': 'What do you need to have with you here?',
  'А як тут пахне? 😄': 'And how does it smell here? 😄', 'Коли тут найбільше людей?': 'When is it most crowded here?', 'Що б ти тут змінив?': 'What would you change here?', 'Скільки ти тут зазвичай буваєш?': 'How long do you usually stay here?',
  // vague answers
  'Та нормально, як завжди.': 'Fine, as always.', 'Буває по-різному, залежить від дня.': 'It varies, depends on the day.', 'Мені тут подобається, тільки людно.': 'I like it here, just crowded.',
  'Я тут не вперше 🙂': 'Not my first time here 🙂', 'Головне — не поспішати.': 'The main thing is not to hurry.', 'Тут завжди щось відбувається.': 'Something is always going on here.',
  'Чесно? Я б тут довго не був.': 'Honestly? I would not stay here long.', 'Залежить від настрою 😄': 'Depends on the mood 😄', 'Як і всі, чекаю, поки все закінчиться.': 'Like everyone, waiting for it all to end.', 'Буває весело, буває нудно.': 'Sometimes fun, sometimes boring.',
};
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const low = s => s.charAt(0).toLowerCase() + s.slice(1);

export const GAME2_EXACT = {
  ...QUIZ_EN, ...LOC_EN, ...SPY_SAY,
  // first-game tips
  'Спершу замовте, скільки взяток візьмете (кнопки з числами), потім грайте так, щоб узяти рівно стільки. Джокер 🃏 — найсильніший.': 'First bid how many tricks you will take (the number buttons), then play to take exactly that many. The joker 🃏 is the strongest.',
  'У вас 3 карти й очки вгорі. «Пас» — скинути, «Підтримати» — зрівняти ставку, «+1…+10» — підняти. Блефуйте сміливо 😎': 'You have 3 cards, your points are on top. «Pass» — fold, «Call» — match the bet, «+1…+10» — raise. Bluff boldly 😎',
  'Спершу торг: хто назве більше — бере прикуп. Марьяж (король + дама однієї масті) дає очки й робить масть козирем.': 'Bidding comes first: the highest bid takes the talon. A marriage (king + queen of one suit) scores points and makes that suit trump.',
  'Ваш партнер сидить навпроти. Масть треба підтримати; вальти й трефи — козирі. Віддавайте партнерові «товсті» карти, коли взятка його.': 'Your partner sits opposite. Follow suit; jacks and clubs are trumps. Give your partner the «fat» cards when the trick is theirs.',
  'Вночі мафія обирає жертву, лікар рятує, комісар перевіряє. Вдень обговорюйте в чаті й голосуйте, кого вигнати.': 'At night the mafia picks a victim, the doctor saves, the detective checks. In the day discuss in the chat and vote whom to throw out.',
  'Ставте питання про локацію іншим гравцям. Хто відповідає дивно — може бути шпигуном! Шпигун вгадує локацію зі списку.': 'Ask other players about the location. Whoever answers strangely may be the spy! The spy guesses the location from the list.',
  // Minesweeper of the day, the chest
  'Сапер дня': 'Minesweeper of the day', '💣 Сапер дня — одне поле для всіх': '💣 Minesweeper of the day — one field for everyone', '🏆 Таблиця дня': '🏆 Table of the day',
  'Ще ніхто не пройшов — будьте першим!': 'Nobody has cleared it yet — be the first!', 'Ваша спроба сьогодні: міна 💥': 'Your attempt today: a mine 💥',
  'Потрапити в таблицю можна, граючи в Telegram (@IgryUA_bot).': 'To get into the table, play in Telegram (@IgryUA_bot).', '▶ Зіграти ще раз (не в залік)': '▶ Play again (not counted)', '▶ Грати': '▶ Play',
  'Сапер дня пройдено!': 'Minesweeper of the day cleared!', 'Сапер дня: у таблицю йде лише перша спроба. Завтра — нове поле!': 'Minesweeper of the day: only the first attempt counts. A new field tomorrow!',
  // svara
  'вибув': 'out', 'чекає свару': 'waiting for the svara', 'пас': 'pass', 'підтримав': 'called', 'чекає': 'checked', '⚔️ Свара': '⚔️ Svara', 'Чекати': 'Check',
  'Свара! Скоро перегравання…': 'Svara! A replay is coming…', 'Наступна роздача скоро…': 'Next deal soon…', 'У вас закінчились фішки — ви глядач': 'You are out of chips — now you watch',
  'Ви чекаєте, поки закінчиться свара': 'You are waiting for the svara to end', 'Ви спасували. Чекаємо…': 'You folded. Waiting…', 'Ваш хід: чекати, підняти чи пас?': 'Your turn: check, raise or fold?',
  'Перемога! Усі фішки ваші': 'Victory! All the chips are yours', 'Фішки:': 'Chips:',
  // thousand, kozel, poker, preferans (tables)
  'Роздачу завершено': 'Deal finished', 'Кому віддати цю карту?': 'Who gets this card?', 'Віддайте по карті кожному супернику: торкніться карти': 'Give one card to each opponent: tap a card',
  'Скільки замовляєте? Можна залишити або підняти': 'What is your contract? Keep it or raise it', 'Ваш хід — підтримайте масть': 'Your turn — follow suit', 'Ваш хід': 'Your turn',
  'Підсумки роздачі. Скоро нова…': 'Deal results. A new one is coming…', 'Козиря ще немає': 'No trump yet', 'торг:': 'bidding:', 'Стіл порожній': 'The table is empty',
  'Очки': 'Points', 'Рахунок': 'Score', 'Взятки': 'Tricks', 'Замов.': 'Bid', 'Взяв': 'Took', '✋ пас': '✋ pass', 'Тисяча! Перемога': 'Thousand! Victory',
  '🥚 Яйця 60:60 — наступна роздача вдвічі!': '🥚 Eggs 60:60 — the next deal counts double!', '🤝 партнер': '🤝 partner', 'суперник': 'opponent', 'Козирі: усі вальти й ♣': 'Trumps: all jacks and ♣',
  'Ми': 'Us', 'Вони': 'Them', 'Ходить ваш партнер…': 'Your partner is playing…', 'Перемога! Козли — суперники': 'Victory! The opponents are the goats', 'Ви — козли 🐐': 'You are the goats 🐐',
  'Темна': 'Dark', 'Безкозирка': 'No trumps', 'Мізер': 'Misère', 'Джокер': 'Joker', 'Як ходите джокером?': 'How do you lead the joker?', 'Що робить джокер?': 'What does the joker do?',
  '✋ Забираю': '✋ Take it', '⬇️ Скидаю': '⬇️ Throw it away', 'козир': 'trump', 'скидає': 'throws away', 'забирає': 'takes', 'Підсумки роздачі…': 'Deal results…',
  'Ви: ще не замовили': 'You: no bid yet', 'не беріть жодної!': 'take none!', '54 карти': '54 cards', 'Найбільше —': 'Top score —',
  'Усі спасували — розпаси: не беріть взяток!': 'Everyone passed — raspasy: take no tricks!', 'Розпаси': 'Raspasy (all passed)', 'Мізер не зіграв': 'Misère failed', 'Мізер зіграв!': 'Misère made!',
  'торг': 'bidding', 'без козиря': 'no trump', 'прикуп': 'talon', 'мізер': 'misère', 'Ваша ставка або пас': 'Your bid or pass', 'Оберіть 2 карти, щоб скинути': 'Pick 2 cards to discard',
  'Оголосіть гру': 'Declare the game', 'Розпаси: намагайтеся не брати взяток': 'Raspasy: try not to take tricks', 'Мізер: не беріть жодної!': 'Misère: take no tricks!',
  // mafia
  '🔫 Мафія': '🔫 Mafia', '💉 Лікар': '💉 Doctor', '🕵️ Комісар': '🕵️ Detective', '🙂 Мирний': '🙂 Civilian', 'Ваша роль:': 'Your role:', '💀 Ваша роль:': '💀 Your role:',
  '🎭 Знайомство': '🎭 Introductions', '🏁 Кінець гри': '🏁 Game over', 'Вас убито. Можна стежити за грою 👀': 'You were killed. You can keep watching 👀',
  'Запам’ятайте свою роль. Скоро ніч…': 'Remember your role. Night is coming…', 'Оберіть жертву (торкніться гравця)': 'Choose a victim (tap a player)', 'Кого врятувати цієї ночі?': 'Whom to save tonight?',
  'Перевірку зроблено — результат у вашій ролі': 'Check done — the result is under your role', 'Кого перевірити?': 'Whom to check?', 'Місто спить… 😴': 'The town is asleep… 😴',
  'Ви пропустили голосування. Можна змінити': 'You skipped the vote. You can change it', 'Обговорюйте й голосуйте: торкніться гравця': 'Discuss and vote: tap a player',
  'Ранок. Скоро обговорення…': 'Morning. The discussion starts soon…', 'Підсумки дня. Скоро ніч…': 'Results of the day. Night is coming…', '🤷 Пропустити голосування': '🤷 Skip the vote',
  'Мертві мовчать 💀': 'The dead are silent 💀', 'Чат мафії…': 'Mafia chat…', 'Вночі всі сплять…': 'At night everyone sleeps…', 'Повідомлення…': 'Message…', 'Зараз писати не можна': 'You cannot write now',
  'Перемогло місто': 'The town won', 'Перемогла мафія': 'The mafia won', 'Ваша команда виграла!': 'Your team won!', 'Ваша команда програла.': 'Your team lost.',
  '☀️ Ранок. Ця ніч минула спокійно.': '☀️ Morning. The night passed quietly.', '☀️ Ранок. Мафія напала, але лікар урятував жертву! 💉': '☀️ Morning. The mafia attacked, but the doctor saved the victim! 💉',
  '⚖️ Голоси розділились — сьогодні нікого не стратили.': '⚖️ The votes were split — nobody was executed today.',
  // spy
  '🕵️ Ви — шпигун!': '🕵️ You are the spy!', 'Ви — шпигун!': 'You are the spy!', 'З розмови вгадайте, де всі.': 'Guess from the talk where everyone is.', '📍 Локація:': '📍 Location:',
  '🗳 Голосування!': '🗳 Voting!', 'Якщо не вгадаєте — програєте.': 'If you guess wrong, you lose.', '🕵️ Так, ми тут!': '🕵️ Yes, we are here!', 'Де ми?': 'Where are we?', 'Оберіть локацію': 'Choose a location',
  '🕵️ Картки роздано': '🕵️ Cards dealt', '💬 Розмова': '💬 Talk', '🗳 Голосування': '🗳 Voting', 'Не видайте себе. Відповідайте загально, слухайте інших.': 'Do not give yourself away. Answer vaguely, listen to others.',
  'Питайте так, щоб шпигун не здогадався, де ви.': 'Ask so that the spy cannot guess where you are.', '🗳 хоче голосувати': '🗳 wants to vote', 'шпигун': 'spy',
  'Запам’ятайте картку. Скоро розмова…': 'Remember your card. The talk starts soon…', 'Розпитуйте одне одного в чаті': 'Question each other in the chat',
  'Торкніться того, хто, на вашу думку, шпигун': 'Tap the one you think is the spy', '🕵️ Я знаю, де ми!': '🕵️ I know where we are!', '📍 Усі локації': '📍 All locations',
  'Можливі локації': 'Possible locations', 'Питання чи відповідь…': 'Question or answer…', 'Шпигуна викрили голосуванням.': 'The spy was caught by the vote.',
  'Місто звинуватило не того.': 'The town accused the wrong person.', 'Голоси розділились.': 'The votes were split.', 'Переміг шпигун': 'The spy won', 'Перемогли агенти': 'The agents won',
  '🗳 Голосування! Торкніться того, кого вважаєте шпигуном.': '🗳 Voting! Tap the one you think is the spy.',
  '💬 Ставте одне одному питання про локацію — так, щоб шпигун не здогадався, де ви. Шпигун, не видайте себе!': '💬 Ask each other about the location — so that the spy cannot guess where you are. Spy, do not give yourself away!',
  // quiz
  'ви': 'you', 'Не встигли 😅': 'Too slow 😅', 'Ні, правильна відповідь підсвічена': 'No, the right answer is highlighted', 'Відповідь прийнята — чекаємо інших…': 'Answer accepted — waiting for others…',
  'Оберіть відповідь!': 'Pick an answer!', 'Ви — знавець! 🧠': 'You are an expert! 🧠',
};

export const GAME2_RULES = [
  [/^Однакове поле 12×16 \(30 мін\) для всіх гравців\. У таблицю йде лише перша спроба, перемога — \+(\d+) очки\. Хто розмінує найшвидше\?$/, 'The same 12×16 field (30 mines) for every player. Only the first attempt counts, a win gives +$1 points. Who clears it fastest?'],
  [/^Учора найшвидший: (.+) — (\d+:\d+)$/, 'Fastest yesterday: $1 — $2'],
  [/^🏆 Таблиця дня · пройшли (\d+) з (\d+)$/, '🏆 Table of the day · cleared $1 of $2'],
  [/^Ваш результат: (\d+:\d+) · місце (\d+)$/, 'Your result: $1 · place $2'],
  [/^🏆 Ви (\d+)-й у таблиці дня! \+(\d+)$/, '🏆 You are #$1 in the table of the day! +$2'],
  [/^\+(\d+) і 🧰 скриня \+(\d+)!$/, '+$1 and the 🧰 chest +$2!'],
  [/^🧰 Скриня \+20: через (\d+) дн\. поспіль$/, '🧰 Chest +20: in $1 days in a row'],
  // svara
  [/^Ви забираєте банк: \+(\d+) 💰$/, 'You take the pot: +$1 💰'],
  [/^(.+) забирає банк (\d+)$/, '$1 takes the pot of $2'],
  [/^⚔️ Свара! (.+) переграють банк$/, '⚔️ Svara! $1 replay the pot'],
  [/^ставка (\d+)$/, 'bet $1'],
  [/^ставка (\d+) \(ваша (\d+)\)$/, 'bet $1 (yours $2)'],
  [/^Роздача (\d+)\/(\d+)$/, 'Deal $1/$2'],
  [/^Роздача (\d+)$/, 'Deal $1'],
  [/^Банк 💰(\d+)$/, 'Pot 💰$1'],
  [/^Ваші фішки: (\d+)$/, 'Your chips: $1'],
  [/^у вас (\d+) оч\.$/, 'you have $1 pts'],
  [/^(.+): усі спасували — банк (\d+)$/, '$1: everyone folded — pot $2'],
  [/^⚔️ Свара: (.+) — по (\d+) оч\.$/, '⚔️ Svara: $1 — $2 pts each'],
  [/^🏆 (.+): (\d+) оч\. — банк (\d+)$/, '🏆 $1: $2 pts — pot $3'],
  [/^Підтримати (\d+)$/, 'Call $1'],
  [/^Ваш хід: підтримати (\d+), підняти чи пас\?$/, 'Your turn: call $1, raise or fold?'],
  [/^Хід: (.+)…$/, 'Turn: $1…'],
  // thousand
  [/^(.+) (берете|бере) прикуп за (\d+)$/, (x, n, v, b) => `${who(n)} ${v === 'берете' ? 'take' : 'takes'} the talon for ${b}`],
  [/^(.+) (граєте|грає) (\d+)$/, (x, n, v, b) => `${who(n)} ${v === 'граєте' ? 'play' : 'plays'} ${b}`],
  [/^(.+): марьяж (.) \+(\d+)! Козир (.)$/, (x, n, s, v, t) => `${who(n)}: marriage ${s} +${v}! Trump ${t}`],
  [/^Торг: (\d+) \((.+)\)\. Підвищуйте або пас$/, (x, b, n) => `Bidding: ${b} (${who(n)}). Raise or pass`],
  [/^Торгується (.+)… Зараз (\d+) \((.+)\)$/, (x, n, b, h) => `${n} is bidding… Now ${b} (${who(h)})`],
  [/^(.+) роздає карти з прикупу…$/, '$1 is giving out the talon cards…'],
  [/^(.+) вирішує замовлення…$/, '$1 is choosing the contract…'],
  [/^Прикуп бере (.+) за$/, (x, n) => `The talon goes to ${who(n)} for`],
  [/^Роздача (\d+): (.+) грав$/, (x, d, n) => `Deal ${d}: ${who(n)} played`],
  [/^(.+): взяток (\d+)(?:, марьяж \+(\d+))?$/, (x, n, t, m) => `${who(n)}: tricks ${t}` + (m ? `, marriage +${m}` : '')],
  [/^Граю (\d+)$/, 'Play $1'],
  [/^Рахунок: ми (\d+) — вони (\d+)$/, 'Score: us $1 — them $2'],
  [/^Рахунок: (.+)$/, 'Score: $1'],
  // kozel
  [/^Ми беремо \+(\d+)! 🎉$/, 'We get +$1! 🎉'],
  [/^Суперники \+(\d+)$/, 'Opponents +$1'],
  [/^Ми (\d+) : (\d+) Вони · до (\d+)$/, 'Us $1 : $2 Them · to $3'],
  [/^взятки: ми (\d+), вони (\d+)$/, 'tricks: us $1, them $2'],
  // painted poker
  [/^(\d+) (?:карта|карти|карт)\.?$/, (x, n) => `${n} ${n === '1' ? 'card' : 'cards'}`],
  [/^По старших (.)$/, 'Highest $1'],
  [/^(\S+) (Темна|Безкозирка|Золота|Мізер|Звичайна)$/, (x, i, t) => `${i} ${x(t)}`],
  [/^по (.)$/, 'highest $1'],
  [/^Козир: (.+)$/, (x, s) => `Trump: ${s === 'немає' ? 'none' : s}`],
  [/^Ви: замовили (\d+), взяли (\d+)$/, 'You: bid $1, took $2'],
  [/^Ви: взяли (\d+) \(мізер\)$/, 'You: took $1 (misère)'],
  [/^очки (-?\d+)$/, 'points $1'],
  [/^Замовлено: (\d+) із (\d+)$/, 'Bid so far: $1 of $2'],
  [/^Далі: (.+)$/, 'Next: $1'],
  [/^Замовляє (.+)…$/, '$1 is bidding…'],
  [/^Ви роздавач: замовте( наосліп 🌑)? \(не можна, щоб сума стала (\d+)\)$/, (x, d, n) => `You are the dealer: bid${d ? ' blind 🌑' : ''} (the total may not be ${n})`],
  [/^Скільки взяток візьмете\?( наосліп 🌑)?$/, (x, d) => `How many tricks will you take?${d ? ' Blind 🌑' : ''}`],
  [/^треба ще (\d+)$/, '$1 more needed'],
  [/^Найбільше — (.+)$/, 'Top score — $1'],
  // preferans
  [/^(.+) бере прикуп$/, '$1 takes the talon'],
  [/^(.+) грає$/, (x, n) => `${who(n)} plays`],
  [/^(.+) грає (.+)$/, (x, n, b) => `${who(n)} plays ${bid(b)}`],
  [/^Гра (.+) зіграна$/, (x, b) => `Contract ${bid(b)} made`],
  [/^Недобір (\d+)$/, 'Short by $1'],
  [/^(\d+) БК$/, '$1 NT'],
  [/^вам ([+-]?\d+)$/, 'you $1'],
  [/^ставка (.+)$/, (x, b) => `bid ${bid(b)}`],
  [/^козир (.)$/, 'trump $1'],
  [/^Ваші очки: (-?\d+)$/, 'Your points: $1'],
  [/^ваші взятки: (\d+)$/, 'your tricks: $1'],
  [/^ви сказали: (.+)$/, (x, b) => `you said: ${b === 'пас' ? 'pass' : bid(b)}`],
  [/^Скинути (\d)\/2$/, 'Discard $1/2'],
  [/^Торгується (.+)…$/, '$1 is bidding…'],
  [/^(.+) обирає гру…$/, '$1 is choosing the game…'],
  // mafia
  [/^Ваша роль: (.+)$/, (x, r) => `Your role: ${x(r)}`],
  [/^🌙 Ніч (\d+)$/, '🌙 Night $1'],
  [/^☀️ День (\d+): голосування$/, '☀️ Day $1: voting'],
  [/^☀️ Ранок (\d+)$/, '☀️ Morning $1'],
  [/^☀️ День (\d+)$/, '☀️ Day $1'],
  [/^⚖️ Вирок (\d+)$/, '⚖️ Verdict $1'],
  [/^Ваша жертва: (.+)\. Можна змінити$/, 'Your victim: $1. You can change it'],
  [/^Рятуєте: (.+)\. Можна змінити$/, 'Saving: $1. You can change it'],
  [/^Ваш голос: (.+)\. Можна змінити$/, (x, n) => `Your vote: ${who(n)}. You can change it`],
  [/^Ваша команда: (.+)$/, 'Your team: $1'],
  [/^Перевірки: (.+)$/, (x, l) => 'Checks: ' + l.split('— МАФІЯ 🔫').join('— MAFIA 🔫').split('— мирний').join('— civilian')],
  [/^Мафія: (.+)$/, 'Mafia: $1'],
  [/^Гра почалась: (\d+) гравців, мафії — (\d+), є лікар і комісар\. Запам'ятайте свою роль\.$/, 'The game has started: $1 players, $2 mafia, plus a doctor and a detective. Remember your role.'],
  [/^🌙 Ніч (\d+)\. Місто засинає\. Мафія обирає жертву, лікар — кого рятувати, комісар — кого перевірити\.$/, '🌙 Night $1. The town falls asleep. The mafia picks a victim, the doctor whom to save, the detective whom to check.'],
  [/^☀️ Ранок\. Вночі вбито: (.+) \((\S+)\)\.$/, (x, n, r) => `☀️ Morning. Killed in the night: ${n} (${ROLE[r] || r}).`],
  [/^🗳 День (\d+)\. Обговорюйте й голосуйте, кого стратити\. Можна пропустити голосування\.$/, '🗳 Day $1. Discuss and vote whom to execute. You may skip the vote.'],
  [/^⚖️ Місто стратило (.+)\. Це (.+)\.$/, (x, n, r) => `⚖️ The town executed ${n}. ${r === 'була мафія 🔫' ? 'It was the mafia 🔫' : 'It was a ' + (ROLE[r] || r)}.`],
  [/^🔫 Мафія захопила місто! Мафія: (.+)\.$/, '🔫 The mafia took over the town! Mafia: $1.'],
  [/^🎉 Мафію знищено — перемогло місто! Мафія: (.+)\.$/, '🎉 The mafia is destroyed — the town won! Mafia: $1.'],
  // spy
  [/^📍 Локація: (.+)$/, (x, l) => `📍 Location: ${loc(l)}`],
  [/^«(.+)»\?$/, (x, l) => `«${loc(l)}»?`],
  [/^🗳 До голосування \((\d+)\/(\d+)\)$/, '🗳 Call a vote ($1/$2)'],
  [/^Шпигун вгадав локацію «(.+)»\.$/, (x, l) => `The spy guessed the location «${loc(l)}».`],
  [/^Шпигун помилився: назвав «(.+)»\.$/, (x, l) => `The spy was wrong: said «${loc(l)}».`],
  [/^Шпигун — (.+), локація — «(.+)»\.$/, (x, n, l) => `The spy: ${who(n)}, location: «${loc(l)}».`],
  [/^Гра почалась: (\d+) гравців, один із вас — шпигун\. Подивіться свою картку\.$/, 'The game has started: $1 players, one of you is the spy. Look at your card.'],
  [/^(🕵️ Переміг шпигун|🎉 Перемогли агенти)! Шпигун — (.+), локація — «(.+)»\.$/, (x, w, n, l) => `${w.startsWith('🕵️') ? '🕵️ The spy won' : '🎉 The agents won'}! The spy: ${n}, location: «${loc(l)}».`],
  [/^⚖️ Більшість обрала: (.+)\.$/, '⚖️ The majority chose: $1.'],
  [/^(.+) хоче голосувати \((\d+)\/(\d+)\)\.$/, '$1 wants to vote ($2/$3).'],
  [/^🕵️ (.+) — шпигун! Каже, що ви в локації «(.+)»\.$/, (x, n, l) => `🕵️ ${n} is the spy! Says you are at «${loc(l)}».`],
  // a bot speaking to someone: «Name, phrase»
  [/^([^,]+), (.+)$/, (x, n, t) => { const e = SPY_SAY[cap(t)]; return e ? `${n}, ${/^I\b/.test(e) ? e : low(e)}` : null; }],
  // quiz
  [/^Питання (\d+) з (\d+)$/, 'Question $1 of $2'],
  [/^Правильно! \+(\d+)$/, 'Correct! +$1'],
];

export const RULES2_HTML = {
  svara: `
<p>2–8 players, a 36-card deck, <b>3 cards</b> each. Everyone starts with 50 chips.</p>
<p><b>Hand points:</b> the sum of cards of <b>one suit</b> — ace 11, king, queen, jack and 10 — 10 each, 9…6 — face value. Two aces — 22. Three of a kind — three times the face value (three aces — 33), <b>three sixes — 34</b>, the top hand.</p>
<p><b>The 7♣</b> is a joker: it becomes any card (adds 11 to a suit, turns a pair into three of a kind).</p>
<p><b>Betting:</b> everyone puts 1 chip into the pot, then in turn: <b>fold</b> (drop the cards), <b>call</b> (match the bet) or <b>raise</b>. A bet can't exceed the chips of the poorest player in the deal.</p>
<p>Whoever is left alone takes the pot without showing. Otherwise cards are shown: the most points take the pot. A tie is a <b>svara</b>: the tied players replay for the same pot.</p>
<p>No chips — you are out. The game goes on to the last player with chips or to the end of the deals (short — 10, full — 20): then the richest wins.</p>`,
  thousand: `
<p>3 players, 24 cards (9, jack, queen, king, 10, ace). Points: ace 11, ten 10, king 4, queen 3, jack 2, nine 0. The deck holds 120 points.</p>
<p><b>Bidding:</b> the player after the dealer already «sits» on 100. Then in turn players raise by 5 or pass. You may bid over 120 only holding a marriage.</p>
<p><b>Talon:</b> the bidding winner takes the 3 talon cards (everyone sees them), gives one card to each opponent and sets the final contract (it can be raised).</p>
<p><b>Play:</b> 8 tricks. Follow suit; if you can't — trump. There is no trump until someone declares a marriage.</p>
<p><b>A marriage</b> (king + queen of one suit): ♠ 40, ♣ 60, ♦ 80, ♥ 100. It is declared automatically when you lead the king or queen of the pair and already have at least one trick. Its suit becomes trump.</p>
<p><b>Scoring:</b> the declarer gets + the contract if they made it, − the contract if not. The others get their points rounded to 5. Three deals with zero («bolts») — −120.</p>
<p><b>The barrel:</b> at 880, trick points are not added — you can win only by taking the contract and reaching 1000. Three failed deals on the barrel — −120.</p>`,
  goat: `
<p>4 players, two pairs: your <b>partner</b> sits opposite. 36 cards, 9 each.</p>
<p><b>Trumps:</b> all jacks are the highest (♣ > ♠ > ♥ > ♦), then the whole ♣ club suit (ace, 10, king, queen, 9…6). In plain suits: ace, 10, king, queen, 9, 8, 7, 6.</p>
<p><b>Play:</b> follow suit (a jack counts as a club trump). No such suit — play any card.</p>
<p><b>Points:</b> ace 11, 10 — 10, king 4, queen 3, jack 2. The deck holds 120.</p>
<p><b>A deal:</b> the pair with 61+ points gets +2; if the opponents scored under 31 — +4; if they took no tricks — +6. 60:60 — «eggs»: the next deal counts double.</p>
<p>The game goes to <b>12</b>. The losers are the «goats» 🐐.</p>`,
  rpoker: `
<p>2–8 players. A 36-card deck (the joker is the 7♠, up to 6 players) or 54 (two jokers, up to 8 players).</p>
<p><b>Deals:</b> first 1 card each, then 2, 3… up to the maximum (no more than 10), then back down to 1. In the <b>full</b> game there are extra rounds at the maximum and special rounds at the end: 🌑 <b>dark</b> (bid without looking at your cards), 🚫 <b>no trumps</b>, 💰 <b>golden</b> (points ×2), ❄️ <b>misère</b> (every trick −10, none — +50).</p>
<p><b>Trump</b> — the card turned up after the deal (or the dealer's last card if the whole deck was dealt).</p>
<p><b>Bidding:</b> in turn, how many tricks you'll take. The dealer bids last and can't make the total equal to the number of cards.</p>
<p><b>Play:</b> follow suit; if you can't — trump; if you have no trump either — any card.</p>
<p><b>The joker 🃏</b> is the strongest card and can be played any time. Leading: «take it» or «highest [suit]» (everyone plays their highest card of that suit). Not leading: «take it» or «throw it away» (then it is the weakest).</p>
<p><b>Points:</b> exactly as many tricks as you bid — 10 for each (0 of 0 — 5). Extra tricks — +1 each. Each missing trick — −10. The most points at the end wins.</p>`,
  pref: `
<p>3 players, 32 cards (seven to ace), 10 each, two go to the <b>talon</b>.</p>
<p><b>Bidding:</b> in turn players name a game: 6♠ &lt; 6♣ &lt; 6♦ &lt; 6♥ &lt; 6 NT &lt; 7♠ … &lt; 8 NT &lt; <b>misère</b> &lt; 9♠ … &lt; 10 NT. Whoever says «pass» leaves the bidding. The number is how many of the 10 tricks you undertake to take; the suit is trump, NT — no trump.</p>
<p><b>The declarer</b> takes the talon (everyone sees it), discards 2 cards and declares the game — not lower than their bid.</p>
<p><b>Play:</b> follow suit; if you can't — trump; if you have no trump either — any card.</p>
<p><b>Points</b> (a simplified count instead of the pool and the mountain): game value 6 — 2, 7 — 4, 8 — 6, 9 — 8, 10 — 10. Made — +5×value; short by k tricks — −5×value×k. Each defender gets +value per trick.</p>
<p><b>Misère</b> — take no tricks (no trump): made — +50, each trick — −50. <b>Raspasy</b> (everyone passed): each trick −5, whoever takes none — +10.</p>
<p>The game is 12 or 24 deals. The most points win.</p>`,
  mafia: `
<p>5–12 players. The game deals the roles: <b>mafia</b> (1–3), a <b>doctor</b>, a <b>detective</b>, the rest are <b>civilians</b>. Only you see your role; the mafia know each other.</p>
<p><b>🌙 Night:</b> the mafia picks a victim (they have their own chat), the doctor saves one player (not the same one two nights in a row), the detective checks one player and learns whether they are mafia.</p>
<p><b>☀️ Day:</b> the game announces who died. Everyone discusses in the chat and votes whom to execute (or skips). The player with the most votes is executed if they have more votes than «skip».</p>
<p>The roles of the dead are revealed. <b>The town</b> wins when no mafia is left; <b>the mafia</b> — when they are as many as everyone else.</p>
<p class="muted">Tap a player to choose a target or to vote.</p>`,
  spy: `
<p>3–10 players. Everyone except one sees the <b>location</b> (beach, hospital, train…). One player is the <b>spy</b>: they don't know the location.</p>
<p><b>Talk:</b> ask each other questions in the chat («Are you here often?», «What are you wearing here?») — so that your side understands, but the spy can't guess where you are.</p>
<p><b>The vote</b> starts when most players press «Call a vote» or time runs out. Catch the spy — the agents win. Wrong person or a split vote — the spy wins.</p>
<p><b>The spy</b> can press «I know where we are!» any time and name the location: right — the spy wins, wrong — loses.</p>
<p><b>Bots</b> talk too: they ask players questions and answer when you mention them by name («Taras, are you here often?»). The bots understand Ukrainian best, and a spy bot listens for hint words, so hint carefully!</p>`,
  quiz: `
<p>2–8 players, 10 questions. Each one has <b>15 seconds</b>: everyone answers at the same time by picking one of four options.</p>
<p>A right answer gives <b>+10</b> plus up to <b>+5</b> for speed. A wrong answer or no answer — 0.</p>
<p>After each question you see the right answer and who picked what. The most points win.</p>
<p>Topics: Ukraine, world, science, sport, culture and misc — pick one or play them all.</p>`,
};
