# AgendIA

Marketplace de reservas donde los negocios con citas (barberías, fisioterapia, pádel, estética…) se dan de alta y los clientes los buscan y reservan, bien con una interfaz clásica o con un **asistente de IA** que actúa mediante un **servidor MCP** propio. Proyecto de portfolio.

> **Estado:** Fase 0 (base del monorepo). Consulta `docs/PROGRESS.md`.

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

## Calidad

```powershell
pnpm typecheck      # TypeScript estricto
pnpm lint           # ESLint
pnpm format:check   # Prettier
pnpm test           # Vitest
pnpm check          # todo lo anterior
```

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
