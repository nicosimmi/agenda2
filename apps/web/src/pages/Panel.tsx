import {
  IconBuildingStore,
  IconCalendarEvent,
  IconCut,
  IconMessageChatbot,
  IconHome,
  IconLogout,
  IconUsers,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { Link, Navigate, useLocation, useOutlet } from "react-router-dom";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { useAuth } from "../auth.tsx";
import { Faq } from "../components/Faq.tsx";
import { PageLoader } from "../components/Skeleton.tsx";
import { ThemeToggle } from "../components/ThemeToggle.tsx";
import { FAQ } from "../faqs.ts";

const PANEL_FAQ: Record<string, string> = {
  "/panel": "panelInicio",
  "/panel/perfil": "panelPerfil",
  "/panel/servicios": "panelServicios",
  "/panel/equipo": "panelEquipo",
  "/panel/agenda": "panelAgenda",
  "/panel/asistente": "panelAsistente",
};

const ICON = "size-5 shrink-0";
const LINKS = [
  { label: "Inicio", href: "/panel", end: true, icon: <IconHome className={ICON} /> },
  { label: "Perfil", href: "/panel/perfil", icon: <IconBuildingStore className={ICON} /> },
  { label: "Servicios", href: "/panel/servicios", icon: <IconCut className={ICON} /> },
  { label: "Equipo", href: "/panel/equipo", icon: <IconUsers className={ICON} /> },
  { label: "Agenda", href: "/panel/agenda", icon: <IconCalendarEvent className={ICON} /> },
  { label: "Asistente", href: "/panel/asistente", icon: <IconMessageChatbot className={ICON} /> },
];

export function Panel() {
  const { me, logout } = useAuth();
  const { pathname } = useLocation();
  // useOutlet congela la ruta que sale mientras dura su animación de salida.
  const outlet = useOutlet();
  if (me === undefined) return <PageLoader />;
  if (!me) return <Navigate to="/entrar?volver=/panel" replace />;
  // Un cliente no tiene panel: su zona es Mis reservas.
  if (me.role !== "business_owner") return <Navigate to="/mis-reservas" replace />;
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar>
        <SidebarBody className="bg-ink justify-between gap-8 text-stone-300 md:sticky md:top-0 md:h-screen">
          <div className="flex flex-1 flex-col overflow-hidden">
            <Link to="/" className="text-gold mb-8 px-1 text-xl font-bold whitespace-nowrap">
              A<span className="text-white">gendIA</span>
            </Link>
            <nav className="flex flex-col gap-1">
              {LINKS.map((link) => (
                <SidebarLink key={link.href} link={link} className="hover:text-gold px-1" />
              ))}
            </nav>
          </div>
          <button
            onClick={logout}
            aria-label={`Salir (${me.name})`}
            className="hover:text-gold flex cursor-pointer items-center gap-2 px-1 text-left text-sm whitespace-nowrap transition-colors"
          >
            <IconLogout className={ICON} />
            <span className="truncate">Salir · {me.name}</span>
          </button>
        </SidebarBody>
      </Sidebar>
      <main id="contenido" className="min-w-0 flex-1 p-4 sm:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 flex justify-end">
            <ThemeToggle />
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {outlet}
              {PANEL_FAQ[pathname] && <Faq items={FAQ[PANEL_FAQ[pathname]!]!} className="pt-6" />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
