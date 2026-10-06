import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Al cambiar de página vuelve arriba; si la dirección lleva #ancla, baja hasta ella. */
export function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      // El destino puede tardar un instante en existir (la página acaba de montarse).
      const t = setTimeout(
        () => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" }),
        150,
      );
      return () => clearTimeout(t);
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname, hash]);
  return null;
}
