import { db } from "@/lib/db";

/** Conversaciones para la bandeja: contacto + último mensaje (preview) + no leídos. */
export function listarConversaciones() {
  return db.conversacion.findMany({
    orderBy: { ultimoMensajeAt: "desc" },
    include: {
      contacto: true,
      responsable: true,
      mensajes: { orderBy: { timestamp: "desc" }, take: 1 }
    }
  });
}

/** Mensajes de una conversación en orden cronológico. */
export function getMensajes(conversacionId: bigint) {
  return db.mensaje.findMany({
    where: { conversacionId },
    orderBy: { timestamp: "asc" }
  });
}

/** Marca la conversación como leída (no_leidos = 0). */
export function marcarLeida(conversacionId: bigint) {
  return db.conversacion.update({ where: { id: conversacionId }, data: { noLeidos: 0 } });
}

export function listarPlantillas() {
  return db.plantillaMensaje.findMany({ orderBy: { nombre: "asc" } });
}
