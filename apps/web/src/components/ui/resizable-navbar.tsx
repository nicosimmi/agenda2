import { createContext, useContext, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

// Sombra suave de la píldora cuando se encoge al bajar.
const PILL_SHADOW =
  "0 0 24px rgba(34,42,53,.06), 0 0 0 1px rgba(34,42,53,.05), 0 16px 68px rgba(47,48,55,.05)";

/** Indica a los hijos si la página ya se ha desplazado lo bastante como para encoger el menú. */
const Shrunk = createContext(false);

export function Navbar({ children, className }: { children: ReactNode; className?: string }) {
  const { scrollY } = useScroll();
  const [shrunk, setShrunk] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setShrunk(y > 100));

  return (
    <Shrunk.Provider value={shrunk}>
      <div className={cn("sticky inset-x-0 top-20 z-40 w-full", className)}>{children}</div>
    </Shrunk.Provider>
  );
}

export function NavBody({ children, className }: { children: ReactNode; className?: string }) {
  const shrunk = useContext(Shrunk);
  return (
    <motion.div
      animate={{
        width: shrunk ? "40%" : "100%",
        y: shrunk ? 20 : 0,
        boxShadow: shrunk ? PILL_SHADOW : "none",
      }}
      transition={{ type: "spring", stiffness: 200, damping: 50 }}
      className={cn(
        "relative z-[60] mx-auto hidden max-w-7xl flex-row items-center justify-between self-start rounded-full px-4 py-2 lg:flex",
        shrunk && "bg-surface/80 backdrop-blur-md",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

export function NavItems({
  items,
  className,
}: {
  items: { name: string; link: string }[];
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div
      onMouseLeave={() => setHovered(null)}
      className={cn(
        "absolute inset-0 hidden flex-1 flex-row items-center justify-center gap-2 text-sm font-medium lg:flex",
        className,
      )}
    >
      {items.map((item, i) => (
        <Link
          key={item.link}
          to={item.link}
          onMouseEnter={() => setHovered(i)}
          className="text-muted hover:text-fg relative px-4 py-2 transition-colors"
        >
          {hovered === i && (
            <motion.span
              layoutId="nav-hover"
              className="bg-surface-2 absolute inset-0 rounded-full"
            />
          )}
          <span className="relative z-20">{item.name}</span>
        </Link>
      ))}
    </div>
  );
}

export function MobileNav({ children, className }: { children: ReactNode; className?: string }) {
  const shrunk = useContext(Shrunk);
  return (
    <motion.div
      animate={{
        width: shrunk ? "90%" : "100%",
        y: shrunk ? 20 : 0,
        boxShadow: shrunk ? PILL_SHADOW : "none",
      }}
      transition={{ type: "spring", stiffness: 200, damping: 50 }}
      className={cn(
        "relative z-50 mx-auto flex w-full max-w-[calc(100vw-2rem)] flex-col items-center justify-between rounded-2xl py-2 lg:hidden",
        shrunk ? "bg-surface/80 px-3 backdrop-blur-md" : "px-0",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

export function MobileNavHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full flex-row items-center justify-between", className)}>
      {children}
    </div>
  );
}

export function MobileNavMenu({
  children,
  className,
  isOpen,
}: {
  children: ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className={cn(
            "absolute inset-x-0 top-16 z-50 flex w-full flex-col items-start gap-4 rounded-lg px-4 py-8 shadow-lg",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function MobileNavToggle({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  const Icon = isOpen ? IconX : IconMenu2;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
      aria-expanded={isOpen}
      className="flex size-9 cursor-pointer items-center justify-center"
    >
      <Icon />
    </button>
  );
}
