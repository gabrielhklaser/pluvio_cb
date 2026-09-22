// Utilitários usados pelos componentes do navegador.

export function montarUrl(caminho: string, params: Record<string, string | number | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== "") sp.set(k, String(v));
  }
  return `${caminho}?${sp.toString()}`;
}

export async function buscarJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { cache: "no-store", signal });
  const json = (await res.json().catch(() => null)) as (T & { erro?: string }) | null;
  if (!res.ok || !json) {
    throw new Error((json && typeof json.erro === "string" && json.erro) || `Erro HTTP ${res.status}`);
  }
  return json;
}

/** Baixa o CSV gerado pelo servidor, tratando erros antes de disparar o download. */
export async function baixarCsv(url: string): Promise<{ registros: number; avisos: string | null; nomeArquivo: string }> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { erro?: string } | null;
    throw new Error(json?.erro || `Erro HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const nomeArquivo = cd.match(/filename="([^"]+)"/)?.[1] ?? "dados.csv";
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 15_000);
  const avisos = res.headers.get("X-Avisos");
  return {
    registros: Number(res.headers.get("X-Registros") ?? 0),
    avisos: avisos ? decodeURIComponent(avisos) : null,
    nomeArquivo,
  };
}

export function fmt(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function fmtInt(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return Math.round(v).toLocaleString("pt-BR");
}

export function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
