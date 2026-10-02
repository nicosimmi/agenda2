import { Navigate, Route, Routes } from "react-router-dom";
import { Login } from "./pages/Login.tsx";
import { Panel } from "./pages/Panel.tsx";
import { Register } from "./pages/Register.tsx";

export function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Login />} />
      <Route path="/alta" element={<Register />} />
      <Route path="/panel" element={<Panel />} />
      <Route path="*" element={<Navigate to="/panel" replace />} />
    </Routes>
  );
}
