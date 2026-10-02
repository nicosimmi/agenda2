import { useCallback, useEffect, useState } from "react";
import { api } from "./api.ts";

/** GET que se repite al cambiar `path`; `reload()` lo vuelve a pedir tras una modificación. */
export function useApi<T>(path: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const reload = useCallback(
    () =>
      api<T>(path).then(
        (d) => {
          setData(d);
          setError(undefined);
        },
        (e: Error) => setError(e.message),
      ),
    [path],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, reload };
}
