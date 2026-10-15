# Вхід через Telegram і закритий звіт

Як працює доступ до закритого звіту для членів церкви, як це підтримувати і що
зробити перед продом.

---

## 1. Як це працює

Доступ має лише той, хто **зараз** є учасником Telegram-каналу (NEST,
`TELEGRAM_CHAT_ID`). Номер телефону не запитується. Людина бачить на сайті
число і вибирає його ж у боті, як підтвердження входу в банківських застосунках.

```
 Браузер (SPA)                          API (NestJS)                           Telegram
 ─────────────                          ────────────                           ────────
 «Увійти через Telegram» ─POST /auth/telegram/start─▶ nonce (5 хв) + число 10–99
                         ◀─ { nonce, code } + httpOnly-cookie «прив'язка браузера» ─
 сайт показує «ваше число: 47»
 і кнопку «Відкрити Telegram» ─ t.me/<bot>?start=<nonce> ─────────────────────────▶ Start
                                       getChatMember(канал, людина) ◀────────── /start <nonce>
                                       не учасник → відмова
                                       учасник    → «Вхід на ubc-military-fund.com
                                                     з Chrome · Mac. Натисніть число,
                                                     яке показує сайт: [12] [47] [83]» ─▶
                                       ◀──────────────────────────────────── натиснула 47
                                       правильне   → authorized + «✅ Новий вхід …
                                                     [Відкрити звіт] [Це не я — вийти всюди]»
                                       неправильне → спроба скасована назавжди
 вкладка сайту кожні 1,5 с:
 GET /auth/telegram/poll?nonce (+ cookie-прив'язка) ─▶ authorized → Set-Cookie __Host-ubc_session
 редірект на /members-details-ubc/secret
 GET /report/secret ─▶ JWT → сесію не відкликано → ліміт на людину → членство ЗНОВУ, на кожен запит
                       ◀── дані з SQLite
```

**Навіщо число.** Без нього зловмисник міг би почати вхід у себе, переслати
посилання члену церкви («натисни Start») і отримати сесію замість нього. Тепер:
- обманутий член церкви сайту не бачив, тож не знає, яке з трьох чисел правильне. Неправильне скасовує спробу;
- сесію забирає тільки браузер, що почав вхід (cookie-прив'язка);
- після кожного входу бот пише «Новий вхід» з кнопкою **«Це не я — вийти всюди»**. Вона завершує всі сесії людини й скасовує незабрані входи.

Другий шлях — кнопка «Відкрити закритий звіт» у повідомленні бота. Вона веде на
сайт з одноразовим токеном у `#t=…` (частина після `#` не йде на сервер і в логи
Cloudflare). Токен діє `HANDOFF_TTL_SEC` (2 хв), а `POST /auth/telegram/handoff`
ще раз перевіряє членство.

### Захист закритих даних

| Що | Як |
|---|---|
| Де лежать дані | **Тільки** в SQLite на сервері (таблиці `private_*`). Жодних файлів із даними: їх немає ні в git, ні у фронт-бандлі, ні в Docker-образі. Фронт отримує дані лише запитом `GET /report/secret`. |
| Хто бачить | Валідний JWT-cookie, сесію не відкликано **і** людина зараз у каналі (`MEMBERSHIP_TTL_SEC=0`: Telegram питають на кожен запит, одночасні запити об'єднуються в один). Хто вийшов із каналу, втрачає доступ одразу. |
| Вхід | Вибір правильного числа з трьох у боті + прив'язка до браузера + одноразові nonce і handoff + «Це не я». `POST`-запити входу приймаються лише з дозволених `Origin`, а handoff — лише як JSON (захист від CSRF). |
| Сесія | JWT в `httpOnly`-cookie `__Host-ubc_session` (на dev/prod: лише HTTPS, лише хост API). JWT підписаний для свого оточення (`iss=ubc-prod`), тож dev-токен на проді не прийметься. «Вийти» і «Це не я» відкликають усі сесії людини з точністю до мілісекунди. Адмін може відкликати будь-кого (розділ 4). |
| Ліміти запитів | На IP: `start` 10/хв, `poll` 90/хв, `handoff` 10/хв, `logout` 20/хв, `report/public` 120/хв. На людину (після входу): `report/secret` 30/хв, `auth/me` 60/хв. Перевищення дає 429 і запис у журнал безпеки. |
| Заголовки | API: `no-store`, `nosniff`, `X-Frame-Options: DENY`, CSP `default-src 'none'`, `Referrer-Policy`, HSTS (dev/prod). Сайт: `public/_headers` із суворою CSP і забороною вбудовування. |
| Пересилання | Скріншоти сайт заборонити **не може** і навіть не дізнається про них. Тому витік робимо відстежуваним (`Protected.tsx`): плашка внизу «🔒 Переглядає ID … · дата й час» є на кожному скріні, а той самий підпис **невидимим** знаком (2%) лежить на всьому звіті. Звіт розмивається, коли сторінка неактивна; копіювання й друк вимкнені. |
| Журнал переглядів | `report_views`: Telegram ID, час, IP, браузер. Зберігається `VIEW_LOG_RETENTION_DAYS` (180 днів) і чиститься сам. Тригери в базі забороняють змінювати записи й видаляти молодші за 30 днів. |
| Журнал безпеки | Таблиця `security_events` у SQLite (переживає перезапуски) + рядок JSON у лог контейнера (ротація 5×10 МБ). Тригери в базі забороняють змінювати записи й видаляти молодші за 30 днів. 180 днів зберігання. Токени й nonce туди не потрапляють. |

### Ключові файли

| Файл | Роль |
|---|---|
| `api/src/features/auth-telegram/model/bot-updates.service.ts` | Бот: `/start`, перевірка членства, кнопки з числами, підтвердження |
| `api/src/features/auth-telegram/api/auth.controller.ts` | `start`, `poll`, `handoff`, `logout`, `me`, cookie |
| `api/src/entities/login-session/api/nonce.repository.ts` | Стани входу: pending → confirming → authorized / denied |
| `api/src/entities/user/lib/*.guard.ts` | Відкликані сесії та членство на кожному закритому запиті |
| `api/src/shared/http/*` | Ліміти запитів, заголовки безпеки, IP клієнта |
| `api/src/entities/report/api/*` | Закритий звіт, журнал переглядів, автоочищення |
| `api/scripts/private.mjs` | `export` / `import` (тільки prod) / `demo` (тільки local і dev) |
| `src/features/auth-telegram/*` | Фронт: число, кнопка Telegram, опитування, редірект |
| `src/widgets/report-view/ui/*` | Фронт: закритий звіт, плашка, невидимий знак |

---

## 2. Оточення: local, dev, prod

| | **local** | **dev** | **prod** |
|---|---|---|---|
| Сайт | http://localhost:5173 | https://dev.ubc-military-fund.com | https://ubc-military-fund.com |
| API | Vite-проксі `/api` → `127.0.0.1:3001` | https://api-dev.ubc-military-fund.com | https://api.ubc-military-fund.com |
| Бот | @ubc_lviv_auth_bot | @ubc_fund_bot | окремий прод-бот (буде створено) |
| Закриті дані | вигадані (`pnpm private:demo`) | вигадані (`pnpm private:demo`) | **реальні** |
| `APP_ENV` | `local` | `dev` | `prod` |
| Секрети API | `api/.env` | `api/.env.dev` | `api/.env.prod` |
| Docker-конфіг | `docker-compose.yml` + `docker-compose.override.yml` (підхоплюється сам) | `docker-compose.yml` + `docker-compose.server.yml` + `deploy/dev.env` | те саме + `deploy/prod.env` |
| Фронт-змінні | `.env.local` | `.env.dev` (у git) | `.env.production` (у git) |
| Збірка й викладка фронта | `pnpm dev` | `pnpm deploy:dev` | `pnpm deploy` |
| Підняти бекенд | `pnpm docker:up` | `pnpm server:dev` | `pnpm server:prod` |

**Правила, які тримає сам код:**
- **Кожне оточення має свого бота.** Один бот може опитувати лише один процес,
  інакше входи губляться.
- **На dev і prod API не стартує**, якщо `COOKIE_SECURE≠true`, `SameSite=none`
  або хоч одна адреса в `FRONTEND_ORIGIN`/`PUBLIC_SITE_URL` не https. Якщо
  `APP_ENV` не задано, діють правила prod.
- **На dev і prod API не відкриває порт назовні.** Достукатися можна тільки
  через Cloudflare-тунель. Контейнер працює в режимі лише для читання і без
  зайвих прав.
- **`private:demo`** дозволений лише на local і dev, а **імпорт реальних даних**
  — лише на prod.
- **Прод-фронт не збереться**, якщо в `.env.production` немає імені бота або
  `VITE_API_URL` не https.

Шаблони з поясненням кожної змінної: `api/.env.example` (local),
`api/.env.dev.example`, `api/.env.prod.example`, `deploy/*.env.example`.
Справжні файли (`api/.env*`, `deploy/*.env`) у git не потрапляють. У кожному
оточенні свій `JWT_SECRET` (`openssl rand -base64 48`).

> Фронт і API мають бути **same-site**: `dev.` + `api-dev.`, `ubc-military-fund.com` + `api.`.
> На `*.workers.dev` cookie стає сторонньою, і вбудований браузер Telegram її відкидає.

---

## 3. Запуск

### local
```bash
cp api/.env.example api/.env              # один раз; заповнити JWT_SECRET і TELEGRAM_BOT_TOKEN
API_HOST_PORT=3001 pnpm docker:up         # 3000 на цьому Mac зайнятий іншим проєктом
pnpm private:demo                         # вигадані закриті дані
API_PROXY_TARGET=http://localhost:3001 pnpm dev
```
Відкрити http://localhost:5173/members-details-ubc → «Увійти через Telegram».

### Що потрібно зробити руками (один раз)

1. **@ubc_fund_bot** (dev) зробити адміністратором каналу NEST. Права можна вимкнути всі.
2. Створити **прод-бота** в @BotFather, додати його адміном NEST і вписати його ім'я в
   `.env.production` (`VITE_TELEGRAM_BOT=`). Токен прод-бота кладеться **тільки** в
   `api/.env.prod` на сервері.
3. У Cloudflare створити два тунелі, `ubc-dev` і `ubc-prod`, з hostname
   `api-dev.ubc-military-fund.com` та `api.ubc-military-fund.com`, обидва → `http://api:3000`.
4. На сервері скопіювати шаблони, заповнити секрети й підняти оточення (кроки нижче).
5. Перенести реальні закриті дані на prod, а **потім** локально виконати
   `pnpm private:demo`, щоб реальні імена лишились тільки на проді.

### dev і prod: перший запуск на сервері

Нижче для dev. Для prod те саме, тільки `dev` → `prod`, а хости `api.` і `ubc-military-fund.com`.
dev і prod можуть жити на одному сервері: у них різні Docker-проєкти, мережі й бази.

**1. Telegram**
- dev: зробити **@ubc_fund_bot адміністратором каналу NEST** (усі права можна вимкнути).
- prod: створити нового бота в @BotFather, додати його адміном NEST, вписати
  його ім'я в `.env.production` (`VITE_TELEGRAM_BOT=`) і закомітити.

**2. Cloudflare-тунель** (Zero Trust → Networks → Tunnels → Create tunnel, тип *Cloudflared*)
- назва: `ubc-dev`; скопіювати **token**;
- Public hostname: `api-dev.ubc-military-fund.com` → Service `HTTP` → `api:3000`.

**3. Сервер** (потрібні Docker, Node 22+ і pnpm, а також доступ до репозиторію)
```bash
git clone <repo> ubc && cd ubc && pnpm install
cp deploy/dev.env.example deploy/dev.env        # вписати CLOUDFLARE_TUNNEL_TOKEN
cp api/.env.dev.example   api/.env.dev          # вписати JWT_SECRET і TELEGRAM_BOT_TOKEN
mkdir -p api/data-dev && chmod 700 api/data-dev && sudo chown 1000:1000 api/data-dev
chmod 600 api/.env.dev deploy/dev.env
pnpm server:dev                                  # API + тунель
```

**4. Дані** (команди адміністрування на сервері спершу «наводимо» на потрібне оточення):
```bash
set -a; . deploy/dev.env; set +a                 # тепер pnpm db / views / private:* працюють з ubc-dev
docker compose exec -T api node scripts/seed.mjs # публічні цифри
pnpm private:demo                                # dev: вигадані закриті дані
```
Для prod замість `private:demo` реальні дані переносяться з машини, де вони є
(див. «Перенести дані на прод» у розділі 4).

**5. Фронт** (з машини розробника; потрібен `wrangler login`)
```bash
pnpm deploy:dev        # → https://dev.ubc-military-fund.com (домен прив'язується сам, routes у wrangler.jsonc)
pnpm deploy            # → prod
```

**6. Перевірка**
```bash
curl -s https://api-dev.ubc-military-fund.com/health
curl -s -o /dev/null -w '%{http_code}\n' https://api-dev.ubc-military-fund.com/report/secret   # 401
```
Потім увійти з телефона через Telegram і переконатися, що `pnpm views`
показує реальний IP, а не адресу тунелю.

### Оновлення
```bash
git pull && pnpm server:dev          # або server:prod; міграції бази застосовуються самі під час старту
pnpm server:dev:logs                 # логи
```

---

## 4. Підтримка

### Як додати або змінити витрату

Усі витрати живуть в **одній** таблиці `private_expenses`. З неї рахуються обидва звіти:

| Звіт | Що бере з `private_expenses` | Хто бачить |
|---|---|---|
| Закритий | усе, з іменем людини (`person`) і приміткою (`note`) | лише члени NEST |
| Публічний | роки, місяці (останнього року), категорії, 10 останніх витрат, **без** `person` і `note` | усі |

Тож витрата вноситься **один раз**, і суми не можуть розійтися.

**Найзручніше — `pnpm expense:add`** (з папки проєкту, Docker не потрібен): питає по черзі
дату, назву, категорію (зі списку), людину (зі списку наявних), суми й чек, показує підсумок і
записує після «т». Дату «станом на» оновлює сама.

**Або руками в таблиці** (DB Browser for SQLite або TablePlus):
відкрити `api/data/ubc.sqlite` → таблиця `private_expenses` → додати рядок → зберегти
(Write Changes) → оновити сайт.

| Колонка | Що писати |
|---|---|
| `date` | `РРРР-ММ-ДД` |
| `item` | назва українською. **Видно публічно** в «Останніх витратах» |
| `item_en` | назва англійською для англійської версії сайту; порожньо → покажеться українська |
| `category` | точно одне з: `Авто`, `Техніка та аксесуари`, `Військові речі`, `Інше`. Порожньо чи з помилкою → піде в «Інше» |
| `person` | ім'я **точно як уже записано** (інакше з'явиться нова людина); загальна витрата → порожньо (NULL) |
| `note` | примітка лише для закритого звіту, напр. `позика`; або порожньо |
| `price`, `delivery`, `commission` | ціна, доставка, комісія банку (або `0`). Публічна сума = їх сума |
| `has_receipt` | `1` чек є, `0` немає |

Те саме однією командою (локально, бекенд запущений):
```bash
pnpm db --write "INSERT INTO private_expenses (date, item, item_en, category, person, note, price, delivery, commission, has_receipt) VALUES ('2026-10-12', 'Ремонт авто', 'Car repair', 'Авто', 'Петренко', NULL, 5000, 0, 0, 1)"
pnpm db --write "INSERT OR REPLACE INTO private_meta (key, value) VALUES ('generatedAt', '2026-10-12')"
```
`generatedAt` — дата «станом на» під закритим звітом.

Корисне:
```bash
pnpm db "SELECT DISTINCT person FROM private_expenses"           # як записані імена
pnpm db "SELECT id, date, item, category, price FROM private_expenses ORDER BY date DESC"
pnpm db "SELECT * FROM private_expenses WHERE category IS NULL"   # без категорії
pnpm db --write "UPDATE private_expenses SET price = 5200 WHERE id = 21"
pnpm db --write "DELETE FROM private_expenses WHERE id = 21"
```

Рік без розбивки, як 2025, — це рядок у `private_years` із `summary_total`; його
розподіл по категоріях для публічного звіту — у `private_year_categories`.
Регіони, банка й картка — у `fund_regions` і `fund_meta`, назви й кольори категорій — у `fund_categories`.

**Перенести на prod** (з Mac; локальний сервер і бот запускати не треба; повністю
замінює дані витрат на проді, журнали входів і переглядів не чіпає):
```bash
docker compose run --rm -T api node scripts/private.mjs export | ssh root@165.22.80.221 'cd ubc && set -a && . deploy/prod.env && set +a && docker compose exec -T api node scripts/private.mjs import'
```

> Перед масовими змінами на проді зроби копію бази:
> `cp api/data/ubc.sqlite ~/ubc-backup-$(date +%F).sqlite`. У ній імена,
> тож зберігай копію тільки на сервері або зашифрованою.


### Журнал переглядів: хто відкривав звіт

```bash
pnpm views          # за останні 7 днів
pnpm views 30       # за 30 днів
```
Буде дві таблиці: «хто й скільки разів» та «останні 30 переглядів» з часом
(Київ), IP і пристроєм. У базі лежать лише Telegram ID. Імена підтягуються з
Telegram у момент запуску команди й нікуди не записуються. Якщо людина вже
вийшла з каналу, біля імені буде позначка «(вже не в каналі)».

**Якщо злили скрін:** ID і час є на плашці внизу. Якщо плашку обрізали,
прояви невидимий знак: відкрий скрін у будь-якому редакторі (навіть у
вбудованому на телефоні) і викрути «Контраст» та «Експозицію» на максимум,
або застосуй «Рівні/Криві», щоб розтягнути найсвітліші тони. По всьому фону
проступить «ID 123456789 · 11.10.2026 16:14». Сильне стиснення (наприклад,
пересилання як фото в Telegram) або фото екрана іншим телефоном знак можуть
знищити, плашку — ні, якщо її не обрізали.

Далі знайди цей ID у `pnpm views`,
отримаєш ім'я, а за часом видно, який це був перегляд. Прибери людину з каналу
NEST, і доступ до звіту зникне одразу, бо членство перевіряється на кожен запит.

Сирі дані:
```bash
pnpm db "SELECT telegram_id, datetime(viewed_at/1000, 'unixepoch', 'localtime') AS t, ip FROM report_views ORDER BY viewed_at DESC LIMIT 50"
```

### Сесії: вихід і відкликання

Кнопка **«Вийти»** на сторінці звіту завершує всі сесії цієї людини на всіх пристроях.
Адмін може зробити те саме без участі людини (наприклад, якщо телефон загубили або
був витік):
```bash
# одна людина (Telegram ID з `pnpm views`)
pnpm db --write "UPDATE users SET sessions_valid_after = CAST(strftime('%s','now') AS INTEGER) * 1000 WHERE telegram_id = 123456789"
# усі одразу
pnpm db --write "UPDATE users SET sessions_valid_after = CAST(strftime('%s','now') AS INTEGER) * 1000"
```
Щоб людина взагалі втратила доступ, прибери її з каналу NEST: членство
перевіряється на кожен запит.

### Журнал безпеки

```bash
pnpm db "SELECT datetime(ts/1000, 'unixepoch', 'localtime') AS t, event, data FROM security_events ORDER BY ts DESC LIMIT 50"
```
На що звертати увагу:
- `auth.wrong_code` — хтось увів не те число. Якщо повторюється в однієї людини, її, можливо, намагаються обманом змусити підтвердити чужий вхід;
- `session.revoked_by_user` — людина натиснула «Це не я». **Обов'язково** зв'яжися з нею;
- `report.forbidden`, `rate.limited`, `auth.bad_origin` — спроби доступу без права, перебір, запити не з нашого сайту.

### Робота з базою на сервері

Усі адмін-команди (`pnpm db`, `pnpm views`, `pnpm private:*`)
звертаються до Docker-проєкту з поточних змінних оточення. На сервері спершу
наведи їх на потрібне оточення:
```bash
set -a; . deploy/prod.env; set +a        # або deploy/dev.env
pnpm views
```
`pnpm db` без `--write` відкриває базу **лише для читання**, а з `--write`
дозволяє змінювати дані, крім журналів і таблиці міграцій. Команди з іменами
краще починати з пробілу, щоб вони не потрапили в історію терміналу (zsh:
`setopt HIST_IGNORE_SPACE`).

### Бот
- **Бот має бути адміном каналу.** Права можна вимкнути всі. Без статусу адміна
  Telegram відповідає `member list is inaccessible`, і вхід не працює ні для кого.
- **Змінити канал:** додати бота адміном у новий канал → взяти ID
  (`curl https://api.telegram.org/bot<TOKEN>/getChat?chat_id=@username`) →
  `TELEGRAM_CHAT_ID` → перезапустити API.
- **Замінити токен:** BotFather → `/revoke` → новий токен в `api/.env.<оточення>` →
  `pnpm server:prod` (або `server:dev`).
- **Тільки один поллер.** Якщо той самий токен опитують два процеси (два
  сервери, локальний docker і прод одночасно), Telegram ділить оновлення між
  ними, і половина входів «зависає». Скрипти `seed`/`import` поллінг вимикають
  самі. Для локальної розробки краще завести **окремого тестового бота**.

### Діагностика
```bash
pnpm docker:logs                                  # логи API
docker compose ps                                 # стан контейнера (healthy)
pnpm db "SELECT status, telegram_id, origin FROM login_nonces"   # спроби входу
pnpm db "SELECT * FROM users"                     # хто входив і коли
```

| Симптом | Причина |
|---|---|
| Бот: «Не вдалося перевірити доступ» | Бот не адмін каналу, неправильний `TELEGRAM_CHAT_ID` або Telegram недоступний |
| Бот: «Цей акаунт не в закритій групі» | Людина не підписана на канал, все працює правильно |
| Бот мовчить на Start | API не запущено, або цього бота опитує інший процес |
| Бот: «Число не збіглося» | Людина натиснула не те число. Спроба скасована, треба почати вхід на сайті заново |
| Сайт: «Посилання застаріло» одразу | Вхід почали в іншому браузері або в режимі інкогніто: сесію забирає лише браузер, що почав вхід |
| 429 Too Many Requests | Спрацював ліміт запитів (`rate.limited` у журналі безпеки). Минає за хвилину |
| Бот підтвердив, а сайт не пускає | nonce у статусі `authorized`, але не забраний: вкладку сайту закрили. Натиснути кнопку в повідомленні бота |
| Після входу знову просить увійти | cookie не зберігається: перевірити same-site, `COOKIE_DOMAIN`, `COOKIE_SECURE` |

---

### Версії

Версія записується в `package.json` і `api/package.json`, завжди однакова в обох
(сайт і API випускаються разом). Формат `МАЖОРНА.МІНОРНА.ПАТЧ`:

| Що змінилось | Яку цифру піднімати | Приклад |
|---|---|---|
| Виправлення без нових можливостей | ПАТЧ | 1.1.0 → 1.1.1 |
| Нова можливість, нічого не ламає | МІНОРНА (патч у 0) | 1.1.1 → 1.2.0 |
| Ламає сумісність (інший формат API, обов'язкові нові змінні) | МАЖОРНА | 1.2.0 → 2.0.0 |

Поточна **1.1.0**: бекенд, вхід через Telegram, закритий звіт, оточення
local/dev/prod. Версію піднімають у тому ж коміті, що й зміни.

---

## 5. Перед продом — чекліст

- [ ] Новий **прод-бот** в @BotFather, адмін каналу NEST. Токен — **лише** в
      `api/.env.prod` на сервері, ім'я — в `.env.production`.
- [ ] Токен @ubc_lviv_auth_bot засвітився в переписці: перевипустити (`/revoke`).
- [ ] `api/.env.prod`: свій `JWT_SECRET`, `APP_ENV=prod`, `JWT_EXPIRES_IN=15m`.
- [ ] Тунелі `ubc-dev` і `ubc-prod` → `api:3000`. Порт 3000 на сервері назовні не
      відкривати (compose його й не публікує).
- [ ] `chmod 700 api/data-prod`, `chmod 600 api/.env.prod deploy/prod.env`. Диск
      сервера зашифрований, бекапи SQLite теж шифрувати (`age`/`gpg`): там імена й суми.
- [ ] Реальні дані перенесено на prod, локально виконано `pnpm private:demo`.
- [ ] `curl https://api.ubc-military-fund.com/report/secret` без cookie повертає **401**.
- [ ] Вхід перевірено з телефона: у Telegram-браузері, у Safari, у Chrome.
      Якщо всюди працює, можна спробувати `COOKIE_SAMESITE=strict`.
- [ ] У Cloudflare не вмикати «Cache Everything» для `api.` та `api-dev.`.
- [ ] `pnpm views` на сервері показує реальні IP, а не адресу тунелю.
- [ ] Раз на тиждень переглядати журнал безпеки (розділ 4): `auth.wrong_code`, `session.revoked_by_user`, `report.forbidden`.
- [ ] Бекап бази (разом із журналами) за межами сервера, зашифрований. Згодом, коли
      з'явиться можливість, журнал безпеки варто ще й пересилати в зовнішнє сховище.
