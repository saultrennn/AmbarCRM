import { NextRequest, NextResponse } from "next/server";
import { requireSesion } from "@/lib/session";
import { listarConversaciones } from "@/lib/services/chat";
import { serializar } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** Lista de conversaciones para la bandeja (la usa el chat para refrescar en vivo). */
export async function GET(_req: NextRequest) {
  const s = await requireSesion();
  if ("error" in s) return s.error;

  const convs = serializar(await listarConversaciones());
  const conversaciones = convs.map((c: any) => ({
    id: c.id,
    contacto: { nombre: c.contacto.nombre, telefono: c.contacto.telefono },
    noLeidos: c.noLeidos,
    ultimoMensajeAt: c.ultimoMensajeAt,
    preview: c.mensajes[0]?.contenido ?? (c.mensajes[0] ? "[archivo]" : ""),
    estado: c.estado,
    etiquetas: c.etiquetas ?? []
  }));
  return NextResponse.json({ conversaciones });
}
