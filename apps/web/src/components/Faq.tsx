import { IconPlus } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";

export interface FaqItem {
  q: string;
  a: string;
}

/** Preguntas frecuentes en acordeón: una abierta a la vez, con altura animada y teclado completo. */
export function Faq({
  items,
  title = "Preguntas frecuentes",
  id = "preguntas",
  className = "",
}: {
  items: FaqItem[];
  title?: string;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const base = useId();
  if (!items.length) return null;
  return (
    <section id={id} aria-labelledby={`${base}-title`} className={`scroll-mt-28 ${className}`}>
      <h2 id={`${base}-title`} className="text-2xl font-bold md:text-3xl">
        {title}
      </h2>
      <div className="border-line bg-surface mt-6 divide-y divide-[var(--line)] overflow-hidden rounded-xl border">
        {items.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q}>
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`${base}-panel-${i}`}
                  id={`${base}-button-${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="hover:bg-surface-2 flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left font-semibold transition-colors"
                >
                  {item.q}
                  <motion.span
                    aria-hidden
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    className="text-gold-dark shrink-0"
                  >
                    <IconPlus className="size-5" />
                  </motion.span>
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    id={`${base}-panel-${i}`}
                    role="region"
                    aria-labelledby={`${base}-button-${i}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <p className="text-muted px-5 pb-5 leading-relaxed">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
