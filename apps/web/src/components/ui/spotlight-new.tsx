import { motion } from "motion/react";

/** Dos focos de luz dorada que oscilan despacio desde la esquina superior izquierda. */
export function Spotlight() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {[
        { size: "70rem", rotate: -35, delay: 0, alpha: 0.22 },
        { size: "50rem", rotate: -50, delay: 2, alpha: 0.16 },
      ].map((s) => (
        <motion.div
          key={s.size}
          className="absolute -top-1/2 -left-1/4 rounded-full blur-2xl"
          style={{
            width: s.size,
            height: "28rem",
            rotate: s.rotate,
            background: `radial-gradient(closest-side, rgba(231,211,163,${s.alpha}), transparent)`,
          }}
          animate={{ x: [0, 60, 0], y: [0, 30, 0], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 12, delay: s.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
