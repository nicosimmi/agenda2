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

## F2-1. Sesiones propias en Postgres, no JWT

- **Contexto:** la web y la API comparten dominio en local y en la demo; hace falta poder cerrar una sesión al momento.
- **Decisión:** un token aleatorio de 32 bytes viaja en la cookie `sid` (HttpOnly, SameSite=Lax, `Secure` en producción) y en la tabla `sessions` se guarda solo su SHA-256. Caduca a los 7 días. Logout borra la fila.
- **Alternativas:** JWT (no se puede revocar sin una lista negra, que acaba siendo una tabla igual); `@fastify/session` o `@fastify/secure-session` (una dependencia más para lo que ocupa unas 30 líneas).

## F2-2. CSRF por comprobación de `Origin`

- **Decisión:** en métodos que cambian datos, si llega `Origin` tiene que estar en `WEB_ORIGIN`, y si llega la cookie de sesión `Origin` es obligatorio. Se suma a SameSite=Lax y a un CORS restrictivo. Los clientes que no son navegador (curl, y el MCP en la Fase 5, que usará un token y no la cookie) no mandan `Origin` ni cookie, así que no les afecta.
- **Alternativas:** token CSRF sincronizado (`@fastify/csrf-protection`): más piezas en la web y en la API para el mismo resultado en navegadores modernos.

## F2-3. Zod a mano en cada handler

- **Decisión:** `schema.parse(req.body)` dentro del handler, y el manejador de errores global convierte el `ZodError` en 400 `VALIDATION_ERROR`. Sin `fastify-type-provider-zod`.
- **Alternativas:** el type provider (otra dependencia; tipa `req.body` automáticamente). Se reconsidera si las rutas crecen mucho en la Fase 3.

## F2-4. Contexto de tenant con tipo marcado (brand)

- **Decisión:** `TenantContext` lleva una marca de tipo que solo puede fabricar `tenantForOwner(db, userId)`, a partir del usuario de la sesión. Las funciones de `tenant.ts` lo exigen como parámetro, y el plugin `/business` lo carga en un `preHandler` común a todas sus rutas. Si alguien construye un contexto con un id de la URL, el compilador lo rechaza (salvo un `as` explícito, fácil de ver en una revisión).
- **Excepción documentada:** `POST /admin/businesses/:id/suspend` recibe el id por parámetro porque el administrador no pertenece a ningún negocio. Solo lo puede llamar `platform_admin`.

## F2-5. RLS de PostgreSQL: aplazado

- **Contexto:** D4 la deja como refuerzo opcional. Con un pool de conexiones exige abrir una transacción por petición con `SET LOCAL app.business_id`.
- **Decisión:** no se activa en el MVP. El aislamiento lo garantizan el contexto de tenant, las FK compuestas y la suite de aislamiento, que es obligatoria. Es el punto 4 del plan de recorte (WORKFLOW §10).
- **Cómo se añadiría:** una política `USING (business_id = current_setting('app.business_id')::uuid)` por tabla de negocio y un rol de base de datos sin `BYPASSRLS` para la API.

## F2-6. Rate limiting en memoria

- **Decisión:** `@fastify/rate-limit` con el almacén en memoria. Login: 10 intentos cada 15 min por IP. Registro: 20 altas de cliente y 3 de negocio por IP y día (la clave incluye el rol, por eso el límite va en `preHandler`, con el cuerpo ya leído).
- **Además:** el login tiene un segundo límite por cuenta (10 intentos por hora y email), para frenar la fuerza bruta repartida entre muchas IPs. A cambio, un atacante puede bloquear temporalmente el login de una cuenta concreta; se acepta en el MVP. Las IPv6 se agrupan por /64. Detrás de un proxy hay que poner su IP o CIDR en `TRUSTED_PROXIES` (Fastify desaconseja confiar por número de saltos, porque permite falsear `X-Forwarded-For`); si no, todas las peticiones tienen la IP del proxy y el límite pasa a ser global.
- **Limitación:** con varias instancias de la API, cada una cuenta por separado. Si se despliega más de una, pasar a Redis (el plugin lo admite).

## F2-7. Idempotencia con cerrojo de transacción

- **Decisión:** `withIdempotency(db, userId, key, run)` abre una transacción, toma `pg_advisory_xact_lock` sobre `(usuario, clave)`, devuelve la respuesta guardada si existe y, si no, ejecuta `run` con la misma transacción y guarda la respuesta. Si `run` falla no se guarda nada y se puede reintentar. Se usará en `POST /me/bookings` (Fase 4).
- **Limitación:** las claves no caducan; falta una limpieza periódica.

## F2-8. El registro revela si un email ya existe

- **Contexto:** el login responde igual (y en el mismo tiempo) exista o no el email, pero el registro devuelve 409 si el email está cogido. La revisión cruzada lo señaló.
- **Decisión:** se acepta. Es lo habitual, el registro está limitado a 20 altas por IP y día, y la alternativa solo tiene sentido con verificación de email (Fase 8): responder siempre "te hemos enviado un correo".

## F2-9. Un propietario, un negocio, impuesto por la base de datos

- **Decisión:** `UNIQUE(user_id)` en `business_members` (D6). Sin ella, `tenantForOwner` podría elegir un negocio distinto entre peticiones si un usuario tuviera dos membresías. Si algún día se permite más de un negocio por usuario, se quita la restricción y el negocio activo pasa a guardarse en la sesión.

## F3-1. Servicios de un profesional dentro del propio profesional

- **Decisión:** `serviceIds` viaja en el cuerpo de `POST /business/staff` y `PATCH /business/staff/:id` y se reemplaza entero en una transacción. No hay ruta aparte `PUT /staff/:id/services`. Antes de guardar se comprueba que todos los servicios sean del negocio (400 si no); las claves foráneas compuestas serían la segunda defensa.
- **Alternativa:** ruta propia por recurso; más rutas y más entradas en la tabla de aislamiento para el mismo efecto.

## F3-2. La reserva manual ignora horario y preaviso

- **Contexto:** el propietario apunta citas por teléfono o de paso, a veces fuera del horario publicado.
- **Decisión:** `POST /business/bookings` solo exige servicio y profesional activos que se correspondan, y que no se solape con otra reserva activa (la restricción de exclusión devuelve 409 «Ese hueco ya está ocupado»). No consulta horario, ausencias, preaviso ni horizonte. Antes de insertar pasa a `expired` las propuestas caducadas de ese profesional.
- **Alternativa:** revalidar con `computeAvailability`, como hará la reserva del cliente en la Fase 4. Se descarta aquí porque impediría el caso de uso.

## F3-3. Borrar archiva si hay historial

- **Decisión:** `DELETE` de un servicio o profesional con reservas lo desactiva (`active = false`) y responde `{ archived: true }`; sin reservas lo borra (horarios y asignaciones en cascada). Las reservas tienen clave foránea a ambos y no se pueden dejar huérfanas.

## F3-4. Esquemas de actualización sin valores por defecto

- **Contexto:** en Zod 4, `.partial()` sobre un campo con `default` aplica el valor por defecto cuando falta, así que un `PATCH` reiniciaba `active` o `description`.
- **Decisión:** en `packages/shared` los esquemas de actualización parten de los campos sin `default`. Un test (`panel.test.ts`) lo fija.

## F3-5. Recortes de alcance de la Fase 3

- **Decisión:** el CRUD de FAQ (SPEC §8) y mover una reserva quedan para cuando los use alguien: la FAQ, el agente (Fase 6); mover, el flujo del cliente (Fase 4). Cancelar y marcar `completed`/`no_show` sí están. El registro del agente también espera a la Fase 6.

## F3-6. Dirección visual: crema, dorado y carbón, con Kulim Park

- **Paleta (elegida por el desarrollador):** `#FAF7F0` fondo · `#FFFFFF` tarjetas y formularios · `#1C1917` texto, títulos y secciones oscuras · `#78716C` texto secundario y bordes · `#C89B3C` acento · `#A67C22` hover y enlaces. Van como variables CSS y tokens de Tailwind en un solo sitio.
- **Contraste (calculado):** el botón dorado lleva texto `#1C1917` (6,9:1); con texto blanco no llega (2,6:1). `#C89B3C` no se usa como color de texto sobre crema (2,4:1). `#A67C22` solo en títulos grandes y enlaces (3,5:1). `#78716C` sobre crema queda en el límite (4,5:1), así que el texto secundario va mejor sobre blanco.
- **Fuente:** Kulim Park (Google Fonts, licencia OFL), con los archivos `woff2` en `apps/web/public/fonts` y `@font-face`. Sin dependencia y sin peticiones a Google, que en la UE obligaría a avisar al usuario.
- **Alcance:** el panel usa paleta y fuente con transiciones sutiles. Las animaciones de scroll (referencias: jeskojets.com y tasteskill.dev) van en la parte pública, en la Fase 4 junto con el buscador. La portada animada no se hace en la Fase 3.

## F3-7. `motion` aprobado para la parte pública

- **Decisión:** el desarrollador aprueba añadir `motion` (la librería de animación de React, antes Framer Motion) para las animaciones de scroll de la Fase 4. No se instala hasta que haya una pantalla que la use; entonces se comprueba la versión vigente. El panel no la necesita.
- **Alternativa descartada:** CSS e `IntersectionObserver` sin librería (cubren apariciones y parallax ligero, pero no efectos 3D ni de hero por scroll). GSAP: más pesada y con licencia propia.

## F3-8. 21st.dev solo como inspiración

- **Contexto:** la cuenta es gratuita (2 descargas de código al día, sin generación con IA) y sus comandos de instalación exigen shadcn y llevan la API key en la URL.
- **Decisión:** el plugin y el MCP se usan para ver previews y vídeos como referencia. No se descarga código ni se instala shadcn; los componentes se escriben a mano en el repo.

## F3-9. Portada y panel animados con `motion`

- **Contexto:** al ver el panel en el navegador, el desarrollador lo encontró plano y pidió animaciones de scroll, botones, banners e imágenes, inspiradas en 21st.dev.
- **Decisión:** se instala `motion` 14.0.0 (aprobada en F3-7) y se adelanta una portada pública en `/` (hero con parallax, cinta de categorías, tarjetas y pasos con aparición al hacer scroll, banner final). El panel gana transiciones entre páginas, subrayado animado en el menú, banner con anillo de progreso y botones con relieve. 21st.dev sigue como inspiración (F3-8): los componentes se escriben a mano, sin shadcn ni descargas. Las imágenes son maquetas hechas con HTML y SVG, sin fotos ni cifras inventadas.
- **Accesibilidad:** `MotionConfig reducedMotion="user"` desactiva el movimiento si el sistema lo pide.
- **Consecuencia:** la portada, prevista para la Fase 4, queda hecha; la Fase 4 solo añade buscador y fichas.
