import { IconSearch } from "@tabler/icons-react";
import { motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { GlareCard } from "@/components/ui/glare-card";
import { InfiniteMovingCards } from "@/components/ui/infinite-moving-cards";
import { LampContainer } from "@/components/ui/lamp";
import { LayoutTextFlip } from "@/components/ui/layout-text-flip";
import { TracingBeam } from "@/components/ui/tracing-beam";
import { CategoryIcon } from "../components/categoryIcon.tsx";
import { Faq } from "../components/Faq.tsx";
import { Skeleton } from "../components/Skeleton.tsx";
import { FAQ } from "../faqs.ts";
import { Reveal } from "../motion.tsx";
import { buttonClass, Page } from "../ui.tsx";
import { useCategories } from "../useApi.ts";
import { AgendaMock } from "./landing/AgendaMock.tsx";
import { Features } from "./landing/Features.tsx";
import { GlobeSection } from "./landing/GlobeSection.tsx";

const BLURB: Record<string, string> = {
  barberia: "Corte, barba y arreglo, cada uno con su duración y su precio.",
  peluqueria: "Varios profesionales, cada uno con su horario y sus servicios.",
  fisioterapia: "Sesiones de 45 o 60 minutos con pausa entre pacientes.",
  padel: "Pistas y clases con huecos fijos que se llenan solos.",
  estetica: "Tratamientos largos, con descansos entre uno y otro.",
  veterinaria: "Consultas y vacunas con la agenda del equipo a la vista.",
};

const NAMES: Record<string, string> = {
  barberia: "Barbería",
  peluqueria: "Peluquería",
  fisioterapia: "Fisioterapia",
  padel: "Pádel",
  estetica: "Estética",
  veterinaria: "Veterinaria",
};

const MARQUEE = Object.entries(BLURB).map(([slug, quote]) => ({
  name: NAMES[slug] ?? slug,
  quote,
  title: "Para negocios como el tuyo",
}));

const STEPS = [
  ["Date de alta", "Crea tu cuenta y tu negocio en dos pasos. No hace falta tarjeta."],
  ["Configura tu equipo", "Añade tus servicios, tus profesionales y sus horarios semanales."],
  ["Publica", "Cuando la lista de comprobación está completa, apareces para tus clientes."],
];

function HeroSearch() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [city, setCity] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams();
    if (text.trim()) q.set("q", text.trim());
    if (city.trim()) q.set("city", city.trim());
    navigate(`/buscar${q.size ? `?${q}` : ""}`);
  };
  const box =
    "bg-surface border-line focus:border-gold-dark focus:ring-gold h-12 w-full rounded-md border px-3 focus:ring-2 focus:outline-none";
  return (
    <form
      onSubmit={submit}
      role="search"
      className="mt-8 grid max-w-xl gap-3 sm:grid-cols-[1.5fr_1fr_auto]"
    >
      <label>
        <span className="sr-only">Qué buscas</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Barbería, fisio…"
          className={box}
        />
      </label>
      <label>
        <span className="sr-only">Ciudad</span>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Ciudad"
          className={box}
        />
      </label>
      <button className={`${buttonClass} flex h-12 items-center justify-center gap-2 px-6`}>
        <IconSearch className="size-5" aria-hidden />
        Buscar
      </button>
    </form>
  );
}

function Categories() {
  const { data, loading } = useCategories();
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <Reveal>
        <h2 className="max-w-xl text-3xl font-bold md:text-4xl">
          Reserva en el negocio de tu barrio
        </h2>
        <p className="text-muted mt-3 max-w-xl">
          Elige un tipo de negocio y mira sus servicios, sus horarios y sus huecos libres.
        </p>
      </Reveal>
      <div className="mt-10 grid justify-items-center gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {loading &&
          [0, 1, 2].map((n) => <Skeleton key={n} className="h-[395px] w-[320px] rounded-[48px]" />)}
        {data
          ?.filter((c) => BLURB[c.slug])
          .map((c, i) => (
            <Reveal key={c.slug} delay={(i % 3) * 0.1}>
              <Link to={`/buscar?category=${c.slug}`} aria-label={`Ver negocios de ${c.name}`}>
                <GlareCard className="flex flex-col justify-between p-8 text-white">
                  <span className="bg-gold text-ink flex size-14 items-center justify-center rounded-2xl">
                    <CategoryIcon slug={c.slug} className="size-8" />
                  </span>
                  <div>
                    <h3 className="text-3xl font-bold">{c.name}</h3>
                    <p className="mt-2 text-sm text-stone-300">{BLURB[c.slug]}</p>
                    <p className="text-gold mt-5 text-sm font-bold">Ver negocios</p>
                  </div>
                </GlareCard>
              </Link>
            </Reveal>
          ))}
      </div>
    </section>
  );
}

export function Landing() {
  return (
    <>
      <section className="relative">
        <BackgroundBeams className="opacity-60" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 pt-12 pb-24 md:grid-cols-2 md:pt-20">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-start gap-3"
            >
              <LayoutTextFlip
                text="Reservas para"
                words={["barberías", "clínicas", "peluquerías", "pistas de pádel"]}
              />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-muted mt-6 max-w-md text-lg"
            >
              Encuentra un negocio, mira sus huecos libres y reserva en menos de un minuto. Si
              tienes uno, gestiona servicios, equipo y agenda desde un solo panel.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <HeroSearch />
              <p className="text-muted mt-4 text-sm">
                ¿Tienes un negocio?{" "}
                <Link to="/alta" className="text-gold-dark font-semibold underline">
                  Date de alta
                </Link>
              </p>
            </motion.div>
          </div>
          <AgendaMock />
        </div>
      </section>

      <div className="bg-ink border-y border-white/10 py-6" aria-label="Tipos de negocio">
        <InfiniteMovingCards items={MARQUEE} speed="slow" className="mx-auto max-w-none" />
      </div>

      <Categories />

      <section id="funciones" className="relative scroll-mt-24">
        <ContainerScroll
          titleComponent={
            <>
              <p className="text-gold-dark text-sm font-bold tracking-widest uppercase">
                Para negocios
              </p>
              <h2 className="mt-2 mb-6 text-4xl font-bold md:text-6xl">
                Una agenda que se entiende de un vistazo
              </h2>
            </>
          }
        >
          <img
            src="/img/panel-agenda.png"
            alt="Agenda del panel de AgendIA con las reservas del día"
            className="mx-auto h-full w-full rounded-2xl object-cover object-top"
            draggable={false}
          />
        </ContainerScroll>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <Reveal>
          <h2 className="mb-10 max-w-xl text-4xl font-bold">
            Lo esencial para que reserven en un minuto
          </h2>
        </Reveal>
        <Features />
      </section>

      <section id="como-empezar" className="bg-surface scroll-mt-24 py-24">
        <div className="mx-auto max-w-4xl px-6">
          <Reveal>
            <h2 className="mb-12 text-4xl font-bold">Así empieza tu negocio</h2>
          </Reveal>
          <TracingBeam className="px-6">
            <ol className="space-y-24">
              {STEPS.map(([title, text], i) => (
                <li key={title}>
                  <span className="bg-ink text-gold mb-4 inline-flex size-10 items-center justify-center rounded-full text-lg font-bold">
                    {i + 1}
                  </span>
                  <h3 className="text-3xl font-bold">{title}</h3>
                  <p className="text-muted mt-2 max-w-md text-lg">{text}</p>
                </li>
              ))}
            </ol>
          </TracingBeam>
        </div>
      </section>

      <div id="negocios" className="py-24">
        <GlobeSection />
      </div>

      <Page className="pb-24">
        <Faq items={FAQ.inicio!} />
      </Page>

      <LampContainer className="min-h-[34rem] bg-ink">
        <motion.div
          initial={{ opacity: 0.5, y: 80 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
          className="text-center"
        >
          <h2 className="bg-gradient-to-br from-stone-100 to-stone-400 bg-clip-text pb-4 text-4xl leading-tight font-bold text-transparent md:text-6xl">
            ¿Listo para abrir tu agenda?
          </h2>
          <Link
            to="/alta"
            className="bg-gold text-ink hover:bg-gold-hover mt-8 inline-block rounded-md px-8 py-3 font-bold transition-colors"
          >
            Empezar ahora
          </Link>
        </motion.div>
      </LampContainer>
    </>
  );
}
