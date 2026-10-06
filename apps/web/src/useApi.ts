import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api.ts";
import type { Category } from "./types.ts";

/**
 * GET que se repite al cambiar `path` (con `null` no pide nada). `loading` es solo la primera
 * carga de cada ruta; `reload()` lo vuelve a pedir en silencio tras una modificación.
 * Solo vale la respuesta de la última petición: si una anterior llega tarde, se descarta.
 */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<number>();
  const [loading, setLoading] = useState(path !== null);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (path === null) return;
    const mine = ++latest.current;
    try {
      const result = await api<T>(path);
      if (mine !== latest.current) return;
      setData(result);
      setError(undefined);
      setStatus(undefined);
    } catch (e) {
      if (mine !== latest.current) return;
      setError((e as Error).message);
      setStatus(e instanceof ApiError ? e.status : undefined);
    } finally {
      if (mine === latest.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    setLoading(path !== null);
    setData(undefined);
    void reload();
    return () => {
      latest.current++; // al salir o cambiar de ruta, cualquier respuesta pendiente deja de valer
    };
  }, [path, reload]);

  return { data, error, status, loading, reload };
}

/** Categorías ordenadas en español, con "Otros" siempre al final. */
export function useCategories(enabled = true) {
  const result = useApi<Category[]>(enabled ? "/public/categories" : null);
  const data = result.data
    ? [...result.data].sort(
        (a, b) =>
          Number(a.slug === "otros") - Number(b.slug === "otros") ||
          a.name.localeCompare(b.name, "es"),
      )
    : undefined;
  return { ...result, data };
}
