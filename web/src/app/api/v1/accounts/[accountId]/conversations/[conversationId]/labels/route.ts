import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBot } from "@/lib/bot-auth";

export const dynamic = "force-dynamic";

const ETIQUETAS_HANDOFF = ["escalado_humano", "bot_off"];

/**
 * Compatible con Chatwoot: el bot fija las etiquetas de la conversación.
 * Lo usamos para el handoff: si manda `escalado_humano`/`bot_off`, apagamos el bot y
 * dejamos la conversación pendiente para que la tome un humano.
 * POST /api/v1/accounts/:accountId/conversations/:conversationId/labels
 * Body: { labels: string[] }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  const bot = await requireBot(req);
  if (!bot) return NextResponse.json({ error: "token inválido" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const labels: string[] = Array.isArray(body.labels) ? body.labels.map(String) : [];
  const handoff = labels.some((l) => ETIQUETAS_HANDOFF.includes(l));

  await db.conversacion.update({
    where: { id: BigInt(params.conversationId) },
    data: handoff ? { botActivo: false, estado: "pendiente" } : { botActivo: true }
  });

  return NextResponse.json({ payload: labels });
}
