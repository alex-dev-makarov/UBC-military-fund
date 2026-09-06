# Tasks

Plan source: `docs/drafts/20260906-1130-telegram-gated-private-report.md`
Questions: `docs/questions.md` (Q1–Q5 answered)

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## G1 — Telegram-gated two-tier report

Public `/report` unchanged; a Telegram-group-verified visitor additionally sees a
private report served by a new NestJS API and never present in the client bundle.

### M1 — API core

- [ ] **PR-01** Workspace + NestJS scaffold: `pnpm-workspace.yaml` →
  `packages: ['.', 'api']`, new `api/` package, `main.ts` with `cookie-parser` and
  env-driven CORS (`origin: FRONTEND_ORIGIN`, `credentials: true`), `GET /health`,
  committed `api/.env.example`, gitignored `.env`.
  *Success:* API boots, `/health` 200, preflight echoes the exact origin +
  `Allow-Credentials: true`, root `pnpm typecheck` && `pnpm build` unaffected.
- [ ] **PR-02** `auth/telegram.service.ts`: `validateTelegramHash` (HMAC-SHA256 +
  `timingSafeEqual`), `isAuthDateFresh`, single-use hash `Map`, `checkGroupMembership`
  via `getChatMember`.
  *Success:* `pnpm --filter api build` passes; functions exported for PR-05 tests.
  `dependsOn: PR-01`
- [ ] **PR-03** Auth module + `POST /auth/telegram` + `GET /auth/me` +
  `POST /auth/logout` + `jwt.guard.ts` reading the `HttpOnly` cookie. Cookie
  `sameSite`/`secure`/`domain` from env.
  *Success:* valid payload gets `Set-Cookie` `HttpOnly`; tampered hash → 401;
  non-member → 403; `/auth/me` 401 without cookie. `dependsOn: PR-02`
- [ ] **PR-04** `report/` module: private TS data constant (with canary string) +
  `GET /report/secret` under `@UseGuards(JwtAuthGuard)`.
  *Success:* 401 without cookie, JSON with it; `grep` of built `dist/assets/*.js`
  for the canary returns no match. `dependsOn: PR-03`
- [ ] **PR-05** Vitest in `api/` only: `validateTelegramHash` (incl. forged hash),
  `auth_date` freshness + replay, `JwtAuthGuard` (missing/malformed/expired/valid).
  *Success:* `pnpm --filter api test` green, negatives assert the exception type.
  `dependsOn: PR-04`

### M2 — Delivery + frontend integration

- [ ] **PR-06** `api/Dockerfile` (multi-stage, **pnpm** + `pnpm deploy --prod`,
  non-root, `CMD node dist/main`, `EXPOSE 3000`) + root `docker-compose.yml` with
  `env_file: ./api/.env` and `3000:3000` + `.dockerignore`.
  *Success:* `docker compose up --build` serves `/health`; image has no dev deps and
  no baked `.env`. `dependsOn: PR-01`
- [ ] **PR-07** New `src/shared/api` slice: `fetch` wrapper with
  `credentials: 'include'`, base URL `VITE_API_URL`, typed `ApiError { status }`;
  typed `ImportMetaEnv`; root `.env.example`.
  *Success:* `pnpm typecheck` passes; 401 surfaces as `ApiError`.
- [ ] **PR-08** New `src/features/auth-telegram`: `TelegramLoginButton` injecting the
  Telegram widget with cleanup, `declare global` typing for `window.onTelegramAuth`,
  `useTelegramAuth` posting to `/auth/telegram`.
  *Success:* typecheck + build pass; unmount removes script and global.
  `dependsOn: PR-07`
- [ ] **PR-09** New `src/widgets/report-view` (`PrivateReportSection`) appended inside
  `ReportPage.tsx` below the recent-spend card; anonymous / 403 / member / loading /
  error states; new keys added to **both** `uk.ts` and `en.ts`.
  *Success:* typecheck (proves dict parity) + build pass; API down → error state only,
  public report intact; canary still absent from `dist`. `dependsOn: PR-07, PR-08`

---

## Cross-cutting architectural notes

- **API hosting:** NestJS cannot run on Cloudflare Workers static assets. API lives in
  `api/` (pnpm workspace package), deployed separately at `api.<domain>`; SPA reaches
  it via absolute `VITE_API_URL`. No Vite proxy.
- **Cookie + CORS are env-driven, never hardcoded.** dev = `SameSite=None; Secure`,
  no `Domain` (two unrelated https tunnels); prod = `SameSite=Lax; Secure;
  Domain=.<domain>`. CORS `origin` is the exact `FRONTEND_ORIGIN` — `*` is illegal
  with `credentials: true`.
- **Secret boundary:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `JWT_SECRET` are
  server-only via `env_file`. Only the **bot username** (`VITE_TELEGRAM_BOT`) is
  public and client-side.
- **Bundle isolation:** no alias/tsconfig path from the frontend into `api/`, no
  shared types package. Frontend DTOs are hand-duplicated. Enforced by the canary
  grep in PR-04 and re-checked in PR-09.
- **Replay protection:** `auth_date` freshness (60 s) + single-use `hash` in an
  in-memory `Map<hash, expiry>` with lazy sweep — chosen deliberately over LRU/Redis
  because the set is bounded by login-rate × 60 s and the API is single-instance.
  Multi-replica scaling invalidates this and needs a shared store.
- **Deviation from prompt:** Dockerfile uses pnpm, not `npm run build` (repo is pnpm
  11 with a pnpm lockfile; API is a workspace package).
- **Verification gates:** `pnpm typecheck`, `pnpm build`, `pnpm --filter api test`,
  `pnpm --filter api build`. **`pnpm lint` is broken (eslint not installed) and must
  never be used as a gate.**
- **i18n:** `uk.ts` derives `TKey`, `en.ts` is `Record<TKey, string>` — every new
  string goes into both files or `tsc` fails.
- **Ops prerequisite (not code):** BotFather `/setdomain` must point at the host
  currently serving the SPA (the widget will not render on `localhost`), and the bot
  must be a member of the private group to use `getChatMember`.
