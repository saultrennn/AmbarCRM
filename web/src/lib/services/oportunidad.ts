import { db } from "@/lib/db";

export function getOportunidad(id: bigint) {
  return db.oportunidad.findUnique({
    where: { id },
    include: {
      contacto: true,
      etapa: true,
      embudo: true,
      responsable: true,
      notas: { orderBy: { createdAt: "desc" }, include: { usuario: true } },
      tareas: { orderBy: [{ completada: "asc" }, { venceAt: "asc" }], include: { responsable: true } },
      eventos: { orderBy: { createdAt: "desc" }, include: { usuario: true } }
    }
  });
}
