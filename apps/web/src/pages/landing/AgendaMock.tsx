import { CardBody, CardContainer, CardItem } from "@/components/ui/3d-card";

const ROWS = [
  ["10:00", "Corte + barba", "Marcos R."],
  ["11:00", "Corte clásico", "Pablo S."],
  ["12:30", "Arreglo de barba", "Iván L."],
] as const;

/** Maqueta de la agenda que se inclina en 3D con el cursor: cada capa se separa a distinta altura. */
export function AgendaMock() {
  return (
    <CardContainer containerClassName="py-6" className="w-full">
      <CardBody className="relative h-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl shadow-amber-900/15">
        <CardItem translateZ={50} className="flex w-full items-center justify-between">
          <strong className="text-lg">Hoy · Agenda</strong>
          <span className="bg-gold/25 text-gold-dark rounded-full px-3 py-1 text-xs font-bold">
            3 reservas
          </span>
        </CardItem>
        <ul className="mt-4 space-y-3">
          {ROWS.map(([time, service, who], i) => (
            <CardItem
              as="li"
              key={time}
              translateZ={20 + i * 20}
              className={`flex w-full items-center gap-4 rounded-lg px-4 py-3 ${
                i % 2 === 0 ? "bg-gold/25" : "bg-stone-100"
              }`}
            >
              <span className="font-bold">{time}</span>
              <span className="flex-1">{service}</span>
              <span className="text-muted text-sm">{who}</span>
            </CardItem>
          ))}
        </ul>
        <CardItem
          translateZ={110}
          translateX={-10}
          className="bg-ink absolute -bottom-8 -left-6 max-w-[15rem] rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-white shadow-xl"
        >
          Tengo hueco mañana a las 17:30. ¿Te lo reservo?
        </CardItem>
      </CardBody>
    </CardContainer>
  );
}
