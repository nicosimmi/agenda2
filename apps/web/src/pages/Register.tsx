import { AnimatePresence, motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import type { Me } from "@agendia/shared";
import { api } from "../api.ts";
import { homeFor, useAuth } from "../auth.tsx";
import { Faq } from "../components/Faq.tsx";
import { Skeleton } from "../components/Skeleton.tsx";
import { FAQ } from "../faqs.ts";
import {
  buttonClass,
  Card,
  Field,
  FormError,
  inputClass,
  linkButton,
  Page,
  SubmitButton,
  useAction,
} from "../ui.tsx";
import { useCategories } from "../useApi.ts";

const read = (form: HTMLFormElement) =>
  Object.fromEntries(new FormData(form)) as Record<string, string>;

/** Alta del negocio en dos pasos: tu cuenta y tu negocio. Un solo POST al final. */
export function Register() {
  const { me, setMe } = useAuth();
  const categories = useCategories();
  const [step, setStep] = useState(1);
  const [account, setAccount] = useState<Record<string, string>>({});
  const { error, busy, run } = useAction();
  if (me) return <Navigate to={homeFor(me, null)} replace />;

  async function submitBusiness(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const business = read(e.currentTarget);
    await run(async () =>
      setMe(
        await api<Me>("/auth/register", {
          method: "POST",
          body: JSON.stringify({ role: "business_owner", ...account, ...business }),
        }),
      ),
    );
  }

  return (
    <>
      <Card title="Alta de negocio">
        <div>
          <p className="text-muted text-sm">Paso {step} de 2</p>
          <div className="bg-surface-2 mt-2 h-1.5 overflow-hidden rounded-full" aria-hidden>
            <motion.div
              className="bg-gold h-full rounded-full"
              initial={false}
              animate={{ width: step === 1 ? "50%" : "100%" }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
            />
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {step === 1 ? (
            <motion.form
              key="cuenta"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
              onSubmit={(e) => {
                e.preventDefault();
                setAccount(read(e.currentTarget));
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
            </motion.form>
          ) : (
            <motion.form
              key="negocio"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.2 }}
              onSubmit={submitBusiness}
              className="space-y-4"
            >
              <Field label="Nombre del negocio" name="businessName" required />
              <label className="block">
                <span className="text-sm font-semibold">Categoría</span>
                {categories.loading ? (
                  <Skeleton className="mt-1 h-10" />
                ) : (
                  <select name="categorySlug" required className={inputClass}>
                    {categories.data?.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <FormError message={error ?? categories.error} />
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => setStep(1)} className={linkButton}>
                  Atrás
                </button>
                <SubmitButton busy={busy} disabled={!categories.data}>
                  Crear negocio
                </SubmitButton>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
        <p className="text-muted text-sm">
          ¿Ya tienes cuenta?{" "}
          <Link to="/entrar" className="text-gold-dark font-semibold underline">
            Entrar
          </Link>
          {" · "}
          <Link to="/registro" className="text-gold-dark font-semibold underline">
            Soy cliente
          </Link>
        </p>
      </Card>
      <Page className="mt-12">
        <Faq items={FAQ.alta!} />
      </Page>
    </>
  );
}
