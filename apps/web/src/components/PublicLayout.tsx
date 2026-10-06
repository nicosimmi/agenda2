import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { StickyBanner } from "@/components/ui/sticky-banner";
import { SearchDialog } from "./SearchDialog.tsx";
import { SiteFooter } from "./SiteFooter.tsx";
import { SiteNav } from "./SiteNav.tsx";

/** Estructura común de las páginas públicas: aviso, menú, contenido, pie y buscador rápido. */
export function PublicLayout() {
  const { pathname } = useLocation();
  const [searching, setSearching] = useState(false);
  const closeSearch = useCallback(() => setSearching(false), []);

  // "/" abre el buscador, salvo que la persona esté escribiendo en un campo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.matches?.("input, textarea, select, [contenteditable]");
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSearching(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <a
        href="#contenido"
        className="bg-gold text-ink sr-only z-[90] rounded-md px-4 py-2 font-bold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <StickyBanner className="bg-ink" hideOnScroll>
        <p className="text-sm text-white">
          <span className="text-gold font-bold">Versión de demostración.</span> Los negocios y las
          reservas son ficticios.
        </p>
      </StickyBanner>
      <SiteNav onSearch={() => setSearching(true)} />
      <motion.main
        id="contenido"
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1"
      >
        <Outlet />
      </motion.main>
      <SiteFooter />
      <SearchDialog open={searching} onClose={closeSearch} />
    </div>
  );
}
