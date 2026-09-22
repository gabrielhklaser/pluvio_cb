"use client";

import { useState } from "react";
import { formatarDataHora } from "@/lib/dates";
import type { CsvFormato, Estacao } from "@/lib/types";
import { useExportacao } from "./hooks";
import { Alerta, botaoExportar, botaoSecundario, IconeDownload } from "./ui";

export type OpcaoExportacao = { chave: string; rotulo: string; descricao: string };

const FORMATO_TEXTO: Record<CsvFormato, string> = {
  excel: "Excel pt-BR (separador “;”, vírgula decimal)",
  padrao: "padrão internacional (separador “,”, ponto decimal)",
};

/**
 * Painel único de exportação usado nas três abas.
 * Fluxo com dupla checagem: 1) escolher o CSV → 2) conferir o resumo (estações, período,
 * parâmetros e formato) → 3) confirmar o download.
 */
export function PainelExportacao({
  estacao,
  marcadas,
  formato,
  inicio,
  fim,
  opcoes,
  parametros,
  montarUrl,
  bloqueio,
  onAtividade,
}: {
  estacao: Estacao | null;
  marcadas: Estacao[];
  formato: CsvFormato;
  inicio: string;
  fim: string;
  opcoes: OpcaoExportacao[];
  /** Descrição dos parâmetros em vigor (agregação, consistência, granularidade…). */
  parametros: string;
  montarUrl: (chave: string, codigos: string[]) => string;
  /** Mensagem que impede a exportação (ex.: período inválido). */
  bloqueio?: string | null;
  onAtividade: () => void;
}) {
  const [alvo, setAlvo] = useState<"selecionada" | "marcadas">("selecionada");
  const [pendente, setPendente] = useState<OpcaoExportacao | null>(null);
  const exportacao = useExportacao(onAtividade);

  const usarMarcadas = alvo === "marcadas" && marcadas.length > 0;
  const estacoesAlvo: Estacao[] = usarMarcadas ? marcadas : estacao ? [estacao] : [];
  const desabilitado = !estacoesAlvo.length || !!exportacao.exportando || !!bloqueio;

  async function confirmar() {
    if (!pendente || !estacoesAlvo.length) return;
    const url = montarUrl(
      pendente.chave,
      estacoesAlvo.map((e) => e.codigo),
    );
    setPendente(null);
    await exportacao.exportar(pendente.chave, url);
  }

  return (
    <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Exportar CSV</span>
        {marcadas.length ? (
          <div className="ml-1 flex rounded-lg bg-white p-0.5 text-xs shadow-sm ring-1 ring-emerald-200">
            {(
              [
                ["selecionada", "Estação selecionada"],
                ["marcadas", `${marcadas.length} marcada${marcadas.length > 1 ? "s" : ""}`],
              ] as const
            ).map(([v, rotulo]) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setAlvo(v);
                  setPendente(null);
                }}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  alvo === v ? "bg-emerald-600 text-white" : "text-slate-600 hover:text-emerald-800"
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <button
            key={o.chave}
            type="button"
            className={botaoExportar}
            disabled={desabilitado}
            title={o.descricao}
            onClick={() => setPendente(pendente?.chave === o.chave ? null : o)}
          >
            <IconeDownload />
            {exportacao.exportando === o.chave ? "Gerando CSV…" : o.rotulo}
          </button>
        ))}
      </div>

      {bloqueio ? <p className="mt-2 text-xs text-rose-600">{bloqueio}</p> : null}

      {pendente && !exportacao.exportando ? (
        <div className="mt-3 rounded-xl border border-emerald-300 bg-white p-3 text-sm shadow-sm">
          <p className="font-semibold text-slate-900">Confira antes de baixar</p>
          <dl className="mt-1.5 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Conteúdo</dt>
              <dd className="font-medium text-slate-800">{pendente.descricao}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Período</dt>
              <dd className="font-medium text-slate-800">
                {formatarDataHora(inicio)} a {formatarDataHora(fim)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">
                {estacoesAlvo.length === 1 ? "Estação" : `${estacoesAlvo.length} estações`}
              </dt>
              <dd className="font-medium text-slate-800">
                {estacoesAlvo.map((e) => `${e.nome} (${e.codigo})`).join(", ")}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Parâmetros</dt>
              <dd className="font-medium text-slate-800">{parametros}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Formato do arquivo</dt>
              <dd className="font-medium text-slate-800">{FORMATO_TEXTO[formato]}</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={botaoExportar} onClick={() => void confirmar()}>
              <IconeDownload />
              Confirmar e baixar
            </button>
            <button type="button" className={botaoSecundario} onClick={() => setPendente(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {exportacao.exportando ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-800">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-700" />
          Consultando a fonte e gerando o arquivo… períodos longos ou várias estações podem levar alguns segundos.
        </div>
      ) : null}

      {exportacao.retorno ? (
        <div className="mt-3">
          <Alerta tipo={exportacao.retorno.tipo}>{exportacao.retorno.texto}</Alerta>
        </div>
      ) : null}
    </div>
  );
}
