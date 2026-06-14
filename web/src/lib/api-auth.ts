import { NextRequest, NextResponse } from "next/server";

/** Valida la API key que usa n8n para llamar los endpoints /api/wa/*. */
export function requireApiKey(req: NextRequest): NextResponse | null {
  const key = req.headers.get("x-api-key");
  if (!key || key !== process.env.WA_API_KEY) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  return null;
}
