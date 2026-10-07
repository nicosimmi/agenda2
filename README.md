# AgendIA

Marketplace de reservas donde los negocios con citas (barberías, fisioterapia, pádel, estética…) se dan de alta y los clientes los buscan y reservan, bien con una interfaz clásica o con un **asistente de IA** que actúa mediante un **servidor MCP** propio. Proyecto de portfolio.

> **Estado:** Fase 5 (servidor MCP). Consulta `docs/PROGRESS.md`.

## Documentación

- [`docs/SPEC.md`](docs/SPEC.md) — qué se construye
- [`docs/WORKFLOW.md`](docs/WORKFLOW.md) — cómo se trabaja
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — decisiones técnicas
- [`docs/PROGRESS.md`](docs/PROGRESS.md) — estado actual
- [`AGENTS.md`](AGENTS.md) — reglas para agentes de código

## Requisitos (Windows)

- Node.js 24 (ver `.nvmrc`)
- Docker Desktop con WSL2
- pnpm 10.34.6, gestionado por corepack (ver `packageManager` en `package.json`)

Si `corepack enable` falla por permisos, instálalo en una carpeta de usuario:

```powershell
$d = "$env:LOCALAPPDATA\corepack-bin"
New-Item -ItemType Directory -Force $d
corepack enable --install-directory $d
corepack prepare pnpm@10.34.6 --activate
# añade $d al PATH de tu usuario
```

Usa **PowerShell** para los comandos de pnpm.

## Puesta en marcha

```powershell
pnpm install
Copy-Item .env.example .env   # valores solo para desarrollo local
docker compose up -d
```

| Servicio   | URL / puerto          |
| ---------- | --------------------- |
| PostgreSQL | `localhost:5433`      |
| Mailpit    | http://localhost:8025 |
| n8n        | http://localhost:5678 |

## Base de datos

```powershell
pnpm --filter @agendia/api db:migrate   # aplica las migraciones a la base de .env
pnpm --filter @agendia/api db:seed      # carga los datos de demostración (borra los datos existentes)
```

El seed crea 8 negocios ficticios en Córdoba, Sevilla, Málaga, Madrid y Las Palmas, más un negocio en borrador con textos manipuladores para las evaluaciones del agente (Fase 8). Cuentas de demostración, todas con la contraseña `demo-1234` (solo para desarrollo y demo):

| Cuenta                                 | Rol                                                              |
| -------------------------------------- | ---------------------------------------------------------------- |
| `cliente@demo.agendia.test`            | cliente                                                          |
| `admin@demo.agendia.test`              | administrador de plataforma                                      |
| `<slug-del-negocio>@demo.agendia.test` | propietario (por ejemplo `barberia-el-califa@demo.agendia.test`) |

Para generar una migración nueva tras cambiar `schema.ts`: `pnpm --filter @agendia/api db:generate`.

## API

```powershell
pnpm --filter @agendia/api dev   # http://127.0.0.1:3000 (se reinicia al guardar)
```

Rutas: `GET /health`; públicas `GET /public/categories|businesses|businesses/:slug|businesses/:slug/availability`; `POST /auth/register|login|logout`, `GET /auth/me`; de cliente `GET|POST /me/bookings` (con `Idempotency-Key`) y `POST /me/bookings/:id/cancel|reschedule`; de propietario `/business/*` (perfil, servicios, equipo, horarios, ausencias, agenda y publicación); y `POST /admin/businesses/:id/suspend`. Los errores siempre tienen la forma `{ "error": { "code", "message" } }`.

La sesión va en una cookie `sid` HttpOnly. Las peticiones que cambian datos desde el navegador tienen que venir de un origen de `WEB_ORIGIN` (protección CSRF). Con `curl` no hace falta cabecera `Origin` mientras no se envíe la cookie.

## Web

```powershell
pnpm --filter @agendia/web dev   # http://localhost:5173 (con la API en marcha)
```

La portada está en `/`, la búsqueda en `/buscar`, la ficha de un negocio en `/n/:slug`, el acceso en `/entrar`, el alta de cliente en `/registro`, el alta de negocio en `/alta`, las reservas del cliente en `/mis-reservas` y el panel en `/panel`. El interruptor sol/luna cambia el tema y la tecla `/` abre el buscador rápido. En desarrollo Vite reenvía `/api` a la API, así que la cookie de sesión es del mismo origen. Para verla desde el móvil: `pnpm exec vite --host` dentro de `apps/web`, y añade el origen de la IP del PC a `WEB_ORIGIN`.

Los componentes visuales de `apps/web/src/components/ui` son de [Aceternity UI](https://ui.aceternity.com) (código abierto que se copia al repo, no una dependencia), con los colores adaptados a la paleta. Llevan `@ts-nocheck` y están fuera del lint. La imagen del tablet de la portada es una captura real del panel (`public/img/panel-agenda.png`).

## Servidor MCP

`apps/mcp-server` expone la plataforma a clientes compatibles con [MCP](https://modelcontextprotocol.io) (Claude Desktop, el inspector de MCP, el agente de la web). Es un cliente delgado de la API: no tiene lógica propia, así que las reglas de aislamiento, permisos y disponibilidad son las de la API.

| Permiso del token   | Herramientas que ofrece                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| ninguno (sin token) | `search_businesses`, `get_business_info`, `list_services`, `list_staff`, `check_availability`, `search_faq` |
| `bookings:read`     | `list_my_bookings`                                                                                          |
| `bookings:propose`  | `propose_booking` (y `propose_cancellation` y `propose_reschedule`, con `read`)                             |
| `bookings:confirm`  | `confirm_booking`, `confirm_cancellation`, `confirm_reschedule`                                             |

Reservar es siempre en dos pasos: una **propuesta** retiene el hueco 10 minutos pero no es una reserva; solo la **confirmación**, con otro permiso, la hace definitiva. A la conexión de un modelo se le dan solo `read` y `propose`, así que no puede reservar ni aunque lo intente.

Para probarlo:

1. Entra en la web con una cuenta de cliente y, en **Mis reservas → Conectar un asistente de IA**, crea un token (el preset «Para un asistente de IA» sirve) y cópialo: solo se muestra una vez.
2. Configura tu cliente MCP con el servidor stdio (la web te da el fragmento para Claude Desktop):

```json
{
  "mcpServers": {
    "agendia": {
      "command": "node",
      "args": ["RUTA/AL/PROYECTO/apps/mcp-server/src/stdio.ts"],
      "env": { "AGENDIA_API_URL": "http://localhost:3000", "AGENDIA_TOKEN": "agt_…" }
    }
  }
}
```

3. También hay una versión HTTP sin estado para servicios (`pnpm --filter @agendia/mcp-server start:http`, puerto `MCP_PORT`, solo en `127.0.0.1`). Cada petición lleva su token en `Authorization: Bearer …`.

Sin token solo hay lectura pública. Un token caduca (1 hora por defecto) y se puede revocar; nunca puede crear otros tokens. El texto que escriben los negocios llega marcado como `<dato_no_confiable>` para que el modelo no lo trate como instrucciones. Limitación conocida: un cliente con un token de «acceso completo» también ve las herramientas `confirm_*`.

## Asistente de IA

La web incluye un chat (botón «Asistente», abajo a la derecha) que busca negocios, mira huecos y **prepara** una reserva, una cancelación o un cambio de hora. No la hace: la tarjeta que aparece tiene un botón «Confirmar» y solo ese clic ejecuta la acción. Está en `apps/api/src/agent`.

Cómo está montado, de dentro afuera:

- El modelo se llama a través de una interfaz propia, `LlmProvider`. Hay tres implementaciones: Anthropic, un guion de demostración y un modelo simulado para los tests (ningún test llama a un LLM real).
- Cada chat abre una conexión MCP para el modelo con un token de `read` + `propose`, de una hora y propio de la persona. Esa conexión no tiene herramientas `confirm_*`; el servidor ni siquiera las intenta si el modelo las nombra.
- La tarjeta se construye con lo que devolvió la API, no con el texto del modelo. La acción queda guardada en la sesión del chat.
- El botón llama a `POST /me/agent/actions/:id/confirm` (solo con la sesión del navegador de un cliente; un token no puede). El servicio abre entonces otra conexión con un token de `confirm` de cinco minutos, ejecuta y lo revoca.
- Límites: 1000 caracteres por mensaje, 8 herramientas por turno, 60 s por turno, 12 mensajes cada 10 minutos por chat, 20 peticiones por minuto por IP, y topes de gasto diarios (global, por persona y por chat) calculados con los tokens que guarda `agent_events`.
- Si no hay proveedor (sin clave), si se alcanza el tope o si el modelo falla, el chat lo dice y enlaza con el buscador de siempre. El resto de la web no depende de él.

Para activarlo en local, en `.env`:

- **Con la API de Anthropic:** pon `ANTHROPIC_API_KEY`. Antes, fija un límite de gasto en la consola de Anthropic y un `LLM_DAILY_BUDGET_EUR` bajo. El modelo por defecto es `claude-opus-5-5` con esfuerzo `low` (`LLM_MODEL`, `LLM_EFFORT`).
- **Sin clave:** `LLM_PROVIDER=demo` usa un guion fijo (no es un modelo) que recorre todo el flujo: busca, mira huecos, propone y espera tu clic. No se admite en producción.

El negocio ve en **Panel → Asistente** qué ha hecho el asistente en su negocio (consultas, propuestas, confirmaciones), sin el texto de las conversaciones.

## Calidad

```powershell
pnpm typecheck      # TypeScript estricto
pnpm lint           # ESLint
pnpm format:check   # Prettier
pnpm test           # Vitest
pnpm check          # todo lo anterior
```

La suite de aislamiento (`apps/api/src/isolation.test.ts`) recorre una tabla con todas las rutas de la API: si se añade una ruta sin meterla en la tabla, o una ruta de cliente o de negocio sin su test de aislamiento, el CI falla.

Los tests de integración usan Postgres real (la base `agendia_test`, que se crea sola), así que hace falta `docker compose up -d` antes de `pnpm test`.

Pruebas de extremo a extremo con Playwright (alta y publicación de un negocio, y el recorrido de un cliente: buscar, reservar, ver y cancelar). Necesitan Postgres migrado y el seed cargado (`pnpm --filter @agendia/api db:seed`):

```powershell
pnpm --filter @agendia/web exec playwright install chromium   # solo la primera vez
pnpm --filter @agendia/web e2e
```

Levanta su propia API (puerto 3100) y su propio Vite (5174), pero necesita Postgres migrado y usa la base de `.env`. No forma parte de `pnpm check`.

Ningún test automático llama a un LLM real.

## Estructura

```
apps/web  apps/api  apps/mcp-server
packages/core  packages/shared
automation/  evals/  docs/
```

## Variables de entorno

Documentadas en [`.env.example`](.env.example). Los secretos (por ejemplo `ANTHROPIC_API_KEY`) van solo en `.env`, que Git ignora.

## Automatizaciones (emails con n8n)

Cuando una reserva se crea, se cancela o se mueve, la API anota un evento en la tabla `outbox_events`, dentro de la misma transacción. Un proceso de la propia API lo entrega a n8n con una petición firmada (HMAC-SHA256) y, si n8n no responde, lo reintenta con espera creciente. Cuatro workflows de [`automation/`](automation) mandan los correos, que en desarrollo caen en Mailpit:

| Workflow            | Cuándo                                           | Quién recibe                              |
| ------------------- | ------------------------------------------------ | ----------------------------------------- |
| `reserva-creada`    | Reserva nueva o propuesta confirmada             | Cliente y negocio                         |
| `reserva-movida`    | El cliente cambia la hora                        | Cliente y negocio                         |
| `reserva-cancelada` | Cancela el cliente o el negocio                  | Cliente (y negocio si cancela el cliente) |
| `recordatorio-24h`  | Cada 15 minutos busca citas en las próximas 24 h | Cliente                                   |

Para configurarlo, una sola vez, pon en `.env` `AUTOMATION_SECRET` con un valor largo (`node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`) y `N8N_WEBHOOK_BASE=http://localhost:5678/webhook`. Sin `N8N_WEBHOOK_BASE`, la API no entrega nada y los eventos esperan en la tabla.

Los workflows se importan en n8n así (PowerShell, desde la raíz del repositorio):

```powershell
docker compose up -d
docker compose exec -u root n8n rm -rf /tmp/automation
docker compose cp automation n8n:/tmp/automation
docker compose exec -u root n8n chmod -R a+rX /tmp/automation
docker compose exec n8n n8n import:credentials --input=/tmp/automation/credentials/mailpit.json
docker compose exec n8n sh -c 'for f in /tmp/automation/*.json; do n8n import:workflow --input=$f; done'
docker compose exec n8n sh -c 'for id in agendia-reserva-creada agendia-reserva-cancelada agendia-reserva-movida agendia-recordatorio-24h; do n8n publish:workflow --id=$id; done'
docker compose restart n8n
```

Para probarlo, arranca la API (`pnpm --filter @agendia/api dev`), reserva como cliente y abre http://localhost:8025: llegan dos correos, uno al cliente y otro al negocio. Para el recordatorio no hace falta esperar: con una cita confirmada que empiece dentro de 24 h y se haya reservado con más de 24 h de antelación, lánzalo a mano (los dos puertos extra evitan chocar con el n8n que ya está en marcha):

```powershell
docker compose exec -e N8N_RUNNERS_BROKER_PORT=5680 -e N8N_PORT=5681 n8n n8n execute --id=agendia-recordatorio-24h
```

Los correos son texto plano a propósito: nada de lo que escribe un cliente se interpreta como HTML. Si cambias un workflow en la interfaz de n8n, expórtalo con `n8n export:workflow` y sustituye el fichero de `automation/`. Los eventos que fallan 8 veces seguidas se quedan en `outbox_events` sin entregar, para revisarlos a mano.
