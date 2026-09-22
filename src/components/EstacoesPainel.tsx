"use client";

import { useMemo, useState } from "react";
import { fmt } from "@/lib/cliente";
import { formatarDataHora } from "@/lib/dates";
import type { Estacao, EstacoesResposta } from "@/lib/types";
import { MapaEstacoes } from "./MapaEstacoes";
import { Alerta, Carregando, Cartao, Selo, campo } from "./ui";

type Filtro = "todas" | "historico" | "telemetria" | "operando";

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function SelosEstacao({ e }: { e: Estacao }) {
  return (
    <>
      {e.telemetrica ? <Selo cor="emerald">Telemétrica</Selo> : null}
      {e.pluviometro || e.periodoInicio ? (
        <Selo cor="sky">
          Série convencional
          {e.periodoInicio ? ` ${e.periodoInicio.slice(0, 4)}–${e.periodoFim ? e.periodoFim.slice(0, 4) : "atual"}` : ""}
        </Selo>
      ) : null}
      {e.tipo === "fluviometrica" ? <Selo cor="violet">Fluviométrica</Selo> : null}
      {e.climatologica ? <Selo cor="amber">Climatológica</Selo> : null}
      {!e.operando ? <Selo cor="rose">Desativada</Selo> : null}
    </>
  );
}

export function EstacoesPainel({
  resposta,
  carregando,
  erro,
  selecionada,
  marcadas,
  onSelecionar,
  onAlternarMarcada,
  onLimparMarcadas,
  onAtualizar,
}: {
  resposta: EstacoesResposta | null;
  carregando: boolean;
  erro: string | null;
  selecionada: string | null;
  marcadas: string[];
  onSelecionar: (e: Estacao) => void;
  onAlternarMarcada: (codigo: string) => void;
  onLimparMarcadas: () => void;
  onAtualizar: (forcar: boolean) => void;
}) {
  const [raio, setRaio] = useState(30);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");

  const lista = useMemo(() => {
    const termo = normalizar(busca.trim());
    return (resposta?.estacoes ?? [])
      .filter((e) => e.distanciaKm <= raio)
      .filter((e) => {
        if (filtro === "historico") return e.pluviometro || !!e.periodoInicio;
        if (filtro === "telemetria") return e.telemetrica;
        if (filtro === "operando") return e.operando;
        return true;
      })
      .filter(
        (e) =>
          !termo ||
          normalizar(`${e.nome} ${e.municipio ?? ""} ${e.codigo} ${e.responsavel ?? ""} ${e.rio ?? ""}`).includes(termo),
      );
  }, [resposta, raio, filtro, busca]);

  const fonteTexto =
    resposta?.fonte === "ana"
      ? "Inventário atualizado agora pela API da ANA"
      : resposta?.fonte === "cache"
        ? "Inventário da ANA (cache local)"
        : "Lista de reserva (ANA indisponível)";

  return (
    <aside className="space-y-4">
      <Cartao>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Estações da ANA</h2>
            <p className="text-xs text-slate-500">Campo Bom/RS e arredores (sub-bacia 87 – Guaíba/Sinos)</p>
          </div>
          <button
            type="button"
            onClick={() => onAtualizar(true)}
            disabled={carregando}
            title="Recarregar o inventário diretamente da ANA"
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-sky-400 hover:text-sky-800 disabled:opacity-50"
          >
            ↻ Atualizar
          </button>
        </div>

        {carregando && !resposta ? <Carregando texto="Carregando inventário de estações da ANA…" /> : null}
        {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}

        {resposta ? (
          <MapaEstacoes
            estacoes={lista}
            centro={resposta.centro}
            raio={raio}
            selecionada={selecionada}
            marcadas={marcadas}
            onSelecionar={onSelecionar}
          />
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Raio a partir de Campo Bom
            <select className={campo} value={raio} onChange={(e) => setRaio(Number(e.target.value))}>
              {[5, 10, 20, 30, 40, 50].map((r) => (
                <option key={r} value={r}>
                  {r} km
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Mostrar
            <select className={campo} value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
              <option value="todas">Todas</option>
              <option value="historico">Com série convencional</option>
              <option value="telemetria">Telemétricas</option>
              <option value="operando">Em operação</option>
            </select>
          </label>
        </div>
        <input
          type="search"
          className={`${campo} mt-2 w-full`}
          placeholder="Buscar por nome, município, código ou rio"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {resposta ? (
          <p className="mt-2 text-[11px] text-slate-500">
            {fonteTexto}
            {resposta.atualizadoEm ? ` · ${formatarDataHora(resposta.atualizadoEm.slice(0, 10))}` : ""}
          </p>
        ) : null}
        {resposta?.aviso ? (
          <div className="mt-2">
            <Alerta tipo="aviso">{resposta.aviso}</Alerta>
          </div>
        ) : null}
      </Cartao>

      <Cartao className="overflow-hidden p-0 sm:p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-xs text-slate-600">
          <span>
            <strong className="text-slate-900">{lista.length}</strong> estações no raio de {raio} km
          </span>
          {marcadas.length ? (
            <button type="button" onClick={onLimparMarcadas} className="font-medium text-amber-700 hover:underline">
              Desmarcar {marcadas.length}
            </button>
          ) : (
            <span className="text-slate-400">marque ☐ para exportar em lote</span>
          )}
        </div>
        <ul className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
          {lista.map((e) => {
            const sel = e.codigo === selecionada;
            return (
              <li
                key={e.codigo}
                className={`flex gap-3 px-4 py-3 transition ${sel ? "bg-sky-50 ring-1 ring-sky-200 ring-inset" : "hover:bg-slate-50"}`}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 accent-amber-500"
                  checked={marcadas.includes(e.codigo)}
                  onChange={() => onAlternarMarcada(e.codigo)}
                  aria-label={`Marcar ${e.nome} para exportação em lote`}
                />
                <button type="button" onClick={() => onSelecionar(e)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-sm font-medium ${sel ? "text-sky-900" : "text-slate-900"}`}>{e.nome}</span>
                    <span className="shrink-0 text-xs text-slate-500 tabular-nums">{fmt(e.distanciaKm)} km</span>
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {e.codigo} · {e.municipio ?? "—"} · {e.responsavel ?? "—"}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <SelosEstacao e={e} />
                  </div>
                </button>
              </li>
            );
          })}
          {!lista.length && resposta ? (
            <li className="px-4 py-6 text-center text-sm text-slate-500">Nenhuma estação com esses filtros.</li>
          ) : null}
        </ul>
      </Cartao>
    </aside>
  );
}
