import {
  IconArrowLeft,
  IconExternalLink,
  IconMail,
  IconMapPin,
  IconPhone,
} from "@tabler/icons-react";
import { motion } from "motion/react";
import { Link, useParams } from "react-router-dom";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { BookingFlow } from "../components/BookingFlow.tsx";
import { CategoryIcon } from "../components/categoryIcon.tsx";
import { Faq } from "../components/Faq.tsx";
import { Loading, Skeleton } from "../components/Skeleton.tsx";
import { FAQ } from "../faqs.ts";
import { duration, euros, WEEKDAYS } from "../format.ts";
import type { BusinessDetail } from "../types.ts";
import { ButtonLink, Page } from "../ui.tsx";
import { useApi } from "../useApi.ts";

/** Horario del negocio por día: une las franjas de todo el equipo ("09:00–14:00, 17:00–20:00"). */
function openingHours(hours: BusinessDetail["hours"]) {
  return WEEKDAYS.map((name, i) => {
    const ranges = hours
      .filter((h) => h.weekday === i + 1)
      .map((h) => [h.startTime.slice(0, 5), h.endTime.slice(0, 5)] as [string, string])
      .sort((a, b) => a[0].localeCompare(b[0]));
    const merged: [string, string][] = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = r[1] > last[1] ? r[1] : last[1];
      else merged.push([...r]);
    }
    return {
      name,
      text: merged.length ? merged.map(([a, b]) => `${a}–${b}`).join(", ") : "Cerrado",
    };
  });
}

function Block({
  title,
  children,
  delay = 0,
}: {
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4, delay }}
      className="border-line bg-surface rounded-2xl border p-6"
    >
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </motion.section>
  );
}

function BusinessSkeleton() {
  return (
    <div aria-hidden>
      <Loading label="Cargando el negocio…" />
      <div className="bg-ink py-14">
        <Page>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-4 h-10 w-2/3" />
          <Skeleton className="mt-3 h-5 w-1/3" />
        </Page>
      </div>
      <Page className="grid gap-8 py-10 lg:grid-cols-[1fr_26rem]">
        <div className="space-y-6">
          <Skeleton className="h-40" />
          <Skeleton className="h-56" />
        </div>
        <Skeleton className="h-96" />
      </Page>
    </div>
  );
}

export function Business() {
  const { slug = "" } = useParams();
  const {
    data: b,
    loading,
    error,
    status,
    reload,
  } = useApi<BusinessDetail>(`/public/businesses/${encodeURIComponent(slug)}`);

  if (loading) return <BusinessSkeleton />;

  if (error || !b) {
    const missing = status === 404;
    return (
      <Page className="py-20 text-center">
        <h1 className="text-3xl font-bold">
          {missing ? "No encontramos este negocio" : "No hemos podido cargar el negocio"}
        </h1>
        <p className="text-muted mx-auto mt-3 max-w-md">
          {missing
            ? "La dirección no existe o el negocio ya no está publicado."
            : (error ?? "Inténtalo de nuevo en unos segundos.")}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <ButtonLink to="/buscar">Buscar negocios</ButtonLink>
          {!missing && (
            <button
              onClick={() => void reload()}
              className="border-line hover:border-fg cursor-pointer rounded-md border px-4 py-2 font-semibold"
            >
              Reintentar
            </button>
          )}
        </div>
        <Faq items={FAQ.noEncontrada!} className="mx-auto mt-16 max-w-3xl text-left" />
      </Page>
    );
  }

  const address = [b.addressLine, b.postalCode, b.city, b.province].filter(Boolean).join(", ");
  const map = `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;
  const faq = [
    ...b.faq.map((f) => ({ q: f.question, a: f.answer })),
    ...FAQ.negocio!,
    {
      q: "¿Hasta cuándo puedo cancelar?",
      a: `Hasta ${b.cancelLimitHours} horas antes de la cita, desde Mis reservas. Después, contacta con el negocio.`,
    },
  ];

  return (
    <>
      <section className="bg-ink relative overflow-hidden text-white">
        <BackgroundBeams className="opacity-40" />
        <Page className="relative py-10 md:py-14">
          <Link
            to="/buscar"
            className="inline-flex items-center gap-1 text-sm text-stone-300 transition-colors hover:text-white"
          >
            <IconArrowLeft className="size-4" aria-hidden /> Volver a los resultados
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 flex flex-wrap items-start justify-between gap-6"
          >
            <div>
              <Link
                to={`/buscar?category=${b.categorySlug}`}
                className="bg-gold/20 text-gold inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold"
              >
                <CategoryIcon slug={b.categorySlug} className="size-4" />
                {b.categoryName}
              </Link>
              <h1 className="mt-3 text-3xl font-bold md:text-5xl">{b.name}</h1>
              {address && (
                <p className="mt-3 flex items-center gap-1.5 text-stone-300">
                  <IconMapPin className="size-5 shrink-0" aria-hidden />
                  {address}
                </p>
              )}
            </div>
            <a
              href="#reservar"
              className="bg-gold text-ink hover:bg-gold-hover rounded-md px-6 py-3 font-bold transition-colors lg:hidden"
            >
              Reservar ahora
            </a>
          </motion.div>
        </Page>
      </section>

      <Page className="grid gap-8 py-10 lg:grid-cols-[1fr_26rem]">
        <div className="order-2 space-y-6 lg:order-1">
          {b.description && (
            <Block title="Sobre el negocio">
              <p className="text-muted leading-relaxed whitespace-pre-line">{b.description}</p>
            </Block>
          )}

          <Block title="Servicios y precios">
            <ul className="divide-line divide-y">
              {b.services.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-muted text-sm">
                      {duration(s.durationMin)}
                      {s.description && ` · ${s.description}`}
                    </p>
                  </div>
                  <p className="font-bold">{euros(s.priceCents)}</p>
                </li>
              ))}
            </ul>
          </Block>

          {b.staff.length > 0 && (
            <Block title="El equipo">
              <ul className="grid gap-3 sm:grid-cols-2">
                {b.staff.map((m) => (
                  <li
                    key={m.id}
                    className="border-line flex items-center gap-3 rounded-xl border p-3"
                  >
                    <span className="bg-gold text-ink flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-bold">
                      {m.name.slice(0, 1)}
                    </span>
                    <span>
                      <span className="block font-semibold">{m.name}</span>
                      <span className="text-muted block text-sm">
                        {m.serviceIds.length} {m.serviceIds.length === 1 ? "servicio" : "servicios"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Block>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <Block title="Horario">
              <table className="w-full text-sm">
                <tbody>
                  {openingHours(b.hours).map((d) => (
                    <tr key={d.name} className="border-line border-b last:border-0">
                      <th scope="row" className="py-2 pr-3 text-left font-semibold">
                        {d.name}
                      </th>
                      <td className={`py-2 text-right ${d.text === "Cerrado" ? "text-muted" : ""}`}>
                        {d.text}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Block>
            <Block title="Dónde y cómo contactar" delay={0.1}>
              <ul className="space-y-3 text-sm">
                {address && (
                  <li className="flex gap-2">
                    <IconMapPin className="text-gold-dark size-5 shrink-0" aria-hidden />
                    <span>
                      {address}
                      <a
                        href={map}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-gold-dark mt-1 flex items-center gap-1 font-semibold underline"
                      >
                        Ver en el mapa <IconExternalLink className="size-4" aria-hidden />
                      </a>
                    </span>
                  </li>
                )}
                {b.contactPhone && (
                  <li className="flex gap-2">
                    <IconPhone className="text-gold-dark size-5 shrink-0" aria-hidden />
                    <a href={`tel:${b.contactPhone}`} className="hover:underline">
                      {b.contactPhone}
                    </a>
                  </li>
                )}
                {b.contactEmail && (
                  <li className="flex gap-2">
                    <IconMail className="text-gold-dark size-5 shrink-0" aria-hidden />
                    <a href={`mailto:${b.contactEmail}`} className="break-all hover:underline">
                      {b.contactEmail}
                    </a>
                  </li>
                )}
                {!address && !b.contactPhone && !b.contactEmail && (
                  <li className="text-muted">El negocio no ha añadido datos de contacto.</li>
                )}
              </ul>
            </Block>
          </div>
        </div>

        <aside
          id="reservar"
          className="order-1 scroll-mt-24 lg:order-2 lg:sticky lg:top-24 lg:self-start"
        >
          <BookingFlow business={b} />
        </aside>
      </Page>

      <Page className="pb-4">
        <Faq items={faq} />
      </Page>
    </>
  );
}
