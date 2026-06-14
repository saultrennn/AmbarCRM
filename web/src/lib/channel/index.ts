import type { ChannelProvider } from "./types";
import { evolutionProvider } from "./evolution";
import { cloudApiProvider } from "./cloudapi";

export * from "./types";

/** Devuelve el proveedor según lo configurado en el canal (tabla canales_whatsapp). */
export function getProvider(proveedor: "evolution" | "cloud_api"): ChannelProvider {
  return proveedor === "cloud_api" ? cloudApiProvider : evolutionProvider;
}
