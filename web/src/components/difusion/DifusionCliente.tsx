"use client";

import { useState } from "react";
import { Boton } from "@/components/ui";

type Etiqueta = { id: string; nombre: string; color: string; total: number };
type Plantilla = { id: string; nombre: string; contenido: string };

export function DifusionCliente({ etiquetas, plantillas }: { etiquetas: Etiqueta[]; plantillas: Plantilla[] }) {
  const [etiquetaId, setEtiquetaId] = useState("");
  const [plantillaId, setPlantillaId] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const etiqueta = etiquetas.find((e) => e.id === etiquetaId);

  function elegirPlantilla(id: string) {
    setPlantillaId(id);
    const p = plantillas.find((x) => x.id === id);
    if (p) setTexto(p.contenido);
  }

  async function enviar() {
    if (!etiquetaId || !texto.trim()) return;
    if (!confirm(`Se enviará a ${etiqueta?.total ?? 0} contacto(s) con la etiqueta "${etiqueta?.nombre}". ¿Continuar?`)) return;
    setEnviando(true);
    setResultado(null);
    const res = await fetch("/api/difusion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ etiquetaId, texto })
    });
    const d = await res.json().catch(() => ({}));
    setEnviando(false);
    if (res.ok) setResultado(`✓ Enviados: ${d.enviados} · Fallidos: ${d.fallidos} · Total: ${d.total}`);
    else setResultado(d.error ?? "Error al enviar");
  }

  return (
    <div className="max-w-lg space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-bold text-navy">Difusión por etiqueta</h1>
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-slate-600">
        Envía un mensaje a todos los contactos de una etiqueta. Va con una pausa entre cada envío para
        cuidar el número. Úsalo con responsabilidad (evita spam).
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-600">Etiqueta destino</span>
          <select value={etiquetaId} onChange={(e) => setEtiquetaId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Elige una etiqueta…</option>
            {etiquetas.map((e) => <option key={e.id} value={e.id}>{e.nombre} ({e.total})</option>)}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-600">Plantilla (opcional)</span>
          <select value={plantillaId} onChange={(e) => elegirPlantilla(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Escribir mensaje libre…</option>
            {plantillas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-600">Mensaje</span>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4}
            placeholder="Hola {{nombre}}, te tenemos una promoción…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-navy/30" />
          <span className="text-xs text-slate-400">Variables: {"{{nombre}}"}, {"{{telefono}}"}.</span>
        </label>

        <Boton onClick={enviar} disabled={enviando || !etiquetaId || !texto.trim()}>
          {enviando ? "Enviando…" : `Enviar a ${etiqueta?.total ?? 0} contacto(s)`}
        </Boton>
        {resultado && <p className="text-sm text-slate-700">{resultado}</p>}
      </div>
    </div>
  );
}
