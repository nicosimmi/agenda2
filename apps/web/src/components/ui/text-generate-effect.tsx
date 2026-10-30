import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** El texto aparece palabra a palabra, saliendo del desenfoque. */
export function TextGenerateEffect({
  words,
  className,
  duration = 0.5,
}: {
  words: string;
  className?: string;
  duration?: number;
}) {
  return (
    <div className={cn("mt-4 text-2xl leading-snug font-bold tracking-wide", className)}>
      {words.split(" ").map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          initial={{ opacity: 0, filter: "blur(10px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration, delay: i * 0.2 }}
        >
          {word}{" "}
        </motion.span>
      ))}
    </div>
  );
}
