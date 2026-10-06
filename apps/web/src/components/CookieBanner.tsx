import { IconCookie } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router-dom";

const KEY = "agendia-cookies";

function alreadyAnswered() {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Aviso de cookies. AgendIA solo usa cookies técnicas (la sesión) y guarda en el navegador el tema
 * y esta elección, así que no hay nada opcional que rechazar: el aviso informa y recuerda la respuesta.
 */
export function CookieBanner() {
  const [open, setOpen] = useState(() => !alreadyAnswered());

  const close = () => {
    try {
      localStorage.setItem(KEY, "ok");
    } catch {
      /* sin almacenamiento volverá a salir en la siguiente visita */
    }
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          role="dialog"
          aria-label="Aviso de cookies"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ delay: 0.8, type: "spring", stiffness: 260, damping: 26 }}
          className="border-line bg-surface fixed bottom-4 left-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-2xl border p-5 shadow-2xl sm:bottom-6 sm:left-6"
        >
          <div className="flex items-start gap-3">
            <span className="bg-gold/20 text-gold-dark flex size-10 shrink-0 items-center justify-center rounded-full">
              <IconCookie className="size-5" />
            </span>
            <div>
              <p className="font-bold">Solo cookies necesarias</p>
              <p className="text-muted mt-1 text-sm">
                Usamos una cookie para mantener tu sesión y guardamos tu tema. No hay publicidad ni
                analítica.{" "}
                <Link to="/cookies" className="text-gold-dark underline">
                  Más información
                </Link>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="bg-gold text-ink hover:bg-gold-hover mt-4 w-full cursor-pointer rounded-md px-4 py-2 font-semibold transition-colors"
          >
            Entendido
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
