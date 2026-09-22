import { asc } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { estacoes as tabelaEstacoes } from "@/db/schema";
import { anaInventario, type RegistroXml } from "./ana";
import { HttpError, mensagemDeErro } from "./erros";
import { ESTACOES_FALLBACK } from "./estacoesFallback";
import type { Estacao, EstacoesResposta } from "./types";
import { arred, emLotes, paraNumero } from "./util";

export const CENTRO = { nome: "Campo Bom - RS", latitude: -29.6789, longitude: -51.0528 };
export const RAIO_MAX_KM = 50;
const VALIDADE_INVENTARIO_MS = 7 * 24 * 3600 * 1000;

export function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const p = Math.PI / 180;
  const dLat = (lat2 - lat1) * p;
  const dLon = (lon2 - lon1) * p;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function mapearInventario(r: RegistroXml): Estacao | null {
  const codigo = r.Codigo?.trim();
  const latitude = paraNumero(r.Latitude);
  const longitude = paraNumero(r.Longitude);
  if (!codigo || latitude === null || longitude === null) return null;
  const estado = r.nmEstado?.trim() ?? null;
  return {
    codigo,
    nome: r.Nome?.trim() || codigo,
    tipo: r.TipoEstacao === "1" ? "fluviometrica" : "pluviometrica",
    municipio: r.nmMunicipio?.trim() ?? null,
    uf: estado && estado.toUpperCase() === "RIO GRANDE DO SUL" ? "RS" : estado,
    responsavel: r.ResponsavelSigla?.trim() ?? null,
    operadora: r.OperadoraSigla?.trim() ?? null,
    rio: r.RioNome?.trim() ?? null,
    latitude,
    longitude,
    altitude: paraNumero(r.Altitude),
    distanciaKm: arred(distanciaKm(CENTRO.latitude, CENTRO.longitude, latitude, longitude), 2),
    telemetrica: r.TipoEstacaoTelemetrica === "1",
    pluviometro: r.TipoEstacaoPluviometro === "1" || r.TipoEstacaoRegistradorChuva === "1",
    climatologica: r.TipoEstacaoClimatologica === "1",
    operando: r.Operando === "1",
    periodoInicio: (r.PeriodoPluviometroInicio ?? r.PeriodoRegistradorChuvaInicio)?.slice(0, 10) ?? null,
    periodoFim: (r.PeriodoPluviometroFim ?? r.PeriodoRegistradorChuvaFim)?.slice(0, 10) ?? null,
  };
}

/** Consulta o inventário da ANA: pluviométricas da sub-bacia 87 + fluviométricas telemétricas (que também medem chuva). */
async function buscarInventarioNaAna(): Promise<Estacao[]> {
  const [pluviometricas, fluviometricas] = await Promise.all([
    anaInventario({ tpEst: "2", codSubBacia: "87" }),
    anaInventario({ tpEst: "1", codSubBacia: "87", telemetrica: "1" }),
  ]);
  const porCodigo = new Map<string, Estacao>();
  for (const r of [...pluviometricas, ...fluviometricas]) {
    const e = mapearInventario(r);
    if (e && e.distanciaKm <= RAIO_MAX_KM && !porCodigo.has(e.codigo)) porCodigo.set(e.codigo, e);
  }
  return [...porCodigo.values()].sort((a, b) => a.distanciaKm - b.distanciaKm);
}

async function salvarEstacoes(lista: Estacao[], agora: Date): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(tabelaEstacoes);
    for (const lote of emLotes(lista, 100)) {
      await tx.insert(tabelaEstacoes).values(lote.map((e) => ({ ...e, atualizadoEm: agora })));
    }
  });
}

let memoria: { resposta: EstacoesResposta; em: number } | null = null;

export async function listarEstacoes(forcar = false): Promise<EstacoesResposta> {
  if (!forcar && memoria && Date.now() - memoria.em < 10 * 60_000 && memoria.resposta.fonte !== "fallback") {
    return memoria.resposta;
  }

  let doBanco: Estacao[] = [];
  let atualizadoEm: Date | null = null;
  try {
    await ensureSchema();
    const linhas = await db.select().from(tabelaEstacoes).orderBy(asc(tabelaEstacoes.distanciaKm));
    doBanco = linhas.map((l) => ({
      codigo: l.codigo,
      nome: l.nome,
      tipo: l.tipo === "fluviometrica" ? "fluviometrica" : "pluviometrica",
      municipio: l.municipio,
      uf: l.uf,
      responsavel: l.responsavel,
      operadora: l.operadora,
      rio: l.rio,
      latitude: l.latitude,
      longitude: l.longitude,
      altitude: l.altitude,
      distanciaKm: l.distanciaKm,
      telemetrica: l.telemetrica,
      pluviometro: l.pluviometro,
      climatologica: l.climatologica,
      operando: l.operando,
      periodoInicio: l.periodoInicio,
      periodoFim: l.periodoFim,
    }));
    for (const l of linhas) {
      const d = new Date(l.atualizadoEm);
      if (!atualizadoEm || d > atualizadoEm) atualizadoEm = d;
    }
  } catch (e) {
    console.warn("[estacoes] leitura do banco falhou:", mensagemDeErro(e));
  }

  const cacheValido =
    doBanco.length > 0 && atualizadoEm !== null && Date.now() - atualizadoEm.getTime() < VALIDADE_INVENTARIO_MS;

  if (cacheValido && !forcar) {
    const resposta: EstacoesResposta = {
      estacoes: doBanco,
      atualizadoEm: atualizadoEm!.toISOString(),
      fonte: "cache",
      centro: CENTRO,
    };
    memoria = { resposta, em: Date.now() };
    return resposta;
  }

  try {
    const daAna = await buscarInventarioNaAna();
    if (!daAna.length) throw new Error("inventário vazio");
    const agora = new Date();
    try {
      await ensureSchema();
      await salvarEstacoes(daAna, agora);
    } catch (e) {
      console.warn("[estacoes] falha ao salvar inventário:", mensagemDeErro(e));
    }
    const resposta: EstacoesResposta = { estacoes: daAna, atualizadoEm: agora.toISOString(), fonte: "ana", centro: CENTRO };
    memoria = { resposta, em: Date.now() };
    return resposta;
  } catch (e) {
    const aviso = `Não foi possível atualizar o inventário na ANA (${mensagemDeErro(e)}).`;
    if (doBanco.length) {
      return {
        estacoes: doBanco,
        atualizadoEm: atualizadoEm?.toISOString() ?? null,
        fonte: "cache",
        aviso: `${aviso} Exibindo a última lista salva.`,
        centro: CENTRO,
      };
    }
    return {
      estacoes: ESTACOES_FALLBACK,
      atualizadoEm: null,
      fonte: "fallback",
      aviso: `${aviso} Exibindo a lista de reserva embutida.`,
      centro: CENTRO,
    };
  }
}

export async function obterEstacao(codigo: string | null | undefined): Promise<Estacao> {
  const c = (codigo ?? "").trim();
  if (!/^\d{5,10}$/.test(c)) throw new HttpError("Código de estação inválido.");
  const { estacoes } = await listarEstacoes(false);
  const estacao = estacoes.find((e) => e.codigo === c) ?? ESTACOES_FALLBACK.find((e) => e.codigo === c);
  if (!estacao) {
    throw new HttpError(`Estação ${c} não encontrada em Campo Bom e arredores (raio de ${RAIO_MAX_KM} km).`, 404);
  }
  return estacao;
}
