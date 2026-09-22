// Utilitários de datas (ISO YYYY-MM-DD) seguros para servidor e cliente.

export const TZ = "America/Sao_Paulo";

export const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function parseISO(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isISODate(s: string | null | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseISO(s);
  return !Number.isNaN(d.getTime()) && toISO(d) === s;
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

export function addYears(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setUTCFullYear(d.getUTCFullYear() + n);
  return toISO(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}

export function minISO(a: string, b: string): string {
  return a < b ? a : b;
}

export function maxISO(a: string, b: string): string {
  return a > b ? a : b;
}

/** Converte "YYYY-MM-DD" em "DD/MM/YYYY" (formato exigido pela ANA). */
export function isoToBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** "YYYY-MM-DD HH:mm" -> "DD/MM/YYYY HH:mm" (mantém apenas data se não houver hora). */
export function formatarDataHora(s: string | null | undefined): string {
  if (!s) return "—";
  const data = isoToBR(s.slice(0, 10));
  const hora = s.slice(11, 16);
  return hora ? `${data} ${hora}` : data;
}

/** m: 1-12 */
export function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
