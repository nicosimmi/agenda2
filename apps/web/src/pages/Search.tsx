import { IconMapPin, IconSearch } from "@tabler/icons-react";
import { motion } from "motion/react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CardBody, CardContainer, CardItem } from "@/components/ui/3d-card";
import { Spotlight } from "@/components/ui/spotlight-new";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { CategoryIcon } from "../components/categoryIcon.tsx";
import { Faq } from "../components/Faq.tsx";
import { Loading, Skeleton } from "../components/Skeleton.tsx";
import { FAQ } from "../faqs.ts";
import { euros } from "../format.ts";
import type { BusinessSummary, SearchPage } from "../types.ts";
import { buttonClass, inputClass, Page, secondaryButtonClass } from "../ui.tsx";
import { useApi, useCategories } from "../useApi.ts";

const PAGE_SIZE = 9;

function BusinessCard({ b, index }: { b: BusinessSummary; index: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.06, duration: 0.4 }}
    >
      <Link
        to={`/n/${b.slug}`}
        className="block rounded-2xl focus-visible:outline-offset-4"
        aria-label={`${b.name}, ${b.categoryName}${b.city ? ` en ${b.city}` : ""}`}
      >
        <CardContainer containerClassName="py-0" className="w-full">
          <CardBody className="border-line bg-surface group relative h-full w-full rounded-2xl border p-5 shadow-sm transition-shadow hover:shadow-xl hover:shadow-amber-900/10">
            <CardItem translateZ={40} className="flex w-full items-center justify-between">
              <span className="bg-gold/20 text-gold-dark flex items-center gap-2 rounded-full py-1 pr-3 pl-1.5 text-sm font-semibold">
                <span className="bg-gold text-ink flex size-6 items-center justify-center rounded-full">
                  <CategoryIcon slug={b.categorySlug} className="size-4" />
                </span>
                {b.categoryName}
              </span>
              {b.minPriceCents !== null && (
                <span className="text-muted text-sm">desde {euros(b.minPriceCents)}</span>
              )}
            </CardItem>
            <CardItem translateZ={60} as="h2" className="mt-4 text-xl font-bold">
              {b.name}
            </CardItem>
            {(b.city || b.addressLine) && (
              <CardItem translateZ={30} className="text-muted mt-1 flex items-center gap-1 text-sm">
                <IconMapPin className="size-4 shrink-0" aria-hidden />
                {[b.addressLine, b.city].filter(Boolean).join(", ")}
              </CardItem>
            )}
            {b.description && (
              <CardItem translateZ={20} as="p" className="text-muted mt-3 line-clamp-2 text-sm">
                {b.description}
              </CardItem>
            )}
            <CardItem
              translateZ={50}
              as="span"
              className="text-gold-dark mt-4 inline-block text-sm font-bold group-hover:underline"
            >
              Ver horarios y reservar
            </CardItem>
          </CardBody>
        </CardContainer>
      </Link>
    </motion.li>
  );
}

function CardSkeleton() {
  return (
    <li className="border-line bg-surface rounded-2xl border p-5" aria-hidden>
      <Skeleton className="h-7 w-32 rounded-full" />
      <Skeleton className="mt-4 h-6 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      <Skeleton className="mt-4 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-2/3" />
    </li>
  );
}

export function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const city = params.get("city") ?? "";
  const category = params.get("category") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const categories = useCategories();
  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (q) query.set("q", q);
  if (city) query.set("city", city);
  if (category) query.set("category", category);
  const results = useApi<SearchPage>(`/public/businesses?${query}`);

  // Los campos del formulario siguen a la URL (por ejemplo, al llegar desde el buscador rápido).
  const [text, setText] = useState(q);
  const [cityText, setCityText] = useState(city);
  useEffect(() => setText(q), [q]);
  useEffect(() => setCityText(city), [city]);

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in changes)) next.delete("page");
    setParams(next);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    update({ q: text.trim(), city: cityText.trim() });
  };

  const totalPages = results.data ? Math.max(1, Math.ceil(results.data.total / PAGE_SIZE)) : 1;
  const filtered = Boolean(q || city || category);

  return (
    <>
      <section className="bg-ink relative overflow-hidden text-white">
        <Spotlight />
        <Page className="relative py-14 md:py-20">
          <h1 className="max-w-2xl text-3xl font-bold md:text-5xl">
            <TextGenerateEffect words="Encuentra tu próximo hueco" />
          </h1>
          <form
            onSubmit={submit}
            role="search"
            className="mt-8 grid gap-3 md:grid-cols-[2fr_1fr_auto]"
          >
            <label className="relative block">
              <span className="sr-only">Qué buscas</span>
              <IconSearch
                className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-stone-400"
                aria-hidden
              />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Barbería, fisioterapia, nombre del negocio…"
                className={`${inputClass} text-fg !mt-0 h-12 pl-10`}
              />
            </label>
            <label className="relative block">
              <span className="sr-only">Ciudad</span>
              <IconMapPin
                className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-stone-400"
                aria-hidden
              />
              <input
                value={cityText}
                onChange={(e) => setCityText(e.target.value)}
                placeholder="Ciudad"
                className={`${inputClass} text-fg !mt-0 h-12 pl-10`}
              />
            </label>
            <button className={`${buttonClass} h-12 px-8`}>Buscar</button>
          </form>
          <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Categorías">
            <button
              type="button"
              aria-pressed={!category}
              onClick={() => update({ category: "" })}
              className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm transition-colors ${
                !category
                  ? "border-gold bg-gold text-ink font-semibold"
                  : "border-white/20 hover:border-white/50"
              }`}
            >
              Todas
            </button>
            {categories.data?.map((c) => (
              <button
                key={c.slug}
                type="button"
                aria-pressed={category === c.slug}
                onClick={() => update({ category: category === c.slug ? "" : c.slug })}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  category === c.slug
                    ? "border-gold bg-gold text-ink font-semibold"
                    : "border-white/20 hover:border-white/50"
                }`}
              >
                <CategoryIcon slug={c.slug} className="size-4" />
                {c.name}
              </button>
            ))}
            {categories.loading &&
              [0, 1, 2, 3, 4].map((n) => <Skeleton key={n} className="h-8 w-24 rounded-full" />)}
          </div>
        </Page>
      </section>

      <Page className="py-10">
        <p className="text-muted mb-6" role="status" aria-live="polite">
          {results.loading
            ? "Buscando…"
            : results.data
              ? `${results.data.total} ${results.data.total === 1 ? "negocio" : "negocios"}${
                  filtered ? " con esos filtros" : ""
                }`
              : ""}
        </p>

        {results.error && (
          <div role="alert" className="border-line bg-surface rounded-xl border p-8 text-center">
            <p className="font-semibold">No hemos podido cargar los resultados</p>
            <p className="text-muted mt-1">{results.error}</p>
            <button onClick={() => void results.reload()} className={`${buttonClass} mt-4`}>
              Reintentar
            </button>
          </div>
        )}

        {results.loading && (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Loading label="Buscando negocios…" />
            {Array.from({ length: 6 }, (_, n) => (
              <CardSkeleton key={n} />
            ))}
          </ul>
        )}

        {results.data && results.data.items.length > 0 && (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.data.items.map((b, i) => (
              <BusinessCard key={b.slug} b={b} index={i} />
            ))}
          </ul>
        )}

        {results.data && results.data.items.length === 0 && (
          <div className="border-line bg-surface rounded-xl border p-10 text-center">
            <IconSearch className="text-gold mx-auto size-10" aria-hidden />
            <p className="mt-3 text-lg font-bold">No hay negocios que coincidan</p>
            <p className="text-muted mt-1">
              Prueba con menos palabras, otra ciudad o quita la categoría.
            </p>
            {filtered && (
              <button
                onClick={() => setParams(new URLSearchParams())}
                className={`${secondaryButtonClass} mt-5`}
              >
                Quitar filtros
              </button>
            )}
          </div>
        )}

        {totalPages > 1 && (
          <nav
            aria-label="Páginas de resultados"
            className="mt-10 flex items-center justify-center gap-3"
          >
            <button
              disabled={page <= 1}
              onClick={() => update({ page: String(page - 1) })}
              className={secondaryButtonClass}
            >
              Anterior
            </button>
            <span className="text-muted text-sm">
              Página {page} de {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => update({ page: String(page + 1) })}
              className={secondaryButtonClass}
            >
              Siguiente
            </button>
          </nav>
        )}

        <Faq items={FAQ.buscar!} className="mt-16" />
      </Page>
    </>
  );
}
