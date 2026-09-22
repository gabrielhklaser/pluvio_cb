// Cliente da API pública de dados hidrometeorológicos da ANA
// (ServiceANA.asmx — HidroInventario, HidroSerieHistorica e DadosHidrometeorologicos).

import { addDays, diasNoMes, isoToBR, minISO } from "./dates";
import { mensagemDeErro, ServicoExternoError } from "./erros";
import type { LeituraTelemetrica } from "./types";
import { mapLimit, paraInteiro, paraNumero } from "./util";

export const ANA_BASE = (process.env.ANA_BASE_URL || "http://telemetriaws1.ana.gov.br/ServiceANA.asmx").replace(
  /\/+$/,
  "",
);

export type RegistroXml = Record<string, string | null>;

function decodificarXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, g: string) => {
    const k = g.toLowerCase();
    if (k === "amp") return "&";
    if (k === "lt") return "<";
    if (k === "gt") return ">";
    if (k === "quot") return '"';
    if (k === "apos") return "'";
    if (k.startsWith("#x")) return String.fromCodePoint(parseInt(k.slice(2), 16));
    if (k.startsWith("#")) return String.fromCodePoint(parseInt(k.slice(1), 10));
    return m;
  });
}

function lerCampos(corpo: string): RegistroXml {
  const reg: RegistroXml = {};
  const abertura = /<([A-Za-z_][\w.\-]*)([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = abertura.exec(corpo))) {
    const nome = m[1];
    if (m[3] === "/") {
      reg[nome] = null;
      continue;
    }
    const fechamento = `</${nome}>`;
    const fim = corpo.indexOf(fechamento, abertura.lastIndex);
    if (fim === -1) continue;
    const conteudo = corpo.slice(abertura.lastIndex, fim).trim();
    reg[nome] = conteudo === "" ? null : decodificarXml(conteudo);
    abertura.lastIndex = fim + fechamento.length;
  }
  return reg;
}

/** Extrai as linhas (<tag>...</tag>) de um DataSet/DataTable .NET serializado em XML. */
export function lerLinhas(xml: string, tag: string): RegistroXml[] {
  const linhas: RegistroXml[] = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) linhas.push(lerCampos(m[1]));
  return linhas;
}

function extrairErro(xml: string): string | null {
  const m = xml.match(/<Error>([\s\S]*?)<\/Error>/);
  return m ? decodificarXml(m[1].trim()) : null;
}

function ehSemDados(msg: string): boolean {
  return /sem dados|nenhum (dado|registro)|n[aã]o (foram )?encontrad/i.test(msg);
}

async function anaGet(metodo: string, params: Record<string, string>, timeoutMs = 60_000): Promise<string> {
  const url = `${ANA_BASE}/${metodo}?${new URLSearchParams(params).toString()}`;
  let ultimoErro: unknown = null;
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: "text/xml, application/xml;q=0.9, */*;q=0.8" },
      });
      if (res.ok) return await res.text();
      ultimoErro = new Error(`HTTP ${res.status}`);
      if (res.status < 500) break;
    } catch (e) {
      ultimoErro = e;
    }
    if (tentativa < 2) await new Promise((r) => setTimeout(r, 1000));
  }
  throw new ServicoExternoError(
    `Não foi possível consultar a API da ANA (${metodo}): ${mensagemDeErro(ultimoErro)}. Tente novamente em instantes.`,
  );
}

/* ----------------------------- Inventário ----------------------------- */

export type FiltroInventario = Partial<
  Record<
    | "codEstDE"
    | "codEstATE"
    | "tpEst"
    | "nmEst"
    | "nmRio"
    | "codSubBacia"
    | "codBacia"
    | "nmMunicipio"
    | "nmEstado"
    | "sgResp"
    | "sgOper"
    | "telemetrica",
    string
  >
>;

export async function anaInventario(filtro: FiltroInventario): Promise<RegistroXml[]> {
  const params: Record<string, string> = {
    codEstDE: "",
    codEstATE: "",
    tpEst: "",
    nmEst: "",
    nmRio: "",
    codSubBacia: "",
    codBacia: "",
    nmMunicipio: "",
    nmEstado: "",
    sgResp: "",
    sgOper: "",
    telemetrica: "",
    ...filtro,
  };
  const xml = await anaGet("HidroInventario", params, 90_000);
  const linhas = lerLinhas(xml, "Table");
  if (!linhas.length) {
    const erro = extrairErro(xml);
    if (erro && !ehSemDados(erro)) throw new ServicoExternoError(`ANA: ${erro}`);
  }
  return linhas;
}

/* ------------------- Série histórica (convencional) ------------------- */

export type MesHistorico = {
  ano: number;
  mes: number;
  consistencia: number; // 1 = bruto, 2 = consistido
  tipoMedicao: number | null;
  dias: { dia: number; valor: number | null; status: number | null }[];
};

/** HidroSerieHistorica com tipoDados=2 (chuvas). Retorna um registro por mês/nível de consistência. */
export async function anaSerieHistoricaChuva(codigo: string, inicio: string, fim: string): Promise<MesHistorico[]> {
  const xml = await anaGet(
    "HidroSerieHistorica",
    {
      codEstacao: codigo,
      dataInicio: isoToBR(inicio),
      dataFim: isoToBR(fim),
      tipoDados: "2",
      nivelConsistencia: "",
    },
    120_000,
  );
  const linhas = lerLinhas(xml, "SerieHistorica");
  if (!linhas.length) {
    const erro = extrairErro(xml);
    if (erro && !ehSemDados(erro)) throw new ServicoExternoError(`ANA: ${erro}`);
    return [];
  }
  const meses: MesHistorico[] = [];
  for (const l of linhas) {
    const dh = l.DataHora ?? "";
    const ano = Number(dh.slice(0, 4));
    const mes = Number(dh.slice(5, 7));
    if (!ano || !mes) continue;
    const dias: MesHistorico["dias"] = [];
    for (let d = 1; d <= diasNoMes(ano, mes); d++) {
      const dd = String(d).padStart(2, "0");
      const valor = paraNumero(l[`Chuva${dd}`]);
      dias.push({ dia: d, valor: valor !== null && valor < 0 ? null : valor, status: paraInteiro(l[`Chuva${dd}Status`]) });
    }
    meses.push({
      ano,
      mes,
      consistencia: paraInteiro(l.NivelConsistencia) ?? 1,
      tipoMedicao: paraInteiro(l.TipoMedicaoChuvas),
      dias,
    });
  }
  return meses.sort((a, b) => a.ano - b.ano || a.mes - b.mes || a.consistencia - b.consistencia);
}

/* ------------------------------ Telemetria ----------------------------- */

async function anaTelemetriaTrecho(codigo: string, inicio: string, fim: string): Promise<LeituraTelemetrica[]> {
  const xml = await anaGet(
    "DadosHidrometeorologicos",
    { codEstacao: codigo, dataInicio: isoToBR(inicio), dataFim: isoToBR(fim) },
    90_000,
  );
  const linhas = lerLinhas(xml, "DadosHidrometereologicos");
  if (!linhas.length) {
    const erro = extrairErro(xml);
    if (erro && !ehSemDados(erro)) throw new ServicoExternoError(`ANA: ${erro}`);
    return [];
  }
  const leituras: LeituraTelemetrica[] = [];
  for (const l of linhas) {
    const dataHora = (l.DataHora ?? "").trim().replace("T", " ").slice(0, 16);
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dataHora)) continue;
    const chuva = paraNumero(l.Chuva);
    leituras.push({
      dataHora,
      chuva: chuva !== null && chuva < 0 ? null : chuva,
      nivel: paraNumero(l.Nivel),
      vazao: paraNumero(l.Vazao),
    });
  }
  return leituras;
}

/** Dados telemétricos (15 min). Divide o período em blocos de 31 dias para não sobrecarregar a API. */
export async function anaTelemetria(codigo: string, inicio: string, fim: string): Promise<LeituraTelemetrica[]> {
  const trechos: [string, string][] = [];
  for (let atual = inicio; atual <= fim; ) {
    const ate = minISO(addDays(atual, 30), fim);
    trechos.push([atual, ate]);
    atual = addDays(ate, 1);
  }
  const partes = await mapLimit(trechos, 3, ([a, b]) => anaTelemetriaTrecho(codigo, a, b));
  const porDataHora = new Map<string, LeituraTelemetrica>();
  for (const parte of partes) for (const l of parte) porDataHora.set(l.dataHora, l);
  return [...porDataHora.values()].sort((a, b) => a.dataHora.localeCompare(b.dataHora));
}
