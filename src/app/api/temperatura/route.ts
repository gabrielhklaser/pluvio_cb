import type { NextRequest } from "next/server";
import { respostaDeErro } from "@/lib/erros";
import { consultarTemperatura } from "@/lib/servicos";

export const dynamic = "force-dynamic";

/** GET /api/temperatura?estacao=2951069&inicio=AAAA-MM-DD&fim=AAAA-MM-DD&granularidade=diaria|horaria */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const resposta = await consultarTemperatura({
      codigo: sp.get("estacao"),
      inicio: sp.get("inicio"),
      fim: sp.get("fim"),
      granularidade: sp.get("granularidade"),
    });
    return Response.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
