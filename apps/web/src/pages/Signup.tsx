import type { FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import type { Me } from "@agendia/shared";
import { api } from "../api.ts";
import { homeFor, useAuth } from "../auth.tsx";
import { Faq } from "../components/Faq.tsx";
import { FAQ } from "../faqs.ts";
import { Card, Field, FormError, Page, SubmitButton, useAction } from "../ui.tsx";

/** Alta de cliente: nombre, email y contraseña. */
export function Signup() {
  const { me, setMe } = useAuth();
  const [params] = useSearchParams();
  const volver = params.get("volver");
  const { error, busy, run } = useAction();
  if (me) return <Navigate to={homeFor(me, volver)} replace />;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run(async () =>
      setMe(
        await api<Me>("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            role: "customer",
            name: f.get("name"),
            email: f.get("email"),
            password: f.get("password"),
          }),
        }),
      ),
    );
  }

  const next = volver ? `?volver=${encodeURIComponent(volver)}` : "";
  return (
    <>
      <Card title="Crear cuenta">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Tu nombre" name="name" autoComplete="name" required />
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          <Field
            label="Contraseña (mínimo 8 caracteres)"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <FormError message={error} />
          <SubmitButton busy={busy}>Crear cuenta</SubmitButton>
        </form>
        <p className="text-muted text-sm">
          ¿Ya tienes cuenta?{" "}
          <Link to={`/entrar${next}`} className="text-gold-dark font-semibold underline">
            Entrar
          </Link>
          {" · "}
          <Link to="/alta" className="text-gold-dark font-semibold underline">
            Tengo un negocio
          </Link>
        </p>
      </Card>
      <Page className="mt-12">
        <Faq items={FAQ.registro!} />
      </Page>
    </>
  );
}
