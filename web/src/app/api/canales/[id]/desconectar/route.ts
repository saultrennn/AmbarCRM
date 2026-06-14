import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSesion } from "@/lib/session";
import { getProvider } from "@/lib/channel";
import { instanciaPorDefecto } from "@/lib/channel/evolution";

export const dynamic = "force-dynamic";

/** Cierra la sesión del número vinculado y marca el canal como desconectado. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await requireSesion(true);
  if ("error" in s) return s.error;

  const canal = await db.canalWhatsapp.findUnique({ where: { id: BigInt(params.id) } });
  if (!canal) return NextResponse.json({ error: "canal inexistente" }, { status: 404 });

  const provider = getProvider(canal.proveedor);
  if (!provider.desconectar) {
    return NextResponse.json({ error: "este proveedor no soporta desconexión por QR" }, { status: 400 });
  }

  const instancia = canal.instancia?.trim() || instanciaPorDefecto;
  const res = await provider.desconectar(instancia);
  await db.canalWhatsapp.update({ where: { id: canal.id }, data: { estado: "desconectado" } });

  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 502 });
  return NextResponse.json({ ok: true });
}
