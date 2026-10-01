# Prompt inicial (pégalo en Claude Code o Codex)

## Antes de empezar (Windows)

1. Instala **Docker Desktop** (con WSL2), **Node.js LTS**, **pnpm** y **Git**.
2. Crea una carpeta para el proyecto y ábrela en VS Code.
3. Guarda `MARKETPLACE_SPEC.md` como `docs/SPEC.md` y `WORKFLOW.md` como `docs/WORKFLOW.md` dentro del proyecto. (Sustituyen a `RESERVAS_SPEC.md`; ya no lo necesitas.)
4. Consigue una **clave de la API de Anthropic** (se factura aparte de tu plan de chat; compruébalo en la consola de Anthropic y pon un límite de gasto). No la pegues en el chat ni en el repo: irá en un `.env` local. Hasta la Fase 6 no la necesitas.

---

```
Vamos a construir un proyecto de portfolio: un marketplace de reservas donde los negocios se dan de alta y los clientes los buscan y reservan, con un asistente de IA que actúa mediante un servidor MCP propio (TypeScript, React, Fastify, PostgreSQL, Docker, n8n).

La especificación completa está en docs/SPEC.md (qué construir) y la guía de trabajo en docs/WORKFLOW.md (cómo trabajar: modelos, avisos, cupo, traspasos). Ambas son la fuente de verdad. Construimos la versión A ("lite") dejando todo preparado para evolucionar a la B (sección 17), pero NO implementes nada de la B.

Contexto sobre mí: soy desarrollador junior (React, TypeScript, PHP/Laravel, Python, SQL, Docker, n8n). No tengo experiencia con MCP, agentes de IA ni multitenencia. Trabajo en Windows. Explícame en 1-2 frases cada concepto nuevo la primera vez que aparezca. Prefiero código simple y legible que pueda explicar en una entrevista.

Instrucciones:
1. Lee docs/SPEC.md y docs/WORKFLOW.md enteros. NO escribas código todavía.
2. Respóndeme con: (a) un resumen del proyecto en 5-6 líneas con tus palabras, (b) los 3 riesgos técnicos que ves (especialmente el aislamiento entre negocios y la seguridad del agente), (c) como máximo 5 preguntas que de verdad bloqueen el arranque, (d) el modelo que me recomiendas para la Fase 0 según WORKFLOW.md. Si algo es ambiguo, aplica la decisión por defecto del apartado 19 en lugar de preguntarme.
3. Cuando yo confirme, empieza SOLO por la Fase 0 y detente al terminarla. Trabaja fase a fase (sección 16), sin adelantarte.
4. No instales dependencias que no estén en la spec sin preguntarme. Consulta la documentación oficial vigente (SDK de MCP, API de Anthropic, Fastify, Drizzle, Playwright) antes de escribir código con ellas; no confíes en la memoria para versiones, APIs ni nombres de modelos.
5. Toda consulta de datos de negocio debe pasar por el contexto de tenant (sección 4). Si detectas una excepción, para y avísame.
6. Antes de decir que algo está terminado, ejecuta typecheck, lint, tests y el arranque con Docker Compose. Si no puedes ejecutarlo, dímelo explícitamente.
7. Commits pequeños (Conventional Commits). No añadas funcionalidades fuera de alcance: propónlas al final.
8. Ningún test automático debe llamar a un LLM real. Nunca pongas secretos en el repositorio.
9. Tras la Fase 0, crea AGENTS.md y un CLAUDE.md que lo referencie, con el stack, los comandos, las reglas de la sección 15 y un resumen del protocolo de avisos de WORKFLOW.md (con la instrucción de leerlo al empezar cada sesión).
10. Sigue el protocolo de docs/WORKFLOW.md: AVÍSAME con el CHECKPOINT al terminar cada fase y con un aviso de modelo cuando la complejidad de la tarea cambie (por ejemplo: "ya hemos llegado al punto donde conviene cambiar de modelo; ejecuta /model"). Tú no puedes cambiar el modelo ni ver mi cupo: recomiéndamelo y pídeme que ejecute /model o /usage.
11. Antes de empezar, comprueba (sin mostrar valores) que no tengo definida la variable de entorno ANTHROPIC_API_KEY y la versión de Claude Code, como indica WORKFLOW.md §8.
12. Mantén docs/PROGRESS.md y docs/INTERVIEW_NOTES.md al día al cerrar cada sesión y cada fase.

Empieza por el paso 2.
```

---

## Cómo trabajar con él

1. Revisa su resumen y responde a las preguntas. Confirma.
2. Al terminar cada fase, **pruébala tú** (`docker compose up`, navegador, tests) antes de pedir la siguiente.
3. **No te saltes la Fase 2** (suite de aislamiento): es lo que más valor técnico da al proyecto y lo más difícil de arreglar después.
4. Si te quedas sin cupo en una herramienta, abre la otra (Claude Code ↔ Codex) con el mismo `AGENTS.md` y la misma spec, y dile que lea `docs/PROGRESS.md` para continuar donde se quedó.
5. Si quieres cambiar algo, edita la tabla de decisiones del apartado 19 **antes** de que se implemente.
6. Manda candidaturas mientras construyes: en cuanto tengas la Fase 4 con demo, ya tienes algo que enseñar. El agente te lo recordará en los hitos.
7. En las fases 2, 5 y 6, pasa **siempre** la revisión cruzada a Codex (el prompt está en `docs/WORKFLOW.md` §7).
