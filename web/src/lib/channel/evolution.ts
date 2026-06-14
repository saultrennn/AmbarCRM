import type {
  ActualizacionEstado,
  ChannelProvider,
  DatosConexion,
  EstadoConexion,
  EstadoMensaje,
  MensajeEntranteNormalizado,
  ResultadoEnvio,
  TipoMensaje
} from "./types";

const BASE = process.env.EVOLUTION_API_URL ?? "";
const APIKEY = process.env.EVOLUTION_API_KEY ?? "";
const INSTANCE = process.env.EVOLUTION_INSTANCE ?? "ambarcrm";

/** Nombre de instancia por defecto (el que usan los envíos). Lo usa la UI para no dejar el canal sin instancia. */
export const instanciaPorDefecto = INSTANCE;

/** Petición genérica a Evolution. Devuelve { ok, status, data }. */
async function req(
  metodo: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: metodo,
      headers: { "Content-Type": "application/json", apikey: APIKEY },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { message: e instanceof Error ? e.message : "error de red" } };
  }
}

/** Traduce el estado de Evolution (open/connecting/close) al nuestro. */
function mapEstado(state?: string): EstadoConexion {
  if (state === "open") return "conectado";
  if (state === "connecting") return "conectando";
  return "desconectado";
}

/** Normaliza el QR a un data URI usable en <img src>. */
function comoDataUri(base64?: string): string | undefined {
  if (!base64) return undefined;
  return base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`;
}

/** Traduce el acuse de Evolution a nuestro estado de mensaje. */
function mapStatusEvolution(s?: string): EstadoMensaje | null {
  switch (s) {
    case "SENT":
    case "SERVER_ACK":
      return "enviado";
    case "DELIVERED":
    case "DELIVERY_ACK":
      return "entregado";
    case "READ":
    case "READ_ACK":
    case "PLAYED":
      return "leido";
    case "ERROR":
      return "fallido";
    default:
      return null;
  }
}

/** Quita sufijos de WhatsApp (@s.whatsapp.net) y deja solo dígitos. */
function soloDigitos(jid: string): string {
  return (jid || "").split("@")[0].replace(/\D/g, "");
}

function mapTipoMedia(tipo: TipoMensaje): "image" | "video" | "audio" | "document" {
  if (tipo === "imagen") return "image";
  if (tipo === "video") return "video";
  if (tipo === "audio") return "audio";
  return "document";
}

async function post(path: string, body: unknown): Promise<ResultadoEnvio> {
  const { ok, status, data } = await req("POST", path, body);
  if (!ok) return { ok: false, error: data?.message ?? `HTTP ${status}` };
  return { ok: true, waMessageId: data?.key?.id ?? data?.id };
}

export const evolutionProvider: ChannelProvider = {
  nombre: "evolution",

  async enviarTexto(telefono, texto) {
    return post(`/message/sendText/${INSTANCE}`, { number: telefono, text: texto });
  },

  async enviarMedia(telefono, mediaUrl, tipo, caption) {
    return post(`/message/sendMedia/${INSTANCE}`, {
      number: telefono,
      mediatype: mapTipoMedia(tipo),
      media: mediaUrl,
      caption: caption ?? ""
    });
  },

  async enviarAudio(telefono, audioBase64) {
    // Evolution convierte el audio a ogg/opus y lo manda como nota de voz (PTT).
    return post(`/message/sendWhatsAppAudio/${INSTANCE}`, { number: telefono, audio: audioBase64 });
  },

  async conectar(instancia): Promise<DatosConexion> {
    // 1. Crear la instancia (idempotente: si ya existe Evolution responde 403/409 y seguimos).
    const creada = await req("POST", "/instance/create", {
      instanceName: instancia,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true
    });
    if (!creada.ok && creada.status !== 403 && creada.status !== 409) {
      // 403/409 = "ya existe": no es error real. Cualquier otro sí.
      const yaExiste = JSON.stringify(creada.data).toLowerCase().includes("already");
      if (!yaExiste) {
        return { ok: false, estado: "desconectado", error: creada.data?.message ?? `HTTP ${creada.status}` };
      }
    }

    // El create puede ya traer el QR; si no, lo pedimos con /instance/connect.
    let qr = comoDataUri(creada.data?.qrcode?.base64);
    let pairingCode: string | undefined = creada.data?.qrcode?.pairingCode;

    if (!qr) {
      const conn = await req("GET", `/instance/connect/${instancia}`);
      if (!conn.ok) {
        return { ok: false, estado: "desconectado", error: conn.data?.message ?? `HTTP ${conn.status}` };
      }
      qr = comoDataUri(conn.data?.base64 ?? conn.data?.qrcode?.base64);
      pairingCode = conn.data?.pairingCode ?? conn.data?.code ?? pairingCode;
    }

    if (!qr && !pairingCode) {
      // Sin QR ni código suele significar que ya estaba vinculada.
      const est = await this.estadoConexion!(instancia);
      return { ok: true, estado: est.estado, telefono: est.telefono };
    }

    return { ok: true, estado: "conectando", qrBase64: qr, pairingCode };
  },

  async estadoConexion(instancia) {
    const { ok, data } = await req("GET", `/instance/connectionState/${instancia}`);
    if (!ok) return { estado: "desconectado" as EstadoConexion };
    const inst = data?.instance ?? data;
    return {
      estado: mapEstado(inst?.state),
      telefono: inst?.owner ? inst.owner.split("@")[0].replace(/\D/g, "") : undefined
    };
  },

  async desconectar(instancia) {
    const { ok, status, data } = await req("DELETE", `/instance/logout/${instancia}`);
    if (!ok) return { ok: false, error: data?.message ?? `HTTP ${status}` };
    return { ok: true };
  },

  normalizarEntrante(payload) {
    // Evolution v2 manda { event, instance, data } donde data = mensaje(s).
    const raw = payload as any;
    const data = raw?.data;
    if (!data) return [];
    const items = Array.isArray(data) ? data : [data];

    const out: MensajeEntranteNormalizado[] = [];
    for (const m of items) {
      if (m?.key?.fromMe) continue; // ignorar lo que envió el propio número
      const msg = m?.message ?? {};

      let tipo: TipoMensaje = "texto";
      let contenido: string | undefined;
      let mediaUrl: string | undefined;
      let mediaMime: string | undefined;

      if (msg.conversation || msg.extendedTextMessage) {
        tipo = "texto";
        contenido = msg.conversation ?? msg.extendedTextMessage?.text;
      } else if (msg.imageMessage) {
        tipo = "imagen"; contenido = msg.imageMessage.caption;
        mediaUrl = msg.imageMessage.url; mediaMime = msg.imageMessage.mimetype;
      } else if (msg.videoMessage) {
        tipo = "video"; contenido = msg.videoMessage.caption;
        mediaUrl = msg.videoMessage.url; mediaMime = msg.videoMessage.mimetype;
      } else if (msg.audioMessage) {
        tipo = "audio"; mediaUrl = msg.audioMessage.url; mediaMime = msg.audioMessage.mimetype;
      } else if (msg.documentMessage) {
        tipo = "documento"; contenido = msg.documentMessage.fileName;
        mediaUrl = msg.documentMessage.url; mediaMime = msg.documentMessage.mimetype;
      } else if (msg.locationMessage) {
        tipo = "ubicacion";
        contenido = `${msg.locationMessage.degreesLatitude},${msg.locationMessage.degreesLongitude}`;
      }

      out.push({
        waMessageId: m?.key?.id ?? `${Date.now()}-${Math.random()}`,
        telefono: soloDigitos(m?.key?.remoteJid ?? ""),
        nombre: m?.pushName,
        tipo,
        contenido,
        mediaUrl,
        mediaMime,
        raw: m,
        timestamp: m?.messageTimestamp ? new Date(Number(m.messageTimestamp) * 1000) : new Date()
      });
    }
    return out;
  },

  normalizarEstado(payload): ActualizacionEstado[] {
    const raw = payload as any;
    if (raw?.event !== "messages.update") return [];
    const data = raw?.data;
    const items = Array.isArray(data) ? data : [data];

    const out: ActualizacionEstado[] = [];
    for (const it of items ?? []) {
      const id = it?.key?.id ?? it?.keyId ?? it?.id;
      const status = mapStatusEvolution(it?.status ?? it?.update?.status);
      if (id && status) out.push({ waMessageId: id, status });
    }
    return out;
  },

  async descargarMedia(raw, instancia) {
    const { ok, data } = await req("POST", `/chat/getBase64FromMediaMessage/${instancia}`, { message: raw });
    if (!ok || !data?.base64) return null;
    return { base64: data.base64, mime: data.mimetype ?? data.mediaType ?? "application/octet-stream" };
  }
};
