// Builds one page per game for Google (D:\Durak\<slug>\index.html), the /igry/ links and sitemap.xml.
// The rules come from the game screens (js/*-ui.js), so the pages always match the game.
// Run after changing rules or adding a game: node seo/make_pages.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://www.igryua.biz.ua';
const BOT = 'https://t.me/IgryUA_bot';

// slug, game id (startapp & engine file), title words, search-style intro, FAQ
const GAMES = [
  { slug: 'durak', id: 'durak', icon: '🃏', name: 'Дурень', h1: 'Дурень онлайн — підкидний і переводний',
    title: 'Дурень онлайн — грати в підкидного й переводного дурня безкоштовно', players: '2–12 гравців',
    intro: 'Найпопулярніша карткова гра — тепер у Telegram. Підкидний, переводний або обидва разом, колода 36, 52 чи дві по 36 — від 2 до 12 гравців. Грайте з друзями, з випадковим суперником або з ботами, коли нікого немає поруч.',
    faq: [['Чи можна грати в дурня з друзями онлайн?', 'Так: створіть кімнату й надішліть друзям посилання — вони одразу сядуть за ваш стіл. Або введіть код кімнати.'],
      ['Скільки гравців може бути?', 'Від 2 до 6 на колоді 36, до 8 на колоді 52 і до 12 на двох колодах по 36.'],
      ['Це безкоштовно?', 'Так, усі ігри безкоштовні й без реклами. Потрібен лише Telegram.']] },
  { slug: 'rozpysnyi-poker', id: 'rpoker', icon: '🎯', name: 'Розписний покер', h1: 'Розписний покер онлайн',
    title: 'Розписний покер онлайн — грати безкоштовно з друзями', players: '2–8 гравців',
    intro: 'Розписний покер (кінг, «тисяча на взятки») — гра на точне замовлення: скажіть, скільки взяток візьмете, і візьміть рівно стільки. Темна, безкозирка, золота й мізер, джокер 7♠ або два джокери в колоді 54.',
    faq: [['Скільки гравців у розписному покері?', 'Від 2 до 6 на колоді 36 і до 8 на колоді 54.'],
      ['Що таке джокер?', 'Найсильніша карта: можна «забрати» взятку, попросити «по старших» або скинути.']] },
  { slug: 'svara', id: 'svara', icon: '🎴', name: 'Свара', h1: 'Свара онлайн — карти, торг і блеф',
    title: 'Свара онлайн — грати у свару (секу) безкоштовно', players: '2–8 гравців',
    intro: 'Свара — швидка азартна гра на три карти: збирайте очки в одній масті, торгуйтеся, блефуйте. Шаха 7♣ — джокер, три шістки — 34. Нічия — «свара» за той самий банк. Граємо на ігрові фішки, без грошей.',
    faq: [['Чи на гроші гра?', 'Ні, тільки ігрові фішки: у кожного на старті 50, перемоги йдуть у рейтинг.'],
      ['Яка найсильніша рука?', 'Три шістки — 34 очки. Далі три тузи — 33.']] },
  { slug: 'tysiacha', id: 'thousand', icon: '🂡', name: 'Тисяча', h1: 'Тисяча онлайн — карткова гра на трьох',
    title: 'Тисяча онлайн — грати в карти «тисяча» безкоштовно', players: '3 гравці',
    intro: 'Класична «тисяча»: торг від 100, прикуп, марьяжі, болти й бочка на 880. Гра до 1000 очок на трьох — з друзями, випадковими суперниками або ботами.',
    faq: [['Скільки гравців у тисячі?', 'Троє. Якщо людей двоє, третім сяде бот.'], ['Що таке марьяж?', 'Король і дама однієї масті: дають очки й роблять масть козирем.']] },
  { slug: 'kozel', id: 'goat', icon: '🐐', name: 'Козел', h1: 'Козел онлайн — командна гра 2 на 2',
    title: 'Козел онлайн — грати в карти «козел» безкоштовно', players: '4 гравці, 2 на 2',
    intro: 'Козел — командна карткова гра: вальти й трефи — козирі, 61 очко бере роздачу, гра до 12. Хто програв — ті «козли». Грайте з другом у парі проти інших або з ботами.',
    faq: [['Скільки гравців?', 'Четверо, дві пари. Вільні місця можуть зайняти боти.']] },
  { slug: 'mafiia', id: 'mafia', icon: '🎭', name: 'Мафія', h1: 'Мафія онлайн у Telegram',
    title: 'Мафія онлайн — грати в мафію з друзями в Telegram', players: '5–12 гравців',
    intro: 'Мафія з ведучим-ботом: ніч, ранок, обговорення в чаті й голосування. Мафія, лікар, комісар і мирні — від 5 до 12 гравців, вільні місця займають боти.',
    faq: [['Хто ведучий?', 'Ведучий — бот: він роздає ролі, веде ночі й рахує голоси.'], ['Можна грати, якщо нас мало?', 'Так, боти доповнять стіл до 5 гравців.']] },
  { slug: 'shpyhun', id: 'spy', icon: '🕵️', name: 'Шпигун', h1: 'Шпигун онлайн — знайди шпигуна',
    title: 'Шпигун онлайн — гра «шпигун» для компанії в Telegram', players: '3–10 гравців',
    intro: 'Усі знають локацію, крім одного. Розпитуйте одне одного й вирахуйте шпигуна — або, будучи шпигуном, вгадайте, де ви. Є говорючі боти, тож можна грати навіть утрьох.',
    faq: [['Скільки локацій?', 'Понад 40: від пляжу до космічної станції.']] },
  { slug: 'morskyi-bii', id: 'battle', icon: '🚢', name: 'Морський бій', h1: 'Морський бій онлайн',
    title: 'Морський бій онлайн — грати з другом безкоштовно', players: '2–4 гравці',
    intro: 'Класичний морський бій 10×10: розставте флот і топіть кораблі суперників. Можна вдвох або вчотирьох — кожен проти кожного.',
    faq: [['Можна грати більше ніж удвох?', 'Так, до 4 гравців: оберіть, по чийому полю стріляти.']] },
  { slug: 'shashky', id: 'checkers', icon: '⚪', name: 'Шашки', h1: 'Шашки онлайн — грати з другом або ботом',
    title: 'Шашки онлайн — грати в шашки безкоштовно з другом або ботом', players: '2 гравці',
    intro: 'Класичні шашки 8×8 за правилами, як грають в Україні: бити обов\'язково, прості шашки б\'ють і назад, дамка ходить на будь-яку відстань. Грайте з другом, випадковим суперником або сильним ботом.',
    faq: [['Чи обов\'язково бити?', 'Так, і якщо після удару можна бити далі — б\'єте далі тією ж шашкою.'], ['Як грає бот?', 'Бот рахує на кілька ходів уперед — його непросто обіграти.']] },
  { slug: 'nardy', id: 'nardy', icon: '🎲', name: 'Нарди', h1: 'Довгі нарди онлайн',
    title: 'Нарди онлайн — грати в довгі нарди безкоштовно', players: '2 гравці',
    intro: 'Довгі нарди: 15 шашок стартують із голови, бити не можна, «паркан» із шести без суперника попереду заборонений. Хто першим викинув усі шашки — переміг, а якщо суперник не викинув жодної — марс.',
    faq: [['Скільки шашок можна взяти з голови?', 'Одну за хід. Лише першим кидком 6-6, 4-4 або 3-3 — дві.'], ['Що таке марс?', 'Перемога, коли суперник не встиг викинути жодної шашки, — рахується подвійно.']] },
  { slug: 'kosti', id: 'dice', icon: '⚀', name: 'Кості', h1: 'Кості онлайн — покер на костях',
    title: 'Покер на костях онлайн — гра в кості з друзями безкоштовно', players: '2–6 гравців',
    intro: 'Покер на костях: 5 кубиків, до трьох кидків за хід, 13 комбінацій — від одиниць до фул-хаусу, стріту й покеру на 50 очок. Від 2 до 6 гравців.',
    faq: [['Скільки кидків за хід?', 'До трьох. Після кидка відкладіть потрібні кубики й перекиньте решту.']] },
];

// rules text from the game screen; ${E.X} values come from the engine
async function rulesOf(id) {
  const ui = { durak: 'durak', rpoker: 'rpoker', svara: 'svara', thousand: 'thousand', goat: 'goat', mafia: 'mafia', spy: 'spy', battle: 'battle', checkers: 'checkers', nardy: 'nardy', dice: 'dice' }[id];
  const src = fs.readFileSync(path.join(ROOT, 'js', `${ui}-ui.js`), 'utf8');
  const m = src.match(/export const rules = `([\s\S]*?)`;/);
  let html = m ? m[1] : '';
  if (html.includes('${')) {
    const E = await import('file://' + path.join(ROOT, 'js', `${ui}-engine.js`).replace(/\\/g, '/'));
    html = html.replace(/\$\{E\.([A-Z_]+)\}/g, (_, k) => String(E[k]));
  }
  // drop on-screen hints that make no sense on a web page
  return html.replace(/<p>Як ходити:[\s\S]*?<\/p>/g, '').trim();
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = s => s.replace(/<[^>]+>/g, '');

const CSS = `:root{--felt:#21603e;--felt2:#143a27;--ink:#fff;--muted:rgba(255,255,255,.8);--gold:#f5c542;--blue:#2f6fd6}
*{box-sizing:border-box}
html,body{margin:0;background:var(--felt2);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.6}
a{color:var(--gold)}
.wrap{max-width:820px;margin:0 auto;padding:0 18px}
header{background:radial-gradient(ellipse at 50% 30%,var(--felt) 0%,var(--felt2) 85%);padding:22px 0 26px}
nav{font-size:14px;margin-bottom:18px}
nav a{color:var(--muted);text-decoration:none}
.big{font-size:56px;line-height:1}
h1{font-size:clamp(26px,5vw,38px);line-height:1.2;margin:10px 0}
.meta{color:var(--muted);margin:0 0 16px}
.lead{font-size:18px;margin:0 0 20px}
.cta{display:inline-block;background:var(--blue);color:#fff;text-decoration:none;font-weight:700;font-size:18px;padding:14px 26px;border-radius:14px;box-shadow:0 4px 14px rgba(0,0,0,.3)}
.cta:hover{filter:brightness(1.1)}
section{padding:22px 0;border-top:1px solid rgba(255,255,255,.12)}
h2{font-size:23px;margin:0 0 10px}
.rules p{margin:0 0 10px}
details{background:rgba(255,255,255,.07);border-radius:12px;padding:10px 14px;margin:8px 0}
summary{cursor:pointer;font-weight:700}
.others{display:flex;flex-wrap:wrap;gap:8px}
.others a{background:rgba(255,255,255,.08);border-radius:10px;padding:8px 12px;text-decoration:none;color:#fff}
footer{padding:22px 0 40px;color:var(--muted);font-size:14px;border-top:1px solid rgba(255,255,255,.12)}`;

function page(g, rules) {
  const url = `${SITE}/${g.slug}/`, play = `${BOT}?startapp`;
  const desc = `${g.intro.split('. ')[0]}. ${g.players}, безкоштовно, українською — прямо в Telegram.`;
  const ld = [{
    '@context': 'https://schema.org', '@type': 'VideoGame', name: `${g.name} — Ігри UA`, url, inLanguage: 'uk',
    description: strip(g.intro), genre: 'Card game', gamePlatform: 'Telegram', applicationCategory: 'GameApplication',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'UAH' }, image: `${SITE}/promo/promo-square.png`,
  }, {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: g.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  }];
  const others = GAMES.filter(x => x !== g).map(x => `<a href="../${x.slug}/">${x.icon} ${esc(x.name)}</a>`).join('\n      ');
  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(g.title)} | Ігри UA</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(g.h1)} — Ігри UA">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}/promo/promo-wide.png">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>${CSS}</style>
</head>
<body>
<header>
  <div class="wrap">
    <nav><a href="../igry/">🎲 Ігри UA</a> › ${esc(g.name)}</nav>
    <div class="big">${g.icon}</div>
    <h1>${esc(g.h1)}</h1>
    <p class="meta">${esc(g.players)} · безкоштовно · українською · у Telegram</p>
    <p class="lead">${esc(g.intro)}</p>
    <a class="cta" href="${play}">${g.icon} Грати в ${esc(g.name)}</a>
  </div>
</header>
<main class="wrap">
  <section class="rules">
    <h2>Правила гри «${esc(g.name)}»</h2>
    ${rules}
  </section>
  <section>
    <h2>Як почати</h2>
    <ol>
      <li>Натисніть «Грати» — відкриється бот <a href="${BOT}">@IgryUA_bot</a> у Telegram.</li>
      <li>Оберіть «${esc(g.name)}».</li>
      <li>Грайте з ботами, створіть кімнату для друзів або знайдіть випадкового суперника.</li>
    </ol>
    <p><a class="cta" href="${play}">Відкрити гру</a></p>
  </section>
  <section>
    <h2>Питання й відповіді</h2>
    ${g.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n    ')}
  </section>
  <section>
    <h2>Інші ігри</h2>
    <div class="others">
      ${others}
    </div>
  </section>
</main>
<footer><div class="wrap">Ігри UA — карткові й компанійські ігри українською в Telegram · 🏆 турнір тижня з призами · <a href="${BOT}">@IgryUA_bot</a> · новини <a href="https://t.me/UAIgry">@UAIgry</a></div></footer>
</body>
</html>
`;
}

for (const g of GAMES) {
  const dir = path.join(ROOT, g.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(g, await rulesOf(g.id)));
}

// links from /igry/ to every game page (between the markers)
const igry = path.join(ROOT, 'igry', 'index.html');
let s = fs.readFileSync(igry, 'utf8');
const block = `<!--games-links-->
  <section>
    <h2>Правила кожної гри</h2>
    <p>${GAMES.map(g => `<a href="../${g.slug}/">${g.icon} ${esc(g.name)}</a>`).join(' · ')}</p>
  </section>
  <!--/games-links-->`;
s = s.includes('<!--games-links-->') ? s.replace(/<!--games-links-->[\s\S]*?<!--\/games-links-->/, block) : s.replace(/  <section>\r?\n    <h2>Чому зручно<\/h2>/, m => `  ${block}\n\n${m}`);
fs.writeFileSync(igry, s);

// sitemap
const urls = [`${SITE}/igry/`, ...GAMES.map(g => `${SITE}/${g.slug}/`)];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u, i) => `  <url>\n    <loc>${u}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${i ? '0.8' : '1.0'}</priority>\n  </url>`).join('\n')}
</urlset>
`);
console.log('pages:', GAMES.map(g => g.slug).join(', '));
