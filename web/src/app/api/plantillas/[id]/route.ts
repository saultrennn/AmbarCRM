import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSesion } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await requireSesion(true);
  if ("error" in s) return s.error;
  await db.plantillaMensaje.delete({ where: { id: BigInt(params.id) } });
  return NextResponse.json({ ok: true });
}
