import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { CookieBanner } from "./components/CookieBanner.tsx";
import { PublicLayout } from "./components/PublicLayout.tsx";
import { RouteProgress } from "./components/RouteProgress.tsx";
import { ScrollManager } from "./components/ScrollManager.tsx";
import { ScrollTop } from "./components/ScrollTop.tsx";
import { PageLoader } from "./components/Skeleton.tsx";

// Cada página se descarga cuando se visita: la portada no carga el panel ni al revés.
const named = <T extends Record<string, unknown>>(load: () => Promise<T>, key: keyof T) =>
  lazy(async () => ({ default: (await load())[key] as React.ComponentType }));

const Landing = named(() => import("./pages/Landing.tsx"), "Landing");
const Search = named(() => import("./pages/Search.tsx"), "Search");
const Business = named(() => import("./pages/Business.tsx"), "Business");
const Login = named(() => import("./pages/Login.tsx"), "Login");
const Signup = named(() => import("./pages/Signup.tsx"), "Signup");
const Register = named(() => import("./pages/Register.tsx"), "Register");
const MyBookings = named(() => import("./pages/MyBookings.tsx"), "MyBookings");
const Cookies = named(() => import("./pages/Legal.tsx"), "Cookies");
const Privacy = named(() => import("./pages/Legal.tsx"), "Privacy");
const NotFound = named(() => import("./pages/Legal.tsx"), "NotFound");
const Panel = named(() => import("./pages/Panel.tsx"), "Panel");
const Inicio = named(() => import("./pages/panel/Inicio.tsx"), "Inicio");
const Perfil = named(() => import("./pages/panel/Perfil.tsx"), "Perfil");
const Servicios = named(() => import("./pages/panel/Servicios.tsx"), "Servicios");
const Equipo = named(() => import("./pages/panel/Equipo.tsx"), "Equipo");
const Agenda = named(() => import("./pages/panel/Agenda.tsx"), "Agenda");
const Asistente = named(() => import("./pages/panel/Asistente.tsx"), "Asistente");

export function App() {
  return (
    <>
      <ScrollManager />
      <RouteProgress />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/buscar" element={<Search />} />
            <Route path="/n/:slug" element={<Business />} />
            <Route path="/entrar" element={<Login />} />
            <Route path="/registro" element={<Signup />} />
            <Route path="/alta" element={<Register />} />
            <Route path="/mis-reservas" element={<MyBookings />} />
            <Route path="/cookies" element={<Cookies />} />
            <Route path="/privacidad" element={<Privacy />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="/panel" element={<Panel />}>
            <Route index element={<Inicio />} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="servicios" element={<Servicios />} />
            <Route path="equipo" element={<Equipo />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="asistente" element={<Asistente />} />
          </Route>
        </Routes>
      </Suspense>
      <ScrollTop />
      <CookieBanner />
    </>
  );
}
