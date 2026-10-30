import { memo } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

// Posición (en %), inclinación y ritmo de cada haz. Fijos, para que el fondo no cambie entre renders.
const BEAMS = [
  { x: 6, tilt: -18, delay: 0, time: 9 },
  { x: 17, tilt: -12, delay: 3, time: 11 },
  { x: 29, tilt: -20, delay: 6, time: 8 },
  { x: 41, tilt: -10, delay: 1, time: 12 },
  { x: 53, tilt: -16, delay: 4, time: 10 },
  { x: 64, tilt: -22, delay: 7, time: 9 },
  { x: 76, tilt: -12, delay: 2, time: 11 },
  { x: 88, tilt: -18, delay: 5, time: 8 },
];

/** Haces de luz dorada que se encienden y apagan en el fondo. El padre debe ser `relative`. */
export const BackgroundBeams = memo(function BackgroundBeams({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {BEAMS.map((b) => (
        <motion.span
          key={b.x}
          className="absolute -top-1/4 h-[150%] w-px bg-gradient-to-b from-transparent via-[#c89b3c] to-transparent"
          style={{ left: `${b.x}%`, rotate: b.tilt }}
          animate={{ opacity: [0, 0.8, 0], y: ["-6%", "6%", "-6%"] }}
          transition={{ duration: b.time, delay: b.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
});
