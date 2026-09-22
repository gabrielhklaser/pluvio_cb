"use client";

import { useEffect, useState } from "react";
import { buscarJson, fmtInt } from "@/lib/cliente";
import { formatarDataHora } from "@/lib/dates";
import type { ConsultaLog } from "@/lib/types";
import { Cartao, Selo, TituloSecao } from "./ui";

const TIPOS: Record<string, string> = {
  telemetria: "Chuva – telemetria",
  historico: "Chuva – série histórica",
  historico_diario: "Chuva histórica diária",
  historico_mensal: "Chuva histórica mensal",
  historico_anual: "Chuva histórica anual",
  temperatura: "Temperatura",
};

function quando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}

export function ConsultasRecentes({ versao }: { versao: number }) {
  const [lista, setLista] = useState<ConsultaLog[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    buscarJson<{ consultas: ConsultaLog[] }>("/api/consultas")
      .then((r) => {
        if (!ativo) return;
        setLista(r.consultas);
        setErro(false);
      })
      .catch(() => {
        if (ativo) setErro(true);
      });
    return () => {
      ativo = false;
    };
  }, [versao]);

  return (
    <Cartao>
      <TituloSecao titulo="Consultas e exportações recentes" subtitulo="Histórico salvo no banco de dados da plataforma" />
      {erro ? <p className="text-sm text-slate-500">Não foi possível carregar o histórico.</p> : null}
      {lista && !lista.length ? <p className="text-sm text-slate-500">Nenhuma consulta realizada ainda.</p> : null}
      {lista && lista.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Quando</th>
                <th className="py-2 pr-3">Ação</th>
                <th className="py-2 pr-3">Dados</th>
                <th className="py-2 pr-3">Estação(ões)</th>
                <th className="py-2 pr-3">Período</th>
                <th className="py-2 pr-3 text-right">Registros</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map((c) => (
                <tr key={c.id} className="text-slate-700">
                  <td className="py-2 pr-3 whitespace-nowrap">{quando(c.criadoEm)}</td>
                  <td className="py-2 pr-3">
                    {c.acao === "exportacao" ? <Selo cor="emerald">CSV</Selo> : <Selo cor="sky">Consulta</Selo>}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{TIPOS[c.tipo] ?? c.tipo}</td>
                  <td className="max-w-xs truncate py-2 pr-3" title={c.descricao ?? c.estacoes}>
                    {c.acao === "exportacao" ? c.estacoes : (c.descricao ?? c.estacoes)}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {formatarDataHora(c.dataInicio)} – {formatarDataHora(c.dataFim)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtInt(c.registros)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Cartao>
  );
}
