import { redirect } from "next/navigation";
import { getSesion } from "@/lib/session";
import { getEmbudosConEtapas, listarUsuarios, listarCanales, listarPlantillas, getAjustes } from "@/lib/services/config";
import { listarBots } from "@/lib/services/bots";
import { serializar } from "@/lib/serialize";
import { ConfiguracionCliente } from "@/components/config/ConfiguracionCliente";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const session = await getSesion();
  if (session?.user?.rol !== "admin") redirect("/embudos");

  const [embudos, usuarios, canales, plantillas, ajustes, bots] = await Promise.all([
    getEmbudosConEtapas(),
    listarUsuarios(),
    listarCanales(),
    listarPlantillas(),
    getAjustes(),
    listarBots()
  ]);

  return (
    <ConfiguracionCliente
      embudos={serializar(embudos)}
      usuarios={serializar(usuarios)}
      canales={serializar(canales)}
      plantillas={serializar(plantillas)}
      ajustes={serializar(ajustes)}
      bots={serializar(bots)}
    />
  );
}
