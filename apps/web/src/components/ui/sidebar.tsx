import { createContext, useContext, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface SidebarLinkData {
  label: string;
  href: string;
  end?: boolean;
  icon: ReactNode;
}

const SidebarContext = createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);

function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("Los enlaces del menú lateral van dentro de <Sidebar>");
  return ctx;
}

/** Guarda si el menú está abierto: se despliega al pasar el puntero (escritorio) o con el botón (móvil). */
export function Sidebar({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <SidebarContext.Provider value={{ open, setOpen }}>{children}</SidebarContext.Provider>;
}

/** Barra lateral estrecha en escritorio y barra superior con menú a pantalla completa en móvil. */
export function SidebarBody({ className, children }: { className?: string; children: ReactNode }) {
  const { open, setOpen } = useSidebar();
  return (
    <>
      <motion.aside
        animate={{ width: open ? 300 : 60 }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={cn("hidden shrink-0 flex-col px-4 py-4 md:flex", className)}
      >
        {children}
      </motion.aside>

      <div className="bg-ink flex h-10 w-full items-center justify-end px-4 md:hidden">
        <button
          type="button"
          aria-label="Abrir menú"
          onClick={() => setOpen(true)}
          className="cursor-pointer text-stone-200"
        >
          <IconMenu2 />
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={cn(
              "fixed inset-0 z-[100] flex flex-col justify-between p-10 md:hidden",
              className,
            )}
          >
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={() => setOpen(false)}
              className="absolute top-10 right-10 cursor-pointer text-stone-200"
            >
              <IconX />
            </button>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function SidebarLink({ link, className }: { link: SidebarLinkData; className?: string }) {
  const { open, setOpen } = useSidebar();
  return (
    <NavLink
      to={link.href}
      end={link.end ?? false}
      aria-label={link.label}
      onClick={() => setOpen(false)}
      className={({ isActive }) =>
        cn("group/link flex items-center gap-2 py-2", className, isActive && "text-gold")
      }
    >
      {link.icon}
      <span
        className={cn(
          "inline-block text-sm whitespace-pre transition-[opacity,transform] duration-150 group-hover/link:translate-x-1",
          // En escritorio el texto solo se ve con la barra desplegada; en el menú móvil siempre.
          !open && "md:hidden",
        )}
      >
        {link.label}
      </span>
    </NavLink>
  );
}
