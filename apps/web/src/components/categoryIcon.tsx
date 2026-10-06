import {
  IconBallTennis,
  IconBuildingStore,
  IconPaw,
  IconScissors,
  IconSparkles,
  IconStethoscope,
  IconWoman,
} from "@tabler/icons-react";
import type { ComponentType } from "react";

type Icon = ComponentType<{ className?: string | undefined }>;

const ICONS: Record<string, Icon> = {
  barberia: IconScissors,
  peluqueria: IconWoman,
  fisioterapia: IconStethoscope,
  padel: IconBallTennis,
  estetica: IconSparkles,
  veterinaria: IconPaw,
};

/** Icono de una categoría; las que no tienen uno propio usan el de comercio. */
export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = ICONS[slug] ?? IconBuildingStore;
  return <Icon className={className} />;
}
