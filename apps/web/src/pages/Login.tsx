import type { FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import type { Me } from "@agendia/shared";
import { api } from "../api.ts";
import { homeFor, useAuth } from "../auth.tsx";
import { Faq } from "../components/Faq.tsx";
import { FAQ } from "../faqs.ts";
import { Card, Field, FormError, Page, SubmitButton, useAction } from "../ui.tsx";

export function Login() {
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
        await api<Me>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: f.get("email"), password: f.get("password") }),
        }),
      ),
    );
  }

  const next = volver ? `?volver=${encodeURIComponent(volver)}` : "";
  return (
    <>
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
          <SubmitButton busy={busy}>Entrar</SubmitButton>
        </form>
        <p className="text-muted text-sm">
          ¿Primera vez?{" "}
          <Link to={`/registro${next}`} className="text-gold-dark font-semibold underline">
            Crea tu cuenta
          </Link>
          {" · "}
          <Link to="/alta" className="text-gold-dark font-semibold underline">
            Tengo un negocio
          </Link>
        </p>
      </Card>
      <Page className="mt-12">
        <Faq items={FAQ.entrar!} />
      </Page>
    </>
  );
}
