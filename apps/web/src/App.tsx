import { Navigate, Route, Routes } from "react-router-dom";
import { Landing } from "./pages/Landing.tsx";
import { Login } from "./pages/Login.tsx";
import { Panel } from "./pages/Panel.tsx";
import { Register } from "./pages/Register.tsx";
import { Agenda } from "./pages/panel/Agenda.tsx";
import { Equipo } from "./pages/panel/Equipo.tsx";
import { Inicio } from "./pages/panel/Inicio.tsx";
import { Perfil } from "./pages/panel/Perfil.tsx";
import { Servicios } from "./pages/panel/Servicios.tsx";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/entrar" element={<Login />} />
      <Route path="/alta" element={<Register />} />
      <Route path="/panel" element={<Panel />}>
        <Route index element={<Inicio />} />
        <Route path="perfil" element={<Perfil />} />
        <Route path="servicios" element={<Servicios />} />
        <Route path="equipo" element={<Equipo />} />
        <Route path="agenda" element={<Agenda />} />
      </Route>
      <Route path="*" element={<Navigate to="/panel" replace />} />
    </Routes>
  );
}
