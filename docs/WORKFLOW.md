# WORKFLOW — Cómo trabajamos en este proyecto (guía para el agente y para el desarrollador)

> Guárdalo como `docs/WORKFLOW.md`. Complementa a `docs/SPEC.md` (qué construir) con **cómo trabajar**: qué modelo usar en cada momento, cuándo avisar al desarrollador, cómo cuidar el cupo del plan, cómo traspasar el trabajo entre Claude Code y Codex y qué hitos de carrera hay por el camino.
> Datos de planes, modelos y comandos válidos a **octubre de 2026**. Cambian rápido: ante cualquier duda, consulta la documentación vigente y dímelo.

---

## 1. Contexto y objetivo

- Desarrollador junior, trabaja en **Windows**, con el **plan Pro de Claude** (Claude Code incluido, cupo compartido con el chat) y acceso a **Codex**.
- **El cupo es limitado** y el proyecto es grande. Este documento existe para que el cupo rinda y para que **tú (el agente) me avises en los momentos clave** en vez de que yo tenga que acordarme.
- Objetivo final: un proyecto de portfolio **terminado, desplegado y que sepa explicar** (CV, LinkedIn, GitHub), mientras sigue buscando trabajo.

---

## 2. Lo que el agente PUEDE y NO PUEDE hacer

| Puedes | No puedes |
|---|---|
| Recomendar el modelo adecuado y explicar por qué | Cambiar el modelo por tu cuenta: **lo cambia el desarrollador con `/model`** |
| Pedirme que ejecute `/usage` o `/model` y que te cuente el resultado | Ver cuánto cupo queda: **no lo asumas ni lo inventes** |
| Comprobar variables de entorno y versión con comandos de terminal (sin mostrar secretos) | Pedirme que pegue claves o contraseñas en el chat |
| Escribir y mantener `docs/PROGRESS.md` para que otra sesión o herramienta continúe | Dar por hecho qué modelo estás usando: si no lo sabes seguro, **pídeme que ejecute `/model`** |

---

## 3. Modelo recomendado por fase

Nombres actuales: **Opus 5.5** (más potente), **Sonnet 5.5** (intermedio, el "de diario"), **Haiku 4.5** (pequeño y barato). Si en `/model` los nombres han cambiado, usa el equivalente por nivel. Opus 5.5 requiere **Claude Code v2.1.280 o superior** (`claude --version`).

| Fase | Modelo principal | Cambios dentro de la fase | Revisión cruzada con Codex |
|---|---|---|---|
| **0. Base** | Sonnet 5.5 | Si Docker/WSL2 da problemas que Sonnet no resuelve a la segunda, subir a Opus 5.5 | No |
| **1. Datos y dominio** | **Opus 5.5** (esquema, claves compuestas, restricción de exclusión, motor de disponibilidad y DST) | Bajar a **Sonnet 5.5** para el *seed* de negocios de demostración | **Sí** (esquema y concurrencia) |
| **2. Auth, roles y aislamiento** | **Opus 5.5** | Ninguno: fase crítica | **Sí, obligatoria** |
| **3. Panel del negocio** | Sonnet 5.5 | Subir a Opus 5.5 si aparece un fallo de aislamiento o de permisos | No |
| **4. Cliente: búsqueda y reserva** | Sonnet 5.5 | Subir a Opus 5.5 solo para consultas de búsqueda (texto, `pg_trgm`) si no salen a la segunda | No |
| **5. Servidor MCP** | **Opus 5.5** | Ninguno | **Sí, obligatoria** (tokens y permisos) |
| **6. Agente en la web** | **Opus 5.5** (bucle, guardarraíles, confirmación, inyección de prompts) | Bajar a Sonnet 5.5 para la interfaz del chat | **Sí, obligatoria** |
| **7. Automatizaciones** | Sonnet 5.5 | — | No |
| **8. Evals, pulido y publicación** | Opus 5.5 para **diseñar** el dataset de evals, especialmente los casos de inyección | Sonnet 5.5 para README, documentación y despliegue | **Sí** (revisión final) |

**Tareas pequeñas en cualquier fase** (cambiar textos, renombrar, formatear, ajustar estilos sueltos): **Haiku 4.5** o Sonnet 5.5.

### Regla de escalada
1. Si un modelo **falla dos veces** en el mismo problema → sube un nivel (Sonnet → Opus).
2. Si **Opus falla dos veces** → **para**, resume el problema en `docs/PROGRESS.md` y recomiéndame llevarlo a Codex o replantear el enfoque. No sigas probando a ciegas.
3. Si el trabajo vuelve a ser rutinario tras resolver algo difícil → recomiéndame **bajar de nivel** para ahorrar cupo.

Esfuerzo/razonamiento: si mi versión permite ajustarlo, usa el valor medio por defecto y alto solo en las fases críticas. Consulta la documentación vigente de Claude Code para la forma exacta.

---

## 4. Protocolo de avisos (lo que tienes que decirme y cuándo)

Avísame **solo en estos momentos** (sin saturarme):

1. **Inicio de fase:** modelo recomendado y plan breve.
2. **Fin de fase:** checkpoint completo (plantilla abajo).
3. **Cambio de complejidad dentro de una fase:** aviso de modelo (plantilla corta).
4. **Hito de carrera** (§9).
5. **Sesión larga:** si llevamos muchas tareas encadenadas o el contexto se ha hecho enorme, recomiéndame guardar progreso en `docs/PROGRESS.md` y empezar sesión nueva.
6. **Riesgo de coste:** antes de cualquier cosa que consuma mucho (reescribir muchos archivos, leer todo el repositorio, ejecutar evals con la API real), pídeme confirmación.

### Plantilla de CHECKPOINT (fin de fase)

```
🔔 CHECKPOINT · Fase N terminada — <nombre>

✅ Hecho: <3-5 líneas>
🧪 Cómo probarlo: <comandos o pasos exactos en Windows>
📊 Estado: typecheck ✔/✘ · lint ✔/✘ · tests ✔/✘ (N tests) · docker compose ✔/✘
📝 Decisiones nuevas anotadas en docs/DECISIONS.md: <sí/no, cuáles>

🔎 Revisión cruzada: <recomendada/obligatoria/no hace falta>
   → si procede: pásale a Codex el prompt de docs/WORKFLOW.md §7

🧠 Modelo para la siguiente fase (Fase N+1 — <nombre>): <Opus 5.5 / Sonnet 5.5>
   Motivo: <una frase>.
   👉 Ejecuta /model y elige <modelo> antes de continuar.

🧹 Sesión: he actualizado docs/PROGRESS.md. Te recomiendo /clear (o una sesión nueva) antes de seguir.
📈 Cupo: ejecuta /usage y dime cómo vas. Si queda poco, ver docs/WORKFLOW.md §5.
🎓 Entrevista: he añadido las notas de esta fase a docs/INTERVIEW_NOTES.md.

Cuando quieras seguir, dime "siguiente fase".
```

### Plantilla de AVISO DE MODELO (dentro de una fase)

```
⚠️ Aviso de modelo: vamos a empezar <tarea>, que es <crítica/rutinaria>.
Te recomiendo <Opus 5.5 / Sonnet 5.5 / Haiku 4.5> porque <motivo corto>.
👉 Ejecuta /model y dime cuando lo hayas cambiado.
```

Ejemplos de momentos que deben disparar un aviso:
- Pasamos de **diseñar el esquema** (Opus) a **cargar datos de demostración** (Sonnet).
- Empezamos a escribir **tests de aislamiento**, **tokens del MCP** o **guardarraíles del agente** (Opus).
- Vamos a hacer **formularios y estilos** tras una tarea difícil (Sonnet).
- Un problema se repite dos veces (regla de escalada).

---

## 5. Cuidar el cupo del plan

Reglas para ti (agente):
- **Una sesión = un objetivo claro** (una fase o parte de una fase). No mezcles.
- Usa **modo plan** (`Shift+Tab`) antes de cambios grandes o que toquen varios archivos, para acordar el enfoque antes de escribir código.
- No leas el repositorio entero ni pegues archivos enormes si basta con los relevantes. No reescribas archivos completos para cambios pequeños.
- Sugiere `/clear` al terminar cada fase; el contexto persistente vive en `docs/PROGRESS.md`, `AGENTS.md` y la spec.
- Ejecuta tests y comandos acotados (por paquete o por archivo) mientras trabajas; la batería completa, al cierre de cada fase.

Cuando el desarrollador te diga que **se agotó el cupo**:
1. Actualiza `docs/PROGRESS.md` (§6) **antes** de que se corte, si aún puedes.
2. Propón, por este orden: **(a)** continuar con **Codex** usando `AGENTS.md` + `PROGRESS.md`; **(b)** tareas que no requieren IA (probar a mano, revisar el README, buscar empleo, estudiar para certificaciones); **(c)** esperar al reinicio del límite de sesión (cada cinco horas) o semanal; **(d)** como último recurso, activar **créditos de uso** con un **tope de gasto bajo**.
3. **No recomiendes modelos gratuitos de OpenRouter ni proxies de terceros** para sustituir a Claude en las fases críticas: tienen problemas de compatibilidad, calidad y privacidad.

---

## 6. Traspaso entre herramientas: `docs/PROGRESS.md`

Mantén este archivo **al día al final de cada sesión y de cada fase**. Plantilla:

```markdown
# PROGRESS

**Última actualización:** <fecha y herramienta/modelo>
**Fase actual:** N — <nombre>   **Estado:** en curso / terminada / bloqueada

## Hecho
- ...

## En curso (qué estaba haciendo exactamente)
- Archivo/s: ...  Siguiente paso concreto: ...

## Pendiente de la fase
- [ ] ...

## Decisiones recientes (resumen; detalle en DECISIONS.md)
- ...

## Problemas abiertos / hipótesis
- ...

## Comandos útiles
- Levantar: ...  Tests: ...  Migraciones: ...

## Para quien continúe (Claude o Codex)
Lee AGENTS.md, docs/SPEC.md y este archivo. No cambies decisiones de DECISIONS.md sin avisar.
```

---

## 7. Revisión cruzada con Codex

Cuándo: al terminar las fases **1, 2, 5, 6 y 8** (en 2, 5 y 6 es **obligatoria**). Una segunda opinión de otro modelo detecta errores que el mismo modelo no ve.

Prompt para pegar en Codex (adáptalo a la fase):

```
Actúa como revisor de código senior y de seguridad. Proyecto: marketplace de reservas multi-negocio con agente de IA y servidor MCP (ver docs/SPEC.md, docs/WORKFLOW.md, AGENTS.md y docs/PROGRESS.md). Revisa SOLO lo cambiado en la Fase N (git diff desde la rama o etiqueta anterior).

Busca, por orden de gravedad:
1. Fugas entre negocios (aislamiento multi-tenant), accesos indebidos (IDOR), permisos que faltan.
2. Fallos de seguridad: inyección SQL, sesiones/CSRF, secretos en el repositorio, validación de entradas, límites de uso.
3. En agente/MCP: posibilidad de que el modelo confirme acciones sin clic del usuario, tokens con demasiados permisos, inyección de prompts directa e indirecta.
4. Errores de lógica en disponibilidad/reservas (solapamientos, zonas horarias, DST, carreras).
5. Tests que faltan o que no prueban lo que dicen probar.

No reescribas código. Devuélveme una lista numerada con: archivo y línea, problema, gravedad (alta/media/baja), y propuesta de arreglo en 1-2 líneas. Si no encuentras problemas graves, dilo explícitamente.
```

Después de la revisión, el desarrollador pega la lista en Claude Code y se corrige con tests que reproduzcan cada fallo. Anota los hallazgos relevantes en `docs/DECISIONS.md`.

---

## 8. Seguridad y facturación (comprobaciones obligatorias)

1. **`ANTHROPIC_API_KEY` global:** si existe como variable de entorno del sistema, Claude Code **facturará esa clave de API en lugar del plan**. Comprueba al **inicio del proyecto** y **antes de la Fase 6** (sin mostrar el valor). En PowerShell:
   ```powershell
   if ($env:ANTHROPIC_API_KEY) { "ATENCIÓN: definida" } else { "OK: no definida" }
   ```
   Si está definida, avísame de inmediato y no la uses.
2. La clave de API del agente del proyecto va **solo en el `.env` local** (ignorado por Git), nunca en variables globales ni en el repositorio. Confirma que `.env` está en `.gitignore` en la Fase 0.
3. Autenticación de Claude Code con **`claude login`** (cuenta del plan), no con clave de API.
4. Versión: comprueba `claude --version` al empezar y avísame si es anterior a la que requiere el modelo recomendado.
5. **Nunca** pidas que pegue secretos en el chat. Si aparece uno en el código o en un commit, avísame y explica cómo rotarlo.
6. **Ningún test automático llama a un LLM real.** Las llamadas reales solo en `pnpm eval` y pruebas manuales, con confirmación previa (§4.6).
7. **Tope de gasto:** antes de la Fase 6, recuérdame configurar un límite de gasto en la consola de la API y un `LLM_DAILY_BUDGET_EUR` bajo en el `.env`.

---

## 9. Hitos de carrera (recuérdamelos, sin insistir)

El objetivo es **conseguir trabajo pronto**, no solo terminar el proyecto. En estos momentos, recuérdamelo en el checkpoint con una línea:

| Hito | Qué recordarme |
|---|---|
| **Fin de la Fase 1** | Crear el repositorio en GitHub con un README inicial y commits limpios |
| **Fin de la Fase 4 ("mínimo presentable")** | Ya hay búsqueda y reserva funcionando: grabar un GIF o capturas, añadir el proyecto al CV y a LinkedIn como "en desarrollo" y **enviar candidaturas mencionándolo** |
| **Fin de la Fase 6** | Grabar un vídeo corto del agente reservando; publicar un post en LinkedIn contando el problema, la arquitectura y lo aprendido |
| **Fin de la Fase 8** | Actualizar CV, LinkedIn y GitHub (proyecto fijado/destacado) y preparar el futuro portfolio |

Una vez por hito, como mucho, y en una sola línea: mantener en paralelo **candidaturas semanales** y la preparación de **certificaciones gratuitas** (freeCodeCamp, rutas de Microsoft Learn, cursos de n8n). No insistas más.

---

## 10. Plan de recorte (si falta tiempo o cupo)

El proyecto debe quedar **entregable** aunque no llegue todo. Si vamos justos, propón recortes **en este orden** (de menos a más dolor), y espera mi confirmación:

1. Verificación de email y restablecer contraseña.
2. Publicación del servidor MCP en npm.
3. Modo oscuro y PWA.
4. RLS de PostgreSQL (mantener los tests de aislamiento).
5. Outbox con reintentos → llamadas directas firmadas a n8n.
6. Reducir el dataset de evals de 40–60 a ~25 casos (mantener todos los de inyección).
7. Recordatorio automático 24 h antes (mantener la confirmación al reservar).

**No se recorta nunca:** los tests de aislamiento entre negocios, la confirmación humana forzada por arquitectura, el límite de gasto y la documentación mínima del README.

**Mínimo presentable = Fase 4.** Con búsqueda, reserva, panel de negocio y tests de aislamiento ya hay un proyecto que enseñar.

---

## 11. Notas de entrevista: `docs/INTERVIEW_NOTES.md`

Al cerrar cada fase, añade una sección breve (máx. 15 líneas):
- **Qué problema resolvimos** y **por qué esa solución** (con las alternativas descartadas).
- **Cómo lo explicaría en 60 segundos.**
- **3 preguntas que podrían hacerme** sobre esa fase, con una respuesta corta.
- **1 limitación o fallo conocido**, dicho con honestidad.

Mi objetivo es poder defender cada parte del código en una entrevista. Si hay algo que no entiendo, **dímelo y explícamelo antes de seguir**.

---

## 12. Qué debe contener `AGENTS.md` / `CLAUDE.md` (créalos tras la Fase 0)

Versión **breve** (no copies este documento):
- Stack y comandos (levantar, tests, migrar, evals).
- Estructura de carpetas.
- Reglas de la sección 15 del SPEC.
- **Un resumen de 8-10 líneas del protocolo de avisos** y una referencia explícita:
  > "Lee `docs/WORKFLOW.md` al empezar cada sesión y sigue su protocolo de checkpoints, avisos de modelo y traspaso. Actualiza `docs/PROGRESS.md` al terminar cada sesión."
- Recordatorio de la regla de oro: **nunca confirmar acciones sin el clic del usuario** y **toda consulta de datos de negocio pasa por el contexto de tenant**.

`CLAUDE.md` debe limitarse a referenciar `AGENTS.md` (consulta la documentación vigente de Claude Code para la sintaxis de importación) para mantener una única fuente de verdad.

---

## 13. Checklist rápida de inicio de cada sesión (para ti, agente)

1. Leer `AGENTS.md`, `docs/PROGRESS.md` y la fase actual del SPEC.
2. Decirme **en una línea** en qué fase y tarea estamos y qué modelo recomiendas para ella.
3. Si hay un cambio de modelo recomendado, pedirme `/model` antes de empezar.
4. Al terminar la sesión: actualizar `docs/PROGRESS.md` y, si cerramos fase, emitir el CHECKPOINT.
