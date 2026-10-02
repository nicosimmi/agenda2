import { Navigate, NavLink, Outlet } from "react-router-dom";
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
  if (me === undefined) return null;
  if (!me) return <Navigate to="/entrar" replace />;
  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="bg-ink flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg px-5 py-3 text-white">
        <strong className="text-gold mr-2 text-lg">AgendIA</strong>
        <nav className="flex flex-wrap gap-4">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/panel"}
              className={({ isActive }) =>
                `hover:text-gold border-b-2 py-1 ${isActive ? "text-gold border-gold" : "border-transparent"}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <button onClick={logout} className="hover:text-gold ml-auto text-sm">
          Salir ({me.name})
        </button>
      </header>
      <main className="mt-6 space-y-6">
        <Outlet />
      </main>
    </div>
  );
}
