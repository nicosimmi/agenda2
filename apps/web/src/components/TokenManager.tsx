import { IconCheck, IconCopy, IconPlugConnected } from "@tabler/icons-react";
import { useState, type FormEvent } from "react";
import { api } from "../api.ts";
import { dateTimeIn } from "../format.ts";
import { Field, FormError, inputClass, linkButton, SubmitButton, useAction } from "../ui.tsx";
import { useApi } from "../useApi.ts";
import { Loading, Skeleton } from "./Skeleton.tsx";

interface ApiToken {
  id: string;
  label: string;
  scopes: string[];
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

interface Created {
  token: string;
  expiresAt: string;
}

const PRESETS = {
  assistant: {
    label: "Para un asistente de IA",
    scopes: ["bookings:read", "bookings:propose"],
    help: "Puede buscar, ver tus reservas y proponer una cita, pero no confirmarla ni cancelarla.",
  },
  read: {
    label: "Solo lectura",
    scopes: ["bookings:read"],
    help: "Solo puede ver tus reservas.",
  },
  full: {
    label: "Acceso completo",
    scopes: ["bookings:read", "bookings:propose", "bookings:confirm"],
    help: "Puede además confirmar, cancelar y mover citas. Úsalo solo con herramientas de tu confianza.",
  },
} as const;

const TTLS = [
  [60, "1 hora"],
  [480, "8 horas"],
  [1440, "24 horas"],
] as const;

/** Genera, lista y revoca los tokens con los que un cliente MCP actúa en nombre del usuario. */
export function TokenManager() {
  const tokens = useApi<ApiToken[]>("/me/tokens");
  const [preset, setPreset] = useState<keyof typeof PRESETS>("assistant");
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const { error, busy, run } = useAction();

  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run(async () => {
      setCreated(
        await api<Created>("/me/tokens", {
          method: "POST",
          body: JSON.stringify({
            label: f.get("label"),
            scopes: PRESETS[preset].scopes,
            ttlMinutes: Number(f.get("ttl")),
          }),
        }),
      );
      await tokens.reload();
    });
  };

  const revoke = async (id: string) => {
    await run(() => api(`/me/tokens/${id}`, { method: "DELETE" }));
    await tokens.reload();
  };

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* sin permiso para el portapapeles: el texto sigue visible para copiarlo a mano */
    }
  };

  const config = created
    ? JSON.stringify(
        {
          mcpServers: {
            agendia: {
              command: "node",
              args: ["RUTA/AL/PROYECTO/apps/mcp-server/src/stdio.ts"],
              env: { AGENDIA_API_URL: "http://localhost:3000", AGENDIA_TOKEN: created.token },
            },
          },
        },
        null,
        2,
      )
    : "";

  const active = (tokens.data ?? []).filter(
    (t) => !t.revokedAt && new Date(t.expiresAt) > new Date(),
  );

  return (
    <section className="border-line bg-surface mt-12 rounded-2xl border p-6">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <IconPlugConnected className="text-gold-dark size-6" aria-hidden />
        Conectar un asistente de IA
      </h2>
      <p className="text-muted mt-2 max-w-2xl">
        Crea un token para que un cliente compatible con MCP (por ejemplo, Claude Desktop) busque y
        proponga reservas en tu nombre. El token caduca solo y puedes revocarlo cuando quieras.
      </p>

      <form onSubmit={create} className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto]">
        <Field
          label="Nombre del token"
          name="label"
          defaultValue="Mi asistente"
          maxLength={60}
          required
        />
        <label className="block">
          <span className="text-sm font-semibold">Caduca en</span>
          <select name="ttl" defaultValue={60} className={inputClass}>
            {TTLS.map(([minutes, label]) => (
              <option key={minutes} value={minutes}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-semibold">Qué puede hacer</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {(
              Object.entries(PRESETS) as [
                keyof typeof PRESETS,
                (typeof PRESETS)[keyof typeof PRESETS],
              ][]
            ).map(([key, p]) => (
              <label
                key={key}
                className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                  preset === key ? "border-gold bg-gold/10" : "border-line hover:border-gold"
                }`}
              >
                <input
                  type="radio"
                  name="preset"
                  checked={preset === key}
                  onChange={() => setPreset(key)}
                  className="sr-only"
                />
                <span className="block font-semibold">{p.label}</span>
                <span className="text-muted mt-1 block text-sm">{p.help}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <FormError message={error} />
          <SubmitButton busy={busy}>Crear token</SubmitButton>
        </div>
      </form>

      {created && (
        <div role="status" className="border-gold bg-gold/10 mt-6 space-y-4 rounded-xl border p-4">
          <p className="font-semibold">
            Copia el token ahora: no volverás a verlo. Caduca el{" "}
            {dateTimeIn(created.expiresAt, "Europe/Madrid")}.
          </p>
          <div className="flex items-center gap-2">
            <code
              className="bg-surface-2 min-w-0 flex-1 overflow-x-auto rounded-md px-3 py-2 text-sm"
              data-testid="new-token"
            >
              {created.token}
            </code>
            <button
              onClick={() => copy("token", created.token)}
              className="border-line hover:border-gold flex shrink-0 cursor-pointer items-center gap-1 rounded-md border px-3 py-2 text-sm font-semibold"
            >
              {copied === "token" ? (
                <IconCheck className="size-4" />
              ) : (
                <IconCopy className="size-4" />
              )}
              {copied === "token" ? "Copiado" : "Copiar"}
            </button>
          </div>
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              Configuración para Claude Desktop
            </summary>
            <pre className="bg-surface-2 mt-2 overflow-x-auto rounded-md p-3 text-xs">{config}</pre>
            <button onClick={() => copy("config", config)} className={`${linkButton} mt-2 text-sm`}>
              {copied === "config" ? "Copiado" : "Copiar configuración"}
            </button>
          </details>
        </div>
      )}

      <div className="mt-8">
        <h3 className="font-bold">Tokens activos</h3>
        {tokens.loading && (
          <div className="mt-3 space-y-2" aria-hidden>
            <Loading />
            <Skeleton className="h-12" />
          </div>
        )}
        {tokens.data && active.length === 0 && (
          <p className="text-muted mt-2 text-sm">No tienes tokens activos.</p>
        )}
        <ul className="divide-line mt-2 divide-y">
          {active.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t.label}</span>
                <span className="text-muted block text-sm">
                  {t.scopes.map((s) => s.replace("bookings:", "")).join(" · ")} · caduca{" "}
                  {dateTimeIn(t.expiresAt, "Europe/Madrid")}
                  {t.lastUsedAt
                    ? ` · usado ${dateTimeIn(t.lastUsedAt, "Europe/Madrid")}`
                    : " · sin usar"}
                </span>
              </span>
              <button
                onClick={() => revoke(t.id)}
                className="cursor-pointer text-sm font-semibold text-red-600 underline dark:text-red-400"
              >
                Revocar
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
