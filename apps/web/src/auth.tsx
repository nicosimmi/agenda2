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
    await api("/auth/logout", { method: "POST" });
    setMe(null);
  };

  return <AuthContext value={{ me, setMe, logout }}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fuera de AuthProvider");
  return ctx;
}
