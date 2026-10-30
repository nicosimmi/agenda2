import type { HTMLProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AuroraBackgroundProps extends HTMLProps<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
}

// Bandas doradas que se desplazan despacio (la animación `aurora` está en index.css).
const BANDS =
  "repeating-linear-gradient(100deg,#c89b3c 10%,#e7d3a3 16%,#faf0d4 22%,transparent 28%,#d9b25f 34%)";

export function AuroraBackground({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) {
  return (
    <main>
      <div
        className={cn("relative flex h-screen flex-col items-center justify-center", className)}
        {...props}
      >
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          <div
            className={cn(
              "animate-aurora pointer-events-none absolute -inset-2.5 opacity-40 blur-[10px] will-change-transform [background-size:200%_100%]",
              showRadialGradient &&
                "[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,transparent_70%)]",
            )}
            style={{ backgroundImage: BANDS }}
          />
        </div>
        {children}
      </div>
    </main>
  );
}
