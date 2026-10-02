# AGENTS.md — AgendIA

Marketplace de reservas multi-negocio con asistente de IA y servidor MCP propio. Versión **A ("lite")**, preparada para evolucionar a la B (SPEC §17), pero **no se implementa nada de la B**.

**Fuente de verdad:** `docs/SPEC.md` (qué construir) y `docs/WORKFLOW.md` (cómo trabajar). Estado actual: `docs/PROGRESS.md`.

## Al empezar cada sesión

Lee `docs/WORKFLOW.md` y `docs/PROGRESS.md`, y sigue el protocolo de WORKFLOW. Actualiza `docs/PROGRESS.md` al terminar la sesión.

## Stack

pnpm workspaces · React + Vite + TypeScript + Tailwind · Fastify + Zod · PostgreSQL + Drizzle · `@modelcontextprotocol/sdk` · API de Anthropic tras una interfaz `LlmProvider` · n8n · Mailpit · Vitest + Playwright · Docker Compose · GitHub Actions.

Idioma: interfaz, commits y documentación en **español**; código en **inglés**.

## Comandos

Usa **PowerShell** para pnpm en Windows (el shim de corepack falla en Git Bash).

| Qué            | Comando                                                          |
| -------------- | ---------------------------------------------------------------- |
| Instalar       | `pnpm install`                                                   |
| Entorno local  | `cp .env.example .env` y `docker compose up -d`                  |
| Typecheck      | `pnpm typecheck`                                                 |
| Lint / formato | `pnpm lint` · `pnpm format:check` (`pnpm format` para arreglar)  |
| Tests          | `pnpm test`                                                      |
| Todo junto     | `pnpm check`                                                     |
| Evals (manual) | `pnpm eval` (Fase 8; consume API real, pedir confirmación antes) |

## Estructura

`apps/web` (React) · `apps/api` (Fastify) · `apps/mcp-server` · `packages/core` (dominio puro, sin I/O) · `packages/shared` (Zod y tipos) · `automation/` (workflows n8n) · `evals/` · `docs/`.

## Reglas de trabajo (SPEC §15)

1. Trabaja **por fases** (SPEC §16). Al terminar una: resume, explica cómo probarla y **espera confirmación**.
2. Ambigüedad → decisión por defecto (SPEC §19), anotada en `docs/DECISIONS.md`. Pregunta solo si bloquea.
3. **Commits pequeños** (Conventional Commits, tipo en inglés, descripción en español). Una rama por fase.
4. **Nada fuera de alcance.** Propón ideas al final. Lo de la B solo se deja preparado.
5. **Verifica antes de dar por terminado:** typecheck, lint, tests y arranque con Docker Compose. Si no puedes ejecutarlo, dilo.
6. Mantén el `README` al día.
7. Explica cada concepto nuevo en 1–2 frases la primera vez. Código simple y legible, defendible en una entrevista.
8. **Antes de instalar una dependencia que no esté en el SPEC, pregunta.**
9. **Consulta la documentación oficial vigente** (MCP SDK, API de Anthropic, Fastify, Drizzle, Playwright). No inventes versiones, APIs ni nombres de modelos.
10. **Secretos:** nunca en el repositorio; `.env.example` documentado. `ANTHROPIC_API_KEY` solo en `.env` local.
11. **Ningún test automático llama a un LLM real.**
12. Mantén `docs/PROGRESS.md` y `docs/INTERVIEW_NOTES.md` al cerrar cada sesión y cada fase. Las notas de entrevista son solo locales (`.gitignore`): nunca las añadas a Git.

## Reglas de oro

- **Nunca se confirma una acción del agente sin el clic del usuario.** Al modelo solo se le exponen herramientas de lectura y `propose_*`; las `confirm_*` las ejecuta el agent service tras el botón.
- **Toda consulta de datos de negocio pasa por el contexto de tenant.** El `business_id` sale de la sesión, nunca de un parámetro del cliente. Si ves una excepción: **para y avisa**.

## Protocolo de avisos (resumen de WORKFLOW.md)

- No puedes cambiar el modelo ni ver el cupo: **recomienda** y pide al desarrollador `/model` o `/usage`.
- Avisa solo en: inicio de fase (modelo + plan), fin de fase (**CHECKPOINT**, plantilla en WORKFLOW §4), cambio de complejidad (aviso de modelo), hitos de carrera (§9), sesión larga y riesgo de coste.
- Escalada: si un modelo falla 2 veces en lo mismo, sube un nivel; si Opus falla 2 veces, para y documenta en PROGRESS.
- Revisión cruzada con Codex al terminar las fases 1, 2, 5, 6 y 8 (obligatoria en 2, 5 y 6).
- Comprueba `ANTHROPIC_API_KEY` (sin mostrar el valor) al inicio y antes de la Fase 6.
- Una sesión = un objetivo. Sugiere `/clear` al cerrar cada fase.
- Plan de recorte y "no se recorta nunca": WORKFLOW §10.
