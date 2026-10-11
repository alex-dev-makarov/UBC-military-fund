# UBC Military Fund

Сторінка підтримки збору. React 19 + React Compiler, Vite, Tailwind v4, TypeScript,
архітектура FSD. Дві мови: українська та англійська.

## Команди

Пакетний менеджер — **pnpm** (версія зафіксована в `packageManager`).

```bash
pnpm install
pnpm dev          
pnpm build       
pnpm preview      
pnpm deploy       # build + wrangler deploy on Cloudflare
```


## Оточення та вхід через Telegram

- Підтримка, оточення, викладка, чекліст перед продом: [docs/telegram-auth.md](docs/telegram-auth.md)
- Як влаштована безпека і чому (навчальний): [docs/security-explained.md](docs/security-explained.md)

```bash
API_HOST_PORT=3001 pnpm docker:up                   # local: бекенд
pnpm private:demo                                   # local: вигадані закриті дані
API_PROXY_TARGET=http://localhost:3001 pnpm dev     # local: фронт
pnpm server:dev   | pnpm server:prod                # сервер: бекенд + Cloudflare-тунель
pnpm deploy:dev   | pnpm deploy                     # фронт на Cloudflare
pnpm views                                          # хто відкривав звіт
```
