import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

/** Frase fija seguida de una palabra que cambia cada pocos segundos. */
export function LayoutTextFlip({
  text,
  words,
  duration = 3000,
}: {
  text: string;
  words: string[];
  duration?: number;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setI((n) => (n + 1) % words.length), duration);
    return () => clearInterval(timer);
  }, [words.length, duration]);

  return (
    <>
      <motion.span layoutId="flip-text" className="text-2xl font-bold tracking-tight md:text-4xl">
        {text}
      </motion.span>
      <motion.span
        layout
        className="bg-surface text-fg border-line relative w-fit overflow-hidden rounded-md border px-4 py-2 text-2xl font-bold tracking-tight shadow-sm md:text-4xl"
      >
        <AnimatePresence mode="popLayout">
          <motion.span
            key={i}
            initial={{ y: -40, opacity: 0, filter: "blur(8px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ y: 40, opacity: 0, filter: "blur(8px)" }}
            transition={{ duration: 0.45 }}
            className="inline-block whitespace-nowrap"
          >
            {words[i]}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </>
  );
}
