import type { ChannelProvider, MensajeEntranteNormalizado, TipoMensaje } from "./types";

// STUB de WhatsApp Cloud API (coexistencia oficial de Meta).
// Se implementa en la fase de migración. La interfaz ya es idéntica a Evolution,
// así que activar esto NO toca la UI ni la lógica del embudo.

const TOKEN = process.env.CLOUD_API_TOKEN ?? "";
const PHONE_ID = process.env.CLOUD_API_PHONE_NUMBER_ID ?? "";
const GRAPH = "https://graph.facebook.com/v21.0";

async function send(payload: Record<string, unknown>) {
  try {
    const res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, waMessageId: data?.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error de red" };
  }
}

export const cloudApiProvider: ChannelProvider = {
  nombre: "cloud_api",

  async enviarTexto(telefono, texto) {
    return send({ to: telefono, type: "text", text: { body: texto } });
  },

  async enviarMedia(telefono, mediaUrl, tipo: TipoMensaje, caption, _mimetype?: string) {
    const map: Record<string, string> = {
      imagen: "image", video: "video", audio: "audio", documento: "document"
    };
    const t = map[tipo] ?? "document";
    return send({ to: telefono, type: t, [t]: { link: mediaUrl, caption } });
  },

  normalizarEntrante(payload) {
    // Estructura webhook Cloud API: entry[].changes[].value.messages[]
    const raw = payload as any;
    const out: MensajeEntranteNormalizado[] = [];
    for (const entry of raw?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value ?? {};
        const contactos: Record<string, string> = {};
        for (const c of value?.contacts ?? []) contactos[c.wa_id] = c?.profile?.name;
        for (const m of value?.messages ?? []) {
          let tipo: TipoMensaje = "texto";
          let contenido: string | undefined;
          let mediaUrl: string | undefined; // en Cloud API se resuelve por media_id aparte
          if (m.type === "text") contenido = m.text?.body;
          else if (m.type === "image") { tipo = "imagen"; contenido = m.image?.caption; mediaUrl = m.image?.id; }
          else if (m.type === "video") { tipo = "video"; contenido = m.video?.caption; mediaUrl = m.video?.id; }
          else if (m.type === "audio") { tipo = "audio"; mediaUrl = m.audio?.id; }
          else if (m.type === "document") { tipo = "documento"; contenido = m.document?.filename; mediaUrl = m.document?.id; }
          else if (m.type === "location") { tipo = "ubicacion"; contenido = `${m.location?.latitude},${m.location?.longitude}`; }

          out.push({
            waMessageId: m.id,
            telefono: m.from,
            nombre: contactos[m.from],
            tipo,
            contenido,
            mediaUrl,
            timestamp: m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date()
          });
        }
      }
    }
    return out;
  }
};
