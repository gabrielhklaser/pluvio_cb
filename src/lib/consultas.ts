import { desc } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { consultas } from "@/db/schema";
import { mensagemDeErro } from "./erros";
import type { ConsultaLog } from "./types";

export async function registrarConsulta(c: {
  tipo: string;
  acao?: "consulta" | "exportacao";
  estacoes: string;
  descricao?: string;
  dataInicio: string;
  dataFim: string;
  registros: number;
}): Promise<void> {
  try {
    await ensureSchema();
    await db.insert(consultas).values({
      tipo: c.tipo,
      acao: c.acao ?? "consulta",
      estacoes: c.estacoes.slice(0, 500),
      descricao: c.descricao?.slice(0, 500) ?? null,
      dataInicio: c.dataInicio,
      dataFim: c.dataFim,
      registros: c.registros,
    });
  } catch (e) {
    console.warn("[consultas] falha ao registrar:", mensagemDeErro(e));
  }
}

export async function listarConsultas(limite = 20): Promise<ConsultaLog[]> {
  await ensureSchema();
  const linhas = await db.select().from(consultas).orderBy(desc(consultas.criadoEm)).limit(limite);
  return linhas.map((l) => ({
    id: l.id,
    tipo: l.tipo,
    acao: l.acao,
    estacoes: l.estacoes,
    descricao: l.descricao,
    dataInicio: String(l.dataInicio),
    dataFim: String(l.dataFim),
    registros: l.registros,
    criadoEm: new Date(l.criadoEm).toISOString(),
  }));
}
