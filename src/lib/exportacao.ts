import { registrarConsulta } from "./consultas";
import { gerarCsv, nomeArquivoSeguro, type CelulaCsv } from "./csv";
import { HttpError, mensagemDeErro } from "./erros";
import {
  consultarHistorico,
  consultarTelemetria,
  consultarTemperatura,
  parseAgregacao,
  parseGranularidade,
} from "./servicos";
import type { CsvFormato, Estacao } from "./types";

export type TipoExportacao = "telemetria" | "historico_diario" | "historico_mensal" | "historico_anual" | "temperatura";

const TIPOS: TipoExportacao[] = ["telemetria", "historico_diario", "historico_mensal", "historico_anual", "temperatura"];

const STATUS_CHUVA: Record<number, string> = { 0: "Branco", 1: "Real", 2: "Estimado", 3: "Duvidoso", 4: "Acumulado" };
const CONSISTENCIA: Record<number, string> = { 1: "Bruto", 2: "Consistido" };

const ID_ESTACAO = ["codigo_estacao", "nome_estacao", "municipio"];
const id = (e: Estacao): CelulaCsv[] => [e.codigo, e.nome, e.municipio];

export type ResultadoExportacao = { csv: string; nomeArquivo: string; registros: number; avisos: string[] };

export async function gerarExportacao(sp: URLSearchParams): Promise<ResultadoExportacao> {
  const tipo = sp.get("tipo") as TipoExportacao;
  if (!TIPOS.includes(tipo)) throw new HttpError(`Tipo de exportação inválido. Use: ${TIPOS.join(", ")}.`);
  const formato: CsvFormato = sp.get("formato") === "padrao" ? "padrao" : "excel";
  const codigos = [
    ...new Set(
      (sp.get("estacoes") ?? sp.get("estacao") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  if (!codigos.length) throw new HttpError("Informe ao menos uma estação.");
  if (codigos.length > 20) throw new HttpError("Exporte no máximo 20 estações por vez.");

  const inicio = sp.get("inicio");
  const fim = sp.get("fim");
  const agregacao = parseAgregacao(sp.get("agregacao"));
  const granularidade = parseGranularidade(sp.get("granularidade"));

  let cabecalho: string[] = [];
  let prefixo = "";
  switch (tipo) {
    case "telemetria":
      prefixo = `chuva_telemetria_${agregacao}`;
      cabecalho =
        agregacao === "15min"
          ? [...ID_ESTACAO, "data_hora", "chuva_mm", "nivel_cm", "vazao_m3s"]
          : [
              ...ID_ESTACAO,
              agregacao === "hora" ? "hora" : "data",
              "chuva_mm",
              "nivel_medio_cm",
              "nivel_max_cm",
              "vazao_media_m3s",
              "leituras_15min",
            ];
      break;
    case "historico_diario":
      prefixo = "chuva_historica_diaria";
      cabecalho = [...ID_ESTACAO, "data", "chuva_mm", "status", "status_descricao", "nivel_consistencia", "fonte"];
      break;
    case "historico_mensal":
      prefixo = "chuva_historica_mensal";
      cabecalho = [
        ...ID_ESTACAO,
        "ano",
        "mes",
        "total_mm",
        "maxima_diaria_mm",
        "dia_maxima",
        "dias_de_chuva",
        "dias_com_dado",
        "dias_no_periodo",
        "nivel_consistencia",
      ];
      break;
    case "historico_anual":
      prefixo = "chuva_historica_anual";
      cabecalho = [
        ...ID_ESTACAO,
        "ano",
        "total_mm",
        "maxima_diaria_mm",
        "data_maxima",
        "dias_de_chuva",
        "dias_com_dado",
        "dias_no_periodo",
      ];
      break;
    case "temperatura":
      prefixo = `temperatura_${granularidade}`;
      cabecalho =
        granularidade === "diaria"
          ? [...ID_ESTACAO, "latitude", "longitude", "data", "temp_max_c", "temp_min_c", "temp_media_c", "precipitacao_era5_mm"]
          : [...ID_ESTACAO, "latitude", "longitude", "data_hora", "temperatura_c", "umidade_relativa_pct"];
      break;
  }

  const linhas: CelulaCsv[][] = [];
  const avisos: string[] = [];
  let periodo: { inicio: string; fim: string } | null = null;

  for (const codigo of codigos) {
    try {
      if (tipo === "telemetria") {
        const r = await consultarTelemetria({ codigo, inicio, fim, agregacao }, { registrar: false });
        periodo ??= { inicio: r.inicio, fim: r.fim };
        for (const reg of r.registros) {
          linhas.push(
            agregacao === "15min"
              ? [...id(r.estacao), reg.periodo, reg.chuva, reg.nivelMedio, reg.vazaoMedia]
              : [...id(r.estacao), reg.periodo, reg.chuva, reg.nivelMedio, reg.nivelMax, reg.vazaoMedia, reg.leituras],
          );
        }
        if (!r.registros.length) {
          if (codigos.length === 1) throw new HttpError(r.aviso ?? "Sem dados telemétricos no período informado.", 404);
          avisos.push(`${codigo}: ${r.aviso ?? "sem dados telemétricos no período"}`);
        }
      } else if (tipo === "temperatura") {
        const r = await consultarTemperatura({ codigo, inicio, fim, granularidade }, { registrar: false });
        periodo ??= { inicio: r.inicio, fim: r.fim };
        const e = r.estacao;
        if (!r.resumo.registros) {
          if (codigos.length === 1) throw new HttpError(r.aviso ?? "Sem dados de temperatura no período informado.", 404);
          avisos.push(`${codigo}: ${r.aviso ?? "sem dados de temperatura no período"}`);
        }
        if (granularidade === "diaria") {
          for (const d of r.diarios) {
            linhas.push([...id(e), e.latitude, e.longitude, d.data, d.tmax, d.tmin, d.tmedia, d.precipitacao]);
          }
        } else {
          for (const h of r.horarios) linhas.push([...id(e), e.latitude, e.longitude, h.dataHora, h.temperatura, h.umidade]);
        }
      } else {
        const r = await consultarHistorico(
          { codigo, inicio, fim, consistencia: sp.get("consistencia"), fonte: sp.get("fonte") },
          { registrar: false },
        );
        periodo ??= { inicio: r.inicio, fim: r.fim };
        const e = r.estacao;
        if (!r.diarios.length) {
          if (codigos.length === 1) throw new HttpError(r.aviso ?? "Sem dados de chuva no período informado.", 404);
          avisos.push(`${codigo}: ${r.aviso ?? "sem dados no período"}`);
        }
        if (tipo === "historico_diario") {
          for (const d of r.diarios) {
            linhas.push([
              ...id(e),
              d.data,
              d.chuva,
              d.status,
              d.status === null ? "" : (STATUS_CHUVA[d.status] ?? ""),
              d.consistencia === null ? "" : (CONSISTENCIA[d.consistencia] ?? String(d.consistencia)),
              r.fonteUsada ?? "",
            ]);
          }
        } else if (tipo === "historico_mensal") {
          for (const m of r.mensais) {
            linhas.push([
              ...id(e),
              m.ano,
              m.mes,
              m.total,
              m.maxima,
              m.diaMaxima,
              m.diasDeChuva,
              m.diasComDado,
              m.diasNoPeriodo,
              m.consistencia === null ? "" : (CONSISTENCIA[m.consistencia] ?? String(m.consistencia)),
            ]);
          }
        } else {
          for (const a of r.anuais) {
            linhas.push([...id(e), a.ano, a.total, a.maxima, a.dataMaxima, a.diasDeChuva, a.diasComDado, a.diasNoPeriodo]);
          }
        }
      }
    } catch (e) {
      if (codigos.length === 1) throw e;
      avisos.push(`${codigo}: ${mensagemDeErro(e)}`);
    }
  }

  if (!linhas.length || !periodo) {
    const motivos = avisos.length ? ` Detalhes: ${avisos.join(" | ")}` : "";
    throw new HttpError(
      codigos.length > 1
        ? `Nenhuma das ${codigos.length} estações selecionadas possui dados no período informado.${motivos}`
        : "Não há dados para exportar nesta estação e período.",
      404,
    );
  }

  const alvo = codigos.length === 1 ? codigos[0] : `${codigos.length}_estacoes`;
  const nomeArquivo = nomeArquivoSeguro(`${prefixo}_${alvo}_${periodo.inicio}_a_${periodo.fim}.csv`);

  await registrarConsulta({
    tipo,
    acao: "exportacao",
    estacoes: codigos.join(","),
    descricao: nomeArquivo,
    dataInicio: periodo.inicio,
    dataFim: periodo.fim,
    registros: linhas.length,
  });

  return { csv: gerarCsv(cabecalho, linhas, formato), nomeArquivo, registros: linhas.length, avisos };
}
