import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/** Barra dorada fina que cruza la parte superior en cada cambio de página. */
export function RouteProgress() {
  const { pathname } = useLocation();
  const [run, setRun] = useState(0);

  useEffect(() => {
    setRun((n) => n + 1);
  }, [pathname]);

  return (
    <AnimatePresence>
      {run > 1 && (
        <motion.div
          key={run}
          aria-hidden
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 1, opacity: [1, 1, 0] }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="bg-gold pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 origin-left"
        />
      )}
    </AnimatePresence>
  );
}
