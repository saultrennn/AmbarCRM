import { redirect } from "next/navigation";
import { getSesion } from "@/lib/session";
import { listarEtiquetasConConteo } from "@/lib/services/contactos";
import { listarPlantillas } from "@/lib/services/chat";
import { serializar } from "@/lib/serialize";
import { DifusionCliente } from "@/components/difusion/DifusionCliente";

export const dynamic = "force-dynamic";

export default async function DifusionPage() {
  const session = await getSesion();
  if (session?.user?.rol !== "admin") redirect("/chat");

  const [etiquetasRaw, plantillasRaw] = await Promise.all([listarEtiquetasConConteo(), listarPlantillas()]);

  const etiquetas = serializar(etiquetasRaw).map((e: any) => ({
    id: e.id,
    nombre: e.nombre,
    color: e.color,
    total: e._count?.contactos ?? 0
  }));
  const plantillas = serializar(plantillasRaw).map((p: any) => ({ id: p.id, nombre: p.nombre, contenido: p.contenido }));

  return <DifusionCliente etiquetas={etiquetas} plantillas={plantillas} />;
}
