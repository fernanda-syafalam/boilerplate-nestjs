# ADR-0003: Custom graceful shutdown instead of enableShutdownHooks()

**Status:** Accepted
**Date:** 2026-09-30
**Author:** sanjit@xprogroup.com.au
**Deciders:** <TBD>

## Context

The v2 Backend Best Practices document prescribed `app.enableShutdownHooks()`
plus a separate `process.on('SIGTERM')` handler in the OpenTelemetry setup.
On SIGTERM these two run independently, so the order in which Nest closes and
OTel flushes is a race. Spans produced while Nest drains in-flight HTTP
requests and BullMQ jobs are lost if OTel shuts down first. Nest's hooks also
do not call `process.exit`, so a leftover socket can keep the pod alive until
Kubernetes sends SIGKILL.

## Decision Drivers

1. **Deterministic order** — drain first, flush telemetry last.
2. **No lost spans** — telemetry produced during the drain must be exported.
3. **Explicit exit** — the process must terminate on its own.
4. **One implementation** — API and worker must shut down identically.

## Considered Options

1. **Custom `registerGracefulShutdown`** (chosen) — one ordered sequence.
2. **`enableShutdownHooks()` + separate OTel SIGTERM handler** — the previous
   design; handlers race and there is no explicit exit.
3. **`enableShutdownHooks()` only, OTel flushed in `OnApplicationShutdown`** —
   ordering depends on provider registration; still no explicit exit.

## Decision

`enableShutdownHooks()` is NOT used. `registerGracefulShutdown`
(`src/bootstrap/graceful-shutdown.ts`, shared by `src/main.ts` and
`src/worker.ts`) handles SIGTERM and SIGINT:

1. Handles the signal once (a double-signal guard ignores repeats).
2. Logs `shutting down` with the signal.
3. Closes Nest first (`app.close()` drains HTTP and BullMQ workers and runs
   `OnModuleDestroy`).
4. Flushes telemetry. The OTel SDK shutdown is injected by the entrypoint as
   a `flushTelemetry` callback.
5. Calls `process.exit` (exit code 1 if closing the app failed) so a leftover
   socket cannot keep the pod alive until SIGKILL.

## Consequences

### Positive

- A single, ordered, testable sequence; no race between Nest and OTel.
- Spans produced while draining are exported.
- The process always exits.

### Negative

- Every entrypoint must remember to call `registerGracefulShutdown`.
- Forced `process.exit` can cut off work that ignores `app.close()`.

### Neutral

- Kubernetes `terminationGracePeriodSeconds` must cover the drain plus the
  telemetry flush, otherwise SIGKILL arrives first.

## Implementation Notes

1. New entrypoints must call `registerGracefulShutdown` and pass their own
   `flushTelemetry` callback.
2. Do not add `enableShutdownHooks()` or another SIGTERM handler alongside it.
3. Size `terminationGracePeriodSeconds` (and the `preStop` delay) for the
   longest in-flight job plus flush time.

## Related

- [ADR-0001: Use Drizzle ORM over Prisma](./0001-use-drizzle-orm-over-prisma.md)
- [ADR-0002: Vitest + Biome + zod](./0002-tooling-vitest-biome-zod.md)
- [Backend Best Practices v2.0](../Backend-Best-Practices-NestJS-v2.md) —
  Pilar 1 (bootstrap), Pilar 7 (workers), Kubernetes graceful shutdown.
