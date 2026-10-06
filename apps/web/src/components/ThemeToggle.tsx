import { IconMoon, IconSun } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useTheme } from "../theme.tsx";

/** Interruptor claro/oscuro: una píldora con el sol y la luna y una bola dorada que se desliza. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Modo oscuro"
      title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      onClick={toggle}
      className={`border-line bg-surface-2 relative h-8 w-[3.75rem] shrink-0 cursor-pointer rounded-full border transition-colors ${className}`}
    >
      <IconSun
        aria-hidden
        className="text-muted absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-60"
      />
      <IconMoon
        aria-hidden
        className="text-muted absolute top-1/2 right-2 size-4 -translate-y-1/2 opacity-60"
      />
      <motion.span
        aria-hidden
        initial={false}
        animate={{ x: dark ? 28 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className="bg-gold text-ink absolute top-0.5 left-0.5 flex size-6 items-center justify-center rounded-full shadow"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.18 }}
            className="flex"
          >
            {dark ? <IconMoon className="size-4" /> : <IconSun className="size-4" />}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </button>
  );
}
