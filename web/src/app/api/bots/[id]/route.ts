import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSesion } from "@/lib/session";
import { generarToken } from "@/lib/services/bots";

export const dynamic = "force-dynamic";

/** Edita un bot. Body: { nombre?, webhookUrl?, canalId?, activo?, regenerarToken? } */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await requireSesion(true);
  if ("error" in s) return s.error;

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.nombre === "string") data.nombre = body.nombre;
  if (typeof body.webhookUrl === "string") data.webhookUrl = body.webhookUrl;
  if (typeof body.activo === "boolean") data.activo = body.activo;
  if ("canalId" in body) data.canalId = body.canalId ? BigInt(body.canalId) : null;
  if (body.regenerarToken === true) data.apiToken = generarToken();

  const bot = await db.bot.update({ where: { id: BigInt(params.id) }, data });
  return NextResponse.json({ ok: true, apiToken: bot.apiToken });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await requireSesion(true);
  if ("error" in s) return s.error;
  await db.bot.delete({ where: { id: BigInt(params.id) } });
  return NextResponse.json({ ok: true });
}
