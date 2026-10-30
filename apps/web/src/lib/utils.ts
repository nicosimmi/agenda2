import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Une clases de Tailwind resolviendo conflictos. Los componentes de components/ui lo usan. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
