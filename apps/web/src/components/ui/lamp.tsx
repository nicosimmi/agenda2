import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Bloque oscuro con un cono de luz dorada que cae desde el borde superior sobre el contenido. */
export function LampContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-ink relative isolate flex min-h-[20rem] w-full flex-col items-center justify-center overflow-hidden px-5 py-20",
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full">
        <motion.div
          initial={{ opacity: 0.4, width: "14rem" }}
          whileInView={{ opacity: 1, width: "36rem" }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
          className="absolute top-0 left-1/2 h-full max-w-full -translate-x-1/2 [background:radial-gradient(ellipse_at_50%_0%,rgba(200,155,60,0.55),transparent_70%)]"
        />
        <motion.div
          initial={{ width: "8rem" }}
          whileInView={{ width: "24rem" }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
          className="absolute top-0 left-1/2 h-0.5 max-w-full -translate-x-1/2 bg-[#d9b25f] shadow-[0_0_30px_8px_rgba(217,178,95,0.6)]"
        />
      </div>
      <div className="relative flex flex-col items-center">{children}</div>
    </div>
  );
}
