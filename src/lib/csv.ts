import type { CsvFormato } from "./types";

export type CelulaCsv = string | number | null | undefined;

/**
 * Gera CSV com BOM UTF-8.
 * - "excel": separador ";" e vírgula decimal (abre direto no Excel em português)
 * - "padrao": separador "," e ponto decimal (R, Python, planilhas em inglês)
 */
export function gerarCsv(cabecalho: string[], linhas: CelulaCsv[][], formato: CsvFormato): string {
  const sep = formato === "excel" ? ";" : ",";
  const celula = (v: CelulaCsv): string => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") {
      if (!Number.isFinite(v)) return "";
      const s = String(Math.round(v * 10_000) / 10_000);
      return formato === "excel" ? s.replace(".", ",") : s;
    }
    const s = String(v);
    return /[";,\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const corpo = [cabecalho, ...linhas].map((l) => l.map(celula).join(sep)).join("\r\n");
  return `\uFEFF${corpo}\r\n`;
}

export function nomeArquivoSeguro(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_.-]+/g, "_")
    .replace(/_+/g, "_");
}
