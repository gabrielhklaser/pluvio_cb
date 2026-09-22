"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { fmt } from "@/lib/cliente";

const W = 800;
const M = { top: 14, right: 16, bottom: 30, left: 52 };

export type PontoBarra = { rotulo: string; valor: number | null };
export type SerieLinha = { nome: string; cor: string; valores: (number | null)[] };

function ticksAgradaveis(min: number, max: number, alvo = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (max - min < 1e-9) {
    min -= 1;
    max += 1;
  }
  const bruto = (max - min) / alvo;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / mag;
  const passo = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  const ini = Math.floor(min / passo) * passo;
  const fim = Math.ceil(max / passo) * passo;
  const out: number[] = [];
  for (let v = ini; v <= fim + passo * 0.5; v += passo) out.push(Number(v.toFixed(6)));
  return out;
}

function indicesRotulos(n: number, max = 6): number[] {
  if (n <= 0) return [];
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const out: number[] = [];
  for (let k = 0; k < max; k++) out.push(Math.round((k * (n - 1)) / (max - 1)));
  return [...new Set(out)];
}

function fmtEixo(v: number): string {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 1 });
}

function ancora(i: number, n: number): "start" | "middle" | "end" {
  if (n > 2 && i === 0) return "start";
  if (n > 2 && i === n - 1) return "end";
  return "middle";
}

function useHover(n: number, plotW: number, modo: "faixa" | "ponto") {
  const [indice, setIndice] = useState<number | null>(null);
  function aoMover(e: MouseEvent<SVGSVGElement>) {
    if (n === 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W - M.left;
    let i = modo === "faixa" ? Math.floor((x / plotW) * n) : Math.round((x / plotW) * (n - 1));
    if (n === 1) i = 0;
    setIndice(i >= 0 && i < n ? i : null);
  }
  return { indice, aoMover, aoSair: () => setIndice(null) };
}

function Dica({ xPct, children }: { xPct: number; children: ReactNode }) {
  const left = Math.min(86, Math.max(14, xPct));
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-slate-900/90 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
      style={{ left: `${left}%` }}
    >
      {children}
    </div>
  );
}

export function GraficoBarras({
  dados,
  altura = 240,
  cor = "#0284c7",
  unidade = "mm",
  casas = 1,
  vazio = "Sem dados para exibir.",
}: {
  dados: PontoBarra[];
  altura?: number;
  cor?: string;
  unidade?: string;
  casas?: number;
  vazio?: string;
}) {
  const H = altura;
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const n = dados.length;
  const hover = useHover(n, plotW, "faixa");
  if (!n) return <p className="py-10 text-center text-sm text-slate-500">{vazio}</p>;

  let maxV = 0;
  for (const d of dados) if (d.valor !== null && d.valor > maxV) maxV = d.valor;
  const ticks = ticksAgradaveis(0, maxV > 0 ? maxV : 1, 4);
  const yMax = ticks[ticks.length - 1] || 1;
  const base = M.top + plotH;
  const y = (v: number) => base - (v / yMax) * plotH;
  const bw = plotW / n;
  const gap = bw > 4 ? bw * 0.18 : 0;
  const sel = hover.indice !== null ? dados[hover.indice] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full select-none"
        onMouseMove={hover.aoMover}
        onMouseLeave={hover.aoSair}
        role="img"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" />
            <text x={M.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#64748b">
              {fmtEixo(t)}
            </text>
          </g>
        ))}
        {dados.map((d, i) =>
          d.valor === null ? (
            <rect key={i} x={M.left + i * bw} y={base - 3} width={Math.max(bw, 0.5)} height={3} fill="#fda4af" opacity={0.7} />
          ) : d.valor > 0 ? (
            <rect
              key={i}
              x={M.left + i * bw + gap / 2}
              y={y(d.valor)}
              width={Math.max(bw - gap, 0.6)}
              height={Math.max(base - y(d.valor), 0.8)}
              fill={hover.indice === i ? "#0c4a6e" : cor}
              rx={bw > 10 ? 2 : 0}
            />
          ) : null,
        )}
        <line x1={M.left} x2={W - M.right} y1={base} y2={base} stroke="#94a3b8" />
        {indicesRotulos(n).map((i) => (
          <text
            key={i}
            x={M.left + (i + 0.5) * bw}
            y={H - 9}
            textAnchor={ancora(i, n)}
            fontSize={11}
            fill="#64748b"
          >
            {dados[i].rotulo}
          </text>
        ))}
        {hover.indice !== null ? (
          <line
            x1={M.left + (hover.indice + 0.5) * bw}
            x2={M.left + (hover.indice + 0.5) * bw}
            y1={M.top}
            y2={base}
            stroke="#0f172a"
            strokeOpacity={0.25}
            strokeDasharray="4 3"
          />
        ) : null}
      </svg>
      {sel && hover.indice !== null ? (
        <Dica xPct={((M.left + (hover.indice + 0.5) * bw) / W) * 100}>
          <div className="font-medium">{sel.rotulo}</div>
          <div>{sel.valor === null ? "sem dado" : `${fmt(sel.valor, casas)} ${unidade}`}</div>
        </Dica>
      ) : null}
    </div>
  );
}

export function GraficoLinhas({
  rotulos,
  series,
  altura = 260,
  unidade = "°C",
  casas = 1,
  vazio = "Sem dados para exibir.",
}: {
  rotulos: string[];
  series: SerieLinha[];
  altura?: number;
  unidade?: string;
  casas?: number;
  vazio?: string;
}) {
  const H = altura;
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const n = rotulos.length;
  const hover = useHover(n, plotW, "ponto");
  if (!n) return <p className="py-10 text-center text-sm text-slate-500">{vazio}</p>;

  let min = Infinity;
  let max = -Infinity;
  for (const s of series) {
    for (const v of s.valores) {
      if (v === null) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min)) {
    min = 0;
    max = 1;
  }
  const ticks = ticksAgradaveis(min, max, 5);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const x = (i: number) => M.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => M.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  const caminhos = series.map((s) => {
    let d = "";
    let caneta = false;
    s.valores.forEach((v, i) => {
      if (v === null) {
        caneta = false;
        return;
      }
      d += `${caneta ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      caneta = true;
    });
    return d;
  });
  const idx = hover.indice;

  return (
    <div>
      <div className="mb-1 flex flex-wrap gap-4 text-xs text-slate-600">
        {series.map((s) => (
          <span key={s.nome} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.cor }} />
            {s.nome}
          </span>
        ))}
      </div>
      <div className="relative">
        <svg
            viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full select-none"
          onMouseMove={hover.aoMover}
          onMouseLeave={hover.aoSair}
          role="img"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" />
              <text x={M.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#64748b">
                {fmtEixo(t)}
              </text>
            </g>
          ))}
          {caminhos.map((d, i) => (
            <path key={series[i].nome} d={d} fill="none" stroke={series[i].cor} strokeWidth={n > 400 ? 1.1 : 1.8} strokeLinejoin="round" />
          ))}
          {indicesRotulos(n).map((i) => (
            <text key={i} x={x(i)} y={H - 9} textAnchor={ancora(i, n)} fontSize={11} fill="#64748b">
              {rotulos[i]}
            </text>
          ))}
          {idx !== null ? (
            <g>
              <line x1={x(idx)} x2={x(idx)} y1={M.top} y2={M.top + plotH} stroke="#0f172a" strokeOpacity={0.25} strokeDasharray="4 3" />
              {series.map((s) =>
                s.valores[idx] === null || s.valores[idx] === undefined ? null : (
                  <circle key={s.nome} cx={x(idx)} cy={y(s.valores[idx] as number)} r={3.5} fill={s.cor} stroke="white" strokeWidth={1.5} />
                ),
              )}
            </g>
          ) : null}
        </svg>
        {idx !== null ? (
          <Dica xPct={(x(idx) / W) * 100}>
            <div className="font-medium">{rotulos[idx]}</div>
            {series.map((s) => (
              <div key={s.nome}>
                {s.nome}: {s.valores[idx] === null || s.valores[idx] === undefined ? "—" : `${fmt(s.valores[idx], casas)} ${unidade}`}
              </div>
            ))}
          </Dica>
        ) : null}
      </div>
    </div>
  );
}
