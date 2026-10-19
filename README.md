# UBC Military Fund
https://ubc-military-fund.com/

Сайт звітності фонду: публічний звіт для всіх і закритий звіт з іменами — лише для
учасників Telegram-каналу (вхід через бота).

| Частина | Де живе | Технології |
|---|---|---|
| Фронт | Cloudflare Workers | React, Vite, Tailwind |
| Бекенд (`api/`) | сервер, Docker, за Cloudflare-тунелем | NestJS, SQLite |

## Новий розробник: як почати

Потрібні Node 22+, pnpm (`corepack enable`), Docker.

```bash
git clone <репозиторій> ubc && cd ubc
pnpm install
cp api/.env.example api/.env      # токен свого бота і свій JWT_SECRET (openssl rand -base64 48)
pnpm docker:up                    # бекенд на localhost:3001
pnpm private:demo                 # вигадані дані для закритого звіту
pnpm dev                          # фронт на http://localhost:5173
```

- **Свій тестовий бот.** Створи бота в @BotFather і зроби його адміном каналу. Один бот не
  може працювати на двох комп'ютерах одночасно, тому в кожного розробника свій.
- **Реальних даних з іменами в розробників немає** — вони лише на prod. Для роботи вистачає `pnpm private:demo`.
- **Секрети не комітимо.** `.env`, `api/.env`, `deploy/*.env` у `.gitignore`. Шаблони — `*.example`.
- **Налаштування сайту** (адреси API, порт) — у `src/shared/config/sites.ts`.

## Як вносити зміни

1. Гілка від `main` → коміти → Pull Request у `main`.
2. CI запускає тести API, перевірку типів і збірку фронта.
3. Після злиття в `main` деплой на prod чекає підтвердження власника (GitHub → Actions →
   Review deployments). Доступ до сервера для цього не потрібен.

## Архітектура

Фронтенд (`src/`, RTK Query) → бекенд (`api/`) → SQLite.

`api/src`:
- `modules/<domain>` — контролер → сервіс → репозиторій (`fund`, `ledger`, `report`, `auth`, `user`, …).
- `integrations/` — monobank, nbu, telegram, google; лише тут зовнішні HTTP-виклики.
- `infra/` — db, config, http, auth, health.
- `app/` — кореневий модуль.

Правила:
- контролери викликають лише сервіси;
- лише `*.repository.ts` і `infra/db` виконують SQL (`database.connection.prepare`);
- зовнішні API — лише через `integrations/`.

## Деплой

Усе робить GitHub Actions (`.github/workflows/deploy.yml`) після пушу в `main`:

```
test + ui  →  deploy-api (сервер)  →  deploy-web (Cloudflare)
```

- **deploy-api** заходить на сервер ключем, який може лише одне: оновити код з `main`
  і запустити `deploy/server-deploy.sh` (бекап бази → перезбірка → перезапуск).
- **deploy-web** викладає на Cloudflare ту саму збірку фронта, що пройшла перевірки.

Вручну на сервері — одна команда: `git pull && pnpm server:prod`.

## Команди

```bash
pnpm docker:up | pnpm docker:down     # локальний бекенд
pnpm dev                              # локальний фронт
pnpm data:pull                        # скопіювати дані prod → локальна база
pnpm --filter api test                # тести API
pnpm typecheck                        # перевірка типів фронта
pnpm views                            # хто відкривав закритий звіт
```

## Витрати через бота

Головна база — на prod. Витрати вносять адміни (`ADMIN_TELEGRAM_IDS` у `deploy/prod.env`) прямо в боті:

```
/add      додати витрату (кроки з кнопками, чеки й фото-звіт файлами)
/edit     змінити витрату
/delete   видалити витрату
/last     10 останніх
/sync 23  повторно записати витрату 23 у Google Таблицю
/id       дізнатися свій Telegram ID
```

Кожна зміна: бекап бази → запис у базу (сайт оновлюється одразу) → рядок у Google Таблиці,
файли — у папку року на Google Диску.

