# Design review backlog — 2026-09-29

`/design-review --full` run per folder of `src/` after the fixes in
[2026-09-29.md](2026-09-29.md). Findings raised by two folders are merged
(noted "also: …"). All items start **Open**; flip Status to **Fixed** with the
commit that resolves it.

Totals: 44 items — 3 major, 41 minor (47 raw findings with 5 duplicates merged, plus 2 doc-drift notes).

## Major

| ID | Area | Finding | Location | Fix | Status |
|---|---|---|---|---|---|
| M1 | auth, users | Email canonicalisation (`trim().toLowerCase().pipe(z.email())`) copied in signup and login and already drifting (`max(255)` only on signup) — a drift locks registered users out | `src/modules/auth/dto/login.dto.ts:6`, `src/modules/users/dto/create-user.dto.ts:7` | One `EmailSchema` in `src/common/`, used by both DTOs | Open |
| M2 | infrastructure | `PasswordHasher.verify` swallows every argon2 error as `false`; a native failure or corrupt stored hash looks like a wrong password, with no log | `src/infrastructure/security/password-hasher.ts:26` | Catch only hash-format errors, rethrow the rest, inject `PinoLogger` and log corrupt hashes | Open |
| M3 | infrastructure | Integration test applies a hand-written copy of the `users` DDL (third copy of the schema); the stated reason "bypasses drizzle-kit" no longer holds | `src/modules/users/users.repository.int-spec.ts:22-35` | Run drizzle `migrate()` from `drizzle/` in `beforeAll` | Open |

## Minor

### auth

| ID | Finding | Location | Fix | Status |
|---|---|---|---|---|
| A1 | Authenticated-user shape defined three times (`AuthUser` interface, `AuthUserSchema`, `UserResponseSchema` fields); `AuthUser` vs `AuthUserBody` are two types for one thing (also: common) | `src/common/types/auth-user.ts:3-8`, `src/modules/auth/dto/auth-response.dto.ts:5-10` | One zod schema in `src/common/types`, `AuthUser = z.infer<…>` | Open |
| A2 | `parseJson` swallows `JSON.parse` errors; corrupt Redis data is indistinguishable from an unknown token and leaves no trace | `src/modules/auth/refresh-token.service.ts:53-58` | Log the corrupt case before the 401 | Open |
| A3 | Rejected / reused refresh tokens are not logged (reuse of a single-use token is the signal that matters) | `src/modules/auth/refresh-token.service.ts:39-45` | Inject `PinoLogger`, log `refresh rejected` with `reason`, never the token | Open |
| A4 | `COOKIE_PATH = '/v1/auth'` duplicates the controller route; changing version/path silently breaks the cookie scope | `src/modules/auth/auth.controller.ts:29,31` | Derive both from one constant | Open |
| A5 | "Set refresh cookie + map to response" duplicated in `login` and `refresh` | `src/modules/auth/auth.controller.ts:44-45,62-63` | One private `respond(reply, result)` | Open |
| A6 | Hand-written `CookieRequest` type; `@fastify/cookie` already augments `FastifyRequest` | `src/modules/auth/auth.controller.ts:26` | Use `FastifyRequest` directly | Open |

### users

| ID | Finding | Location | Fix | Status |
|---|---|---|---|---|
| U1 | Repository takes the wire-format `CursorPayload` (ISO string) and converts to `Date` itself | `src/modules/users/users.repository.ts:5,50-51` | `listPage` takes `{ id; createdAt: Date }`; convert in the DTO/service | Open |
| U2 | `UsersService` spec re-tests argon2 directly, duplicating `PasswordHasher`'s own spec | `src/modules/users/users.service.spec.ts:126-142` | Drop the block; assert `hasher.hash` output reaches `repo.create` | Open |

### email

| ID | Finding | Location | Fix | Status |
|---|---|---|---|---|
| E1 | Producer enqueues without validating; a bad `to` fails permanently in the worker after the caller saw success | `src/modules/email/email.service.ts:18` | `SendEmailRequestSchema.parse` before `queue.add`; keep the worker parse | Open |
| E2 | `EmailGateway` always bound to `LoggingEmailGateway`; a production worker marks jobs done without sending | `src/modules/email/email-worker.module.ts:10` | Select adapter via config; refuse the logging adapter in production | Open |
| E3 | Zod issues dropped when rejecting a malformed job — the only trace of a non-retried job | `src/modules/email/email.processor.ts:20-21` | Include issue paths (not values) in the error/log | Open |
| E4 | `onFailed` logs `err.message` only; stack and type lost | `src/modules/email/email.processor.ts:38` | Log `{ err }` like the rest of the repo | Open |
| E5 | Job payload schema (API→worker contract) lives in the worker-side gateway file | `src/modules/email/email.gateway.ts:6-13` | Move to `src/modules/email/dto/` | Open |
| E6 | Result type `{ messageId: string }` re-declared | `src/modules/email/email.processor.ts:18` | Use `SendEmailResult` | Open |

### health

| ID | Finding | Location | Fix | Status |
|---|---|---|---|---|
| H1 | 503 body sets `status: 'degraded'`, which the filter strips (reserved member) — a dead contract; 503 shape untested | `src/modules/health/health.controller.ts:42` | Send `{ checks }` only; add a 503 e2e case | Open |
| H2 | Expected "not ready" is thrown as a 5xx, so the filter logs `error` on every probe while a dependency is down (~12/min/pod) | `src/modules/health/health.controller.ts:41`, `src/common/filters/all-exceptions.filter.ts:80` | Don't log expected 503s as errors (filter) or return readiness without an exception | Open |
| H3 | `ReadinessStatus` allows `status: 'ok'` with a `'down'` check; failure body untyped | `src/modules/health/health.controller.ts:10-18,41-47` | Success checks typed `'ok'`; typed failure body | Open |
| H4 | Readiness aggregation (business rule) lives in the controller | `src/modules/health/health.controller.ts:38-53` | `HealthService` returns a state union; controller maps to 200/503 | Open |

### common

| ID | Finding | Location | Fix | Status |
|---|---|---|---|---|
| C1 | Raw `ZodError` branch returns `flatten()` + "Validation Failed" while the global pipe returns `issues` + "Validation failed" — two shapes for one error | `src/common/filters/all-exceptions.filter.ts:55-58` | Emit the same shape as the pipe path | Open |
| C2 | `catch` is 52 lines (> 50) and mixes mapping, logging and sending | `src/common/filters/all-exceptions.filter.ts:44-95` | Extract pure `toProblem(exception)` | Open |

### infrastructure

| ID | Finding | Location | Fix | Status |
|---|---|---|---|---|
| I1 | `DATABASE_URL` read with four semantics: required in the schema, silent localhost default in seed/drizzle config/test setup, hand-rolled check in migrate (also: config) | `src/infrastructure/database/scripts/seed.ts:7`, `scripts/migrate.ts:11-12`, `drizzle.config.ts:8`, `test/setup.ts:4` | Export `databaseEnv = envObject.pick({ DATABASE_URL: true })` from `src/config`; scripts parse it | Open |
| I2 | `ARGON2_OPTIONS` exported without external users | `src/infrastructure/security/password-hasher.ts:5` | Make it module-private | Open |
| I3 | `Db` type exported but never imported; the int-spec re-derives it | `src/infrastructure/database/drizzle.service.ts:10`, `users.repository.int-spec.ts:14` | Use `Db` in the int-spec | Open |
| I4 | Dummy-hash literal and creation logic written twice (eager + lazy) | `src/infrastructure/security/password-hasher.ts:18,31` | One private `ensureDummyHash()` | Open |
| I5 | `quit()` error discarded before force-disconnect, then "closed" logged as normal | `src/infrastructure/redis/redis.service.ts:29-32` | `logger.warn({ err })` before `disconnect()` | Open |

### config

| ID | Finding | Location | Fix | Status |
|---|---|---|---|---|
| G1 | OTEL defaults duplicated in `tracing.ts`; `.url()` validation never guards the value actually used (also: observability) | `src/config/env.schema.ts:44-46`, `src/observability/tracing.ts:10-12` | Export `otelEnvSchema = envObject.pick(…)`; `tracing.ts` parses it | Open |
| G2 | Hand-rolled boolean parse: `TRUE`/`yes` silently become `false` | `src/config/env.schema.ts:35-39` | `z.stringbool().default(false)` | Open |
| G3 | `JWT_EXPIRES_IN` unvalidated; a bad value fails at first login, not at startup; format differs from the refresh TTL | `src/config/env.schema.ts:16` | Seconds via `z.coerce.number().int().positive()` (or validate the duration pattern) | Open |
| G4 | `CORS_ORIGINS` split in the config factory, so the wildcard refine sees the raw string and `a,,b` passes | `src/config/configuration.ts:29`, `env.schema.ts:31` | Split/trim/validate in a schema `.transform()` | Open |
| G5 | No test for the `appConfig` mapping (incl. CORS parsing) | `src/config/configuration.ts:4-37` | Covered by G4's schema tests | Open |
| G6 | `main.ts` reads `TRUST_PROXY_HOPS` via `parseEnv()` instead of `AppConfigService` with no written reason | `src/main.ts:26` | One-line why (adapter is built before Nest exists) | Open |
| G7 | `export type { AppConfig }` has no consumer outside `src/config` | `src/config/index.ts:5` | Drop the re-export | Open |

### bootstrap / observability

| ID | Finding | Location | Fix | Status |
|---|---|---|---|---|
| B1 | Shutdown imports the concrete `otelSdk` singleton while `app`/`logger` are injected; importing it constructs `NodeSDK` and makes the order untestable (also: observability) | `src/bootstrap/graceful-shutdown.ts:3,25` | Take `flushTelemetry: () => Promise<void>` from `main.ts`/`worker.ts` | Open |
| B2 | No spec for close→flush order, double-signal guard, exit codes | `src/bootstrap/graceful-shutdown.ts:14-31` | `graceful-shutdown.spec.ts` with fakes + `process.exit` spy | Open |
| B3 | No log when shutdown starts or which signal triggered it | `src/bootstrap/graceful-shutdown.ts:10,14-16` | Widen logger to `info`; log `shutting down` with `signal` | Open |
| B4 | v2 doc still prescribes `enableShutdownHooks()` and a separate OTel SIGTERM handler; the pivot is recorded only in one CLAUDE.md line | `docs/Backend-Best-Practices-NestJS-v2.md:202,336,1836,2197,2544,2611` | ADR "custom graceful shutdown" + update the doc | Open |
| O1 | OTLP URLs assembled by hand (`//v1/...` on trailing slash, per-signal env overrides ignored) | `src/observability/tracing.ts:20,24` | Construct exporters without `url`; the library resolves it | Open |
| O2 | `instrumentation-fs: false` / `instrumentation-pino: true` restate defaults and block env toggles | `src/observability/tracing.ts:31-32` | Remove both entries | Open |
| O3 | API and worker share one `OTEL_SERVICE_NAME` (same ConfigMap) — spans indistinguishable | `k8s/deployment.yaml:43`, `k8s/worker-deployment.yaml:32` | Per-Deployment `OTEL_SERVICE_NAME` (`-api`, `-worker`) | Open |

## Documentation drift found during the review

| ID | Finding | Location | Fix | Status |
|---|---|---|---|---|
| D1 | Pilar 7 example still uses `order-confirm:${orderId}` (BullMQ rejects `:`) | `docs/Backend-Best-Practices-NestJS-v2.md` (Pilar 7, `EmailService`) | Use `order-confirm-${orderId}` | Open |
| D2 | "Readiness `/readyz` pings Postgres" — it also pings Redis | `k8s/README.md:49` | Mention Redis | Open |

## Suggested order

1. M1–M3 (correctness and schema-drift risk).
2. Contract/observability gaps that hide failures: E1–E4, A2–A3, H1–H2, C1, I5, B3.
3. Config single-source: I1, G1–G7.
4. DRY/KISS/YAGNI cleanups: A1, A4–A6, U1–U2, E5–E6, H3–H4, C2, I2–I4, O1–O2.
5. Ops and docs: O3, B1–B2, B4, D1–D2.
