import { eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { cacheRespostas } from "@/db/schema";
import { mensagemDeErro } from "./erros";

const emAndamento = new Map<string, Promise<unknown>>();

/**
 * Busca `chave` no cache do PostgreSQL; se ausente/expirada, executa `buscar`,
 * grava o resultado e o devolve. Falhas do banco nunca impedem a consulta externa.
 */
export async function comCache<T>(
  chave: string,
  ttlMs: number,
  buscar: () => Promise<T>,
): Promise<{ dados: T; doCache: boolean }> {
  try {
    await ensureSchema();
    const [linha] = await db.select().from(cacheRespostas).where(eq(cacheRespostas.chave, chave)).limit(1);
    if (linha && Date.now() - new Date(linha.criadoEm).getTime() < ttlMs) {
      return { dados: linha.dados as T, doCache: true };
    }
  } catch (e) {
    console.warn("[cache] leitura falhou:", mensagemDeErro(e));
  }

  let promessa = emAndamento.get(chave) as Promise<T> | undefined;
  if (!promessa) {
    promessa = buscar().finally(() => emAndamento.delete(chave));
    emAndamento.set(chave, promessa);
  }
  const dados = await promessa;

  try {
    const agora = new Date();
    await db
      .insert(cacheRespostas)
      .values({ chave, dados, criadoEm: agora })
      .onConflictDoUpdate({ target: cacheRespostas.chave, set: { dados, criadoEm: agora } });
    if (Math.random() < 0.05) {
      await db.delete(cacheRespostas).where(lt(cacheRespostas.criadoEm, new Date(Date.now() - 14 * 86_400_000)));
    }
  } catch (e) {
    console.warn("[cache] gravação falhou:", mensagemDeErro(e));
  }

  return { dados, doCache: false };
}
