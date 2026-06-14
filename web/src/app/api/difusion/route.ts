import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSesion } from "@/lib/session";
import { getProvider } from "@/lib/channel";
import { aplicarVariables } from "@/lib/plantillas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TOPE = 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Envía una plantilla a todos los contactos de una etiqueta (difusión).
 * Body: { etiquetaId, plantillaId? , texto? }
 * Throttle entre mensajes para no quemar el número (anti-spam de Evolution).
 */
export async function POST(req: NextRequest) {
  const s = await requireSesion(true);
  if ("error" in s) return s.error;

  const { etiquetaId, plantillaId, texto } = await req.json().catch(() => ({}));
  if (!etiquetaId) return NextResponse.json({ error: "falta etiquetaId" }, { status: 400 });

  let contenido = (texto ?? "").toString();
  if (plantillaId) {
    const p = await db.plantillaMensaje.findUnique({ where: { id: BigInt(plantillaId) } });
    if (p) contenido = p.contenido;
  }
  if (!contenido.trim()) return NextResponse.json({ error: "falta el mensaje" }, { status: 400 });

  const canal = await db.canalWhatsapp.findFirst({ where: { activo: true } });
  const provider = getProvider(canal?.proveedor ?? "evolution");

  const contactos = await db.contacto.findMany({
    where: { telefono: { not: null }, etiquetas: { some: { etiquetaId: BigInt(etiquetaId) } } },
    take: TOPE
  });

  let enviados = 0;
  let fallidos = 0;

  for (const c of contactos) {
    if (!c.telefono) continue;
    const msg = aplicarVariables(contenido, c);
    const envio = await provider.enviarTexto(c.telefono, msg);

    const conv = await db.conversacion.upsert({
      where: { contactoId_canalId: { contactoId: c.id, canalId: (canal?.id ?? null) as any } },
      update: { ultimoMensajeAt: new Date() },
      create: { contactoId: c.id, canalId: canal?.id ?? undefined, ultimoMensajeAt: new Date() }
    });
    await db.mensaje.create({
      data: {
        conversacionId: conv.id,
        direccion: "saliente",
        tipo: "texto",
        contenido: msg,
        status: envio.ok ? "enviado" : "fallido",
        waMessageId: envio.waMessageId,
        enviadoPor: s.userId
      }
    });

    envio.ok ? enviados++ : fallidos++;
    await sleep(800); // throttle anti-spam
  }

  return NextResponse.json({ ok: true, total: contactos.length, enviados, fallidos });
}
