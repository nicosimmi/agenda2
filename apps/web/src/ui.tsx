import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { useState, type ComponentProps, type ReactNode } from "react";

export const buttonClass =
  "bg-gold text-ink hover:bg-gold-dark rounded-md px-4 py-2 font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm";

export const linkButton = "text-gold-dark font-semibold underline";

export const inputClass =
  "border-muted focus:border-gold-dark focus:ring-gold mt-1 block w-full rounded-md border bg-white px-3 py-2 focus:ring-2 focus:outline-none";

export function Field({ label, ...props }: { label: string } & ComponentProps<"input">) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <input {...props} className={inputClass} />
    </label>
  );
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <AuroraBackground className="bg-cream text-ink h-auto min-h-screen">
      <div className="relative z-10 w-full max-w-md p-6">
        <Link to="/" className="mb-8 block text-2xl font-bold">
          Agend<span className="text-gold-dark">IA</span>
        </Link>
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
          className="space-y-4 rounded-xl bg-white/90 p-6 shadow-xl shadow-amber-900/10 backdrop-blur"
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
      className="space-y-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
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
      className="text-sm font-semibold text-red-700"
    >
      {message}
    </motion.p>
  ) : null;
}

/** Ejecuta una llamada a la API guardando su error para mostrarlo. Devuelve si salió bien. */
export function useAction() {
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setError(null);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  return { error, run };
}
