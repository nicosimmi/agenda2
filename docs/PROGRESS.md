# PROGRESS

**Última actualización:** 2026-10-06 · Claude Code (Sonnet 5.5)
**Fase actual:** 5 — Servidor MCP (rama `fase-5/servidor-mcp`) **Estado:** terminada a falta de la revisión cruzada y de tu confirmación para el merge. Las Fases 3 y 4 están integradas y etiquetadas.

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

## Hecho en la Fase 5

- API: tokens `agt_` con permisos y caducidad (`/me/tokens`, `GET /me/token`), autenticación por `Authorization: Bearer`, `POST /me/bookings/propose` y `POST /me/bookings/:id/confirm`. Reservar, cancelar y mover directamente exigen `bookings:confirm`. Migración `0004_api_tokens`. Decisiones F5-1 a F5-5.
- `apps/mcp-server`: 13 herramientas (6 públicas, `list_my_bookings`, `propose_booking|cancellation|reschedule`, `confirm_booking|cancellation|reschedule`), ofrecidas según los permisos del token. Transportes stdio y HTTP sin estado. Texto de terceros marcado como dato no confiable.
- Pruebas con un cliente MCP real (en memoria, stdio y HTTP en procesos aparte) y contra Postgres. 291 tests en verde en total.
- Web: sección «Conectar un asistente de IA» en Mis reservas (crear, copiar una vez y revocar tokens).
- Demostrado con un cliente MCP real contra el sistema levantado: el modelo busca, mira huecos y propone; `confirm_booking` no existe para él; la persona confirma con otra conexión.

## Hecho en la Fase 4

- API: `GET /public/categories|businesses|businesses/:slug|businesses/:slug/availability`; `POST /me/bookings` (idempotente), `POST /me/bookings/:id/cancel|reschedule`. Buscador con texto completo, trigramas y filtros. Decisiones F4-1 a F4-5. 210 tests en verde.
- Web: portada con buscador, `/buscar`, ficha `/n/:slug` con reserva en 4 pasos, `/registro`, `/mis-reservas` (cancelar y mover), `/cookies`, `/privacidad`, 404. Modo oscuro con interruptor sol/luna, menú responsive, buscador rápido (`/`), aviso de cookies, subir arriba, esqueletos de carga y preguntas frecuentes en cada página (también en el panel).
- E2E de Playwright: 6 pruebas (propietario, cookies, tema, subir y FAQ, buscador rápido y el recorrido completo del cliente, que comprueba que el negocio ve la cita). Necesita el seed cargado.
- Pendiente de la Fase 3 resuelto: categorías desde la API, `useApi` sin carreras.

## Pendiente tras la Fase 5

- El agente web (Fase 6) usará esta API: token de leer y proponer para el modelo, y confirmación por botón.
- Cuando exista el agente: `agent_events` (conversaciones y herramientas llamadas) y el presupuesto de gasto.
- Publicar el paquete en npm queda para la Fase 8 (SPEC §9).

## Pendiente tras la Fase 4

- El asistente de IA (Fase 6) aparece en la portada como «muy pronto».
- Textos de la interfaz aún en los componentes, no en un fichero único (F4-4).
- El E2E no está en el CI (necesita Postgres migrado, el seed y Chromium).
- Los ajustes de preaviso, horizonte y cancelación del negocio no tienen pantalla en el panel.
- Verificación de email y recuperación de contraseña (Fase 8).

## Hecho en la Fase 3

- Tanda 1 hecha: perfil (`PATCH`), servicios, profesionales (con `serviceIds`), horarios semanales (con avisos de solape), ausencias, lista de comprobación, publicar/despublicar, agenda con filtro por profesional, reserva manual y cambio de estado. Código en `apps/api/src/panel.ts` y `routes/business.ts`; esquemas en `packages/shared`. 160 tests en verde (`pnpm check`). Decisiones F3-1 a F3-5.
- Dirección visual decidida (DECISIONS F3-6 a F3-8): paleta crema/dorado/carbón, Kulim Park autoalojada, `motion` solo para la Fase 4. Plugin y MCP de 21st.dev conectados (solo inspiración).
- Tanda 2, bloque (a) hecho: `apps/web` montado (Vite + React + Tailwind v4, tokens de F3-6, Kulim Park en `public/fonts`, proxy `/api` → API, `react-router-dom`, `src/api.ts`). Hecho también: acceso y alta en dos pasos, y bloque (b): panel con Inicio (lista y publicar), Perfil, Servicios, Equipo (servicios y horario semanal) y Agenda (filtro, reserva manual, estados). Ausencias en Equipo y bloque (c) hechos: E2E de Playwright (`apps/web/e2e`, `pnpm --filter @agendia/web e2e`) que ya encontró y arregló un fallo del cliente (Content-Type sin cuerpo). Interfaz rehecha con Aceternity UI (F3-10, 17 componentes copiados a `apps/web/src/components/ui`, con 3D real: globo, tarjeta 3D, tablet con scroll). Capturas revisadas con Playwright; el E2E sigue en verde. Falta: README al día (hecho), INTERVIEW_NOTES, CHECKPOINT, revisión con subagente y merge. El E2E no está en el CI, pantallas del panel y un E2E de Playwright (alta → publicar → ver agenda). Después: README, INTERVIEW_NOTES, CHECKPOINT y merge.

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
