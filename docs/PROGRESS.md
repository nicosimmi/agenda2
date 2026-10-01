# PROGRESS

**Última actualización:** 2026-10-01 · Claude Code (Opus 5.5 → Sonnet 5.5)
**Fase actual:** 0 — Base **Estado:** en curso (falta verificar `docker compose up`)

## Hecho

- Proyecto movido a `C:\dev\agenda2`; docs en `docs/`.
- Monorepo pnpm, TS estricto, ESLint, Prettier, Vitest (1 test de humo), CI, `docker-compose.yml`, `.env.example`.
- `AGENTS.md` y `CLAUDE.md`.
- typecheck, lint, format y tests en verde en local.

## En curso

- **Bloqueo:** Docker Desktop no arranca (`Docker Desktop is unable to start`, estado `stopped`). `docker compose config` sí valida.
- Siguiente paso: arrancar Docker Desktop, `docker compose up -d`, comprobar `docker compose ps` y las extensiones de Postgres.

## Pendiente de la fase

- [ ] `docker compose up` verificado
- [ ] Subir rama y comprobar CI verde en GitHub
- [ ] Merge a `main` y etiqueta `fase-0`

## Decisiones recientes

F0-1 a F0-8 en `docs/DECISIONS.md`.

## Comandos útiles

- Levantar: `docker compose up -d` (tras `cp .env.example .env`)
- Todo: `pnpm check` (en PowerShell)

## Para quien continúe (Claude o Codex)

Lee AGENTS.md, docs/SPEC.md y este archivo. No cambies decisiones de DECISIONS.md sin avisar.
