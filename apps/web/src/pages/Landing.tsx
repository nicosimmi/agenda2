import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { InfiniteMovingCards } from "@/components/ui/infinite-moving-cards";
import { LampContainer } from "@/components/ui/lamp";
import { LayoutTextFlip } from "@/components/ui/layout-text-flip";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { StickyBanner } from "@/components/ui/sticky-banner";
import { TextHoverEffect } from "@/components/ui/text-hover-effect";
import { TracingBeam } from "@/components/ui/tracing-beam";
import {
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  NavBody,
  Navbar,
  NavItems,
} from "@/components/ui/resizable-navbar";
import { Reveal } from "../motion.tsx";
import { AgendaMock } from "./landing/AgendaMock.tsx";
import { Features } from "./landing/Features.tsx";
import { GlobeSection } from "./landing/GlobeSection.tsx";

const NAV = [
  { name: "Funciones", link: "#funciones" },
  { name: "Cómo empezar", link: "#como-empezar" },
  { name: "Negocios", link: "#negocios" },
];

const CATEGORIES = [
  ["Barbería", "Corte, barba y arreglo, cada uno con su duración y su precio."],
  ["Peluquería", "Varios profesionales, cada uno con su horario y sus servicios."],
  ["Fisioterapia", "Sesiones de 45 o 60 minutos con pausa entre pacientes."],
  ["Pádel", "Pistas y clases con huecos fijos que se llenan solos."],
  ["Estética", "Tratamientos largos, con descansos entre uno y otro."],
  ["Veterinaria", "Consultas y vacunas con la agenda del equipo a la vista."],
].map(([name, quote]) => ({ name: name!, quote: quote!, title: "Para negocios como el tuyo" }));

const STEPS = [
  ["Date de alta", "Crea tu cuenta y tu negocio en dos pasos. No hace falta tarjeta."],
  ["Configura tu equipo", "Añade tus servicios, tus profesionales y sus horarios semanales."],
  ["Publica", "Cuando la lista de comprobación está completa, apareces para tus clientes."],
];

function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`text-xl font-bold ${className}`}>
      Agend<span className="text-gold-dark">IA</span>
    </Link>
  );
}

function TopNav() {
  const [open, setOpen] = useState(false);
  const cta = "rounded-full bg-ink px-4 py-2 text-sm font-bold text-white";
  return (
    <Navbar className="top-3">
      <NavBody>
        <Logo />
        <NavItems items={NAV} />
        <div className="relative z-20 flex items-center gap-4 text-sm font-bold">
          <Link to="/entrar" className="hover:text-gold-dark transition-colors">
            Entrar
          </Link>
          <Link to="/alta" className={`${cta} hover:bg-gold hover:text-ink transition-colors`}>
            Alta de negocio
          </Link>
        </div>
      </NavBody>
      <MobileNav>
        <MobileNavHeader>
          <Logo />
          <MobileNavToggle isOpen={open} onClick={() => setOpen(!open)} />
        </MobileNavHeader>
        <MobileNavMenu isOpen={open} onClose={() => setOpen(false)}>
          {NAV.map((n) => (
            <a key={n.link} href={n.link} onClick={() => setOpen(false)} className="font-semibold">
              {n.name}
            </a>
          ))}
          <Link to="/entrar" className="font-semibold">
            Entrar
          </Link>
          <Link to="/alta" className={cta}>
            Alta de negocio
          </Link>
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  );
}

export function Landing() {
  return (
    <div className="overflow-x-clip">
      <StickyBanner className="bg-ink" hideOnScroll>
        <p className="text-sm text-white">
          <span className="text-gold font-bold">Versión de demostración.</span> Proyecto de
          portfolio en desarrollo.
        </p>
      </StickyBanner>
      <TopNav />

      <section className="relative">
        <BackgroundBeams className="opacity-60" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 pt-16 pb-24 md:grid-cols-2 md:pt-24">
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
              Servicios, equipo y horarios en un solo panel. Tus clientes reservan solos o con ayuda
              de un asistente, y tu agenda no se solapa.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mt-8 flex flex-wrap items-center gap-4"
            >
              <Link to="/alta">
                <HoverBorderGradient
                  as="span"
                  containerClassName="rounded-md"
                  className="bg-ink hover:bg-ink/90 rounded-md px-6 py-3 font-bold text-white"
                >
                  Crear mi negocio
                </HoverBorderGradient>
              </Link>
              <MagneticButton strength={0.5} maxDistance={40}>
                <Link
                  to="/entrar"
                  className="border-ink/20 hover:border-ink inline-block rounded-md border px-6 py-3 font-bold transition-colors"
                >
                  Ya tengo cuenta
                </Link>
              </MagneticButton>
            </motion.div>
          </div>
          <AgendaMock />
        </div>
      </section>

      <div className="bg-ink border-y border-white/10 py-6" aria-label="Tipos de negocio">
        <InfiniteMovingCards items={CATEGORIES} speed="slow" className="mx-auto max-w-none" />
      </div>

      <section id="funciones" className="relative">
        <ContainerScroll
          titleComponent={
            <>
              <p className="text-gold-dark text-sm font-bold tracking-widest uppercase">El panel</p>
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

      <section id="como-empezar" className="bg-white py-24">
        <div className="mx-auto max-w-4xl px-6">
          <Reveal>
            <h2 className="mb-12 text-4xl font-bold">Así empiezas</h2>
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

      <LampContainer className="min-h-[26rem] bg-ink">
        <motion.div
          initial={{ opacity: 0.5, y: 80 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
          className="text-center"
        >
          <h2 className="bg-gradient-to-br from-stone-100 to-stone-400 bg-clip-text text-4xl font-bold text-transparent md:text-6xl">
            ¿Listo para abrir tu agenda?
          </h2>
          <Link
            to="/alta"
            className="bg-gold text-ink hover:bg-gold-dark mt-8 inline-block rounded-md px-8 py-3 font-bold transition-colors"
          >
            Empezar ahora
          </Link>
        </motion.div>
      </LampContainer>

      <footer className="bg-ink pb-6 text-center text-sm text-stone-400">
        <div className="mx-auto h-40 max-w-3xl">
          <TextHoverEffect text="AgendIA" />
        </div>
        © AgendIA · Proyecto de portfolio
      </footer>
    </div>
  );
}
