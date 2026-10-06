// Preguntas frecuentes de cada página. Responden lo que de verdad hace la app hoy.
import type { FaqItem } from "./components/Faq.tsx";

export const FAQ: Record<string, FaqItem[]> = {
  inicio: [
    {
      q: "¿Tengo que pagar para reservar?",
      a: "No. Reservar en AgendIA es gratis. El precio de cada servicio aparece en la ficha del negocio y lo pagas allí.",
    },
    {
      q: "¿Cómo sé que mi reserva está confirmada?",
      a: "Al terminar ves un código de reserva y la cita aparece en Mis reservas. Si algo falla, te lo decimos en pantalla y no se crea nada.",
    },
    {
      q: "¿Puedo cancelar o cambiar la hora?",
      a: "Sí, desde Mis reservas y hasta el plazo que fija cada negocio, que suele ser de 12 horas antes. Pasado ese plazo hay que hablar con el negocio.",
    },
    {
      q: "¿Necesito cuenta para mirar negocios?",
      a: "No. Puedes buscar, ver servicios y consultar huecos libres sin registrarte. La cuenta hace falta solo para confirmar una reserva.",
    },
    {
      q: "Tengo un negocio, ¿cómo empiezo?",
      a: "Date de alta en dos pasos, añade servicios, equipo y horarios, y publica cuando la lista de comprobación esté completa.",
    },
    {
      q: "¿Los negocios son reales?",
      a: "No. Esta es una versión de demostración: los negocios, los clientes y las reservas son ficticios.",
    },
  ],
  buscar: [
    {
      q: "¿Cómo busco un negocio?",
      a: "Escribe un nombre o un tipo de negocio, o filtra por ciudad y categoría. Da igual escribir con tildes o sin ellas, y encontramos nombres con pequeñas erratas.",
    },
    {
      q: "¿Por qué no aparece el negocio que busco?",
      a: "Solo se muestran los negocios publicados. Prueba con menos palabras o quita los filtros de ciudad y categoría.",
    },
    {
      q: "¿El precio de la tarjeta es el final?",
      a: "El precio «desde» es el del servicio más barato del negocio. En la ficha ves el precio de cada servicio.",
    },
  ],
  negocio: [
    {
      q: "¿Cómo reservo?",
      a: "Elige el servicio, el profesional (o «Cualquiera»), el día y la hora. Solo se ofrecen huecos libres. Para confirmar necesitas iniciar sesión.",
    },
    {
      q: "¿Puedo reservar sin elegir profesional?",
      a: "Sí. Con «Cualquiera» asignamos a un profesional que esté libre a esa hora.",
    },
    {
      q: "¿Qué pasa si alguien reserva mi hueco a la vez?",
      a: "Solo una reserva se queda con el hueco. A la otra persona se le avisa y puede elegir otra hora.",
    },
  ],
  entrar: [
    {
      q: "No consigo entrar, ¿qué hago?",
      a: "Revisa el email y la contraseña. Tras varios intentos fallidos con la misma cuenta, el acceso se bloquea un rato por seguridad.",
    },
    {
      q: "¿Puedo recuperar mi contraseña?",
      a: "Todavía no: la recuperación por email llegará en una fase posterior. Mientras tanto, usa la cuenta con la que te registraste.",
    },
    {
      q: "¿Mi sesión es segura?",
      a: "La sesión va en una cookie que el navegador no deja leer a ningún script de la página, y se cierra cuando pulsas Salir.",
    },
  ],
  registro: [
    {
      q: "¿Qué datos me pedís?",
      a: "Tu nombre, tu email y una contraseña de al menos 8 caracteres. No pedimos nada más.",
    },
    {
      q: "¿Puedo borrar mi cuenta?",
      a: "Sí, a petición. En esta demo se pide al responsable del proyecto y se borran la cuenta y las reservas asociadas.",
    },
    {
      q: "¿Quién ve mis datos?",
      a: "Un negocio solo ve el nombre de las personas que han reservado con él. Ningún otro negocio ve tus datos.",
    },
  ],
  alta: [
    {
      q: "¿Cuánto cuesta dar de alta mi negocio?",
      a: "Nada en esta demostración.",
    },
    {
      q: "¿Cuánto tardo en estar listo?",
      a: "Unos minutos. El alta tiene dos pasos y después configuras servicios, equipo y horarios desde el panel.",
    },
    {
      q: "¿Cuándo aparezco en las búsquedas?",
      a: "Cuando completas la lista de comprobación y pulsas Publicar. Hasta entonces tu negocio es un borrador que solo ves tú.",
    },
  ],
  misReservas: [
    {
      q: "¿Cómo cancelo una reserva?",
      a: "Pulsa Cancelar en la reserva. Solo se puede hasta el plazo que fija el negocio; después hay que hablar con él.",
    },
    {
      q: "¿Puedo cambiar el día o la hora?",
      a: "Sí, con Mover. Verás los huecos libres y la reserva anterior queda libre para otras personas.",
    },
    {
      q: "¿Qué es un token de acceso?",
      a: "Una clave temporal para que un asistente de IA compatible con MCP busque y proponga reservas en tu nombre. Tú eliges qué puede hacer, caduca solo y puedes revocarlo cuando quieras. Un token nunca puede crear otros tokens.",
    },
    {
      q: "¿Puede un asistente reservar sin que yo lo sepa?",
      a: "Con el permiso para asistentes solo propone: la cita queda retenida 10 minutos y no es una reserva hasta que tú la confirmas. Si le das acceso completo, sí puede confirmar, así que úsalo solo con herramientas de tu confianza.",
    },
    {
      q: "¿Qué significa cada estado?",
      a: "Confirmada: tu hueco está reservado. Cancelada: la anulaste tú o el negocio. Completada: ya fuiste. No se presentó: el negocio marcó que no acudiste.",
    },
  ],
  cookies: [
    {
      q: "¿Usáis cookies de publicidad o de analítica?",
      a: "No. Solo usamos la cookie de sesión y guardamos tu elección de tema y de cookies en el propio navegador.",
    },
    {
      q: "¿Puedo borrar lo que guardáis?",
      a: "Sí. Borra los datos del sitio desde la configuración de tu navegador o pulsa Salir para cerrar la sesión.",
    },
  ],
  privacidad: [
    {
      q: "¿Cuánto tiempo guardáis mis datos?",
      a: "Mientras tengas la cuenta. Si la borras, se eliminan la cuenta y sus reservas.",
    },
    {
      q: "¿Compartís mis datos con terceros?",
      a: "No los vendemos ni los cedemos. Cuando exista el asistente de IA, sus conversaciones pasarán por un proveedor externo y te lo avisaremos antes de usarlo.",
    },
  ],
  noEncontrada: [
    {
      q: "¿Por qué veo esta página?",
      a: "La dirección no existe o el negocio ya no está publicado. Prueba a buscarlo desde el inicio.",
    },
  ],
  panelInicio: [
    {
      q: "¿Qué es la lista de comprobación?",
      a: "Los cuatro requisitos para publicar: dirección y ciudad, un servicio activo, un profesional con servicios y su horario semanal. El botón Publicar se activa cuando están los cuatro.",
    },
    {
      q: "¿Puedo despublicar mi negocio?",
      a: "Sí, en cualquier momento. Deja de aparecer en las búsquedas y no admite reservas nuevas. Las que ya tenías se mantienen.",
    },
    {
      q: "¿Qué significa «suspendido»?",
      a: "Que la administración ha retirado tu negocio. Mientras esté suspendido no puedes publicarlo tú.",
    },
  ],
  panelPerfil: [
    {
      q: "¿Qué ve el público de mi perfil?",
      a: "El nombre, la descripción, la dirección, el teléfono y el email de contacto que rellenes aquí.",
    },
    {
      q: "¿Por qué piden dirección y ciudad?",
      a: "Sin ellas no puedes publicar, y la ciudad es lo que usan las personas para encontrarte en el buscador.",
    },
  ],
  panelServicios: [
    {
      q: "¿Qué es la pausa posterior?",
      a: "Los minutos que necesitas entre una cita y la siguiente. Se bloquean en la agenda pero el cliente no los ve.",
    },
    {
      q: "¿Qué pasa si elimino un servicio con reservas?",
      a: "No se borra: se archiva para conservar el historial. Deja de ofrecerse, pero las reservas existentes se mantienen.",
    },
    {
      q: "¿Puedo ocultar un servicio sin borrarlo?",
      a: "Sí, con Desactivar. Vuelve a estar disponible cuando pulses Activar.",
    },
  ],
  panelEquipo: [
    {
      q: "¿Puedo poner un horario partido?",
      a: "Sí. Añade dos franjas para el mismo día, por ejemplo de 9:00 a 14:00 y de 17:00 a 20:00. Si se solapan, te avisamos.",
    },
    {
      q: "¿En qué se diferencia una ausencia de un horario?",
      a: "El horario es lo que se repite cada semana. Una ausencia es un cierre puntual, de una persona o de todo el negocio, y bloquea esos huecos.",
    },
    {
      q: "¿Por qué un profesional no aparece en la ficha?",
      a: "Para mostrarse necesita estar activo y tener al menos un servicio activo asignado.",
    },
  ],
  panelAgenda: [
    {
      q: "¿Puedo apuntar a alguien que viene sin reserva?",
      a: "Sí, con Reserva manual. Puedes hacerlo fuera de horario; solo se impide que dos citas se solapen.",
    },
    {
      q: "¿Cuándo puedo marcar una cita como completada?",
      a: "Cuando ya ha empezado. Antes solo puedes cancelarla.",
    },
    {
      q: "¿Puedo ver la agenda de un solo profesional?",
      a: "Sí, con el filtro Profesional de arriba.",
    },
  ],
};
