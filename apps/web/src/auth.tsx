import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Me } from "@agendia/shared";
import { api } from "./api.ts";

interface AuthState {
  /** undefined = comprobando la sesión; null = sin sesión. */
  me: Me | null | undefined;
  setMe: (me: Me | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    api<Me>("/auth/me").then(setMe, () => setMe(null));
  }, []);

  const logout = async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    setMe(null);
  };

  return <AuthContext value={{ me, setMe, logout }}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fuera de AuthProvider");
  return ctx;
}

/** Adónde llevar a una persona tras entrar: a donde iba (si es una ruta interna) o a su zona. */
export function homeFor(me: Me, volver: string | null): string {
  if (volver && volver.startsWith("/") && !volver.startsWith("//")) return volver;
  return me.role === "business_owner" ? "/panel" : "/mis-reservas";
}
