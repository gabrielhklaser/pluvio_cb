import type { NextRequest } from "next/server";
import { respostaDeErro } from "@/lib/erros";
import { listarEstacoes } from "@/lib/estacoes";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const forcar = req.nextUrl.searchParams.get("atualizar") === "1";
    return Response.json(await listarEstacoes(forcar));
  } catch (e) {
    return respostaDeErro(e);
  }
}
