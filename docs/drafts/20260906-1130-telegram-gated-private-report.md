# Plan — Telegram-gated two-tier report (public + private)

Date: 2026-09-06
Author: PLANNER
Source questions: `docs/questions.md` Q1–Q5 (all answered)

## Goal

Public `/report` stays exactly as it is. A NestJS API (new workspace package)
authenticates a visitor via Telegram Login, verifies they are a member of a private
Telegram group, issues an `HttpOnly` JWT cookie, and serves a sensitive report that
is never present in the client bundle. The frontend appends a gated section below the
existing public report.

## Ground truth from investigation

- Repo is one frontend package (`ubc-military-fund`): Vite 6 + React 19 + TS 5.8 +
  Tailwind 4, strict FSD with aliases `@app @pages @widgets @features @entities
  @shared @assets`, barrel `index.ts` per slice.
- Deployed as static assets on Cloudflare Workers (`wrangler.jsonc` has only an
  `assets` block). **No server runtime exists** — the API must be hosted elsewhere.
- No `src/shared/api` layer, zero fetch/axios calls anywhere. All data is the
  build-time constant `src/shared/config/fund.ts`, read via pure selectors in
  `src/entities/spend/model/selectors.ts`.
- `src/pages/report/ui/ReportPage.tsx` is the public report (total, `YearBars`,
  `SpendDonut` + `CategoryBars`, `MonthlyChart`, `RecentList`, `BankSheet` CTA).
- `src/widgets/report-deck` already exists — the new widget is `report-view`, no
  collision.
- i18n is key-typed: `uk.ts` defines the dict and derives `TKey`; `en.ts` is
  `Record<TKey, string>`. **Any new string must be added to both files or `tsc` fails.**
- No test framework. `pnpm lint` is already broken (eslint not installed) — it is
  **not** a gate anywhere in this plan.
- Not a git repo yet; `.gitignore` exists with no history.

## Decisions (do not re-litigate during execution)

1. **API location** — new `api/` package inside a real pnpm workspace.
   `pnpm-workspace.yaml` gains `packages: ['.', 'api']`. Runs in dev on port `3000`
   via `pnpm --filter api start:dev`, alongside `vite --host`.
2. **Deployment** — API to a Node host (Fly/Railway/VPS) at `api.<domain>`; SPA stays
   on Cloudflare Workers at `<domain>`. Frontend reaches it via `VITE_API_URL`
   (absolute origin, no proxy).
3. **Cookie + CORS are env-driven, never hardcoded.**
   - dev (two unrelated https tunnel hosts): `SameSite=None; Secure=true`, **no**
     `Domain` attribute.
   - prod (`<domain>` + `api.<domain>`): `SameSite=Lax; Secure=true;
     Domain=.<domain>`.
   - CORS `origin` is the exact `FRONTEND_ORIGIN` value (never `*`, incompatible with
     `credentials: true`), `credentials: true`.
4. **Private data source** — TS constant in `api/src/report/private-report.data.ts`.
   Isolation rules: no alias from the frontend into `api/`, no shared types package
   re-exporting data, frontend `tsconfig`/`vite` graph excludes `api/`. Frontend DTO
   types are **duplicated by hand**, not imported. A canary string inside the private
   data is grepped against built `dist/assets/*.js` as a hard success criterion.
5. **UI shape** — additive. `router.tsx` untouched; the gated section is appended
   inside `ReportPage.tsx`.
6. **Replay protection** — the spec omitted it. Server enforces
   `auth_date` freshness (`AUTH_MAX_AGE_SEC`, default 60) **and** single-use of each
   `hash`. Data structure decision: a plain in-memory `Map<string, number>`
   (hash → expiry epoch) with a lazy sweep on insert. Chosen over an LRU library or
   Redis because the set is naturally bounded by (login rate × 60 s) — a handful of
   entries — and the API is single-instance. If the API is ever scaled to multiple
   replicas this must move to a shared store; noted as a risk, not solved now.
7. **Secrets** — `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `JWT_SECRET` are
   server-only, delivered via `env_file`. The **bot username** is public and is the
   only Telegram value the client needs (`VITE_TELEGRAM_BOT`) for the widget.
8. **Tests** — Vitest in `api/` only: `validateTelegramHash` (incl. forged hash),
   `auth_date` freshness / replay, and `JwtAuthGuard`. No frontend tests.
9. **Gates** — `pnpm typecheck`, `pnpm build`, `pnpm --filter api test`,
   `pnpm --filter api build`. Never `pnpm lint`.

## Recorded deviations from the original prompt

- Dockerfile uses **pnpm** (`corepack`, `pnpm install --frozen-lockfile`,
  `pnpm deploy --filter api --prod` for pruned prod `node_modules`), **not**
  `npm run build`. Reason: the repo is pnpm 11 with a pnpm lockfile and the API is a
  workspace package; an npm-based image would need a second, divergent lockfile.
- `auth_date` freshness + single-use hash checks added (prompt omitted replay
  protection).
- A `GET /auth/me` endpoint and a `POST /auth/logout` are added beyond the specced
  `POST /auth/telegram`, so the SPA can restore session state after reload and clear
  it — without them the cookie is unusable across page loads (it is `HttpOnly`, so JS
  cannot read it).

## Env vars

**API (`api/.env`, from committed `api/.env.example`):**
`PORT=3000`, `FRONTEND_ORIGIN`, `JWT_SECRET`, `JWT_EXPIRES_IN=7d`,
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `AUTH_MAX_AGE_SEC=60`,
`COOKIE_NAME=ubc_session`, `COOKIE_SAMESITE=none|lax`, `COOKIE_SECURE=true`,
`COOKIE_DOMAIN=` (empty in dev).

**Frontend (`.env.local`, from committed `.env.example`):**
`VITE_API_URL`, `VITE_TELEGRAM_BOT` (bot username — public).

Real `.env` / `.env.local` must be gitignored; `.env.example` files are committed.

## Milestones

### M1 — API core (PR-01 … PR-05)
Workspace + Nest bootstrap, Telegram verification service, auth module with cookie
JWT + guard, the private report endpoint, and unit tests.

### M2 — Delivery + frontend integration (PR-06 … PR-09)
Docker image + compose, `shared/api` client, `features/auth-telegram`, and the
`widgets/report-view` gated section mounted into the existing `ReportPage`.

## PR breakdown

### PR-01 — Workspace + NestJS scaffold with env-driven CORS and cookie-parser
- `pnpm-workspace.yaml` → `packages: ['.', 'api']`; new `api/` with `package.json`
  (`@nestjs/{common,core,platform-express,jwt,config}`, `cookie-parser`, dev:
  `typescript`, `@types/node`, `@types/cookie-parser`, `ts-node-dev` or nest CLI),
  `tsconfig.json`, `src/main.ts`, `src/app.module.ts`, `GET /health`.
- `main.ts`: `app.use(cookieParser())`, `app.enableCors({ origin: FRONTEND_ORIGIN,
  credentials: true })`, listen on `PORT`. Commit `api/.env.example`; gitignore
  `.env`, `.env.local`, `api/dist`.
- Success: `pnpm --filter api start:dev` boots; `GET /health` → 200; an `OPTIONS`
  preflight sent with `Origin: $FRONTEND_ORIGIN` returns that exact origin plus
  `Access-Control-Allow-Credentials: true`; root `pnpm typecheck` and `pnpm build`
  still pass unchanged.

### PR-02 — `api/src/auth/telegram.service.ts`
- `validateTelegramHash(data, botToken)` — `crypto.createHmac('sha256',
  sha256(botToken))` over the sorted `key=value\n` data-check-string, compared with
  `timingSafeEqual`; typed `TelegramAuthPayload` (`id, first_name, last_name?,
  username?, photo_url?, auth_date, hash`).
- `isAuthDateFresh(authDate, maxAgeSec)` plus the single-use hash `Map` from
  decision 6. `checkGroupMembership(userId, chatId, botToken)` via `fetch` to
  `getChatMember`, returning true only for `creator|administrator|member`.
- Success: `pnpm --filter api build` passes; the three functions are pure/injectable
  and exported for PR-05's tests; the bot token never appears in any response.
- dependsOn: PR-01

### PR-03 — Auth module, controller, JWT cookie guard
- `auth.module.ts` registers `JwtModule` (`secret: JWT_SECRET`, `expiresIn`).
  `auth.controller.ts`: `POST /auth/telegram` (`@Req`/`@Res`) → validate hash →
  freshness/replay → `checkGroupMembership` → sign JWT → `res.cookie(...)` with
  env-driven `sameSite`/`secure`/`domain`; returns 401 on bad hash/stale, 403 on
  non-member. Plus `GET /auth/me` (guarded) and `POST /auth/logout` (clears cookie).
- `jwt.guard.ts`: reads `req.cookies[COOKIE_NAME]`, `jwtService.verifyAsync`, attaches
  `req.user`, throws `UnauthorizedException` otherwise.
- Success: a curl with a correctly-signed fake payload against a test bot token gets
  `Set-Cookie` with `HttpOnly` and the env-configured attributes; a tampered `hash`
  gets 401; `GET /auth/me` without the cookie gets 401, with it gets the user.
- dependsOn: PR-02

### PR-04 — Private report endpoint + bundle-isolation proof
- `api/src/report/private-report.data.ts` (typed constant, includes a distinctive
  canary string), `report.service.ts`, `report.controller.ts` with
  `GET /report/secret` under `@UseGuards(JwtAuthGuard)`.
- Confirm no frontend path can reach `api/`: no new alias, no shared package, root
  `tsconfig`/`vite.config.ts` include patterns unchanged.
- Success: `GET /report/secret` without cookie → 401, with a valid cookie → the JSON;
  `pnpm build && grep -r "<canary>" dist/assets/*.js` returns **no match**.
- dependsOn: PR-03

### PR-05 — Vitest in `api/` for the three security-critical units
- Add `vitest` + `api` script `test`. Suites: `validateTelegramHash` (valid, forged
  hash, missing field, wrong bot token); `auth_date` freshness + replay (fresh
  accepted, stale rejected, same hash twice rejected); `JwtAuthGuard` (no cookie,
  malformed JWT, expired JWT, valid JWT).
- Success: `pnpm --filter api test` green; each negative case fails for the intended
  reason (asserted on the thrown exception type/status), not incidentally.
- dependsOn: PR-04

### PR-06 — Dockerfile + docker-compose for the API (pnpm-based)
- `api/Dockerfile`, multi-stage: builder on `node:22-alpine` with `corepack enable`,
  copies root `package.json`/`pnpm-lock.yaml`/`pnpm-workspace.yaml` + `api/`, runs
  `pnpm install --frozen-lockfile`, `pnpm --filter api build`, then
  `pnpm deploy --filter api --prod /out`; runtime stage copies `/out` only, runs as a
  non-root user, `CMD ["node", "dist/main"]`, `EXPOSE 3000`.
- `docker-compose.yml` at repo root: one `api` service, `env_file: ./api/.env`,
  `ports: "3000:3000"`, `restart: unless-stopped`. Add `.dockerignore`.
- Success: `docker compose up --build` serves `GET /health` on `localhost:3000`; the
  final image contains no dev dependencies and no `.env` file; `dev` `VITE_API_URL`
  points at the tunnel that fronts this port.
- dependsOn: PR-01 (independent of PR-02…05)

### PR-07 — `src/shared/api` client
- New slice `src/shared/api/{apiClient.ts,index.ts}`: `fetch` wrapper (no axios
  dependency added) with `credentials: 'include'`, base URL from
  `import.meta.env.VITE_API_URL`, JSON parsing, and a typed `ApiError { status }` so
  callers can branch on 401/403. Add `VITE_API_URL`/`VITE_TELEGRAM_BOT` to
  `src/vite-env.d.ts` (or a new `env.d.ts`) as a typed `ImportMetaEnv`.
- Commit root `.env.example`.
- Success: `pnpm typecheck` passes; a 401 response surfaces as `ApiError` with
  `status === 401` rather than a thrown parse error.

### PR-08 — `src/features/auth-telegram`
- `ui/TelegramLoginButton.tsx` injects `https://telegram.org/js/telegram-widget.js`
  (`data-telegram-login` = `VITE_TELEGRAM_BOT`, `data-onauth="onTelegramAuth(user)"`,
  `data-request-access="write"`) into a ref'd container, removes the script and
  deletes the global on unmount. `declare global { interface Window {
  onTelegramAuth?: (u: TelegramUser) => void } }` in a `types.ts`.
- `model/useTelegramAuth.ts` posts the payload to `/auth/telegram` via `apiClient`
  and exposes `status: 'anonymous' | 'pending' | 'member' | 'forbidden' | 'error'`.
  Barrel `index.ts`.
- Success: `pnpm typecheck` + `pnpm build` pass; unmount leaves no injected script
  and no `window.onTelegramAuth`; README/draft notes BotFather `/setdomain` must
  match the dev tunnel host (the widget will not render on `localhost`).
- dependsOn: PR-07

### PR-09 — `src/widgets/report-view` + mount into `ReportPage` + i18n
- `widgets/report-view/ui/PrivateReportSection.tsx`: on mount calls
  `GET /auth/me`; anonymous/401 → heading + explainer + `<TelegramLoginButton />`;
  403 → "not a group member" state; member → fetch `/report/secret` and render it in
  existing `Card`/`Heading` primitives with the established Tailwind tokens.
  Loading and generic-error states included.
- Append `<PrivateReportSection />` in `ReportPage.tsx` after the recent-spend `Card`,
  before the CTA. Everything currently on the page keeps rendering for anonymous
  visitors. Add all new keys to **both** `src/shared/i18n/uk.ts` and `en.ts`.
- Success: `pnpm typecheck` (proves both dicts are complete) and `pnpm build` pass;
  with the API down the section shows the error state and the public report is
  unaffected; `grep` of `dist/assets/*.js` for the canary still returns nothing.
- dependsOn: PR-07, PR-08

## Risks and assumptions

- **Telegram widget cannot run on `localhost`** — BotFather `/setdomain` needs a real
  host, so local end-to-end auth requires an https tunnel for the SPA too, and
  `/setdomain` has to be repointed between dev and prod. Assumed acceptable.
- **Cross-site cookie in dev** — `SameSite=None; Secure` requires https on both
  tunnel hosts; Safari/ITP may still drop it. If it does, the fallback is a
  `Authorization: Bearer` header in dev only, which weakens the `HttpOnly` guarantee —
  flagged, not adopted.
- **Single-instance replay `Map`** — correct only while the API runs one process
  (see decision 6). Horizontal scaling would silently degrade replay protection.
- **`TELEGRAM_CHAT_ID` for a private group** — the bot must already be a member of
  the group and, for supergroups, the numeric `-100…` ID is needed;
  `getChatMember` fails otherwise. Obtaining that ID is an ops step, not code.
- **No git history** — `docker-compose.yml`/`.env` gitignore entries only take effect
  once the repo is initialised; secrets could be committed before that.
- **`pnpm lint` stays broken** by decision and is excluded from every gate.
