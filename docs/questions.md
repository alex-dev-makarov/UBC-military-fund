# Open Questions

Log of clarifying questions raised during planning. One entry per question.
Status: `asked` | `answered` | `dropped`

---

## Q1 — Where does the NestJS API live and how is it deployed?

- **Status:** answered
- **Date:** 2026-09-06
- **Asked by:** PLANNER
- **Context:** Repo is a frontend-only single package deployed as static assets on
  Cloudflare Workers (`wrangler.jsonc` has only an `assets` block — no server
  runtime). NestJS cannot run there. `pnpm-workspace.yaml` exists but declares no
  packages. So the API needs a home, a dev story alongside `vite --host`, and a
  production host. This also decides the cookie policy (same-site vs cross-site)
  AND the package manager used inside the backend Docker image: a workspace package
  must be built with pnpm (`--frozen-lockfile` + `pnpm deploy` for a pruned prod
  `node_modules`), while a standalone sibling with its own `package-lock.json` can
  use plain `npm ci` / `npm run build` as the Docker spec describes.
- **Options:**
  - a) New `api/` package in a real pnpm workspace (`pnpm-workspace.yaml` gains
    `packages: [., api]`); deployed to a separate Node host (Fly.io / Railway / VPS)
    on `api.<domain>`; frontend reads `VITE_API_URL`. Cookie set on `.<domain>` →
    `SameSite=Lax` works in prod. Docker image built with pnpm.
  - b) Standalone `api/` directory with its OWN lockfile, outside the pnpm workspace
    (self-contained, `npm ci` in Docker exactly as the Docker spec says); this repo
    otherwise only gets the frontend changes + `VITE_API_URL`. Cross-site cookie →
    `SameSite=None; Secure`.
  - c) Drop NestJS; implement the same flow as a Cloudflare Worker (Hono) in this
    repo so API and SPA share one origin. Contradicts the stated NestJS constraint
    but removes all cross-origin/cookie/deploy complexity.
  - d) Other — describe what you have in mind.
- **Answer:** (a) `api/` as a real pnpm workspace package, deployed to a Node host at `api.<domain>`. pnpm-based Docker image: `--frozen-lockfile`, `pnpm deploy` for pruned prod deps. The Dockerfile does NOT use `npm run build` as the original prompt said — record that deviation explicitly.
- **Resolution:** PR-01 turns `pnpm-workspace.yaml` into a real workspace (`packages: ['.', 'api']`) and scaffolds `api/`. PR-06 builds a pnpm multi-stage image; the `npm run build` deviation is recorded in the draft under Recorded deviations. Prod cookie is `Domain=.<domain>; SameSite=Lax`.

---

## Q2 — Where does the private report's data come from, server-side?

- **Status:** answered
- **Date:** 2026-09-06
- **Asked by:** PLANNER
- **Context:** All fund data today is a build-time TS constant
  (`src/shared/config/fund.ts`) shipped to the browser. The "sensitive" report must
  NOT be bundled into the client or the gate is cosmetic — anyone can read
  `dist/assets/*.js`. It needs a server-side source that never enters the Vite graph.
- **Options:**
  - a) A TS constant inside the API package (e.g. `api/src/report/private-report.data.ts`)
    with its own extended shape — simplest, still versioned in git.
  - b) A JSON file loaded at API runtime from disk (path via env), gitignored — keeps
    sensitive numbers out of the repo.
  - c) An env var / secret store blob (JSON string) — keeps it out of both repo and disk.
  - d) Real datastore (SQLite/Postgres) — heavier, only if the data will be edited often.
  - e) Other — describe what you have in mind.
- **Answer:** (a) TS constant inside the API package. Must never be importable from the frontend: no `@shared` alias reaching into `api/`, no shared types package re-exporting the data, frontend tsconfig/vite must not include `api/` in its graph. Add a verification step grepping built `dist/assets/*.js` for a distinctive private-report string.
- **Resolution:** PR-04 adds `api/src/report/private-report.data.ts` plus a canary string; its success criterion is a grep of `dist/assets/*.js` returning no match. No shared package is created; DTO types are duplicated (not imported) on the frontend.

---

## Q3 — What shape does the private report take in the UI?

- **Status:** answered
- **Date:** 2026-09-06
- **Asked by:** PLANNER
- **Context:** `/report` currently renders the full public report
  (`src/pages/report/ui/ReportPage.tsx`). The task asks for a new
  `widgets/report-view` widget (note: `widgets/report-deck` already exists, no
  collision). Need to know whether the private tier is additive or a replacement,
  since that decides routing and whether a session entity is needed.
- **Options:**
  - a) Additive on the same `/report`: public content unchanged, a gated section
    appended below with the Telegram login button in its place until authorized.
  - b) Replacement on the same `/report`: after auth the whole report swaps to the
    private version (richer numbers, per-item detail).
  - c) Separate `/report/private` route, guarded client-side, with a link from `/report`.
  - d) Other — describe what you have in mind.
- **Answer:** (a) Additive. Public `/report` stays exactly as it renders today from `fund.ts`; the gated private section is appended below it. No route change, no swap.
- **Resolution:** `router.tsx` is untouched. PR-09 appends `<PrivateReportSection />` inside `ReportPage.tsx` after `RecentList`/before the CTA; every existing element keeps rendering for anonymous visitors.

---

## Q4 — Dev-mode transport: Vite proxy or direct cross-origin?

- **Status:** answered
- **Date:** 2026-09-06
- **Asked by:** PLANNER
- **Context:** `HttpOnly` cookies across origins need `SameSite=None; Secure`, which
  browsers reject over plain `http://localhost` in some configurations, and
  `dev` runs `vite --host` (LAN-exposed). Also relevant: Telegram's login widget
  requires a real registered domain via BotFather `/setdomain` — it will not work
  on `localhost` at all, so local auth testing needs a tunnel regardless.
- **Options:**
  - a) Vite `server.proxy` for `/api` → `http://localhost:3000` in dev. Same-origin in
    dev, `SameSite=Lax` everywhere, `VITE_API_URL` defaults to `/api`. Cleanest.
  - b) Direct cross-origin in dev with CORS + `SameSite=None; Secure` and an
    https dev cert / tunnel (cloudflared, ngrok) — matches prod exactly.
  - c) Other — describe what you have in mind.
- **Answer:** (b) Direct cross-origin plus an https tunnel in dev, `SameSite=None; Secure`. Cookie options (sameSite, secure, domain) and CORS `origin` must be env-driven, not hardcoded; BotFather `/setdomain` must point at the dev tunnel host while testing.
- **Resolution:** No Vite proxy. PR-01 introduces `FRONTEND_ORIGIN`, `COOKIE_DOMAIN`, `COOKIE_SAMESITE`, `COOKIE_SECURE` and reads CORS `origin` from `FRONTEND_ORIGIN`; PR-03 derives cookie options from the same env. Dev = `SameSite=None; Secure`, no `Domain`; prod = `SameSite=Lax; Domain=.<domain>`.

---

## Q5 — Do we add a test framework in this scope?

- **Status:** answered
- **Date:** 2026-09-06
- **Asked by:** PLANNER
- **Context:** No test framework is installed and no test files exist. `pnpm lint`
  is already broken (eslint not installed) so it cannot serve as a verification
  gate. The HMAC hash validation, the `auth_date` freshness check and the JWT
  cookie guard are precisely the pieces where a silent bug means a bypassed gate.
- **Options:**
  - a) Add Vitest to the API package only, with unit tests for
    `validateTelegramHash`, `auth_date` freshness and `JwtAuthGuard`. One extra PR.
  - b) Defer all tests; verify manually via curl + a forged-hash negative case
    documented in the plan.
  - c) Add Vitest and also fix `pnpm lint` (install eslint) so there is a real gate.
  - d) Other — describe what you have in mind.
- **Answer:** (a) Vitest in the API package only. Unit-test exactly three things: `validateTelegramHash` (incl. a forged-hash negative case), the `auth_date` freshness/replay check, and the cookie guard (missing cookie, malformed JWT, expired JWT, valid JWT). No frontend tests. Do not add eslint — `pnpm lint` stays broken and must NOT be a verification gate; use `pnpm typecheck` + `pnpm build` + the API's vitest run.
- **Resolution:** PR-05 adds Vitest to `api/` only, with those three suites. `pnpm lint` appears nowhere in any success criterion; gates are `pnpm typecheck`, `pnpm build`, `pnpm --filter api test`.
