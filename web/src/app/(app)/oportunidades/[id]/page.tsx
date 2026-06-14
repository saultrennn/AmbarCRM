import { notFound } from "next/navigation";
import { getOportunidad } from "@/lib/services/oportunidad";
import { serializar } from "@/lib/serialize";
import { OportunidadCliente } from "@/components/oportunidad/OportunidadCliente";

export const dynamic = "force-dynamic";

export default async function OportunidadPage({ params }: { params: { id: string } }) {
  const op = await getOportunidad(BigInt(params.id));
  if (!op) notFound();

  return <OportunidadCliente op={serializar(op)} />;
}
