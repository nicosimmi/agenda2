// @ts-nocheck -- código de Aceternity UI (F3-10), adaptado: tarjetas oscuras y duplicado con React en vez de clonar nodos del DOM (chocaba con React en StrictMode).
"use client";

import { cn } from "@/lib/utils";
import React from "react";

const DURATION = { fast: "20s", normal: "40s", slow: "80s" };

export const InfiniteMovingCards = ({
  items,
  direction = "left",
  speed = "fast",
  pauseOnHover = true,
  className,
}: {
  items: {
    quote: string;
    name: string;
    title: string;
  }[];
  direction?: "left" | "right";
  speed?: "fast" | "normal" | "slow";
  pauseOnHover?: boolean;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "scroller relative z-20 max-w-7xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_20%,white_80%,transparent)]",
        className,
      )}
      style={{
        "--animation-direction": direction === "left" ? "forwards" : "reverse",
        "--animation-duration": DURATION[speed],
      }}
    >
      <ul
        className={cn(
          "animate-scroll flex w-max min-w-full shrink-0 flex-nowrap gap-4 py-4",
          pauseOnHover && "hover:[animation-play-state:paused]",
        )}
      >
        {[...items, ...items].map((item, idx) => (
          <li
            aria-hidden={idx >= items.length}
            className="relative w-[350px] max-w-full shrink-0 rounded-2xl border border-white/10 bg-white/5 px-8 py-6 md:w-[450px]"
            key={`${item.name}-${idx}`}
          >
            <blockquote>
              <span className="relative z-20 text-sm leading-[1.6] font-normal text-stone-200">
                {item.quote}
              </span>
              <div className="relative z-20 mt-6 flex flex-col gap-1">
                <span className="text-gold text-sm leading-[1.6] font-bold">{item.name}</span>
                <span className="text-sm leading-[1.6] font-normal text-stone-400">
                  {item.title}
                </span>
              </div>
            </blockquote>
          </li>
        ))}
      </ul>
    </div>
  );
};
