import { Route, Routes } from "react-router-dom";

export function App() {
  return (
    <Routes>
      <Route
        path="*"
        element={
          <main className="mx-auto max-w-md p-8">
            <h1 className="text-3xl font-bold">AgendIA</h1>
            <p className="text-muted mt-2">Panel del negocio</p>
            <button className="bg-gold text-ink hover:bg-gold-dark mt-6 rounded-md px-4 py-2 font-semibold">
              Empezar
            </button>
          </main>
        }
      />
    </Routes>
  );
}
