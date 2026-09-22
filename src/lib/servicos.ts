import { anaSerieHistoricaChuva, anaTelemetria, type MesHistorico } from "./ana";
import { comCache } from "./cache";
import { registrarConsulta } from "./consultas";
import { addDays, diasNoMes, diffDays, formatarDataHora, hojeISO, isISODate, pad2 } from "./dates";
import { HttpError } from "./erros";
import { obterEstacao } from "./estacoes";
import { buscarTemperatura } from "./openmeteo";
import type {
  Agregacao,
  ChuvaAnual,
  ChuvaDiaria,
  ChuvaMensal,
  Consistencia,
  FonteHistorico,
  Granularidade,
  HistoricoResposta,
  LeituraTelemetrica,
  TelemetriaRegistro,
  TelemetriaResposta,
  TemperaturaDiaria,
  TemperaturaHoraria,
  TemperaturaResposta,
} from "./types";
import { arred, media } from "./util";

export const MAX_DIAS_TELEMETRIA = 366;
export const MAX_DIAS_HISTORICO_TELEMETRIA = 731;
export const MAX_DIAS_TEMPERATURA_HORARIA = 366;

export const FONTE_ANA =
  "ANA – Agência Nacional de Águas e Saneamento Básico (API pública HidroWeb/Telemetria – ServiceANA.asmx)";
export const FONTE_OPEN_METEO =
  "Open-Meteo Historical Weather API – reanálise ERA5/ERA5-Land (Copernicus/ECMWF) nas coordenadas da estação";

const HORA = 3600_000;

type Opcoes = { registrar?: boolean };

export function parseAgregacao(v: string | null | undefined): Agregacao {
  return v === "15min" || v === "dia" ? v : "hora";
}

export function parseConsistencia(v: string | null | undefined): Consistencia {
  return v === "bruto" || v === "consistido" ? v : "preferir_consistido";
}

export function parseFonte(v: string | null | undefined): FonteHistorico {
  return v === "convencional" || v === "telemetria" ? v : "auto";
}

export function parseGranularidade(v: string | null | undefined): Granularidade {
  return v === "horaria" ? "horaria" : "diaria";
}

function validarPeriodo(
  inicio: string | null | undefined,
  fim: string | null | undefined,
  opts: { minimo: string; padraoDias: number; maxDias?: number },
): { inicio: string; fim: string } {
  const hoje = hojeISO();
  if (inicio && !isISODate(inicio)) throw new HttpError("Data inicial inválida (use o formato AAAA-MM-DD).");
  if (fim && !isISODate(fim)) throw new HttpError("Data final inválida (use o formato AAAA-MM-DD).");
  let f = fim || hoje;
  if (f > hoje) f = hoje;
  let i = inicio || addDays(f, -opts.padraoDias);
  if (i < opts.minimo) i = opts.minimo;
  if (i > f) throw new HttpError("A data inicial deve ser anterior (ou igual) à data final.");
  if (opts.maxDias && diffDays(i, f) + 1 > opts.maxDias) {
    throw new HttpError(`O período máximo para esta consulta é de ${opts.maxDias} dias. Reduza o intervalo de datas.`);
  }
  return { inicio: i, fim: f };
}

function ttlTelemetria(fim: string): number {
  return fim >= addDays(hojeISO(), -1) ? 10 * 60_000 : 24 * HORA;
}

function leiturasTelemetria(codigo: string, inicio: string, fim: string) {
  return comCache(`tel:v1:${codigo}:${inicio}:${fim}`, ttlTelemetria(fim), () => anaTelemetria(codigo, inicio, fim));
}

/* ------------------------------ Telemetria ----------------------------- */

export function agregarTelemetria(leituras: LeituraTelemetrica[], agregacao: Agregacao): TelemetriaRegistro[] {
  if (agregacao === "15min") {
    return leituras.map((l) => ({
      periodo: l.dataHora,
      chuva: l.chuva,
      nivelMedio: l.nivel,
      nivelMax: l.nivel,
      vazaoMedia: l.vazao,
      leituras: 1,
    }));
  }
  type Acc = {
    chuva: number;
    nChuva: number;
    nivel: number;
    nNivel: number;
    nivelMax: number | null;
    vazao: number;
    nVazao: number;
    leituras: number;
  };
  const grupos = new Map<string, Acc>();
  for (const l of leituras) {
    const chave = agregacao === "hora" ? `${l.dataHora.slice(0, 13)}:00` : l.dataHora.slice(0, 10);
    let g = grupos.get(chave);
    if (!g) {
      g = { chuva: 0, nChuva: 0, nivel: 0, nNivel: 0, nivelMax: null, vazao: 0, nVazao: 0, leituras: 0 };
      grupos.set(chave, g);
    }
    g.leituras++;
    if (l.chuva !== null) {
      g.chuva += l.chuva;
      g.nChuva++;
    }
    if (l.nivel !== null) {
      g.nivel += l.nivel;
      g.nNivel++;
      g.nivelMax = g.nivelMax === null ? l.nivel : Math.max(g.nivelMax, l.nivel);
    }
    if (l.vazao !== null) {
      g.vazao += l.vazao;
      g.nVazao++;
    }
  }
  return [...grupos.entries()]
    .map(([periodo, g]) => ({
      periodo,
      chuva: g.nChuva ? arred(g.chuva, 2) : null,
      nivelMedio: g.nNivel ? arred(g.nivel / g.nNivel, 1) : null,
      nivelMax: g.nivelMax,
      vazaoMedia: g.nVazao ? arred(g.vazao / g.nVazao, 2) : null,
      leituras: g.leituras,
    }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo));
}

export async function consultarTelemetria(
  p: { codigo: string | null; inicio?: string | null; fim?: string | null; agregacao?: string | null },
  opcoes: Opcoes = {},
): Promise<TelemetriaResposta> {
  const estacao = await obterEstacao(p.codigo);
  const agregacao = parseAgregacao(p.agregacao);
  const { inicio, fim } = validarPeriodo(p.inicio, p.fim, {
    minimo: "1990-01-01",
    padraoDias: 7,
    maxDias: MAX_DIAS_TELEMETRIA,
  });
  const { dados: leituras, doCache } = await leiturasTelemetria(estacao.codigo, inicio, fim);
  const registros = agregarTelemetria(leituras, agregacao);

  let total = 0;
  let nChuva = 0;
  let maxChuva: number | null = null;
  let maxChuvaPeriodo: string | null = null;
  let periodosComChuva = 0;
  for (const r of registros) {
    if (r.chuva === null) continue;
    total += r.chuva;
    nChuva++;
    if (r.chuva > 0) periodosComChuva++;
    if (maxChuva === null || r.chuva > maxChuva) {
      maxChuva = r.chuva;
      maxChuvaPeriodo = r.periodo;
    }
  }
  let ultimaLeitura: LeituraTelemetrica | null = null;
  for (let i = leituras.length - 1; i >= 0; i--) {
    const l = leituras[i];
    if (l.chuva !== null || l.nivel !== null || l.vazao !== null) {
      ultimaLeitura = l;
      break;
    }
  }

  let aviso: string | undefined;
  if (!leituras.length) {
    aviso = estacao.telemetrica
      ? "A ANA não retornou dados telemétricos desta estação no período informado."
      : "Esta estação não é telemétrica. Use a aba “Série histórica” para consultar os dados convencionais.";
  }

  if (opcoes.registrar !== false) {
    await registrarConsulta({
      tipo: "telemetria",
      estacoes: estacao.codigo,
      descricao: `${estacao.nome} · agregação ${agregacao}`,
      dataInicio: inicio,
      dataFim: fim,
      registros: registros.length,
    });
  }

  return {
    estacao,
    inicio,
    fim,
    agregacao,
    registros,
    resumo: {
      leituras: leituras.length,
      totalChuva: nChuva ? arred(total, 1) : null,
      maxChuva,
      maxChuvaPeriodo,
      periodosComChuva,
      ultimaLeitura,
    },
    doCache,
    aviso,
    fonte: FONTE_ANA,
  };
}

/* --------------------------- Série histórica --------------------------- */

function selecionarConsistencia(meses: MesHistorico[], modo: Consistencia): MesHistorico[] {
  if (modo === "bruto") return meses.filter((m) => m.consistencia === 1);
  if (modo === "consistido") return meses.filter((m) => m.consistencia === 2);
  const porMes = new Map<string, MesHistorico>();
  for (const m of meses) {
    const chave = `${m.ano}-${m.mes}`;
    const atual = porMes.get(chave);
    if (!atual || m.consistencia > atual.consistencia) porMes.set(chave, m);
  }
  return [...porMes.values()];
}

function diariosConvencionais(meses: MesHistorico[], modo: Consistencia, inicio: string, fim: string): ChuvaDiaria[] {
  const diarios: ChuvaDiaria[] = [];
  for (const m of selecionarConsistencia(meses, modo)) {
    for (const d of m.dias) {
      const data = `${m.ano}-${pad2(m.mes)}-${pad2(d.dia)}`;
      if (data < inicio || data > fim) continue;
      diarios.push({ data, chuva: d.valor, status: d.status, consistencia: m.consistencia, tipoMedicao: m.tipoMedicao });
    }
  }
  return diarios.sort((a, b) => a.data.localeCompare(b.data));
}

/** Série diária contínua entre o primeiro e o último dia com dado (lacunas explícitas como null). */
function preencherLacunas(diarios: ChuvaDiaria[]): ChuvaDiaria[] {
  const comDado = diarios.filter((d) => d.chuva !== null);
  if (!comDado.length) return [];
  const mapa = new Map(diarios.map((d) => [d.data, d]));
  const ate = comDado[comDado.length - 1].data;
  const serie: ChuvaDiaria[] = [];
  for (let d = comDado[0].data; d <= ate; d = addDays(d, 1)) {
    serie.push(mapa.get(d) ?? { data: d, chuva: null, status: null, consistencia: null, tipoMedicao: null });
  }
  return serie;
}

function agrupar<T>(itens: T[], chave: (item: T) => string): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const item of itens) {
    const k = chave(item);
    const g = grupos.get(k);
    if (g) g.push(item);
    else grupos.set(k, [item]);
  }
  return grupos;
}

function estatisticas(dias: ChuvaDiaria[]) {
  let total = 0;
  let n = 0;
  let max: number | null = null;
  let dataMax: string | null = null;
  let chuvosos = 0;
  let consistencia: number | null = null;
  for (const d of dias) {
    if (d.consistencia !== null) consistencia = Math.max(consistencia ?? 0, d.consistencia);
    if (d.chuva === null) continue;
    total += d.chuva;
    n++;
    if (d.chuva > 0) chuvosos++;
    if (max === null || d.chuva > max) {
      max = d.chuva;
      dataMax = d.data;
    }
  }
  if (max === 0) dataMax = null; // sem chuva no período: não há "dia da máxima"
  return { total: n ? arred(total, 1) : null, n, max, dataMax, chuvosos, consistencia };
}

function agregarMensal(diarios: ChuvaDiaria[]): ChuvaMensal[] {
  return [...agrupar(diarios, (d) => d.data.slice(0, 7)).entries()].map(([k, dias]) => {
    const e = estatisticas(dias);
    return {
      ano: Number(k.slice(0, 4)),
      mes: Number(k.slice(5, 7)),
      total: e.total,
      maxima: e.max,
      diaMaxima: e.dataMax ? Number(e.dataMax.slice(8, 10)) : null,
      diasDeChuva: e.chuvosos,
      diasComDado: e.n,
      diasNoPeriodo: dias.length,
      consistencia: e.consistencia,
    };
  });
}

function agregarAnual(diarios: ChuvaDiaria[]): ChuvaAnual[] {
  return [...agrupar(diarios, (d) => d.data.slice(0, 4)).entries()].map(([k, dias]) => {
    const e = estatisticas(dias);
    return {
      ano: Number(k),
      total: e.total,
      maxima: e.max,
      dataMaxima: e.dataMax,
      diasDeChuva: e.chuvosos,
      diasComDado: e.n,
      diasNoPeriodo: dias.length,
    };
  });
}

export async function consultarHistorico(
  p: {
    codigo: string | null;
    inicio?: string | null;
    fim?: string | null;
    consistencia?: string | null;
    fonte?: string | null;
  },
  opcoes: Opcoes = {},
): Promise<HistoricoResposta> {
  const estacao = await obterEstacao(p.codigo);
  const consistencia = parseConsistencia(p.consistencia);
  const fonte = parseFonte(p.fonte);
  const { inicio, fim } = validarPeriodo(p.inicio, p.fim, { minimo: "1900-01-01", padraoDias: 3652 });
  const totalDias = diffDays(inicio, fim) + 1;

  let diarios: ChuvaDiaria[] = [];
  let fonteUsada: HistoricoResposta["fonteUsada"] = null;
  let doCache = true;
  let aviso: string | undefined;

  if (fonte !== "telemetria") {
    // A ANA só retorna meses cujo 1º dia esteja dentro do intervalo: consulta-se sempre o mês
    // completo e os dias são filtrados localmente.
    const inicioMes = `${inicio.slice(0, 7)}-01`;
    const fimMes = `${fim.slice(0, 7)}-${pad2(diasNoMes(Number(fim.slice(0, 4)), Number(fim.slice(5, 7))))}`;
    const r = await comCache(`hist:v2:${estacao.codigo}:${inicioMes}:${fimMes}`, 24 * HORA, () =>
      anaSerieHistoricaChuva(estacao.codigo, inicioMes, fimMes),
    );
    doCache = r.doCache;
    diarios = diariosConvencionais(r.dados, consistencia, inicio, fim);
    if (diarios.some((d) => d.chuva !== null)) {
      fonteUsada = "convencional";
    } else if (r.dados.length && consistencia !== "preferir_consistido") {
      aviso = `A estação possui dados no período, mas não com o nível de consistência escolhido (${
        consistencia === "bruto" ? "bruto" : "consistido"
      }). Tente a opção “Preferir consistido”.`;
    }
  }

  const tentarTelemetria = fonte === "telemetria" || (fonte === "auto" && !fonteUsada && estacao.telemetrica);
  if (tentarTelemetria) {
    if (totalDias > MAX_DIAS_HISTORICO_TELEMETRIA) {
      if (fonte === "telemetria") {
        throw new HttpError(
          `Para montar a série a partir da telemetria o período máximo é de ${MAX_DIAS_HISTORICO_TELEMETRIA} dias (2 anos).`,
        );
      }
      aviso =
        "Não há série convencional desta estação no período. A telemetria pode ser agregada por dia para períodos de até 2 anos: reduza o intervalo ou selecione a fonte “Telemetria”.";
    } else {
      const r = await leiturasTelemetria(estacao.codigo, inicio, fim);
      doCache = doCache && r.doCache;
      diarios = agregarTelemetria(r.dados, "dia").map((reg) => ({
        data: reg.periodo,
        chuva: reg.chuva,
        status: null,
        consistencia: null,
        tipoMedicao: null,
      }));
      if (diarios.some((d) => d.chuva !== null)) fonteUsada = "telemetria";
    }
  }

  diarios = fonteUsada ? preencherLacunas(diarios) : [];
  if (!fonteUsada && !aviso) aviso = "A ANA não retornou dados de chuva desta estação no período informado.";

  const mensais = agregarMensal(diarios);
  const anuais = agregarAnual(diarios);

  const climatologia = Array.from({ length: 12 }, (_, i) => {
    const completos = mensais.filter(
      (m) => m.mes === i + 1 && m.total !== null && m.diasComDado === diasNoMes(m.ano, m.mes),
    );
    const med = media(completos.map((m) => m.total));
    return { mes: i + 1, media: med === null ? null : arred(med, 1), anos: completos.length };
  });

  const geral = estatisticas(diarios);
  const anosCompletos = anuais.filter((a) => a.total !== null && a.diasComDado >= (a.ano % 4 === 0 ? 366 : 365));
  let mediaAnual: number | null = null;
  if (anosCompletos.length) mediaAnual = media(anosCompletos.map((a) => a.total));
  else if (geral.total !== null && geral.n >= 180) mediaAnual = (geral.total / geral.n) * 365.25;
  const comDado = diarios.filter((d) => d.chuva !== null);

  const resposta: HistoricoResposta = {
    estacao,
    inicio,
    fim,
    consistencia,
    fonteUsada,
    diarios,
    mensais,
    anuais,
    climatologia,
    resumo: {
      totalPeriodo: geral.total,
      mediaAnual: mediaAnual === null ? null : arred(mediaAnual, 1),
      anosCompletos: anosCompletos.length,
      maxDiaria: geral.max,
      dataMaxDiaria: geral.dataMax,
      diasComDado: geral.n,
      diasNoPeriodo: diarios.length,
      diasDeChuva: geral.chuvosos,
      percentualFalhas: diarios.length ? arred((1 - geral.n / diarios.length) * 100, 1) : null,
      primeiraData: comDado[0]?.data ?? null,
      ultimaData: comDado[comDado.length - 1]?.data ?? null,
    },
    doCache,
    aviso,
    fonte: fonteUsada === "telemetria" ? `${FONTE_ANA} – telemetria agregada por dia` : FONTE_ANA,
  };

  if (opcoes.registrar !== false) {
    await registrarConsulta({
      tipo: "historico",
      estacoes: estacao.codigo,
      descricao: `${estacao.nome} · ${fonteUsada ?? "sem dados"} · ${consistencia}`,
      dataInicio: inicio,
      dataFim: fim,
      registros: diarios.length,
    });
  }
  return resposta;
}

/* ------------------------------ Temperatura ----------------------------- */

function diariosDeHorarios(horarios: TemperaturaHoraria[]): TemperaturaDiaria[] {
  return [...agrupar(horarios, (h) => h.dataHora.slice(0, 10)).entries()].map(([data, hs]) => {
    const valores = hs.map((h) => h.temperatura).filter((v): v is number => v !== null);
    const med = media(valores);
    return {
      data,
      tmax: valores.length ? Math.max(...valores) : null,
      tmin: valores.length ? Math.min(...valores) : null,
      tmedia: med === null ? null : arred(med, 1),
      precipitacao: null,
    };
  });
}

export async function consultarTemperatura(
  p: { codigo: string | null; inicio?: string | null; fim?: string | null; granularidade?: string | null },
  opcoes: Opcoes = {},
): Promise<TemperaturaResposta> {
  const estacao = await obterEstacao(p.codigo);
  const granularidade = parseGranularidade(p.granularidade);
  const { inicio, fim } = validarPeriodo(p.inicio, p.fim, {
    minimo: "1940-01-01",
    padraoDias: 365,
    maxDias: granularidade === "horaria" ? MAX_DIAS_TEMPERATURA_HORARIA : undefined,
  });
  const ttl = fim >= addDays(hojeISO(), -10) ? 3 * HORA : 7 * 24 * HORA;
  const chave = `temp:v1:${granularidade}:${estacao.latitude.toFixed(4)}:${estacao.longitude.toFixed(4)}:${inicio}:${fim}`;
  const { dados, doCache } = await comCache(chave, ttl, () =>
    buscarTemperatura(estacao.latitude, estacao.longitude, inicio, fim, granularidade),
  );

  const base = granularidade === "diaria" ? dados.diarios : diariosDeHorarios(dados.horarios);

  let maxAbs: number | null = null;
  let dataMaxAbs: string | null = null;
  let minAbs: number | null = null;
  let dataMinAbs: string | null = null;
  if (granularidade === "diaria") {
    for (const d of dados.diarios) {
      if (d.tmax !== null && (maxAbs === null || d.tmax > maxAbs)) [maxAbs, dataMaxAbs] = [d.tmax, d.data];
      if (d.tmin !== null && (minAbs === null || d.tmin < minAbs)) [minAbs, dataMinAbs] = [d.tmin, d.data];
    }
  } else {
    for (const h of dados.horarios) {
      if (h.temperatura === null) continue;
      if (maxAbs === null || h.temperatura > maxAbs) [maxAbs, dataMaxAbs] = [h.temperatura, h.dataHora];
      if (minAbs === null || h.temperatura < minAbs) [minAbs, dataMinAbs] = [h.temperatura, h.dataHora];
    }
  }

  const mediaGeral =
    granularidade === "diaria" ? media(dados.diarios.map((d) => d.tmedia)) : media(dados.horarios.map((h) => h.temperatura));
  const mediaMax = media(base.map((d) => d.tmax));
  const mediaMin = media(base.map((d) => d.tmin));

  const porMes = agrupar(base, (d) => d.data.slice(5, 7));
  const climatologia = Array.from({ length: 12 }, (_, i) => {
    const dias = porMes.get(pad2(i + 1)) ?? [];
    const r = (v: number | null) => (v === null ? null : arred(v, 1));
    return {
      mes: i + 1,
      tmax: r(media(dias.map((d) => d.tmax))),
      tmin: r(media(dias.map((d) => d.tmin))),
      tmedia: r(media(dias.map((d) => d.tmedia))),
    };
  });

  const registros = granularidade === "diaria" ? dados.diarios.length : dados.horarios.length;
  const ultimo = granularidade === "diaria" ? dados.diarios.at(-1)?.data : dados.horarios.at(-1)?.dataHora.slice(0, 10);
  let aviso: string | undefined;
  if (!registros) aviso = "Não há dados de temperatura disponíveis para o período informado.";
  else if (ultimo && ultimo < fim) {
    aviso = `Dados disponíveis até ${formatarDataHora(ultimo)} — a reanálise ERA5 é publicada com alguns dias de defasagem.`;
  }

  if (opcoes.registrar !== false) {
    await registrarConsulta({
      tipo: "temperatura",
      estacoes: estacao.codigo,
      descricao: `${estacao.nome} · ${granularidade}`,
      dataInicio: inicio,
      dataFim: fim,
      registros,
    });
  }

  const r1 = (v: number | null) => (v === null ? null : arred(v, 1));
  return {
    estacao,
    inicio,
    fim,
    granularidade,
    diarios: dados.diarios,
    horarios: dados.horarios,
    climatologia,
    resumo: {
      media: r1(mediaGeral),
      maxAbs,
      dataMaxAbs,
      minAbs,
      dataMinAbs,
      mediaMax: r1(mediaMax),
      mediaMin: r1(mediaMin),
      registros,
    },
    coordenadas: { latitude: dados.latitude, longitude: dados.longitude, elevacao: dados.elevacao },
    doCache,
    aviso,
    fonte: FONTE_OPEN_METEO,
  };
}
