import { useMemo } from "react";
import { cn } from "@/lib/utils";

/** Estrellas fugaces que cruzan el contenedor en diagonal (el padre debe ser `relative overflow-hidden`). */
export function Meteors({ number = 20, className }: { number?: number; className?: string }) {
  const streaks = useMemo(
    () =>
      Array.from({ length: number }, (_, i) => ({
        left: `${(i / number) * 120 - 10}%`,
        delay: `${(Math.random() * 6).toFixed(2)}s`,
        duration: `${(4 + Math.random() * 5).toFixed(2)}s`,
      })),
    [number],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {streaks.map((s, i) => (
        <span
          key={i}
          className={cn(
            "animate-meteor absolute -top-4 h-px w-16 bg-gradient-to-r from-slate-300 to-transparent",
            className,
          )}
          style={{ left: s.left, animationDelay: s.delay, animationDuration: s.duration }}
        />
      ))}
    </div>
  );
}
