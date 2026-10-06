import {
  IconCalendarCheck,
  IconClockHour4,
  IconMessageChatbot,
  IconRosetteDiscountCheck,
  IconShieldLock,
} from "@tabler/icons-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";

const box = "bg-page border-line flex size-full min-h-24 rounded-lg border p-3";

const SLOTS = [
  ["09:00", false],
  ["09:30", true],
  ["10:00", false],
  ["10:30", false],
  ["11:00", true],
  ["11:30", false],
  ["12:00", false],
  ["12:30", true],
] as const;
const FREE = SLOTS.flatMap(([, busy], i) => (busy ? [] : [i]));

/** Un día de la agenda: los huecos ocupados salen tachados y la selección salta entre los libres. */
function Slots() {
  const [pick, setPick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPick((p) => (p + 1) % FREE.length), 1800);
    return () => clearInterval(t);
  }, []);
  const selected = FREE[pick] ?? 0;
  return (
    <div className={`${box} flex-col justify-between gap-3`}>
      <div className="flex items-center justify-between text-sm">
        <strong>Viernes · Corte (30 min)</strong>
        <span className="text-muted">{FREE.length} huecos libres</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {SLOTS.map(([time, busy], i) => (
          <div
            key={time}
            className={`relative rounded-md py-1.5 text-center text-sm font-semibold ${
              busy ? "text-muted bg-transparent line-through" : "bg-surface"
            }`}
          >
            {i === selected && (
              <motion.span
                layoutId="slot-pick"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="bg-gold absolute inset-0 rounded-md"
              />
            )}
            <span className="relative">{time}</span>
          </div>
        ))}
      </div>
      <motion.div
        key={selected}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-ink flex items-center justify-between rounded-md px-3 py-2 text-sm text-white"
      >
        <span>Reservar {SLOTS[selected]?.[0]}</span>
        <span className="text-gold font-bold">Confirmar →</span>
      </motion.div>
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
        className="rounded-xl rounded-bl-sm bg-surface px-3 py-2"
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
    title: "Un asistente que propone, muy pronto",
    description:
      "Buscará huecos por ti. La reserva solo se confirmará cuando pulses el botón.",
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
          className={`border-line bg-surface ${item.className ?? ""}`}
        />
      ))}
    </BentoGrid>
  );
}
