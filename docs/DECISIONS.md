# DECISIONS

Decisiones técnicas no triviales. Formato: contexto, decisión, alternativas. Las decisiones por defecto D1–D16 están en `docs/SPEC.md` §19.

## F0-1. Proyecto fuera de OneDrive (`C:\dev\agenda2`)

- **Contexto:** el proyecto estaba en una carpeta sincronizada con OneDrive. `node_modules` (miles de enlaces de pnpm) y los volúmenes de Docker dan bloqueos y lentitud con la sincronización.
- **Decisión:** trabajar en `C:\dev\agenda2`.
- **Alternativas:** quedarse en OneDrive y excluir carpetas (frágil).

## F0-2. pnpm 10.34.6 fijado con `packageManager`

- **Contexto:** `pnpm@latest` es la 12.x, pero el corepack instalado (0.34.2) no arranca esa versión (busca `pnpm.cjs` y la 12 trae `pnpm.mjs`).
- **Decisión:** pnpm 10.34.6 (última de la serie 10), activada con corepack instalado en `%LOCALAPPDATA%\corepack-bin` (no requiere administrador).
- **Alternativas:** actualizar corepack globalmente (pide administrador); `npm i -g pnpm`.
- **Nota:** en Git Bash el shim de corepack falla; los comandos pnpm se ejecutan en PowerShell.

## F0-3. TypeScript 6.0.3 (no la 7)

- **Contexto:** `typescript` latest es la 7.0.2, pero `typescript-eslint` 8.71 declara compatibilidad con `>=4.8.4 <6.1.0`.
- **Decisión:** TypeScript 6.0.3. Revisar cuando `typescript-eslint` soporte la 7.
- **Alternativas:** TS 7 sin garantías de compatibilidad con el linter.

## F0-4. `@types/node` 24.x

- **Decisión:** alinear los tipos con Node 24 LTS (`.nvmrc` = 24), no con la última (26).

## F0-5. Versiones exactas en `package.json`

- **Decisión:** sin `^`, para que las builds sean reproducibles. Se actualizan a propósito.

## F0-6. PostgreSQL 17, Mailpit v1 y n8n con versión fija

- **Decisión:** `postgres:17-alpine`, `axllent/mailpit:v1`, `n8n:2.41.5`. Puertos publicados solo en `127.0.0.1`.
- **Nota:** las extensiones (`btree_gist`, `unaccent`, `pg_trgm`) se crean en las migraciones de la Fase 1. Verificado en la Fase 0 que la imagen alpine las incluye (`CREATE EXTENSION` correcto).

## F0-7. Un solo Vitest en la raíz

- **Decisión:** `vitest run` en la raíz recorre `apps`, `packages` y `evals`. Más simple que una configuración por paquete. Se revisará si algún paquete (web) necesita otro entorno.

## F0-8. Importar `AGENTS.md` desde `CLAUDE.md` con `@AGENTS.md`

- **Decisión:** importación, no enlace simbólico: en Windows el enlace requiere permisos y Git lo deja como texto (según la documentación de Claude Code).

## F0-9. PostgreSQL del contenedor publicado en el puerto 5433

- **Contexto:** la máquina del desarrollador tiene un PostgreSQL 16 instalado como servicio de Windows que ocupa el 5432; Docker no podía publicar ese puerto.
- **Decisión:** el contenedor sigue usando 5432 internamente y se publica en `127.0.0.1:5433` (`POSTGRES_PORT`). No se toca el servicio local.
- **Alternativas:** parar el servicio de Windows (invasivo, puede usarse para otros proyectos).

## F0-10. Las notas de entrevista no se versionan

- **Contexto:** `docs/INTERVIEW_NOTES.md` son notas personales de preparación, no documentación del proyecto.
- **Decisión:** el fichero existe solo en local y está en `.gitignore`. WORKFLOW §11 sigue aplicando: se mantiene al cerrar cada fase, pero no se sube.
- **Alternativas:** guardarlo en un repositorio privado aparte.
