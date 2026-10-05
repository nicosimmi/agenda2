import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Une clases de Tailwind resolviendo conflictos. Los componentes de Aceternity lo importan de aquí. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
