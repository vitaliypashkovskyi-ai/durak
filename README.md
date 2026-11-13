# Ігри — Telegram Mini App (@DurenUA_bot)

- **Дурень**: підкидний і переводний, 2–6 гравців.
- **Морський бій**: 2–4 гравці.
- **Мафія**: 5–12 гравців (мафія, лікар, комісар, мирні), ведучий — сервер, чат.
- Режими: з ботами (у браузері), кімната для друзів (можна додати ботів), випадковий суперник.

Код: `index.html` (оболонка), `js/*-engine.js` (правила й боти, спільні зі сервером),
`js/*-ui.js` (екрани), `js/app.js` (меню, кімнати), `js/host.js` (хід гри, боти).
Перевірка правил: `node tests/sim.mjs`.

## Запуск локально
```
python -m http.server 8137 --directory D:/Durak
```
Відкрити http://localhost:8137

Гра онлайн: https://vitaliypashkovskyi-ai.github.io/durak/

## Гра з друзями (сервер)
`server/` — Cloudflare Worker + Durable Objects: `wss://durak.durak-server.workers.dev`.
- `/ws/room?room=КОД` — стіл на двох (колода й руки зберігаються лише на сервері).
- `/ws/match` — черга випадкових суперників.
- Гравець із Telegram перевіряється підписом `initData` (секрет `BOT_TOKEN`); поза Telegram — гість (`ALLOW_GUEST=1`).

Локально: `cd server && npx wrangler dev --port 8787`, гра — `http://localhost:8137/?server=ws://localhost:8787`.
Викласти: `cd server && npx wrangler deploy`.

## Бот на QNAP
Папка `bot/` → на NAS у `/share/Pashkovskyi/durak-bot`. У `.env` вписати `BOT_TOKEN`,
потім Container Station → Applications → Create → вставити `bot/docker-compose.yml`.
Бот сам ставить кнопку меню «Грати» і команди /start, /play, /rules.

## Як підключити до Telegram вручну
1. Викласти `index.html` на будь-який хостинг з **HTTPS**
   (GitHub Pages, Netlify, Cloudflare Pages або свій сервер з SSL).
2. У Telegram відкрити **@BotFather**:
   - `/newbot` — створити бота (ім'я + username, що закінчується на `bot`).
   - `/newapp` — вибрати бота, вказати назву, опис, картинку 640×360 та URL гри.
     Отримаєте посилання виду `https://t.me/<бот>/<назва>`, яке можна кидати друзям.
   - Або `/mybots` → бот → **Bot Settings → Menu Button** → вказати URL гри,
     тоді гра відкриватиметься кнопкою біля поля вводу в чаті з ботом.
3. Сервер для бота на цьому етапі не потрібен: гра повністю працює в браузері.

## Що вже є
- Правила підкидного: козир, підкидання за номіналом, ліміт 6 карт / карт у захисника, «Беру», «Бито».
- Бот: ходить дрібними картами, береже старші козирі, підкидає.
- Статистика перемог (localStorage), вібрація та тема Telegram.

## Ідеї далі
- Гра з другом (потрібен сервер + WebSocket).
- Переводний дурень, 24/52 карти.
- Рейтинг через Telegram CloudStorage або власний бекенд.
