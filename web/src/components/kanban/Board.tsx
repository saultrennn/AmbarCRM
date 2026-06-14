"use client";

import { useMemo, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCorners, type DragStartEvent, type DragOverEvent, type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import Link from "next/link";
import { formatoMoneda } from "@/components/ui";

export type Tarjeta = {
  id: string;
  titulo: string;
  valor: number;
  moneda: string;
  contacto: { nombre: string; telefono: string | null };
  responsable: { nombre: string } | null;
};
export type Columna = { id: string; nombre: string; color: string; tipo: string; tarjetas: Tarjeta[] };

function TarjetaVista({ t }: { t: Tarjeta }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-sm font-medium text-slate-800">{t.titulo}</p>
      <p className="mt-0.5 text-xs text-slate-500">{t.contacto.nombre}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-ambar">{formatoMoneda(t.valor, t.moneda)}</span>
        {t.responsable && (
          <span className="grid h-6 w-6 place-items-center rounded-full bg-navy/10 text-[10px] font-bold text-navy">
            {t.responsable.nombre.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <Link
        href={`/oportunidades/${t.id}`}
        onPointerDown={(e) => e.stopPropagation()}
        className="mt-2 block text-right text-[11px] font-medium text-navy hover:underline"
      >
        Abrir →
      </Link>
    </div>
  );
}

function TarjetaSortable({ t }: { t: Tarjeta }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: t.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <TarjetaVista t={t} />
    </div>
  );
}

function ColumnaVista({ col }: { col: Columna }) {
  const { setNodeRef } = useDroppable({ id: `col-${col.id}` });
  const total = col.tarjetas.reduce((s, t) => s + t.valor, 0);
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl bg-slate-100">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />
          <span className="text-sm font-semibold text-slate-700">{col.nombre}</span>
          <span className="text-xs text-slate-400">{col.tarjetas.length}</span>
        </div>
        <span className="text-xs font-medium text-slate-400">{formatoMoneda(total, "MXN")}</span>
      </div>
      <div ref={setNodeRef} className="scroll-thin flex-1 space-y-2 overflow-y-auto px-2 pb-3">
        <SortableContext items={col.tarjetas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {col.tarjetas.map((t) => <TarjetaSortable key={t.id} t={t} />)}
        </SortableContext>
      </div>
    </div>
  );
}

export function Board({ columnasIniciales }: { columnasIniciales: Columna[] }) {
  const [cols, setCols] = useState<Columna[]>(columnasIniciales);
  const [activa, setActiva] = useState<Tarjeta | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const idsPorColumna = useMemo(() => {
    const map: Record<string, string[]> = {};
    cols.forEach((c) => (map[c.id] = c.tarjetas.map((t) => t.id)));
    return map;
  }, [cols]);

  function colDe(id: string): string | null {
    if (id.startsWith("col-")) return id.slice(4);
    return cols.find((c) => c.tarjetas.some((t) => t.id === id))?.id ?? null;
  }

  function onDragStart(e: DragStartEvent) {
    const t = cols.flatMap((c) => c.tarjetas).find((x) => x.id === e.active.id);
    setActiva(t ?? null);
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const origen = colDe(active.id as string);
    const destino = colDe(over.id as string);
    if (!origen || !destino || origen === destino) return;

    setCols((prev) => {
      const copia = prev.map((c) => ({ ...c, tarjetas: [...c.tarjetas] }));
      const cOrigen = copia.find((c) => c.id === origen)!;
      const cDestino = copia.find((c) => c.id === destino)!;
      const idx = cOrigen.tarjetas.findIndex((t) => t.id === active.id);
      if (idx < 0) return prev;
      const [movida] = cOrigen.tarjetas.splice(idx, 1);
      cDestino.tarjetas.push(movida);
      return copia;
    });
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiva(null);
    if (!over) return;

    const destino = colDe(over.id as string);
    if (!destino) return;

    // Reordenar dentro de la columna destino.
    setCols((prev) => {
      const copia = prev.map((c) => ({ ...c, tarjetas: [...c.tarjetas] }));
      const c = copia.find((x) => x.id === destino)!;
      const from = c.tarjetas.findIndex((t) => t.id === active.id);
      const to = c.tarjetas.findIndex((t) => t.id === over.id);
      if (from >= 0 && to >= 0 && from !== to) c.tarjetas = arrayMove(c.tarjetas, from, to);
      // Persistir.
      persistir(active.id as string, destino, c.tarjetas.map((t) => t.id));
      return copia;
    });
  }

  async function persistir(oportunidadId: string, etapaIdDestino: string, ordenIds: string[]) {
    try {
      await fetch("/api/oportunidades/mover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oportunidadId,
          etapaIdDestino,
          ordenIds: ordenIds.map((x) => Number(x))
        })
      });
    } catch {
      /* en caso de fallo, un refresh re-sincroniza desde la BD */
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      <div className="flex h-full gap-3 overflow-x-auto p-4">
        {cols.map((c) => <ColumnaVista key={c.id} col={c} />)}
      </div>
      <DragOverlay>{activa ? <div className="w-72"><TarjetaVista t={activa} /></div> : null}</DragOverlay>
    </DndContext>
  );
}
