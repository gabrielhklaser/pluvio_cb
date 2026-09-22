"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmt, fmtInt, montarUrl } from "@/lib/cliente";
import { addDays, formatarDataHora, hojeISO } from "@/lib/dates";
import type { Agregacao, CsvFormato, Estacao, TelemetriaRegistro, TelemetriaResposta } from "@/lib/types";
import { GraficoBarras, GraficoLinhas } from "./Graficos";
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

const ROTULO: Record<Agregacao, string> = { "15min": "intervalo de 15 min", hora: "hora", dia: "dia" };
const ROTULO_AGREGACAO: Record<Agregacao, string> = { "15min": "15 minutos (bruto)", hora: "horária", dia: "diária" };

function rotuloCurto(periodo: string): string {
  const d = periodo.slice(8, 10);
  const m = periodo.slice(5, 7);
  return periodo.length > 10 ? `${d}/${m} ${periodo.slice(11, 16)}` : `${d}/${m}/${periodo.slice(2, 4)}`;
}

/** Reduz a série para o gráfico quando há pontos demais (agrupa por dia). */
function paraGrafico(registros: TelemetriaRegistro[]): { rotulo: string; registros: TelemetriaRegistro[] } {
  if (registros.length <= 1500) return { rotulo: "", registros };
  const grupos = new Map<string, { chuva: number; n: number; nivel: number; nn: number }>();
  for (const r of registros) {
    const k = r.periodo.slice(0, 10);
    const g = grupos.get(k) ?? { chuva: 0, n: 0, nivel: 0, nn: 0 };
    if (r.chuva !== null) {
      g.chuva += r.chuva;
      g.n++;
    }
    if (r.nivelMedio !== null) {
      g.nivel += r.nivelMedio;
      g.nn++;
    }
    grupos.set(k, g);
  }
  return {
    rotulo: " (agrupado por dia no gráfico)",
    registros: [...grupos.entries()].map(([periodo, g]) => ({
      periodo,
      chuva: g.n ? Math.round(g.chuva * 100) / 100 : null,
      nivelMedio: g.nn ? g.nivel / g.nn : null,
      nivelMax: null,
      vazaoMedia: null,
      leituras: g.n,
    })),
  };
}

export function AbaTelemetria({
  ativa,
  estacao,
  marcadas,
  formato,
  onAtividade,
}: {
  ativa: boolean;
  estacao: Estacao | null;
  marcadas: Estacao[];
  formato: CsvFormato;
  onAtividade: () => void;
}) {
  const hoje = hojeISO();
  const [inicio, setInicio] = useState(() => addDays(hoje, -6));
  const [fim, setFim] = useState(hoje);
  const [agregacao, setAgregacao] = useState<Agregacao>("hora");
  const { dados, carregando, erro, executar } = useConsulta<TelemetriaResposta>();

  const consultar = useCallback(async () => {
    if (!estacao) return;
    const r = await executar(montarUrl("/api/chuva/telemetria", { estacao: estacao.codigo, inicio, fim, agregacao }));
    if (r) onAtividade();
  }, [estacao, inicio, fim, agregacao, executar, onAtividade]);

  const ultimaEstacao = useRef<string | null>(null);
  useEffect(() => {
    if (!ativa || !estacao || ultimaEstacao.current === estacao.codigo) return;
    ultimaEstacao.current = estacao.codigo;
    if (estacao.telemetrica) void consultar();
  }, [ativa, estacao, consultar]);

  const grafico = useMemo(() => (dados ? paraGrafico(dados.registros) : null), [dados]);
  const temNivel = useMemo(() => !!dados?.registros.some((r) => r.nivelMedio !== null), [dados]);
  const linhasTabela = useMemo(() => (dados ? [...dados.registros].reverse() : []), [dados]);

  const agregado = dados?.agregacao !== "15min";
  const colunas: Coluna<TelemetriaRegistro>[] = [
    { titulo: dados?.agregacao === "dia" ? "Data" : "Data/hora", render: (r) => formatarDataHora(r.periodo) },
    { titulo: "Chuva (mm)", alinhar: "dir", render: (r) => fmt(r.chuva, dados?.agregacao === "15min" ? 2 : 1) },
    { titulo: agregado ? "Nível médio (cm)" : "Nível (cm)", alinhar: "dir", render: (r) => fmt(r.nivelMedio, 0) },
    ...(agregado ? [{ titulo: "Nível máx. (cm)", alinhar: "dir" as const, render: (r: TelemetriaRegistro) => fmt(r.nivelMax, 0) }] : []),
    { titulo: agregado ? "Vazão média (m³/s)" : "Vazão (m³/s)", alinhar: "dir", render: (r) => fmt(r.vazaoMedia, 2) },
    ...(agregado ? [{ titulo: "Leituras", alinhar: "dir" as const, render: (r: TelemetriaRegistro) => fmtInt(r.leituras) }] : []),
  ];

  const ultima = dados?.resumo.ultimaLeitura ?? null;

  return (
    <div className={ativa ? "space-y-4" : "hidden"}>
      <Cartao>
        <TituloSecao
          titulo="Dados pluviométricos recentes – telemetria ANA"
          subtitulo="Leituras automáticas a cada 15 minutos: chuva (mm), nível (cm) e vazão (m³/s). Até 366 dias por consulta."
        />
        <div className="flex flex-wrap items-end gap-4">
          <PeriodoSelector
            inicio={inicio}
            fim={fim}
            min="2000-01-01"
            max={hoje}
            mostrarAnos={false}
            presets={[
              { rotulo: "Ontem e hoje", dias: 2 },
              { rotulo: "7 dias", dias: 7 },
              { rotulo: "30 dias", dias: 30 },
              { rotulo: "90 dias", dias: 90 },
              { rotulo: "1 ano", dias: 366 },
            ]}
            onChange={(i, f) => {
              setInicio(i);
              setFim(f);
            }}
          />
          <label className="flex flex-col gap-1 self-start text-xs font-medium text-slate-600">
            Agregação
            <select className={campo} value={agregacao} onChange={(e) => setAgregacao(e.target.value as Agregacao)}>
              <option value="15min">15 minutos (bruto)</option>
              <option value="hora">Horária</option>
              <option value="dia">Diária</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={botaoPrimario} onClick={() => void consultar()} disabled={!estacao || carregando}>
            {carregando ? "Consultando…" : "Consultar"}
          </button>
        </div>
        <PainelExportacao
          estacao={estacao}
          marcadas={marcadas}
          formato={formato}
          inicio={inicio}
          fim={fim}
          parametros={`Agregação: ${ROTULO_AGREGACAO[agregacao]}`}
          opcoes={[
            {
              chave: "telemetria",
              rotulo: "Exportar CSV de chuva (telemetria)",
              descricao: `Chuva, nível e vazão da telemetria – ${ROTULO_AGREGACAO[agregacao]}`,
            },
          ]}
          montarUrl={(_, codigos) =>
            montarUrl("/api/exportar", { tipo: "telemetria", estacoes: codigos.join(","), inicio, fim, agregacao, formato })
          }
          onAtividade={onAtividade}
        />
      </Cartao>

      {estacao && !estacao.telemetrica && !dados && !carregando ? (
        <Alerta tipo="aviso">
          A estação <strong>{estacao.nome}</strong> não é telemétrica. Para ela, use a aba <strong>Série histórica de chuva</strong>
          {" "}(dados convencionais), ou selecione uma estação com o selo “Telemétrica”.
        </Alerta>
      ) : null}
      {carregando ? <Carregando texto="Consultando a telemetria da ANA… períodos longos podem levar alguns segundos." /> : null}
      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}

      {dados && grafico ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador
              rotulo="Chuva acumulada"
              valor={`${fmt(dados.resumo.totalChuva)} mm`}
              detalhe={`${formatarDataHora(dados.inicio)} a ${formatarDataHora(dados.fim)}`}
            />
            <Indicador
              rotulo={`Maior valor por ${ROTULO[dados.agregacao]}`}
              valor={`${fmt(dados.resumo.maxChuva)} mm`}
              detalhe={formatarDataHora(dados.resumo.maxChuvaPeriodo)}
              destaque="violet"
            />
            <Indicador
              rotulo="Períodos com chuva"
              valor={fmtInt(dados.resumo.periodosComChuva)}
              detalhe={`de ${fmtInt(dados.registros.length)} (${ROTULO[dados.agregacao]})`}
              destaque="emerald"
            />
            <Indicador
              rotulo="Última leitura"
              valor={<span className="text-lg">{formatarDataHora(ultima?.dataHora)}</span>}
              detalhe={
                ultima
                  ? `Chuva ${fmt(ultima.chuva, 2)} mm · Nível ${fmt(ultima.nivel, 0)} cm · Vazão ${fmt(ultima.vazao, 1)} m³/s`
                  : "—"
              }
              destaque="amber"
            />
          </div>

          {dados.aviso ? <Alerta tipo="aviso">{dados.aviso}</Alerta> : null}

          <Cartao>
            <TituloSecao
              titulo={`Chuva por ${grafico.rotulo ? "dia" : ROTULO[dados.agregacao]} (mm)${grafico.rotulo}`}
              subtitulo={`${dados.estacao.nome} (${dados.estacao.codigo}) · passe o mouse sobre as barras`}
            />
            <GraficoBarras
              dados={grafico.registros.map((r) => ({ rotulo: rotuloCurto(r.periodo), valor: r.chuva }))}
              casas={dados.agregacao === "15min" && !grafico.rotulo ? 2 : 1}
              vazio="Sem leituras telemétricas no período."
            />
          </Cartao>

          {temNivel ? (
            <Cartao>
              <TituloSecao titulo="Nível do rio (cm)" subtitulo="Média por período de agregação" />
              <GraficoLinhas
                rotulos={grafico.registros.map((r) => rotuloCurto(r.periodo))}
                series={[
                  {
                    nome: "Nível",
                    cor: "#7c3aed",
                    valores: grafico.registros.map((r) => (r.nivelMedio === null ? null : Math.round(r.nivelMedio))),
                  },
                ]}
                unidade="cm"
                casas={0}
                altura={220}
              />
            </Cartao>
          ) : null}

          <Cartao>
            <TituloSecao titulo="Tabela de leituras" subtitulo="Mais recentes primeiro · horário de Brasília" />
            <TabelaPaginada linhas={linhasTabela} colunas={colunas} chave={(r) => r.periodo} />
            <p className="mt-3 text-xs text-slate-500">
              Fonte: {dados.fonte}
              {dados.doCache ? " · resposta servida do cache local" : ""}. Dados telemétricos brutos (sem consistência).
            </p>
          </Cartao>
        </>
      ) : null}
    </div>
  );
}
