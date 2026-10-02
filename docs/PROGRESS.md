# PROGRESS

**Última actualización:** 2026-10-02 · Claude Code (Opus 5.5)
**Fase actual:** 1 — Datos multi-negocio y dominio **Estado:** terminada en local; pendiente de push, CI y confirmación

## Hecho

- Fase 0 cerrada: merge a `main`, etiqueta `fase-0` y push.
- Rama `fase-1/datos-dominio`:
  - `packages/core`: `computeAvailability`, una función pura con zonas horarias vía `Intl`. 19 tests, incluidos los de DST de Madrid y Canarias.
  - `apps/api/src/db`: esquema Drizzle (14 tablas, FK compuestas), migraciones `0000_init` (generada) y `0001_custom` (a mano: exclusión, trigger de búsqueda, pg_trgm), `migrate.ts`, `newBookingCode`.
  - Tests de integración contra Postgres (`agendia_test`): concurrencia (23P01), FK compuestas (23503), búsqueda. CI con servicio de Postgres.
- Decisiones F1-1 a F1-7 en `docs/DECISIONS.md`.

## En curso

- Seed hecho. Queda push, CI y checkpoint.
- Modelo recomendado para el seed: Sonnet 5.5.

## Pendiente de la fase

- [ ] Seed y comprobar que carga limpio dos veces seguidas
- [ ] README: migraciones, seed, tests de integración (necesitan Docker)
- [ ] `pnpm check` + push + CI verde
- [ ] CHECKPOINT, notas de entrevista y revisión cruzada con Codex (recomendada)

## Comandos útiles

- Levantar: `docker compose up -d` (tras `cp .env.example .env`)
- Migrar: `pnpm --filter @agendia/api db:migrate` · Generar migración: `pnpm --filter @agendia/api db:generate`
- Todo: `pnpm check` (en PowerShell; los tests de integración necesitan Postgres levantado)

## Para quien continúe (Claude o Codex)

Lee AGENTS.md, docs/SPEC.md y este archivo. No cambies decisiones de DECISIONS.md sin avisar.
