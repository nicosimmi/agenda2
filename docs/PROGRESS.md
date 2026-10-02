# PROGRESS

**Última actualización:** 2026-10-02 · Claude Code (Opus 5.5)
**Fase actual:** 2 — Auth, roles y aislamiento **Estado:** terminada en la rama `fase-2/auth-aislamiento`, pendiente de confirmación para merge a `main` y etiqueta `fase-2`. Siguiente: Fase 3 (panel del negocio) con Sonnet 5.5.

## Hecho

- Fases 0 y 1 cerradas (etiquetas `fase-0`, `fase-1`).
- Fase 2, rama `fase-2/auth-aislamiento`:
  - API Fastify (`apps/api/src/app.ts`, `server.ts`): errores uniformes, helmet, CORS, CSRF por `Origin`, rate limiting.
  - Sesiones en la tabla `sessions` (hash SHA-256, cookie `sid`), rotación al hacer login, limpieza de caducadas.
  - Auth: `POST /auth/register|login|logout`, `GET /auth/me`. El alta de negocio crea un negocio en `draft`.
  - `TenantContext` con tipo marcado (`tenant.ts`); rutas `/business/profile`, `/business/bookings`, `/me/bookings`, `/admin/businesses/:id/suspend`.
  - `withIdempotency` (aún sin ruta que la use; la usará `POST /me/bookings` en la Fase 4).
  - Suite de aislamiento con tabla de rutas (`isolation.test.ts`). 69 tests en verde y CI verde.
  - Revisión cruzada (subagente sin contexto) hecha: sin hallazgos graves; corregidos 7 de 9, decisiones F2-1 a F2-9.
- RLS aplazada (F2-5).

## Pendiente para fases posteriores

- Fase 3 (baja): validar con Zod que `min_notice_min`, `max_horizon_days` y `cancel_limit_hours` no sean negativos y avisar si las franjas de un profesional se solapan.
- Fase 3: cada ruta nueva del panel entra en la tabla `ROUTES` de `isolation.test.ts` con su test de aislamiento (el CI lo exige).
- Fase 4 (media): una reserva `pending` caducada sigue bloqueando el hueco en la restricción de exclusión hasta que pase a `expired`. Al reservar, expirar las propuestas caducadas dentro de la misma transacción antes de insertar.
- Fase 4 (baja): traducir `23P01` a un 409 claro; validar que el rango de fechas de disponibilidad sea corto.
- Fase 4 (baja): en `withIdempotency`, guardar un hash de método + ruta + cuerpo y responder 422 si la misma clave llega con otro cuerpo; validar la longitud de la cabecera `Idempotency-Key` (1–255).
- Fase 4: aislamiento de búsqueda (negocios `draft`/`suspended` no aparecen ni admiten reservas).

## Comandos útiles

- Levantar: `docker compose up -d` (tras `cp .env.example .env`) · API: `pnpm --filter @agendia/api dev`
- Migrar: `pnpm --filter @agendia/api db:migrate` · Generar migración: `pnpm --filter @agendia/api db:generate`
- Todo: `pnpm check` (en PowerShell, con `%LOCALAPPDATA%\corepack-bin` en el PATH; los tests de integración necesitan Postgres levantado)

## Para quien continúe (Claude o Codex)

Lee AGENTS.md, docs/SPEC.md y este archivo. No cambies decisiones de DECISIONS.md sin avisar.
