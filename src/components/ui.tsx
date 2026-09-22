import type { ReactNode } from "react";

export const botaoPrimario =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-60";

export const botaoSecundario =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-400 hover:text-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-60";

export const botaoExportar =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-60";

export const campo =
  "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200";

export function Cartao({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>{children}</div>
  );
}

export function TituloSecao({ titulo, subtitulo, acoes }: { titulo: string; subtitulo?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{titulo}</h3>
        {subtitulo ? <p className="mt-0.5 text-xs text-slate-500">{subtitulo}</p> : null}
      </div>
      {acoes}
    </div>
  );
}

export function Indicador({
  rotulo,
  valor,
  detalhe,
  destaque = "sky",
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  destaque?: "sky" | "emerald" | "amber" | "rose" | "violet" | "slate";
}) {
  const cores: Record<string, string> = {
    sky: "from-sky-50 border-sky-100 text-sky-900",
    emerald: "from-emerald-50 border-emerald-100 text-emerald-900",
    amber: "from-amber-50 border-amber-100 text-amber-900",
    rose: "from-rose-50 border-rose-100 text-rose-900",
    violet: "from-violet-50 border-violet-100 text-violet-900",
    slate: "from-slate-50 border-slate-200 text-slate-900",
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br to-white p-4 ${cores[destaque]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
      {detalhe ? <p className="mt-1 text-xs text-slate-500">{detalhe}</p> : null}
    </div>
  );
}

export function Alerta({ tipo = "info", children }: { tipo?: "info" | "erro" | "aviso" | "sucesso"; children: ReactNode }) {
  const estilos: Record<string, string> = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    erro: "border-rose-200 bg-rose-50 text-rose-900",
    aviso: "border-amber-200 bg-amber-50 text-amber-900",
    sucesso: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return <div className={`rounded-xl border px-4 py-3 text-sm ${estilos[tipo]}`}>{children}</div>;
}

export function Carregando({ texto = "Consultando a API…" }: { texto?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-sky-900">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-sky-700" />
      {texto}
    </div>
  );
}

export function Selo({ children, cor = "slate" }: { children: ReactNode; cor?: "slate" | "emerald" | "sky" | "violet" | "amber" | "rose" }) {
  const cores: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-800",
    sky: "bg-sky-100 text-sky-800",
    violet: "bg-violet-100 text-violet-800",
    amber: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-700",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cores[cor]}`}>{children}</span>;
}

export function IconeDownload() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M10 2a1 1 0 0 1 1 1v7.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L9 10.586V3a1 1 0 0 1 1-1Z" />
      <path d="M3 13a1 1 0 0 1 1 1v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1a1 1 0 1 1 2 0v1a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-1a1 1 0 0 1 1-1Z" />
    </svg>
  );
}
