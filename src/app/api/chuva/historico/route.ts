import type { NextRequest } from "next/server";
import { respostaDeErro } from "@/lib/erros";
import { consultarHistorico } from "@/lib/servicos";

export const dynamic = "force-dynamic";

/**
 * GET /api/chuva/historico?estacao=2951069&inicio=AAAA-MM-DD&fim=AAAA-MM-DD
 *     &consistencia=preferir_consistido|bruto|consistido&fonte=auto|convencional|telemetria
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const resposta = await consultarHistorico({
      codigo: sp.get("estacao"),
      inicio: sp.get("inicio"),
      fim: sp.get("fim"),
      consistencia: sp.get("consistencia"),
      fonte: sp.get("fonte"),
    });
    return Response.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
