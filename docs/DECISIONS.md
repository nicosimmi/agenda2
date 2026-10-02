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

## F1-1. Driver `pg`, TypeScript con Node 24 nativo y `@node-rs/argon2`

- **Decisión:** `pg` (node-postgres) como driver de Drizzle. Los scripts se ejecutan con `node` sin compilar: Node 24 quita los tipos al cargar. Por eso los imports llevan extensión `.ts` (`allowImportingTsExtensions`) y `erasableSyntaxOnly` prohíbe la sintaxis que Node no sabe quitar (`enum`, `namespace`). Para las contraseñas, `@node-rs/argon2`, que trae binarios precompilados y no necesita compilar nada en Windows.
- **Alternativas:** `postgres` (postgres.js); `tsx` para ejecutar TypeScript; `argon2` (node-argon2).

## F1-2. Zonas horarias con `Intl`, sin librería

- **Contexto:** los horarios se guardan en hora local del negocio y las reservas en UTC. Hay que convertir de una a otra respetando los cambios de hora.
- **Decisión:** `packages/core/src/time.ts` calcula el desfase con `Intl.DateTimeFormat`. Una hora que no existe (el salto de primavera) se desplaza hacia delante. Una hora que se repite (otoño) se interpreta como la segunda vez que ocurre.
- **Alternativas:** Luxon o date-fns-tz (otra dependencia más); `Temporal` (Node 24 aún no lo trae sin flag).

## F1-3. `bookings.ends_at` incluye el buffer del servicio

- **Contexto:** el buffer (tiempo de limpieza o preparación) también ocupa al profesional.
- **Decisión:** `ends_at = starts_at + duración + buffer`, es decir, el momento en que el profesional vuelve a estar libre. Así la restricción de exclusión protege también el buffer y el motor de disponibilidad no necesita conocer el servicio de cada reserva. Para mostrar la hora de fin al cliente se resta el buffer.
- **Alternativas:** guardar solo la duración y aplicar el buffer al calcular (la base de datos no lo protegería); una columna `blocked_until` aparte.

## F1-4. Tests de integración en una base `agendia_test`

- **Decisión:** los tests que tocan Postgres crean (si no existe) y migran `agendia_test` en el mismo contenedor, y vacían las tablas antes de cada test. Los datos del seed de desarrollo no se tocan. En local hace falta `docker compose up -d`. En CI, un servicio de Postgres y `DATABASE_URL`.
- **Alternativas:** Testcontainers (otra dependencia); saltarse los tests si no hay base de datos (un fallo silencioso).

## F1-5. `search_vector` con trigger

- **Decisión:** un trigger `BEFORE INSERT OR UPDATE` calcula el vector a partir del nombre, la categoría, la ciudad y la descripción, sin tildes. No puede ser una columna generada porque `unaccent` no es `IMMUTABLE` y la categoría está en otra tabla. Para los índices se usa `f_unaccent`, un envoltorio inmutable.
- **Limitación:** si se renombra una categoría, los vectores no se recalculan. Las categorías son fijas (seed), así que no se cubre.

## F1-6. Clave de `idempotency_keys` = `(user_id, key)`

- **Decisión:** la misma clave enviada por dos usuarios distintos no colisiona ni devuelve la respuesta del otro.

## F1-7. Código de reserva

- **Decisión:** 10 caracteres de un alfabeto sin caracteres ambiguos (sin 0/O ni 1/I/L), generados con `crypto.randomInt`, con unos 8·10¹⁴ valores posibles. La unicidad la garantiza la base de datos (`UNIQUE`).
