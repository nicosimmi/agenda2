# AgendIA

Marketplace de reservas donde los negocios con citas (barberías, fisioterapia, pádel, estética…) se dan de alta y los clientes los buscan y reservan, bien con una interfaz clásica o con un **asistente de IA** que actúa mediante un **servidor MCP** propio. Proyecto de portfolio.

> **Estado:** Fase 3 (panel del negocio). Consulta `docs/PROGRESS.md`.

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

Rutas disponibles por ahora: `GET /health`, `POST /auth/register|login|logout`, `GET /auth/me`, `GET /me/bookings` (cliente), `GET /business/profile` y `GET /business/bookings?from=&to=` (propietario) y `POST /admin/businesses/:id/suspend` (administrador). Los errores siempre tienen la forma `{ "error": { "code", "message" } }`.

La sesión va en una cookie `sid` HttpOnly. Las peticiones que cambian datos desde el navegador tienen que venir de un origen de `WEB_ORIGIN` (protección CSRF). Con `curl` no hace falta cabecera `Origin` mientras no se envíe la cookie.

## Web

```powershell
pnpm --filter @agendia/web dev   # http://localhost:5173 (con la API en marcha)
```

La portada está en `/`, el acceso en `/entrar`, el alta de negocio en `/alta` y el panel en `/panel`. En desarrollo Vite reenvía `/api` a la API, así que la cookie de sesión es del mismo origen. Para verla desde el móvil: `pnpm exec vite --host` dentro de `apps/web`, y añade el origen de la IP del PC a `WEB_ORIGIN`.

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

Prueba de extremo a extremo con Playwright (alta, configuración, publicación y reserva manual):

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

## Importar los workflows de n8n

Pendiente (Fase 7).
