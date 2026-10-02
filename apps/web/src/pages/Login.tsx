import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import type { Me } from "@agendia/shared";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { buttonClass, Card, Field, FormError } from "../ui.tsx";

export function Login() {
  const { me, setMe } = useAuth();
  const [error, setError] = useState<string | null>(null);
  if (me) return <Navigate to="/panel" replace />;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      setMe(
        await api<Me>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: f.get("email"), password: f.get("password") }),
        }),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Card title="Entrar">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <FormError message={error} />
        <button className={buttonClass}>Entrar</button>
      </form>
      <p className="text-muted text-sm">
        ¿Tienes un negocio?{" "}
        <Link to="/alta" className="text-gold-dark font-semibold underline">
          Date de alta
        </Link>
      </p>
    </Card>
  );
}
