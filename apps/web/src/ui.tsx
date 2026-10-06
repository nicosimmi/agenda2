import { motion } from "motion/react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { Spinner } from "./components/Skeleton.tsx";

export const buttonClass =
  "bg-gold text-ink hover:bg-gold-hover cursor-pointer rounded-md px-4 py-2 font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm";

export const secondaryButtonClass =
  "border-line hover:border-fg text-fg cursor-pointer rounded-md border px-4 py-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const linkButton = "text-gold-dark cursor-pointer font-semibold underline";

export const inputClass =
  "border-muted/50 focus:border-gold-dark focus:ring-gold bg-surface mt-1 block w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none";

export function Field({ label, ...props }: { label: string } & ComponentProps<"input">) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <input {...props} className={inputClass} />
    </label>
  );
}

/** Botón de envío: mientras se espera a la API muestra un spinner y no deja pulsar dos veces. */
export function SubmitButton({
  busy,
  children,
  className = buttonClass,
  ...props
}: { busy?: boolean } & ComponentProps<"button">) {
  return (
    <button
      {...props}
      disabled={busy || props.disabled}
      className={`${className} inline-flex items-center justify-center gap-2`}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

/** Página de acceso o alta: fondo de aurora y el formulario en una tarjeta. */
export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <AuroraBackground className="bg-page dark:bg-page text-fg h-auto min-h-[70vh] py-12">
      <div className="relative z-10 w-full max-w-md p-6">
        <motion.h1
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-3xl font-bold"
        >
          {title}
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="bg-surface/90 space-y-4 rounded-xl p-6 shadow-xl shadow-amber-900/10 backdrop-blur"
        >
          {children}
        </motion.div>
      </div>
    </AuroraBackground>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="border-line bg-surface space-y-4 rounded-xl border p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </motion.section>
  );
}

export function FormError({ message }: { message: string | null | undefined }) {
  return message ? (
    <motion.p
      role="alert"
      initial={{ x: -8, opacity: 0 }}
      animate={{ x: [0, -6, 6, -3, 0], opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="text-sm font-semibold text-red-600 dark:text-red-400"
    >
      {message}
    </motion.p>
  ) : null;
}

/** Ejecuta una llamada a la API guardando su error y si está en curso. Devuelve si salió bien. */
export function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      setError(null);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, run };
}

/** Enlace con aspecto de botón dorado. */
export function ButtonLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={`${buttonClass} inline-block`}>
      {children}
    </Link>
  );
}

/** Contenedor de contenido de las páginas públicas. */
export function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>;
}
