import { AnimatePresence, motion } from "motion/react";
import { Navigate, NavLink, useLocation, useOutlet } from "react-router-dom";
import { useAuth } from "../auth.tsx";

const links = [
  ["/panel", "Inicio"],
  ["/panel/perfil", "Perfil"],
  ["/panel/servicios", "Servicios"],
  ["/panel/equipo", "Equipo"],
  ["/panel/agenda", "Agenda"],
] as const;

export function Panel() {
  const { me, logout } = useAuth();
  const { pathname } = useLocation();
  // useOutlet congela la ruta que sale mientras dura su animación de salida.
  const outlet = useOutlet();
  if (me === undefined) return null;
  if (!me) return <Navigate to="/entrar" replace />;
  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-ink sticky top-3 z-30 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl px-5 py-3 text-white shadow-lg"
      >
        <strong className="text-gold mr-2 text-lg">AgendIA</strong>
        <nav className="flex flex-wrap gap-4">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/panel"}
              className={({ isActive }) =>
                `relative py-1 transition-colors ${isActive ? "text-gold" : "hover:text-gold"}`
              }
            >
              {({ isActive }) => (
                <>
                  {label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-underline"
                      className="bg-gold absolute inset-x-0 -bottom-0.5 h-0.5 rounded"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <button onClick={logout} className="hover:text-gold ml-auto text-sm transition-colors">
          Salir ({me.name})
        </button>
      </motion.header>
      <main className="mt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
