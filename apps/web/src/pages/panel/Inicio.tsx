import { motion } from "motion/react";
import { Meteors } from "@/components/ui/meteors";
import { api } from "../../api.ts";
import { BlockSkeleton } from "../../components/Skeleton.tsx";
import { CountUp } from "../../motion.tsx";
import type { Checklist, Profile } from "../../types.ts";
import { buttonClass, FormError, Section, useAction } from "../../ui.tsx";
import { useApi } from "../../useApi.ts";

const STATUS = { draft: "borrador", published: "publicado", suspended: "suspendido" } as const;

export function Inicio() {
  const profile = useApi<Profile>("/business/profile");
  const checklist = useApi<Checklist>("/business/checklist");
  const { error, run } = useAction();
  if (!profile.data || !checklist.data) {
    return profile.error ? <FormError message={profile.error} /> : <BlockSkeleton rows={4} />;
  }

  const published = profile.data.status === "published";
  const done = checklist.data.items.filter((i) => i.ok).length;
  const total = checklist.data.items.length;
  const toggle = async () => {
    await run(() => api(`/business/${published ? "unpublish" : "publish"}`, { method: "POST" }));
    await Promise.all([profile.reload(), checklist.reload()]);
  };

  return (
    <>
      <div className="bg-ink relative overflow-hidden rounded-2xl p-8 text-white">
        <Meteors number={14} />
        <motion.div
          aria-hidden
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.55, 0.3] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="bg-gold pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full blur-3xl"
        />
        <div className="relative flex flex-wrap items-center gap-8">
          <div className="flex-1">
            <p className="text-gold text-sm font-bold tracking-widest uppercase">Tu negocio</p>
            <h1 className="mt-1 text-4xl font-bold">{profile.data.name}</h1>
            <span
              className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
                published ? "bg-emerald-400/20 text-emerald-200" : "bg-white/10 text-stone-200"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${published ? "animate-pulse bg-emerald-400" : "bg-stone-400"}`}
              />
              {STATUS[profile.data.status]}
            </span>
          </div>
          <Ring done={done} total={total} />
        </div>
      </div>

      <Section title="Lista de comprobación">
        <ul className="space-y-2">
          {checklist.data.items.map((i, n) => (
            <motion.li
              key={i.key}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + n * 0.08 }}
              className="flex items-center gap-3"
            >
              <motion.span
                key={String(i.ok)}
                initial={{ scale: 0.4 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 12 }}
                aria-hidden
                className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${
                  i.ok ? "bg-gold text-ink" : "border-muted border"
                }`}
              >
                {i.ok ? "✓" : ""}
              </motion.span>
              {i.label}
              <span className="sr-only">{i.ok ? " (hecho)" : " (pendiente)"}</span>
            </motion.li>
          ))}
        </ul>
        <FormError message={error} />
        {profile.data.status !== "suspended" && (
          <button
            className={buttonClass}
            disabled={!published && !checklist.data.ready}
            onClick={toggle}
          >
            {published ? "Despublicar" : "Publicar negocio"}
          </button>
        )}
      </Section>
    </>
  );
}

/** Anillo de progreso de la lista: el trazo se dibuja al cargar. */
function Ring({ done, total }: { done: number; total: number }) {
  return (
    <div className="relative h-28 w-28" role="img" aria-label={`${done} de ${total} pasos hechos`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="white"
          strokeOpacity="0.15"
          strokeWidth="8"
        />
        <motion.circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="#c89b3c"
          strokeWidth="8"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: done / total }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">
          <CountUp to={done} />/{total}
        </span>
        <span className="text-xs text-stone-300">pasos</span>
      </div>
    </div>
  );
}
