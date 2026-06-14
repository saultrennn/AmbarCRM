import crypto from "crypto";
import { db } from "@/lib/db";

const BASE = process.env.NEXTAUTH_URL ?? "";

export function generarToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function listarBots() {
  return db.bot.findMany({ orderBy: { id: "asc" }, include: { canal: true } });
}

/** Bot activo aplicable a un canal: prioriza el específico del canal, si no, el global (canalId null). */
export async function botParaCanal(canalId: bigint | null) {
  const bots = await db.bot.findMany({ where: { activo: true } });
  if (bots.length === 0) return null;
  const especifico = canalId != null ? bots.find((b) => b.canalId === canalId) : undefined;
  return especifico ?? bots.find((b) => b.canalId === null) ?? null;
}

function absoluto(url: string) {
  return url.startsWith("http") ? url : `${BASE}${url}`;
}

type DatosDispatch = {
  conversacionId: bigint;
  contactoId: bigint;
  telefono: string;
  nombre: string;
  botActivo: boolean;
  mensaje: { id: bigint; tipo: string; contenido: string | null; mediaUrl: string | null };
};

/**
 * Manda el mensaje entrante al webhook del bot con un payload estilo Chatwoot `message_created`.
 * Así un workflow de n8n hecho para Chatwoot funciona cambiando solo el nodo de configuración.
 */
export async function dispatchABot(bot: { webhookUrl: string }, d: DatosDispatch) {
  const sender = { identifier: d.telefono, name: d.nombre, phone_number: `+${d.telefono}` };
  const attachments =
    d.mensaje.mediaUrl && d.mensaje.tipo !== "texto"
      ? [{ file_type: d.mensaje.tipo, data_url: absoluto(d.mensaje.mediaUrl) }]
      : [];

  const payload = {
    event: "message_created",
    message_type: "incoming",
    id: d.mensaje.id.toString(),
    content: d.mensaje.contenido ?? "",
    created_at: new Date().toISOString(),
    conversation: {
      id: Number(d.conversacionId),
      status: "open",
      labels: d.botActivo ? [] : ["bot_off"],
      meta: { sender }
    },
    sender,
    attachments,
    account: { id: 1 },
    // Atajos propios de AmbarCRM (no-Chatwoot) por si el flujo es nuevo:
    ambarcrm: {
      conversacionId: d.conversacionId.toString(),
      contactoId: d.contactoId.toString(),
      telefono: d.telefono,
      responder_url: `${BASE}/api/v1/accounts/1/conversations/${d.conversacionId}/messages`,
      handoff_url: `${BASE}/api/v1/accounts/1/conversations/${d.conversacionId}/labels`
    }
  };

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    await fetch(bot.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    clearTimeout(t);
  } catch (e) {
    console.error("dispatch a bot falló:", e instanceof Error ? e.message : e);
  }
}
