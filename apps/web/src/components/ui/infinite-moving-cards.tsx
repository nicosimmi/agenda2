import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

const DURATION = { fast: "20s", normal: "40s", slow: "80s" };

type Item = { quote: string; name: string; title: string };

/** Fila de tarjetas oscuras que se desplaza sin fin. La lista se repite para que el bucle no tenga corte. */
export function InfiniteMovingCards({
  items,
  direction = "left",
  speed = "fast",
  pauseOnHover = true,
  className,
}: {
  items: Item[];
  direction?: "left" | "right";
  speed?: keyof typeof DURATION;
  pauseOnHover?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative z-20 max-w-7xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_20%,white_80%,transparent)]",
        className,
      )}
      style={
        {
          "--animation-direction": direction === "left" ? "forwards" : "reverse",
          "--animation-duration": DURATION[speed],
        } as CSSProperties
      }
    >
      <ul
        className={cn(
          "animate-scroll flex w-max min-w-full flex-nowrap gap-4 py-4",
          pauseOnHover && "hover:[animation-play-state:paused]",
        )}
      >
        {[...items, ...items].map((item, i) => (
          <li
            key={`${item.name}-${i}`}
            aria-hidden={i >= items.length}
            className="w-[350px] max-w-full shrink-0 rounded-2xl border border-white/10 bg-white/5 px-8 py-6 md:w-[450px]"
          >
            <blockquote className="flex flex-col gap-6">
              <p className="text-sm leading-relaxed text-stone-200">{item.quote}</p>
              <footer className="flex flex-col gap-1 text-sm">
                <span className="text-gold font-bold">{item.name}</span>
                <span className="text-stone-400">{item.title}</span>
              </footer>
            </blockquote>
          </li>
        ))}
      </ul>
    </div>
  );
}
