import { IconArrowUp } from "@tabler/icons-react";
import { AnimatePresence, motion, useScroll, useMotionValueEvent } from "motion/react";
import { useState } from "react";

/** Botón flotante que aparece al bajar, muestra cuánto has avanzado y vuelve arriba del todo. */
export function ScrollTop() {
  const { scrollY, scrollYProgress } = useScroll();
  const [visible, setVisible] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setVisible(y > 480));

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          aria-label="Volver arriba"
          title="Volver arriba"
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 20 }}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="bg-ink fixed right-4 bottom-4 z-40 flex size-12 cursor-pointer items-center justify-center rounded-full text-white shadow-xl sm:right-6 sm:bottom-6"
        >
          <svg viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90" aria-hidden>
            <circle
              cx="24"
              cy="24"
              r="21"
              fill="none"
              stroke="white"
              strokeOpacity="0.15"
              strokeWidth="3"
            />
            <motion.circle
              cx="24"
              cy="24"
              r="21"
              fill="none"
              stroke="#c89b3c"
              strokeWidth="3"
              strokeLinecap="round"
              style={{ pathLength: scrollYProgress }}
            />
          </svg>
          <IconArrowUp className="relative size-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
