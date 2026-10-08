# PROGRESS

**Última actualización:** 2026-10-07 · Claude Code (Opus 5.5)
**Fase actual:** 8 — Evals, pulido y publicación (rama `fase-8/evals-pulido`) **Estado:** evals hechas y revisión cruzada final corregida (F8-3); a falta de decidir los pendientes de abajo y del merge. Fases 0 a 7 integradas y etiquetadas, solo en local (`origin/main` va por detrás). Condición del desarrollador: **nada que cueste dinero ni use APIs de pago**.

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

## Hecho en la Fase 8

- Evals (`evals/`): 51 casos en 9 categorías, runner por la ruta real del chat con comprobaciones de sistema y de modelo, `pnpm eval` con informe en `evals/REPORT.md`, y test de CI (`evals.test.ts`) con un modelo simulado crédulo y otro bueno. Resultado: sistema 228/228; modelo sin medir con un modelo real. Decisión F8-1.
- Diagnosticado el fallo de `transports.test.ts`: el escudo web de Avast/AVG rompe el HTTP local (F8-2). No es un fallo del código.
- Revisión cruzada final con subagente: sin hallazgos graves; 13 corregidos (F8-3), entre ellos avisos de propuestas sin confirmar, carreras al cancelar, HTTP fuera de la transacción del outbox, tipo de evento en n8n y payload vaciado al entregar.
- Vídeo del asistente grabado con Playwright (en la carpeta Vídeos del desarrollador, fuera del repositorio).

## Pendiente de la Fase 8 (a decidir con el desarrollador)

- Verificación de email y restablecer contraseña (primer recorte del plan, WORKFLOW §10).
- Despliegue con URL pública: casi cualquier hosting pide tarjeta; sin contratar nada solo se puede dejar preparado.
- Publicar el servidor MCP en npm (opcional; necesita la cuenta del desarrollador).
- Ejecutar `pnpm eval --provider=anthropic` cuando se quiera medir el modelo real (cuesta dinero).

## Hecho en la Fase 7

- API: outbox (`outbox.ts`): cada reserva creada, confirmada desde una propuesta, movida o cancelada anota su evento en la misma transacción. Un temporizador de la API lo entrega a n8n con firma HMAC (`signing.ts`) y reintenta con espera creciente. Rutas `GET /internal/reminders` y `POST /internal/reminders/:id/sent` para n8n, autenticadas solo por la firma. Migración `0005` (`next_attempt_at`, `reminder_sent_at`). Decisiones F7-1 a F7-6.
- n8n: cuatro workflows en `automation/` (reserva creada, movida, cancelada y recordatorio de 24 h), credencial SMTP de Mailpit y variables en `docker-compose.yml`. Correos de texto plano.
- Tests: `outbox.test.ts` (firma, eventos en la transacción, entrega y reintentos con un fetch falso, recordatorios) y las dos rutas nuevas en la tabla de aislamiento.
- Verificado a mano con n8n y Mailpit reales: reservar, mover y cancelar mandan sus correos al cliente y al negocio; el recordatorio lanzado con `n8n execute` envía un correo y marca la reserva, y una segunda ejecución no lo repite.

## Problemas abiertos

- `apps/mcp-server/src/transports.test.ts`: 2 tests del transporte HTTP fallan en este equipo por el escudo web de Avast/AVG (F8-2). Excluyendo `127.0.0.1` del escudo deberían pasar; no se ha podido comprobar el CI porque las ramas no se suben desde la Fase 2.
- La entrega a n8n no tiene test automático contra un n8n real (necesita Docker); los tests de la API usan un fetch falso y la integración se probó a mano.
- Importar de nuevo un workflow desde `automation/` exige copiar los ficheros como root y reiniciar n8n (pasos en el README).

## Pendiente tras la Fase 7

- Proveedor SMTP real y remitente propio (Fase 8).
- Panel: ver los eventos del outbox que agotaron sus reintentos.

## Hecho en la Fase 6

- API: servicio del agente (`apps/api/src/agent`): bucle del modelo con herramientas MCP, interfaz `LlmProvider` (Anthropic, demostración y simulado), prompt, sesiones de chat, topes de gasto, ritmo, tiempo y herramientas, registro en `agent_events`, y degradación sin proveedor. Rutas `GET|POST /public/chat` (SSE), `POST /me/agent/actions/:id/confirm|discard` y `GET /business/agent-events`. Decisiones F6-1 a F6-8.
- Web: chat flotante en las páginas públicas (streaming, estado de herramientas, tarjeta con Confirmar y Descartar, aviso de IA de un tercero, errores con salida al buscador), y **Panel → Asistente** con el registro del agente. Textos de privacidad, preguntas frecuentes y portada actualizados.
- Tests: 29 nuevos de integración con un modelo simulado (el modelo no puede confirmar, aislamiento de propuestas, doble clic, tope de gasto, tiempo, ritmo, fallos, inyección, proveedor de Anthropic con cliente simulado). Isolation con las rutas nuevas. E2E con el guion de demostración: el asistente propone y la reserva solo existe al pulsar el botón.
- **No probado con la API real de Anthropic:** no hay `ANTHROPIC_API_KEY`. Antes de probarlo: límite de gasto en la consola de Anthropic y `LLM_DAILY_BUDGET_EUR` bajo.

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

## Pendiente tras la Fase 6

- Primera prueba con la API real (pedir permiso: consume dinero) y ajustar `LLM_PRICE_*` a la tarifa vigente.
- Sesiones de chat en memoria: con más de una instancia de la API habría que guardarlas fuera.
- La beta de modelos de reserva (`fallbacks`) no está activada.
- Las evals del agente son de la Fase 8.

## Pendiente tras la Fase 5

- El agente web (Fase 6) usará esta API: token de leer y proponer para el modelo, y confirmación por botón.
- Cuando exista el agente: `agent_events` (conversaciones y herramientas llamadas) y el presupuesto de gasto.
- Publicar el paquete en npm queda para la Fase 8 (SPEC §9).

## Pendiente tras la Fase 4

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
