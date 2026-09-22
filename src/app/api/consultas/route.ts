import { listarConsultas } from "@/lib/consultas";
import { respostaDeErro } from "@/lib/erros";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ consultas: await listarConsultas(25) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
