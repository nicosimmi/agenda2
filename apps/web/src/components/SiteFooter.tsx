import { Link } from "react-router-dom";
import { TextHoverEffect } from "@/components/ui/text-hover-effect";
import { useTheme } from "../theme.tsx";

const COLUMNS = [
  {
    title: "Para clientes",
    links: [
      ["Buscar negocios", "/buscar"],
      ["Mis reservas", "/mis-reservas"],
      ["Crear cuenta", "/registro"],
      ["Preguntas frecuentes", "/#preguntas"],
    ],
  },
  {
    title: "Para negocios",
    links: [
      ["Dar de alta mi negocio", "/alta"],
      ["Entrar al panel", "/entrar"],
      ["Cómo empezar", "/#como-empezar"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Política de cookies", "/cookies"],
      ["Privacidad", "/privacidad"],
    ],
  },
] as const;

export function SiteFooter() {
  const { theme, toggle } = useTheme();
  return (
    <footer className="bg-ink mt-24 text-stone-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 pt-16 pb-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <p className="text-xl font-bold text-white">
            Agend<span className="text-gold">IA</span>
          </p>
          <p className="mt-3 max-w-xs text-sm text-stone-400">
            Reservas para negocios locales, con la agenda siempre al día.
          </p>
          <button
            type="button"
            onClick={toggle}
            className="mt-5 cursor-pointer rounded-full border border-white/15 px-4 py-1.5 text-sm transition-colors hover:border-white/40"
          >
            {theme === "dark" ? "Pasar a modo claro" : "Pasar a modo oscuro"}
          </button>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="font-bold text-white">{col.title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {col.links.map(([label, to]) => (
                <li key={to}>
                  <Link to={to} className="hover:text-gold transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto hidden h-36 max-w-3xl sm:block" aria-hidden>
        <TextHoverEffect text="AgendIA" />
      </div>
      <p className="px-6 pt-6 pb-8 text-center text-sm text-stone-500">
        © AgendIA · Proyecto de portfolio con datos ficticios
      </p>
    </footer>
  );
}
