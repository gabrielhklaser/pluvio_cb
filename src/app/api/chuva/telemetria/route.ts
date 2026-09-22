import type { NextRequest } from "next/server";
import { respostaDeErro } from "@/lib/erros";
import { consultarTelemetria } from "@/lib/servicos";

export const dynamic = "force-dynamic";

/** GET /api/chuva/telemetria?estacao=87380000&inicio=AAAA-MM-DD&fim=AAAA-MM-DD&agregacao=15min|hora|dia */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const resposta = await consultarTelemetria({
      codigo: sp.get("estacao"),
      inicio: sp.get("inicio"),
      fim: sp.get("fim"),
      agregacao: sp.get("agregacao"),
    });
    return Response.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
