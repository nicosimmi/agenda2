import {
  createContext,
  useContext,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const HoverContext = createContext(false);

/** Marco que inclina su contenido hacia el puntero. Los `CardItem` de dentro se adelantan en profundidad. */
export function CardContainer({
  children,
  className,
  containerClassName,
}: {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);

  const tilt = (e: MouseEvent<HTMLDivElement>) => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 14}deg)`;
  };

  return (
    <HoverContext.Provider value={hover}>
      <div
        className={cn(
          "flex items-center justify-center py-10 [perspective:1000px]",
          containerClassName,
        )}
      >
        <div
          ref={box}
          onMouseEnter={() => setHover(true)}
          onMouseMove={tilt}
          onMouseLeave={() => {
            setHover(false);
            if (box.current) box.current.style.transform = "";
          }}
          className={cn(
            "relative transition-transform duration-200 ease-linear [transform-style:preserve-3d]",
            className,
          )}
        >
          {children}
        </div>
      </div>
    </HoverContext.Provider>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("[transform-style:preserve-3d] *:[transform-style:preserve-3d]", className)}>
      {children}
    </div>
  );
}

export function CardItem({
  as: Tag = "div",
  children,
  className,
  translateZ = 0,
}: {
  as?: ElementType<{ className?: string; style?: CSSProperties; children?: ReactNode }>;
  children: ReactNode;
  className?: string;
  translateZ?: number;
}) {
  const hover = useContext(HoverContext);
  return (
    <Tag
      className={cn("w-fit transition-transform duration-200 ease-linear", className)}
      style={{ transform: hover ? `translateZ(${translateZ}px)` : "translateZ(0)" }}
    >
      {children}
    </Tag>
  );
}
