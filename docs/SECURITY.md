# Revisión de seguridad

Revisión hecha sobre el código y la configuración de la rama `main` (octubre de 2026). No es una auditoría externa ni una prueba de penetración: es una lectura de las zonas de riesgo y las comprobaciones automáticas que se pueden hacer gratis.

## Qué está bien

- **Aislamiento entre negocios.** El `business_id` sale de la sesión (`TenantContext` con marca de tipo), la base de datos lo refuerza con claves foráneas compuestas, y un test recorre todas las rutas de la API y falla si falta una.
- **Sesiones.** Token aleatorio de 256 bits en cookie HttpOnly y SameSite=Lax (Secure en producción); solo se guarda su hash SHA-256; se rotan al entrar y se invalidan al salir.
- **Contraseñas** con Argon2id, y comprobación contra un hash falso si el email no existe (mismo tiempo de respuesta).
- **CSRF.** Origen obligatorio con cookie, SameSite=Lax y CORS con lista de orígenes.
- **Límites de uso** por IP, por cuenta y por persona en login, altas, tokens, reservas y chat.
- **Tokens MCP** con permisos, caducidad y revocación; no pueden crear tokens ni confirmar por el asistente.
- **Agente.** El modelo no tiene herramientas `confirm_*`; el texto de los negocios llega marcado como dato no confiable; 51 evaluaciones lo comprueban.
- **n8n.** Peticiones firmadas con HMAC-SHA256 y tolerancia de 5 minutos; rutas `/internal` rechazan todo sin firma.
- **Inyección SQL.** Todas las consultas van parametrizadas (Drizzle y `sql` con parámetros).
- **XSS.** Ni `dangerouslySetInnerHTML` ni `innerHTML` en la web; los correos son texto plano.
- **Secretos.** `.env` fuera de Git, sin claves en el historial, el seed se niega a correr con `NODE_ENV=production`, y los puertos de Docker solo escuchan en `127.0.0.1`.
- **Fotos.** Solo JPEG, PNG y WebP comprobados por sus bytes (nunca SVG), con tamaño máximo; se sirven con su tipo real, `nosniff` y una política `default-src 'none'`. Las rutas de subida y borrado son del negocio de la sesión.
- **Dependencias.** `pnpm audit --prod`: sin vulnerabilidades conocidas.

## Riesgos conocidos y qué hacer

| Riesgo                                                                                                                                                                                                      | Gravedad | Qué hacer                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El registro no verifica el email: se puede crear una cuenta con el correo de otra persona.                                                                                                                  | Media    | Verificación por email antes de producción. Con Google ya queda mitigado (DECISIONS F9-1).                                                                 |
| El límite de login por cuenta (10 por hora) permite a un tercero bloquear los intentos de una víctima conociendo su email.                                                                                  | Baja     | Aceptado: frena la fuerza bruta. Con verificación de email se podría avisar a la persona.                                                                  |
| Sin restablecer contraseña.                                                                                                                                                                                 | Media    | Pendiente (necesita verificación de email).                                                                                                                |
| La web no lleva cabecera `Content-Security-Policy` (GitHub Pages no deja ponerla; en producción la pondría el servidor que sirva la web).                                                                   | Baja     | Añadirla en el proxy inverso de producción.                                                                                                                |
| Los límites de uso viven en la memoria de un solo proceso.                                                                                                                                                  | Baja     | Con varias instancias, moverlos a Redis o a Postgres.                                                                                                      |
| Las reservas y fotos compartidas de la demo (Firestore) se pueden crear sin cuenta: alguien podría subir imágenes inadecuadas que verían todos los visitantes de ese negocio.                               | Baja     | Aceptado: las reglas acotan formato y tamaño y no dejan borrar. Si hay abuso, marcar `removed` o borrar la colección `media` desde la consola de Firebase. |
| Las reservas compartidas de la demo (Firestore) se leen y escriben sin cuenta, y las reglas solo limitan la forma de los datos: alguien podría crear reservas falsas o cambiar el estado de las existentes. | Baja     | Aceptado: son datos ficticios sin emails ni teléfonos. Si se llena de basura, borrar la colección `bookings` desde la consola de Firebase.                 |
| El panel de administración y las cuentas de demo (`demo-1234`) existen solo para desarrollo.                                                                                                                | Info     | No ejecutar el seed en producción (ya lo impide).                                                                                                          |
| GitHub: protección de la rama `main` y alertas de Dependabot sin comprobar desde aquí (no hay `gh`).                                                                                                        | Baja     | Activarlas en Settings → Code security y Branches.                                                                                                         |
