import { useId, useState, type PointerEvent } from "react";

/** Palabra grande en trazo fino; el dorado aparece solo donde pasa el puntero. */
export function TextHoverEffect({ text }: { text: string }) {
  const id = useId();
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [over, setOver] = useState(false);

  const move = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    if (!box.width || !box.height) return; // oculto con display: none
    setPos({
      x: ((e.clientX - box.left) / box.width) * 100,
      y: ((e.clientY - box.top) / box.height) * 100,
    });
  };

  const common = {
    x: "50%",
    y: "50%",
    textAnchor: "middle" as const,
    dominantBaseline: "middle" as const,
    fontSize: 72,
    fontWeight: 700,
    fill: "none",
    strokeWidth: 0.3,
  };

  return (
    <svg
      viewBox="0 0 300 100"
      width="100%"
      height="100%"
      className="select-none"
      onPointerEnter={() => setOver(true)}
      onPointerLeave={() => setOver(false)}
      onPointerMove={move}
    >
      <defs>
        <radialGradient id={`${id}-spot`} cx={`${pos.x}%`} cy={`${pos.y}%`} r="22%">
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </radialGradient>
        <mask id={`${id}-mask`}>
          <rect width="100%" height="100%" fill={`url(#${id}-spot)`} />
        </mask>
        <linearGradient id={`${id}-gold`} x1="0" x2="1">
          <stop offset="0%" stopColor="#a67c22" />
          <stop offset="50%" stopColor="#e7d3a3" />
          <stop offset="100%" stopColor="#c89b3c" />
        </linearGradient>
      </defs>
      <text {...common} stroke="#737373" opacity={over ? 0.7 : 0.35}>
        {text}
      </text>
      {over && (
        <text {...common} stroke={`url(#${id}-gold)`} strokeWidth={0.6} mask={`url(#${id}-mask)`}>
          {text}
        </text>
      )}
    </svg>
  );
}
