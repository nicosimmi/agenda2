import { useInView } from "motion/react";
import { lazy, Suspense, useRef } from "react";
import { Link } from "react-router-dom";

// three.js pesa: el globo se descarga solo cuando esta sección entra en pantalla.
const Globe3D = lazy(() => import("@/components/ui/3d-globe"));

const GLOBE = {
  textureUrl: "/textures/earth-blue-marble.jpg",
  bumpMapUrl: "/textures/earth-topology.png",
  atmosphereColor: "#c89b3c",
  autoRotateSpeed: 0.7,
  enableZoom: false,
  enablePan: false,
  initialRotation: { x: 0.5, y: -0.2 },
};

export function GlobeSection() {
  const ref = useRef<HTMLElement>(null);
  const near = useInView(ref, { once: true, margin: "300px" });
  return (
    <section
      ref={ref}
      className="bg-ink relative mx-4 overflow-hidden rounded-3xl text-white md:mx-auto md:max-w-6xl"
    >
      <div className="bg-gold/20 pointer-events-none absolute -top-32 -left-24 size-96 rounded-full blur-3xl" />
      <div className="relative grid items-center gap-6 px-8 py-16 md:grid-cols-2 md:px-14">
        <div>
          <p className="text-gold text-sm font-bold tracking-widest uppercase">Negocios locales</p>
          <h2 className="mt-3 text-4xl font-bold md:text-5xl">
            De la barbería del barrio a la clínica del centro
          </h2>
          <p className="mt-5 max-w-md text-stone-300">
            Cada negocio configura sus servicios y su equipo, y sus clientes reservan desde
            cualquier sitio. Arrastra el globo y míralo girar.
          </p>
          <Link
            to="/alta"
            className="bg-gold text-ink hover:bg-gold-hover mt-8 inline-block rounded-md px-6 py-3 font-bold transition-colors"
          >
            Quiero mi agenda
          </Link>
        </div>
        <div className="h-[24rem] md:h-[30rem]">
          {near && (
            <Suspense fallback={null}>
              <Globe3D className="h-full" config={GLOBE} />
            </Suspense>
          )}
        </div>
      </div>
    </section>
  );
}
