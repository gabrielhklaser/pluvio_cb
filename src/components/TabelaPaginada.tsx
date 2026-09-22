"use client";

import { useState, type ReactNode } from "react";

export type Coluna<T> = { titulo: string; render: (linha: T) => ReactNode; alinhar?: "esq" | "dir" };

export function TabelaPaginada<T>({
  linhas,
  colunas,
  chave,
  porPagina = 20,
}: {
  linhas: T[];
  colunas: Coluna<T>[];
  chave: (linha: T, indice: number) => string;
  porPagina?: number;
}) {
  const [pagina, setPagina] = useState(0);
  const [linhasAnteriores, setLinhasAnteriores] = useState(linhas);
  if (linhasAnteriores !== linhas) {
    setLinhasAnteriores(linhas);
    setPagina(0);
  }

  const totalPaginas = Math.max(1, Math.ceil(linhas.length / porPagina));
  const atual = Math.min(pagina, totalPaginas - 1);
  const visiveis = linhas.slice(atual * porPagina, (atual + 1) * porPagina);

  if (!linhas.length) return <p className="py-6 text-center text-sm text-slate-500">Nenhum registro.</p>;

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {colunas.map((c) => (
                <th
                  key={c.titulo}
                  className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide whitespace-nowrap text-slate-600 ${
                    c.alinhar === "dir" ? "text-right" : "text-left"
                  }`}
                >
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {visiveis.map((l, i) => (
              <tr key={chave(l, atual * porPagina + i)} className="hover:bg-sky-50/50">
                {colunas.map((c) => (
                  <td
                    key={c.titulo}
                    className={`px-3 py-1.5 whitespace-nowrap tabular-nums text-slate-700 ${
                      c.alinhar === "dir" ? "text-right" : "text-left"
                    }`}
                  >
                    {c.render(l)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {linhas.length.toLocaleString("pt-BR")} registros · página {atual + 1} de {totalPaginas}
        </span>
        <div className="flex gap-1">
          {[
            ["«", 0],
            ["‹", atual - 1],
            ["›", atual + 1],
            ["»", totalPaginas - 1],
          ].map(([rotulo, destino]) => (
            <button
              key={rotulo as string}
              type="button"
              disabled={(destino as number) < 0 || (destino as number) >= totalPaginas || destino === atual}
              onClick={() => setPagina(destino as number)}
              className="h-7 min-w-7 rounded-lg border border-slate-200 bg-white px-2 text-slate-700 hover:border-sky-400 disabled:opacity-40"
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
