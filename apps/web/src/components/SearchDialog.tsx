import { IconBuildingStore, IconSearch } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.ts";
import { euros } from "../format.ts";
import type { SearchPage } from "../types.ts";
import { useCategories } from "../useApi.ts";
import { Skeleton } from "./Skeleton.tsx";

/** Buscador rápido a pantalla completa: resultados al escribir, flechas para moverte y Enter para ir. */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [results, setResults] = useState<SearchPage["items"]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const categories = useCategories(open);

  // Resultados con retraso, para no pedir una búsqueda por cada tecla.
  useEffect(() => {
    const q = text.trim();
    if (!open || !q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let stale = false;
    const t = setTimeout(() => {
      api<SearchPage>(`/public/businesses?q=${encodeURIComponent(q)}&pageSize=5`)
        .then((page) => {
          if (stale) return;
          setResults(page.items);
          setActive(0);
        })
        .catch(() => !stale && setResults([]))
        .finally(() => !stale && setLoading(false));
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [text, open]);

  useEffect(() => {
    if (!open) return;
    setText("");
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      const q = text.trim();
      const hit = results[active];
      if (hit) go(`/n/${hit.slug}`);
      else if (q) go(`/buscar?q=${encodeURIComponent(q)}`);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Buscar negocios"
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.97 }}
            className="border-line bg-surface w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl"
          >
            <div className="border-line flex items-center gap-3 border-b px-4">
              <IconSearch className="text-muted size-5 shrink-0" aria-hidden />
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onInputKey}
                role="combobox"
                aria-expanded={results.length > 0}
                aria-controls="search-results"
                aria-label="Buscar negocios"
                placeholder="Barbería, fisioterapia, Córdoba…"
                className="placeholder:text-muted h-14 flex-1 bg-transparent text-lg outline-none"
              />
              <kbd className="border-line text-muted hidden rounded border px-1.5 py-0.5 text-xs sm:block">
                Esc
              </kbd>
            </div>

            <div id="search-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
              {loading && (
                <div className="space-y-2 p-2" aria-hidden>
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              )}
              {!loading &&
                results.map((b, i) => (
                  <button
                    key={b.slug}
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(`/n/${b.slug}`)}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      i === active ? "bg-surface-2" : ""
                    }`}
                  >
                    <span className="bg-gold/20 text-gold-dark flex size-10 shrink-0 items-center justify-center rounded-lg">
                      <IconBuildingStore className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{b.name}</span>
                      <span className="text-muted block truncate text-sm">
                        {b.categoryName}
                        {b.city && ` · ${b.city}`}
                      </span>
                    </span>
                    {b.minPriceCents !== null && (
                      <span className="text-muted shrink-0 text-sm">
                        desde {euros(b.minPriceCents)}
                      </span>
                    )}
                  </button>
                ))}
              {!loading && text.trim() && results.length === 0 && (
                <p className="text-muted p-4 text-center">
                  No hay resultados para «{text.trim()}». Prueba con otra palabra.
                </p>
              )}
              {text.trim() && (
                <button
                  onClick={() => go(`/buscar?q=${encodeURIComponent(text.trim())}`)}
                  className="text-gold-dark hover:bg-surface-2 mt-1 w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm font-semibold"
                >
                  Ver todos los resultados
                </button>
              )}
              {!text.trim() && (
                <div className="p-3">
                  <p className="text-muted mb-3 text-sm">Busca por tipo de negocio</p>
                  <div className="flex flex-wrap gap-2">
                    {categories.data?.map((c) => (
                      <button
                        key={c.slug}
                        onClick={() => go(`/buscar?category=${c.slug}`)}
                        className="border-line hover:border-gold hover:text-gold-dark cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors"
                      >
                        {c.name}
                      </button>
                    ))}
                    {categories.loading &&
                      [0, 1, 2, 3].map((n) => (
                        <Skeleton key={n} className="h-8 w-24 rounded-full" />
                      ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
