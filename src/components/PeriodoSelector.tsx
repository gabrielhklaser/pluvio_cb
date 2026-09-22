"use client";

import { useState } from "react";
import { addDays, addYears, maxISO, minISO } from "@/lib/dates";
import { botaoSecundario, campo } from "./ui";

export type Preset = { rotulo: string; dias?: number; anos?: number; inicioFixo?: string };

export function PeriodoSelector({
  inicio,
  fim,
  min,
  max,
  presets,
  onChange,
  mostrarAnos = true,
}: {
  inicio: string;
  fim: string;
  min: string;
  max: string;
  presets: Preset[];
  onChange: (inicio: string, fim: string) => void;
  mostrarAnos?: boolean;
}) {
  const [anoIni, setAnoIni] = useState(inicio.slice(0, 4));
  const [anoFim, setAnoFim] = useState(fim.slice(0, 4));
  const [anterior, setAnterior] = useState({ inicio, fim });
  if (anterior.inicio !== inicio || anterior.fim !== fim) {
    setAnterior({ inicio, fim });
    setAnoIni(inicio.slice(0, 4));
    setAnoFim(fim.slice(0, 4));
  }

  const limitar = (d: string) => minISO(maxISO(d, min), max);

  function aplicarPreset(p: Preset) {
    const f = max;
    let i: string;
    if (p.inicioFixo) i = p.inicioFixo;
    else if (p.anos) i = addYears(f, -p.anos);
    else i = addDays(f, -((p.dias ?? 7) - 1));
    onChange(limitar(i), f);
  }

  function aplicarAnos() {
    const a = parseInt(anoIni, 10);
    const b = parseInt(anoFim, 10);
    if (!a || !b) return;
    const i = limitar(`${Math.min(a, b)}-01-01`);
    const f = limitar(`${Math.max(a, b)}-12-31`);
    onChange(i, f);
  }

  const anoMin = Number(min.slice(0, 4));
  const anoMax = Number(max.slice(0, 4));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Data inicial
          <input
            type="date"
            className={campo}
            value={inicio}
            min={min}
            max={fim}
            onChange={(e) => e.target.value && onChange(e.target.value, fim)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Data final
          <input
            type="date"
            className={campo}
            value={fim}
            min={inicio}
            max={max}
            onChange={(e) => e.target.value && onChange(inicio, e.target.value)}
          />
        </label>
        {mostrarAnos ? (
          <div className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Intervalo de anos
            <div className="flex items-center gap-2">
              <input
                type="number"
                className={`${campo} w-24`}
                value={anoIni}
                min={anoMin}
                max={anoMax}
                onChange={(e) => setAnoIni(e.target.value)}
                aria-label="Ano inicial"
              />
              <span className="text-slate-400">até</span>
              <input
                type="number"
                className={`${campo} w-24`}
                value={anoFim}
                min={anoMin}
                max={anoMax}
                onChange={(e) => setAnoFim(e.target.value)}
                aria-label="Ano final"
              />
              <button type="button" className={botaoSecundario} onClick={aplicarAnos}>
                Aplicar
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.rotulo}
            type="button"
            onClick={() => aplicarPreset(p)}
            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800 transition hover:border-sky-400 hover:bg-sky-100"
          >
            {p.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}
