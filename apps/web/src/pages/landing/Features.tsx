import {
  IconCalendarCheck,
  IconClockHour4,
  IconMessageChatbot,
  IconRosetteDiscountCheck,
  IconShieldLock,
} from "@tabler/icons-react";
import { motion } from "motion/react";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";

const box = "bg-cream border-ink/5 flex size-full min-h-24 rounded-lg border p-3";

function Slots() {
  const slots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"];
  return (
    <div className={`${box} flex-wrap content-start gap-2`}>
      {slots.map((s, i) => (
        <motion.span
          key={s}
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08 }}
          className={`rounded-md px-3 py-1 text-sm font-semibold ${
            i === 2
              ? "bg-gold text-ink"
              : i === 1 || i === 4
                ? "text-muted line-through"
                : "bg-white"
          }`}
        >
          {s}
        </motion.span>
      ))}
    </div>
  );
}

function Chat() {
  return (
    <div className={`${box} flex-col justify-center gap-2 text-xs`}>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="bg-ink ml-auto rounded-xl rounded-br-sm px-3 py-2 text-white"
      >
        Necesito corte el viernes por la tarde
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.4 }}
        className="rounded-xl rounded-bl-sm bg-white px-3 py-2"
      >
        Hay hueco a las 17:30. ¿Lo reservo?
      </motion.div>
    </div>
  );
}

function Checklist() {
  const items = ["Dirección y ciudad", "Servicio activo", "Profesional", "Horario semanal"];
  return (
    <div className={`${box} flex-col justify-center gap-2 text-sm`}>
      {items.map((t, i) => (
        <motion.div
          key={t}
          initial={{ opacity: 0, x: -12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.12 }}
          className="flex items-center gap-2"
        >
          <span className="bg-gold text-ink flex size-5 items-center justify-center rounded-full text-xs font-bold">
            ✓
          </span>
          {t}
        </motion.div>
      ))}
    </div>
  );
}

function Shield() {
  return (
    <div className={`${box} items-center justify-center`}>
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="bg-gold/20 flex size-16 items-center justify-center rounded-full"
      >
        <IconShieldLock className="text-gold-dark size-9" />
      </motion.div>
    </div>
  );
}

function Hours() {
  const days = ["L", "M", "X", "J", "V", "S"];
  return (
    <div className={`${box} items-end justify-between gap-1`}>
      {days.map((d, i) => (
        <div key={d} className="flex flex-1 flex-col items-center gap-1">
          <motion.div
            initial={{ height: 0 }}
            whileInView={{ height: [40, 56, 48, 56, 40, 24][i] ?? 40 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, type: "spring" }}
            className="bg-gold w-full rounded-sm"
          />
          <span className="text-muted text-xs">{d}</span>
        </div>
      ))}
    </div>
  );
}

const ICON = "text-gold-dark size-5";
const ITEMS = [
  {
    title: "Reserva sin llamadas",
    description: "Se muestran solo los huecos libres: no hay solapes ni dobles reservas.",
    header: <Slots />,
    icon: <IconCalendarCheck className={ICON} />,
    className: "md:col-span-2",
  },
  {
    title: "Un asistente que propone",
    description: "Busca huecos por ti. La reserva solo se confirma cuando pulsas el botón.",
    header: <Chat />,
    icon: <IconMessageChatbot className={ICON} />,
  },
  {
    title: "Publica cuando esté listo",
    description: "Una lista de comprobación te dice qué falta antes de aparecer.",
    header: <Checklist />,
    icon: <IconRosetteDiscountCheck className={ICON} />,
  },
  {
    title: "Cada negocio ve lo suyo",
    description: "Tus datos no se mezclan con los de ningún otro negocio.",
    header: <Shield />,
    icon: <IconShieldLock className={ICON} />,
  },
  {
    title: "Horarios y ausencias",
    description: "Turnos semanales por profesional y cierres puntuales cuando los necesites.",
    header: <Hours />,
    icon: <IconClockHour4 className={ICON} />,
  },
];

export function Features() {
  return (
    <BentoGrid className="md:auto-rows-[20rem]">
      {ITEMS.map((item) => (
        <BentoGridItem
          key={item.title}
          {...item}
          className={`border-ink/5 bg-white ${item.className ?? ""}`}
        />
      ))}
    </BentoGrid>
  );
}
