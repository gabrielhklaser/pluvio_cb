"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmt, fmtInt, montarUrl } from "@/lib/cliente";
import { addYears, formatarDataHora, hojeISO, MESES } from "@/lib/dates";
import type {
  ChuvaAnual,
  ChuvaDiaria,
  ChuvaMensal,
  Consistencia,
  CsvFormato,
  Estacao,
  FonteHistorico,
  HistoricoResposta,
} from "@/lib/types";
import { GraficoBarras } from "./Graficos";
import { useConsulta } from "./hooks";
import { PainelExportacao } from "./PainelExportacao";
import { PeriodoSelector } from "./PeriodoSelector";
import { TabelaPaginada, type Coluna } from "./TabelaPaginada";
import {
  Alerta,
  botaoPrimario,
  campo,
  Carregando,
  Cartao,
  Indicador,
  TituloSecao,
} from "./ui";

const STATUS: Record<number, string> = { 0: "Branco", 1: "Real", 2: "Estimado", 3: "Duvidoso", 4: "Acumulado" };
const CONS: Record<number, string> = { 1: "Bruto", 2: "Consistido" };
const ROTULO_CONSISTENCIA: Record<Consistencia, string> = {
  preferir_consistido: "preferir consistido (senão bruto)",
  consistido: "somente consistido",
  bruto: "somente bruto",
};
const ROTULO_FONTE: Record<FonteHistorico, string> = {
  auto: "automática (convencional → telemetria)",
  convencional: "somente série convencional",
  telemetria: "telemetria agregada por dia",
};

const colunasAnuais: Coluna<ChuvaAnual>[] = [
  { titulo: "Ano", render: (a) => a.ano },
  { titulo: "Total (mm)", alinhar: "dir", render: (a) => fmt(a.total) },
  { titulo: "Máx. diária (mm)", alinhar: "dir", render: (a) => fmt(a.maxima) },
  { titulo: "Data da máx.", render: (a) => formatarDataHora(a.dataMaxima) },
  { titulo: "Dias de chuva", alinhar: "dir", render: (a) => fmtInt(a.diasDeChuva) },
  { titulo: "Dias com dado", alinhar: "dir", render: (a) => `${a.diasComDado}/${a.diasNoPeriodo}` },
];

const colunasMensais: Coluna<ChuvaMensal>[] = [
  { titulo: "Mês", render: (m) => `${MESES[m.mes - 1]}/${m.ano}` },
  { titulo: "Total (mm)", alinhar: "dir", render: (m) => fmt(m.total) },
  { titulo: "Máx. diária (mm)", alinhar: "dir", render: (m) => fmt(m.maxima) },
  { titulo: "Dia da máx.", alinhar: "dir", render: (m) => m.diaMaxima ?? "—" },
  { titulo: "Dias de chuva", alinhar: "dir", render: (m) => fmtInt(m.diasDeChuva) },
  { titulo: "Dias com dado", alinhar: "dir", render: (m) => `${m.diasComDado}/${m.diasNoPeriodo}` },
  { titulo: "Consistência", render: (m) => (m.consistencia ? CONS[m.consistencia] : "—") },
];

const colunasDiarias: Coluna<ChuvaDiaria>[] = [
  { titulo: "Data", render: (d) => formatarDataHora(d.data) },
  { titulo: "Chuva (mm)", alinhar: "dir", render: (d) => (d.chuva === null ? <span className="text-rose-400">sem dado</span> : fmt(d.chuva)) },
  { titulo: "Status", render: (d) => (d.status === null ? "—" : `${d.status} – ${STATUS[d.status] ?? "?"}`) },
  { titulo: "Consistência", render: (d) => (d.consistencia ? CONS[d.consistencia] : "—") },
];

export function AbaHistorico({
  ativa,
  estacao,
  estacoes,
  marcadas,
  formato,
  onAtividade,
  onSelecionarEstacao,
}: {
  ativa: boolean;
  estacao: Estacao | null;
  estacoes: Estacao[];
  marcadas: Estacao[];
  formato: CsvFormato;
  onAtividade: () => void;
  onSelecionarEstacao: (e: Estacao) => void;
}) {
  const hoje = hojeISO();
  const [inicio, setInicio] = useState(() => addYears(hoje, -10));
  const [fim, setFim] = useState(hoje);
  const [consistencia, setConsistencia] = useState<Consistencia>("preferir_consistido");
  const [fonte, setFonte] = useState<FonteHistorico>("auto");
  const [visao, setVisao] = useState<"anual" | "mensal" | "diaria">("anual");
  const { dados, carregando, erro, executar } = useConsulta<HistoricoResposta>();

  const consultar = useCallback(async () => {
    if (!estacao) return;
    const r = await executar(
      montarUrl("/api/chuva/historico", { estacao: estacao.codigo, inicio, fim, consistencia, fonte }),
    );
    if (r) onAtividade();
  }, [estacao, inicio, fim, consistencia, fonte, executar, onAtividade]);

  const ultimaEstacao = useRef<string | null>(null);
  useEffect(() => {
    if (!ativa || !estacao || ultimaEstacao.current === estacao.codigo) return;
    ultimaEstacao.current = estacao.codigo;
    void consultar();
  }, [ativa, estacao, consultar]);

  const grafico = useMemo(() => {
    if (!dados) return null;
    if (dados.mensais.length > 180) {
      return {
        titulo: "Total anual de chuva (mm)",
        pontos: dados.anuais.map((a) => ({ rotulo: String(a.ano), valor: a.total })),
      };
    }
    return {
      titulo: "Total mensal de chuva (mm)",
      pontos: dados.mensais.map((m) => ({ rotulo: `${MESES[m.mes - 1]}/${String(m.ano).slice(2)}`, valor: m.total })),
    };
  }, [dados]);

  const tabelas = useMemo(
    () => ({
      anual: dados ? [...dados.anuais].reverse() : [],
      mensal: dados ? [...dados.mensais].reverse() : [],
      diaria: dados ? [...dados.diarios].reverse() : [],
    }),
    [dados],
  );

  const sugestoes = useMemo(
    () => estacoes.filter((e) => (e.pluviometro || e.periodoInicio) && e.codigo !== estacao?.codigo).slice(0, 8),
    [estacoes, estacao],
  );

  const semDados = dados && !dados.diarios.length;

  return (
    <div className={ativa ? "space-y-4" : "hidden"}>
      <Cartao>
        <TituloSecao
          titulo="Série histórica de chuva – HidroWeb/ANA"
          subtitulo="Totais diários das estações convencionais (HidroSerieHistorica). Defina o intervalo de datas ou de anos para determinar os dados históricos."
        />
        <PeriodoSelector
          inicio={inicio}
          fim={fim}
          min="1900-01-01"
          max={hoje}
          presets={[
            { rotulo: "Último ano", anos: 1 },
            { rotulo: "5 anos", anos: 5 },
            { rotulo: "10 anos", anos: 10 },
            { rotulo: "20 anos", anos: 20 },
            { rotulo: "30 anos", anos: 30 },
            { rotulo: "Todo o período", inicioFixo: estacao?.periodoInicio ?? "1900-01-01" },
          ]}
          onChange={(i, f) => {
            setInicio(i);
            setFim(f);
          }}
        />
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Nível de consistência
            <select className={campo} value={consistencia} onChange={(e) => setConsistencia(e.target.value as Consistencia)}>
              <option value="preferir_consistido">Preferir consistido (senão bruto)</option>
              <option value="consistido">Somente consistido</option>
              <option value="bruto">Somente bruto</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Fonte dos dados
            <select className={campo} value={fonte} onChange={(e) => setFonte(e.target.value as FonteHistorico)}>
              <option value="auto">Automática (convencional → telemetria)</option>
              <option value="convencional">Somente série convencional</option>
              <option value="telemetria">Telemetria agregada por dia (até 2 anos)</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={botaoPrimario} onClick={() => void consultar()} disabled={!estacao || carregando}>
            {carregando ? "Consultando…" : "Consultar série histórica"}
          </button>
        </div>
        <PainelExportacao
          estacao={estacao}
          marcadas={marcadas}
          formato={formato}
          inicio={inicio}
          fim={fim}
          parametros={`Consistência: ${ROTULO_CONSISTENCIA[consistencia]} · Fonte: ${ROTULO_FONTE[fonte]}`}
          opcoes={[
            { chave: "historico_diario", rotulo: "CSV diário", descricao: "Chuva histórica – um registro por dia (mm, status e consistência)" },
            { chave: "historico_mensal", rotulo: "CSV mensal", descricao: "Chuva histórica – totais mensais, máxima diária e dias de chuva" },
            { chave: "historico_anual", rotulo: "CSV anual", descricao: "Chuva histórica – totais anuais, máxima diária e dias de chuva" },
          ]}
          montarUrl={(tipo, codigos) =>
            montarUrl("/api/exportar", { tipo, estacoes: codigos.join(","), inicio, fim, consistencia, fonte, formato })
          }
          onAtividade={onAtividade}
        />
      </Cartao>

      {carregando ? <Carregando texto="Consultando a série histórica na ANA…" /> : null}
      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}

      {dados?.aviso ? <Alerta tipo="aviso">{dados.aviso}</Alerta> : null}

      {semDados && sugestoes.length ? (
        <Cartao>
          <TituloSecao
            titulo="Estações próximas com série convencional"
            subtitulo="Clique para selecionar e consultar a série histórica"
          />
          <div className="flex flex-wrap gap-2">
            {sugestoes.map((e) => (
              <button
                key={e.codigo}
                type="button"
                onClick={() => onSelecionarEstacao(e)}
                className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-left text-xs text-sky-900 hover:border-sky-400"
              >
                <div className="font-semibold">{e.nome}</div>
                <div className="text-sky-700">
                  {e.codigo} · {fmt(e.distanciaKm)} km · {e.periodoInicio?.slice(0, 4) ?? "?"}–{e.periodoFim?.slice(0, 4) ?? "atual"}
                </div>
              </button>
            ))}
          </div>
        </Cartao>
      ) : null}

      {dados && !semDados && grafico ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Indicador
              rotulo="Total no período"
              valor={`${fmt(dados.resumo.totalPeriodo, 0)} mm`}
              detalhe={`${formatarDataHora(dados.resumo.primeiraData)} a ${formatarDataHora(dados.resumo.ultimaData)}`}
            />
            <Indicador
              rotulo="Média anual"
              valor={`${fmt(dados.resumo.mediaAnual, 0)} mm`}
              detalhe={dados.resumo.anosCompletos ? `${dados.resumo.anosCompletos} anos completos` : "estimada pelos dias com dado"}
              destaque="emerald"
            />
            <Indicador
              rotulo="Máxima diária"
              valor={`${fmt(dados.resumo.maxDiaria)} mm`}
              detalhe={formatarDataHora(dados.resumo.dataMaxDiaria)}
              destaque="violet"
            />
            <Indicador
              rotulo="Dias de chuva"
              valor={fmtInt(dados.resumo.diasDeChuva)}
              detalhe={`de ${fmtInt(dados.resumo.diasComDado)} dias com dado`}
              destaque="amber"
            />
            <Indicador
              rotulo="Falhas"
              valor={`${fmt(dados.resumo.percentualFalhas)}%`}
              detalhe={`${fmtInt(dados.resumo.diasNoPeriodo - dados.resumo.diasComDado)} dias sem dado`}
              destaque="rose"
            />
          </div>

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Cartao>
              <TituloSecao
                titulo={grafico.titulo}
                subtitulo={`${dados.estacao.nome} (${dados.estacao.codigo}) · fonte: ${
                  dados.fonteUsada === "telemetria" ? "telemetria agregada" : "série convencional"
                } · traços vermelhos = sem dado`}
              />
              <GraficoBarras dados={grafico.pontos} />
            </Cartao>
            <Cartao>
              <TituloSecao titulo="Média por mês do ano (mm)" subtitulo="Somente meses completos do período" />
              <GraficoBarras
                dados={dados.climatologia.map((c) => ({ rotulo: MESES[c.mes - 1], valor: c.media }))}
                cor="#0891b2"
                altura={260}
              />
            </Cartao>
          </div>

          <Cartao>
            <TituloSecao
              titulo="Tabela da série"
              subtitulo="Mais recentes primeiro"
              acoes={
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-xs">
                  {(["anual", "mensal", "diaria"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVisao(v)}
                      className={`rounded-lg px-3 py-1.5 font-medium ${visao === v ? "bg-white text-sky-800 shadow-sm" : "text-slate-600"}`}
                    >
                      {v === "anual" ? "Anual" : v === "mensal" ? "Mensal" : "Diária"}
                    </button>
                  ))}
                </div>
              }
            />
            {visao === "anual" ? (
              <TabelaPaginada linhas={tabelas.anual} colunas={colunasAnuais} chave={(a) => String(a.ano)} />
            ) : visao === "mensal" ? (
              <TabelaPaginada linhas={tabelas.mensal} colunas={colunasMensais} chave={(m) => `${m.ano}-${m.mes}`} />
            ) : (
              <TabelaPaginada linhas={tabelas.diaria} colunas={colunasDiarias} chave={(d) => d.data} porPagina={31} />
            )}
            <p className="mt-3 text-xs text-slate-500">
              Fonte: {dados.fonte}
              {dados.doCache ? " · resposta servida do cache local" : ""}. Status ANA: 0 Branco, 1 Real, 2 Estimado, 3
              Duvidoso, 4 Acumulado.
            </p>
          </Cartao>
        </>
      ) : null}
    </div>
  );
}
