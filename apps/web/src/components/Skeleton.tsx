import { motion } from "motion/react";

/** Bloque gris con un brillo que lo recorre mientras llegan los datos. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-shimmer bg-[length:200%_100%] rounded-md bg-[linear-gradient(90deg,var(--surface-2)_25%,var(--line)_50%,var(--surface-2)_75%)] ${className}`}
    />
  );
}

/** Texto para lectores de pantalla mientras algo carga. */
export function Loading({ label = "Cargando…" }: { label?: string }) {
  return (
    <span role="status" className="sr-only">
      {label}
    </span>
  );
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <motion.span
      aria-hidden
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
      className={`inline-block rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

/** Pantalla de carga de una página: el calendario del logo "se dibuja" en bucle. */
export function PageLoader() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Loading />
      <motion.svg
        aria-hidden
        viewBox="0 0 48 48"
        className="text-gold size-16"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <motion.rect
          x="8"
          y="12"
          width="32"
          height="28"
          rx="5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: [0, 1, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M8 22h32M16 8v8M32 8v8"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: [0, 1, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
        />
        <motion.path
          d="m18 31 5 5 8-9"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: [0, 0, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        />
      </motion.svg>
      <p className="text-muted text-sm">Cargando AgendIA…</p>
    </div>
  );
}
