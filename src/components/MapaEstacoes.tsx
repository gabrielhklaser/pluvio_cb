"use client";

import { fmt } from "@/lib/cliente";
import type { Estacao } from "@/lib/types";

export function corEstacao(e: Estacao): string {
  if (!e.operando) return "#94a3b8";
  if (e.tipo === "fluviometrica") return "#7c3aed";
  if (e.telemetrica) return "#059669";
  return "#0284c7";
}

export function MapaEstacoes({
  estacoes,
  centro,
  raio,
  selecionada,
  marcadas,
  onSelecionar,
}: {
  estacoes: Estacao[];
  centro: { nome: string; latitude: number; longitude: number };
  raio: number;
  selecionada: string | null;
  marcadas: string[];
  onSelecionar: (e: Estacao) => void;
}) {
  const S = 340;
  const c = S / 2;
  const margem = 16;
  const escala = (S / 2 - margem) / raio;
  const kmLat = 111.32;
  const kmLon = 111.32 * Math.cos((centro.latitude * Math.PI) / 180);
  const pos = (e: Estacao) => ({
    x: c + (e.longitude - centro.longitude) * kmLon * escala,
    y: c - (e.latitude - centro.latitude) * kmLat * escala,
  });
  const aneis = [raio / 3, (2 * raio) / 3, raio];
  const ordenadas = [...estacoes].sort(
    (a, b) => Number(a.codigo === selecionada) - Number(b.codigo === selecionada),
  );

  return (
    <div>
      <svg
        viewBox={`0 0 ${S} ${S}`}
        className="h-auto w-full rounded-xl border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50"
        role="img"
        aria-label="Mapa esquemático das estações ao redor de Campo Bom"
      >
        <line x1={c} y1={margem - 8} x2={c} y2={S - margem + 8} stroke="#e0f2fe" />
        <line x1={margem - 8} y1={c} x2={S - margem + 8} y2={c} stroke="#e0f2fe" />
        {aneis.map((r) => (
          <g key={r}>
            <circle cx={c} cy={c} r={r * escala} fill="none" stroke="#7dd3fc" strokeDasharray="4 4" strokeOpacity={0.8} />
            <text x={c + 4} y={c - r * escala + 11} fontSize={9} fill="#0369a1">
              {fmt(r, r < 10 ? 1 : 0)} km
            </text>
          </g>
        ))}
        <g transform={`translate(${S - 22}, 14)`}>
          <path d="M6 0 L11 14 L6 11 L1 14 Z" fill="#475569" />
          <text x={6} y={26} textAnchor="middle" fontSize={10} fontWeight={600} fill="#475569">
            N
          </text>
        </g>
        {ordenadas.map((e) => {
          const p = pos(e);
          const sel = e.codigo === selecionada;
          const marcada = marcadas.includes(e.codigo);
          return (
            <g key={e.codigo} className="cursor-pointer" onClick={() => onSelecionar(e)}>
              {sel ? <circle cx={p.x} cy={p.y} r={10.5} fill="none" stroke="#0f172a" strokeWidth={1.6} /> : null}
              <circle
                cx={p.x}
                cy={p.y}
                r={sel ? 6.5 : 4.4}
                fill={corEstacao(e)}
                stroke={marcada ? "#f59e0b" : "#ffffff"}
                strokeWidth={marcada ? 2.4 : 1.3}
              />
              <title>{`${e.nome} (${e.codigo}) — ${e.municipio ?? ""} · ${fmt(e.distanciaKm)} km`}</title>
            </g>
          );
        })}
        <g transform={`translate(${c}, ${c})`} pointerEvents="none">
          <rect x={-4.5} y={-4.5} width={9} height={9} transform="rotate(45)" fill="#e11d48" stroke="white" strokeWidth={1.5} />
          <text y={-10} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#9f1239">
            {centro.nome.replace(" - RS", "")}
          </text>
        </g>
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
        {[
          ["#0284c7", "Pluviômetro convencional"],
          ["#059669", "Pluviométrica telemétrica"],
          ["#7c3aed", "Fluviométrica telemétrica"],
          ["#94a3b8", "Desativada"],
        ].map(([cor, rotulo]) => (
          <span key={rotulo} className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: cor }} />
            {rotulo}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-amber-500" />
          Marcada p/ lote
        </span>
      </div>
    </div>
  );
}
