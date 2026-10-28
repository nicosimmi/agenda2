import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Faq } from "../components/Faq.tsx";
import { FAQ } from "../faqs.ts";
import { Page } from "../ui.tsx";

function Doc({
  title,
  updated,
  children,
  faq,
}: {
  title: string;
  updated: string;
  children: ReactNode;
  faq: keyof typeof FAQ;
}) {
  return (
    <Page className="max-w-3xl py-12">
      <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
      <p className="text-muted mt-2 text-sm">Última actualización: {updated}</p>
      <div className="mt-8 space-y-4 leading-relaxed [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted">
        {children}
      </div>
      <Faq items={FAQ[faq]!} className="mt-16" />
    </Page>
  );
}

export function Cookies() {
  return (
    <Doc title="Política de cookies" updated="octubre de 2026" faq="cookies">
      <p>
        AgendIA solo usa lo imprescindible para funcionar. No hay cookies de publicidad, de
        analítica ni de seguimiento entre sitios.
      </p>
      <h2>Qué guardamos en tu navegador</h2>
      <div className="border-line overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="bg-surface-2">
            <tr>
              <th className="p-3">Nombre</th>
              <th className="p-3">Para qué sirve</th>
              <th className="p-3">Duración</th>
            </tr>
          </thead>
          <tbody className="divide-line text-muted divide-y">
            <tr>
              <td className="p-3 font-mono">sid</td>
              <td className="p-3">Cookie de sesión: te mantiene dentro de tu cuenta.</td>
              <td className="p-3">Hasta 7 días o hasta que pulses Salir</td>
            </tr>
            <tr>
              <td className="p-3 font-mono">agendia-theme</td>
              <td className="p-3">Recuerda si prefieres el modo claro o el oscuro.</td>
              <td className="p-3">Hasta que borres los datos del sitio</td>
            </tr>
            <tr>
              <td className="p-3 font-mono">agendia-cookies</td>
              <td className="p-3">Recuerda que ya has visto el aviso de cookies.</td>
              <td className="p-3">Hasta que borres los datos del sitio</td>
            </tr>
            <tr>
              <td className="p-3 font-mono">agendia-pending-booking</td>
              <td className="p-3">
                Guarda tu selección mientras inicias sesión para confirmar una reserva.
              </td>
              <td className="p-3">Hasta cerrar la pestaña</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        La cookie de sesión no se puede leer desde los scripts de la página y solo se envía a
        nuestro propio servidor.
      </p>
      <h2>Cómo borrarlas</h2>
      <p>
        Pulsa Salir para cerrar la sesión, o borra los datos del sitio desde la configuración de tu
        navegador. Si lo haces, el aviso de cookies y el tema volverán a sus valores iniciales.
      </p>
      <p>
        Más información sobre qué datos tratamos en la{" "}
        <Link to="/privacidad" className="text-gold-dark underline">
          política de privacidad
        </Link>
        .
      </p>
    </Doc>
  );
}

export function Privacy() {
  return (
    <Doc title="Privacidad" updated="octubre de 2026" faq="privacidad">
      <p>
        AgendIA es un proyecto de portfolio de Nicolás Simón Milano y esta web es una demostración
        con datos ficticios. No escribas datos reales: ni tu nombre completo, ni tu email personal,
        ni fotos de personas, ni imágenes que no sean tuyas.
      </p>
      <h2>Qué se guarda en la demo pública</h2>
      <ul>
        <li>
          <strong>En tu navegador</strong> (almacenamiento local): las cuentas de prueba que crees,
          tus reservas, los cambios que hagas en un negocio, el tema y la respuesta al aviso de
          cookies. Se borra al limpiar los datos del sitio.
        </li>
        <li>
          <strong>En un servicio de Google (Firebase Firestore)</strong>: las reservas, para que el
          negocio las vea desde otro dispositivo, y las fotos que suba un negocio, para que las vea
          cualquiera. De una reserva se guarda el negocio, el profesional, el servicio, la hora, el
          estado, el código y solo el nombre de pila del cliente. No se envían emails, teléfonos ni
          notas. Como en cualquier petición web, Google recibe tu dirección IP.
        </li>
      </ul>
      <p>
        Lo que está en Firestore es visible para cualquiera que use la demo. No hay analítica,
        publicidad ni cookies de seguimiento.
      </p>
      <h2>Fotos y contenido</h2>
      <p>
        Sube solo imágenes tuyas o de uso libre, sin personas reconocibles. Si ves algo que no
        debería estar, escríbeme por{" "}
        <a
          href="https://www.linkedin.com/in/nicolas-simon-milano/"
          className="text-gold-dark underline"
        >
          LinkedIn
        </a>{" "}
        y lo retiro. Lo mismo vale si quieres que borre una reserva tuya.
      </p>
      <h2>Si se usara con personas reales</h2>
      <p>
        Esta parte describe cómo trataría los datos la instalación completa (no la demo), que sí
        tiene servidor y base de datos propios.
      </p>
      <ul>
        <li>De los clientes: nombre, email y contraseña (guardada cifrada, nunca en claro).</li>
        <li>De las reservas: servicio, profesional, fecha y hora, y la nota que quieras dejar.</li>
        <li>De los negocios: los datos de perfil y las fotos que ellos mismos publican.</li>
      </ul>
      <p>
        Un negocio solo ve el nombre de las personas que han reservado con él. Ningún negocio accede
        a los datos de clientes que no han reservado en su agenda. Puedes pedir el acceso, la
        corrección o el borrado de tus datos; al borrar una cuenta se eliminan también sus reservas.
      </p>
      <h2>Inteligencia artificial</h2>
      <p>
        En esta demo el asistente sigue un guion fijo: no es una IA y no envía lo que escribes a
        ningún modelo. En la instalación completa es una IA de un tercero (Anthropic): lo que
        escribes en el chat se le envía para generar la respuesta, junto con los datos que el propio
        asistente consulta para ayudarte (negocios, servicios y huecos y, si has iniciado sesión,
        tus reservas). No escribas datos sensibles. AgendIA guarda un registro de lo que hace el
        asistente (qué herramienta usó y cuándo, sin el texto de la conversación) y lo limita por
        uso y gasto. El asistente nunca confirma una reserva por su cuenta: lo haces tú con un
        botón.
      </p>
      <p>
        Antes de usar AgendIA con personas reales habría que revisar las obligaciones legales,
        porque la plataforma trata datos de clientes de otros negocios.
      </p>
    </Doc>
  );
}

export function NotFound() {
  return (
    <Page className="py-20 text-center">
      <p className="text-gold text-7xl font-bold">404</p>
      <h1 className="mt-4 text-3xl font-bold">Esta página no existe</h1>
      <p className="text-muted mx-auto mt-3 max-w-md">
        Puede que la dirección esté mal escrita o que la página se haya movido.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          to="/"
          className="bg-gold text-ink hover:bg-gold-hover rounded-md px-4 py-2 font-semibold transition-colors"
        >
          Ir al inicio
        </Link>
        <Link
          to="/buscar"
          className="border-line hover:border-fg rounded-md border px-4 py-2 font-semibold transition-colors"
        >
          Buscar negocios
        </Link>
      </div>
      <Faq items={FAQ.noEncontrada!} className="mx-auto mt-16 max-w-3xl text-left" />
    </Page>
  );
}
