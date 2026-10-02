import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import type { Me } from "@agendia/shared";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { buttonClass, Card, Field, FormError, inputClass } from "../ui.tsx";

// Slugs sembrados en la tabla categories (apps/api/src/db/seed.ts).
// ponytail: lista copiada; cuando exista GET /public/categories (Fase 4) se pide a la API.
const CATEGORIES = [
  ["barberia", "Barbería"],
  ["peluqueria", "Peluquería"],
  ["fisioterapia", "Fisioterapia"],
  ["padel", "Pádel"],
  ["estetica", "Estética"],
  ["veterinaria", "Veterinaria"],
  ["otros", "Otros"],
] as const;

const read = (form: HTMLFormElement) =>
  Object.fromEntries(new FormData(form)) as Record<string, string>;

/** Alta del negocio en dos pasos: tu cuenta y tu negocio. Un solo POST al final. */
export function Register() {
  const { me, setMe } = useAuth();
  const [step, setStep] = useState(1);
  const [account, setAccount] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  if (me) return <Navigate to="/panel" replace />;

  async function submitBusiness(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      setMe(
        await api<Me>("/auth/register", {
          method: "POST",
          body: JSON.stringify({ role: "business_owner", ...account, ...read(e.currentTarget) }),
        }),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Card title="Alta de negocio">
      <p className="text-muted text-sm">Paso {step} de 2</p>
      {step === 1 ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAccount(read(e.currentTarget));
            setError(null);
            setStep(2);
          }}
          className="space-y-4"
        >
          <Field label="Tu nombre" name="name" defaultValue={account.name} required />
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={account.email}
            required
          />
          <Field
            label="Contraseña (mínimo 8 caracteres)"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            defaultValue={account.password}
            required
          />
          <button className={buttonClass}>Siguiente</button>
        </form>
      ) : (
        <form onSubmit={submitBusiness} className="space-y-4">
          <Field label="Nombre del negocio" name="businessName" required />
          <label className="block">
            <span className="text-sm font-semibold">Categoría</span>
            <select name="categorySlug" required className={inputClass}>
              {CATEGORIES.map(([slug, label]) => (
                <option key={slug} value={slug}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <FormError message={error} />
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-gold-dark font-semibold underline"
            >
              Atrás
            </button>
            <button className={buttonClass}>Crear negocio</button>
          </div>
        </form>
      )}
      <p className="text-muted text-sm">
        ¿Ya tienes cuenta?{" "}
        <Link to="/entrar" className="text-gold-dark font-semibold underline">
          Entrar
        </Link>
      </p>
    </Card>
  );
}
