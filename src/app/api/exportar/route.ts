import type { NextRequest } from "next/server";
import { respostaDeErro } from "@/lib/erros";
import { gerarExportacao } from "@/lib/exportacao";

export const dynamic = "force-dynamic";

/**
 * GET /api/exportar?tipo=telemetria|historico_diario|historico_mensal|historico_anual|temperatura
 *     &estacoes=87380000,2951069&inicio=AAAA-MM-DD&fim=AAAA-MM-DD&formato=excel|padrao
 *     [&agregacao=15min|hora|dia] [&consistencia=...] [&fonte=...] [&granularidade=diaria|horaria]
 */
export async function GET(req: NextRequest) {
  try {
    const r = await gerarExportacao(req.nextUrl.searchParams);
    const headers: Record<string, string> = {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${r.nomeArquivo}"`,
      "Cache-Control": "no-store",
      "X-Registros": String(r.registros),
    };
    if (r.avisos.length) headers["X-Avisos"] = encodeURIComponent(r.avisos.join(" | ").slice(0, 1500));
    return new Response(r.csv, { headers });
  } catch (e) {
    return respostaDeErro(e);
  }
}
