# UBC Military Fund 
https://ubc-military-fund.com/

```bash
pnpm install
pnpm dev          
pnpm build       
pnpm preview      
pnpm deploy       # build + wrangler deploy on Cloudflare
```


## Оточення та вхід через Telegram

Детальна документація (оточення, викладка, безпека) лежить локально в `docs/` і в git не входить.

```bash
pnpm docker:up                                      # local: бекенд (порт 3001)
pnpm expense:add                                    # local: додати витрату
pnpm dev                                            # local: фронт
pnpm server:dev   | pnpm server:prod                # сервер: бекенд + Cloudflare-тунель
pnpm deploy:dev   | pnpm deploy                     # фронт на Cloudflare
pnpm views                                          # хто відкривав звіт
```
