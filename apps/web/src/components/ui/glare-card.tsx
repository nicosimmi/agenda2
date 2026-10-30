import { useRef, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Tarjeta oscura que se inclina hacia el puntero y refleja un destello de luz donde lo tiene. */
export function GlareCard({ children, className }: { children: ReactNode; className?: string }) {
  const card = useRef<HTMLDivElement>(null);

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = card.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    const y = (e.clientY - box.top) / box.height;
    el.style.setProperty("--gx", `${x * 100}%`);
    el.style.setProperty("--gy", `${y * 100}%`);
    el.style.setProperty("--ry", `${(x - 0.5) * 14}deg`);
    el.style.setProperty("--rx", `${(0.5 - y) * 14}deg`);
    el.style.setProperty("--glare", "1");
  };

  const leave = () => {
    const el = card.current;
    if (!el) return;
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--glare", "0");
  };

  return (
    <div className="[perspective:700px]">
      <div
        ref={card}
        onPointerMove={move}
        onPointerLeave={leave}
        className="relative aspect-[17/21] w-[320px] overflow-hidden rounded-[var(--radius,1.5rem)] border border-white/10 transition-transform duration-200 will-change-transform [--glare:0] [--radius:1.5rem] [--rx:0deg] [--ry:0deg] [transform:rotateX(var(--rx))_rotateY(var(--ry))]"
      >
        <div className={cn("bg-ink h-full w-full", className)}>{children}</div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[var(--glare)] transition-opacity duration-200 [background:radial-gradient(circle_at_var(--gx,50%)_var(--gy,50%),rgba(255,255,255,0.28),transparent_55%)]"
        />
      </div>
    </div>
  );
}
