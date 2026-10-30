import { useRef, type ReactNode } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

/** Contenido con una línea dorada a la izquierda que se va rellenando según se avanza por la página. */
export function TracingBeam({ children, className }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: box, offset: ["start center", "end center"] });
  const fill = useSpring(scrollYProgress, { stiffness: 300, damping: 40 });
  const top = useTransform(fill, (n) => `${n * 100}%`);

  return (
    <div ref={box} className={cn("relative mx-auto w-full max-w-4xl", className)}>
      <div
        aria-hidden
        className="bg-line absolute top-3 bottom-3 left-0 w-0.5 rounded-full motion-reduce:hidden md:-left-16"
      >
        <motion.div
          style={{ scaleY: fill }}
          className="from-gold to-gold-dark h-full origin-top rounded-full bg-gradient-to-b"
        />
        <motion.span
          style={{ top }}
          className="bg-gold absolute left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
        />
      </div>
      <div className="md:pl-4">{children}</div>
    </div>
  );
}
