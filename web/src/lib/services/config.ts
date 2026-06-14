import { db } from "@/lib/db";

export function getEmbudosConEtapas() {
  return db.embudo.findMany({
    orderBy: { orden: "asc" },
    include: { etapas: { orderBy: { orden: "asc" } } }
  });
}

export function listarUsuarios() {
  return db.usuario.findMany({ orderBy: { nombre: "asc" } });
}

export function listarCanales() {
  return db.canalWhatsapp.findMany({ orderBy: { id: "asc" } });
}

export function listarPlantillas() {
  return db.plantillaMensaje.findMany({ orderBy: { nombre: "asc" } });
}

const AJUSTES_DEFAULT = {
  id: 0n,
  autoAsignar: false,
  bienvenidaActiva: false,
  bienvenidaTexto: "" as string | null,
  crearLeadAuto: true,
  csatActivo: false,
  csatTexto: "" as string | null,
  horarioActivo: false,
  horarioInicio: "" as string | null,
  horarioFin: "" as string | null,
  horarioDias: "" as string | null,
  fueraHorarioTexto: "" as string | null,
  autoResolverActivo: false,
  autoResolverHoras: 24,
  updatedAt: new Date()
};

/** Lee la fila única de ajustes (o defaults si aún no existe). */
export async function getAjustes() {
  const a = await db.ajustes.findFirst({ orderBy: { id: "asc" } });
  return a ?? AJUSTES_DEFAULT;
}

/** Actualiza la fila única de ajustes (la crea si no existe). */
export async function actualizarAjustes(data: {
  autoAsignar?: boolean;
  bienvenidaActiva?: boolean;
  bienvenidaTexto?: string | null;
  crearLeadAuto?: boolean;
  csatActivo?: boolean;
  csatTexto?: string | null;
  horarioActivo?: boolean;
  horarioInicio?: string | null;
  horarioFin?: string | null;
  horarioDias?: string | null;
  fueraHorarioTexto?: string | null;
  autoResolverActivo?: boolean;
  autoResolverHoras?: number;
}) {
  const a = await db.ajustes.findFirst({ orderBy: { id: "asc" } });
  if (a) return db.ajustes.update({ where: { id: a.id }, data });
  return db.ajustes.create({ data });
}
