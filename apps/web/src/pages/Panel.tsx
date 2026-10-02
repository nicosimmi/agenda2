import { Navigate } from "react-router-dom";
import { useAuth } from "../auth.tsx";
import { buttonClass } from "../ui.tsx";

export function Panel() {
  const { me, logout } = useAuth();
  if (me === undefined) return null;
  if (!me) return <Navigate to="/entrar" replace />;
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-bold">Hola, {me.name}</h1>
      <p className="text-muted mt-2">Aquí irá el panel del negocio.</p>
      <button onClick={logout} className={`${buttonClass} mt-6`}>
        Salir
      </button>
    </main>
  );
}
