import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "motion/react";

/**
 * Un título y, debajo, un marco tipo tablet que se endereza y crece a medida que la sección
 * llega al centro de la pantalla.
 */
export function ContainerScroll({
  titleComponent,
  children,
}: {
  titleComponent: ReactNode;
  children: ReactNode;
}) {
  const section = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: section });
  const tilt = useTransform(scrollYProgress, [0, 1], [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1.05, 1]);
  const lift = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    <div
      ref={section}
      className="relative flex h-[30rem] items-center justify-center p-2 md:h-[80rem] md:p-20"
    >
      <div className="relative w-full py-10 md:py-40 [perspective:1000px]">
        <motion.div style={{ y: lift }} className="mx-auto max-w-5xl text-center">
          {titleComponent}
        </motion.div>
        <motion.div
          style={{ rotateX: tilt, scale }}
          className="mx-auto -mt-12 h-auto w-full max-w-5xl rounded-[30px] border-4 border-[#6c6c6c] bg-[#222] p-2 shadow-[0_9px_20px_#0000004a,0_37px_37px_#00000042,0_84px_50px_#00000026] md:h-[40rem] md:p-6"
        >
          <div className="bg-surface-2 w-full overflow-hidden rounded-2xl md:h-full md:p-4">
            {children}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
