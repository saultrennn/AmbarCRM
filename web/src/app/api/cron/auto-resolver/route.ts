import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "@/lib/api-auth";
import { getAjustes } from "@/lib/services/config";

export const dynamic = "force-dynamic";

/**
 * Cierra conversaciones inactivas. Pensado para que n8n lo llame con un Schedule Trigger.
 * Header: x-api-key = WA_API_KEY.
 */
export async function POST(req: NextRequest) {
  const noAuth = requireApiKey(req);
  if (noAuth) return noAuth;

  const ajustes = await getAjustes();
  if (!ajustes.autoResolverActivo) return NextResponse.json({ ok: true, cerradas: 0, motivo: "inactivo" });

  const limite = new Date(Date.now() - (ajustes.autoResolverHoras || 24) * 60 * 60 * 1000);
  const res = await db.conversacion.updateMany({
    where: { estado: { not: "cerrada" }, ultimoMensajeAt: { lt: limite } },
    data: { estado: "cerrada" }
  });

  return NextResponse.json({ ok: true, cerradas: res.count });
}
