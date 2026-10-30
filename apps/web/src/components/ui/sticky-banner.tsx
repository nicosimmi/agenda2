import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

/** Franja fija arriba con un botón para cerrarla. Con `hideOnScroll` se esconde al bajar. */
export function StickyBanner({
  className,
  children,
  hideOnScroll = false,
}: {
  className?: string;
  children: ReactNode;
  hideOnScroll?: boolean;
}) {
  const [shown, setShown] = useState(true);

  useEffect(() => {
    if (!hideOnScroll) return;
    const onScroll = () => setShown(window.scrollY <= 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hideOnScroll]);

  return (
    <motion.div
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: shown ? 0 : -80, opacity: shown ? 1 : 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "sticky top-0 z-40 flex min-h-14 w-full items-center justify-center px-10",
        className,
      )}
    >
      {children}
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={() => setShown(false)}
        className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-white"
      >
        <IconX className="size-5" />
      </button>
    </motion.div>
  );
}
