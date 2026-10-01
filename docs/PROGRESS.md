# PROGRESS

**Última actualización:** 2026-10-01 · Claude Code (Opus 5.5 → Sonnet 5.5)
**Fase actual:** 0 — Base **Estado:** terminada en local; pendiente de CI en GitHub y de la confirmación del desarrollador

## Hecho

- Proyecto movido a `C:\dev\agenda2`; docs en `docs/`.
- Monorepo pnpm, TS estricto, ESLint, Prettier, Vitest (1 test de humo), CI, `docker-compose.yml`, `.env.example`.
- `AGENTS.md` y `CLAUDE.md`.
- typecheck, lint, format, tests y build con código de salida 0 en local.
- `docker compose up -d`: Postgres 17 (healthy), Mailpit (healthy) y n8n (`/healthz` ok) en marcha. `btree_gist`, `unaccent` y `pg_trgm` se crean bien.

## En curso

- Nada. Esperando "siguiente fase".

## Pendiente de la fase

- [ ] Subir la rama `fase-0/base` y comprobar CI verde en GitHub (hace falta `git push`)
- [ ] Merge `--no-ff` a `main` y etiqueta `fase-0`
- [ ] El desarrollador borra la copia antigua en OneDrive cuando lo confirme

## Decisiones recientes

F0-1 a F0-9 en `docs/DECISIONS.md`.

## Comandos útiles

- Levantar: `docker compose up -d` (tras `cp .env.example .env`)
- Todo: `pnpm check` (en PowerShell)

## Para quien continúe (Claude o Codex)

Lee AGENTS.md, docs/SPEC.md y este archivo. No cambies decisiones de DECISIONS.md sin avisar.
