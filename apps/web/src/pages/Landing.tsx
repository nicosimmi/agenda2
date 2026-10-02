import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { Reveal } from "../motion.tsx";

const CATEGORIES = ["Barbería", "Peluquería", "Fisioterapia", "Pádel", "Estética", "Veterinaria"];

const FEATURES = [
  {
    title: "Reserva sin llamadas",
    text: "El cliente elige servicio, profesional y hueco. Los huecos ocupados no aparecen, así que no hay solapes.",
    icon: "M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  },
  {
    title: "Un asistente que propone",
    text: "Escribes lo que necesitas y el asistente busca huecos y te los propone. La reserva solo se confirma cuando pulsas el botón.",
    icon: "M8 10h8M8 14h5m-9 6 3-3h11a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v15Z",
  },
  {
    title: "Tu negocio, tus datos",
    text: "Cada negocio ve solo lo suyo. Servicios, equipo, horarios y ausencias se gestionan desde un único panel.",
    icon: "M12 3 4 6v5c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-3Z",
  },
];

const STEPS = [
  ["Date de alta", "Crea tu cuenta y tu negocio en dos pasos."],
  ["Configura el equipo", "Añade servicios, profesionales y horarios semanales."],
  ["Publica", "Cuando la lista de comprobación está completa, apareces para tus clientes."],
];

export function Landing() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });
  const hero = useRef<HTMLElement>(null);
  const { scrollYProgress: heroProgress } = useScroll({
    target: hero,
    offset: ["start start", "end start"],
  });
  const blobY = useTransform(heroProgress, [0, 1], [0, 160]);
  const cardY = useTransform(heroProgress, [0, 1], [0, -60]);
  const fade = useTransform(heroProgress, [0, 0.9], [1, 0]);

  return (
    <div className="overflow-x-clip">
      <motion.div
        style={{ scaleX: progress }}
        className="bg-gold fixed inset-x-0 top-0 z-50 h-1 origin-left"
      />

      <header className="border-ink/5 bg-cream/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <strong className="text-xl">
            Agend<span className="text-gold-dark">IA</span>
          </strong>
          <nav className="flex items-center gap-5 text-sm font-semibold">
            <Link to="/entrar" className="hover:text-gold-dark transition-colors">
              Entrar
            </Link>
            <Link
              to="/alta"
              className="bg-ink hover:bg-gold hover:text-ink rounded-md px-4 py-2 text-white transition-colors"
            >
              Alta de negocio
            </Link>
          </nav>
        </div>
      </header>

      <section ref={hero} className="relative">
        <motion.div
          style={{ y: blobY }}
          aria-hidden
          className="bg-gold/25 pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full blur-3xl"
        />
        <motion.div
          style={{ y: blobY }}
          aria-hidden
          className="bg-gold-dark/15 pointer-events-none absolute top-60 -left-24 h-80 w-80 rounded-full blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
          <motion.div style={{ opacity: fade }}>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-gold-dark mb-4 text-sm font-bold tracking-widest uppercase"
            >
              Reservas para negocios locales
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.7 }}
              className="text-5xl leading-tight font-bold md:text-6xl"
            >
              Tu agenda llena, <span className="text-gold-dark">sin atender el teléfono.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.7 }}
              className="text-muted mt-6 max-w-md text-lg"
            >
              Servicios, equipo y horarios en un panel. Tus clientes reservan solos o con ayuda de
              un asistente.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.7 }}
              className="mt-8 flex flex-wrap gap-4"
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
                <Link
                  to="/alta"
                  className="bg-gold text-ink hover:bg-gold-dark inline-block rounded-md px-6 py-3 font-bold shadow-lg shadow-amber-900/10 transition-colors"
                >
                  Crear mi negocio
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
                <Link
                  to="/entrar"
                  className="border-ink/20 hover:border-ink inline-block rounded-md border px-6 py-3 font-bold transition-colors"
                >
                  Ya tengo cuenta
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>

          <motion.div style={{ y: cardY }} className="relative">
            <AgendaMock />
          </motion.div>
        </div>
      </section>

      <div className="border-ink/10 bg-ink overflow-hidden border-y py-4 text-white" aria-hidden>
        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 24, ease: "linear", repeat: Infinity }}
          className="flex w-max gap-12 text-lg font-semibold whitespace-nowrap"
        >
          {[...CATEGORIES, ...CATEGORIES, ...CATEGORIES, ...CATEGORIES].map((c, i) => (
            <span key={i} className="flex items-center gap-12">
              {c} <span className="text-gold">✦</span>
            </span>
          ))}
        </motion.div>
      </div>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <h2 className="max-w-xl text-4xl font-bold">
            Lo esencial para que reserven en un minuto
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.12}>
              <motion.article
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="h-full rounded-xl bg-white p-6 shadow-sm hover:shadow-xl"
              >
                <div className="bg-gold/20 mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                  <svg
                    viewBox="0 0 24 24"
                    className="text-gold-dark h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d={f.icon} />
                  </svg>
                </div>
                <h3 className="mb-2 text-xl font-bold">{f.title}</h3>
                <p className="text-muted">{f.text}</p>
              </motion.article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="mx-auto max-w-4xl px-6">
          <Reveal>
            <h2 className="text-4xl font-bold">Así empiezas</h2>
          </Reveal>
          <ol className="mt-12 space-y-10">
            {STEPS.map(([title, text], i) => (
              <Reveal key={title} y={40} delay={0.05}>
                <li className="flex items-start gap-6">
                  <span className="bg-ink text-gold flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl font-bold">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-2xl font-bold">{title}</h3>
                    <p className="text-muted mt-1">{text}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-6 py-24">
        <Reveal
          y={50}
          className="bg-ink relative mx-auto max-w-5xl overflow-hidden rounded-2xl px-8 py-16 text-center text-white"
        >
          <motion.div
            aria-hidden
            animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0.6, 0.35] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="bg-gold pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl"
          />
          <h2 className="relative text-4xl font-bold">¿Listo para abrir tu agenda?</h2>
          <p className="relative mx-auto mt-4 max-w-md text-stone-300">
            Date de alta, completa la lista y publica cuando quieras.
          </p>
          <motion.div
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
            className="relative mt-8 inline-block"
          >
            <Link
              to="/alta"
              className="bg-gold text-ink hover:bg-gold-dark inline-block rounded-md px-8 py-3 font-bold transition-colors"
            >
              Empezar ahora
            </Link>
          </motion.div>
        </Reveal>
      </section>

      <footer className="text-muted pb-10 text-center text-sm">
        © AgendIA · Proyecto de portfolio
      </footer>
    </div>
  );
}

/** Maqueta de la agenda para la portada: filas que entran una a una y burbuja del asistente. */
function AgendaMock() {
  const rows = [
    ["10:00", "Corte + barba", "Marcos R.", "bg-gold/25"],
    ["11:00", "Corte clásico", "Pablo S.", "bg-stone-100"],
    ["12:30", "Arreglo de barba", "Iván L.", "bg-gold/25"],
  ];
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      className="relative"
    >
      <div className="rounded-2xl bg-white p-5 shadow-2xl shadow-amber-900/10">
        <div className="mb-4 flex items-center justify-between">
          <strong>Hoy · Agenda</strong>
          <span className="bg-gold/25 text-gold-dark rounded-full px-3 py-1 text-xs font-bold">
            3 reservas
          </span>
        </div>
        <ul className="space-y-3">
          {rows.map(([time, service, who, bg], i) => (
            <motion.li
              key={time}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.2, duration: 0.5 }}
              className={`flex items-center gap-4 rounded-lg px-4 py-3 ${bg}`}
            >
              <span className="font-bold">{time}</span>
              <span className="flex-1">{service}</span>
              <span className="text-muted text-sm">{who}</span>
            </motion.li>
          ))}
        </ul>
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 1.5, type: "spring", stiffness: 200, damping: 16 }}
        className="bg-ink absolute -bottom-6 -left-4 max-w-[15rem] rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-white shadow-xl md:-left-10"
      >
        Tengo hueco mañana a las 17:30. ¿Te lo reservo?
      </motion.div>
    </motion.div>
  );
}
