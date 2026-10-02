# PROGRESS

**Última actualización:** 2026-10-02 · Claude Code (Sonnet 5.5)
**Fase actual:** 3 — Panel del negocio (rama `fase-3/panel-negocio`) **Estado:** en curso. Tanda 1 (API) terminada; falta la tanda 2 (interfaz en `apps/web`, que está vacío).

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

## En curso (Fase 3)

- Tanda 1 hecha: perfil (`PATCH`), servicios, profesionales (con `serviceIds`), horarios semanales (con avisos de solape), ausencias, lista de comprobación, publicar/despublicar, agenda con filtro por profesional, reserva manual y cambio de estado. Código en `apps/api/src/panel.ts` y `routes/business.ts`; esquemas en `packages/shared`. 160 tests en verde (`pnpm check`). Decisiones F3-1 a F3-5.
- Dirección visual decidida (DECISIONS F3-6 a F3-8): paleta crema/dorado/carbón, Kulim Park autoalojada, `motion` solo para la Fase 4. Plugin y MCP de 21st.dev conectados (solo inspiración).
- Tanda 2, bloque (a) hecho: `apps/web` montado (Vite + React + Tailwind v4, tokens de F3-6, Kulim Park en `public/fonts`, proxy `/api` → API, `react-router-dom`, `src/api.ts`). Siguiente: alta por pasos, pantallas del panel y un E2E de Playwright (alta → publicar → ver agenda). Después: README, INTERVIEW_NOTES, CHECKPOINT y merge.

## Pendiente para fases posteriores

- Fase 4 (media): una reserva `pending` caducada sigue bloqueando el hueco en la restricción de exclusión hasta que pase a `expired`. Al reservar, expirar las propuestas caducadas dentro de la misma transacción antes de insertar.
- Fase 4 (baja): validar que el rango de fechas de disponibilidad sea corto. (El 409 por `23P01` y la expiración de propuestas caducadas ya están en la reserva manual, `panel.ts`; reutilizarlos en `POST /me/bookings`.)
- Fase 4 (baja): en `withIdempotency`, guardar un hash de método + ruta + cuerpo y responder 422 si la misma clave llega con otro cuerpo; validar la longitud de la cabecera `Idempotency-Key` (1–255).
- Fase 4: aislamiento de búsqueda (negocios `draft`/`suspended` no aparecen ni admiten reservas).

## Comandos útiles

- Levantar: `docker compose up -d` (tras `cp .env.example .env`) · API: `pnpm --filter @agendia/api dev`
- Migrar: `pnpm --filter @agendia/api db:migrate` · Generar migración: `pnpm --filter @agendia/api db:generate`
- Todo: `pnpm check` (en PowerShell, con `%LOCALAPPDATA%\corepack-bin` en el PATH; los tests de integración necesitan Postgres levantado)

## Para quien continúe (Claude o Codex)

Lee AGENTS.md, docs/SPEC.md y este archivo. No cambies decisiones de DECISIONS.md sin avisar.
