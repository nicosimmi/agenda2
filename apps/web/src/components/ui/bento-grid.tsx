import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function BentoGrid({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <div className={cn("mx-auto grid max-w-7xl grid-cols-1 gap-4 md:grid-cols-3", className)}>
      {children}
    </div>
  );
}

export function BentoGridItem({
  className,
  title,
  description,
  header,
  icon,
}: {
  className?: string;
  title?: ReactNode;
  description?: ReactNode;
  header?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "group flex flex-col justify-between gap-4 rounded-xl border p-4 transition-shadow hover:shadow-xl",
        className,
      )}
    >
      {header}
      <div className="transition-transform duration-200 group-hover:translate-x-2">
        {icon}
        <div className="my-2 font-bold">{title}</div>
        <div className="text-muted text-xs">{description}</div>
      </div>
    </div>
  );
}
