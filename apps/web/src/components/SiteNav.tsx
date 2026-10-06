import { IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  NavBody,
  Navbar,
  NavItems,
} from "@/components/ui/resizable-navbar";
import { useAuth } from "../auth.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";

const NAV = [
  { name: "Buscar", link: "/buscar" },
  { name: "Funciones", link: "/#funciones" },
  { name: "Preguntas", link: "/#preguntas" },
];

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`text-xl font-bold whitespace-nowrap ${className}`}>
      Agend<span className="text-gold-dark">IA</span>
    </Link>
  );
}

const pill =
  "rounded-full bg-ink px-4 py-2 text-sm font-bold text-white transition-colors dark:bg-gold dark:text-ink";

/** Menú superior: en escritorio una píldora que se encoge al bajar; en móvil y tableta, un menú plegable. */
export function SiteNav({ onSearch }: { onSearch: () => void }) {
  const { me, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const account =
    me?.role === "business_owner"
      ? { to: "/panel", label: "Mi panel" }
      : me?.role === "customer"
        ? { to: "/mis-reservas", label: "Mis reservas" }
        : null;

  return (
    <Navbar className="top-3">
      <NavBody className="min-w-[960px]">
        <Logo />
        <NavItems items={NAV} />
        <div className="relative z-20 flex items-center gap-3 text-sm font-semibold">
          <button
            type="button"
            onClick={onSearch}
            aria-label="Buscar (atajo: tecla /)"
            title="Buscar ( / )"
            className="text-fg hover:bg-surface-2 flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors"
          >
            <IconSearch className="size-5" />
          </button>
          <ThemeToggle />
          {me === undefined ? (
            <span className="inline-block h-9 w-40" aria-hidden />
          ) : me ? (
            <>
              {account && (
                <Link to={account.to} className="hover:text-gold-dark transition-colors">
                  {account.label}
                </Link>
              )}
              <button
                type="button"
                onClick={logout}
                className={`${pill} hover:bg-gold hover:text-ink dark:hover:bg-gold-hover cursor-pointer`}
              >
                Salir
              </button>
            </>
          ) : (
            <>
              <Link to="/entrar" className="hover:text-gold-dark transition-colors">
                Entrar
              </Link>
              <Link
                to="/registro"
                className={`${pill} hover:bg-gold hover:text-ink dark:hover:bg-gold-hover`}
              >
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </NavBody>

      <MobileNav>
        <MobileNavHeader>
          <Logo />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onSearch}
              aria-label="Buscar"
              className="flex size-9 cursor-pointer items-center justify-center"
            >
              <IconSearch className="size-5" />
            </button>
            <ThemeToggle />
            <MobileNavToggle isOpen={open} onClick={() => setOpen(!open)} />
          </div>
        </MobileNavHeader>
        <MobileNavMenu isOpen={open} onClose={close} className="bg-surface text-fg">
          {NAV.map((n) => (
            <Link key={n.link} to={n.link} onClick={close} className="font-semibold">
              {n.name}
            </Link>
          ))}
          <Link to="/alta" onClick={close} className="font-semibold">
            Para negocios
          </Link>
          {me === undefined ? (
            <span className="inline-block h-9 w-40" aria-hidden />
          ) : me ? (
            <>
              {account && (
                <Link to={account.to} onClick={close} className="font-semibold">
                  {account.label}
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  close();
                  void logout();
                }}
                className={`${pill} cursor-pointer`}
              >
                Salir
              </button>
            </>
          ) : (
            <>
              <Link to="/entrar" onClick={close} className="font-semibold">
                Entrar
              </Link>
              <Link to="/registro" onClick={close} className={pill}>
                Crear cuenta
              </Link>
            </>
          )}
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  );
}
