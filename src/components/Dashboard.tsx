"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buscarJson, fmt, mensagem } from "@/lib/cliente";
import { formatarDataHora } from "@/lib/dates";
import type { CsvFormato, Estacao, EstacoesResposta } from "@/lib/types";
import { AbaHistorico } from "./AbaHistorico";
import { AbaTelemetria } from "./AbaTelemetria";
import { AbaTemperatura } from "./AbaTemperatura";
import { ConsultasRecentes } from "./ConsultasRecentes";
import { EstacoesPainel, SelosEstacao } from "./EstacoesPainel";
import { Cartao } from "./ui";

type Aba = "telemetria" | "historico" | "temperatura";

const ABAS: { id: Aba; rotulo: string; icone: string }[] = [
  { id: "telemetria", rotulo: "Chuva recente (telemetria)", icone: "🌧️" },
  { id: "historico", rotulo: "Série histórica de chuva", icone: "📚" },
  { id: "temperatura", rotulo: "Temperatura histórica", icone: "🌡️" },
];

const MAX_MARCADAS = 20;

function CartaoEstacao({ estacao }: { estacao: Estacao }) {
  const itens: [string, string][] = [
    ["Código", estacao.codigo],
    ["Município", `${estacao.municipio ?? "—"}${estacao.uf ? `/${estacao.uf}` : ""}`],
    ["Responsável / operadora", `${estacao.responsavel ?? "—"} / ${estacao.operadora ?? "—"}`],
    ["Rio", estacao.rio ?? "—"],
    ["Coordenadas", `${estacao.latitude.toFixed(4)}, ${estacao.longitude.toFixed(4)}`],
    ["Altitude", estacao.altitude !== null ? `${fmt(estacao.altitude, 0)} m` : "—"],
    ["Distância de Campo Bom", `${fmt(estacao.distanciaKm)} km`],
    [
      "Pluviômetro (período)",
      estacao.periodoInicio
        ? `${formatarDataHora(estacao.periodoInicio)} – ${estacao.periodoFim ? formatarDataHora(estacao.periodoFim) : "atual"}`
        : "—",
    ],
  ];
  return (
    <Cartao>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-sky-700">
            Estação {estacao.tipo === "fluviometrica" ? "fluviométrica" : "pluviométrica"} selecionada
          </p>
          <h2 className="text-xl font-semibold text-slate-900">{estacao.nome}</h2>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <SelosEstacao e={estacao} />
          </div>
        </div>
        <a
          href={`https://www.google.com/maps?q=${estacao.latitude},${estacao.longitude}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-sky-400 hover:text-sky-800"
        >
          Ver no mapa ↗
        </a>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
        {itens.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-slate-500">{k}</dt>
            <dd className="font-medium text-slate-800">{v}</dd>
          </div>
        ))}
      </dl>
    </Cartao>
  );
}

export default function Dashboard() {
  const [resposta, setResposta] = useState<EstacoesResposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [aba, setAba] = useState<Aba>("telemetria");
  const [formato, setFormato] = useState<CsvFormato>("excel");
  const [versaoLog, setVersaoLog] = useState(0);

  const carregarEstacoes = useCallback(async (forcar: boolean) => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await buscarJson<EstacoesResposta>(`/api/estacoes${forcar ? "?atualizar=1" : ""}`);
      setResposta(r);
      setCodigo((atual) => {
        if (atual && r.estacoes.some((e) => e.codigo === atual)) return atual;
        const padrao =
          r.estacoes.find((e) => e.codigo === "87380000") ??
          r.estacoes.find((e) => e.telemetrica && e.operando) ??
          r.estacoes[0];
        return padrao?.codigo ?? null;
      });
    } catch (e) {
      setErro(`Falha ao carregar estações: ${mensagem(e)}`);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregarEstacoes(false);
  }, [carregarEstacoes]);

  const estacoes = useMemo(() => resposta?.estacoes ?? [], [resposta]);
  const estacao = useMemo(() => estacoes.find((e) => e.codigo === codigo) ?? null, [estacoes, codigo]);
  const estacoesMarcadas = useMemo(() => estacoes.filter((e) => marcadas.includes(e.codigo)), [estacoes, marcadas]);
  const registrarAtividade = useCallback(() => setVersaoLog((v) => v + 1), []);

  const selecionar = useCallback((e: Estacao) => {
    setCodigo(e.codigo);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      document.getElementById("painel-dados")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const alternarMarcada = useCallback((c: string) => {
    setMarcadas((atual) =>
      atual.includes(c) ? atual.filter((x) => x !== c) : atual.length >= MAX_MARCADAS ? atual : [...atual, c],
    );
  }, []);

  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-r from-sky-900 via-sky-700 to-cyan-600 text-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-4 px-4 py-7 sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-100">
              Dados hidrometeorológicos · Agência Nacional de Águas
            </p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Pluviometria de Campo Bom e região</h1>
            <p className="mt-1 max-w-2xl text-sm text-sky-100">
              Consulta direta à API da ANA (HidroWeb e Telemetria): chuva recente, séries históricas e temperatura, com
              exportação em CSV.
            </p>
          </div>
          <label className="flex flex-col gap-1 text-xs font-medium text-sky-100">
            Formato dos arquivos CSV
            <select
              value={formato}
              onChange={(e) => setFormato(e.target.value as CsvFormato)}
              className="rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm text-white backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/60"
            >
              <option value="excel" className="text-slate-900">
                Excel pt-BR (separador ; e vírgula decimal)
              </option>
              <option value="padrao" className="text-slate-900">
                Padrão internacional (separador , e ponto decimal)
              </option>
            </select>
          </label>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[370px_minmax(0,1fr)]">
        <EstacoesPainel
          resposta={resposta}
          carregando={carregando}
          erro={erro}
          selecionada={codigo}
          marcadas={marcadas}
          onSelecionar={selecionar}
          onAlternarMarcada={alternarMarcada}
          onLimparMarcadas={() => setMarcadas([])}
          onAtualizar={(forcar) => void carregarEstacoes(forcar)}
        />

        <section id="painel-dados" className="min-w-0 space-y-4">
          {estacao ? (
            <CartaoEstacao estacao={estacao} />
          ) : (
            <Cartao>
              <p className="text-sm text-slate-500">
                {carregando ? "Carregando estações…" : "Selecione uma estação na lista ou no mapa."}
              </p>
            </Cartao>
          )}

          <nav className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Tipo de dado">
            {ABAS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAba(a.id)}
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap transition ${
                  aba === a.id ? "bg-sky-700 text-white shadow" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="mr-1.5" aria-hidden>
                  {a.icone}
                </span>
                {a.rotulo}
              </button>
            ))}
          </nav>

          {estacoesMarcadas.length ? (
            <p className="text-xs text-amber-800">
              {estacoesMarcadas.length} estação(ões) marcada(s) para exportação em lote:{" "}
              {estacoesMarcadas.map((e) => e.nome).join(", ")}
            </p>
          ) : null}

          <AbaTelemetria
            ativa={aba === "telemetria"}
            estacao={estacao}
            marcadas={estacoesMarcadas}
            formato={formato}
            onAtividade={registrarAtividade}
          />
          <AbaHistorico
            ativa={aba === "historico"}
            estacao={estacao}
            estacoes={estacoes}
            marcadas={estacoesMarcadas}
            formato={formato}
            onAtividade={registrarAtividade}
            onSelecionarEstacao={selecionar}
          />
          <AbaTemperatura
            ativa={aba === "temperatura"}
            estacao={estacao}
            marcadas={estacoesMarcadas}
            formato={formato}
            onAtividade={registrarAtividade}
          />
        </section>
      </main>

      <section className="mx-auto max-w-[1400px] px-4 pb-8 sm:px-6">
        <ConsultasRecentes versao={versaoLog} />
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-[1400px] px-4 py-5 text-xs text-slate-500 sm:px-6">
          Fontes: ANA – Agência Nacional de Águas e Saneamento Básico (HidroInventario, HidroSerieHistorica e
          DadosHidrometeorologicos – telemetriaws1.ana.gov.br) · Temperatura: Open-Meteo / ERA5 (Copernicus/ECMWF). Os
          dados brutos podem conter falhas e não passaram necessariamente por consistência.
        </div>
      </footer>
    </div>
  );
}
