"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmt, montarUrl } from "@/lib/cliente";
import { addDays, addYears, diffDays, formatarDataHora, hojeISO, MESES } from "@/lib/dates";
import type {
  CsvFormato,
  Estacao,
  Granularidade,
  TemperaturaDiaria,
  TemperaturaHoraria,
  TemperaturaResposta,
} from "@/lib/types";
import { GraficoLinhas } from "./Graficos";
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

const colunasDiarias: Coluna<TemperaturaDiaria>[] = [
  { titulo: "Data", render: (d) => formatarDataHora(d.data) },
  { titulo: "Máx. (°C)", alinhar: "dir", render: (d) => fmt(d.tmax) },
  { titulo: "Mín. (°C)", alinhar: "dir", render: (d) => fmt(d.tmin) },
  { titulo: "Média (°C)", alinhar: "dir", render: (d) => fmt(d.tmedia) },
  { titulo: "Precipitação ERA5 (mm)", alinhar: "dir", render: (d) => fmt(d.precipitacao) },
];

const colunasHorarias: Coluna<TemperaturaHoraria>[] = [
  { titulo: "Data/hora", render: (h) => formatarDataHora(h.dataHora) },
  { titulo: "Temperatura (°C)", alinhar: "dir", render: (h) => fmt(h.temperatura) },
  { titulo: "Umidade relativa (%)", alinhar: "dir", render: (h) => fmt(h.umidade, 0) },
];

type Serie = { rotulos: string[]; tmax: (number | null)[]; tmin: (number | null)[]; tmedia: (number | null)[]; nota: string };

function mediaDe(vs: (number | null)[]): number | null {
  const ok = vs.filter((v): v is number => v !== null);
  return ok.length ? Math.round((ok.reduce((a, b) => a + b, 0) / ok.length) * 10) / 10 : null;
}

function montarSerie(dados: TemperaturaResposta): Serie {
  if (dados.granularidade === "horaria") {
    if (dados.horarios.length <= 1500) {
      const vals = dados.horarios.map((h) => h.temperatura);
      return {
        rotulos: dados.horarios.map((h) => `${h.dataHora.slice(8, 10)}/${h.dataHora.slice(5, 7)} ${h.dataHora.slice(11, 16)}`),
        tmax: [],
        tmin: [],
        tmedia: vals,
        nota: "",
      };
    }
    const porDia = new Map<string, (number | null)[]>();
    for (const h of dados.horarios) {
      const k = h.dataHora.slice(0, 10);
      porDia.set(k, [...(porDia.get(k) ?? []), h.temperatura]);
    }
    const dias = [...porDia.entries()];
    return {
      rotulos: dias.map(([d]) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`),
      tmax: dias.map(([, v]) => {
        const ok = v.filter((x): x is number => x !== null);
        return ok.length ? Math.max(...ok) : null;
      }),
      tmin: dias.map(([, v]) => {
        const ok = v.filter((x): x is number => x !== null);
        return ok.length ? Math.min(...ok) : null;
      }),
      tmedia: dias.map(([, v]) => mediaDe(v)),
      nota: " (agrupado por dia no gráfico)",
    };
  }
  if (dados.diarios.length <= 1100) {
    return {
      rotulos: dados.diarios.map((d) => `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}/${d.data.slice(2, 4)}`),
      tmax: dados.diarios.map((d) => d.tmax),
      tmin: dados.diarios.map((d) => d.tmin),
      tmedia: dados.diarios.map((d) => d.tmedia),
      nota: "",
    };
  }
  const porMes = new Map<string, TemperaturaDiaria[]>();
  for (const d of dados.diarios) {
    const k = d.data.slice(0, 7);
    const g = porMes.get(k);
    if (g) g.push(d);
    else porMes.set(k, [d]);
  }
  const meses = [...porMes.entries()];
  return {
    rotulos: meses.map(([k]) => `${MESES[Number(k.slice(5, 7)) - 1]}/${k.slice(2, 4)}`),
    tmax: meses.map(([, ds]) => mediaDe(ds.map((d) => d.tmax))),
    tmin: meses.map(([, ds]) => mediaDe(ds.map((d) => d.tmin))),
    tmedia: meses.map(([, ds]) => mediaDe(ds.map((d) => d.tmedia))),
    nota: " (médias mensais no gráfico)",
  };
}

export function AbaTemperatura({
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
  const [inicio, setInicio] = useState(() => addYears(hoje, -5));
  const [fim, setFim] = useState(hoje);
  const [granularidade, setGranularidade] = useState<Granularidade>("diaria");
  const { dados, carregando, erro, executar } = useConsulta<TemperaturaResposta>();

  const consultar = useCallback(async () => {
    if (!estacao) return;
    const r = await executar(montarUrl("/api/temperatura", { estacao: estacao.codigo, inicio, fim, granularidade }));
    if (r) onAtividade();
  }, [estacao, inicio, fim, granularidade, executar, onAtividade]);

  const ultimaEstacao = useRef<string | null>(null);
  useEffect(() => {
    if (!ativa || !estacao || ultimaEstacao.current === estacao.codigo) return;
    ultimaEstacao.current = estacao.codigo;
    void consultar();
  }, [ativa, estacao, consultar]);

  const serie = useMemo(() => (dados ? montarSerie(dados) : null), [dados]);
  const linhasDiarias = useMemo(() => (dados ? [...dados.diarios].reverse() : []), [dados]);
  const linhasHorarias = useMemo(() => (dados ? [...dados.horarios].reverse() : []), [dados]);

  const periodoLongoHorario = granularidade === "horaria" && diffDays(inicio, fim) > 365;

  return (
    <div className={ativa ? "space-y-4" : "hidden"}>
      <Cartao>
        <TituloSecao
          titulo="Temperatura histórica"
          subtitulo="Série diária (máxima, mínima e média) desde 1940 ou horária (até 366 dias) nas coordenadas da estação selecionada."
        />
        <div className="flex flex-wrap items-start gap-4">
          <PeriodoSelector
            inicio={inicio}
            fim={fim}
            min="1940-01-01"
            max={hoje}
            presets={[
              { rotulo: "30 dias", dias: 30 },
              { rotulo: "1 ano", anos: 1 },
              { rotulo: "5 anos", anos: 5 },
              { rotulo: "10 anos", anos: 10 },
              { rotulo: "30 anos", anos: 30 },
              { rotulo: "Desde 1940", inicioFixo: "1940-01-01" },
            ]}
            onChange={(i, f) => {
              setInicio(i);
              setFim(f);
            }}
          />
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Granularidade
            <select
              className={campo}
              value={granularidade}
              onChange={(e) => {
                const g = e.target.value as Granularidade;
                setGranularidade(g);
                if (g === "horaria" && diffDays(inicio, fim) > 365) setInicio(addDays(fim, -29));
              }}
            >
              <option value="diaria">Diária (máx/mín/média)</option>
              <option value="horaria">Horária (até 366 dias)</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={botaoPrimario}
            onClick={() => void consultar()}
            disabled={!estacao || carregando || periodoLongoHorario}
          >
            {carregando ? "Consultando…" : "Consultar temperatura"}
          </button>
        </div>
        <PainelExportacao
          estacao={estacao}
          marcadas={marcadas}
          formato={formato}
          inicio={inicio}
          fim={fim}
          parametros={`Granularidade: ${granularidade === "diaria" ? "diária (máx/mín/média)" : "horária"} · Fonte: Open-Meteo/ERA5 nas coordenadas da estação`}
          opcoes={[
            {
              chave: "temperatura",
              rotulo: "Baixar CSV de temperatura",
              descricao:
                granularidade === "diaria"
                  ? "Temperatura máxima, mínima e média por dia (+ precipitação ERA5)"
                  : "Temperatura e umidade relativa por hora",
            },
          ]}
          montarUrl={(_, codigos) =>
            montarUrl("/api/exportar", { tipo: "temperatura", estacoes: codigos.join(","), inicio, fim, granularidade, formato })
          }
          bloqueio={periodoLongoHorario ? "A série horária aceita no máximo 366 dias. Reduza o intervalo para exportar." : null}
          onAtividade={onAtividade}
        />
      </Cartao>

      <Alerta tipo="info">
        A API pública da ANA não disponibiliza séries de temperatura. Por isso os dados de temperatura vêm do{" "}
        <strong>Open-Meteo</strong> (reanálise ERA5/ERA5-Land – Copernicus/ECMWF, grade de ~9 a 25 km), nas coordenadas da
        estação selecionada
        {estacao ? ` (${estacao.latitude.toFixed(4)}, ${estacao.longitude.toFixed(4)})` : ""}.
      </Alerta>

      {carregando ? <Carregando texto="Consultando dados históricos de temperatura…" /> : null}
      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}

      {dados && serie ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Indicador rotulo="Temperatura média" valor={`${fmt(dados.resumo.media)} °C`} detalhe={`${dados.resumo.registros.toLocaleString("pt-BR")} registros`} />
            <Indicador
              rotulo="Máxima absoluta"
              valor={`${fmt(dados.resumo.maxAbs)} °C`}
              detalhe={formatarDataHora(dados.resumo.dataMaxAbs)}
              destaque="rose"
            />
            <Indicador
              rotulo="Mínima absoluta"
              valor={`${fmt(dados.resumo.minAbs)} °C`}
              detalhe={formatarDataHora(dados.resumo.dataMinAbs)}
              destaque="violet"
            />
            <Indicador rotulo="Média das máximas" valor={`${fmt(dados.resumo.mediaMax)} °C`} destaque="amber" />
            <Indicador rotulo="Média das mínimas" valor={`${fmt(dados.resumo.mediaMin)} °C`} destaque="sky" />
          </div>

          {dados.aviso ? <Alerta tipo="aviso">{dados.aviso}</Alerta> : null}

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Cartao>
              <TituloSecao
                titulo={`Temperatura (°C)${serie.nota}`}
                subtitulo={`${dados.estacao.nome} (${dados.estacao.codigo}) · ${formatarDataHora(dados.inicio)} a ${formatarDataHora(dados.fim)}`}
              />
              <GraficoLinhas
                rotulos={serie.rotulos}
                series={
                  serie.tmax.length
                    ? [
                        { nome: "Máxima", cor: "#e11d48", valores: serie.tmax },
                        { nome: "Média", cor: "#f59e0b", valores: serie.tmedia },
                        { nome: "Mínima", cor: "#2563eb", valores: serie.tmin },
                      ]
                    : [{ nome: "Temperatura", cor: "#f59e0b", valores: serie.tmedia }]
                }
              />
            </Cartao>
            <Cartao>
              <TituloSecao titulo="Média por mês do ano (°C)" subtitulo="Climatologia do período consultado" />
              <GraficoLinhas
                rotulos={dados.climatologia.map((c) => MESES[c.mes - 1])}
                series={[
                  { nome: "Máx.", cor: "#e11d48", valores: dados.climatologia.map((c) => c.tmax) },
                  { nome: "Média", cor: "#f59e0b", valores: dados.climatologia.map((c) => c.tmedia) },
                  { nome: "Mín.", cor: "#2563eb", valores: dados.climatologia.map((c) => c.tmin) },
                ]}
                altura={280}
              />
            </Cartao>
          </div>

          <Cartao>
            <TituloSecao titulo="Tabela de temperatura" subtitulo="Mais recentes primeiro" />
            {dados.granularidade === "diaria" ? (
              <TabelaPaginada linhas={linhasDiarias} colunas={colunasDiarias} chave={(d) => d.data} porPagina={31} />
            ) : (
              <TabelaPaginada linhas={linhasHorarias} colunas={colunasHorarias} chave={(h) => h.dataHora} porPagina={24} />
            )}
            <p className="mt-3 text-xs text-slate-500">
              Fonte: {dados.fonte} (grade: {dados.coordenadas.latitude.toFixed(3)}, {dados.coordenadas.longitude.toFixed(3)}
              {dados.coordenadas.elevacao !== null ? `, elevação ${fmt(dados.coordenadas.elevacao, 0)} m` : ""})
              {dados.doCache ? " · resposta servida do cache local" : ""}.
            </p>
          </Cartao>
        </>
      ) : null}
    </div>
  );
}
